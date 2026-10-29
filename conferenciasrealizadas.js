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

const estadoVisualConferencias = {
    registros: [],
    filtro: "todas",
    busca: "",
    expandidas: new Set(),
    aviso: ""
};

function chaveVisualConferencia(registro, indice) {
    return String(registro.tipo) + ":" + String(registro.id ?? registro.conferenciaId ?? indice);
}

function numeroVisualConferencia(valor) {
    return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function textoVisualConferencia(valor) {
    return escaparHTMLConferencias(valor === null || valor === undefined || valor === "" ? "Não informado" : valor);
}

function pesquisarTextoConferencia(valor) {
    return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Renderização isolada: filtros não disparam consultas nem modificam o histórico.
function renderizarListaVisualConferencias() {
    const area = document.getElementById("resultadoConferencias");
    if (!area) return;

    const registros = estadoVisualConferencias.registros;
    const totalOk = registros.filter(item => item.quantidadeFisica === item.quantidadeEsperada).length;
    const totalDivergencias = registros.length - totalOk;

    const resumo = area.querySelector(".conferencias-resumo");
    const lista = area.querySelector(".conferencias-lista");
    const aviso = area.querySelector(".conferencias-aviso");
    if (!resumo || !lista || !aviso) return;

    resumo.innerHTML =
        '<div class="conferencias-indicador"><span>Total</span><strong>' + registros.length + '</strong></div>' +
        '<div class="conferencias-indicador indicador-ok"><span>OK</span><strong>' + totalOk + '</strong></div>' +
        '<div class="conferencias-indicador indicador-divergencia"><span>Divergências</span><strong>' + totalDivergencias + '</strong></div>';

    aviso.textContent = estadoVisualConferencias.aviso;
    aviso.hidden = !estadoVisualConferencias.aviso;

    area.querySelectorAll("[data-filtro-conferencias]").forEach(botao => {
        const ativo = botao.dataset.filtroConferencias === estadoVisualConferencias.filtro;
        botao.classList.toggle("ativo", ativo);
        botao.setAttribute("aria-pressed", String(ativo));
    });

    const termo = pesquisarTextoConferencia(estadoVisualConferencias.busca.trim());
    const filtrados = registros.filter(item => {
        const diferenca = item.quantidadeFisica - item.quantidadeEsperada;
        if (estadoVisualConferencias.filtro === "ok" && diferenca !== 0) return false;
        if (estadoVisualConferencias.filtro === "divergencias" && diferenca === 0) return false;
        if (!termo) return true;
        const busca = [
            item.codigo, item.descricao, item.referencia,
            item.localOriginal, item.localEncontrado, item.usuarioNome
        ].map(pesquisarTextoConferencia).join(" ");
        return busca.includes(termo);
    });

    if (!filtrados.length) {
        lista.innerHTML = '<p class="conferencias-vazio">' +
            (registros.length ? 'Nenhuma conferência encontrada para os filtros selecionados.' : 'Nenhuma contagem registrada ainda.') +
            '</p>';
        return;
    }

    lista.innerHTML = filtrados.map(item => {
        const indice = registros.indexOf(item);
        const chave = chaveVisualConferencia(item, indice);
        const diferenca = item.quantidadeFisica - item.quantidadeEsperada;
        const divergente = diferenca !== 0;
        const status = divergente ? "Divergência" : "OK";
        const statusClass = divergente ? "status-divergencia" : "status-ok";
        const diferencaTexto = (diferenca > 0 ? "+" : "") + numeroVisualConferencia(diferenca);
        const tipoDiferenca = diferenca > 0 ? "Sobra" : diferenca < 0 ? "Falta" : "Conferido";
        const origem = item.tipo === "manual" ? "Contagem manual" : "Conferência anterior";
        const situacao = item.tipo === "manual"
            ? (item.bloqueadoPorLimpeza ? "Revisão necessária" : item.sincronizado ? "Sincronizada" : "Pendente")
            : "Não informada";
        const data = item.data ? formatarDataConferencia(item.data) : "Data não informada";

        return '<details class="registro-conferencia" data-chave-conferencia="' + escaparHTMLConferencias(chave) + '"' +
            (estadoVisualConferencias.expandidas.has(chave) ? ' open' : '') + '>' +
            '<summary class="registro-conferencia-resumo">' +
                '<div class="registro-conferencia-topo">' +
                    '<div class="registro-conferencia-produto">' +
                        '<h3>' + textoVisualConferencia(item.descricao || "Material") + '</h3>' +
                        '<p>Cód. ' + textoVisualConferencia(item.codigo) + ' · Ref. ' + textoVisualConferencia(item.referencia) + '</p>' +
                    '</div>' +
                    '<span class="registro-conferencia-status ' + statusClass + '">' +
                        (divergente ? '<span aria-hidden="true">✕</span> ' : '<span aria-hidden="true">✓</span> ') + status +
                    '</span>' +
                '</div>' +
                '<div class="registro-conferencia-local">' +
                    '<span class="registro-conferencia-rotulo">LOCALIZAÇÃO</span>' +
                    '<div class="registro-conferencia-trajeto">' +
                        '<div class="registro-conferencia-endereco"><span>De</span><strong>' + textoVisualConferencia(item.localOriginal) + '</strong></div>' +
                        '<span class="registro-conferencia-seta" aria-hidden="true">→</span>' +
                        '<div class="registro-conferencia-endereco"><span>Para</span><strong>' + textoVisualConferencia(item.localEncontrado) + '</strong></div>' +
                    '</div>' +
                '</div>' +
                '<div class="registro-conferencia-quantidades">' +
                    '<div><span>Esperado</span><strong>' + numeroVisualConferencia(item.quantidadeEsperada) + '</strong></div>' +
                    '<div><span>Físico</span><strong>' + numeroVisualConferencia(item.quantidadeFisica) + '</strong></div>' +
                    '<div><span>Diferença</span><strong class="' + (divergente ? 'valor-divergencia' : 'valor-ok') + '">' + diferencaTexto + '</strong>' +
                        '<small>' + tipoDiferenca + '</small></div>' +
                '</div>' +
                '<div class="registro-conferencia-responsavel">' +
                    '<span class="registro-conferencia-icone" aria-hidden="true">👤</span>' +
                    '<div><span>Contagem realizada por</span><strong>' + textoVisualConferencia(item.usuarioNome) + '</strong></div>' +
                '</div>' +
                '<span class="registro-conferencia-expandir"><span class="rotulo-fechado">Ver mais detalhes</span>' +
                    '<span class="rotulo-aberto">Ocultar detalhes</span><span class="seta-expandir" aria-hidden="true">⌄</span></span>' +
            '</summary>' +
            '<div class="registro-conferencia-detalhes">' +
                '<dl>' +
                    '<div><dt>Origem da conferência</dt><dd>' + origem + '</dd></div>' +
                    '<div><dt>Data/hora</dt><dd>' + textoVisualConferencia(data) + '</dd></div>' +
                    '<div><dt>Sincronização</dt><dd>' + situacao + '</dd></div>' +
                '</dl>' +
            '</div>' +
        '</details>';
    }).join("");
}

function prepararInterfaceVisualConferencias() {
    const area = document.getElementById("resultadoConferencias");
    if (!area) return;

    if (!area.querySelector(".conferencias-conteudo")) {
        area.innerHTML =
            '<div class="conferencias-conteudo">' +
                '<div class="conferencias-resumo" aria-label="Resumo das conferências"></div>' +
                '<div class="conferencias-ferramentas">' +
                    '<label for="buscaHistoricoConferencias">Buscar conferência</label>' +
                    '<input type="search" id="buscaHistoricoConferencias" autocomplete="off" placeholder="Produto, código, local ou responsável..." />' +
                    '<div class="conferencias-filtros" role="group" aria-label="Filtrar por resultado">' +
                        '<button type="button" data-filtro-conferencias="todas">Todas</button>' +
                        '<button type="button" data-filtro-conferencias="ok">OK</button>' +
                        '<button type="button" data-filtro-conferencias="divergencias">Divergências</button>' +
                    '</div>' +
                '</div>' +
                '<p class="conferencias-aviso" role="status" hidden></p>' +
                '<div class="conferencias-lista"></div>' +
            '</div>';
    }

    const busca = area.querySelector("#buscaHistoricoConferencias");
    if (busca && busca.value !== estadoVisualConferencias.busca) {
        busca.value = estadoVisualConferencias.busca;
    }

    if (area.dataset.eventosConferenciasAtivos !== "sim") {
        area.dataset.eventosConferenciasAtivos = "sim";

        area.addEventListener("input", evento => {
            if (evento.target.id === "buscaHistoricoConferencias") {
                estadoVisualConferencias.busca = evento.target.value;
                renderizarListaVisualConferencias();
            }
        });

        area.addEventListener("click", evento => {
            const botao = evento.target.closest("[data-filtro-conferencias]");
            if (!botao || !area.contains(botao)) return;
            estadoVisualConferencias.filtro = botao.dataset.filtroConferencias;
            renderizarListaVisualConferencias();
        });

        // 'toggle' não faz bubbling; capture mantém os cartões abertos ao filtrar/atualizar.
        area.addEventListener("toggle", evento => {
            const detalhes = evento.target;
            if (!detalhes.matches?.("details[data-chave-conferencia]")) return;
            const chave = detalhes.dataset.chaveConferencia;
            if (detalhes.open) estadoVisualConferencias.expandidas.add(chave);
            else estadoVisualConferencias.expandidas.delete(chave);
        }, true);
    }
}

// Mantém a integração original com contagens manuais, histórico legado e Supabase.
async function exibirConferencias() {
    const area = document.getElementById("resultadoConferencias");
    if (!area) return;
    if (!area.querySelector(".conferencias-conteudo")) {
        area.textContent = "Carregando histórico de contagens...";
    }

    let manuais = [];
    let legadas = [];
    let aviso = "";

    try {
        if (typeof atualizarContagensManuais === "function" && navigator.onLine) {
            await atualizarContagensManuais();
        }
        if (typeof lerContagensManuais === "function") {
            manuais = await lerContagensManuais();
        }
    } catch (erro) {
        console.warn("Histórico manual indisponível:", erro);
        aviso = "Não foi possível consultar as contagens manuais.";
    }

    try {
        if (typeof carregarConferencias === "function") {
            await carregarConferencias();
            legadas = Array.isArray(conferencias) ? conferencias : [];
        }
    } catch (erro) {
        console.warn("Histórico legado indisponível:", erro);
        aviso += " Histórico antigo indisponível no momento.";
    }

    const normalizadas = [];
    const ids = new Set();
    const adicionar = item => {
        const chave = String(item.id || item.conferenciaId || "");
        if (chave && ids.has(chave)) return;
        if (chave) ids.add(chave);
        normalizadas.push(item);
    };

    manuais.forEach(x => adicionar({
        id: x.id, tipo: "manual", codigo: x.codigo, descricao: x.descricao,
        referencia: x.referencia,
        quantidadeEsperada: Number(x.quantidadeEsperada || 0),
        quantidadeFisica: Number(x.quantidadeFisica || 0),
        localOriginal: x.localOriginal, localEncontrado: x.localEncontrado,
        usuarioNome: x.usuarioNome, data: x.dataHora,
        sincronizado: x.sincronizado, bloqueadoPorLimpeza: x.bloqueadoPorLimpeza
    }));

    legadas.forEach(x => adicionar({
        id: x.conferenciaId || x.id, tipo: "legado",
        codigo: x.codigo_material ?? x.codigo,
        descricao: x.descricao_material ?? x.descricao,
        referencia: x.referencia_material ?? x.referencia,
        quantidadeEsperada: Number(x.quantidade_esperada ?? x.quantidadeEsperada ?? 0),
        quantidadeFisica: Number(x.quantidade_fisica ?? x.quantidadeFisica ?? 0),
        // Registros antigos só exibem local quando esta informação foi salva.
        localOriginal: x.localOriginal ?? x.local_original,
        localEncontrado: x.localEncontrado ?? x.local_encontrado,
        usuarioNome: x.usuario_nome ?? x.usuarioNome,
        data: x.criado_em ?? x.criadoEm ?? x.data
    }));

    normalizadas.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    estadoVisualConferencias.registros = normalizadas;
    estadoVisualConferencias.aviso = aviso.trim();
    prepararInterfaceVisualConferencias();
    renderizarListaVisualConferencias();
}
