// ============================================================
// PMOBILE
// ARQUIVO: conferencia.js
// ============================================================
//
// OBJETIVO:
// Controlar a tela "Conferência" com funcionamento ONLINE e
// OFFLINE.
//
// ARQUITETURA:
//
// ONLINE:
//   pesquisa -> Supabase
//   conferência -> Supabase
//
// OFFLINE:
//   pesquisa -> IndexedDB (cópia local dos materiais)
//   conferência -> IndexedDB (fila pendente)
//
// QUANDO A INTERNET VOLTAR:
//
//   fila offline
//        ↓
//   Supabase
//        ↓
//   sucesso / já existente
//        ↓
//   remove somente o registro sincronizado
//
// IMPORTANTE:
//
// - O IndexedDB de materiais continua sendo administrado por
//   dados.js.
// - A fila de conferências usa um IndexedDB separado.
// - O conferencia_id é gerado uma única vez e acompanha a
//   conferência durante todo o ciclo.
// - Código/descrição/referência/marca são campos de pesquisa.
// - Local e quantidade NÃO são campos de pesquisa.
// - Se navigator.onLine disser ONLINE, mas o Supabase falhar,
//   o sistema também usa o banco local/fila quando apropriado.
// ============================================================


// ============================================================
// CONTROLES GERAIS
// ============================================================

let sincronizacaoConferenciasEmAndamento = false;

let registroConferenciaEmAndamento = false;

let materialConferenciaSelecionado = null;


// ============================================================
// FUNÇÃO: gerarIdConferencia()
// ============================================================
//
// OBJETIVO:
// Criar um ID único para cada conferência.
//
// O mesmo ID é usado:
//   criação -> fila offline -> Supabase
//
// O banco possui UNIQUE em conferencia_id.
// ============================================================

function gerarIdConferencia() {

    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {

        return crypto.randomUUID();

    }

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 14)
    );

}


// ============================================================
// FUNÇÃO: obterClienteSupabaseConferencia()
// ============================================================
//
// OBJETIVO:
// Retornar o cliente Supabase inicializado em supabase.js.
//
// ============================================================

function obterClienteSupabaseConferencia() {

    if (!window.clienteSupabase) {

        throw new Error(
            "Cliente Supabase não foi inicializado."
        );

    }

    return window.clienteSupabase;

}


// ============================================================
// FUNÇÃO: escaparBuscaILikeConferencia()
// ============================================================
//
// OBJETIVO:
// Escapar %, _ e \ para impedir que sejam interpretados como
// curingas pelo ILIKE do PostgreSQL.
// ============================================================

function escaparBuscaILikeConferencia(valor) {

    return String(valor)
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");

}


// ============================================================
// FUNÇÃO: obterMateriaisLocaisConferencia()
// ============================================================
//
// OBJETIVO:
// Garantir que a cópia local dos materiais esteja carregada.
//
// dados.js fornece:
//   carregarMateriais()
//   obterMateriaisLocais()
//
// ============================================================

async function obterMateriaisLocaisConferencia() {

    if (
        typeof carregarMateriais === "function"
    ) {

        await carregarMateriais();

    }

    if (
        typeof obterMateriaisLocais !== "function"
    ) {

        throw new Error(
            "Função obterMateriaisLocais() não encontrada."
        );

    }

    const locais =
        await obterMateriaisLocais();

    if (
        !Array.isArray(locais)
    ) {

        return [];

    }

    return locais;

}


// ============================================================
// FUNÇÃO: pesquisarMateriaisLocalmenteConferencia()
// ============================================================
//
// OBJETIVO:
// Pesquisar a cópia local do inventário.
//
// CAMPOS:
//   - código
//   - descrição
//   - referência
//   - marca
//
// NÃO PESQUISA:
//   - local
//   - quantidade
//
// A comparação é case-insensitive e utiliza includes().
// ============================================================

async function pesquisarMateriaisLocalmenteConferencia(
    buscaOriginal
) {

    const materiaisLocais =
        await obterMateriaisLocaisConferencia();

    const busca =
        String(buscaOriginal)
            .trim()
            .toLowerCase();

    if (
        !busca
    ) {

        return [];

    }

    return materiaisLocais.filter(
        function(material) {

            if (!material) {

                return false;

            }

            const codigo =
                String(material.codigo ?? "")
                    .toLowerCase();

            const descricao =
                String(material.descricao ?? "")
                    .toLowerCase();

            const referencia =
                String(material.referencia ?? "")
                    .toLowerCase();

            const marca =
                String(material.marca ?? "")
                    .toLowerCase();

            return (
                codigo.includes(busca) ||
                descricao.includes(busca) ||
                referencia.includes(busca) ||
                marca.includes(busca)
            );

        }
    );

}


