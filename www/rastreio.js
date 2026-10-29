// PMOBILE - Rastreio
let rastreiosPmobile = [];
let limiteExibicaoRastreios = 100;
let carregamentoRastreiosAtual = null;
let rastreiosUltimaConsulta = 0;
// Busca de NF diretamente no Supabase para não depender das 19 páginas
// carregadas nem do cache da lista durante a atualização OneDrive.
let buscaNFRastreioTemporizador = null;
let buscaNFRastreioUltimoTermo = "";
let buscaNFRastreioUltimaConsulta = 0;
let buscaNFRastreioCarregando = false;
let buscaNFRastreioRequisicao = 0;
let rastreiosBuscaNFRapida = [];

// A ordem da tela corresponde à posição física na aba LANÇAMENTOS.
// Nova linha inserida no topo empurra as notas anteriores para baixo.
function compararRastreiosPorLinha(a, b) {
    const numeroLinha = item => {
        const n = Number(item?.linha_origem);
        return item?.linha_origem != null && Number.isInteger(n) && n > 0
            ? n : Number.MAX_SAFE_INTEGER;
    };
    const diferenca = numeroLinha(a) - numeroLinha(b);
    if (diferenca !== 0) return diferenca;
    const dataA = String(a?.data_envio || "");
    const dataB = String(b?.data_envio || "");
    if (dataA !== dataB) return dataA < dataB ? 1 : -1;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
}

function agendarBuscaRastreioServidor() {
    const termo = String(document.getElementById("buscaRastreio")?.value || "").trim();
    if (!/^\d{3,40}$/.test(termo)) {
        clearTimeout(buscaNFRastreioTemporizador);
        buscaNFRastreioUltimoTermo = "";
        rastreiosBuscaNFRapida = [];
        buscaNFRastreioCarregando = false;
        buscaNFRastreioRequisicao++;
        return;
    }
    if (termo === buscaNFRastreioUltimoTermo &&
        Date.now() - buscaNFRastreioUltimaConsulta < 5000) return;
    clearTimeout(buscaNFRastreioTemporizador);
    const numeroDaBusca = ++buscaNFRastreioRequisicao;
    buscaNFRastreioCarregando = true;
    buscaNFRastreioTemporizador = setTimeout(async () => {
        if (numeroDaBusca !== buscaNFRastreioRequisicao) return;
        try {
            const sessao = obterSessaoRastreio();
            const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_buscar_nf", {
                p_usuario: sessao.usuario,
                p_credencial: sessao.credencial,
                p_nota: termo
            });
            if (resposta.error) throw resposta.error;
            if (numeroDaBusca !== buscaNFRastreioRequisicao) return;
            const encontrados = Array.isArray(resposta.data) ? resposta.data : [];
            // Manter a pesquisa rápida fora do cache paginado. Assim ela não
            // desaparece quando a última página antiga termina de carregar.
            rastreiosBuscaNFRapida = encontrados;
            buscaNFRastreioUltimoTermo = termo;
            buscaNFRastreioUltimaConsulta = Date.now();
        } catch (erro) {
            console.warn("Pesquisa rápida de NF no Supabase:", erro);
        } finally {
            if (numeroDaBusca === buscaNFRastreioRequisicao) {
                buscaNFRastreioCarregando = false;
                filtrarRastreios();
            }
        }
    }, 250);
}

function atualizarBuscaRastreio() {
    agendarBuscaRastreioServidor();
    filtrarRastreios();
}
window.addEventListener("pmobile:rastreio-atualizado", () => {
    buscaNFRastreioUltimoTermo = "";
    buscaNFRastreioUltimaConsulta = 0;
    rastreiosBuscaNFRapida = [];
    rastreiosUltimaConsulta = 0;
    if (document.getElementById("buscaRastreio")?.value.trim()) atualizarBuscaRastreio();
});

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
    if (rastreiosPmobile.length) {
        filtrarRastreios();
        if (Date.now() - rastreiosUltimaConsulta < 10000) return;
    }
    await carregarRastreios();
}

