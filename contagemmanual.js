// ============================================================
// PMOBILE - CONTAGEM MANUAL
// ============================================================
// Módulo isolado das conferências existentes.
// Primeira fase: busca no inventário + persistência local.
// ============================================================

const CHAVE_CONTAGENS_MANUAIS = "pmobile_contagens_manuais_v1";
const TABELA_CONTAGENS_MANUAIS_SUPABASE = "contagens_manuais";
let materialContagemManualSelecionado = null;

function mostrarOpcoesCompletasContagemManual(seletor) {
    if (!seletor) return;
    const nomes = {
        codigo: "Código",
        descricao: "Descrição",
        referencia: "Referência"
    };

    Array.from(seletor.options).forEach(opcao => {
        opcao.textContent = nomes[opcao.value] || opcao.textContent;
    });
}

function mostrarOpcoesCurtasContagemManual(seletor) {
    if (!seletor) return;
    const nomes = {
        codigo: "CÓD",
        descricao: "DESC",
        referencia: "REF"
    };

    Array.from(seletor.options).forEach(opcao => {
        opcao.textContent = nomes[opcao.value] || opcao.textContent;
    });
}

function alternarSeletorContagemManual() {
    const menu = document.getElementById("menuTipoBuscaContagemManual");
    const botao = document.getElementById("botaoTipoBuscaContagemManual");
    if (!menu || !botao) return;

    const aberto = menu.style.display !== "none";
    menu.style.display = aberto ? "none" : "block";
    botao.setAttribute("aria-expanded", aberto ? "false" : "true");
}

function selecionarTipoBuscaContagemManual(tipo) {
    const seletor = document.getElementById("tipoBuscaContagemManual");
    const botao = document.getElementById("botaoTipoBuscaContagemManual");
    const menu = document.getElementById("menuTipoBuscaContagemManual");
    if (!seletor || !botao || !menu) return;

    const nomesCurtos = {
        codigo: "CÓD",
        referencia: "REF",
        descricao: "DESC"
    };

    seletor.value = tipo;
    botao.textContent = nomesCurtos[tipo] || "CÓD";
    menu.style.display = "none";
    botao.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", function(evento) {
    const menu = document.getElementById("menuTipoBuscaContagemManual");
    const botao = document.getElementById("botaoTipoBuscaContagemManual");
    const wrapper = botao?.closest(".seletor-contagem-manual-wrapper");

    if (menu && wrapper && !wrapper.contains(evento.target)) {
        menu.style.display = "none";
        botao.setAttribute("aria-expanded", "false");
    }
});

function normalizarTextoContagemManual(valor) {
    return String(valor ?? "").trim().toLowerCase();
}

async function obterInventarioContagemManual() {
    if (typeof carregarMateriais === "function") {
        await carregarMateriais();
    }
    if (typeof obterMateriaisLocais !== "function") {
        throw new Error("Banco local de materiais indisponível.");
    }
    const lista = await obterMateriaisLocais();
    return Array.isArray(lista) ? lista : [];
}

async function buscarMaterialContagemManual() {
    const campo = document.getElementById("campoContagemManual");
    const area = document.getElementById("resultadoBuscaContagemManual");
    if (!campo || !area) return;

    const busca = normalizarTextoContagemManual(campo.value);
    materialContagemManualSelecionado = null;
    const painel = document.getElementById("painelRegistroContagemManual");
    if (painel) painel.style.display = "none";

    if (!busca) {
        area.innerHTML = "<p>Digite um código, referência ou descrição.</p>";
        return;
    }

    area.innerHTML = "<p>Pesquisando...</p>";

    try {
        const inventario = await obterInventarioContagemManual();
        const seletor = document.getElementById("tipoBuscaContagemManual");
        const tipoBusca = seletor ? seletor.value : "codigo";
        const camposPermitidos = ["codigo", "descricao", "referencia"];
        const campoBusca = camposPermitidos.includes(tipoBusca) ? tipoBusca : "codigo";

        const encontrados = inventario.filter(material => {
            const valorCampo = normalizarTextoContagemManual(material[campoBusca]);
            return campoBusca === "codigo"
                ? valorCampo === busca
                : valorCampo.includes(busca);
        }).slice(0, 50);

        renderizarResultadosContagemManual(encontrados);
    } catch (erro) {
        console.error("Erro na busca da contagem manual:", erro);
        area.innerHTML = "<p>Não foi possível consultar o inventário local. Sincronize ou importe o inventário e tente novamente.</p>";
    }
}

