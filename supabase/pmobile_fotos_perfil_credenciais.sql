-- PMobile: evita registrar "ultimo_acesso_em" em leituras de fotos.
-- A validacao de credencial espelha a senha definitiva do login existente,
-- sem tocar em public.usuarios, suas senhas ou niveis.
BEGIN;
CREATE OR REPLACE FUNCTION private.pmobile_foto_credencial_id(
  p_usuario text,p_credencial text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_id bigint;
BEGIN
 IF p_usuario IS NULL OR p_credencial IS NULL OR length(p_credencial)=0 THEN RETURN NULL; END IF;
 SELECT u.id INTO v_id FROM public.usuarios AS u
 WHERE lower(u.usuario)=lower(trim(p_usuario))
   AND u.ativo=true
   AND u.senha_hash IS NOT NULL
   AND u.senha_provisoria IS NOT TRUE
   AND extensions.crypt(p_credencial,u.senha_hash)=u.senha_hash
 LIMIT 1;
 RETURN v_id;
END;
$body$;
REVOKE ALL ON FUNCTION private.pmobile_foto_credencial_id(text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.pmobile_foto_perfil_ler(p_usuario text,p_credencial text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_id bigint;
BEGIN
 v_id:=private.pmobile_foto_credencial_id(p_usuario,p_credencial);
 IF v_id IS NULL THEN RETURN NULL; END IF;
 RETURN (SELECT encode(f.foto_jpeg,'base64') FROM public.pmobile_fotos_perfil f WHERE f.usuario_id=v_id);
END;
$body$;

CREATE OR REPLACE FUNCTION public.pmobile_foto_perfil_salvar(
p_usuario text,p_credencial text,p_imagem_base64 text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_id bigint;v_imagem bytea;
BEGIN
 v_id:=private.pmobile_foto_credencial_id(p_usuario,p_credencial);
 IF v_id IS NULL THEN RETURN false; END IF;
 IF p_imagem_base64 IS NULL THEN
   DELETE FROM public.pmobile_fotos_perfil WHERE usuario_id=v_id;
   RETURN true;
 END IF;
 IF length(p_imagem_base64)>440000 THEN
   RAISE EXCEPTION 'Foto excede o limite' USING ERRCODE='22023';
 END IF;
 v_imagem:=decode(p_imagem_base64,'base64');
 IF octet_length(v_imagem) NOT BETWEEN 100 AND 327680
   OR substring(v_imagem FROM 1 FOR 3)<>decode('ffd8ff','hex') THEN
   RAISE EXCEPTION 'Foto JPEG invalida' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.pmobile_fotos_perfil(usuario_id,foto_jpeg,atualizada_em)
 VALUES(v_id,v_imagem,now())
 ON CONFLICT(usuario_id) DO UPDATE
 SET foto_jpeg=EXCLUDED.foto_jpeg,atualizada_em=EXCLUDED.atualizada_em;
 RETURN true;
END;
$body$;
REVOKE ALL ON FUNCTION public.pmobile_foto_perfil_ler(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pmobile_foto_perfil_salvar(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pmobile_foto_perfil_ler(text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pmobile_foto_perfil_salvar(text,text,text) TO anon,authenticated;
COMMIT;
