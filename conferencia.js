// ============================================================
// PMOBILE
// ARQUIVO: conferencia.js
// ============================================================
//
// OBJETIVO:
//
// Controlar a tela "Conferência".
//
// IMPORTANTE:
//
// A partir desta versão, os materiais utilizados na conferência
// são consultados DIRETAMENTE no Supabase.
//
// O Supabase passa a ser a fonte central dos materiais.
//
// O IndexedDB / array "materiais" NÃO é mais utilizado para
// buscar ou selecionar materiais nesta tela.
//
// ============================================================
//
// FLUXO:
//
// 1. Usuário pesquisa um material.
// 2. PMOBILE consulta o Supabase.
// 3. Supabase retorna os materiais encontrados.
// 4. Usuário seleciona um material.
// 5. PMOBILE guarda o ID do registro selecionado.
// 6. Usuário informa a quantidade física.
// 7. PMOBILE calcula a diferença.
// 8. Conferência é registrada.
// 9. Histórico continua sendo salvo localmente por enquanto.
//
// ============================================================



// ============================================================
// FUNÇÃO: obterClienteSupabaseConferencia()
// ============================================================
//
// OBJETIVO:
//
// Garantir que o cliente Supabase esteja disponível.
//
// RETORNO:
//
// Retorna o cliente Supabase.
//
// ERRO:
//
// Caso o Supabase ainda não tenha sido inicializado,
// interrompe a operação.
//
// ============================================================

function obterClienteSupabaseConferencia() {

    if (!window.clienteSupabase) {

        throw new Error(
            "Cliente Supabase não foi inicializado."
        );

    }

    return window.clienteSupabase;
}



// ============================================================
// FUNÇÃO: escaparBuscaILikeConferencia()
// ============================================================
//
// OBJETIVO:
//
// Escapar caracteres especiais utilizados pelo ILIKE.
//
// Isso evita que "%" e "_" sejam interpretados como
// curingas durante a pesquisa.
//
// ============================================================

function escaparBuscaILikeConferencia(valor) {

    return String(valor)

        .replace(
            /\\/g,
            "\\\\"
        )

        .replace(
            /%/g,
            "\\%"
        )

        .replace(
            /_/g,
            "\\_"
        );

}



// ============================================================
// VARIÁVEL: materialConferenciaSelecionado
// ============================================================
//
// OBJETIVO:
//
// Armazenar temporariamente o material escolhido pelo usuário.
//
// IMPORTANTE:
//
// Agora guardamos o objeto retornado pelo Supabase.
//
// Isso evita depender do array local "materiais".
//
// ============================================================

let materialConferenciaSelecionado = null;



// ============================================================
// FUNÇÃO: buscarMaterialConferencia()
// ============================================================
//
// OBJETIVO:
//
// Pesquisar materiais diretamente na tabela:
//
//     public.materiais
//
// CAMPOS PESQUISADOS:
//
// - código
// - descrição
// - referência
//
// NÃO PESQUISA:
//
// - Local
// - Marca
// - Quantidade
//
// A pesquisa é feita diretamente no Supabase.
//
// ============================================================

