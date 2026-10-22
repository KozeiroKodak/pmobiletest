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


function obterClienteSupabase() {
    if (!window.clienteSupabase) {
        throw new Error(
            "Cliente Supabase não foi inicializado."
        );
    }
    return window.clienteSupabase;
}


function escaparBuscaILike(valor) {
    return String(valor)
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
}


function limparResultado(areaResultado) {
    if (!areaResultado) {
        return;
    }
    areaResultado.innerHTML = "";
}


function estaOnline() {
    return navigator.onLine === true;
}


async function pesquisarLocalmente(
    campoPesquisa,
    buscaOriginal
) {
    try {
        if (typeof carregarMateriais === "function") {
            await carregarMateriais();
        }

        if (typeof obterMateriaisLocais !== "function") {
            throw new Error(
                "Função obterMateriaisLocais() não encontrada."
            );
        }

        const materiaisLocais =
            await obterMateriaisLocais();

        if (!Array.isArray(materiaisLocais)) {
            return [];
        }

        const busca =
            String(buscaOriginal)
                .trim()
                .toLowerCase();

        const resultados = [];

        for (
            let indice = 0;
            indice < materiaisLocais.length &&
            resultados.length < 100;
            indice++
        ) {
            const material =
                materiaisLocais[indice];

            if (!material) {
                continue;
            }

            let valorCampo = "";

            if (campoPesquisa === "codigo") {
                valorCampo =
                    material.codigo ?? "";
            } else if (campoPesquisa === "descricao") {
                valorCampo =
                    material.descricao ?? "";
            } else if (campoPesquisa === "referencia") {
                valorCampo =
                    material.referencia ?? "";
            }

            const valorNormalizado =
                String(valorCampo)
                    .trim()
                    .toLowerCase();

            const corresponde =
                campoPesquisa === "codigo"
                    ? valorNormalizado === busca
                    : valorNormalizado.includes(busca);

            if (corresponde) {
                resultados.push(material);
            }
        }

        return resultados;

    } catch (erro) {
        console.error(
            "Erro na pesquisa local:",
            erro
        );
        throw erro;
    }
}


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

    const cabecalho = document.createElement("div");
    cabecalho.className = "pesquisa-cabecalho";

    [
        "ID",
        "Descrição",
        "Referência",
        "Local",
        "Marca",
        "Quantidade",
        "Reservada"
    ].forEach(function(label) {
        const celula = document.createElement("span");
        celula.textContent = label;
        cabecalho.appendChild(celula);
    });

    const fragmento = document.createDocumentFragment();
    fragmento.appendChild(cabecalho);

    resultados.forEach(function(material) {
        const bloco = document.createElement("article");
        bloco.className = "pesquisa-item";

        const quantidadeTotal = Number(material.quantidade ?? 0);
        const quantidadeReservada = Number(
            material.quantidadeReservada ??
            material.quantidade_reservada ??
            0
        );
        const quantidadeDisponivel =
            quantidadeTotal - quantidadeReservada;

        const campos = [
            ["ID", material.codigo ?? "-", "pesquisa-id"],
            ["Descrição", material.descricao ?? "-", "pesquisa-descricao"],
            ["Referência", material.referencia ?? "-", "pesquisa-referencia"],
            ["Local", material.local ?? "-", "pesquisa-local"],
            ["Marca", material.marca ?? "-", "pesquisa-marca"],
            [
                "Quantidade",
                Number.isFinite(quantidadeDisponivel)
                    ? quantidadeDisponivel
                    : "-",
                "pesquisa-quantidade"
            ],
            [
                "Reservada",
                Number.isFinite(quantidadeReservada)
                    ? quantidadeReservada
                    : "-",
                "pesquisa-reservada"
            ]
        ];

        campos.forEach(function(campo) {
            const celula = document.createElement("div");
            celula.className =
                "pesquisa-celula " + campo[2];
            celula.setAttribute("data-label", campo[0]);
            celula.textContent = campo[1];
            bloco.appendChild(celula);
        });

        fragmento.appendChild(bloco);
    });

    areaResultado.appendChild(fragmento);
}