async function carregarRastreios() {
    if (carregamentoRastreiosAtual) return carregamentoRastreiosAtual;
    carregamentoRastreiosAtual = (async () => {
        const lista = document.getElementById("listaRastreios");
        const status = document.getElementById("statusRastreio");
        if (!lista) return;
        const possuiCache = rastreiosPmobile.length > 0;
        if (!possuiCache) lista.innerHTML = '<div class="rastreio-vazio">Carregando rastreios...</div>';
        try {
            const sessao = obterSessaoRastreio();
            const registros = [];
            const tamanhoPagina = 500;
            const buscarPagina = async deslocamento => {
                const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_listar_v5", {
                    p_usuario: sessao.usuario,
                    p_credencial: sessao.credencial,
                    p_limit: tamanhoPagina,
                    p_offset: deslocamento
                });
                if (resposta.error) throw resposta.error;
                return Array.isArray(resposta.data) ? resposta.data : [];
            };
            const adicionarPagina = pagina => {
                registros.push(...pagina.filter(item =>
                    !/^TOTAL(?:\s*GERAL)?$/i.test(String(item.transportadora || "").trim()) &&
                    !/^TOTAL(?:\s*GERAL)?$/i.test(String(item.cliente || "").trim())
                ));
                if (status) status.textContent = "Carregando rastreios: " +
                    registros.length.toLocaleString("pt-BR") + "...";
            };
            // Priorizar a página recente: a NF nova pode ser exibida enquanto
            // as páginas mais antigas ainda estão carregando.
            const primeiraPagina = await buscarPagina(0);
            adicionarPagina(primeiraPagina);
            if (!possuiCache) {
                rastreiosPmobile = registros.slice();
            } else {
                // Substituir os cartões da primeira página pelos dados atuais:
                // ao inserir uma linha acima, a NF antiga muda de posição
                // mesmo mantendo o identificador de registro.
                const idsAtualizados = new Set(primeiraPagina.map(item => String(item.id)));
                rastreiosPmobile = [
                    ...primeiraPagina,
                    ...rastreiosPmobile.filter(item => !idsAtualizados.has(String(item.id)))
                ];
            }
            filtrarRastreios();
            if (primeiraPagina.length === tamanhoPagina) {
                // Buscar quatro páginas simultaneamente (antes eram 19 consultas
                // sequenciais). Preservar a ordem de cada página na listagem.
                const paginasParalelas = 4;
                for (let inicio = tamanhoPagina; ; inicio += paginasParalelas * tamanhoPagina) {
                    const offsets = Array.from({length: paginasParalelas},
                        (_, i) => inicio + i * tamanhoPagina);
                    const paginas = await Promise.all(offsets.map(buscarPagina));
                    let terminada = false;
                    for (const pagina of paginas) {
                        if (terminada) break;
                        adicionarPagina(pagina);
                        if (pagina.length < tamanhoPagina) terminada = true;
                    }
                    if (!possuiCache) {
                        rastreiosPmobile = registros.slice();
                        filtrarRastreios();
                    }
                    if (terminada) break;
                }
            }
            rastreiosPmobile = registros;
            rastreiosUltimaConsulta = Date.now();
            limiteExibicaoRastreios = 100;
            if (status) status.textContent = rastreiosPmobile.length.toLocaleString("pt-BR") + " rastreio(s)";
            filtrarRastreios();
        } catch (erro) {
            console.error("Erro ao carregar Rastreio:", erro);
            if (status) status.textContent = "Falha ao atualizar rastreios.";
            if (!rastreiosPmobile.length) lista.innerHTML = '<div class="rastreio-erro">' + escaparHtmlRastreio(erro.message || "Não foi possível carregar os rastreios.") + '</div>';
        }
    })();
    try { await carregamentoRastreiosAtual; } finally { carregamentoRastreiosAtual = null; }
}