// ============================================================
// FUNÇÃO: buscarMaterialConferencia()
// ============================================================
//
// OBJETIVO:
// Pesquisar materiais para iniciar uma conferência.
//
// FLUXO ONLINE:
//   tenta Supabase
//   se falhar -> fallback IndexedDB
//
// FLUXO OFFLINE:
//   IndexedDB diretamente
//
// IMPORTANTE:
// navigator.onLine não é tratado como garantia absoluta de
// acesso ao Supabase. Se o Supabase falhar, o banco local é
// utilizado.
// ============================================================

async function buscarMaterialConferencia() {

    const campo =
        document.getElementById(
            "campoConferencia"
        );

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );

    if (
        !campo ||
        !areaResultado
    ) {

        console.error(
            "Elementos da tela de conferência não encontrados."
        );

        return;

    }

    const buscaOriginal =
        campo.value.trim();

    if (
        buscaOriginal === ""
    ) {

        areaResultado.innerHTML =
            "<p>Digite um código, descrição, referência ou marca.</p>";

        return;

    }

    materialConferenciaSelecionado =
        null;

    areaResultado.innerHTML =
        "<p>Pesquisando...</p>";

    // ========================================================
    // MODO OFFLINE
    // ========================================================

    if (
        navigator.onLine === false
    ) {

        try {

            const resultados =
                await pesquisarMateriaisLocalmenteConferencia(
                    buscaOriginal
                );

            exibirResultadosConferencia(
                resultados,
                areaResultado,
                true
            );

        } catch (erro) {

            console.error(
                "Erro na pesquisa offline para conferência:",
                erro
            );

            areaResultado.innerHTML =
                "<p>❌ Não foi possível consultar o banco local.</p>";

        }

        return;

    }

    // ========================================================
    // MODO ONLINE
    // ========================================================

    try {

        const clienteSupabase =
            obterClienteSupabaseConferencia();

        const busca =
            escaparBuscaILikeConferencia(
                buscaOriginal
            );

        const { data, error } =
            await clienteSupabase

                .from("materiais")

                .select(
                    "id,codigo,descricao,referencia,marca,local,quantidade,quantidade_reservada,disponivel"
                )

                .or(
                    "codigo.ilike.%" +
                    busca +
                    "%,descricao.ilike.%" +
                    busca +
                    "%,referencia.ilike.%" +
                    busca +
                    "%,marca.ilike.%" +
                    busca +
                    "%"
                )

                .order(
                    "codigo",
                    {
                        ascending: true
                    }
                )

                .limit(100);

        if (
            error
        ) {

            throw error;

        }

        exibirResultadosConferencia(
            data || [],
            areaResultado,
            false
        );

    } catch (erro) {

        console.warn(
            "Supabase indisponível na pesquisa de conferência. Tentando IndexedDB:",
            erro
        );

        try {

            const resultadosLocais =
                await pesquisarMateriaisLocalmenteConferencia(
                    buscaOriginal
                );

            exibirResultadosConferencia(
                resultadosLocais,
                areaResultado,
                true
            );

        } catch (erroLocal) {

            console.error(
                "Falha também no banco local:",
                erroLocal
            );

            areaResultado.innerHTML =
                "<p>❌ Não foi possível consultar o Supabase nem o banco local.</p>";

        }

    }

}


// ============================================================
// FUNÇÃO: exibirResultadosConferencia()
// ============================================================
//
// OBJETIVO:
// Mostrar resultados encontrados online ou offline.
//
// O botão "Selecionar" passa o objeto inteiro para a tela de
// conferência.
//
// ============================================================

