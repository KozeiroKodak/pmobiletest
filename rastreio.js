// PMOBILE - Rastreio
let rastreiosPmobile = [];
let limiteExibicaoRastreios = 100;

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
    if (!window.usuarioPmobileAtual || !["ADMIN", "NIVEL2"].includes(window.usuarioPmobileAtual.nivel)) {
        alert("Acesso negado.");
        return;
    }
    mostrarTelaSistema("rastreio", "menuRastreio");
    // A sessão pode ser estabelecida após o DOMContentLoaded.
    // Reavaliar a permissão ao abrir evita ocultar os controles para ADMIN.
    if (typeof atualizarAcessoAdminRastreio === "function") {
        atualizarAcessoAdminRastreio();
    }
    await carregarRastreios();
}

async function carregarRastreios() {
    const lista = document.getElementById("listaRastreios");
    const status = document.getElementById("statusRastreio");
    if (!lista) return;
    lista.innerHTML = '<div class="rastreio-vazio">Carregando rastreios...</div>';
    try {
        const sessao = obterSessaoRastreio();
        const registros = [];
        const tamanhoPagina = 500;
        for (let deslocamento = 0; ; deslocamento += tamanhoPagina) {
            const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_listar", {
                p_usuario: sessao.usuario,
                p_credencial: sessao.credencial,
                p_limit: tamanhoPagina,
                p_offset: deslocamento
            });
            if (resposta.error) throw resposta.error;
            const pagina = Array.isArray(resposta.data) ? resposta.data : [];
            registros.push(...pagina.filter(item => !/^TOTAL(?:\s*GERAL)?$/i.test(String(item.transportadora || "").trim()) && !/^TOTAL(?:\s*GERAL)?$/i.test(String(item.cliente || "").trim())));
            if (status) status.textContent = "Carregando rastreios: " + registros.length.toLocaleString("pt-BR") + "...";
            if (pagina.length < tamanhoPagina) break;
        }
        rastreiosPmobile = registros;
        limiteExibicaoRastreios = 100;
        if (status) status.textContent = rastreiosPmobile.length.toLocaleString("pt-BR") + " rastreio(s)";
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
    const visiveis = itens.slice(0, limiteExibicaoRastreios);
    lista.innerHTML = visiveis.map(renderizarRastreio).join("");
    if (itens.length > visiveis.length) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "rastreio-carregar-mais";
        botao.textContent = "Mostrar mais 100 (" + visiveis.length.toLocaleString("pt-BR") + " de " + itens.length.toLocaleString("pt-BR") + ")";
        botao.style.cssText = "display:block;width:100%;padding:16px;margin:16px 0;background:#232323;color:#fff;border:1px solid #444;border-radius:12px;cursor:pointer";
        botao.onclick = () => { limiteExibicaoRastreios += 100; filtrarRastreios(); };
        lista.appendChild(botao);
    }
}

function renderizarRastreio(item) {
    const status = statusVisualRastreio(item);
    const previsao = item.previsao_entrega ? new Date(item.previsao_entrega).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : "-";
    return '<article class="rastreio-card" data-status="' + status + '">' +
        '<div class="rastreio-card-topo"><strong>' + escaparHtmlRastreio(item.cliente) + '</strong><span class="rastreio-etiqueta">' + escaparHtmlRastreio(status.replaceAll("_"," ")) + '</span></div>' +
        '<button type="button" class="rastreio-nfs rastreio-nfs-detalhes" onclick="abrirDetalhesRastreio(\'' + escaparAtributoRastreio(item.id) + '\')" aria-haspopup="dialog">' +
            '<span>NF: ' + escaparHtmlRastreio(item.notas_fiscais) + '</span><small>Ver detalhes</small>' +
        '</button>' +
        '<div class="rastreio-grade" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:14px">' +
          '<span><small>Destino</small>' + escaparHtmlRastreio(item.regiao || "—") + '</span>' +
          '<span><small>Volumes</small>' + escaparHtmlRastreio(formatarQuantidadeRastreio(item.volume)) + '</span>' +
          '<span><small>Turno</small>' + escaparHtmlRastreio(item.turno || "—") + '</span>' +
          '<span><small>Peso</small>' + escaparHtmlRastreio(formatarQuantidadeRastreio(item.peso)) + '</span>' +
          '<span><small>Frete embutido</small>' + escaparHtmlRastreio(formatarMoedaRastreioSeguro(item.valor_frete_embutido)) + '</span>' +
          '<span><small>Valor do frete</small>' + escaparHtmlRastreio(formatarMoedaRastreioSeguro(item.valor_frete)) + '</span>' +
        '</div>' +
        '</article>';
}

