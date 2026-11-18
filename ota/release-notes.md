PMobile / BugHunter: corrigir eixo vertical do editor de fotos (OTA).

- Corrigido o controle Posição vertical: com zoom acima de 100%, a foto agora desloca a área real de recorte, e não apenas o texto do slider.
- O eixo horizontal usa o mesmo cálculo e o arrastar respeita a sobra de pixels da imagem.
- Percentuais são arredondados para números inteiros (sem casas decimais extensas).
- A prévia do plano de fundo usa formato vertical próximo ao do celular.
- A tela de boas-vindas reaplica o mesmo recorte após salvar, reabrir ou girar o aparelho.
- Se não houver sobra vertical no zoom atual, o editor orienta aumentar o zoom.
- Fotos e ajustes existentes, dados do Supabase, conta, hierarquias e sistema OTA preservados.
- Adicionados testes causais de regressão comparando Y=100%, Y=53% e zoom 165%.