function exibirResultadosConferencia(
    resultados,
    areaResultado,
    modoOffline
) {

    if (
        !areaResultado
    ) {

        return;

    }

    areaResultado.innerHTML = "";

    if (
        !Array.isArray(resultados) ||
        resultados.length === 0
    ) {

        areaResultado.innerHTML =
            "<p>Nenhum material encontrado.</p>";

        return;

    }

    const aviso =
        document.createElement("p");

    aviso.textContent =
        modoOffline
            ? "📴 Pesquisa realizada no banco local."
            : "🌐 Pesquisa realizada no Supabase.";

    areaResultado.appendChild(
        aviso
    );

    const fragmento =
        document.createDocumentFragment();

    resultados.forEach(
        function(material) {

            const bloco =
                document.createElement("div");

            const linha =
                document.createElement("hr");

            const titulo =
                document.createElement("h3");

            titulo.textContent =
                material.descricao ||
                "Material";

            const codigo =
                document.createElement("p");

            codigo.innerHTML =
                "<strong>Código:</strong> ";

            codigo.appendChild(
                document.createTextNode(
                    material.codigo ?? "-"
                )
            );

            const referencia =
                document.createElement("p");

            referencia.innerHTML =
                "<strong>Referência:</strong> ";

            referencia.appendChild(
                document.createTextNode(
                    material.referencia ?? "-"
                )
            );

            const marca =
                document.createElement("p");

            marca.innerHTML =
                "<strong>Marca:</strong> ";

            marca.appendChild(
                document.createTextNode(
                    material.marca ?? "-"
                )
            );

            const local =
                document.createElement("p");

            local.innerHTML =
                "<strong>Local:</strong> ";

            local.appendChild(
                document.createTextNode(
                    material.local ?? "-"
                )
            );

            const quantidade =
                document.createElement("p");

            quantidade.innerHTML =
                "<strong>Estoque esperado:</strong> ";

            quantidade.appendChild(
                document.createTextNode(
                    material.quantidade ?? "-"
                )
            );

            const botao =
                document.createElement("button");

            botao.type =
                "button";

            botao.textContent =
                "Selecionar";

            botao.addEventListener(
                "click",
                function() {

                    selecionarMaterialConferencia(
                        material
                    );

                }
            );

            bloco.appendChild(linha);
            bloco.appendChild(titulo);
            bloco.appendChild(codigo);
            bloco.appendChild(referencia);
            bloco.appendChild(marca);
            bloco.appendChild(local);
            bloco.appendChild(quantidade);
            bloco.appendChild(botao);

            fragmento.appendChild(
                bloco
            );

        }
    );

    areaResultado.appendChild(
        fragmento
    );

}


// ============================================================
// FUNÇÃO: selecionarMaterialConferencia()
// ============================================================
//
// OBJETIVO:
// Selecionar o material e preparar a entrada da quantidade
// física.
//
// O objeto selecionado pode vir do Supabase ou do IndexedDB.
//
// ============================================================

function selecionarMaterialConferencia(
    material
) {

    if (!material) {

        console.error(
            "Material inválido para conferência."
        );

        return;

    }

    materialConferenciaSelecionado =
        material;

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );

    if (!areaResultado) {

        return;

    }

    areaResultado.innerHTML = "";

    const titulo =
        document.createElement("h3");

    titulo.textContent =
        material.descricao ||
        "Material";

    const codigo =
        document.createElement("p");

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );

    const referencia =
        document.createElement("p");

    referencia.innerHTML =
        "<strong>Referência:</strong> ";

    referencia.appendChild(
        document.createTextNode(
            material.referencia ?? "-"
        )
    );

    const marca =
        document.createElement("p");

    marca.innerHTML =
        "<strong>Marca:</strong> ";

    marca.appendChild(
        document.createTextNode(
            material.marca ?? "-"
        )
    );

    const local =
        document.createElement("p");

    local.innerHTML =
        "<strong>Local:</strong> ";

    local.appendChild(
        document.createTextNode(
            material.local ?? "-"
        )
    );

    const quantidade =
        document.createElement("p");

    quantidade.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    quantidade.appendChild(
        document.createTextNode(
            material.quantidade ?? "-"
        )
    );

    const linha =
        document.createElement("hr");

    const campoQuantidade =
        document.createElement("input");

    campoQuantidade.type =
        "number";

    campoQuantidade.id =
        "campoQuantidadeFisica";

    campoQuantidade.placeholder =
        "Quantidade física";

    campoQuantidade.min =
        "0";

    campoQuantidade.step =
        "1";

    const botaoConfirmar =
        document.createElement("button");

    botaoConfirmar.type =
        "button";

    botaoConfirmar.id =
        "botaoConfirmarContagem";

    botaoConfirmar.textContent =
        "CONFIRMAR";

    botaoConfirmar.addEventListener(
        "click",
        function() {

            registrarContagem();

        }
    );

    areaResultado.appendChild(titulo);
    areaResultado.appendChild(codigo);
    areaResultado.appendChild(referencia);
    areaResultado.appendChild(marca);
    areaResultado.appendChild(local);
    areaResultado.appendChild(quantidade);
    areaResultado.appendChild(linha);
    areaResultado.appendChild(campoQuantidade);
    areaResultado.appendChild(botaoConfirmar);

    campoQuantidade.focus();

}


