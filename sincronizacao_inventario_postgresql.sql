-- PMOBILE — sincronização versionada do inventário
-- Aplicada ao projeto Supabase em 21/10/2026.
--
-- Objetivo:
--   1. permitir que o dispositivo descubra se o inventário mudou
--      sem baixar 93 mil+ materiais;
--   2. transferir o inventário por RPC em paginação por ID;
--   3. manter a autenticação PMOBILE no PostgreSQL.

create table if not exists public.materiais_sync_meta (
  id boolean primary key default true check (id = true),
  versao timestamptz not null default now(),
  total_materiais bigint not null default 0,
  importacao_id uuid,
  atualizado_em timestamptz not null default now()
);

alter table public.materiais_sync_meta enable row level security;
revoke all on table public.materiais_sync_meta from anon, authenticated;

insert into public.materiais_sync_meta (id, versao, total_materiais)
values (true, now(), (select count(*) from public.materiais))
on conflict (id) do nothing;

create or replace function public.pmobile_materiais_obter_versao(
  p_usuario text,
  p_credencial text
)
returns table (versao timestamptz, total_materiais bigint)
language plpgsql
security definer
set search_path = ''
as $function$
declare v_usuario_id bigint;
begin
  select usuario_id into v_usuario_id
  from private.pmobile_validar_usuario(p_usuario, p_credencial)
  limit 1;

  if v_usuario_id is null then
    raise exception 'Credenciais inválidas.';
  end if;

  return query
  select m.versao, m.total_materiais
  from public.materiais_sync_meta m
  where m.id = true;
end;
$function$;

create or replace function public.pmobile_materiais_listar_pagina(
  p_usuario text,
  p_credencial text,
  p_ultimo_id bigint default 0,
  p_limite integer default 1000
)
returns table (
  id bigint,
  codigo text,
  descricao text,
  referencia text,
  marca text,
  local text,
  quantidade numeric,
  quantidade_reservada numeric,
  disponivel numeric,
  ultima_entrada text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_usuario_id bigint;
  v_limite integer;
begin
  select usuario_id into v_usuario_id
  from private.pmobile_validar_usuario(p_usuario, p_credencial)
  limit 1;

  if v_usuario_id is null then
    raise exception 'Credenciais inválidas.';
  end if;

  v_limite := greatest(1, least(coalesce(p_limite, 1000), 2000));

  return query
  select m.id, m.codigo, m.descricao, m.referencia, m.marca,
         m.local, m.quantidade, m.quantidade_reservada,
         m.disponivel, m.ultima_entrada
  from public.materiais m
  where m.id > greatest(coalesce(p_ultimo_id, 0), 0)
  order by m.id asc
  limit v_limite;
end;
$function$;

revoke all on function public.pmobile_materiais_obter_versao(text,text) from public, anon, authenticated;
grant execute on function public.pmobile_materiais_obter_versao(text,text) to anon, authenticated;

revoke all on function public.pmobile_materiais_listar_pagina(text,text,bigint,integer) from public, anon, authenticated;
grant execute on function public.pmobile_materiais_listar_pagina(text,text,bigint,integer) to anon, authenticated;

-- A finalização da importação do inventário atualiza a versão central
-- na mesma transação que substitui public.materiais.