async function buscarMaterialConferencia() {

    const campo =
        document.getElementById(
            "campoConferencia"
        );


    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );


    // ========================================================
    // VERIFICAR ELEMENTOS DA TELA
    // ========================================================

    if (!campo || !areaResultado) {

        console.error(
            "Elementos da tela de conferência não encontrados."
        );

        return;
    }


    // ========================================================
    // OBTER TEXTO DA PESQUISA
    // ========================================================

    const buscaOriginal =
        campo.value.trim();


    // ========================================================
    // VERIFICAR PESQUISA VAZIA
    // ========================================================

    if (buscaOriginal === "") {

        areaResultado.innerHTML =
            "<p>Digite um código, descrição ou referência.</p>";

        return;
    }


    // ========================================================
    // ESCAPAR CARACTERES ESPECIAIS
    // ========================================================

    const busca =
        escaparBuscaILikeConferencia(
            buscaOriginal
        );


    // ========================================================
    // MOSTRAR STATUS
    // ========================================================

    areaResultado.innerHTML =
        "<p>Pesquisando no Supabase...</p>";


    try {

        // ====================================================
        // OBTER CLIENTE SUPABASE
        // ====================================================

        const clienteSupabase =
            obterClienteSupabaseConferencia();


        // ====================================================
        // CONSULTAR SUPABASE
        // ====================================================
        //
        // Procuramos o texto em:
        //
        // codigo
        // descricao
        // referencia
        //
        // ====================================================

        const { data, error } =
            await clienteSupabase

                .from("materiais")

                .select(
                    "id,codigo,descricao,referencia,marca,local,quantidade,quantidade_reservada,disponivel"
                )

                .or(
                    "codigo.ilike.%" +
                    busca +
                    "%,descricao.ilike.%" +
                    busca +
                    "%,referencia.ilike.%" +
                    busca +
                    "%"
                )

                .order(
                    "codigo",
                    {
                        ascending: true
                    }
                )

                .limit(100);


        // ====================================================
        // VERIFICAR ERRO
        // ====================================================

        if (error) {

            throw error;

        }


        // ====================================================
        // EXIBIR RESULTADOS
        // ====================================================

        exibirResultadosConferencia(
            data || [],
            areaResultado
        );


    } catch (erro) {

        console.error(
            "Erro ao pesquisar material para conferência:",
            erro
        );


        areaResultado.innerHTML =
            "<p>❌ Erro ao consultar o Supabase.</p>";

    }

}



// ============================================================
// FUNÇÃO: exibirResultadosConferencia()
// ============================================================
//
// OBJETIVO:
//
// Mostrar na tela os materiais encontrados pelo Supabase.
//
// PARÂMETROS:
//
// resultados
//     Array de materiais retornados pelo Supabase.
//
// areaResultado
//     Elemento HTML onde os resultados serão exibidos.
//
// ============================================================

function exibirResultadosConferencia(
    resultados,
    areaResultado
) {

    // ========================================================
    // LIMPAR RESULTADOS ANTERIORES
    // ========================================================

    areaResultado.innerHTML = "";


    // ========================================================
    // NENHUM RESULTADO
    // ========================================================

    if (
        !Array.isArray(resultados) ||
        resultados.length === 0
    ) {

        areaResultado.innerHTML =
            "<p>Nenhum material encontrado.</p>";

        return;
    }


    // ========================================================
    // FRAGMENTO
    // ========================================================
    //
    // Utilizamos DocumentFragment para montar os resultados
    // sem ficar alterando o DOM a cada material.
    //
    // ========================================================

    const fragmento =
        document.createDocumentFragment();


    // ========================================================
    // PERCORRER RESULTADOS
    // ========================================================

    resultados.forEach(
        function (material) {


            // =================================================
            // BLOCO DO MATERIAL
            // =================================================

            const bloco =
                document.createElement(
                    "div"
                );


            // =================================================
            // SEPARADOR
            // =================================================

            const linha =
                document.createElement(
                    "hr"
                );


            // =================================================
            // DESCRIÇÃO
            // =================================================

            const titulo =
                document.createElement(
                    "h3"
                );

            titulo.textContent =
                material.descricao ||
                "Material";


            // =================================================
            // CÓDIGO
            // =================================================

            const codigo =
                document.createElement(
                    "p"
                );

            codigo.innerHTML =
                "<strong>Código:</strong> ";

            codigo.appendChild(
                document.createTextNode(
                    material.codigo ?? "-"
                )
            );


            // =================================================
            // REFERÊNCIA
            // =================================================

            const referencia =
                document.createElement(
                    "p"
                );

            referencia.innerHTML =
                "<strong>Referência:</strong> ";

            referencia.appendChild(
                document.createTextNode(
                    material.referencia ?? "-"
                )
            );


            // =================================================
            // LOCAL
            // =================================================

            const local =
                document.createElement(
                    "p"
                );

            local.innerHTML =
                "<strong>Local:</strong> ";

            local.appendChild(
                document.createTextNode(
                    material.local ?? "-"
                )
            );


            // =================================================
            // MARCA
            // =================================================

            const marca =
                document.createElement(
                    "p"
                );

            marca.innerHTML =
                "<strong>Marca:</strong> ";

            marca.appendChild(
                document.createTextNode(
                    material.marca ?? "-"
                )
            );


            // =================================================
            // QUANTIDADE ESPERADA
            // =================================================

            const quantidade =
                document.createElement(
                    "p"
                );

            quantidade.innerHTML =
                "<strong>Estoque esperado:</strong> ";

            quantidade.appendChild(
                document.createTextNode(
                    material.quantidade ?? "-"
                )
            );


            // =================================================
            // BOTÃO SELECIONAR
            // =================================================

            const botao =
                document.createElement(
                    "button"
                );

            botao.type =
                "button";

            botao.textContent =
                "Selecionar";


            // =================================================
            // GUARDAR O MATERIAL DIRETAMENTE NO BOTÃO
            // =================================================
            //
            // Não utilizamos mais o array "materiais".
            //
            // O botão recebe o objeto retornado pelo Supabase.
            //
            // =================================================

            botao.addEventListener(
                "click",
                function () {

                    selecionarMaterialConferencia(
                        material
                    );

                }
            );


            // =================================================
            // MONTAR BLOCO
            // =================================================

            bloco.appendChild(
                linha
            );

            bloco.appendChild(
                titulo
            );

            bloco.appendChild(
                codigo
            );

            bloco.appendChild(
                referencia
            );

            bloco.appendChild(
                local
            );

            bloco.appendChild(
                marca
            );

            bloco.appendChild(
                quantidade
            );

            bloco.appendChild(
                botao
            );


            // =================================================
            // ADICIONAR AO FRAGMENTO
            // =================================================

            fragmento.appendChild(
                bloco
            );

        }
    );


    // ========================================================
    // ADICIONAR TUDO À TELA
    // ========================================================

    areaResultado.appendChild(
        fragmento
    );

}



