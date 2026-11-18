PMobile / Boas-vindas personalizadas e fotos sincronizadas.

- A tela PMOBILE - ESTOQUE permanece sempre na abertura; nenhuma restauracao de login navega sozinha.
- Nome e foto do usuario autenticado aparecem na abertura, com Iniciar abaixo e opcao Trocar usuario.
- Login normal, primeiro acesso, login mantido e sessao offline seguem o mesmo fluxo.
- O botao Iniciar valida se existe sessao antes de liberar somente as abas permitidas.
- Restauracao de login protegida contra chamadas concorrentes; o aplicativo nao retorna sozinho para a abertura apos o toque.
- Fotos JPG/PNG/WebP vinculadas ao ID do usuario no Supabase via RPC credenciado, com cache offline individual e fila local.
- Login, credenciais, niveis de usuario e estrutura OTA preservados. Sem alteracoes nos usuarios existentes.
