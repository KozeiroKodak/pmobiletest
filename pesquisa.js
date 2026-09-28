// =========================================
// PMOBILE - PESQUISA
// =========================================
// Pesquisa de materiais.
//
// FONTE DOS DADOS:
//
// ONLINE:
// Supabase = fonte central
//
// OFFLINE:
// IndexedDB = cópia local
//
// Campos de pesquisa:
// 1. Código
// 2. Descrição
// 3. Referência
//
// Marca, Local e Quantidade NÃO são campos
// de pesquisa. São apenas exibidos no resultado.
// =========================================


// =========================================
// VERIFICAÇÃO DO SUPABASE
// =========================================

function obterClienteSupabase() {

    if (!window.clienteSupabase) {
        throw new Error(
            "Cliente Supabase não foi inicializado."
        );
    }

    return window.clienteSupabase;
}


// =========================================
// PROTEÇÃO PARA CONSULTA ILIKE
// =========================================
// Escapa caracteres especiais usados pelo ILIKE:
//
// % = qualquer sequência
// _ = qualquer caractere
// \ = caractere de escape
//
// Assim, uma pesquisa como "50%" procura
// literalmente "50%" em vez de usar % como curinga.
// =========================================

function escaparBuscaILike(valor) {

    return String(valor)
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
}


// =========================================
// LIMPAR ÁREA DE RESULTADO
// =========================================

function limparResultado(areaResultado) {

    if (!areaResultado) {
        return;
    }

    areaResultado.innerHTML = "";
}


// =========================================
// VERIFICAR CONEXÃO
// =========================================
// navigator.onLine indica se o navegador
// considera que existe conexão de rede.
//
// IMPORTANTE:
// estar "online" não garante que o Supabase
// esteja acessível.
//
// Por isso, no modo online tentamos primeiro
// o Supabase. Se a consulta falhar, fazemos
// fallback para o IndexedDB local.
// =========================================

function estaOnline() {

    return navigator.onLine === true;

}


// =========================================
// PESQUISA LOCAL
// =========================================
// OBJETIVO:
//
// Pesquisar no IndexedDB utilizando os materiais
// carregados pela camada dados.js.
//
// CAMPOS:
//
// - código
// - descrição
// - referência
//
// A pesquisa é feita sem diferenciar maiúsculas
// e minúsculas.
//
// =========================================

async function pesquisarLocalmente(
    campoPesquisa,
    buscaOriginal
) {

    try {

        // =====================================
        // GARANTIR QUE OS DADOS LOCAIS
        // ESTEJAM CARREGADOS
        // =====================================

        if (
            typeof carregarMateriais === "function"
        ) {

            await carregarMateriais();

        }


        // =====================================
        // OBTER MATERIAIS LOCAIS
        // =====================================

        if (
            typeof obterMateriaisLocais !== "function"
        ) {

            throw new Error(
                "Função obterMateriaisLocais() não encontrada."
            );

        }


        const materiaisLocais =
            await obterMateriaisLocais();


        if (
            !Array.isArray(materiaisLocais)
        ) {

            return [];

        }


        // =====================================
        // NORMALIZAR TEXTO DA PESQUISA
        // =====================================

        const busca =
            String(buscaOriginal)
                .trim()
                .toLowerCase();


        // =====================================
        // FILTRAR RESULTADOS
        // =====================================

        return materiaisLocais.filter(
            function(material) {

                if (!material) {
                    return false;
                }


                let valorCampo = "";


                if (
                    campoPesquisa === "codigo"
                ) {

                    valorCampo =
                        material.codigo ?? "";

                }


                if (
                    campoPesquisa === "descricao"
                ) {

                    valorCampo =
                        material.descricao ?? "";

                }


                if (
                    campoPesquisa === "referencia"
                ) {

                    valorCampo =
                        material.referencia ?? "";

                }


                return String(valorCampo)
                    .toLowerCase()
                    .includes(busca);

            }
        );


    } catch (erro) {

        console.error(
            "Erro na pesquisa local:",
            erro
        );

        throw erro;

    }

}


// =========================================
// EXIBIR RESULTADOS
// =========================================

