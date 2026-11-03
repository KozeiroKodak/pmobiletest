-- PMobile: administração de credenciais provisórias com recuperação manual.
-- Tokens e primeiras senhas nunca são persistidos em texto puro.
-- A visualização ocorre exclusivamente na resposta ao comando administrativo autenticado.

ALTER TABLE public.usuarios
 ADD COLUMN IF NOT EXISTS senha_provisoria boolean NOT NULL DEFAULT false;

-- Lista apenas metadados e estados. Nunca retorna senha_hash ou token_hash.
CREATE OR REPLACE FUNCTION public.pmobile_admin_listar_credenciais(
 p_admin_usuario text, p_admin_credencial text
)
RETURNS TABLE(
 id bigint, nome text, usuario text, nivel text, ativo boolean,
 senha_definida boolean, senha_provisoria boolean, token_pendente boolean,
 senha_criada_em timestamptz, token_criado_em timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $listar$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.usuarios a
  WHERE lower(a.usuario)=lower(btrim(p_admin_usuario)) AND a.ativo IS TRUE
    AND a.nivel='ADMIN' AND a.senha_hash IS NOT NULL
    AND extensions.crypt(p_admin_credencial,a.senha_hash)=a.senha_hash
 ) THEN
  RAISE EXCEPTION 'Acesso administrativo negado.' USING ERRCODE='42501';
 END IF;
 RETURN QUERY
 SELECT u.id,u.nome,u.usuario,u.nivel,u.ativo,
   (u.senha_hash IS NOT NULL),u.senha_provisoria,(u.token_hash IS NOT NULL),
   u.senha_criada_em,u.token_criado_em
 FROM public.usuarios u
 ORDER BY lower(u.nome),lower(u.usuario),u.id;
END $listar$;

-- Somente um ADMIN com a própria senha pode emitir credenciais.
-- O resultado contém os segredos UMA VEZ; o banco guarda apenas hashes.
CREATE OR REPLACE FUNCTION public.pmobile_admin_gerar_credenciais(
 p_admin_usuario text, p_admin_credencial text, p_usuario_id bigint
)
RETURNS TABLE(usuario_id bigint, nome text, usuario text, token text, primeira_senha text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $emitir$
DECLARE
 v_token text;
 v_senha text;
 v_id bigint;
 v_nome text;
 v_usuario text;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.usuarios a
  WHERE lower(a.usuario)=lower(btrim(p_admin_usuario)) AND a.ativo IS TRUE
    AND a.nivel='ADMIN' AND a.senha_hash IS NOT NULL
    AND extensions.crypt(p_admin_credencial,a.senha_hash)=a.senha_hash
 ) THEN
  RAISE EXCEPTION 'Acesso administrativo negado.' USING ERRCODE='42501';
 END IF;
 SELECT u.id,u.nome,u.usuario INTO v_id,v_nome,v_usuario
 FROM public.usuarios u
 WHERE u.id=p_usuario_id AND u.ativo IS TRUE AND u.nivel <> 'ADMIN'
 FOR UPDATE;
 IF v_id IS NULL THEN
  RAISE EXCEPTION 'Apenas contas ativas não administrativas podem receber acesso provisório.'
   USING ERRCODE='22023';
 END IF;

 v_token:=encode(extensions.gen_random_bytes(16),'hex');
 v_senha:=encode(extensions.gen_random_bytes(12),'hex');
 UPDATE public.usuarios u SET
   token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),
   token_criado_em=now(),
   senha_hash=extensions.crypt(v_senha,extensions.gen_salt('bf')),
   senha_criada_em=now(),
   senha_provisoria=true,
   ultimo_acesso_em=null
 WHERE u.id=v_id;
 RETURN QUERY SELECT v_id,v_nome,v_usuario,v_token,v_senha;
END $emitir$;

