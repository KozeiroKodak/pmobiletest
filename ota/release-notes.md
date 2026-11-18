PMobile / Boas-vindas personalizadas e fotos sincronizadas.

- A tela PMOBILE - ESTOQUE e exibida SEMPRE ao abrir ou recarregar o aplicativo, mesmo com login salvo.
- Login normal, primeiro acesso e restauracao de sessao mostram a foto, nome e botao Iniciar. Nenhuma dessas etapas abre abas automaticamente.
- Iniciar abre apenas as funcoes permitidas se a sessao estiver autenticada; do contrario, abre o login.
- Trocar usuario encerra a sessao atual e permite entrar com outra conta.
- Fotos JPG/PNG/WebP otimizadas sao gravadas individualmente no Supabase, usando as credenciais do usuario e uma tabela privada com RLS.
- Cache por usuario no aparelho preserva a imagem offline; alteracoes offline ficam pendentes para sincronizar ao reconectar.
- Identidade CBA, niveis, senhas, tokens, inventario e estruturas OTA preservadas.
- Nova bateria de testes de regressao para navegacao, isolamento de conta e OTA.