function formatarQuantidadeRastreio(v) { return v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", {maximumFractionDigits:3}); }
function formatarMoedaRastreioSeguro(v) { return v == null || v === "" ? "—" : formatarMoedaRastreio(v); }

function escaparHtmlRastreio(valor) {
    return String(valor ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}


function escaparAtributoRastreio(valor) {
    return escaparHtmlRastreio(valor).replaceAll("`", "&#96;");
}

function formatarValorRastreio(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero)
        ? numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";
}

function formatarMoedaRastreio(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero)
        ? numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "—";
}

function abrirDetalhesRastreio(id) {
    const item = rastreiosPmobile.find(registro => String(registro.id) === String(id));
    if (!item) return;

    let modal = document.getElementById("rastreioDetalhesModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "rastreioDetalhesModal";
        modal.className = "rastreio-detalhes-modal";
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML =
            '<div class="rastreio-detalhes-caixa" role="dialog" aria-modal="true" aria-labelledby="rastreioDetalhesTitulo">' +
                '<div class="rastreio-detalhes-cabecalho">' +
                    '<div><span>Rastreio</span><h2 id="rastreioDetalhesTitulo">Detalhes da NF</h2></div>' +
                    '<button type="button" class="rastreio-detalhes-fechar" aria-label="Fechar">×</button>' +
                '</div>' +
                '<div id="rastreioDetalhesConteudo" class="rastreio-detalhes-grade"></div>' +
            '</div>';
        document.body.appendChild(modal);

        modal.addEventListener("click", evento => {
            if (evento.target === modal) fecharDetalhesRastreio();
        });
        modal.querySelector(".rastreio-detalhes-fechar")
            .addEventListener("click", fecharDetalhesRastreio);
    }

    const titulo = modal.querySelector("#rastreioDetalhesTitulo");
    const conteudo = modal.querySelector("#rastreioDetalhesConteudo");
    titulo.textContent = "NF " + (item.notas_fiscais || "—");

    conteudo.innerHTML =
        '<div><small>Volume</small><strong>' + escaparHtmlRastreio(formatarValorRastreio(item.volume)) + '</strong></div>' +
        '<div><small>Peso</small><strong>' + escaparHtmlRastreio(formatarValorRastreio(item.peso)) + '</strong></div>' +
        '<div><small>Valor da nota</small><strong>' + escaparHtmlRastreio(formatarMoedaRastreio(item.valor_nf)) + '</strong></div>' +
        '<div><small>Valor do frete embutido</small><strong>' + escaparHtmlRastreio(formatarMoedaRastreio(item.valor_frete_embutido)) + '</strong></div>' +
        '<div><small>Valor do frete</small><strong>' + escaparHtmlRastreio(formatarMoedaRastreio(item.valor_frete)) + '</strong></div>';

    modal.classList.add("aberto");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("rastreio-modal-aberto");
}

function fecharDetalhesRastreio() {
    const modal = document.getElementById("rastreioDetalhesModal");
    if (!modal) return;
    modal.classList.remove("aberto");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("rastreio-modal-aberto");
}


function abrirPopupStatusRastreio() {
    const seletor = document.getElementById("filtroStatusRastreio");
    const botao = document.getElementById("botaoFiltroStatusRastreio");
    if (!seletor || !botao || typeof abrirPopupEscolhaSelect !== "function") return;

    abrirPopupEscolhaSelect({
        idSelect: "filtroStatusRastreio",
        titulo: "Filtrar por status",
        aoEscolher: function(valor) {
            const opcao = seletor.options[seletor.selectedIndex];
            botao.textContent = opcao ? opcao.textContent : "Todos os status";
            botao.setAttribute("aria-expanded", "false");
            filtrarRastreios();
        }
    });
    botao.setAttribute("aria-expanded", "true");
}
