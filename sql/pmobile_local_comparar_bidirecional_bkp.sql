-- PMobile BKP — comparação bidirecional entre Dogo e Contagem local.
-- Somente a definição da consulta é alterada. Nenhuma tabela ou registro é modificado.
-- Mesma assinatura, mesmas colunas, mesma validação de credenciais, mesmos grants.
-- Em particular, NÃO alterar a criação inicial de senha.
create or replace function public.pmobile_local_comparar(
  p_usuario text,
  p_credencial text,
  p_termo text default '',
  p_limite integer default 100,
  p_offset integer default 0,
  p_modo text default 'todos'
)
returns table (
  codigo text,
  descricao text,
  dogo_quantidade numeric,
  local_quantidade numeric,
  dogo_reservada numeric,
  local_reservada numeric,
  dogo_local text,
  local_local text,
  diferenca_quantidade boolean,
  diferenca_reserva boolean,
  diferenca_local boolean,
  sem_dogo boolean,
  pendente_quantidade boolean,
  pendente_reserva boolean,
  pendente_local boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.pmobile_local_autorizar(p_usuario,p_credencial) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;

  return query
  select
    coalesce(l.codigo,d.codigo),
    coalesce(l.descricao,d.descricao),
    d.quantidade,l.quantidade_total,
    d.quantidade_reservada,l.quantidade_reservada,
    d.local,l.local,
    (d.id is not null and l.quantidade_total is not null
      and l.quantidade_total is distinct from d.quantidade),
    (d.id is not null and l.quantidade_reservada is not null
      and l.quantidade_reservada is distinct from d.quantidade_reservada),
    (d.id is not null and nullif(btrim(l.local),'') is not null
      and upper(btrim(l.local)) is distinct from upper(btrim(d.local))),
    (d.id is null),
    (l.quantidade_total is null),
    (l.quantidade_reservada is null),
    (nullif(btrim(l.local),'') is null)
  from public.pmobile_local_materiais l
  full outer join public.materiais d on d.codigo=l.codigo
  where (
    coalesce(btrim(p_termo),'')=''
    or coalesce(l.codigo,d.codigo) ilike '%'||btrim(p_termo)||'%'
    or coalesce(l.descricao,d.descricao) ilike '%'||btrim(p_termo)||'%'
  )
  and (
    p_modo='todos'
    or (p_modo='divergencias' and (
      l.codigo is null or d.id is null
      or (l.quantidade_total is not null
          and l.quantidade_total is distinct from d.quantidade)
      or (l.quantidade_reservada is not null
          and l.quantidade_reservada is distinct from d.quantidade_reservada)
    ))
    or (p_modo='locais' and l.local is not null and btrim(l.local)<>''
        and upper(btrim(l.local)) is distinct from upper(btrim(d.local)))
  )
  order by coalesce(l.codigo,d.codigo)
  limit least(greatest(coalesce(p_limite,100),1),100)
  offset greatest(coalesce(p_offset,0),0);
end;
$function$;
