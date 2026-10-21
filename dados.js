// ============================================================
// PMOBILE
// ARQUIVO: dados.js
// ============================================================
//
// CAMADA LOCAL DE DADOS DO PMOBILE
//
// RESPONSABILIDADES:
//
// - controlar o IndexedDB;
// - manter uma cópia local do inventário;
// - preservar o ID original do Supabase;
// - carregar materiais para uso offline;
// - sincronizar o inventário do Supabase para o dispositivo;
// - permitir que Pesquisa e Conferência funcionem offline.
//
// ARQUITETURA:
//
//                 SUPABASE
//              FONTE CENTRAL
//                    |
//                    |
//              SINCRONIZAÇÃO
//                    |
//                    v
//                INDEXEDDB
//              CÓPIA LOCAL
//                    |
//             +------+------ +
//             |             |
//          PESQUISA     CONFERÊNCIA
//           OFFLINE       OFFLINE
//
// IMPORTANTE:
//
// Supabase continua sendo a fonte oficial.
//
// IndexedDB é somente a cópia local utilizada quando:
//
// - não existe internet;
// - Supabase está indisponível;
// - o usuário está trabalhando offline.
//
// ============================================================


// ============================================================
// CONFIGURAÇÃO DO INDEXEDDB
// ============================================================

const nomeBanco =
    "PMOBILE";


// ============================================================
// VERSÃO DO BANCO
// ============================================================
//
// VERSÃO 2:
// - materiais utilizam idSupabase como keyPath.
//
// VERSÃO 3:
// - mantém a estrutura dos materiais;
// - adiciona o objectStore "configuracoes";
//
// Esse novo store será utilizado para guardar informações
// sobre a sincronização local.
//
// ============================================================

const versaoBanco =
    3;


const nomeTabela =
    "materiais";


const nomeTabelaConfiguracoes =
    "configuracoes";


// ============================================================
// CONFIGURAÇÃO DA SINCRONIZAÇÃO
// ============================================================
//
// Quantidade de registros solicitados por página.
//
// O Supabase possui limite padrão de retorno e recomenda
// paginação para grandes quantidades de dados.
//
// ============================================================

const tamanhoPaginaSincronizacao =
    1000;


// ============================================================
// CHAVES DE CONFIGURAÇÃO
// ============================================================

const chaveUltimaSincronizacao =
    "ultima_sincronizacao_materiais";

const chaveVersaoInventarioLocal =
    "versao_inventario_materiais";

const chaveSincronizacaoInventarioEmAndamento =
    "sincronizacao_inventario_em_andamento";


// ============================================================
// CONTROLE DE INVENTÁRIO ZERADO
// ============================================================
//
// Mantido para compatibilidade com o PMOBILE.
//
// IMPORTANTE:
//
// Essa marcação é LOCAL.
//
// Ela não apaga nem altera o Supabase.
//
// ============================================================

const chaveInventarioZerado =
    "pmobile_inventario_zerado";


// ============================================================
// MATERIAIS EM MEMÓRIA
// ============================================================
//
// Esta variável representa a cópia atualmente carregada
// para a aplicação.
//
// ============================================================

let materiais = [];


// ============================================================
// CONTROLE DE SINCRONIZAÇÃO
// ============================================================
//
// Impede que duas sincronizações completas sejam executadas
// ao mesmo tempo.
//
// ============================================================

let sincronizacaoEmAndamento =
    false;


// ============================================================
// FUNÇÃO: mostrarStatusSincronizacaoOffline()
// ============================================================
//
// OBJETIVO:
//
// Utilizar a barra de status já existente no PMOBILE para
// informar o estado da sincronização do inventário local.
//
// A função tenta utilizar:
//
//     mostrarStatusSupabase()
//
// que pertence ao supabase.js.
//
// O segundo parâmetro "true" informa que essa mensagem é
// prioritária e deve ser exibida durante a sincronização.
//
// Se a função ainda não estiver disponível, a mensagem é
// enviada para o console como alternativa.
//
// ============================================================