// ============================================================
// FUNÇÃO: registrarContagem()
// ============================================================
//
// OBJETIVO:
// Registrar a contagem física.
//
// PRIMEIRA TENTATIVA:
//   Supabase.
//
// SE O SUPABASE FALHAR:
//   a conferência é colocada na fila local.
//
// IMPORTANTE:
//
// Diferentemente da versão anterior, não dependemos somente
// de navigator.onLine para decidir se podemos usar a fila.
// Se o aparelho disser "online", mas o Supabase estiver
// inacessível, a conferência também fica protegida localmente.
//
// ============================================================

async function registrarContagem() {

    if (
        registroConferenciaEmAndamento
    ) {

        console.warn(
            "Registro de conferência já está em andamento."
        );

        return;

    }

    registroConferenciaEmAndamento =
        true;

    const botaoConfirmar =
        document.getElementById(
            "botaoConfirmarContagem"
        );

    if (botaoConfirmar) {

        botaoConfirmar.disabled =
            true;

        botaoConfirmar.textContent =
            "SALVANDO...";

    }

    try {

        const material =
            materialConferenciaSelecionado;

        if (!material) {

            alert(
                "Nenhum material foi selecionado."
            );

            return;

        }

        const campoQuantidade =
            document.getElementById(
                "campoQuantidadeFisica"
            );

        if (!campoQuantidade) {

            alert(
                "Campo de quantidade física não encontrado."
            );

            return;

        }

        const valor =
            campoQuantidade.value.trim();

        if (
            valor === ""
        ) {

            alert(
                "Informe a quantidade física."
            );

            return;

        }

        const quantidadeFisica =
            Number(valor);

        if (
            !Number.isFinite(
                quantidadeFisica
            ) ||
            quantidadeFisica < 0
        ) {

            alert(
                "Informe uma quantidade válida."
            );

            return;

        }

        const quantidadeEsperada =
            Number(
                material.quantidade ?? 0
            );

        const diferenca =
            quantidadeFisica -
            quantidadeEsperada;

        const status =
            diferenca === 0
                ? "OK / CONFERIDO"
                : "DIVERGÊNCIA";

        const emoji =
            diferenca === 0
                ? "✅"
                : "❌";

        const conferenciaId =
            gerarIdConferencia();

        const registroConferencia = {

            conferenciaId:

                conferenciaId,

            materialId:

                material.id ??
                material.idSupabase ??
                null,

            codigo:

                material.codigo ??
                "",

            descricao:

                material.descricao ??
                "",

            referencia:

                material.referencia ||
                "",

            marca:

                material.marca ||
                "",

            local:

                material.local ||
                "",

            quantidadeEsperada:

                quantidadeEsperada,

            quantidadeFisica:

                quantidadeFisica,

            diferenca:

                diferenca,

            status:

                status,

            data:

                new Date().toISOString()

        };

        // ====================================================
        // TENTAR SALVAR NO SUPABASE
        // ====================================================

        try {

            if (
                navigator.onLine === false
            ) {

                throw new Error(
                    "Dispositivo está offline."
                );

            }

            await salvarConferenciaSupabase(
                registroConferencia
            );

            console.log(
                "✅ Conferência salva no Supabase:",
                conferenciaId
            );

            mostrarResultadoConferencia(
                material,
                quantidadeEsperada,
                quantidadeFisica,
                diferenca,
                status,
                emoji
            );

            return;

        } catch (erroSupabase) {

            console.warn(
                "⚠️ Supabase não disponível para esta conferência. Salvando na fila local.",
                erroSupabase
            );

        }

        // ====================================================
        // FALLBACK LOCAL
        // ====================================================

        try {

            await adicionarConferenciaPendente(
                registroConferencia
            );

            console.log(
                "📦 Conferência salva na fila offline:",
                conferenciaId
            );

            mostrarResultadoConferenciaOffline(
                material,
                quantidadeEsperada,
                quantidadeFisica,
                diferenca,
                status,
                emoji
            );

        } catch (erroFila) {

            console.error(
                "❌ Erro ao salvar conferência na fila:",
                erroFila
            );

            alert(
                "❌ Não foi possível salvar a conferência nem no Supabase nem no dispositivo.\n\n" +
                "A contagem NÃO foi concluída."
            );

        }

    } finally {

        registroConferenciaEmAndamento =
            false;

    }

}