// ============================================================
// FUNÇÃO: selecionarMaterialConferencia()
// ============================================================
//
// OBJETIVO:
//
// Receber o material escolhido pelo usuário.
//
// IMPORTANTE:
//
// O material já veio diretamente do Supabase.
//
// Portanto, não precisamos procurar novamente dentro
// do array local "materiais".
//
// ============================================================

function selecionarMaterialConferencia(
    material
) {

    // ========================================================
    // VALIDAR MATERIAL
    // ========================================================

    if (!material) {

        console.error(
            "Material inválido para conferência."
        );

        return;
    }


    // ========================================================
    // GUARDAR MATERIAL SELECIONADO
    // ========================================================

    materialConferenciaSelecionado =
        material;


    // ========================================================
    // LOCALIZAR ÁREA DE RESULTADO
    // ========================================================

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );


    if (!areaResultado) {

        return;

    }


    // ========================================================
    // LIMPAR RESULTADO
    // ========================================================

    areaResultado.innerHTML =
        "";


    // ========================================================
    // DESCRIÇÃO
    // ========================================================

    const titulo =
        document.createElement(
            "h3"
        );

    titulo.textContent =
        material.descricao ||
        "Material";


    // ========================================================
    // CÓDIGO
    // ========================================================

    const codigo =
        document.createElement(
            "p"
        );

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );


    // ========================================================
    // REFERÊNCIA
    // ========================================================

    const referencia =
        document.createElement(
            "p"
        );

    referencia.innerHTML =
        "<strong>Referência:</strong> ";

    referencia.appendChild(
        document.createTextNode(
            material.referencia ?? "-"
        )
    );


    // ========================================================
    // LOCAL
    // ========================================================

    const local =
        document.createElement(
            "p"
        );

    local.innerHTML =
        "<strong>Local:</strong> ";

    local.appendChild(
        document.createTextNode(
            material.local ?? "-"
        )
    );


    // ========================================================
    // MARCA
    // ========================================================

    const marca =
        document.createElement(
            "p"
        );

    marca.innerHTML =
        "<strong>Marca:</strong> ";

    marca.appendChild(
        document.createTextNode(
            material.marca ?? "-"
        )
    );


    // ========================================================
    // ESTOQUE ESPERADO
    // ========================================================

    const quantidade =
        document.createElement(
            "p"
        );

    quantidade.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    quantidade.appendChild(
        document.createTextNode(
            material.quantidade ?? "-"
        )
    );


    // ========================================================
    // SEPARADOR
    // ========================================================

    const linha =
        document.createElement(
            "hr"
        );


    // ========================================================
    // CAMPO DE QUANTIDADE FÍSICA
    // ========================================================

    const campoQuantidade =
        document.createElement(
            "input"
        );

    campoQuantidade.type =
        "number";

    campoQuantidade.id =
        "campoQuantidadeFisica";

    campoQuantidade.placeholder =
        "Quantidade física";

    campoQuantidade.min =
        "0";

    campoQuantidade.step =
        "1";


    // ========================================================
    // BOTÃO CONFIRMAR
    // ========================================================

    const botaoConfirmar =
        document.createElement(
            "button"
        );

    botaoConfirmar.type =
        "button";

    botaoConfirmar.id =
        "botaoConfirmarContagem";

    botaoConfirmar.textContent =
        "CONFIRMAR";


    // ========================================================
    // EVENTO DO BOTÃO
    // ========================================================

    botaoConfirmar.addEventListener(
        "click",
        function () {

            registrarContagem();

        }
    );


    // ========================================================
    // MONTAR TELA
    // ========================================================

    areaResultado.appendChild(
        titulo
    );

    areaResultado.appendChild(
        codigo
    );

    areaResultado.appen
    // ========================================================
    // MONTAR TELA
    // ========================================================

    areaResultado.appendChild(
        titulo
    );

    areaResultado.appendChild(
        codigo
    );

    areaResultado.appendChild(
        referencia
    );

    areaResultado.appendChild(
        local
    );

    areaResultado.appendChild(
        marca
    );

    areaResultado.appendChild(
        quantidade
    );

    areaResultado.appendChild(
        linha
    );

    areaResultado.appendChild(
        campoQuantidade
    );

    areaResultado.appendChild(
        botaoConfirmar
    );


    // ========================================================
    // COLOCAR CURSOR NO CAMPO
    // ========================================================

    campoQuantidade.focus();

}



