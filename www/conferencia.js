// PMobile — fila offline de conferências.
// Mantém a leitura, persistência e sincronização de registros pendentes.
// A interface de consulta substituída foi removida; o banco e os IDs permanecem.

let sincronizacaoConferenciasEmAndamento = false;

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

}// ============================================================
// FUNÇÃO: mostrarStatusSincronizacaoConferencias()
// ============================================================
//
// OBJETIVO:
// Mostrar na barra de status do Supabase as mensagens
// relacionadas à sincronização da fila de conferências.
//
// A função utiliza a mesma barra criada pelo supabase.js.
//
// O parâmetro true mantém esta mensagem como prioritária,
// evitando que mensagens normais do Supabase sobrescrevam
// o status enquanto a sincronização estiver sendo exibida.
// ============================================================

function mostrarStatusSincronizacaoConferencias(
    mensagem
) {

    if (
        typeof mostrarStatusSupabase === "function"
    ) {

        mostrarStatusSupabase(
            mensagem,
            true
        );

    } else {

        console.warn(
            "Função mostrarStatusSupabase() não encontrada:",
            mensagem
        );

    }

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
// - erro -> mantém na fila;
// - status da sincronização aparece na barra do Supabase.
//
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

        mostrarStatusSincronizacaoConferencias(
            "🟡 Sincronização aguardando conexão com o Supabase."
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

            mostrarStatusSincronizacaoConferencias(
                "🔴 Erro ao carregar a fila de conferências."
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

        mostrarStatusSincronizacaoConferencias(
            "🟡 Sincronizando conferências... 0 de " +
            pendentes.length
        );

        let sincronizadas =
            0;

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

                    mostrarStatusSincronizacaoConferencias(
                        "📴 Internet caiu — " +
                        (
                            pendentes.length -
                            sincronizadas
                        ) +
                        " conferência(s) permanecem na fila."
                    );

                    break;

                }

                await salvarConferenciaSupabase(
                    conferencia
                );

                await removerConferenciaPendente(
                    item.id
                );

                sincronizadas++;

                console.log(
                    "✅ Conferência sincronizada:",
                    conferencia.codigo,
                    conferencia.conferenciaId
                );

                mostrarStatusSincronizacaoConferencias(
                    "🟡 Sincronizando conferências... " +
                    sincronizadas +
                    " de " +
                    pendentes.length
                );

            } catch (erro) {

                console.error(
                    "❌ Falha ao sincronizar conferência:",
                    erro
                );

                // Não remove.
                // O registro será tentado novamente.

                mostrarStatusSincronizacaoConferencias(
                    "🔴 Falha na sincronização — " +
                    (
                        pendentes.length -
                        sincronizadas
                    ) +
                    " conferência(s) permanecem na fila."
                );

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

                mostrarStatusSincronizacaoConferencias(
                    "🟢 Conferências sincronizadas com sucesso — " +
                    sincronizadas +
                    " conferência(s)."
                );

            } else if (
                navigator.onLine === false
            ) {

                console.log(
                    "📴 Sincronização interrompida porque a internet caiu."
                );

                mostrarStatusSincronizacaoConferencias(
                    "📴 Sincronização interrompida — " +
                    restantes.length +
                    " conferência(s) permanecem na fila."
                );

            } else {

                console.warn(
                    "⚠️ Ainda existem conferências pendentes:",
                    restantes.length
                );

                mostrarStatusSincronizacaoConferencias(
                    "🔴 Sincronização incompleta — " +
                    restantes.length +
                    " conferência(s) permanecem na fila."
                );

            }

        } catch (erro) {

            console.error(
                "Erro ao verificar fila:",
                erro
            );

            mostrarStatusSincronizacaoConferencias(
                "🔴 Não foi possível verificar a fila de conferências."
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
//
// A mensagem também aparece na barra de status.
// ============================================================

window.addEventListener(
    "online",
    function() {

        console.log(
            "🌐 Internet voltou. Sincronizando conferências..."
        );

        mostrarStatusSincronizacaoConferencias(
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

let intervaloSincronizacaoBackgroundConferencia = null;

function iniciarSincronizacaoBackgroundConferencia() {

    if (intervaloSincronizacaoBackgroundConferencia !== null) {
        return;
    }

    sincronizarQuandoPossivel();

    intervaloSincronizacaoBackgroundConferencia = setInterval(
        function() {
            if (navigator.onLine === true) {
                sincronizarConferenciasPendentes();
            }
        },
        10000
    );

}

document.addEventListener(
    "DOMContentLoaded",
    function() {

        iniciarSincronizacaoBackgroundConferencia();

    }
);


