-- PMobile / Contagem manual: editar o registro existente sem criar outra contagem.
-- Autoriza ADMIN ou o responsável original (NIVEL2), usando a credencial do PMobile.
-- Contagens já confirmadas no ERP não podem ser alteradas.
create or replace function public.pmobile_contagem_manual_atualizar(
    p_usuario text,
    p_credencial text,
    p_id uuid,
    p_local_encontrado text,
    p_quantidade_fisica numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_usuario_id bigint;
    v_nivel text;
    v_registro public.contagens_manuais%rowtype;
    v_local text;
begin
    select u.id, u.nivel
      into v_usuario_id, v_nivel
      from public.usuarios u
     where u.usuario = btrim(p_usuario)
       and u.ativo = true
       and u.senha_hash is not null
       and u.senha_hash = extensions.crypt(p_credencial, u.senha_hash);

    if not found or v_nivel not in ('ADMIN', 'NIVEL2') then
        raise exception 'Usuário sem permissão para editar contagem manual.';
    end if;

    if p_id is null then
        raise exception 'ID da contagem manual é obrigatório.';
    end if;
    v_local := btrim(coalesce(p_local_encontrado, ''));
    if v_local = '' then
        raise exception 'Local encontrado é obrigatório.';
    end if;
    if p_quantidade_fisica is null or p_quantidade_fisica < 0
       or p_quantidade_fisica <> trunc(p_quantidade_fisica) then
        raise exception 'Quantidade física deve ser um inteiro maior ou igual a zero.';
    end if;

    select c.* into v_registro
      from public.contagens_manuais c
     where c.id = p_id
     for update;

    if not found then
        raise exception 'Contagem não encontrada. Atualize o histórico antes de editar.';
    end if;
    if v_nivel <> 'ADMIN' and v_registro.usuario_id is distinct from v_usuario_id then
        raise exception 'Somente o responsável pela contagem ou um administrador pode editá-la.';
    end if;
    if v_registro.alteracao_status = 'CONFIRMADO' then
        raise exception 'Contagem já confirmada no ERP; edição bloqueada.';
    end if;

    update public.contagens_manuais c
       set local_encontrado = v_local,
           quantidade_fisica = p_quantidade_fisica,
           local_alterado = lower(btrim(coalesce(c.local_original, ''))) <> lower(v_local),
           zerado = (p_quantidade_fisica = 0)
     where c.id = p_id
     returning c.* into v_registro;

    return jsonb_build_object(
        'id', v_registro.id,
        'local_encontrado', v_registro.local_encontrado,
        'quantidade_fisica', v_registro.quantidade_fisica,
        'local_alterado', v_registro.local_alterado,
        'zerado', v_registro.zerado,
        'alteracao_status', v_registro.alteracao_status
    );
end;
$function$;

revoke all on function public.pmobile_contagem_manual_atualizar(text,text,uuid,text,numeric) from public;
grant execute on function public.pmobile_contagem_manual_atualizar(text,text,uuid,text,numeric) to anon, authenticated;