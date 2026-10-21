// ============================================================
// RESERVAS — MATERIAIS COM QUANTIDADE RESERVADA
// ============================================================

const ITENS_POR_PAGINA_RESERVAS = 20;
let paginaReservasAtual = 1;
let totalReservas = 0;

function abrirReservas() {
    mostrarTelaSistema("reservas", "menuReservas");
    carregarReservas(1);
}

async function carregarReservas(pagina) {
    const area = document.getElementById("listaReservas");
    if (!area) return;

    const paginaSolicitada = Number(pagina) || 1;
    paginaReservasAtual = Math.max(1, paginaSolicitada);

    area.innerHTML = '<div class="reservas-carregando">Carregando reservas...</div>';

    try {
        const cliente = obterClienteSupabase();
        if (!cliente) throw new Error("Supabase indisponível.");

        const offset = (paginaReservasAtual - 1) * ITENS_POR_PAGINA_RESERVAS;

        const { data, error } = await cliente.rpc("listar_reservas", {
            p_limit: ITENS_POR_PAGINA_RESERVAS,
            p_offset: offset
        });

        if (error) throw error;

        const registros = Array.isArray(data) ? data : [];
        totalReservas = registros.length
            ? Number(registros[0].total_registros || 0)
            : (paginaReservasAtual === 1 ? 0 : totalReservas);

        if (!registros.length && paginaReservasAtual === 1) {
            area.innerHTML =
                '<div class="reservas-vazio">' +
                    '<strong>Nenhum item em reserva</strong>' +
                    '<span>Materiais com quantidade reservada maior que zero aparecerão aqui.</span>' +
                '</div>';
            return;
        }

        const totalPaginas = Math.max(
            1,
            Math.ceil(totalReservas / ITENS_POR_PAGINA_RESERVAS)
        );

        if (paginaReservasAtual > totalPaginas) {
            paginaReservasAtual = totalPaginas;
            return carregarReservas(paginaReservasAtual);
        }

        area.innerHTML =
            '<div class="reservas-cabecalho">' +
                '<span>ID</span>' +
                '<span>Descrição</span>' +
                '<span>Referência</span>' +
                '<span>Marca</span>' +
                '<span>Quantidade</span>' +
                '<span>Solicitante</span>' +
            '</div>' +
            registros.map(renderizarReserva).join("") +
            '<div class="reservas-paginacao">' +
                '<button type="button" class="botao-secundario" onclick="mudarPaginaReservas(-1)"' +
                    (paginaReservasAtual <= 1 ? ' disabled' : '') +
                    '>Anterior</button>' +
                '<span>Página ' + paginaReservasAtual + '/' + totalPaginas + ' · ' + totalReservas + ' reserva(s)</span>' +
                '<button type="button" class="botao-secundario" onclick="mudarPaginaReservas(1)"' +
                    (paginaReservasAtual >= totalPaginas ? ' disabled' : '') +
                    '>Próxima</button>' +
            '</div>';

    } catch (erro) {
        console.error("Erro ao carregar reservas:", erro);
        area.innerHTML =
            '<div class="reservas-vazio reservas-erro">' +
                '<strong>Não foi possível carregar as reservas</strong>' +
                '<span>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar os materiais.") + '</span>' +
            '</div>';
    }
}

function mudarPaginaReservas(direcao) {
    const totalPaginas = Math.max(
        1,
        Math.ceil(totalReservas / ITENS_POR_PAGINA_RESERVAS)
    );

    const novaPagina = paginaReservasAtual + Number(direcao || 0);

    if (novaPagina < 1 || novaPagina > totalPaginas) return;

    carregarReservas(novaPagina);
}

function renderizarReserva(item) {
    return (
        '<article class="reserva-item">' +
            '<div class="reserva-celula reserva-id" data-label="ID">' +
                escapeHtmlPmobile(item.codigo || "-") +
            '</div>' +
            '<div class="reserva-celula reserva-descricao" data-label="Descrição">' +
                escapeHtmlPmobile(item.descricao || "-") +
            '</div>' +
            '<div class="reserva-celula reserva-referencia" data-label="Referência">' +
                escapeHtmlPmobile(item.referencia || "-") +
            '</div>' +
            '<div class="reserva-celula reserva-marca" data-label="Marca">' +
                escapeHtmlPmobile(item.marca || "-") +
            '</div>' +
            '<div class="reserva-celula reserva-quantidade" data-label="Quantidade">' +
                escapeHtmlPmobile(formatarNumeroReserva(item.quantidade_reservada)) +
            '</div>' +
            '<div class="reserva-celula reserva-solicitante" data-label="Solicitante">' +
                '—' +
            '</div>' +
        '</article>'
    );
}

function formatarNumeroReserva(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero)
        ? numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
        : "-";
}
