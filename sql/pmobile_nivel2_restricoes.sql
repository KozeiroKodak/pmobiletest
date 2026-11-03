-- PMobile: Dados Locais é exclusivo do nível ADMIN.
-- Mantém Pesquisa, Contagem manual, Transportes e Reservas disponíveis ao NIVEL2
-- por seus próprios mecanismos existentes, sem alterar dados dos usuários.
CREATE OR REPLACE FUNCTION private.pmobile_local_autorizar(p_usuario text, p_credencial text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios AS u
        WHERE lower(u.usuario) = lower(btrim(p_usuario))
          AND u.ativo = true
          AND u.nivel = 'ADMIN'
          AND u.senha_hash IS NOT NULL
          AND extensions.crypt(p_credencial, u.senha_hash) = u.senha_hash
    );
$function$;