// ============================================================
// FUNÇÃO: registrarContagem()
// ============================================================
//
// OBJETIVO:
//
// Registrar a contagem física do material selecionado.
//
// FLUXO:
//
// Material selecionado
//       ↓
// Quantidade física
//       ↓
// Diferença
//       ↓
// Status
//       ↓
// Histórico de conferências
//
// IMPORTANTE:
//
// O material utilizado aqui é o material recebido
// diretamente do Supabase.
//
// ============================================================

function registrarContagem() {

    // ========================================================
    // VERIFICAR MATERIAL SELECIONADO
    // ========================================================

    const material =
        materialConferenciaSelecionado;


    if (!material) {

        alert(
            "Nenhum material foi selecionado."
        );

        return;
    }


    // ========================================================
    // LOCALIZAR CAMPO
    // ========================================================

    const campoQuantidade =
        document.getElementById(
            "campoQuantidadeFisica"
        );


    if (!campoQuantidade) {

        return;

    }


    // ========================================================
    // LER QUANTIDADE FÍSICA
    // ========================================================

    const valor =
        campoQuantidade.value.trim();


    // ========================================================
    // VALIDAR CAMPO VAZIO
    // ========================================================

    if (valor === "") {

        alert(
            "Informe a quantidade física."
        );

        return;
    }


    // ========================================================
    // CONVERTER PARA NÚMERO
    // ========================================================

    const quantidadeFisica =
        Number(valor);


    // ========================================================
    // VALIDAR NÚMERO
    // ========================================================

    if (
        !Number.isFinite(
            quantidadeFisica
        ) ||
        quantidadeFisica < 0
    ) {

        alert(
            "Informe uma quantidade válida."
        );

        return;
    }


    // ========================================================
    // QUANTIDADE ESPERADA
    // ========================================================

    const quantidadeEsperada =
        Number(
            material.quantidade ?? 0
        );


    // ========================================================
    // CALCULAR DIFERENÇA
    // ========================================================
    //
    // Física - Esperada
    //
    // 0  = OK
    // <0 = FALTA
    // >0 = SOBRA
    //
    // ========================================================

    const diferenca =
        quantidadeFisica -
        quantidadeEsperada;


    // ========================================================
    // DEFINIR STATUS
    // ========================================================

    let status =
        "";

    let emoji =
        "";


    if (
        diferenca === 0
    ) {

        status =
            "OK / CONFERIDO";

        emoji =
            "✅";

    } else {

        status =
            "DIVERGÊNCIA";

        emoji =
            "❌";

    }


    // ========================================================
    // CRIAR REGISTRO DA CONFERÊNCIA
    // ========================================================
    //
    // O ID do Supabase também é armazenado.
    //
    // Isso será importante posteriormente quando
    // migrarmos o histórico para o próprio Supabase.
    //
    // ========================================================

    const registroConferencia = {

        materialId:
            material.id,

        codigo:
            material.codigo,

        descricao:
            material.descricao,

        referencia:
            material.referencia || "",

        marca:
            material.marca || "",

        local:
            material.local || "",

        quantidadeEsperada:
            quantidadeEsperada,

        quantidadeFisica:
            quantidadeFisica,

        diferenca:
            diferenca,

        status:
            status,

        data:
            new Date().toISOString()

    };


    // ========================================================
    // ADICIONAR AO HISTÓRICO ATUAL
    // ========================================================
    //
    // Por enquanto, o histórico ainda utiliza
    // o sistema local existente.
    //
    // Depois faremos a migração desse histórico
    // para o Supabase.
    //
    // ========================================================

    if (
        !Array.isArray(
            conferencias
        )
    ) {

        conferencias = [];

    }


    conferencias.push(
        registroConferencia
    );


    // ========================================================
    // SALVAR HISTÓRICO
    // ========================================================

    salvarConferencias();


    // ========================================================
    // MOSTRAR RESULTADO
    // ========================================================

    mostrarResultadoConferencia(
        material,
        quantidadeEsperada,
        quantidadeFisica,
        diferenca,
        status,
        emoji
    );

}


