// ============================================================
// LOCAIS — ALTERADOS / VAZIOS
// ============================================================

const ESTRUTURA_LOCAIS_PMP = [
    {
        area: "A01",
        letras: ["A", "B", "C", "D", "E", "F"],
        inicio: 1,
        fim: 30
    }
];

let abaLocaisAtual = "alterados";
let localVaziosDetalheAtual = null;

function abrirLocais() {
    mostrarTelaSistema("locais", "menuLocais");
    alternarAbaLocais("alterados");
}

function alternarAbaLocais(aba) {
    abaLocaisAtual = aba === "vazios" ? "vazios" : "alterados";

    const alterados = document.getElementById("painelLocaisAlterados");
    const vazios = document.getElementById("painelLocaisVazios");
    const botaoAlterados = document.getElementById("abaLocaisAlterados");
    const botaoVazios = document.getElementById("abaLocaisVazios");

    if (alterados) alterados.style.display = abaLocaisAtual === "alterados" ? "block" : "none";
    if (vazios) vazios.style.display = abaLocaisAtual === "vazios" ? "block" : "none";

    if (botaoAlterados) botaoAlterados.classList.toggle("ativo", abaLocaisAtual === "alterados");
    if (botaoVazios) botaoVazios.classList.toggle("ativo", abaLocaisAtual === "vazios");

    if (abaLocaisAtual === "alterados") {
        carregarLocaisAlterados();
    } else {
        carregarLocaisVazios();
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
        window.usuarioPmobileAtual.nivel === "ADMIN" &&
        window.credencialPmobileAtual;

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
            '<div class="locais-vazio">' +
                '<strong>Nenhuma área configurada</strong>' +
                '<p>A estrutura física dos locais ainda não foi cadastrada no PMOBILE.</p>' +
            '</div>';
        return;
    }

    Promise.resolve().then(async function() {
        area.innerHTML = '<div class="locais-carregando">Calculando posições...</div>';

        try {
            const cliente = obterClienteSupabase();
            if (!cliente) throw new Error("Supabase indisponível.");

            const { data, error } = await cliente
                .from("contagens_manuais")
                .select("codigo_material,local_encontrado,quantidade_fisica,data_hora");

            if (error) throw error;

            const registros = Array.isArray(data) ? data : [];
            const ocupados = new Set();

            registros.forEach(function(item) {
                const local = normalizarLocalPmobile(item.local_encontrado);
                const quantidade = Number(item.quantidade_fisica);
                if (local && Number.isFinite(quantidade) && quantidade > 0) {
                    ocupados.add(local);
                }
            });

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

            window._pmobileLocaisVaziosOcupados = ocupados;

        } catch (erro) {
            console.error("Erro ao calcular locais vazios:", erro);
            area.innerHTML =
                '<div class="locais-vazio locais-vazio-erro">' +
                    '<span>!</span>' +
                    '<strong>Não foi possível calcular</strong>' +
                    '<p>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar a contagem manual.") + '</p>' +
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

    const painel = document.getElementById("paginaDetalhesLocaisVazios");
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

    return resultado;
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