function renderizarResultadosContagemManual(lista) {
    const area = document.getElementById("resultadoBuscaContagemManual");
    if (!area) return;
    area.innerHTML = "";

    if (!lista.length) {
        area.innerHTML = "<p>Nenhum material encontrado.</p>";
        return;
    }

    lista.forEach((material, indice) => {
        const bloco = document.createElement("div");
        bloco.className = "resultado-contagem-manual";

        const titulo = document.createElement("h3");
        titulo.textContent = material.descricao || "Material";
        bloco.appendChild(titulo);

        ["codigo", "referencia", "marca", "local", "quantidade"].forEach(campo => {
            const p = document.createElement("p");
            const nomes = {codigo:"Código", referencia:"Referência", marca:"Marca", local:"Local atual", quantidade:"Quantidade esperada"};
            const strong = document.createElement("strong");
            strong.textContent = nomes[campo] + ": ";
            p.appendChild(strong);
            p.appendChild(document.createTextNode(String(material[campo] ?? "-")));
            bloco.appendChild(p);
        });

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "botao-principal";
        botao.textContent = "Contar este material";
        botao.addEventListener("click", () => selecionarMaterialContagemManual(material));
        bloco.appendChild(botao);

        if (indice < lista.length - 1) bloco.appendChild(document.createElement("hr"));
        area.appendChild(bloco);
    });
}

function selecionarMaterialContagemManual(material) {
    materialContagemManualSelecionado = material;

    const painel = document.getElementById("painelRegistroContagemManual");
    const resumo = document.getElementById("materialSelecionadoContagemManual");
    const local = document.getElementById("localContagemManual");
    const quantidade = document.getElementById("quantidadeContagemManual");
    const status = document.getElementById("statusContagemManual");

    if (resumo) {
        resumo.textContent = (material.codigo || "-") + " — " + (material.descricao || "Material") +
            " | Local inventário: " + (material.local || "-");
    }
    if (local) local.value = material.local || "";
    if (quantidade) quantidade.value = "";
    if (status) status.textContent = "";
    if (painel) painel.style.display = "block";
    if (local) local.focus();
}

function lerContagensManuais() {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_CONTAGENS_MANUAIS) || "[]");
        return Array.isArray(dados) ? dados : [];
    } catch (erro) {
        console.error("Erro ao ler contagens manuais:", erro);
        return [];
    }
}

function gravarContagensManuais(lista) {
    localStorage.setItem(CHAVE_CONTAGENS_MANUAIS, JSON.stringify(lista));
}

function alternarMenuConfiguracoesContagemManual() {
    const menu = document.getElementById("menuConfiguracoesContagemManual");
    if (!menu) return;
    menu.style.display = menu.style.display === "none" ? "block" : "none";
}

function fecharMenuConfiguracoesContagemManual() {
    const menu = document.getElementById("menuConfiguracoesContagemManual");
    if (menu) menu.style.display = "none";
}

async function limparContagensManuais() {
    const confirmar = confirm(
        "⚠️ ATENÇÃO!\n\n" +
        "Todas as contagens manuais serão apagadas.\n\n" +
        "Os materiais do inventário NÃO serão apagados.\n\n" +
        "Deseja continuar?"
    );

    if (!confirmar) return;

    fecharMenuConfiguracoesContagemManual();

    if (!navigator.onLine || typeof obterClienteSupabase !== "function") {
        alert("❌ É necessário estar conectado ao Supabase para limpar a contagem manual.");
        return;
    }

    try {
        const cliente = obterClienteSupabase();
        const usuarioSessao =
            (typeof usuarioPmobileAtual !== "undefined" && usuarioPmobileAtual?.usuario)
                ? usuarioPmobileAtual
                : window.usuarioPmobileAtual;
        const credencialSessao =
            (typeof credencialPmobileAtual !== "undefined" && credencialPmobileAtual)
                ? credencialPmobileAtual
                : window.credencialPmobileAtual;

        if (!usuarioSessao?.usuario || !credencialSessao) {
            throw new Error("Sessão administrativa sem credencial disponível.");
        }

        const { error } = await cliente.rpc("limpar_contagens_manuais", {
            p_usuario: usuarioSessao.usuario,
            p_credencial: credencialSessao
        });

        if (error) throw error;

        localStorage.removeItem(CHAVE_CONTAGENS_MANUAIS);
        materialContagemManualSelecionado = null;

        const painel = document.getElementById("painelRegistroContagemManual");
        if (painel) painel.style.display = "none";

        exibirContagensManuais();

        const status = document.getElementById("statusContagemManual");
        if (status) status.textContent = "Todas as contagens manuais foram apagadas.";

        alert("✅ Contagem manual apagada com sucesso!");
    } catch (erro) {
        console.error("Erro ao limpar contagens manuais:", erro);
        const detalhe =
            erro?.message ||
            erro?.details ||
            erro?.hint ||
            String(erro);

        alert(
            "❌ Não foi possível limpar a contagem manual.\\n\\n" +
            detalhe
        );
    }
}


