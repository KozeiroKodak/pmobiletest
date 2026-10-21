// ============================================================
// LOCAIS — ALTERADOS / VAZIOS
// ============================================================

const SETORES_PADRAO_LOCAIS_PMP = [
    "A01", "B01", "C01", "D01", "E01", "F01", "G01",
    "H01", "I01", "J01", "K01", "L01", "M01", "P01", "P02"
];

// A grade física segue o mesmo padrão informado para A01.
// A estrutura fica centralizada aqui para ajustes futuros sem
// alterar a lógica de ocupação.
const ESTRUTURA_LOCAIS_PMP = SETORES_PADRAO_LOCAIS_PMP.map(function(area) {
    return {
        area,
        letras: ["A", "B", "C", "D", "E", "F"],
        inicio: 1,
        fim: 30
    };
});

// Posições especiais de pallets cruzados, fisicamente válidas mesmo
// estando à frente de outra estante. São endereços individuais.
const LOCAIS_CRUZADOS_PMP = {
    "B01": ["B01A01"],
    "D01": ["D01C01"],
    "F01": ["F01E01"],
    "H01": ["H01G01"],
    "J01": ["J01I01"]
};

let abaLocaisAtual = "alterados";
let localVaziosDetalheAtual = null;
let paginaLocaisDerivadosAtual = 1;
const ITENS_POR_PAGINA_LOCAIS_DERIVADOS = 20;

function abrirLocais() {
    const usuario = window.usuarioPmobileAtual;

    if (!usuario || usuario.nivel !== "ADMIN") {
        alert("Acesso administrativo negado.");
        return;
    }

    mostrarTelaSistema("locais", "menuConfiguracoes");
    alternarAbaLocais("alterados");
}

function alternarAbaLocais(aba) {
    abaLocaisAtual = ["alterados", "vazios", "derivados"].includes(aba)
        ? aba
        : "alterados";

    const alterados = document.getElementById("painelLocaisAlterados");
    const vazios = document.getElementById("painelLocaisVazios");
    const botaoAlterados = document.getElementById("abaLocaisAlterados");
    const botaoVazios = document.getElementById("abaLocaisVazios");
    const botaoDerivados = document.getElementById("abaLocaisDerivados");
    const derivados = document.getElementById("painelLocaisDerivados");

    if (alterados) alterados.style.display = abaLocaisAtual === "alterados" ? "block" : "none";
    if (vazios) vazios.style.display = abaLocaisAtual === "vazios" ? "block" : "none";
    if (derivados) derivados.style.display = abaLocaisAtual === "derivados" ? "block" : "none";

    if (botaoAlterados) botaoAlterados.classList.toggle("ativo", abaLocaisAtual === "alterados");
    if (botaoVazios) botaoVazios.classList.toggle("ativo", abaLocaisAtual === "vazios");
    if (botaoDerivados) botaoDerivados.classList.toggle("ativo", abaLocaisAtual === "derivados");

    if (abaLocaisAtual === "alterados") {
        carregarLocaisAlterados();
    } else if (abaLocaisAtual === "vazios") {
        carregarLocaisVazios();
    } else {
        carregarLocaisDerivados();
    }
}

async function carregarLocaisDerivados() {
    const area = document.getElementById("listaLocaisDerivados");
    if (!area) return;

    area.innerHTML = '<div class="locais-carregando">Carregando materiais fora dos setores padrão...</div>';

    try {
        const cliente = obterClienteSupabase();
        if (!cliente) throw new Error("Supabase indisponível.");

        paginaLocaisDerivadosAtual = 1;
        await buscarPaginaLocaisDerivados(area, paginaLocaisDerivadosAtual);

    } catch (erro) {
        console.error("Erro ao carregar materiais derivados:", erro);
        area.innerHTML =
            '<div class="locais-vazio locais-vazio-erro">' +
                '<span>!</span><strong>Não foi possível carregar</strong>' +
                '<p>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar os materiais.") + '</p>' +
            '</div>';
    }
}

async function buscarPaginaLocaisDerivados(area, pagina) {
    const cliente = obterClienteSupabase();
    if (!cliente) throw new Error("Supabase indisponível.");

    const offset = (pagina - 1) * ITENS_POR_PAGINA_LOCAIS_DERIVADOS;

    const { data, error } = await cliente.rpc("listar_locais_derivados", {
        p_limit: ITENS_POR_PAGINA_LOCAIS_DERIVADOS,
        p_offset: offset
    });

    if (error) throw error;

    const registros = Array.isArray(data) ? data : [];
    const totalRegistros = registros.length
        ? Number(registros[0].total_registros || 0)
        : 0;

    renderizarPaginaLocaisDerivados(area, registros, totalRegistros);
}