// ============================================================
// FUNÇÃO: mostrarResultadoConferencia()
// ============================================================
//
// OBJETIVO:
//
// Mostrar o resultado da contagem realizada.
//
// Esta função não consulta o IndexedDB.
//
// Todos os dados utilizados vieram do material
// selecionado no Supabase.
//
// ============================================================

function mostrarResultadoConferencia(
    material,
    quantidadeEsperada,
    quantidadeFisica,
    diferenca,
    status,
    emoji
) {

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );


    if (!areaResultado) {

        return;

    }


    // ========================================================
    // LIMPAR TELA
    // ========================================================

    areaResultado.innerHTML =
        "";


    // ========================================================
    // DESCRIÇÃO
    // ========================================================

    const titulo =
        document.createElement(
            "h3"
        );

    titulo.textContent =
        material.descricao ||
        "Material";


    // ========================================================
    // CÓDIGO
    // ========================================================

    const codigo =
        document.createElement(
            "p"
        );

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );


    // ========================================================
    // REFERÊNCIA
    // ========================================================

    const referencia =
        document.createElement(
            "p"
        );

    referencia.innerHTML =
        "<strong>Referência:</strong> ";

    referencia.appendChild(
        document.createTextNode(
            material.referencia ?? "-"
        )
    );


    // ========================================================
    // ESTOQUE ESPERADO
    // ========================================================

    const esperado =
        document.createElement(
            "p"
        );

    esperado.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    esperado.appendChild(
        document.createTextNode(
            quantidadeEsperada
        )
    );


    // ========================================================
    // QUANTIDADE FÍSICA
    // ========================================================

    const fisico =
        document.createElement(
            "p"
        );

    fisico.innerHTML =
        "<strong>Quantidade física:</strong> ";

    fisico.appendChild(
        document.createTextNode(
            quantidadeFisica
        )
    );


    // ========================================================
    // DIFERENÇA
    // ========================================================

    const diferencaElemento =
        document.createElement(
            "p"
        );

    diferencaElemento.innerHTML =
        "<strong>Diferença:</strong> ";

    diferencaElemento.appendChild(
        document.createTextNode(
            diferenca
        )
    );


    // ========================================================
    // LINHA
    // ========================================================

    const linha =
        document.createElement(
            "hr"
        );


    // ========================================================
    // STATUS
    // ========================================================

    const resultado =
        document.createElement(
            "p"
        );


    const statusTexto =
        document.createElement(
            "strong"
        );

    statusTexto.textContent =
        emoji +
        " " +
        status;


    resultado.appendChild(
        statusTexto
    );


    // ========================================================
    // MENSAGEM
    // ========================================================

    const mensagem =
        document.createElement(
            "p"
        );

    mensagem.textContent =
        "📌 Contagem registrada.";


    // ========================================================
    // BOTÃO NOVA CONSULTA
    // ========================================================

    const botaoNovaConsulta =
        document.createElement(
            "button"
        );

    botaoNovaConsulta.type =
        "button";

    botaoNovaConsulta.id =
        "botaoNovaConsulta";

    botaoNovaConsulta.textContent =
        "Nova consulta";


    // ========================================================
    // EVENTO NOVA CONSULTA
    // ========================================================

    botaoNovaConsulta.addEventListener(
        "click",
        function () {

            iniciarNovaConsultaConferencia();

        }
    );


    // ========================================================
    // MONTAR RESULTADO
    // ========================================================

    areaResultado.appendChild(
        titulo
    );

    areaResultado.appendChild(
        codigo
    );

    areaResultado.appendChild(
        referencia
    );

    areaResultado.appendChild(
        esperado
    );

    areaResultado.appendChild(
        fisico
    );

    areaResultado.appendChild(
        diferencaElemento
    );

    areaResultado.appendChild(
        linha
    );

    areaResultado.appendChild(
        resultado
    );

    areaResultado.appendChild(
        mensagem
    );

    areaResultado.appendChild(
        botaoNovaConsulta
    );


    // ========================================================
    // LIMPAR MATERIAL SELECIONADO
    // ========================================================

    materialConferenciaSelecionado =
        null;


    // ========================================================
    // LIMPAR CAMPO DE PESQUISA
    // ========================================================

    const campoPesquisa =
        document.getElementById(
            "campoConferencia"
        );


    if (campoPesquisa) {

        campoPesquisa.value =
            "";

    }

}