async function salvarContagemManual() {
    const material = materialContagemManualSelecionado;
    const localCampo = document.getElementById("localContagemManual");
    const quantidadeCampo = document.getElementById("quantidadeContagemManual");
    const status = document.getElementById("statusContagemManual");

    if (!material || !localCampo || !quantidadeCampo) return;

    const localEncontrado = localCampo.value.trim();
    const textoQuantidade = quantidadeCampo.value.trim();
    const quantidadeFisica = Number(textoQuantidade);

    if (!localEncontrado) {
        if (status) status.textContent = "Informe o local encontrado.";
        localCampo.focus();
        return;
    }

    if (textoQuantidade === "" || !Number.isFinite(quantidadeFisica) || quantidadeFisica < 0 || !Number.isInteger(quantidadeFisica)) {
        if (status) status.textContent = "Informe uma quantidade inteira igual ou maior que zero.";
        quantidadeCampo.focus();
        return;
    }

    const registro = {
        id: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2)),
        idSupabase: material.idSupabase ?? material.id ?? null,
        codigo: material.codigo ?? "",
        referencia: material.referencia ?? "",
        descricao: material.descricao ?? "",
        marca: material.marca ?? "",
        localOriginal: material.local ?? "",
        localEncontrado,
        quantidadeEsperada: Number(material.quantidade ?? 0),
        quantidadeFisica,
        localAlterado: normalizarTextoContagemManual(localEncontrado) !== normalizarTextoContagemManual(material.local),
        zerado: quantidadeFisica === 0,
        dataHora: new Date().toISOString(),
        usuarioId: window.usuarioPmobileAtual?.id ?? null,
        usuarioNome: window.usuarioPmobileAtual?.nome ?? window.usuarioPmobileAtual?.usuario ?? "Usuário não identificado",
        sincronizado: false
    };

    const lista = lerContagensManuais();
    lista.unshift(registro);
    gravarContagensManuais(lista);

    if (status) status.textContent = "Contagem salva offline. Sincronizando...";
    quantidadeCampo.value = "";
    exibirContagensManuais();

    await atualizarContagensManuais();
}

async function sincronizarContagensManuaisPendentes(limpezaEm = null) {
    if (!navigator.onLine || typeof obterClienteSupabase !== "function") return;

    const lista = lerContagensManuais();

    // Uma limpeza administrativa no servidor invalida qualquer
    // contagem offline que existia antes daquele momento.
    // Contagens criadas depois da limpeza continuam válidas.
    const limiteLimpeza = limpezaEm ? new Date(limpezaEm).getTime() : null;
    const listaFiltrada = limiteLimpeza !== null
        ? lista.filter(item => {
            if (item.sincronizado) return true;
            const dataItem = new Date(item.dataHora || 0).getTime();
            return !Number.isFinite(dataItem) || dataItem > limiteLimpeza;
        })
        : lista;

    if (listaFiltrada.length !== lista.length) {
        gravarContagensManuais(listaFiltrada);
    }
    const pendentes = listaFiltrada.filter(item => !item.sincronizado);
    if (!pendentes.length) return;

    const cliente = obterClienteSupabase();
    let alterou = false;

    for (const item of pendentes) {
        try {
            const payload = {
                id: item.id,
                material_id: item.idSupabase || null,
                codigo_material: item.codigo || "",
                descricao_material: item.descricao || "",
                referencia_material: item.referencia || null,
                marca_material: item.marca || null,
                local_original: item.localOriginal || null,
                local_encontrado: item.localEncontrado,
                quantidade_esperada: Number(item.quantidadeEsperada || 0),
                quantidade_fisica: Number(item.quantidadeFisica || 0),
                local_alterado: Boolean(item.localAlterado),
                zerado: Boolean(item.zerado),
                data_hora: item.dataHora,
                usuario_id: item.usuarioId ?? window.usuarioPmobileAtual?.id ?? null,
                usuario_nome: item.usuarioNome ?? window.usuarioPmobileAtual?.nome ?? window.usuarioPmobileAtual?.usuario ?? "Usuário não identificado"
            };

            const { error } = await cliente
                .from(TABELA_CONTAGENS_MANUAIS_SUPABASE)
                .insert(payload);

            if (error) throw error;

            item.sincronizado = true;
            alterou = true;
        } catch (erro) {
            console.warn("Contagem manual mantida offline para nova tentativa:", erro);

            const statusErro = document.getElementById("statusContagemManual");
            if (statusErro) {
                statusErro.textContent =
                    "⚠️ Falha ao sincronizar contagem manual. Nova tentativa em 10 segundos.";
            }
        }
    }

    if (alterou) {
        gravarContagensManuais(listaFiltrada);
        exibirContagensManuais();
    }

    const status = document.getElementById("statusContagemManual");
    const restantes = listaFiltrada.filter(item => !item.sincronizado).length;
    if (status) status.textContent = restantes ?
        "Contagem salva offline. Sincronização pendente." :
        "Contagem salva e sincronizada com o Supabase.";
}