function renderizarPaginaLocaisDerivados(area, registros, totalRegistros) {
    const totalPaginas = Math.max(
        1,
        Math.ceil(totalRegistros / ITENS_POR_PAGINA_LOCAIS_DERIVADOS)
    );

    paginaLocaisDerivadosAtual = Math.min(
        Math.max(1, paginaLocaisDerivadosAtual),
        totalPaginas
    );

    area.dataset.totalRegistrosLocaisDerivados = String(totalRegistros);

    area.innerHTML =
        '<div class="locais-resumo-derivados">' +
            '<strong>' + totalRegistros + '</strong> material(is) fora dos setores padrão' +
        '</div>' +
        '<div class="locais-derivados-cabecalho">' +
            '<span>ID</span>' +
            '<span>Descrição</span>' +
            '<span>Referência</span>' +
            '<span>Local</span>' +
            '<span>Quantidade</span>' +
        '</div>' +
        registros.map(renderizarLocalDerivado).join("") +
        '<div class="locais-paginacao-derivados">' +
            '<button type="button" class="botao-secundario" onclick="mudarPaginaLocaisDerivados(-1)"' +
                (paginaLocaisDerivadosAtual <= 1 ? ' disabled' : '') +
                '>Anterior</button>' +
            '<span>Página ' + paginaLocaisDerivadosAtual + '/' + totalPaginas + ' · ' + totalRegistros + ' material(is)</span>' +
            '<button type="button" class="botao-secundario" onclick="mudarPaginaLocaisDerivados(1)"' +
                (paginaLocaisDerivadosAtual >= totalPaginas ? ' disabled' : '') +
                '>Próxima</button>' +
        '</div>';
}

function renderizarLocalDerivado(item) {
    return (
        '<article class="local-derivado-card">' +
            '<div class="local-derivado-celula local-derivado-id" data-label="ID">' +
                escapeHtmlPmobile(item.codigo || "-") +
            '</div>' +
            '<div class="local-derivado-celula local-derivado-descricao" data-label="Descrição">' +
                escapeHtmlPmobile(item.descricao || "-") +
            '</div>' +
            '<div class="local-derivado-celula local-derivado-referencia" data-label="Referência">' +
                escapeHtmlPmobile(item.referencia || "-") +
            '</div>' +
            '<div class="local-derivado-celula local-derivado-local" data-label="Local">' +
                escapeHtmlPmobile(item.local || "-") +
            '</div>' +
            '<div class="local-derivado-celula local-derivado-quantidade" data-label="Quantidade">' +
                escapeHtmlPmobile(formatarNumeroLocal(item.quantidade)) +
            '</div>' +
        '</article>'
    );
}

async function mudarPaginaLocaisDerivados(direcao) {
    const area = document.getElementById("listaLocaisDerivados");
    if (!area) return;

    const totalPaginasConhecidas = Math.max(1, Math.ceil(
        Number(area.dataset.totalRegistrosLocaisDerivados || 0) /
        ITENS_POR_PAGINA_LOCAIS_DERIVADOS
    ));

    const novaPagina = paginaLocaisDerivadosAtual + Number(direcao || 0);

    if (novaPagina < 1) return;
    if (totalPaginasConhecidas > 1 && novaPagina > totalPaginasConhecidas) return;

    paginaLocaisDerivadosAtual = novaPagina;

    try {
        await buscarPaginaLocaisDerivados(area, novaPagina);
    } catch (erro) {
        console.error("Erro ao paginar materiais derivados:", erro);
    }
}
async function carregarLocaisAlterados() {
    const area = document.getElementById("listaLocaisAlterados");
    if (!area) return;

    area.innerHTML = '<div class="locais-carregando">Carregando alterações...</div>';

    try {
        const cliente = obterClienteSupabase();
        if (!cliente) throw new Error("Supabase indisponível.");

        const { data, error } = await cliente
            .from("contagens_manuais")
            .select(
                "id,codigo_material,local_encontrado,quantidade_fisica,data_hora,usuario_nome,alteracao_status,alteracao_confirmada_por_nome,alteracao_confirmada_em"
            )
            .eq("local_alterado", true)
            .order("data_hora", { ascending: false });

        if (error) throw error;

        const registros = Array.isArray(data) ? data : [];

        if (!registros.length) {
            area.innerHTML =
                '<div class="locais-vazio">' +
                    '<span>✓</span>' +
                    '<strong>Nenhum local alterado</strong>' +
                    '<p>As alterações encontradas na contagem manual aparecerão aqui.</p>' +
                '</div>';
            return;
        }

        area.innerHTML = registros.map(renderizarLocalAlterado).join("");

    } catch (erro) {
        console.error("Erro ao carregar locais alterados:", erro);
        area.innerHTML =
            '<div class="locais-vazio locais-vazio-erro">' +
                '<span>!</span>' +
                '<strong>Não foi possível carregar</strong>' +
                '<p>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar as alterações.") + '</p>' +
            '</div>';
    }
}

