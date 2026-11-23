PMobile / Importador de Cotações: aceitar planilhas com cabeçalhos deslocados e colunas extras.

- Localiza UF, Destino e TDA nas primeiras 50 linhas, inclusive quando o cabeçalho não é a primeira linha.
- Ignora colunas adicionais e outras abas; somente os três campos autorizados podem ser enviados ao Supabase.
- Não importa localidades identificadas explicitamente como NÃO ATENDEMOS; informa quantidade antes da confirmação.
- Validação reforçada para a planilha da Transcelo original e sua versão editada.
- A planilha Alfa conserva duplicações: localidades com UF e Destino idênticos, mesmo com IBGE distinto, exigem conferência manual. Nenhuma TDA será escolhida automaticamente.
- Nenhum registro de Rastreio ou importação foi modificado por esta correção.