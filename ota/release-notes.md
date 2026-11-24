PMobile / Cotações — Detalhes instantâneos na Pesquisa via importação.

- Corrigido gargalo ao selecionar cidade: a tela não faz mais segunda requisição ao Supabase para buscar transportadoras.
- A lista carrega 80 cidades por página já com as transportadoras e TDAs; os dados do bloco ficam em memória, como na aba Cotações por Região.
- Detalhe de cidade carregada abre imediatamente, inclusive se a conexão móvel cair após carregar a lista.
- Filtro por cidade/UF permanece global no Supabase e continua paginado; atualizações de importações invalidam o cache de consulta.
- SQL da consulta nova é somente leitura das versões ATIVAS e valida os mesmos perfis autorizados (ADMIN e NIVEL2).
- Histórico, Rastreios, importações e permissões já existentes não foram alterados.
