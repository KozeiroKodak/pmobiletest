// ============================================================
// PMOBILE
// ARQUIVO: conferencia.js
// ============================================================
//
// OBJETIVO:
//
// Controlar a tela "Conferência".
//
// ARQUITETURA:
//
//     SUPABASE
//        ↓
//     fonte central
//
//     INDEXEDDB
//        ↓
//     fila local de conferências offline
//
// IMPORTANTE:
//
// A pesquisa de materiais continua sendo feita diretamente
// no Supabase.
//
// Nesta versão NÃO estamos implementando pesquisa offline.
//
// O objetivo desta etapa é testar:
//
//     CONFERÊNCIA OFFLINE
//          ↓
//     INDEXEDDB
//          ↓
//     INTERNET VOLTA
//          ↓
//     SUPABASE
//
// ============================================================


// ============================================================
// FUNÇÃO: obterClienteSupabaseConferencia()
// ============================================================
//
// OBJETIVO:
//
// Garantir que o cliente Supabase esteja disponível.
//
// RETORNO:
//
// Retorna o cliente Supabase.
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
//
// Escapar caracteres especiais utilizados pelo ILIKE.
//
// ============================================================

function escaparBuscaILikeConferencia(valor) {

    return String(valor)

        .replace(
            /\\/g,
            "\\\\"
        )

        .replace(
            /%/g,
            "\\%"
        )

        .replace(
            /_/g,
            "\\_"
        );

}


// ============================================================
// VARIÁVEL: materialConferenciaSelecionado
// ============================================================
//
// OBJETIVO:
//
// Armazenar temporariamente o material selecionado.
//
// ============================================================

let materialConferenciaSelecionado = null;


// ============================================================
// FUNÇÃO: buscarMaterialConferencia()
// ============================================================
//
// OBJETIVO:
//
// Pesquisar materiais diretamente no Supabase.
//
// CAMPOS:
//
// - código
// - descrição
// - referência
//
// NÃO PESQUISA:
//
// - Local
// - Marca
// - Quantidade
//
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


    if (!campo || !areaResultado) {

        console.error(
            "Elementos da tela de conferência não encontrados."
        );

        return;

    }


    const buscaOriginal =
        campo.value.trim();


    if (buscaOriginal === "") {

        areaResultado.innerHTML =
            "<p>Digite um código, descrição ou referência.</p>";

        return;

    }


    const busca =
        escaparBuscaILikeConferencia(
            buscaOriginal
        );


    areaResultado.innerHTML =
        "<p>Pesquisando no Supabase...</p>";


    try {

        const clienteSupabase =
            obterClienteSupabaseConferencia();


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
                    "%"
                )

                .order(
                    "codigo",
                    {
                        ascending: true
                    }
                )

                .limit(100);


        if (error) {

            throw error;

        }


        exibirResultadosConferencia(
            data || [],
            areaResultado
        );


    } catch (erro) {

        console.error(
            "Erro ao pesquisar material para conferência:",
            erro
        );


        areaResultado.innerHTML =
            "<p>❌ Erro ao consultar o Supabase.</p>";

    }

}


// ============================================================
// FUNÇÃO: exibirResultadosConferencia()
// ============================================================
//
// OBJETIVO:
//
// Mostrar os materiais encontrados.
//
// ============================================================