window.addEventListener("online", function() {
    atualizarContagensManuais();
});

async function obterLimpezaContagensManuaisSupabase() {
    if (typeof obterClienteSupabase !== "function") return null;

    const cliente = obterClienteSupabase();
    const { data, error } = await cliente.rpc("obter_limpeza_contagens_manuais");

    if (error) throw error;
    return data || null;
}

async function baixarContagensManuaisSupabase(limpezaEm = null) {
    if (typeof obterClienteSupabase !== "function") return false;
    try {
        const cliente = obterClienteSupabase();
        const tamanhoPagina = 1000;
        let inicio = 0;
        let dados = [];

        while (true) {
            const fim = inicio + tamanhoPagina - 1;

            const { data, error } = await cliente
                .from(TABELA_CONTAGENS_MANUAIS_SUPABASE)
                .select("*")
                .order("data_hora", { ascending: false })
                .range(inicio, fim);

            if (error) throw error;

            const pagina = Array.isArray(data) ? data : [];
            dados = dados.concat(pagina);

            if (pagina.length < tamanhoPagina) break;
            inicio += tamanhoPagina;
        }

        // O Supabase é a fonte oficial.
        // Somente registros locais ainda pendentes são preservados.
        // Registros já sincronizados que não existem mais no Supabase
        // precisam desaparecer deste dispositivo também.
        const locais = lerContagensManuais();
        const limiteLimpeza = limpezaEm ? new Date(limpezaEm).getTime() : null;
        const pendentesLocais = locais.filter(item => {
            if (item.sincronizado) return false;
            if (limiteLimpeza === null) return true;

            const dataItem = new Date(item.dataHora || 0).getTime();
            return !Number.isFinite(dataItem) || dataItem > limiteLimpeza;
        });
        const porId = new Map(
            pendentesLocais.map(item => [String(item.id), item])
        );

        dados.forEach(item => {
            porId.set(String(item.id), {
                id: item.id,
                idSupabase: item.material_id ?? null,
                codigo: item.codigo_material ?? "",
                referencia: item.referencia_material ?? "",
                descricao: item.descricao_material ?? "",
                marca: item.marca_material ?? "",
                localOriginal: item.local_original ?? "",
                localEncontrado: item.local_encontrado ?? "",
                quantidadeEsperada: Number(item.quantidade_esperada ?? 0),
                quantidadeFisica: Number(item.quantidade_fisica ?? 0),
                localAlterado: Boolean(item.local_alterado),
                zerado: Boolean(item.zerado),
                dataHora: item.data_hora,
                usuarioId: item.usuario_id ?? null,
                usuarioNome: item.usuario_nome ?? "Usuário não identificado",
                sincronizado: true
            });
        });

        const sincronizadas = Array.from(porId.values())
            .sort((a, b) =>
                String(b.dataHora || "").localeCompare(String(a.dataHora || ""))
            );

        gravarContagensManuais(sincronizadas);
        return true;
    } catch (erro) {
        console.warn("Não foi possível baixar contagens manuais do Supabase:", erro);
        throw erro;
    }
}

let intervaloSincronizacaoContagensManuais = null;
let sincronizacaoContagensManuaisEmAndamento = false;