function alternarSeletorPesquisaMaterial() {
    const menu = document.getElementById("menuTipoBuscaPesquisaMaterial");
    const botao = document.getElementById("botaoTipoBuscaPesquisaMaterial");

    if (!menu || !botao) return;

    const aberto = menu.classList.contains("aberto");
    menu.classList.toggle("aberto", !aberto);
    botao.setAttribute("aria-expanded", aberto ? "false" : "true");
}


function selecionarTipoBuscaPesquisaMaterial(tipo) {
    const seletor = document.getElementById("tipoBuscaPesquisaMaterial");
    const botao = document.getElementById("botaoTipoBuscaPesquisaMaterial");
    const menu = document.getElementById("menuTipoBuscaPesquisaMaterial");
    const campo = document.getElementById("campoPesquisaMaterial");

    if (!seletor || !botao || !menu || !campo) return;

    const configuracoes = {
        codigo: {
            nome: "CÓD",
            placeholder: "Digite o código"
        },
        referencia: {
            nome: "REF",
            placeholder: "Digite a referência"
        },
        descricao: {
            nome: "Descrição",
            placeholder: "Digite a descrição"
        }
    };

    const configuracao = configuracoes[tipo] || configuracoes.codigo;

    seletor.value = tipo;
    botao.textContent = configuracao.nome;
    campo.placeholder = configuracao.placeholder;

    menu.classList.remove("aberto");
    botao.setAttribute("aria-expanded", "false");
    campo.focus();
}


async function pesquisarMaterialSelecionado() {
    const seletor = document.getElementById("tipoBuscaPesquisaMaterial");
    const campo = document.getElementById("campoPesquisaMaterial");
    const areaResultado = document.getElementById("resultadoPesquisaMaterial");

    if (!seletor || !campo || !areaResultado) {
        console.error("Elementos da pesquisa unificada não encontrados.");
        return;
    }

    const tipo = seletor.value || "codigo";
    const buscaOriginal = campo.value.trim();

    if (!buscaOriginal) {
        areaResultado.innerHTML = "<p>Digite um termo para pesquisar.</p>";
        campo.focus();
        return;
    }

    limparResultado(areaResultado);
    areaResultado.innerHTML = "<p>Pesquisando...</p>";

    if (!estaOnline()) {
        try {
            const resultados = await pesquisarLocalmente(tipo, buscaOriginal);
            exibirResultadosPesquisa(resultados, areaResultado);
        } catch (erro) {
            console.error("Erro na pesquisa offline:", erro);
            areaResultado.innerHTML = "<p>Erro ao consultar o banco local.</p>";
        }
        return;
    }

    try {
        const clienteSupabase = obterClienteSupabase();
        const busca = escaparBuscaILike(buscaOriginal);

        let consulta = clienteSupabase
            .from("materiais")
            .select("id,codigo,descricao,referencia,marca,local,quantidade,quantidade_reservada");

        if (tipo === "codigo") {
            consulta = consulta
                .eq("codigo", buscaOriginal)
                .order("codigo", { ascending: true });
        } else {
            const coluna = tipo === "referencia" ? "referencia" : "descricao";
            consulta = consulta
                .ilike(coluna, "%" + busca + "%", { escape: "\\" })
                .order(coluna, { ascending: true });
        }

        const { data, error } = await consulta.limit(100);

        if (error) {
            throw error;
        }

        exibirResultadosPesquisa(data || [], areaResultado);

    } catch (erro) {
        console.error("Erro na pesquisa online:", erro);

        try {
            const resultados = await pesquisarLocalmente(tipo, buscaOriginal);
            exibirResultadosPesquisa(resultados, areaResultado);
        } catch (erroLocal) {
            console.error("Erro no fallback local:", erroLocal);
            areaResultado.innerHTML =
                "<p>Não foi possível consultar o Supabase nem o banco local.</p>";
        }
    }
}


document.addEventListener("click", function(evento) {
    const menu = document.getElementById("menuTipoBuscaPesquisaMaterial");
    const botao = document.getElementById("botaoTipoBuscaPesquisaMaterial");
    const wrapper = botao?.closest(".seletor-pesquisa-material-wrapper");

    if (menu && wrapper && !wrapper.contains(evento.target)) {
        menu.classList.remove("aberto");
        botao.setAttribute("aria-expanded", "false");
    }
});


// =========================================
// FIM - PESQUISA
// =========================================