function exibirResultadosPesquisa(
    resultados,
    areaResultado
) {

    if (!areaResultado) {
        return;
    }


    limparResultado(areaResultado);


    if (
        !Array.isArray(resultados) ||
        resultados.length === 0
    ) {

        areaResultado.innerHTML =
            "<p>Nenhum material encontrado.</p>";

        return;

    }


    const fragmento =
        document.createDocumentFragment();


    resultados.forEach(
        function(material) {

            const bloco =
                document.createElement("div");


            const linha =
                document.createElement("hr");


            const titulo =
                document.createElement("h3");

            titulo.textContent =
                material.descricao ||
                "Material";


            const codigo =
                document.createElement("p");

            codigo.innerHTML =
                "<strong>Código:</strong> ";

            codigo.appendChild(
                document.createTextNode(
                    material.codigo ?? "-"
                )
            );


            const referencia =
                document.createElement("p");

            referencia.innerHTML =
                "<strong>Referência:</strong> ";

            referencia.appendChild(
                document.createTextNode(
                    material.referencia ?? "-"
                )
            );


            const local =
                document.createElement("p");

            local.innerHTML =
                "<strong>Local:</strong> ";

            local.appendChild(
                document.createTextNode(
                    material.local ?? "-"
                )
            );


            const marca =
                document.createElement("p");

            marca.innerHTML =
                "<strong>Marca:</strong> ";

            marca.appendChild(
                document.createTextNode(
                    material.marca ?? "-"
                )
            );


            const quantidade =
                document.createElement("p");

            quantidade.innerHTML =
                "<strong>Quantidade:</strong> ";

            quantidade.appendChild(
                document.createTextNode(
                    material.quantidade ?? "-"
                )
            );


            bloco.appendChild(linha);
            bloco.appendChild(titulo);
            bloco.appendChild(codigo);
            bloco.appendChild(referencia);
            bloco.appendChild(local);
            bloco.appendChild(marca);
            bloco.appendChild(quantidade);


            fragmento.appendChild(bloco);

        }
    );


    areaResultado.appendChild(
        fragmento
    );

}


// =========================================
// PESQUISA POR CÓDIGO
// =========================================

async function pesquisarPorCodigo() {

    const campo =
        document.getElementById(
            "campoPesquisaCodigo"
        );

    const areaResultado =
        document.getElementById(
            "resultadoPesquisaCodigo"
        );


    if (!campo || !areaResultado) {

        console.error(
            "Elementos da pesquisa por código não encontrados."
        );

        return;

    }


    const buscaOriginal =
        campo.value.trim();


    if (!buscaOriginal) {

        areaResultado.innerHTML =
            "<p>Digite um código para pesquisar.";

        return;

    }


    limparResultado(areaResultado);

    areaResultado.innerHTML =
        "<p>Pesquisando...</p>";


    // =====================================
    // MODO OFFLINE
    // =====================================

    if (!estaOnline()) {

        try {

            const resultados =
                await pesquisarLocalmente(
                    "codigo",
                    buscaOriginal
                );


            exibirResultadosPesquisa(
                resultados,
                areaResultado
            );


        } catch (erro) {

            console.error(
                "Erro na pesquisa offline por código:",
                erro
            );


            areaResultado.innerHTML =
                "<p>Erro ao consultar o banco local.</p>";

        }


        return;

    }


    // =====================================
    // MODO ONLINE
    // =====================================

    const busca =
        escaparBuscaILike(
            buscaOriginal
        );


    try {

        const clienteSupabase =
            obterClienteSupabase();


        const { data, error } =
            await clienteSupabase

                .from("materiais")

                .select(
                    "id,codigo,descricao,referencia,marca,local,quantidade"
                )

                .ilike(
                    "codigo",
                    "%" + busca + "%",
                    {
                        escape: "\\"
                    }
                )

                .order(
                    "codigo",
                    {
                        ascending: true
                    }
                );


        if (error) {
            throw error;
        }


        exibirResultadosPesquisa(
            data || [],
            areaResultado
        );


        // =====================================
        // ATUALIZAR CÓPIA LOCAL
        // =====================================
        //
        // A pesquisa retorna apenas os materiais
        // encontrados.
        //
        // NÃO substituímos o inventário local
        // por esses resultados.
        //
        // A cópia local deve continuar representando
        // o inventário completo.
        //
        // Portanto, nenhuma gravação local é feita
        // apenas por uma pesquisa individual.
        //
        // =====================================


    } catch (erro) {

        console.error(
            "Erro na pesquisa online por código:",
            erro
        );


        // =====================================
        // FALLBACK PARA INDEXEDDB
        // =====================================

        try {

            console.warn(
                "Supabase indisponível. Tentando pesquisa local."
            );


            const resultados =
                await pesquisarLocalmente(
                    "codigo",
                    buscaOriginal
                );


            exibirResultadosPesquisa(
                resultados,
                areaResultado
            );


        } catch (erroLocal) {

            console.error(
                "Erro no fallback local:",
                erroLocal
            );


            areaResultado.innerHTML =
                "<p>Não foi possível consultar o Supabase nem o banco local.</p>";

        }

    }

}


// =========================================
// PESQUISA POR DESCRIÇÃO
// =========================================

