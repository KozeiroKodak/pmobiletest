-- PMOBILE / RASTREIO
-- Importação manual da planilha operacional.
-- Aplicada ao projeto Supabase em 21/10/2026.

create table if not exists public.rastreio_importacoes (
    id uuid primary key default gen_random_uuid(),
    arquivo_nome text not null,
    sha256 text,
    tamanho_bytes bigint,
    colunas jsonb not null default '[]'::jsonb,
    usuario_id bigint not null references public.usuarios(id),
    usuario_nome text not null,
    total_linhas integer not null default 0,
    status text not null default 'EM_ANDAMENTO'
        check (status in ('EM_ANDAMENTO','CONCLUIDA','ERRO')),
    criado_em timestamptz not null default now(),
    finalizado_em timestamptz
);

alter table public.rastreios
    add column if not exists importacao_id uuid references public.rastreio_importacoes(id);

create index if not exists rastreios_importacao_id_idx on public.rastreios(importacao_id);
create index if not exists rastreio_importacoes_criado_em_idx on public.rastreio_importacoes(criado_em desc);

alter table public.rastreio_importacoes enable row level security;
revoke all on table public.rastreio_importacoes from anon, authenticated;

-- As funções abaixo validam a credencial PMOBILE antes de qualquer operação.
-- A implementação em produção foi aplicada diretamente ao Supabase.
