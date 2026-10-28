# Rastreio OneDrive: linhas móveis sem perda de histórico

## Decisão de negócio

Cada NF acrescentada à planilha gera uma nova linha, e isso pode deslocar as anteriores. Portanto, `linha_origem` é apenas a **posição visual**, nunca a identidade do rastreio.

Esta correção foi instalada diretamente no Supabase, mantendo a mesma API chamada pelo PMobile: `pmobile_rastreio_sincronizar_fonte_v2`, que utiliza as funções atualizadas `pmobile_rastreio_preflight_sincronizacao` e `pmobile_rastreio_sincronizar_fonte`. Nenhum arquivo JavaScript nem a distribuição OTA precisam ser modificados para a correção do backend.

## Como funciona

- Uma identidade candidata é a combinação normalizada de **NF completa + cliente + transportadora**.
- Uma correspondência inequívoca mantém o mesmo `rastreios.id` mesmo quando `linha_origem` muda.
- Duplicatas não movimentadas com mesmo número de ocorrências mantêm a ordem relativa de ocorrência para preservar os IDs; se a quantidade mudar, são recriadas somente se não estiverem protegidas.
- Registros movimentados/atribuídos/históricos exigem identidade inequívoca. Se uma NF protegida desaparece, muda de identificação ou fica ambígua, o banco bloqueia a transação inteira sem alterar dados.
- Campos operacionais e atributos de uma NF protegida não são regravados a partir do Excel; somente sua posição muda.
- Exclusões em massa (mais de 3% ou 25 registros, o maior valor) permanecem bloqueadas, mas o cálculo considera identidades realmente ausentes, não números de linha que foram deslocados.
- A fonte e todos os rastreios envolvidos são bloqueados transacionalmente durante a reconciliação, evitando conflitos com confirmações simultâneas.
- A API de percentuais continua rodando após a reconciliação, agora com as linhas corretas; o histórico e os IDs das entregas permanecem associados aos mesmos rastreios.

## Teste sem mudar produção

Uma simulação SQL somente de leitura gerou uma linha fictícia no começo de 9.424 registros, deslocando todas as posições. O mapeamento identificou 9.424 registros existentes, uma nova linha e zero exclusões, preservando as 10 associações operacionais que existiam na hora do teste.

Testes automáticos estão em `tests/rastreio-linhas-moveis.test.cjs`, acionados por `.github/workflows/test-rastreio-linhas.yml`.

## Homologação real

1. No PMobile, não usar **Limpar todos os dados** nem substituir a fonte.
2. Manter o link OneDrive atual e usar **Sincronizar agora** (aguardar retorno).
3. Conferir que as NFs recém-inseridas aparecem e os registros antigos mantêm seus status, motoristas e histórico.
4. Se houver erro por identidade ambígua, não usar um bypass destrutivo. Conferir qual NF/cliente/transportadora mudou na planilha e resolver essa divergência com um ID explícito por ocorrência antes de prosseguir.

A sincronização real com o arquivo atualizado no OneDrive **não foi executada pelo assistente**, por falta de acesso de leitura ao arquivo; testes simulados e revisão de funções não substituem essa homologação.

## Melhorias futuras

Quando houver uma coluna estável `id_lancamento` por operação na planilha, usá-la como chave preferencial de negócio; a combinação NF/cliente/transportadora continuará sendo fallback para arquivos antigos. O identificador de reenvio com sufixo E/P/R não deve ser truncado.

SQL implantado e versionado em `sql/rastreio_linhas_moveis.sql`. Revisão adicional de autenticação legada do PMMobile recomendada antes da expansão de usuários.
