-- Último acesso validado no painel administrativo de credenciais.
-- Reutiliza usuarios.ultimo_acesso_em gravado por autenticar_usuario.
-- Migração aditiva; mantém pmobile_admin_listar_credenciais (v1) inalterada.
create or replace function public.pmobile_admin_listar_credenciais_v2(
 p_admin_usuario text,p_admin_credencial text
)
returns table(
 id bigint,nome text,usuario text,nivel text,ativo boolean,
 senha_definida boolean,senha_provisoria boolean,token_pendente boolean,
 senha_criada_em timestamptz,token_criado_em timestamptz,ultimo_acesso_em timestamptz
)
language plpgsql security definer set search_path=''
as $listar$
begin
 if not exists (
  select 1 from public.usuarios a
  where lower(a.usuario)=lower(btrim(p_admin_usuario)) and a.ativo is true
    and a.nivel='ADMIN' and a.senha_hash is not null
    and extensions.crypt(p_admin_credencial,a.senha_hash)=a.senha_hash
 ) then
  raise exception 'Acesso administrativo negado.' using errcode='42501';
 end if;
 return query
 select u.id,u.nome,u.usuario,u.nivel,u.ativo,
  (u.senha_hash is not null),u.senha_provisoria,(u.token_hash is not null),
  u.senha_criada_em,u.token_criado_em,u.ultimo_acesso_em
 from public.usuarios u
 order by lower(u.nome),lower(u.usuario),u.id;
end $listar$;
revoke all on function public.pmobile_admin_listar_credenciais_v2(text,text) from public,anon,authenticated;
grant execute on function public.pmobile_admin_listar_credenciais_v2(text,text) to anon,authenticated;
