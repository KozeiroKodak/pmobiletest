# Auditoria da arquitetura atual

Revisão da main em 2026-11-02, base 80d88d019f617ff0678bb86093a7f0204fddec75.

Menu lateral vazio, CSS e larguras laterais removidos. A Home usa diretamente Transportes; acessos duplicados ocultos foram retirados. Interfaces antigas de pesquisa por popup e detalhes modais de rastreio foram removidas. Conferência mantém a fila offline e sua sincronização, sem a antiga interface destacada. Banco temporário de importação sem chamadas foi retirado.

A revisão cobre todos os 212 arquivos versionados: fontes web, carregamento direto e dinâmico, estilos, fallback www, fontes Android, testes, fluxos de build/OTA, documentação, recursos e SQL. A ausência de referência em uma busca isolada não foi tratada como prova suficiente para excluir um arquivo.

## O que permanece e por quê

- www é o fallback incorporado ao APK; acompanha as fontes e não é outra implementação.
- Migrações e scripts SQL são artefatos de instalação e manutenção, mesmo quando não são importados pelo JavaScript. Nenhum SQL foi executado nesta limpeza.
- Nomes e versões de IndexedDB, chaves de armazenamento, formatos das filas pendentes e contratos de RPC foram mantidos.
- APIs de dados e de compatibilidade que ainda sustentam sincronização, filas e testes permanecem.
- Recursos Android de densidade/orientação e arquivos Gradle participam da distribuição nativa.
- Bibliotecas externas, fixtures e builders de teste permanecem quando têm uma função de execução ou validação.

## Validação

Testes automáticos de navegação, referências e ausência de recursos removidos em arquitetura-atual.test.cjs. O Android usa apenas pacotes preview com dados fictícios. PMobile e PMRomaneios têm LimpezaUiTest, que carrega HTML/CSS/JS reais em uma origem isolada, bloqueia rede e escritas e verifica as telas atuais; o PMobile percorre também os oito módulos de Dados locais. PMEntregas mantém AcessoUiTest e JornadaUiTest. Não houve testes de gravação no estoque, banco real ou aparelho principal.
