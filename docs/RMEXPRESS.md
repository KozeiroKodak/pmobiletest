# RMEXPRESS no PMobile

A aba contém o mesmo aplicativo PMEntregas: Painel, Entregas, Roteiros, Gerência, Central, histórico, confirmação de entregas, fila offline criptografada e notificações. O documento interno isola CSS e IDs do estoque. A aba carrega somente quando aberta; a consulta periódica dos avisos é pausada quando ela fica oculta.

A credencial da sessão PMobile é passada em memória a uma API do frame local identificado. O PMEntregas valida essa credencial no servidor por sua autenticação original. ADMIN/RMADMIN têm gestão; RMMOTORISTAS têm suas entregas. NIVEL2 não recebe a aba. Sair ou trocar de conta invalida consultas em andamento e esconde o conteúdo anterior. Não há credencial em URL, mensagem broadcast, arquivo de integração ou novo armazenamento persistente.

O PMobile controla seu próprio OTA e o registro do celular; o PMEntregas hospedado não inicia outro atualizador nem disputa o vínculo do dispositivo. O APK PMobile 1.05 inclui Firebase, canal de avisos e retorno nativo da aba. A permissão de notificações continua sendo concedida pelo usuário.

## Fonte única

Não editar `rmexpress/app.js`, `rmexpress/style.css` ou `rmexpress/src/` separadamente. Eles são cópias exatas das fontes principais do repositório PMEntregas. `rmexpress/origem.json` registra os hashes usados pelo teste de paridade.

Importação local: `node scripts/sync-rmexpress.mjs --source <pasta-pmentregas> --native`, seguida de `npm run sync:android`. Sem `--source`, o script importa a última OTA pública do PMEntregas, conferindo a origem, o SHA-256 do ZIP, os caminhos e limites de descompressão. O workflow `sync-rmexpress.yml` verifica atualizações a cada 15 minutos e atualiza somente a main. O publicador OTA do PMobile detecta também os arquivos internos da aba. Atualizações de código nativo ainda exigem compilar um APK.

## Validação

`npm test` cobre os arquivos compartilhados, retorno ao estoque e isolamento de sessão. `RMExpressUiTest`, somente no pacote preview e com respostas fictícias, abre as cinco áreas, envia KEYCODE_BACK real, troca ADMIN por motorista, bloqueia NIVEL2 e verifica um marcador de dados locais. Não altera NFs, estoque ou atribuições no servidor. Os testes e regras operacionais do PMEntregas continuam sendo executados no repositório de origem.
