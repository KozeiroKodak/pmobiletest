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


create or replace function public.pmobile_finalizar_importacao_materiais(
  p_importacao_id uuid,
  p_usuario text,
  p_credencial text
)
returns bigint
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
declare
  v_total_staging bigint;
  v_total_inserido bigint;
  v_nivel text;
  v_versao timestamptz;
begin
  select nivel into v_nivel
  from public.usuarios
  where lower(usuario) = lower(trim(p_usuario))
    and ativo = true
    and senha_hash is not null
    and senha_hash = extensions.crypt(p_credencial, senha_hash)
  limit 1;

  if not found or v_nivel <> 'ADMIN' then
    raise exception 'Apenas ADMIN pode finalizar a importação.';
  end if;

  select count(*) into v_total_staging
  from public.materiais_importacao_temporaria
  where importacao_id = p_importacao_id;

  if v_total_staging = 0 then
    raise exception 'PMOBILE: nenhuma linha temporária encontrada para a importação %.', p_importacao_id;
  end if;

  delete from public.materiais;

  insert into public.materiais (
    codigo, descricao, referencia, marca, local,
    quantidade, quantidade_reservada, disponivel, ultima_entrada
  )
  select codigo, descricao, referencia, marca, local,
         quantidade, quantidade_reservada, disponivel, ultima_entrada
  from public.materiais_importacao_temporaria
  where importacao_id = p_importacao_id
  order by ordem;

  get diagnostics v_total_inserido = row_count;

  if v_total_inserido <> v_total_staging then
    raise exception
      'PMOBILE: quantidade inserida (%) diferente da quantidade preparada (%).',
      v_total_inserido, v_total_staging;
  end if;

  delete from public.materiais_importacao_temporaria
  where importacao_id = p_importacao_id;

  v_versao := clock_timestamp();

  insert into public.materiais_sync_meta (
    id, versao, total_materiais, importacao_id, atualizado_em
  )
  values (true, v_versao, v_total_inserido, p_importacao_id, v_versao)
  on conflict (id) do update
    set versao = excluded.versao,
        total_materiais = excluded.total_materiais,
        importacao_id = excluded.importacao_id,
        atualizado_em = excluded.atualizado_em;

  return v_total_inserido;
end;
$function$;

revoke all on function public.pmobile_finalizar_importacao_materiais(uuid,text,text)
  from public, anon, authenticated;

grant execute on function public.pmobile_finalizar_importacao_materiais(uuid,text,text)
  to anon, authenticated;