// ============================================================
// FUNÇÃO: iniciarNovaConsultaConferencia()
// ============================================================
//
// OBJETIVO:
//
// Preparar a tela para uma nova pesquisa.
//
// ============================================================

function iniciarNovaConsultaConferencia() {

    // ========================================================
    // LIMPAR MATERIAL SELECIONADO
    // ========================================================

    materialConferenciaSelecionado =
        null;


    // ========================================================
    // LIMPAR RESULTADO
    // ========================================================

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );


    if (areaResultado) {

        areaResultado.innerHTML =
            "<p>Digite um código, descrição ou referência.</p>";

    }


    // ========================================================
    // LIMPAR CAMPO
    // ========================================================

    const campo =
        document.getElementById(
            "campoConferencia"
        );


    if (campo) {

        campo.value =
            "";

        campo.focus();

    }

}



// ============================================================
// FIM DO ARQUIVO
// ============================================================
//
// IMPORTANTE:
//
// Nesta versão:
//
// ✅ Materiais vêm do Supabase
// ✅ Pesquisa da conferência usa Supabase
// ✅ Seleção usa o registro retornado pelo Supabase
// ✅ Quantidade esperada vem do Supabase
// ✅ ID do material é preservado
// ✅ Histórico continua funcionando localmente
//
// Ainda NÃO fazemos:
//
// ❌ Gravação das conferências no Supabase
// ❌ Migração do histórico
// ❌ Remoção do IndexedDB do restante do projeto
// ❌ Alteração da importação Excel
//
// Essas serão etapas posteriores.
//
// ============================================================