async function pesquisarPorDescricao() {

    const campo =
        document.getElementById(
            "campoPesquisaDescricao"
        );

    const areaResultado =
        document.getElementById(
            "resultadoPesquisaDescricao"
        );


    if (!campo || !areaResultado) {

        console.error(
            "Elementos da pesquisa por descrição não encontrados."
        );

        return;

    }


    const buscaOriginal =
        campo.value.trim();


    if (!buscaOriginal) {

        areaResultado.innerHTML =
            "<p>Digite uma descrição para pesquisar.</p>";

        return;

    }


    limparResultado(areaResultado);

    areaResultado.innerHTML =
        "<p>Pesquisando...</p>";


    // =====================================
    // MODO OFFLINE
    // =====================================

    if (!estaOnline()) {

        try {

            const resultados =
                await pesquisarLocalmente(
                    "descricao",
                    buscaOriginal
                );


            exibirResultadosPesquisa(
                resultados,
                areaResultado
            );


        } catch (erro) {

            console.error(
                "Erro na pesquisa offline por descrição:",
                erro
            );


            areaResultado.innerHTML =
                "<p>Erro ao consultar o banco local.</p>";

        }


        return;

    }


    // =====================================
    // MODO ONLINE
    // =====================================

    const busca =
        escaparBuscaILike(
            buscaOriginal
        );


    try {

        const clienteSupabase =
            obterClienteSupabase();


        const { data, error } =
            await clienteSupabase

                .from("materiais")

                .select(
                    "id,codigo,descricao,referencia,marca,local,quantidade"
                )

                .ilike(
                    "descricao",
                    "%" + busca + "%",
                    {
                        escape: "\\"
                    }
                )

                .order(
                    "descricao",
                    {
                        ascending: true
                    }
                );


        if (error) {
            throw error;
        }


        exibirResultadosPesquisa(
            data || [],
            areaResultado
        );


    } catch (erro) {

        console.error(
            "Erro na pesquisa online por descrição:",
            erro
        );


        // =====================================
        // FALLBACK PARA INDEXEDDB
        // =====================================

        try {

            console.warn(
                "Supabase indisponível. Tentando pesquisa local."
            );


            const resultados =
                await pesquisarLocalmente(
                    "descricao",
                    buscaOriginal
                );


            exibirResultadosPesquisa(
                resultados,
                areaResultado
            );


        } catch (erroLocal) {

            console.error(
                "Erro no fallback local:",
                erroLocal
            );


            areaResultado.innerHTML =
                "<p>Não foi possível consultar o Supabase nem o banco local.</p>";

        }

    }

}


// =========================================
// PESQUISA POR REFERÊNCIA
// =========================================

async function pesquisarPorReferencia() {

    const campo =
        document.getElementById(
            "campoPesquisaReferencia"
        );

    const areaResultado =
        document.getElementById(
            "resultadoPesquisaReferencia"
        );


    if (!campo || !areaResultado) {

        console.error(
            "Elementos da pesquisa por referência não encontrados."
        );

        return;

    }


    const buscaOriginal =
        campo.value.trim();


    if (!buscaOriginal) {

        areaResultado.innerHTML =
            "<p>Digite uma referência para pesquisar.</p>";

        return;

    }


    limparResultado(areaResultado);

    areaResultado.innerHTML =
        "<p>Pesquisando...</p>";


    // =====================================
    // MODO OFFLINE
    // =====================================

    if (!estaOnline()) {

        try {

            const resultados =
                await pesquisarLocalmente(
                    "referencia",
                    buscaOriginal
                );


            exibirResultadosPesquisa(
                resultados,
                areaResultado
            );


        } catch (erro) {

            console.error(
                "Erro na pesquisa offline por referência:",
                erro
            );


            areaResultado.innerHTML =
                "<p>Erro ao consultar o banco local.</p>";

        }


        return;

    }


    // =====================================
    // MODO ONLINE
    // =====================================

    const busca =
        escaparBuscaILike(
            buscaOriginal
        );


    try {

        const clienteSupabase =
            obterClienteSupabase();


        const { data, error } =
            await clienteSupabase

                .from("materiais")

                .select(
                    "id,codigo,descricao,referencia,marca,local,quantidade"
                )

                .ilike(
                    "referencia",
                    "%" + busca + "%",
                    {
                        escape: "\\"
                    }
                )

                .order(
                    "referencia",
                    {
                        ascending: true
                    }
                );


        if (error) {
            throw error;
        }


        exibirResultadosPesquisa(
            data || [],
            areaResultado
        );


    } catch (erro) {

        console.error(
            "Erro na pesquisa online por referência:",
            erro
        );


        // =====================================
        // FALLBACK PARA INDEXEDDB
        // =====================================

        try {

            console.warn(
                "Supabase indisponível. Tentando pesquisa local."
            );


            const resultados =
                await pesquisarLocalmente(
                    "referencia",
                    buscaOriginal
                );


            exibirResultadosPesquisa(
                resultados,
                areaResultado
            );


        } catch (erroLocal) {

            console.error(
                "Erro no fallback local:",
                erroLocal
            );


            areaResultado.innerHTML =
                "<p>Não foi possível consultar o Supabase nem o banco local.</p>";

        }

    }

}


// =========================================
// FIM - PESQUISA
// =========================================
