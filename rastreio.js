// PMOBILE - Rastreio
let rastreiosPmobile = [];

function obterSessaoRastreio() {
    if (!window.usuarioPmobileAtual || !window.credencialPmobileAtual) {
        throw new Error("Sessão do PMOBILE indisponível.");
    }
    return {
        usuario: window.usuarioPmobileAtual.usuario,
        credencial: window.credencialPmobileAtual
    };
}

async function abrirRastreio() {
    mostrarTelaSistema("rastreio", "menuRastreio");
    await carregarRastreios();
}

async function carregarRastreios() {
    const lista = document.getElementById("listaRastreios");
    const status = document.getElementById("statusRastreio");
    if (!lista) return;
    lista.innerHTML = '<div class="rastreio-vazio">Carregando rastreios...</div>';
    try {
        const sessao = obterSessaoRastreio();
        const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_listar", {
            p_usuario: sessao.usuario,
            p_credencial: sessao.credencial,
            p_limit: 500,
            p_offset: 0
        });
        if (resposta.error) throw resposta.error;
        rastreiosPmobile = Array.isArray(resposta.data) ? resposta.data : [];
        if (status) status.textContent = rastreiosPmobile.length + " rastreio(s)";
        filtrarRastreios();
    } catch (erro) {
        console.error("Erro ao carregar Rastreio:", erro);
        lista.innerHTML = '<div class="rastreio-erro">' + escaparHtmlRastreio(erro.message || "Não foi possível carregar os rastreios.") + '</div>';
    }
}

function statusVisualRastreio(item) {
    if (item.status !== "ENTREGUE" && item.status !== "CANCELADO" && item.previsao_entrega && new Date(item.previsao_entrega).getTime() < Date.now()) {
        return "ATRASADO";
    }
    return item.status || "PENDENTE";
}

function filtrarRastreios() {
    const lista = document.getElementById("listaRastreios");
    if (!lista) return;
    const termo = String(document.getElementById("buscaRastreio")?.value || "").trim().toLowerCase();
    const filtro = document.getElementById("filtroStatusRastreio")?.value || "";
    const itens = rastreiosPmobile.filter(function(item) {
        const status = statusVisualRastreio(item);
        const texto = [item.cliente,item.notas_fiscais,item.motorista,item.transportadora,item.regiao].join(" ").toLowerCase();
        return (!termo || texto.includes(termo)) && (!filtro || status === filtro);
    });
    if (!itens.length) {
        lista.innerHTML = '<div class="rastreio-vazio"><strong>Nenhum rastreio encontrado.</strong><span>Os registros importados aparecerão aqui.</span></div>';
        return;
    }
    lista.innerHTML = itens.map(renderizarRastreio).join("");
}

function renderizarRastreio(item) {
    const status = statusVisualRastreio(item);
    const previsao = item.previsao_entrega ? new Date(item.previsao_entrega).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : "-";
    return '<article class="rastreio-card" data-status="' + status + '">' +
        '<div class="rastreio-card-topo"><strong>' + escaparHtmlRastreio(item.cliente) + '</strong><span class="rastreio-etiqueta">' + escaparHtmlRastreio(status.replaceAll("_"," ")) + '</span></div>' +
        '<div class="rastreio-nfs">NF: ' + escaparHtmlRastreio(item.notas_fiscais) + '</div>' +
        '<div class="rastreio-grade">' +
          '<span><small>Transportadora</small>' + escaparHtmlRastreio(item.transportadora) + '</span>' +
          '<span><small>Motorista</small>' + escaparHtmlRastreio(item.motorista || "-") + '</span>' +
          '<span><small>Destino</small>' + escaparHtmlRastreio(item.regiao || "-") + '</span>' +
          '<span><small>Turno</small>' + escaparHtmlRastreio(item.turno || "-") + '</span>' +
          '<span><small>Previsão</small>' + escaparHtmlRastreio(previsao) + '</span>' +
          '<span><small>Conferência</small>' + escaparHtmlRastreio(item.conferencia || "PENDENTE") + '</span>' +
        '</div></article>';
}

function escaparHtmlRastreio(valor) {
    return String(valor ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