function renderizarLocalAlterado(item) {
    const codigo = escapeHtmlPmobile(item.codigo_material || "-");
    const novoLocal = escapeHtmlPmobile(item.local_encontrado || "-");
    const quantidade = escapeHtmlPmobile(formatarNumeroLocal(item.quantidade_fisica));
    const usuario = escapeHtmlPmobile(item.usuario_nome || "Usuário não identificado");
    const data = escapeHtmlPmobile(formatarDataLocal(item.data_hora));
    const status = item.alteracao_status === "CONFIRMADO" ? "CONFIRMADO" : "PENDENTE";
    const confirmadoPor = escapeHtmlPmobile(item.alteracao_confirmada_por_nome || "");
    const confirmadoEm = item.alteracao_confirmada_em
        ? escapeHtmlPmobile(formatarDataLocal(item.alteracao_confirmada_em))
        : "";

    const admin =
        window.usuarioPmobileAtual &&
        window.usuarioPmobileAtual.nivel === "ADMIN";

    const botaoConfirmar = status === "PENDENTE" && admin
        ? '<button type="button" class="botao-local-confirmar" onclick="confirmarAlteracaoLocal(\'' +
            escapeHtmlPmobile(item.id) +
            '\')">✓ Confirmar alteração</button>'
        : "";

    return (
        '<article class="local-alterado-card">' +
            '<div class="local-alterado-principal">' +
                '<div>' +
                    '<span class="local-alterado-legenda">Código</span>' +
                    '<strong class="local-alterado-codigo">' + codigo + '</strong>' +
                '</div>' +
                '<div class="local-alterado-seta" aria-hidden="true">→</div>' +
                '<div>' +
                    '<span class="local-alterado-legenda">Novo local</span>' +
                    '<strong class="local-alterado-local">' + novoLocal + '</strong>' +
                '</div>' +
                '<span class="local-alterado-status ' + (status === "CONFIRMADO" ? "confirmado" : "pendente") + '">' +
                    (status === "CONFIRMADO" ? "Confirmado" : "Pendente") +
                '</span>' +
            '</div>' +
            '<div class="local-alterado-detalhes">' +
                '<span><b>Qtd. física:</b> ' + quantidade + '</span>' +
                '<span><b>Contado por:</b> ' + usuario + '</span>' +
                '<span><b>Data/hora:</b> ' + data + '</span>' +
                (status === "CONFIRMADO"
                    ? '<span><b>Confirmado por:</b> ' + confirmadoPor + ' · ' + confirmadoEm + '</span>'
                    : '') +
            '</div>' +
            (botaoConfirmar ? '<div class="local-alterado-acoes">' + botaoConfirmar + '</div>' : '') +
        '</article>'
    );
}

async function confirmarAlteracaoLocal(contagemId) {
    if (!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN" || !window.credencialPmobileAtual) {
        alert("Acesso administrativo negado.");
        return;
    }

    if (!confirm("Confirmar que esta alteração de local já foi realizada no ERP?")) {
        return;
    }

    try {
        const cliente = obterClienteSupabase();

        const { error } = await cliente.rpc("confirmar_alteracao_local", {
            p_admin_usuario: window.usuarioPmobileAtual.usuario,
            p_admin_credencial: window.credencialPmobileAtual,
            p_contagem_id: contagemId
        });

        if (error) throw error;

        await carregarLocaisAlterados();

    } catch (erro) {
        console.error("Erro ao confirmar alteração de local:", erro);
        alert(erro?.message || "Não foi possível confirmar a alteração.");
    }
}