function mostrarStatusSincronizacaoOffline(
    mensagem
) {
    try {
        if (navigator.onLine !== true) {
            const quantidadeLocal = await contarMateriaisLocais();

            if (quantidadeLocal > 0) {
                mostrarStatusSincronizacaoOffline(
                    "🟢 Offline OK — " +
                    quantidadeLocal.toLocaleString("pt-BR") +
                    " materiais disponíveis."
                );

                return {
                    disponivel: true,
                    quantidade: quantidadeLocal,
                    offline: true
                };
            }

            mostrarStatusSincronizacaoOffline(
                "🔴 Offline indisponível — este dispositivo ainda não possui inventário local."
            );

            return {
                disponivel: false,
                quantidade: 0,
                offline: true
            };
        }

        return await sincronizarMateriaisLocaisComSupabase(false);

    } catch (erro) {
        console.error(
            "Erro ao garantir inventário local:",
            erro
        );

        return {
            disponivel: false,
            quantidade: 0,
            erro
        };
    }
}
// ============================================================
// FUNÇÃO: limparMateriais()
// ============================================================
//
// OBJETIVO:
//
// Remover SOMENTE a cópia local dos materiais.
//
// NÃO remove dados do Supabase.
//
// ============================================================

async function limparMateriais() {

    try {

        const banco =
            await abrirBanco();


        return await new Promise(
            function(resolve, reject) {

                const transacao =
                    banco.transaction(
                        nomeTabela,
                        "readwrite"
                    );


                const tabela =
                    transacao.objectStore(
                        nomeTabela
                    );


                tabela.clear();


                transacao.oncomplete =
                    function() {

                        banco.close();


                        materiais =
                            [];


                        marcarInventarioZerado();


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
                                "Transação de limpeza abortada."
                            )
                        );

                    };

            }
        );


    } catch (erro) {

        console.error(
            "Erro ao limpar inventário local:",
            erro
        );


        throw erro;

    }

}


// ============================================================
// FUNÇÃO: carregarMateriais()
// ============================================================
//
// OBJETIVO:
//
// Carregar os materiais existentes no IndexedDB.
//
// IMPORTANTE:
//
// Se não existir material local:
//
// - online → tenta sincronizar com Supabase;
// - offline → mantém lista vazia.
//
// NÃO são mais inseridos materiais fictícios automaticamente.
//
// Isso é importante para não confundir:
//
//     "offline funcionando"
//             com
//     "dados de teste funcionando".
//
// ============================================================