// ============================================================
// FUNÇÃO: mostrarResultadoConferencia()
// ============================================================
//
// OBJETIVO:
// Mostrar resultado de conferência enviada diretamente ao
// Supabase.
// ============================================================

function mostrarResultadoConferencia(
    material,
    quantidadeEsperada,
    quantidadeFisica,
    diferenca,
    status,
    emoji
) {

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );

    if (!areaResultado) {

        return;

    }

    areaResultado.innerHTML = "";

    const titulo =
        document.createElement("h3");

    titulo.textContent =
        material.descricao ||
        "Material";

    const codigo =
        document.createElement("p");

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );

    const referencia =
        document.createElement("p");

    referencia.innerHTML =
        "<strong>Referência:</strong> ";

    referencia.appendChild(
        document.createTextNode(
            material.referencia ?? "-"
        )
    );

    const esperado =
        document.createElement("p");

    esperado.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    esperado.appendChild(
        document.createTextNode(
            quantidadeEsperada
        )
    );

    const fisico =
        document.createElement("p");

    fisico.innerHTML =
        "<strong>Quantidade física:</strong> ";

    fisico.appendChild(
        document.createTextNode(
            quantidadeFisica
        )
    );

    const diferencaElemento =
        document.createElement("p");

    diferencaElemento.innerHTML =
        "<strong>Diferença:</strong> ";

    diferencaElemento.appendChild(
        document.createTextNode(
            diferenca
        )
    );

    const linha =
        document.createElement("hr");

    const resultado =
        document.createElement("p");

    const statusTexto =
        document.createElement("strong");

    statusTexto.textContent =
        emoji +
        " " +
        status;

    resultado.appendChild(
        statusTexto
    );

    const mensagem =
        document.createElement("p");

    mensagem.textContent =
        "📌 Contagem registrada no Supabase.";

    const botaoNovaConsulta =
        criarBotaoNovaConsultaConferencia();

    areaResultado.appendChild(titulo);
    areaResultado.appendChild(codigo);
    areaResultado.appendChild(referencia);
    areaResultado.appendChild(esperado);
    areaResultado.appendChild(fisico);
    areaResultado.appendChild(diferencaElemento);
    areaResultado.appendChild(linha);
    areaResultado.appendChild(resultado);
    areaResultado.appendChild(mensagem);
    areaResultado.appendChild(botaoNovaConsulta);

    limparSelecaoConferencia();

}


// ============================================================
// FUNÇÃO: mostrarResultadoConferenciaOffline()
// ============================================================
//
// OBJETIVO:
// Informar que a conferência foi salva localmente e está
// aguardando sincronização.
// ============================================================

function mostrarResultadoConferenciaOffline(
    material,
    quantidadeEsperada,
    quantidadeFisica,
    diferenca,
    status,
    emoji
) {

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );

    if (!areaResultado) {

        return;

    }

    areaResultado.innerHTML = "";

    const titulo =
        document.createElement("h3");

    titulo.textContent =
        material.descricao ||
        "Material";

    const codigo =
        document.createElement("p");

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );

    const esperado =
        document.createElement("p");

    esperado.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    esperado.appendChild(
        document.createTextNode(
            quantidadeEsperada
        )
    );

    const fisico =
        document.createElement("p");

    fisico.innerHTML =
        "<strong>Quantidade física:</strong> ";

    fisico.appendChild(
        document.createTextNode(
            quantidadeFisica
        )
    );

    const diferencaElemento =
        document.createElement("p");

    diferencaElemento.innerHTML =
        "<strong>Diferença:</strong> ";

    diferencaElemento.appendChild(
        document.createTextNode(
            diferenca
        )
    );

    const linha =
        document.createElement("hr");

    const resultado =
        document.createElement("p");

    const statusTexto =
        document.createElement("strong");

    statusTexto.textContent =
        emoji +
        " " +
        status;

    resultado.appendChild(
        statusTexto
    );

    const aviso =
        document.createElement("p");

    aviso.textContent =
        "📦 Conferência salva no dispositivo. " +
        "Aguardando conexão para sincronização.";

    const botaoNovaConsulta =
        criarBotaoNovaConsultaConferencia();

    areaResultado.appendChild(titulo);
    areaResultado.appendChild(codigo);
    areaResultado.appendChild(esperado);
    areaResultado.appendChild(fisico);
    areaResultado.appendChild(diferencaElemento);
    areaResultado.appendChild(linha);
    areaResultado.appendChild(resultado);
    areaResultado.appendChild(aviso);
    areaResultado.appendChild(botaoNovaConsulta);

    limparSelecaoConferencia();

}


