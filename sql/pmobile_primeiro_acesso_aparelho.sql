alter table public.solicitacoes_cadastro_usuario
    add column if not exists primeiro_acesso_hash text;

create function public.pmobile_solicitar_cadastro(p_nome text, p_usuario text, p_chave text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
    if p_chave is null or p_chave !~ '^[a-f0-9]{64}$' then
        raise exception 'Chave do aparelho inválida.';
    end if;
    v_id := public.solicitar_cadastro_usuario(p_nome, p_usuario);
    update public.solicitacoes_cadastro_usuario
       set primeiro_acesso_hash = encode(extensions.digest(p_chave,'sha256'),'hex')
     where id = v_id and status = 'PENDENTE' and primeiro_acesso_hash is null;
    if not found then raise exception 'O cadastro já foi solicitado.'; end if;
    return v_id;
end;
$$;

create function public.pmobile_primeiro_acesso(p_usuario text, p_chave text, p_senha text default null)
returns table(id bigint, nome text, usuario text, nivel text, ativo boolean)
language plpgsql security definer set search_path = '' as $$
declare v_usuario public.usuarios%rowtype; v_solicitacao bigint;
begin
    select u.* into v_usuario from public.usuarios u
     where lower(u.usuario) = lower(trim(p_usuario)) and u.ativo and u.senha_hash is null
       and u.token_hash is not null
     for update;
    select s.id into v_solicitacao from public.solicitacoes_cadastro_usuario s
     where lower(s.usuario) = lower(trim(p_usuario)) and s.status = 'APROVADA'
       and s.primeiro_acesso_hash = encode(extensions.digest(p_chave,'sha256'),'hex')
       and s.resolvido_em = v_usuario.token_criado_em;
    if v_usuario.id is null or v_solicitacao is null then
        raise exception 'Cadastro pendente ou primeiro acesso indisponível neste aparelho.';
    end if;
    if p_senha is null then
        return query select v_usuario.id, v_usuario.nome, v_usuario.usuario, v_usuario.nivel, v_usuario.ativo;
        return;
    end if;
    update public.usuarios u set token_hash = encode(extensions.digest(p_chave,'sha256'),'hex')
     where u.id = v_usuario.id;
    return query select * from public.criar_senha_usuario(p_usuario, p_senha, p_chave);
    if not found then raise exception 'Não foi possível criar a senha.'; end if;
    update public.solicitacoes_cadastro_usuario set primeiro_acesso_hash = null
     where solicitacoes_cadastro_usuario.id = v_solicitacao;
end;
$$;

revoke all on function public.pmobile_solicitar_cadastro(text,text,text) from public;
revoke all on function public.pmobile_primeiro_acesso(text,text,text) from public;
grant execute on function public.pmobile_solicitar_cadastro(text,text,text) to anon, authenticated;
grant execute on function public.pmobile_primeiro_acesso(text,text,text) to anon, authenticated;