// Somente RM Express tem acompanhamento de entrega. Para as demais
// transportadoras, COLETADO é etiqueta operacional (sem gravação no Supabase).
function ehRMExpressRastreio(item) {
    return String(item?.transportadora || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().replace(/[^A-Z0-9]/g, "") === "RMEXPRESS";
}

function statusVisualRastreio(item) {
    const status = String(item?.status || "PENDENTE").trim().toUpperCase();
    if (status === "CANCELADO" || status === "ENTREGUE") return status;
    if (String(item?.transportadora || "").trim() && !ehRMExpressRastreio(item)) return "COLETADO";
    if (item.previsao_entrega && new Date(item.previsao_entrega).getTime() < Date.now()) {
        return "ATRASADO";
    }
    return status;
}

function filtrarRastreios() {
    const lista = document.getElementById("listaRastreios");
    if (!lista) return;
    const termo = String(document.getElementById("buscaRastreio")?.value || "").trim().toLowerCase();
    const filtro = document.getElementById("filtroStatusRastreio")?.value || "";
    const notasEncontradas = /^\d{3,40}$/.test(termo) ? rastreiosBuscaNFRapida : [];
    const idsBusca = new Set(notasEncontradas.map(item => String(item.id)));
    const fonte = notasEncontradas.length
        ? [...notasEncontradas, ...rastreiosPmobile.filter(item => !idsBusca.has(String(item.id)))]
        : rastreiosPmobile;
    const itens = fonte.filter(function(item) {
        const status = statusVisualRastreio(item);
        const texto = [item.cliente,item.notas_fiscais,item.motorista,item.transportadora,item.regiao].join(" ").toLowerCase();
        return (!termo || texto.includes(termo)) && (!filtro || status === filtro);
    }).sort(compararRastreiosPorLinha);
    if (!itens.length) {
        lista.innerHTML = buscaNFRastreioCarregando
            ? '<div class="rastreio-vazio"><strong>Consultando nota fiscal no Supabase...</strong><span>Aguarde a busca rápida.</span></div>'
            : '<div class="rastreio-vazio"><strong>Nenhum rastreio encontrado.</strong><span>Os registros importados aparecerão aqui.</span></div>';
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

function formatarPercentualFinalRastreio(valor) {
    if (valor == null || valor === "") return "—";
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "—";
    const percentual = Math.abs(numero) <= 1 ? numero * 100 : numero;
    return percentual.toLocaleString("pt-BR", {maximumFractionDigits:2}) + "%";
}

function renderizarRastreio(item) {
    const status = statusVisualRastreio(item);
    const campo = (rotulo, valor) =>
        '<div class="rastreio-dado"><small>' + rotulo + '</small><strong>' + escaparHtmlRastreio(valor) + '</strong></div>';
    return '<article class="rastreio-card" data-status="' + escaparAtributoRastreio(status) + '">' +
        '<div class="rastreio-card-topo"><strong>' + escaparHtmlRastreio(item.cliente || "Cliente não informado") + '</strong><span class="rastreio-etiqueta">' + escaparHtmlRastreio(status.replaceAll("_", " ")) + '</span></div>' +
        '<div class="rastreio-resumo"><div class="rastreio-nf">NF <strong>' + escaparHtmlRastreio(item.notas_fiscais || "—") + '</strong>' +
        (item.linha_origem != null ? '<small class="rastreio-linha-planilha">Linha ' +
            escaparHtmlRastreio(item.linha_origem) + ' da planilha</small>' : '') + '</div>' +
        '<div class="rastreio-valor-nota"><small>Valor da nota</small><strong>' + escaparHtmlRastreio(formatarMoedaRastreioSeguro(item.valor_nf)) + '</strong></div></div>' +
        '<div class="rastreio-motorista"><small>Motorista</small><strong>' + escaparHtmlRastreio(item.motorista || "Não informado") + '</strong></div>' +
        '<div class="rastreio-grade">' +
          campo("Destino", item.regiao || "—") +
          campo("Turno", item.turno || "—") +
          campo("Volumes", formatarQuantidadeRastreio(item.volume)) +
          campo("Peso", formatarQuantidadeRastreio(item.peso)) +
          campo("Frete embutido", formatarMoedaRastreioSeguro(item.valor_frete_embutido)) +
          campo("Valor do frete", formatarMoedaRastreioSeguro(item.valor_frete)) +
          campo("% Final", formatarPercentualFinalRastreio(item.percentual_final)) +
          (status === 'ENTREGUE' && item.entregue_em ? campo('Entregue em', formatarDataHoraEntregaRastreio(item.entregue_em)) : '') +
        '</div></article>';
}

function formatarDataHoraEntregaRastreio(valor) { const d = new Date(valor); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
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
    const item = [...rastreiosBuscaNFRapida, ...rastreiosPmobile]
        .find(registro => String(registro.id) === String(id));
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
        '<div><small>Valor do frete embutido</small><strong>' + escaparHtmlRastreio(formatarMoedaRastreioSeguro(item.valor_frete_embutido)) + '</strong></div>' +
        '<div><small>Valor do frete</small><strong>' + escaparHtmlRastreio(formatarMoedaRastreioSeguro(item.valor_frete)) + '</strong></div>' +
        '<div><small>% Final</small><strong>' + escaparHtmlRastreio(formatarPercentualFinalRastreio(item.percentual_final)) + '</strong></div>';

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
