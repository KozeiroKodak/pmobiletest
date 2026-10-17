// ============================================================
// PMOBILE
// ARQUIVO: conferenciasrealizadas.js
// ============================================================
//
// OBJETIVO:
//
// Controlar a tela de "Conferências Realizadas".
//
// A partir desta versão:
//
// - O histórico vem diretamente do Supabase.
// - A tabela utilizada é "conferencias".
// - A tela não depende mais do localStorage.
// - Os dados são carregados sempre que a tela é aberta.
// - Os registros do Supabase são convertidos para o formato
//   utilizado pela interface do PMOBILE.
//
// ============================================================


// ============================================================
// FUNÇÃO: escaparHTMLConferencias()
//
// OBJETIVO:
//
// Evitar que dados vindos do banco sejam interpretados como
// código HTML.
//
// Isso protege principalmente campos como:
// - descrição
// - código
// - referência
// - status
//
// ============================================================

function escaparHTMLConferencias(valor) {

    if (valor === null || valor === undefined) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// FUNÇÃO: formatarDataConferencia()
//
// OBJETIVO:
//
// Transformar a data do Supabase em uma apresentação
// mais amigável para o usuário.
//
// Exemplo:
//
// 2026-09-15T20:30:00.000Z
//
// vira:
//
// 15/09/2026 17:30
//
// ============================================================

function formatarDataConferencia(data) {

    if (!data) {
        return "Data não informada";
    }

    const dataConvertida = new Date(data);

    if (Number.isNaN(dataConvertida.getTime())) {
        return "Data inválida";
    }

    return dataConvertida.toLocaleString("pt-BR");
}


// ============================================================
// FUNÇÃO: exibirConferencias()
//
// OBJETIVO:
//
// Carregar as conferências do Supabase e exibir o histórico.
//
// IMPORTANTE:
//
// Esta função é assíncrona porque precisa esperar a consulta
// ao Supabase terminar antes de montar a tela.
//
// ============================================================

async function exibirConferencias() {

    // ========================================================
    // LOCALIZAR ÁREA DE RESULTADO
    // ========================================================

    const areaResultado =
        document.getElementById("resultadoConferencias");


    // ========================================================
    // VERIFICAR ÁREA
    // ========================================================

    if (!areaResultado) {

        console.error(
            "Elemento #resultadoConferencias não encontrado."
        );

        return;

    }


    // ========================================================
    // MENSAGEM INICIAL
    // ========================================================

    areaResultado.innerHTML =
        "<p>🔄 Carregando conferências...</p>";


    try {

        // ====================================================
        // CARREGAR DADOS DO SUPABASE
        // ====================================================

        await carregarConferencias();


        // ====================================================
        // VERIFICAR RESULTADO
        // ====================================================

        if (
            !Array.isArray(conferencias) ||
            conferencias.length === 0
        ) {

            areaResultado.innerHTML =
                "<p>Nenhuma contagem registrada ainda.</p>";

            return;

        }


        // ====================================================
        // CONTADORES
        // ====================================================

        let total = conferencias.length;

        let totalOk = 0;

        let totalDivergencias = 0;


        // ====================================================
        // ANALISAR CONFERÊNCIAS
        // ====================================================

        conferencias.forEach(
            function (contagem) {

                const diferenca =
                    Number(
                        contagem.diferenca ??
                        contagem.diferenca_material ??
                        0
                    );


                if (diferenca === 0) {

                    totalOk++;

                } else {

                    totalDivergencias++;

                }

            }
        );


        // ====================================================
        // MONTAR RESUMO
        // ====================================================

        areaResultado.innerHTML = `

            <p>
                <strong>Total conferido:</strong>
                ${total}
            </p>

            <p>
                ✅ OK:
                ${totalOk}
            </p>

            <p>
                ❌ Divergências:
                ${totalDivergencias}
            </p>

            <hr>

        `;


        // ====================================================
        // EXIBIR CADA CONFERÊNCIA
        // ====================================================

        conferencias.forEach(
            function (contagem) {

                // ============================================
                // COMPATIBILIDADE COM SUPABASE
                // ============================================

                const codigo =
                    contagem.codigo_material ??
                    contagem.codigo ??
                    "";

                const descricao =
                    contagem.descricao_material ??
                    contagem.descricao ??
                    "";

                const referencia =
                    contagem.referencia_material ??
                    contagem.referencia ??
                    "";

                const quantidadeEsperada =
                    Number(
                        contagem.quantidade_esperada ??
                        contagem.quantidadeEsperada ??
                        0
                    );

                const quantidadeFisica =
                    Number(
                        contagem.quantidade_fisica ??
                        contagem.quantidadeFisica ??
                        0
                    );

                const diferenca =
                    Number(
                        contagem.diferenca ??
                        0
                    );

                const status =
                    contagem.status ??
                    "CONFERIDO";

                const data =
                    contagem.criado_em ??
                    contagem.data ??
                    "";


                // ============================================
                // TEXTO DO STATUS
                // ============================================

                let statusExibicao = status;


                if (diferenca === 0) {

                    statusExibicao =
                        "✅ OK / CONFERIDO";

                } else {

                    statusExibicao =
                        "❌ DIVERGÊNCIA";

                }


                // ============================================
                // ADICIONAR AO HISTÓRICO
                // ============================================

                areaResultado.innerHTML += `

                    <div class="registro-conferencia">

                        <h3>
                            ${escaparHTMLConferencias(descricao)}
                        </h3>

                        <p>
                            <strong>Código:</strong>
                            ${escaparHTMLConferencias(codigo)}
                        </p>

                        <p>
                            <strong>Referência:</strong>
                            ${escaparHTMLConferencias(referencia)}
                        </p>

                        <p>
                            <strong>Estoque esperado:</strong>
                            ${quantidadeEsperada}
                        </p>

                        <p>
                            <strong>Quantidade física:</strong>
                            ${quantidadeFisica}
                        </p>

                        <p>
                            <strong>Diferença:</strong>
                            ${diferenca}
                        </p>

                        <p>
                            <strong>Status:</strong>
                            ${escaparHTMLConferencias(
                                statusExibicao
                            )}
                        </p>

                        <p>
                            <strong>Data:</strong>
                            ${escaparHTMLConferencias(
                                formatarDataConferencia(data)
                            )}
                        </p>

                        <hr>

                    </div>

                `;

            }
        );


    } catch (erro) {

        // ====================================================
        // TRATAMENTO DE ERRO
        // ====================================================

        console.error(
            "Erro ao exibir conferências:",
            erro
        );


        areaResultado.innerHTML = `

            <p>
                ⚠️ Não foi possível carregar as conferências.
            </p>

            <p>
                Verifique a conexão com o Supabase.
            </p>

        `;

    }

}