-- Bloqueia o fluxo antigo de criação de senha por simples nome de usuário.
-- Não removemos a assinatura antiga para não quebrar dependências do catálogo.
CREATE OR REPLACE FUNCTION public.criar_senha_usuario(p_usuario text, p_senha text)
RETURNS TABLE(id bigint,nome text,usuario text,nivel text,ativo boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $antigo$
BEGIN
 RAISE EXCEPTION 'É necessário confirmar token ou senha provisória. Atualize o PMobile.'
   USING ERRCODE='42501';
END $antigo$;

-- Troca pelo usuário autenticado com o token ou senha provisória original.
CREATE OR REPLACE FUNCTION public.criar_senha_usuario(
 p_usuario text, p_senha text, p_credencial text
)
RETURNS TABLE(id bigint,nome text,usuario text,nivel text,ativo boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $nova$
DECLARE
 v_id bigint;
 v_hash text;
BEGIN
 IF char_length(coalesce(p_senha,'')) < 8 OR char_length(p_senha)>128 THEN
  RAISE EXCEPTION 'A nova senha deve ter de 8 a 128 caracteres.' USING ERRCODE='22023';
 END IF;
 IF coalesce(p_credencial,'')='' THEN
  RAISE EXCEPTION 'Informe o token ou senha provisória.' USING ERRCODE='42501';
 END IF;
 SELECT u.id,u.senha_hash INTO v_id,v_hash
 FROM public.usuarios u
 WHERE lower(u.usuario)=lower(btrim(p_usuario)) AND u.ativo IS TRUE
  AND (u.senha_hash IS NULL OR u.senha_provisoria IS TRUE)
  AND (
    (u.token_hash IS NOT NULL
      AND encode(extensions.digest(btrim(p_credencial),'sha256'),'hex')=u.token_hash)
    OR (u.senha_provisoria IS TRUE AND u.senha_hash IS NOT NULL
      AND extensions.crypt(p_credencial,u.senha_hash)=u.senha_hash)
  )
 FOR UPDATE;
 IF v_id IS NULL THEN
  RAISE EXCEPTION 'Token ou senha provisória inválida.' USING ERRCODE='42501';
 END IF;
 IF v_hash IS NOT NULL AND extensions.crypt(p_senha,v_hash)=v_hash THEN
  RAISE EXCEPTION 'Escolha uma nova senha diferente da provisória.' USING ERRCODE='22023';
 END IF;
 UPDATE public.usuarios u SET
   senha_hash=extensions.crypt(p_senha,extensions.gen_salt('bf')),
   senha_criada_em=now(),
   senha_provisoria=false,
   token_hash=null,
   token_criado_em=null,
   ultimo_acesso_em=now()
 WHERE u.id=v_id;
 RETURN QUERY
 SELECT u.id,u.nome,u.usuario,u.nivel,u.ativo FROM public.usuarios u WHERE u.id=v_id;
END $nova$;

-- Login existente indica a exigência de troca quando a senha é provisória.
CREATE OR REPLACE FUNCTION public.autenticar_usuario(p_usuario text, p_credencial text)
 RETURNS TABLE(id bigint, nome text, usuario text, nivel text, ativo boolean, precisa_criar_senha boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
    v_usuario public.usuarios%rowtype;
begin
    select u.*
      into v_usuario
      from public.usuarios u
     where lower(u.usuario) = lower(trim(p_usuario))
       and u.ativo = true
       and (
            (
                u.senha_hash is not null
                and extensions.crypt(p_credencial, u.senha_hash) = u.senha_hash
            )
            or
            (
                u.senha_hash is null
                and u.token_hash is not null
                and encode(extensions.digest(trim(p_credencial), 'sha256'), 'hex') = u.token_hash
            )
       )
     limit 1;

    if not found then
        return;
    end if;

    update public.usuarios u
       set ultimo_acesso_em = now()
     where u.id = v_usuario.id;

    id := v_usuario.id;
    nome := v_usuario.nome;
    usuario := v_usuario.usuario;
    nivel := v_usuario.nivel;
    ativo := v_usuario.ativo;
    precisa_criar_senha := (v_usuario.senha_hash is null or v_usuario.senha_provisoria is true);

    return next;
end;
$function$


-- API: exige credenciais verificadas por funções, nunca dá SELECT em hashes.
REVOKE ALL ON FUNCTION public.pmobile_admin_listar_credenciais(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pmobile_admin_gerar_credenciais(text,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.criar_senha_usuario(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.criar_senha_usuario(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pmobile_admin_listar_credenciais(text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pmobile_admin_gerar_credenciais(text,text,bigint) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.criar_senha_usuario(text,text,text) TO anon,authenticated;
