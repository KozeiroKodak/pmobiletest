-- BugHunter: corrigir SQLSTATE 42702 (column reference "id" is ambiguous)
-- Função já usa RETURNS TABLE(id uuid, ...); por isso a coluna booleana
-- de materiais_sync_meta precisa de alias explícito no UPDATE.
-- Preserva validação ADMIN, atualização de material, status e histórico.
-- Não executa qualquer confirmação por conta própria.
CREATE OR REPLACE FUNCTION public.confirmar_alteracao_local(p_admin_usuario text, p_admin_credencial text, p_contagem_id uuid)
 RETURNS TABLE(id uuid, alteracao_status text, alteracao_confirmada_por_id bigint, alteracao_confirmada_por_nome text, alteracao_confirmada_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_admin public.usuarios%rowtype; v_contagem public.contagens_manuais%rowtype;
begin
 select u.* into v_admin from public.usuarios u
 where lower(u.usuario)=lower(trim(p_admin_usuario)) and u.ativo=true and u.nivel='ADMIN'
 and u.senha_hash is not null and extensions.crypt(p_admin_credencial,u.senha_hash)=u.senha_hash limit 1;
 if not found then raise exception 'Acesso administrativo negado'; end if;
 select c.* into v_contagem from public.contagens_manuais c
 where c.id=p_contagem_id and c.local_alterado=true limit 1;
 if not found then raise exception 'Alteração de local não encontrada'; end if;
 if v_contagem.material_id is null then raise exception 'Material da contagem não identificado'; end if;
 update public.materiais m set local=v_contagem.local_encontrado where m.id=v_contagem.material_id;
 if not found then raise exception 'Material não encontrado no estoque'; end if;
 -- O cliente offline se baseia na versao em materiais_sync_meta.
 -- Mudancas confirmadas pelo ERP devem invalidar a copia local.
 update public.materiais_sync_meta as meta
 set versao=clock_timestamp(),atualizado_em=clock_timestamp()
 where meta.id=true;
 if not found then raise exception 'Metadados de sincronizacao do inventario ausentes'; end if;
 update public.contagens_manuais c set alteracao_status='CONFIRMADO',
 alteracao_confirmada_por_id=v_admin.id, alteracao_confirmada_por_nome=coalesce(v_admin.nome,v_admin.usuario),
 alteracao_confirmada_em=clock_timestamp() where c.id=v_contagem.id;
 return query select c.id,c.alteracao_status,c.alteracao_confirmada_por_id,c.alteracao_confirmada_por_nome,c.alteracao_confirmada_em
 from public.contagens_manuais c where c.id=v_contagem.id;
end; $function$
;
