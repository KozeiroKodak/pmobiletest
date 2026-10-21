// ============================================================
// RESERVAS — MATERIAIS COM QUANTIDADE RESERVADA
// ============================================================

function abrirReservas() {
    mostrarTelaSistema("reservas", "menuReservas");
    carregarReservas();
}

async function carregarReservas() {
    const area = document.getElementById("listaReservas");
    if (!area) return;

    area.innerHTML = '<div class="reservas-carregando">Carregando reservas...</div>';

    try {
        const cliente = obterClienteSupabase();
        if (!cliente) throw new Error("Supabase indisponível.");

        const registros = await buscarTodosMateriaisReservas(cliente);

        if (!registros.length) {
            area.innerHTML =
                '<div class="reservas-vazio">' +
                    '<strong>Nenhum item em reserva</strong>' +
                    '<span>Materiais com quantidade reservada maior que zero aparecerão aqui.</span>' +
                '</div>';
            return;
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
            registros.map(renderizarReserva).join("");

    } catch (erro) {
        console.error("Erro ao carregar reservas:", erro);
        area.innerHTML =
            '<div class="reservas-vazio reservas-erro">' +
                '<strong>Não foi possível carregar as reservas</strong>' +
                '<span>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar os materiais.") + '</span>' +
            '</div>';
    }
}

async function buscarTodosMateriaisReservas(cliente) {
    const { data, error } = await cliente
        .rpc("listar_reservas");

    if (error) throw error;

    const registros = Array.isArray(data) ? data : [];

    return registros
        .filter(function(item) {
            return Number(item.quantidade_reservada || 0) > 0;
        })
        .sort(function(a, b) {
            return String(a.codigo || "").localeCompare(
                String(b.codigo || ""),
                "pt-BR",
                { numeric: true }
            );
        });
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