async function carregarMateriais() {

    try {

        const banco =
            await abrirBanco();


        const transacao =
            banco.transaction(
                nomeTabela,
                "readonly"
            );


        const tabela =
            transacao.objectStore(
                nomeTabela
            );


        const requisicao =
            tabela.getAll();


        const dados =
            await new Promise(
                function(resolve, reject) {

                    requisicao.onsuccess =
                        function(evento) {

                            resolve(
                                evento.target.result ||
                                []
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


        banco.close();


        // ====================================================
        // EXISTE INVENTÁRIO LOCAL
        // ====================================================

        const versaoLocal =
            await obterConfiguracaoLocal(chaveVersaoInventarioLocal);

        const dadosValidos =
            versaoLocal
                ? dados.filter(function(item) {
                    return item?._pmobileSyncVersion === String(versaoLocal);
                })
                : dados;

        if (
            dadosValidos.length > 0
        ) {

            materiais =
                dadosValidos
                    .map(
                        normalizarMaterialLocal
                    )
                    .filter(
                        function(material) {

                            return material !== null;

                        }
                    );


            console.log(
                "📦 Inventário local carregado: " +
                materiais.length.toLocaleString("pt-BR") +
                " materiais."
            );


            // =================================================
            // ATUALIZA STATUS VISUAL
            // =================================================
            //
            // Neste ponto o dispositivo já possui uma cópia
            // local do inventário.
            //
            // Portanto Pesquisa e Conferência podem utilizar
            // o IndexedDB mesmo sem internet.
            //
            // =================================================

            mostrarStatusSincronizacaoOffline(
                "🟢 Offline OK — " +
                materiais.length.toLocaleString("pt-BR") +
                " materiais disponíveis."
            );


            return materiais;

        }


        // ====================================================
        // NÃO EXISTE INVENTÁRIO LOCAL
        // ====================================================

        materiais =
            [];


        console.log(
            "ℹ️ Nenhum inventário local encontrado."
        );


        // ====================================================
        // PRIMEIRA SINCRONIZAÇÃO
        // ====================================================

        if (
            navigator.onLine === true
        ) {

            const resultado =
                await garantirInventarioLocal();

            if (
                resultado &&
                resultado.sucesso
            ) {
                return await carregarMateriais();
            }

        }
        else {

            // =================================================
            // DISPOSITIVO ESTÁ OFFLINE E NÃO POSSUI CÓPIA
            // =================================================
            //
            // Não há como realizar a primeira sincronização
            // sem acesso ao Supabase.
            //
            // Depois que o dispositivo ficar online pela
            // primeira vez, o inventário será baixado para o
            // IndexedDB.
            //
            // =================================================

            mostrarStatusSincronizacaoOffline(
                "🔴 Offline indisponível — este dispositivo ainda não possui inventário local."
            );

        }


        return materiais;


    } catch (erro) {

        console.error(
            "Erro ao carregar inventário local:",
            erro
        );


        materiais =
            [];


        return materiais;

    }

}


// ============================================================
// FUNÇÃO: existeInventarioLocal()
// ============================================================
//
// OBJETIVO:
//
// Verificar se existe pelo menos um material local.
//
// ============================================================

async function existeInventarioLocal() {

    return (
        await contarMateriaisLocais()
    ) > 0;

}


// ============================================================
// FUNÇÃO: contarMateriaisLocais()
// ============================================================
//
// OBJETIVO:
//
// Contar quantos materiais existem no IndexedDB.
//
// ============================================================

async function contarMateriaisLocais() {

    try {

        const banco =
            await abrirBanco();


        const transacao =
            banco.transaction(
                nomeTabela,
                "readonly"
            );


        const tabela =
            transacao.objectStore(
                nomeTabela
            );


        const requisicao =
            tabela.count();


        return await new Promise(
            function(resolve, reject) {

                requisicao.onsuccess =
                    function(evento) {

                        const quantidade =
                            evento.target.result;


                        banco.close();


                        resolve(
                            quantidade
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


    } catch (erro) {

        console.error(
            "Erro ao contar materiais locais:",
            erro
        );


        return 0;

    }

}


// ============================================================
// FUNÇÃO: inventarioEstaZerado()
// ============================================================
//
// OBJETIVO:
//
// Verificar se o usuário marcou o inventário local como
// zerado propositalmente.
//
// ============================================================

function inventarioEstaZerado() {

    return (
        localStorage.getItem(
            chaveInventarioZerado
        ) === "true"
    );

}


// ============================================================
// FUNÇÃO: marcarInventarioZerado()
// ============================================================
//
// OBJETIVO:
//
// Marcar localmente o inventário como zerado.
//
// ============================================================

function marcarInventarioZerado() {

    localStorage.setItem(
        chaveInventarioZerado,
        "true"
    );

}


// ============================================================
// FUNÇÃO: desmarcarInventarioZerado()
// ============================================================
//
// OBJETIVO:
//
// Remover a marcação de inventário zerado.
//
// ============================================================

function desmarcarInventarioZerado() {

    localStorage.removeItem(
        chaveInventarioZerado
    );

}


// ============================================================
// FUNÇÃO: obterMateriaisLocais()
// ============================================================
//
// OBJETIVO:
//
// Retornar os materiais atualmente disponíveis em memória.
//
// ============================================================

function obterMateriaisLocais() {

    return materiais;

}


// ============================================================
// FUNÇÃO: substituirMateriaisLocais()
// ============================================================
//
// OBJETIVO:
//
// Substituir somente a lista em memória.
//
// NÃO grava no IndexedDB.
//
// NÃO altera o Supabase.
//
// ============================================================

function substituirMateriaisLocais(
    novoInventario
) {

    if (
        !Array.isArray(
            novoInventario
        )
    ) {

        throw new Error(
            "O novo inventário precisa ser uma lista."
        );

    }


    materiais =
        novoInventario
            .map(
                normalizarMaterialLocal
            )
            .filter(
                function(material) {

                    return material !== null;

                }
            );


    return materiais;

}


// ============================================================
// FUNÇÃO: obterMaterialLocalPorIdSupabase()
// ============================================================
//
// OBJETIVO:
//
// Localizar um material pelo ID original do Supabase.
//
// ============================================================

async function obterMaterialLocalPorIdSupabase(
    idSupabase
) {

    if (
        idSupabase === null ||
        idSupabase === undefined ||
        idSupabase === ""
    ) {

        return null;

    }


    try {

        const banco =
            await abrirBanco();


        const transacao =
            banco.transaction(
                nomeTabela,
                "readonly"
            );


        const tabela =
            transacao.objectStore(
                nomeTabela
            );


        const requisicao =
            tabela.get(
                idSupabase
            );


        return await new Promise(
            function(resolve, reject) {

                requisicao.onsuccess =
                    function(evento) {

                        const resultado =
                            evento.target.result;


                        banco.close();


                        if (
                            !resultado
                        ) {

                            resolve(
                                null
                            );

                            return;

                        }


                        resolve(
                            normalizarMaterialLocal(
                                resultado
                            )
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


    } catch (erro) {

        console.error(
            "Erro ao buscar material local:",
            erro
        );


        return null;

    }

}


// ============================================================
// FUNÇÃO: obterStatusSincronizacaoMateriais()
// ============================================================
//
// OBJETIVO:
//
// Retornar informações úteis sobre a cópia local.
//
// RETORNO:
//
// - quantidade de materiais;
// - data da última sincronização;
// - estado da conexão.
//
// ============================================================

async function obterStatusSincronizacaoMateriais() {

    const quantidade =
        await contarMateriaisLocais();


    const ultimaSincronizacao =
        await obterDataUltimaSincronizacao();


    return {

        quantidade:
            quantidade,

        ultimaSincronizacao:
            ultimaSincronizacao,

        online:
            navigator.onLine === true

    };

}

// ============================================================
// INICIALIZAÇÃO AUTOMÁTICA DO INVENTÁRIO LOCAL
// ============================================================
//
// A cópia local precisa ser garantida na abertura do PMOBILE.
// Antes, as funções de sincronização existiam, mas não havia
// uma chamada global que disparasse a primeira sincronização.
//
// Regras:
// - se já existe IndexedDB, utiliza a cópia local;
// - se não existe e há internet, baixa do Supabase;
// - se não existe e está offline, preserva o estado offline;
// - quando a conexão voltar e ainda não houver cópia local,
//   tenta novamente.
// ============================================================

let inicializacaoInventarioLocalEmAndamento = false;

async function iniciarInventarioLocalPmobile() {

    if (inicializacaoInventarioLocalEmAndamento) {
        return;
    }

    inicializacaoInventarioLocalEmAndamento = true;

    try {
        await garantirInventarioLocal();
    } catch (erro) {
        console.error(
            "❌ Falha ao inicializar inventário local:",
            erro
        );
    } finally {
        inicializacaoInventarioLocalEmAndamento = false;
    }
}

document.addEventListener(
    "DOMContentLoaded",
    function() {
        // Aguarda a inicialização do cliente Supabase e das
        // demais estruturas da página antes da primeira tentativa.
        setTimeout(
            iniciarInventarioLocalPmobile,
            800
        );
    }
);

window.addEventListener(
    "online",
    function() {
        // Se o dispositivo voltar à rede sem possuir cópia
        // local, garantirInventarioLocal() fará a primeira carga.
        setTimeout(
            iniciarInventarioLocalPmobile,
            500
        );
    }
);



// ============================================================
// EVENTO: VOLTOU A INTERNET
// ============================================================
//
// OBJETIVO:
//
// Se o dispositivo estava sem internet e volta a ficar online,
// verificamos se ainda não possui uma cópia local.
//
// IMPORTANTE:
//
// NÃO fazemos download novamente se já existir inventário.
//
// ============================================================

window.addEventListener(
    "online",
    async function() {

        console.log(
            "🌐 Internet detectada novamente."
        );


        const quantidadeLocal =
            await contarMateriaisLocais();


        if (
            quantidadeLocal === 0
        ) {

            console.log(
                "🟡 Nenhum inventário local encontrado."
            );


            await sincronizarMateriaisLocaisComSupabase(
                false
            );

        }

    }
);


// ============================================================
// INICIALIZAÇÃO DA CAMADA LOCAL
// ============================================================
//
// O comportamento agora é:
//
// 1. abre IndexedDB;
// 2. procura inventário local;
// 3. se existir → carrega;
// 4. se não existir e estiver online → sincroniza;
// 5. se não existir e estiver offline → permanece vazio.
//
// ============================================================

carregarMateriais();