// ============================================================
// FUNÇÃO: criarBotaoNovaConsultaConferencia()
// ============================================================
//
// OBJETIVO:
// Criar o botão usado após finalizar uma conferência.
// ============================================================

function criarBotaoNovaConsultaConferencia() {

    const botao =
        document.createElement("button");

    botao.type =
        "button";

    botao.id =
        "botaoNovaConsulta";

    botao.textContent =
        "Nova consulta";

    botao.addEventListener(
        "click",
        function() {

            iniciarNovaConsultaConferencia();

        }
    );

    return botao;

}


// ============================================================
// FUNÇÃO: limparSelecaoConferencia()
// ============================================================
//
// OBJETIVO:
// Limpar o material selecionado e o campo de pesquisa.
// ============================================================

function limparSelecaoConferencia() {

    materialConferenciaSelecionado =
        null;

    const campoPesquisa =
        document.getElementById(
            "campoConferencia"
        );

    if (campoPesquisa) {

        campoPesquisa.value =
            "";

    }

}


// ============================================================
// FUNÇÃO: iniciarNovaConsultaConferencia()
// ============================================================
//
// OBJETIVO:
// Preparar a tela para uma nova pesquisa.
// ============================================================

function iniciarNovaConsultaConferencia() {

    materialConferenciaSelecionado =
        null;

    const areaResultado =
        document.getElementById(
            "resultadoConferencia"
        );

    if (areaResultado) {

        areaResultado.innerHTML =
            "<p>Digite um código, descrição, referência ou marca.</p>";

    }

    const campo =
        document.getElementById(
            "campoConferencia"
        );

    if (campo) {

        campo.value =
            "";

        campo.focus();

    }

}


// ============================================================
// FILA OFFLINE DE CONFERÊNCIAS
// ============================================================
//
// BANCO SEPARADO:
//
//   PMOBILE_FILA_CONFERENCIAS
//
// STORE:
//
//   conferencias_pendentes
//
// O banco de materiais não é alterado por esta fila.
// ============================================================

const nomeBancoFilaConferencias =
    "PMOBILE_FILA_CONFERENCIAS";

const versaoBancoFilaConferencias =
    1;

const nomeTabelaFilaConferencias =
    "conferencias_pendentes";


// ============================================================
// FUNÇÃO: abrirBancoFilaConferencias()
// ============================================================
//
// OBJETIVO:
// Abrir/criar o IndexedDB exclusivo da fila.
// ============================================================

