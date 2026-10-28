-- PMobile: linha_origem é posição, jamais identidade.
-- Substitui pré-validação por matching NF+cliente+transportadora, conservador em duplicidades protegidas.
create or replace function public.pmobile_rastreio_preflight_sincronizacao(
 p_usuario text,p_credencial text,p_chave text,p_linhas jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_admin bigint;v_fonte uuid;v_old integer;v_new integer;v_removed integer;
begin
 select usuario_id into v_admin from public.pmobile_rastreio_admin_validar(p_usuario,p_credencial);
 if v_admin is null then raise exception 'Somente administradores podem sincronizar rastreios.' using errcode='42501';end if;
 if jsonb_typeof(p_linhas)<>'array' or jsonb_array_length(p_linhas)=0 then
  raise exception 'Planilha vazia ou invalida. Base anterior preservada.' using errcode='22023';end if;

 drop table if exists pg_temp.tmp_pm_check_new;
 drop table if exists pg_temp.tmp_pm_check_old;
 create temporary table tmp_pm_check_new on commit drop as
 select (x->>'linha_origem')::integer as linha,
        upper(btrim(coalesce(x->>'notas_fiscais',''))) as nf,
        upper(btrim(coalesce(x->>'cliente',''))) as cliente,
        regexp_replace(upper(btrim(coalesce(x->>'transportadora',''))),'[[:space:]]+',' ','g') as transp
 from jsonb_array_elements(p_linhas) x;
 if exists(select 1 from pg_temp.tmp_pm_check_new
           where linha is null or linha<1 or nf='' or cliente='' or transp='') then
  raise exception 'Planilha contem identificadores ou linhas invalidos; base preservada.' using errcode='22023';end if;
 if exists(select 1 from pg_temp.tmp_pm_check_new group by linha having count(*)>1) then
  raise exception 'Linhas repetidas na planilha; base preservada.' using errcode='22023';end if;

 select id into v_fonte from public.rastreio_fontes where chave=btrim(p_chave) and ativo;
 if v_fonte is null then
   if exists(select 1 from public.rastreios) then
     raise exception 'Fonte OneDrive nao reconhecida; rastreios existentes preservados.' using errcode='23505';end if;
   return jsonb_build_object('permitido',true,'anteriores',0,'novas_linhas',jsonb_array_length(p_linhas));
 end if;

 create temporary table tmp_pm_check_old on commit drop as
 select r.id,r.linha_origem as linha,
   upper(btrim(coalesce(r.notas_fiscais,''))) as nf,
   upper(btrim(coalesce(r.cliente,''))) as cliente,
   regexp_replace(upper(btrim(coalesce(r.transportadora,''))),'[[:space:]]+',' ','g') as transp,
   (r.status<>'PENDENTE' or r.conferencia<>'PENDENTE'
     or nullif(btrim(coalesce(r.motorista,'')),'') is not null
     or exists(select 1 from public.rmexpress_entregas e where e.rastreio_id=r.id)
     or exists(select 1 from public.rastreio_historico h where h.rastreio_id=r.id)
     or exists(select 1 from private.pmentregas_historico_notas h where h.rastreio_id=r.id)
     or exists(select 1 from private.pmentregas_auditoria_atribuicoes a where a.rastreio_id=r.id)
     or exists(select 1 from private.pmentregas_destinos d where d.rastreio_id=r.id)
   ) as protegido
 from public.rastreios r where r.fonte_id=v_fonte;

 select count(*) into v_old from pg_temp.tmp_pm_check_old;
 select count(*) into v_new from pg_temp.tmp_pm_check_new;

 -- Movimento de nota protegida é permitido se houver UMA correspondência inequívoca.
 -- Se NF+cliente+transportadora mudou ou ficou duplicada, não decidir por posição.
 if exists(
   select 1 from pg_temp.tmp_pm_check_old o
   left join (
    select nf,cliente,transp,count(*) as n from pg_temp.tmp_pm_check_new group by 1,2,3
   ) n on (o.nf,o.cliente,o.transp)=(n.nf,n.cliente,n.transp)
   left join (
    select nf,cliente,transp,count(*) as n from pg_temp.tmp_pm_check_old group by 1,2,3
   ) p on (o.nf,o.cliente,o.transp)=(p.nf,p.cliente,p.transp)
   where o.protegido and (coalesce(n.n,0)<>1 or coalesce(p.n,0)<>1)
 ) then
  raise exception 'NF movimentada sem correspondencia unica na planilha (removida, alterada ou duplicada). Base preservada.'
   using errcode='23505';
 end if;

 -- Comparar quantidade de identidades, não a linha: inserções no alto não são exclusões.
 with anteriores as (
  select nf,cliente,transp,count(*) n from pg_temp.tmp_pm_check_old group by 1,2,3
 ), atuais as(
  select nf,cliente,transp,count(*) n from pg_temp.tmp_pm_check_new group by 1,2,3
 )
 select coalesce(sum(greatest(a.n-coalesce(b.n,0),0)),0)::integer into v_removed
 from anteriores a left join atuais b using(nf,cliente,transp);
 if v_old>=100 and v_removed>greatest(25,ceil(v_old*0.03)::integer) then
  raise exception 'A planilha retirou % de % registros por identidade. Alteracao grande bloqueada.',v_removed,v_old using errcode='23505';
 end if;
 return jsonb_build_object('permitido',true,'anteriores',v_old,'novas_linhas',v_new,'removidos',v_removed,
   'modo','identidade_unica_e_posicao_variavel');
end;
$$;

-- Endpoint legado passa a usar reconciliação por identidade; jamais sobrescrever NFs
-- movimentadas só porque outra NF ocupou a mesma linha.
create or replace function public.pmobile_rastreio_sincronizar_fonte(
 p_usuario text,p_credencial text,p_chave text,p_url text,p_arquivo_nome text,
 p_sha256 text,p_linhas jsonb,p_substituir boolean default false
) returns table(novas integer,alteradas integer,removidas integer,total integer,sha256 text)
language plpgsql security definer set search_path=''
as $$
declare v_admin bigint;v_nome text;v_fonte public.rastreio_fontes%rowtype;
 v_novas integer:=0;v_alteradas integer:=0;v_removidas integer:=0;v_total integer:=0;
begin
 select usuario_id,nome into v_admin,v_nome from public.pmobile_rastreio_admin_validar(p_usuario,p_credencial);
 if v_admin is null then raise exception 'Acesso restrito a administradores.' using errcode='42501';end if;
 if p_substituir then raise exception 'Substituicao destrutiva deve usar o fluxo administrativo separado.' using errcode='42501';end if;
 if btrim(coalesce(p_chave,''))='' or btrim(coalesce(p_url,''))='' then raise exception 'Fonte invalida.' using errcode='22023';end if;
 perform public.pmobile_rastreio_preflight_sincronizacao(p_usuario,p_credencial,p_chave,p_linhas);

 select * into v_fonte from public.rastreio_fontes where chave=btrim(p_chave) for update;
 if v_fonte.id is null then
   if exists(select 1 from public.rastreios) then
     raise exception 'Fonte desconhecida, dados anteriores preservados.' using errcode='23505';end if;
   insert into public.rastreio_fontes(chave,url,arquivo_nome,sha256,criado_por_id,criado_por_nome)
   values(btrim(p_chave),btrim(p_url),nullif(btrim(p_arquivo_nome),''),nullif(btrim(p_sha256),''),v_admin,v_nome)
   returning * into v_fonte;
 end if;

 drop table if exists pg_temp.tmp_pm_sync_new;
 drop table if exists pg_temp.tmp_pm_sync_old;
 drop table if exists pg_temp.tmp_pm_sync_map;

 create temporary table tmp_pm_sync_new on commit drop as
 select nullif(btrim(x->>'cliente'),'') cliente,
  nullif(x->>'notas_fiscais','') notas_fiscais,
  nullif(btrim(x->>'transportadora'),'') transportadora,
  nullif(btrim(x->>'motorista'),'') motorista,
  nullif(btrim(x->>'regiao'),'') regiao,
  nullif(x->>'volume','')::numeric volume,
  nullif(x->>'peso','')::numeric peso,
  nullif(x->>'valor_nf','')::numeric(14,2) valor_nf,
  nullif(x->>'valor_frete_embutido','')::numeric(14,2) valor_frete_embutido,
  nullif(x->>'valor_frete','')::numeric(14,2) valor_frete,
  nullif(x->>'custo_nunes','')::numeric(14,2) custo_nunes,
  nullif(x->>'custo_final','')::numeric(14,2) custo_final,
  nullif(x->>'data_envio','')::date data_envio,
  upper(nullif(btrim(x->>'turno'),'')) turno,
  nullif(x->>'previsao_entrega','')::timestamptz previsao_entrega,
  (x->>'linha_origem')::integer linha_origem,
  upper(btrim(coalesce(x->>'notas_fiscais',''))) nfkey,
  upper(btrim(coalesce(x->>'cliente',''))) clientkey,
  regexp_replace(upper(btrim(coalesce(x->>'transportadora',''))),'[[:space:]]+',' ','g') transkey
 from jsonb_array_elements(p_linhas) x;
 if exists(select 1 from pg_temp.tmp_pm_sync_new where turno is not null and turno not in ('MANHA','TARDE')) then
  raise exception 'Turno invalido na planilha.' using errcode='22023';end if;
 create unique index on pg_temp.tmp_pm_sync_new(linha_origem);
 analyze pg_temp.tmp_pm_sync_new;

 create temporary table tmp_pm_sync_old on commit drop as
 select r.id,r.linha_origem as old_linha,
  upper(btrim(coalesce(r.notas_fiscais,''))) nfkey,
  upper(btrim(coalesce(r.cliente,''))) clientkey,
  regexp_replace(upper(btrim(coalesce(r.transportadora,''))),'[[:space:]]+',' ','g') transkey,
  (r.status<>'PENDENTE' or r.conferencia<>'PENDENTE'
   or nullif(btrim(coalesce(r.motorista,'')),'') is not null
   or exists(select 1 from public.rmexpress_entregas e where e.rastreio_id=r.id)
   or exists(select 1 from public.rastreio_historico h where h.rastreio_id=r.id)
   or exists(select 1 from private.pmentregas_historico_notas h where h.rastreio_id=r.id)
   or exists(select 1 from private.pmentregas_auditoria_atribuicoes a where a.rastreio_id=r.id)
   or exists(select 1 from private.pmentregas_destinos d where d.rastreio_id=r.id)
  ) protegido
 from public.rastreios r where r.fonte_id=v_fonte.id;

 -- Pareamento por identidade. Duplicatas não protegidas e com mesma quantidade
 -- conservam a ordem de ocorrência relativa, mesmo se novas linhas deslocarem tudo.
 -- Duplicatas protegidas são bloqueadas no preflight por falta de ID inequívoco.
 create temporary table tmp_pm_sync_map on commit drop as
 with old_rank as(
  select o.*,count(*) over(partition by nfkey,clientkey,transkey) oc,
   row_number() over(partition by nfkey,clientkey,transkey order by old_linha,id) ocorrencia
  from pg_temp.tmp_pm_sync_old o
 ), new_rank as(
  select n.*,count(*) over(partition by nfkey,clientkey,transkey) nc,
   row_number() over(partition by nfkey,clientkey,transkey order by linha_origem) ocorrencia
  from pg_temp.tmp_pm_sync_new n
 )
 select o.id,n.linha_origem as nova_linha,o.protegido
 from old_rank o join new_rank n
   on (o.nfkey,o.clientkey,o.transkey)=(n.nfkey,n.clientkey,n.transkey)
   and o.oc=n.nc and o.ocorrencia=n.ocorrencia;
 create unique index on pg_temp.tmp_pm_sync_map(id);
 create unique index on pg_temp.tmp_pm_sync_map(nova_linha);

 if exists(select 1 from pg_temp.tmp_pm_sync_old o
    where o.protegido and not exists(select 1 from pg_temp.tmp_pm_sync_map m where m.id=o.id)) then
  raise exception 'Registro movimentado nao foi identificado com seguranca; nada foi alterado.' using errcode='23505';
 end if;

 -- Libera as posições antigas ANTES de usar as novas, respeitando a chave única da linha.
 update public.rastreios r set linha_origem=null
 from pg_temp.tmp_pm_sync_map m where r.id=m.id;

 -- Excluir somente registros antigos sem movimentação e sem identidade reconhecida.
 delete from public.rastreios r
 where r.fonte_id=v_fonte.id
   and not exists(select 1 from pg_temp.tmp_pm_sync_map m where m.id=r.id)
   and exists(select 1 from pg_temp.tmp_pm_sync_old o where o.id=r.id and not o.protegido);
 get diagnostics v_removidas=row_count;

 -- Preservar UUID e situação operacional; para registros protegidos, somente
 -- a posição muda. Valores históricos não podem ser substituídos por Excel.
 update public.rastreios r set
  linha_origem=n.linha_origem,
  cliente=case when m.protegido then r.cliente else n.cliente end,
  notas_fiscais=case when m.protegido then r.notas_fiscais else n.notas_fiscais end,
  transportadora=case when m.protegido then r.transportadora else n.transportadora end,
  motorista=case when m.protegido then r.motorista
    when regexp_replace(upper(coalesce(n.transportadora,'')),'[^A-Z0-9]','','g')='RMEXPRESS'
      and r.motorista is not null then r.motorista else n.motorista end,
  regiao=case when m.protegido then r.regiao else n.regiao end,
  volume=case when m.protegido then r.volume else n.volume end,
  peso=case when m.protegido then r.peso else n.peso end,
  valor_nf=case when m.protegido then r.valor_nf else n.valor_nf end,
  valor_frete_embutido=case when m.protegido then r.valor_frete_embutido else n.valor_frete_embutido end,
  valor_frete=case when m.protegido then r.valor_frete else n.valor_frete end,
  custo_nunes=case when m.protegido then r.custo_nunes else n.custo_nunes end,
  custo_final=case when m.protegido then r.custo_final else n.custo_final end,
  data_envio=case when m.protegido then r.data_envio else n.data_envio end,
  turno=case when m.protegido then r.turno else n.turno end,
  previsao_entrega=case when m.protegido then r.previsao_entrega else n.previsao_entrega end,
  atualizado_em=now()
 from pg_temp.tmp_pm_sync_map m join pg_temp.tmp_pm_sync_new n on n.linha_origem=m.nova_linha
 where r.id=m.id;

 select count(*)::integer into v_alteradas from pg_temp.tmp_pm_sync_map;

 -- Inserir apenas linhas novas ou duplicidades não pareadas (desprotegidas).
 insert into public.rastreios(cliente,notas_fiscais,transportadora,motorista,regiao,volume,peso,
  valor_nf,valor_frete_embutido,valor_frete,custo_nunes,custo_final,data_envio,turno,
  previsao_entrega,status,conferencia,criado_por_id,criado_por_nome,importacao_id,fonte_id,
  linha_origem,atualizado_em)
 select n.cliente,n.notas_fiscais,n.transportadora,n.motorista,n.regiao,n.volume,n.peso,
  n.valor_nf,n.valor_frete_embutido,n.valor_frete,n.custo_nunes,n.custo_final,n.data_envio,
  n.turno,n.previsao_entrega,'PENDENTE','PENDENTE',v_admin,v_nome,null,v_fonte.id,
  n.linha_origem,now()
 from pg_temp.tmp_pm_sync_new n
 where not exists(select 1 from pg_temp.tmp_pm_sync_map m where m.nova_linha=n.linha_origem);
 get diagnostics v_novas=row_count;

 select count(*)::integer into v_total from pg_temp.tmp_pm_sync_new;
 if (select count(*) from public.rastreios where fonte_id=v_fonte.id)<>v_total then
  raise exception 'Inconsistencia da reconciliação: transação cancelada.' using errcode='23505';end if;

 update public.rastreio_fontes set
  url=btrim(p_url),arquivo_nome=nullif(btrim(p_arquivo_nome),''),
  sha256=nullif(btrim(p_sha256),''),total_linhas=v_total,ativo=true,atualizado_em=now()
 where id=v_fonte.id;

 novas:=v_novas;alteradas:=v_alteradas;removidas:=v_removidas;total:=v_total;
 sha256:=nullif(btrim(p_sha256),'');return next;
end;
$$;
