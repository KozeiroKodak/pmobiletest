// ============================================================
// PMOBILE
// ARQUIVO: divergencias.js
// ============================================================
//
// OBJETIVO:
//
// Controlar a tela "Divergências".
//
// A tela mostra somente os materiais que,
// durante a conferência, apresentaram diferença
// entre o estoque esperado e a quantidade física.
//
// Classificação:
//
// - FALTANTE = quantidade física menor que a esperada
// - SOBRA    = quantidade física maior que a esperada
//
// O histórico das conferências vem do Supabase.
//
// ============================================================


// ============================================================
// FUNÇÃO: escaparHTMLDivergencias()
//
// OBJETIVO:
//
// Evitar que dados vindos do banco sejam interpretados
// como código HTML.
//
// ============================================================

function escaparHTMLDivergencias(valor) {

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
// FUNÇÃO: exibirDivergencias()
//
// OBJETIVO:
//
// Carregar as conferências do Supabase,
// identificar somente as que possuem diferença
// e exibir os materiais divergentes.
//
// ============================================================

async function exibirDivergencias() {

    // ========================================================
    // LOCALIZAR ÁREA DE RESULTADO
    // ========================================================

    const areaResultado =
        document.getElementById("resultadoDivergencias");


    // ========================================================
    // VERIFICAR ÁREA
    // ========================================================

    if (!areaResultado) {

        console.error(
            "Elemento #resultadoDivergencias não encontrado."
        );

        return;

    }


    // ========================================================
    // MENSAGEM DE CARREGAMENTO
    // ========================================================

    areaResultado.innerHTML =
        "<p>🔄 Carregando divergências...</p>";


    try {

        // ====================================================
        // CARREGAR HISTÓRICO DO SUPABASE
        // ====================================================

        await carregarConferencias();


        // ====================================================
        // VERIFICAR SE EXISTEM CONFERÊNCIAS
        // ====================================================

        if (
            !Array.isArray(conferencias) ||
            conferencias.length === 0
        ) {

            areaResultado.innerHTML =
                "<p>Nenhuma contagem foi registrada ainda.</p>";

            return;

        }


        // ====================================================
        // SELECIONAR SOMENTE DIVERGÊNCIAS
        // ====================================================

        const divergencias =
            conferencias.filter(
                function (contagem) {

                    const diferenca =
                        Number(
                            contagem.diferenca ??
                            0
                        );

                    return diferenca !== 0;

                }
            );


        // ====================================================
        // NENHUMA DIVERGÊNCIA
        // ====================================================

        if (divergencias.length === 0) {

            areaResultado.innerHTML =
                "<p>✅ Nenhuma divergência encontrada.</p>";

            return;

        }


        // ====================================================
        // CONTADORES DE PRODUTOS
        // ====================================================

        let produtosFaltantes = 0;

        let produtosSobras = 0;


        // ====================================================
        // CONTADORES DE UNIDADES
        // ====================================================

        let unidadesFaltantes = 0;

        let unidadesSobras = 0;


        // ====================================================
        // ANALISAR DIVERGÊNCIAS
        // ====================================================

        divergencias.forEach(
            function (contagem) {

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


                // ============================================
                // FALTANTE
                // ============================================

                if (
                    quantidadeFisica <
                    quantidadeEsperada
                ) {

                    produtosFaltantes++;

                    unidadesFaltantes +=
                        quantidadeEsperada -
                        quantidadeFisica;

                }


                // ============================================
                // SOBRA
                // ============================================

                if (
                    quantidadeFisica >
                    quantidadeEsperada
                ) {

                    produtosSobras++;

                    unidadesSobras +=
                        quantidadeFisica -
                        quantidadeEsperada;

                }

            }
        );


        // ====================================================
        // EXIBIR RESUMO
        // ====================================================

        areaResultado.innerHTML = `

            <p>
                🔴 <strong>Faltantes:</strong>
                ${produtosFaltantes} produtos /
                ${unidadesFaltantes} unidades
            </p>

            <p>
                🟢 <strong>Sobras:</strong>
                ${produtosSobras} produtos /
                ${unidadesSobras} unidades
            </p>

            <hr>

        `;


        // ====================================================
        // EXIBIR CADA DIVERGÊNCIA
        // ====================================================

        divergencias.forEach(
            function (contagem) {

                // ============================================
                // OBTER DADOS
                // ============================================

                const codigo =
                    contagem.codigo_material ??
                    contagem.codigo ??
                    "";

                const descricao =
                    contagem.descricao_material ??
                    contagem.descricao ??
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


                // ============================================
                // CLASSIFICAÇÃO
                // ============================================

                let classificacao = "";


                if (
                    quantidadeFisica <
                    quantidadeEsperada
                ) {

                    classificacao =
                        "🔴 FALTANTE";

                } else if (
                    quantidadeFisica >
                    quantidadeEsperada
                ) {

                    classificacao =
                        "🟢 SOBRA";

                }


                // ============================================
                // EXIBIR MATERIAL
                // ============================================

                areaResultado.innerHTML += `

                    <div class="registro-divergencia">

                        <h3>
                            ${escaparHTMLDivergencias(
                                descricao
                            )}
                        </h3>

                        <p>
                            <strong>Código:</strong>
                            ${escaparHTMLDivergencias(
                                codigo
                            )}
                        </p>

                        <p>
                            <strong>Classificação:</strong>
                            ${escaparHTMLDivergencias(
                                classificacao
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
            "Erro ao carregar divergências:",
            erro
        );


        areaResultado.innerHTML = `

            <p>
                ⚠️ Não foi possível carregar as divergências.
            </p>

            <p>
                Verifique a conexão com o Supabase.
            </p>

        `;

    }

}