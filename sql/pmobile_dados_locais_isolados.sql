-- PMobile / Dados locais — estrutura aditiva e isolada
-- Não modifica public.materiais, importações oficiais ou telas existentes.
create table if not exists public.pmobile_local_materiais (
  codigo text primary key check (btrim(codigo) <> ''),
  descricao text not null check (btrim(descricao) <> ''),
  referencia text,
  marca text,
  quantidade_item numeric check (quantidade_item is null or quantidade_item >= 0),
  quantidade_total numeric check (quantidade_total is null or quantidade_total >= 0),
  quantidade_reservada numeric check (quantidade_reservada is null or quantidade_reservada >= 0),
  local text,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.pmobile_local_conferencias (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references public.pmobile_local_materiais(codigo) on delete restrict,
  quantidade_fisica numeric not null check (quantidade_fisica >= 0),
  local_encontrado text,
  usuario_nome text not null,
  criado_em timestamptz not null default now()
);
create index if not exists pmobile_local_conf_codigo_data_idx
  on public.pmobile_local_conferencias(codigo, criado_em desc);
alter table public.pmobile_local_materiais enable row level security;
alter table public.pmobile_local_conferencias enable row level security;
revoke all on public.pmobile_local_materiais from anon, authenticated;
revoke all on public.pmobile_local_conferencias from anon, authenticated;

-- A autorização usa a sessão já existente no PMobile; nenhuma política administrativa
-- nova foi criada. Alterações administrativas finas serão definidas posteriormente.
create or replace function private.pmobile_local_autorizar(p_usuario text, p_credencial text)
returns boolean language sql security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.usuarios u
    where lower(u.usuario) = lower(btrim(p_usuario))
      and u.ativo = true
      and u.senha_hash is not null
      and extensions.crypt(p_credencial, u.senha_hash) = u.senha_hash
  );
$$;
revoke all on function private.pmobile_local_autorizar(text,text) from public, anon, authenticated;

create or replace function public.pmobile_local_importar_catalogo(
  p_usuario text, p_credencial text, p_materiais jsonb
)
returns integer language plpgsql security definer
set search_path = ''
as $$
declare v_total integer;
begin
  if not private.pmobile_local_autorizar(p_usuario,p_credencial) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  if p_materiais is null or jsonb_typeof(p_materiais) <> 'array'
     or jsonb_array_length(p_materiais) > 1000 then
    raise exception 'Lote inválido (máximo de 1000 materiais)';
  end if;
  insert into public.pmobile_local_materiais(codigo,descricao,referencia,marca)
  select codigo,descricao,referencia,marca
  from (
    select distinct on (codigo) codigo,descricao,referencia,marca
    from (
      select nullif(btrim(item->>'codigo'),'') as codigo,
             nullif(btrim(item->>'descricao'),'') as descricao,
             nullif(btrim(item->>'referencia'),'') as referencia,
             nullif(btrim(item->>'marca'),'') as marca
      from jsonb_array_elements(p_materiais) as item
      where jsonb_typeof(item)='object'
    ) dados
    where codigo is not null and descricao is not null
    order by codigo
  ) validos
  on conflict (codigo) do update set
    descricao=excluded.descricao,
    referencia=excluded.referencia,
    marca=excluded.marca
  where (public.pmobile_local_materiais.descricao,
         public.pmobile_local_materiais.referencia,
         public.pmobile_local_materiais.marca)
        is distinct from (excluded.descricao,excluded.referencia,excluded.marca);
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