function abrirBancoFilaConferencias() {

    return new Promise(
        function(resolve, reject) {

            const requisicao =
                indexedDB.open(
                    nomeBancoFilaConferencias,
                    versaoBancoFilaConferencias
                );

            requisicao.onupgradeneeded =
                function(evento) {

                    const banco =
                        evento.target.result;

                    if (
                        !banco.objectStoreNames.contains(
                            nomeTabelaFilaConferencias
                        )
                    ) {

                        banco.createObjectStore(
                            nomeTabelaFilaConferencias,
                            {
                                keyPath: "id",
                                autoIncrement: true
                            }
                        );

                    }

                };

            requisicao.onsuccess =
                function(evento) {

                    resolve(
                        evento.target.result
                    );

                };

            requisicao.onerror =
                function(evento) {

                    reject(
                        evento.target.error
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: adicionarConferenciaPendente()
// ============================================================
//
// OBJETIVO:
// Adicionar uma conferência à fila.
//
// PROTEÇÃO:
// O mesmo conferenciaId não é adicionado duas vezes.
// ============================================================

async function adicionarConferenciaPendente(
    conferencia
) {

    if (!conferencia) {

        throw new Error(
            "Conferência não informada."
        );

    }

    if (
        !conferencia.conferenciaId
    ) {

        throw new Error(
            "Conferência sem ID único."
        );

    }

    const existentes =
        await obterConferenciasPendentes();

    const duplicada =
        existentes.some(
            function(item) {

                return (
                    item &&
                    item.conferencia &&
                    item.conferencia.conferenciaId ===
                    conferencia.conferenciaId
                );

            }
        );

    if (
        duplicada
    ) {

        console.warn(
            "Conferência já existe na fila:",
            conferencia.conferenciaId
        );

        return;

    }

    const banco =
        await abrirBancoFilaConferencias();

    const transacao =
        banco.transaction(
            nomeTabelaFilaConferencias,
            "readwrite"
        );

    const tabela =
        transacao.objectStore(
            nomeTabelaFilaConferencias
        );

    tabela.add({

        conferencia:
            conferencia,

        criadaEm:
            new Date().toISOString()

    });

    return new Promise(
        function(resolve, reject) {

            transacao.oncomplete =
                function() {

                    banco.close();

                    resolve();

                };

            transacao.onerror =
                function(evento) {

                    banco.close();

                    reject(
                        evento.target.error
                    );

                };

            transacao.onabort =
                function(evento) {

                    banco.close();

                    reject(
                        evento.target.error ||
                        new Error(
                            "Transação abortada."
                        )
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: obterConferenciasPendentes()
// ============================================================
//
// OBJETIVO:
// Recuperar todas as conferências aguardando sincronização.
// ============================================================

async function obterConferenciasPendentes() {

    const banco =
        await abrirBancoFilaConferencias();

    const transacao =
        banco.transaction(
            nomeTabelaFilaConferencias,
            "readonly"
        );

    const tabela =
        transacao.objectStore(
            nomeTabelaFilaConferencias
        );

    const requisicao =
        tabela.getAll();

    return new Promise(
        function(resolve, reject) {

            requisicao.onsuccess =
                function(evento) {

                    banco.close();

                    resolve(
                        evento.target.result || []
                    );

                };

            requisicao.onerror =
                function(evento) {

                    banco.close();

                    reject(
                        evento.target.error
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: removerConferenciaPendente()
// ============================================================
//
// OBJETIVO:
// Remover da fila somente após confirmação de sucesso.
// ============================================================

async function removerConferenciaPendente(
    id
) {

    const banco =
        await abrirBancoFilaConferencias();

    const transacao =
        banco.transaction(
            nomeTabelaFilaConferencias,
            "readwrite"
        );

    const tabela =
        transacao.objectStore(
            nomeTabelaFilaConferencias
        );

    tabela.delete(
        id
    );

    return new Promise(
        function(resolve, reject) {

            transacao.oncomplete =
                function() {

                    banco.close();

                    resolve();

                };

            transacao.onerror =
                function(evento) {

                    banco.close();

                    reject(
                        evento.target.error
                    );

                };

            transacao.onabort =
                function(evento) {

                    banco.close();

                    reject(
                        evento.target.error ||
                        new Error(
                            "Transação abortada."
                        )
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: sincronizarConferenciasPendentes()
// ============================================================
//
// OBJETIVO:
// Enviar a fila offline para o Supabase.
//
// REGRAS:
//
// - somente uma sincronização por vez;
// - se ficar offline durante o processo, para;
// - sucesso -> remove da fila;
// - conferencia_id já existente -> tratado pela função
//   salvarConferenciaSupabase();
// - erro -> mantém na fila.
// ============================================================

async function sincronizarConferenciasPendentes() {

    if (
        sincronizacaoConferenciasEmAndamento
    ) {

        console.warn(
            "⚠️ Sincronização de conferências já está em andamento."
        );

        return;

    }

    if (
        navigator.onLine === false
    ) {

        console.log(
            "📴 Dispositivo offline. Sincronização adiada."
        );

        return;

    }

    sincronizacaoConferenciasEmAndamento =
        true;

    try {

        let pendentes;

        try {

            pendentes =
                await obterConferenciasPendentes();

        } catch (erro) {

            console.error(
                "Erro ao carregar fila de conferências:",
                erro
            );

            return;

        }

        if (
            pendentes.length === 0
        ) {

            console.log(
                "Nenhuma conferência pendente para sincronizar."
            );

            return;

        }

        console.log(
            "📦 Conferências pendentes:",
            pendentes.length
        );

        for (
            const item of pendentes
        ) {

            try {

                const conferencia =
                    item.conferencia;

                if (!conferencia) {

                    console.warn(
                        "Registro pendente inválido:",
                        item
                    );

                    continue;

                }

                if (
                    !conferencia.conferenciaId
                ) {

                    console.error(
                        "❌ Registro pendente sem conferenciaId:",
                        item
                    );

                    continue;

                }

                if (
                    navigator.onLine === false
                ) {

                    console.warn(
                        "📴 Internet caiu durante a sincronização."
                    );

                    break;

                }

                await salvarConferenciaSupabase(
                    conferencia
                );

                await removerConferenciaPendente(
                    item.id
                );

                console.log(
                    "✅ Conferência sincronizada:",
                    conferencia.codigo,
                    conferencia.conferenciaId
                );

            } catch (erro) {

                console.error(
                    "❌ Falha ao sincronizar conferência:",
                    erro
                );

                // Não remove.
                // O registro será tentado novamente.

                break;

            }

        }

        try {

            const restantes =
                await obterConferenciasPendentes();

            console.log(
                "Conferências restantes na fila:",
                restantes.length
            );

            if (
                restantes.length === 0
            ) {

                console.log(
                    "✅ Fila de conferências sincronizada."
                );

            }

        } catch (erro) {

            console.error(
                "Erro ao verificar fila:",
                erro
            );

        }

    } finally {

        sincronizacaoConferenciasEmAndamento =
            false;

    }

}


// ============================================================
// FUNÇÃO: sincronizarQuandoPossivel()
// ============================================================
//
// OBJETIVO:
// Tentar sincronizar a fila quando o aplicativo for aberto.
//
// navigator.onLine é apenas uma primeira indicação. A própria
// rotina de sincronização trata erros de acesso ao Supabase.
// ============================================================

function sincronizarQuandoPossivel() {

    if (
        navigator.onLine === true
    ) {

        sincronizarConferenciasPendentes();

    }

}


// ============================================================
// EVENTO: ONLINE
// ============================================================
//
// OBJETIVO:
// Quando o navegador detectar retorno da conexão, iniciar a
// sincronização automaticamente.
// ============================================================

window.addEventListener(
    "online",
    function() {

        console.log(
            "🌐 Internet voltou. Sincronizando conferências..."
        );

        sincronizarConferenciasPendentes();

    }
);


// ============================================================
// INICIALIZAÇÃO
// ============================================================
//
// Se o aplicativo abrir online, verifica a fila anterior.
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        sincronizarQuandoPossivel();

    }
);


// ============================================================
// FIM DO ARQUIVO
// ============================================================
//
// FUNCIONALIDADES DESTA VERSÃO:
//
// ✅ Pesquisa online no Supabase
// ✅ Pesquisa offline no IndexedDB
// ✅ Fallback automático para IndexedDB se o Supabase falhar
// ✅ Pesquisa por código
// ✅ Pesquisa por descrição
// ✅ Pesquisa por referência
// ✅ Pesquisa por marca
// ✅ Local não é usado como campo de pesquisa
// ✅ Quantidade não é usada como campo de pesquisa
// ✅ Seleção funciona com material online ou offline
// ✅ Conferência online salva no Supabase
// ✅ Conferência offline salva na fila local
// ✅ Falha do Supabase também pode cair na fila local
// ✅ conferencia_id único
// ✅ Proteção contra duplo clique
// ✅ Proteção contra duas sincronizações simultâneas
// ✅ Fila em IndexedDB separado
// ✅ Sincronização automática ao voltar online
// ✅ Registro removido da fila somente após sucesso
// ✅ conferencia_id duplicado é tratado pelo Supabase
// ✅ Falha de sincronização mantém a conferência local
//
// TESTE RECOMENDADO:
//
// 1. Substituir este arquivo.
// 2. Recarregar o PMOBILE.
// 3. ONLINE:
//      pesquisar um material;
//      selecionar;
//      realizar uma conferência;
//      confirmar no Supabase.
// 4. OFFLINE:
//      desligar internet;
//      pesquisar o mesmo material;
//      selecionar;
//      realizar conferência;
//      confirmar;
//      verificar mensagem de fila local.
// 5. Voltar ONLINE.
// 6. Verificar console:
//      "Conferência sincronizada".
// 7. Conferir a tabela public.conferencias.
// 8. Confirmar que existe somente uma linha para o
//    conferencia_id.
// 9. Repetir o teste offline para uma divergência.
//
// ============================================================