function carregarLocaisVazios() {
    const area = document.getElementById("listaAreasVazias");
    if (!area) return;

    if (!ESTRUTURA_LOCAIS_PMP.length) {
        area.innerHTML =
            '<div class="locais-vazio"><strong>Nenhuma área configurada</strong>' +
            '<p>A estrutura física dos locais ainda não foi cadastrada no PMOBILE.</p></div>';
        return;
    }

    area.innerHTML = '<div class="locais-carregando">Calculando posições...</div>';

    Promise.resolve().then(async function() {
        try {
            const cliente = obterClienteSupabase();
            if (!cliente) throw new Error("Supabase indisponível.");

            const { data, error } = await cliente.rpc("listar_locais_ocupados");

            if (error) throw error;

            const ocupados = new Set(
                (Array.isArray(data) ? data : [])
                    .map(function(item) {
                        return normalizarLocalPmobile(item.local);
                    })
                    .filter(Boolean)
            );

            window._pmobileLocaisVaziosOcupados = ocupados;

            area.innerHTML = ESTRUTURA_LOCAIS_PMP.map(function(estrutura) {
                const posicoes = gerarPosicoesAreaPmobile(estrutura);
                const vazios = posicoes.filter(function(local) {
                    return !ocupados.has(normalizarLocalPmobile(local));
                });
                const ocupadas = posicoes.length - vazios.length;

                return (
                    '<article class="local-vazio-area-card">' +
                        '<div class="local-vazio-area-info">' +
                            '<span class="local-vazio-area-legenda">Área</span>' +
                            '<strong>' + escapeHtmlPmobile(estrutura.area) + '</strong>' +
                        '</div>' +
                        '<div class="local-vazio-metrica"><span>Total</span><strong>' + posicoes.length + '</strong></div>' +
                        '<div class="local-vazio-metrica"><span>Ocupados</span><strong>' + ocupadas + '</strong></div>' +
                        '<div class="local-vazio-metrica destaque"><span>Vazios</span><strong>' + vazios.length + '</strong></div>' +
                        '<button type="button" class="botao-lupa-local" onclick="abrirDetalhesLocaisVazios(\'' +
                            escapeHtmlPmobile(estrutura.area) +
                        '\')" aria-label="Ver posições vazias de ' + escapeHtmlPmobile(estrutura.area) + '" title="Ver posições vazias">⌕</button>' +
                    '</article>'
                );
            }).join("");

        } catch (erro) {
            console.error("Erro ao calcular locais vazios:", erro);
            area.innerHTML =
                '<div class="locais-vazio locais-vazio-erro">' +
                    '<span>!</span><strong>Não foi possível calcular</strong>' +
                    '<p>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar o estoque.") + '</p>' +
                '</div>';
        }
    });
}

function abrirDetalhesLocaisVazios(areaNome) {
    const estrutura = ESTRUTURA_LOCAIS_PMP.find(function(item) {
        return item.area === areaNome;
    });
    if (!estrutura) return;

    localVaziosDetalheAtual = estrutura;

    const painel = document.getElementById("detalhesLocaisVazios");
    const titulo = document.getElementById("tituloDetalhesLocaisVazios");
    const lista = document.getElementById("listaDetalhesLocaisVazios");

    if (!painel || !titulo || !lista) return;

    const ocupados = window._pmobileLocaisVaziosOcupados || new Set();
    const vazios = gerarPosicoesAreaPmobile(estrutura).filter(function(local) {
        return !ocupados.has(normalizarLocalPmobile(local));
    });

    titulo.textContent = estrutura.area;
    lista.innerHTML = vazios.length
        ? vazios.map(function(local) {
            return '<div class="local-vazio-endereco">' + escapeHtmlPmobile(local) + '</div>';
        }).join("")
        : '<div class="locais-vazio"><strong>Nenhuma posição vazia</strong><p>Esta área está totalmente ocupada.</p></div>';

    mostrarTelaSistema("detalhesLocaisVazios", "menuLocais");
}

function fecharDetalhesLocaisVazios() {
    localVaziosDetalheAtual = null;
    mostrarTelaSistema("locais", "menuLocais");
    alternarAbaLocais("vazios");
}

function gerarPosicoesAreaPmobile(estrutura) {
    const resultado = [];

    (estrutura.letras || []).forEach(function(letra) {
        for (let numero = estrutura.inicio; numero <= estrutura.fim; numero += 1) {
            resultado.push(
                String(estrutura.area) +
                String(letra) +
                String(numero).padStart(2, "0")
            );
        }
    });

    (LOCAIS_CRUZADOS_PMP[estrutura.area] || []).forEach(function(local) {
        resultado.push(local);
    });

    return resultado;
}


function obterLocaisPadraoPmobile() {
    const locais = new Set();

    ESTRUTURA_LOCAIS_PMP.forEach(function(estrutura) {
        gerarPosicoesAreaPmobile(estrutura).forEach(function(local) {
            locais.add(normalizarLocalPmobile(local));
        });
    });

    return locais;
}

function normalizarLocalPmobile(valor) {
    return String(valor == null ? "" : valor).trim().toUpperCase();
}

function formatarDataLocal(valor) {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatarNumeroLocal(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero)
        ? numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
        : "-";
}