async function atualizarContagensManuais() {
    if (sincronizacaoContagensManuaisEmAndamento) return;
    sincronizacaoContagensManuaisEmAndamento = true;

    try {
        // Primeiro consultamos a marca de limpeza central.
        // Assim uma contagem offline antiga não consegue ressuscitar
        // registros que o ADMIN acabou de apagar em outro aparelho.
        const limpezaEm = await obterLimpezaContagensManuaisSupabase();

        await sincronizarContagensManuaisPendentes(limpezaEm);
        await baixarContagensManuaisSupabase(limpezaEm);
        exibirContagensManuais();

        const status = document.getElementById("statusContagemManual");
        if (status) {
            const pendentes = lerContagensManuais().filter(item => !item.sincronizado).length;
            status.textContent = pendentes
                ? "Sincronização pendente — verificando novamente em 10 segundos."
                : "Sincronizado com o Supabase.";
        }
    } catch (erro) {
        console.warn("Sincronização da contagem manual falhou:", erro);
        const status = document.getElementById("statusContagemManual");
        if (status) {
            status.textContent =
                "⚠️ Não foi possível consultar o Supabase. Tentando novamente.";
        }
    } finally {
        sincronizacaoContagensManuaisEmAndamento = false;
    }
}

function iniciarMonitoramentoContagensManuais() {
    if (intervaloSincronizacaoContagensManuais) {
        clearInterval(intervaloSincronizacaoContagensManuais);
    }

    intervaloSincronizacaoContagensManuais = setInterval(function() {
        atualizarContagensManuais();
    }, 10000);
}

function sincronizarContagemManualAoRetomar() {
    if (document.visibilityState === "hidden") return;
    atualizarContagensManuais();
}

window.addEventListener("focus", sincronizarContagemManualAoRetomar);
window.addEventListener("pageshow", sincronizarContagemManualAoRetomar);
document.addEventListener("visibilitychange", sincronizarContagemManualAoRetomar);

function exibirContagensManuais() {
    const area = document.getElementById("listaContagensManuais");
    if (!area) return;

    const lista = lerContagensManuais();
    area.innerHTML = "";

    if (!lista.length) {
        area.innerHTML = "<p>Nenhuma contagem manual registrada.</p>";
        return;
    }

    lista.slice(0, 100).forEach(registro => {
        const bloco = document.createElement("div");
        bloco.className = "registro-contagem-manual";

        const titulo = document.createElement("h3");
        titulo.textContent = registro.codigo + " — " + (registro.descricao || "Material");
        bloco.appendChild(titulo);

        const detalhes = document.createElement("p");
        detalhes.textContent = "Local: " + registro.localOriginal + " → " + registro.localEncontrado +
            " | Esperado: " + registro.quantidadeEsperada + " | Físico: " + registro.quantidadeFisica;
        bloco.appendChild(detalhes);

        const usuario = document.createElement("p");
        usuario.textContent = "Realizado por: " + (registro.usuarioNome || "Usuário não identificado");
        bloco.appendChild(usuario);

        const dataHora = document.createElement("p");
        dataHora.textContent = "Data/hora: " + (registro.dataHora ? new Date(registro.dataHora).toLocaleString("pt-BR") : "-");
        bloco.appendChild(dataHora);

        const flags = document.createElement("p");
        flags.textContent = (registro.localAlterado ? "LOCAL ALTERADO" : "LOCAL MANTIDO") +
            (registro.zerado ? " • ITEM ZERADO" : "");
        bloco.appendChild(flags);

        area.appendChild(bloco);
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const campo = document.getElementById("campoContagemManual");
    const tipoBusca = document.getElementById("tipoBuscaContagemManual");
    const placeholders = { codigo: "Digite o código", descricao: "Digite a descrição", referencia: "Digite a referência" };
    if (tipoBusca && campo) {
        tipoBusca.addEventListener("change", function() {
            campo.value = "";
            campo.placeholder = placeholders[tipoBusca.value] || "Digite para buscar";
            const area = document.getElementById("resultadoBuscaContagemManual");
            if (area) area.innerHTML = "";
            campo.focus();
        });
    }
    if (campo) {
        campo.addEventListener("keydown", function(evento) {
            if (evento.key === "Enter") buscarMaterialContagemManual();
        });
    }
    exibirContagensManuais();
    atualizarContagensManuais();
    iniciarMonitoramentoContagensManuais();
});
