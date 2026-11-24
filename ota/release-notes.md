PMobile / Home Android — correção da rolagem indevida.

- Corrigido o excesso de altura da tela Estoque (Home) quando todos os cartões cabem na área útil.
- Durante a Home móvel, a altura mínima de #aplicacao e #conteudoPrincipal considera a barra fixa de status; o body não soma mais 48px de preenchimento.
- A Home continua usando min-height, sem travar altura: em aparelhos menores ou modo paisagem, a rolagem permanece disponível quando o conteúdo realmente ultrapassar o espaço visível.
- Ao abrir a Home, o scroll residual é reiniciado; ao mudar de aba, sair ou abrir login, o ajuste específico é desativado.
- O tema CBA, o logotipo, a imagem de perfil, os cartões e a barra de status mantêm a aparência e o funcionamento existentes.
- Sem mudanças no Supabase, dados, permissões, rastreios ou telas internas.