function exibirResultadosConferencia(
    resultados,
    areaResultado
) {

    areaResultado.innerHTML = "";


    if (
        !Array.isArray(resultados) ||
        resultados.length === 0
    ) {

        areaResultado.innerHTML =
            "<p>Nenhum material encontrado.</p>";

        return;

    }


    const fragmento =
        document.createDocumentFragment();


    resultados.forEach(
        function(material) {

            const bloco =
                document.createElement(
                    "div"
                );


            const linha =
                document.createElement(
                    "hr"
                );


            const titulo =
                document.createElement(
                    "h3"
                );

            titulo.textContent =
                material.descricao ||
                "Material";


            const codigo =
                document.createElement(
                    "p"
                );

            codigo.innerHTML =
                "<strong>Código:</strong> ";

            codigo.appendChild(
                document.createTextNode(
                    material.codigo ?? "-"
                )
            );


            const referencia =
                document.createElement(
                    "p"
                );

            referencia.innerHTML =
                "<strong>Referência:</strong> ";

            referencia.appendChild(
                document.createTextNode(
                    material.referencia ?? "-"
                )
            );


            const local =
                document.createElement(
                    "p"
                );

            local.innerHTML =
                "<strong>Local:</strong> ";

            local.appendChild(
                document.createTextNode(
                    material.local ?? "-"
                )
            );


            const marca =
                document.createElement(
                    "p"
                );

            marca.innerHTML =
                "<strong>Marca:</strong> ";

            marca.appendChild(
                document.createTextNode(
                    material.marca ?? "-"
                )
            );


            const quantidade =
                document.createElement(
                    "p"
                );

            quantidade.innerHTML =
                "<strong>Estoque esperado:</strong> ";

            quantidade.appendChild(
                document.createTextNode(
                    material.quantidade ?? "-"
                )
            );


            const botao =
                document.createElement(
                    "button"
                );

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


            bloco.appendChild(
                linha
            );

            bloco.appendChild(
                titulo
            );

            bloco.appendChild(
                codigo
            );

            bloco.appendChild(
                referencia
            );

            bloco.appendChild(
                local
            );

            bloco.appendChild(
                marca
            );

            bloco.appendChild(
                quantidade
            );

            bloco.appendChild(
                botao
            );


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
//
// Receber o material escolhido pelo usuário.
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


    areaResultado.innerHTML =
        "";


    const titulo =
        document.createElement(
            "h3"
        );

    titulo.textContent =
        material.descricao ||
        "Material";


    const codigo =
        document.createElement(
            "p"
        );

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );


    const referencia =
        document.createElement(
            "p"
        );

    referencia.innerHTML =
        "<strong>Referência:</strong> ";

    referencia.appendChild(
        document.createTextNode(
            material.referencia ?? "-"
        )
    );


    const local =
        document.createElement(
            "p"
        );

    local.innerHTML =
        "<strong>Local:</strong> ";

    local.appendChild(
        document.createTextNode(
            material.local ?? "-"
        )
    );


    const marca =
        document.createElement(
            "p"
        );

    marca.innerHTML =
        "<strong>Marca:</strong> ";

    marca.appendChild(
        document.createTextNode(
            material.marca ?? "-"
        )
    );


    const quantidade =
        document.createElement(
            "p"
        );

    quantidade.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    quantidade.appendChild(
        document.createTextNode(
            material.quantidade ?? "-"
        )
    );


    const linha =
        document.createElement(
            "hr"
        );


    const campoQuantidade =
        document.createElement(
            "input"
        );

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
        document.createElement(
            "button"
        );

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


    areaResultado.appendChild(
        titulo
    );

    areaResultado.appendChild(
        codigo
    );

    areaResultado.appendChild(
        referencia
    );

    areaResultado.appendChild(
        local
    );

    areaResultado.appendChild(
        marca
    );

    areaResultado.appendChild(
        quantidade
    );

    areaResultado.appendChild(
        linha
    );

    areaResultado.appendChild(
        campoQuantidade
    );

    areaResultado.appendChild(
        botaoConfirmar
    );


    campoQuantidade.focus();

}


// ============================================================
// FUNÇÃO: registrarContagem()
// ============================================================
//
// OBJETIVO:
//
// Registrar uma contagem física.
//
// COM INTERNET:
//
//     Contagem
//        ↓
//     Supabase
//
// SEM INTERNET:
//
//     Contagem
//        ↓
//     IndexedDB
//        ↓
//     fila pendente
//
// ============================================================

async function registrarContagem() {

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

        return;

    }


    const valor =
        campoQuantidade.value.trim();


    if (valor === "") {

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


    let status =
        "";

    let emoji =
        "";


    if (
        diferenca === 0
    ) {

        status =
            "OK / CONFERIDO";

        emoji =
            "✅";

    } else {

        status =
            "DIVERGÊNCIA";

        emoji =
            "❌";

    }


    // ========================================================
    // CRIAR SNAPSHOT DA CONFERÊNCIA
    // ========================================================

    const registroConferencia = {

        materialId:
            material.id ?? null,

        codigo:
            material.codigo ?? "",

        descricao:
            material.descricao ?? "",

        referencia:
            material.referencia || "",

        marca:
            material.marca || "",

        local:
            material.local || "",

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


    // ========================================================
    // TENTAR ENVIAR PARA O SUPABASE
    // ========================================================

    try {

        await salvarConferenciaSupabase(
            registroConferencia
        );


        console.log(
            "Conferência salva no Supabase com sucesso."
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


    } catch (erro) {

        console.error(
            "Erro ao salvar conferência no Supabase:",
            erro
        );


        // ====================================================
        // IMPORTANTE
        // ====================================================
        //
        // Só colocar na fila automaticamente quando o
        // navegador realmente estiver offline.
        //
        // Se estiver online e o Supabase apresentar erro
        // de banco/RLS/etc., não mascaramos o problema.
        //
        // ====================================================

        if (
            navigator.onLine
        ) {

            alert(
                "⚠️ Não foi possível salvar a conferência no Supabase.\n\n" +
                "A conexão com a internet está ativa, portanto a conferência NÃO foi colocada na fila offline.\n\n" +
                "Verifique o erro antes de tentar novamente."
            );

            return;

        }

    }


    // ========================================================
    // DISPOSITIVO ESTÁ OFFLINE
    // ========================================================

    try {

        await adicionarConferenciaPendente(
            registroConferencia
        );


        console.log(
            "📦 Conferência armazenada na fila offline."
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
            "Erro ao salvar conferência na fila offline:",
            erroFila
        );


        alert(
            "❌ Não foi possível salvar a conferência localmente."
        );

    }

}


// ============================================================
// FUNÇÃO: mostrarResultadoConferencia()
// ============================================================
//
// OBJETIVO:
//
// Mostrar resultado de uma conferência salva diretamente
// no Supabase.
//
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


    areaResultado.innerHTML =
        "";


    const titulo =
        document.createElement(
            "h3"
        );

    titulo.textContent =
        material.descricao ||
        "Material";


    const codigo =
        document.createElement(
            "p"
        );

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );


    const referencia =
        document.createElement(
            "p"
        );

    referencia.innerHTML =
        "<strong>Referência:</strong> ";

    referencia.appendChild(
        document.createTextNode(
            material.referencia ?? "-"
        )
    );


    const esperado =
        document.createElement(
            "p"
        );

    esperado.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    esperado.appendChild(
        document.createTextNode(
            quantidadeEsperada
        )
    );


    const fisico =
        document.createElement(
            "p"
        );

    fisico.innerHTML =
        "<strong>Quantidade física:</strong> ";

    fisico.appendChild(
        document.createTextNode(
            quantidadeFisica
        )
    );


    const diferencaElemento =
        document.createElement(
            "p"
        );

    diferencaElemento.innerHTML =
        "<strong>Diferença:</strong> ";

    diferencaElemento.appendChild(
        document.createTextNode(
            diferenca
        )
    );


    const linha =
        document.createElement(
            "hr"
        );


    const resultado =
        document.createElement(
            "p"
        );


    const statusTexto =
        document.createElement(
            "strong"
        );

    statusTexto.textContent =
        emoji +
        " " +
        status;


    resultado.appendChild(
        statusTexto
    );


    const mensagem =
        document.createElement(
            "p"
        );

    mensagem.textContent =
        "📌 Contagem registrada no Supabase.";


    const botaoNovaConsulta =
        document.createElement(
            "button"
        );

    botaoNovaConsulta.type =
        "button";

    botaoNovaConsulta.id =
        "botaoNovaConsulta";

    botaoNovaConsulta.textContent =
        "Nova consulta";


    botaoNovaConsulta.addEventListener(
        "click",
        function() {

            iniciarNovaConsultaConferencia();

        }
    );


    areaResultado.appendChild(
        titulo
    );

    areaResultado.appendChild(
        codigo
    );

    areaResultado.appendChild(
        referencia
    );

    areaResultado.appendChild(
        esperado
    );

    areaResultado.appendChild(
        fisico
    );

    areaResultado.appendChild(
        diferencaElemento
    );

    areaResultado.appendChild(
        linha
    );

    areaResultado.appendChild(
        resultado
    );

    areaResultado.appendChild(
        mensagem
    );

    areaResultado.appendChild(
        botaoNovaConsulta
    );


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
// FUNÇÃO: mostrarResultadoConferenciaOffline()
// ============================================================
//
// OBJETIVO:
//
// Mostrar ao usuário que a conferência foi salva localmente
// porque o dispositivo estava sem internet.
//
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


    areaResultado.innerHTML =
        "";


    const titulo =
        document.createElement(
            "h3"
        );

    titulo.textContent =
        material.descricao ||
        "Material";


    const codigo =
        document.createElement(
            "p"
        );

    codigo.innerHTML =
        "<strong>Código:</strong> ";

    codigo.appendChild(
        document.createTextNode(
            material.codigo ?? "-"
        )
    );


    const esperado =
        document.createElement(
            "p"
        );

    esperado.innerHTML =
        "<strong>Estoque esperado:</strong> ";

    esperado.appendChild(
        document.createTextNode(
            quantidadeEsperada
        )
    );


    const fisico =
        document.createElement(
            "p"
        );

    fisico.innerHTML =
        "<strong>Quantidade física:</strong> ";

    fisico.appendChild(
        document.createTextNode(
            quantidadeFisica
        )
    );


    const diferencaElemento =
        document.createElement(
            "p"
        );

    diferencaElemento.innerHTML =
        "<strong>Diferença:</strong> ";

    diferencaElemento.appendChild(
        document.createTextNode(
            diferenca
        )
    );


    const linha =
        document.createElement(
            "hr"
        );


    const resultado =
        document.createElement(
            "p"
        );


    const statusTexto =
        document.createElement(
            "strong"
        );

    statusTexto.textContent =
        emoji +
        " " +
        status;


    resultado.appendChild(
        statusTexto
    );


    const aviso =
        document.createElement(
            "p"
        );

    aviso.textContent =
        "📦 Conferência salva no dispositivo. " +
        "Aguardando conexão para sincronização.";


    const botaoNovaConsulta =
        document.createElement(
            "button"
        );

    botaoNovaConsulta.type =
        "button";

    botaoNovaConsulta.textContent =
        "Nova consulta";


    botaoNovaConsulta.addEventListener(
        "click",
        function() {

            iniciarNovaConsultaConferencia();

        }
    );


    areaResultado.appendChild(
        titulo
    );

    areaResultado.appendChild(
        codigo
    );

    areaResultado.appendChild(
        esperado
    );

    areaResultado.appendChild(
        fisico
    );

    areaResultado.appendChild(
        diferencaElemento
    );

    areaResultado.appendChild(
        linha
    );

    areaResultado.appendChild(
        resultado
    );

    areaResultado.appendChild(
        aviso
    );

    areaResultado.appendChild(
        botaoNovaConsulta
    );


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
//
// Preparar a tela para uma nova pesquisa.
//
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
            "<p>Digite um código, descrição ou referência.</p>";

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
// ============================================================
// FILA OFFLINE DE CONFERÊNCIAS
// ============================================================
// ============================================================
//
// BANCO SEPARADO DO BANCO DE MATERIAIS.
//
// Não altera:
//
//     PMOBILE
//     tabela materiais
//     IndexedDB de materiais
//
// Estrutura:
//
//     PMOBILE_FILA_CONFERENCIAS
//
//         └── conferencias_pendentes
//
// ============================================================


// ============================================================
// CONFIGURAÇÃO DO BANCO DA FILA
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
//
// Abrir o IndexedDB usado exclusivamente pela fila offline.
//
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
//
// Salvar uma conferência realizada offline.
//
// ============================================================

async function adicionarConferenciaPendente(
    conferencia
) {

    if (!conferencia) {

        throw new Error(
            "Conferência não informada."
        );

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
//
// Recuperar todas as conferências que aguardam sincronização.
//
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
//
// Remover da fila uma conferência que foi enviada com sucesso.
//
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
//
// Enviar para o Supabase as conferências realizadas offline.
//
// FLUXO:
//
//     IndexedDB
//          ↓
//     conferência pendente
//          ↓
//     Supabase
//          ↓
//     sucesso
//          ↓
//     remove da fila
//
// ============================================================

async function sincronizarConferenciasPendentes() {

    // ========================================================
    // VERIFICAR INTERNET
    // ========================================================

    if (
        !navigator.onLine
    ) {

        console.log(
            "📴 Dispositivo offline. Sincronização adiada."
        );

        return;

    }


    let pendentes;


    // ========================================================
    // CARREGAR FILA
    // ========================================================

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


    // ========================================================
    // PROCESSAR UMA POR UMA
    // ========================================================

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


            // ================================================
            // ENVIAR UTILIZANDO A MESMA FUNÇÃO NORMAL
            // DO PMOBILE
            // ================================================

            await salvarConferenciaSupabase(
                conferencia
            );


            // ================================================
            // SÓ REMOVE DA FILA APÓS SUCESSO
            // ================================================

            await removerConferenciaPendente(
                item.id
            );


            console.log(
                "✅ Conferência sincronizada:",
                conferencia.codigo
            );


        } catch (erro) {

            console.error(
                "❌ Falha ao sincronizar conferência:",
                erro
            );


            // =================================================
            // NÃO APAGAR DA FILA
            // =================================================
            //
            // Se falhar, o registro continua no IndexedDB.
            //
            // Será tentado novamente quando a conexão voltar.
            //
            // =================================================

            break;

        }

    }


    // ========================================================
    // VERIFICAR FILA NOVAMENTE
    // ========================================================

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

}


// ============================================================
// EVENTO: ONLINE
// ============================================================
//
// OBJETIVO:
//
// Quando a internet voltar, tentar sincronizar a fila.
//
// ============================================================

window.addEventListener(
    "online",
    function() {

        console.log(
            "🌐 Internet voltou."
        );


        console.log(
            "Verificando conferências pendentes..."
        );


        sincronizarConferenciasPendentes();

    }
);


// ============================================================
// INICIALIZAÇÃO DA FILA
// ============================================================
//
// OBJETIVO:
//
// Se o aplicativo iniciar conectado, verificar se existem
// conferências que ficaram pendentes de uma sessão anterior.
//
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        if (
            navigator.onLine
        ) {

            sincronizarConferenciasPendentes();

        }

    }
);


// ============================================================
// FIM DO ARQUIVO
// ============================================================
//
// AGORA:
//
// ✅ Pesquisa continua usando Supabase
// ✅ Seleção continua usando Supabase
// ✅ Quantidade esperada vem do Supabase
// ✅ Conferência online continua usando Supabase
// ✅ Conferência offline é armazenada no IndexedDB
// ✅ Fila offline é separada dos materiais
// ✅ Internet voltando dispara sincronização
// ✅ Registro só sai da fila depois de sucesso
// ✅ Falha de sincronização mantém o registro local
// ✅ IndexedDB de materiais não foi alterado
//
// PRÓXIMO PASSO:
//
// Testar:
//     ONLINE → selecionar material
//     ↓
//     OFFLINE → registrar conferência
//     ↓
//     verificar fila
//     ↓
//     ONLINE novamente
//     ↓
//     verificar sincronização no Supabase
//
// ============================================================