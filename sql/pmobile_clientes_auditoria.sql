-- PMobile / Clientes: decisões de conferência de nomes, sem alterar Rastreios.
-- Implantação ADITIVA. Executar no Supabase do PMobile ANTES de habilitar a gravação.
-- Não modifica importadores, fontes OneDrive, NFs ou identidades de entregas.
create table if not exists public.pmobile_clientes_decisoes (
  chave text primary key check (char_length(chave) between 3 and 600),
  cidade text not null check (char_length(btrim(cidade)) between 1 and 250),
  nome_a text not null check (char_length(btrim(nome_a)) between 1 and 250),
  nome_b text not null check (char_length(btrim(nome_b)) between 1 and 250),
  status text not null check (status in ('PENDENTE','MESMO','DIFERENTES')),
  alterado_por_id bigint not null references public.usuarios(id),
  alterado_por_nome text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_pmobile_clientes_decisoes_status
  on public.pmobile_clientes_decisoes(status,atualizado_em desc);
alter table public.pmobile_clientes_decisoes enable row level security;
revoke all on table public.pmobile_clientes_decisoes from public,anon,authenticated;

create or replace function public.pmobile_clientes_listar_decisoes(
 p_usuario text,p_credencial text
)
returns table(chave text,status text,atualizado_em timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.usuarios u
    where lower(u.usuario)=lower(btrim(p_usuario))
      and u.ativo=true and u.nivel='ADMIN'
      and u.senha_hash is not null
      and u.senha_hash=extensions.crypt(p_credencial,u.senha_hash)
  ) then
    raise exception 'Somente ADMIN pode consultar auditoria de clientes'
      using errcode='42501';
  end if;
  return query
    select d.chave,d.status,d.atualizado_em
    from public.pmobile_clientes_decisoes d
    order by d.atualizado_em desc limit 15000;
end;
$$;

create or replace function public.pmobile_clientes_salvar_decisao(
 p_usuario text,p_credencial text,p_chave text,p_cidade text,
 p_nome_a text,p_nome_b text,p_status text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_admin public.usuarios%rowtype;
begin
  select u.* into v_admin from public.usuarios u
    where lower(u.usuario)=lower(btrim(p_usuario))
      and u.ativo=true and u.nivel='ADMIN'
      and u.senha_hash is not null
      and u.senha_hash=extensions.crypt(p_credencial,u.senha_hash)
    limit 1;
  if not found then
    raise exception 'Somente ADMIN pode registrar decisão de cliente'
      using errcode='42501';
  end if;
  if p_status not in ('PENDENTE','MESMO','DIFERENTES') or p_status is null then
    raise exception 'Estado de decisão inválido' using errcode='22023';
  end if;
  if char_length(btrim(coalesce(p_chave,''))) not between 3 and 600
     or char_length(btrim(coalesce(p_cidade,''))) not between 1 and 250
     or char_length(btrim(coalesce(p_nome_a,''))) not between 1 and 250
     or char_length(btrim(coalesce(p_nome_b,''))) not between 1 and 250
     or btrim(p_nome_a)=btrim(p_nome_b) then
    raise exception 'Campos de decisão inválidos' using errcode='22023';
  end if;
  insert into public.pmobile_clientes_decisoes (
    chave,cidade,nome_a,nome_b,status,alterado_por_id,alterado_por_nome
  ) values (
    btrim(p_chave),btrim(p_cidade),btrim(p_nome_a),btrim(p_nome_b),
    p_status,v_admin.id,coalesce(v_admin.nome,v_admin.usuario)
  )
  on conflict (chave) do update set
    cidade=excluded.cidade,nome_a=excluded.nome_a,nome_b=excluded.nome_b,
    status=excluded.status,alterado_por_id=excluded.alterado_por_id,
    alterado_por_nome=excluded.alterado_por_nome,atualizado_em=now();
  return jsonb_build_object('chave',btrim(p_chave),'status',p_status,'salvo',true);
end;
$$;

revoke all on function public.pmobile_clientes_listar_decisoes(text,text) from public;
revoke all on function public.pmobile_clientes_salvar_decisao(text,text,text,text,text,text,text) from public;
grant execute on function public.pmobile_clientes_listar_decisoes(text,text) to anon,authenticated;
grant execute on function public.pmobile_clientes_salvar_decisao(text,text,text,text,text,text,text) to anon,authenticated;