create or replace function public.pmobile_local_listar(
  p_usuario text, p_credencial text, p_termo text default '',
  p_tipo text default 'codigo', p_limite integer default 50, p_offset integer default 0,
  p_somente_reservas boolean default false
)
returns table(codigo text,descricao text,referencia text,marca text,
              quantidade_item numeric,quantidade_total numeric,
              quantidade_reservada numeric,local text,atualizado_em timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.pmobile_local_autorizar(p_usuario,p_credencial) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  if p_tipo not in ('codigo','referencia','descricao','todos') then
    raise exception 'Campo de pesquisa inválido';
  end if;
  return query
  select m.codigo,m.descricao,m.referencia,m.marca,
         m.quantidade_item,m.quantidade_total,m.quantidade_reservada,
         m.local,m.atualizado_em
  from public.pmobile_local_materiais m
  where (coalesce(btrim(p_termo),'') = ''
    or (p_tipo in ('codigo','todos') and m.codigo ilike '%'||btrim(p_termo)||'%')
    or (p_tipo in ('referencia','todos') and m.referencia ilike '%'||btrim(p_termo)||'%')
    or (p_tipo in ('descricao','todos') and m.descricao ilike '%'||btrim(p_termo)||'%'))
  and (not coalesce(p_somente_reservas,false) or coalesce(m.quantidade_reservada,0)>0)
  order by m.codigo
  limit least(greatest(coalesce(p_limite,50),1),100)
  offset greatest(coalesce(p_offset,0),0);
end;
$$;

create or replace function public.pmobile_local_salvar_estoque(
  p_usuario text, p_credencial text, p_codigo text,
  p_quantidade_item numeric, p_quantidade_total numeric,
  p_quantidade_reservada numeric, p_local text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not private.pmobile_local_autorizar(p_usuario,p_credencial) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  if p_quantidade_item < 0 or p_quantidade_total < 0 or p_quantidade_reservada < 0 then
    raise exception 'Quantidades não podem ser negativas';
  end if;
  update public.pmobile_local_materiais m
  set quantidade_item=p_quantidade_item,
      quantidade_total=p_quantidade_total,
      quantidade_reservada=p_quantidade_reservada,
      local=nullif(btrim(p_local),''),
      atualizado_em=clock_timestamp()
  where m.codigo=btrim(p_codigo);
  if not found then raise exception 'Material local não encontrado'; end if;
  return true;
end;
$$;

create or replace function public.pmobile_local_registrar_conferencia(
  p_usuario text,p_credencial text,p_codigo text,
  p_quantidade_fisica numeric,p_local_encontrado text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_nome text;
begin
  if not private.pmobile_local_autorizar(p_usuario,p_credencial) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  if p_quantidade_fisica is null or p_quantidade_fisica < 0 then
    raise exception 'Quantidade física inválida';
  end if;
  select coalesce(nome,usuario) into v_nome from public.usuarios
  where lower(usuario)=lower(btrim(p_usuario)) and ativo=true limit 1;
  insert into public.pmobile_local_conferencias(codigo,quantidade_fisica,local_encontrado,usuario_nome)
  values(btrim(p_codigo),p_quantidade_fisica,nullif(btrim(p_local_encontrado),''),v_nome)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.pmobile_local_listar_conferencias(
  p_usuario text,p_credencial text,p_limite integer default 50
)
returns table(id uuid,codigo text,descricao text,quantidade_fisica numeric,
              local_encontrado text,usuario_nome text,criado_em timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.pmobile_local_autorizar(p_usuario,p_credencial) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  return query select c.id,c.codigo,m.descricao,c.quantidade_fisica,
    c.local_encontrado,c.usuario_nome,c.criado_em
  from public.pmobile_local_conferencias c
  join public.pmobile_local_materiais m on m.codigo=c.codigo
  order by c.criado_em desc limit least(greatest(coalesce(p_limite,50),1),100);
end;
$$;

-- Comparação calculada sob demanda: não grava nem altera a Dogo.
-- Resultado independente para Divergências locais e Locais locais.
create or replace function public.pmobile_local_comparar(
  p_usuario text,p_credencial text,p_termo text default '',
  p_limite integer default 100,p_offset integer default 0,
  p_modo text default 'todos'
)
returns table(codigo text,descricao text,dogo_quantidade numeric,local_quantidade numeric,
  dogo_reservada numeric,local_reservada numeric,dogo_local text,local_local text,
  diferenca_quantidade boolean,diferenca_reserva boolean,diferenca_local boolean,
  sem_dogo boolean,pendente_quantidade boolean,pendente_reserva boolean,pendente_local boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.pmobile_local_autorizar(p_usuario,p_credencial) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  return query
  select l.codigo,l.descricao,d.quantidade,l.quantidade_total,
    d.quantidade_reservada,l.quantidade_reservada,d.local,l.local,
    (d.id is not null and l.quantidade_total is not null and
      l.quantidade_total is distinct from d.quantidade),
    (d.id is not null and l.quantidade_reservada is not null and
      l.quantidade_reservada is distinct from d.quantidade_reservada),
    (d.id is not null and nullif(btrim(l.local),'') is not null and
      upper(btrim(l.local)) is distinct from upper(btrim(d.local))),
    (d.id is null),
    (l.quantidade_total is null),
    (l.quantidade_reservada is null),
    (nullif(btrim(l.local),'') is null)
  from public.pmobile_local_materiais l
  left join public.materiais d on d.codigo=l.codigo
  where (coalesce(btrim(p_termo),'')='' or l.codigo ilike '%'||btrim(p_termo)||'%'
     or l.descricao ilike '%'||btrim(p_termo)||'%')
  and (
    p_modo='todos'
    or (p_modo='divergencias' and (d.id is null
      or (l.quantidade_total is not null and l.quantidade_total is distinct from d.quantidade)
      or (l.quantidade_reservada is not null and l.quantidade_reservada is distinct from d.quantidade_reservada)))
    or (p_modo='locais' and l.local is not null and btrim(l.local)<>''
      and upper(btrim(l.local)) is distinct from upper(btrim(d.local)))
  )
  order by l.codigo
  limit least(greatest(coalesce(p_limite,100),1),100)
  offset greatest(coalesce(p_offset,0),0);
end;
$$;

revoke all on function public.pmobile_local_importar_catalogo(text,text,jsonb) from public,authenticated;
revoke all on function public.pmobile_local_listar(text,text,text,text,integer,integer,boolean) from public,authenticated;
revoke all on function public.pmobile_local_salvar_estoque(text,text,text,numeric,numeric,numeric,text) from public,authenticated;
revoke all on function public.pmobile_local_registrar_conferencia(text,text,text,numeric,text) from public,authenticated;
revoke all on function public.pmobile_local_listar_conferencias(text,text,integer) from public,authenticated;
revoke all on function public.pmobile_local_comparar(text,text,text,integer,integer,text) from public,authenticated;
grant execute on function public.pmobile_local_importar_catalogo(text,text,jsonb) to anon;
grant execute on function public.pmobile_local_listar(text,text,text,text,integer,integer,boolean) to anon;
grant execute on function public.pmobile_local_salvar_estoque(text,text,text,numeric,numeric,numeric,text) to anon;
grant execute on function public.pmobile_local_registrar_conferencia(text,text,text,numeric,text) to anon;
grant execute on function public.pmobile_local_listar_conferencias(text,text,integer) to anon;
grant execute on function public.pmobile_local_comparar(text,text,text,integer,integer,text) to anon;
