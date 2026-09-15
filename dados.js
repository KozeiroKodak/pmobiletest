// ============================================================
// PMOBILE
// ARQUIVO: dados.js
// ============================================================
//
// CAMADA LOCAL DE DADOS DO PMOBILE
//
// OBJETIVO:
//
// Este arquivo controla o armazenamento LOCAL do inventário.
//
// Arquitetura planejada:
//
//                  PMOBILE
//                     |
//              +------+------ +
//              |             |
//           SUPABASE      INDEXEDDB
//           CENTRAL        LOCAL
//              |             |
//              +------+------ +
//                     |
//              sincronização
//                 futura
//
// IMPORTANTE:
//
// O Supabase é a fonte central do sistema.
//
// O IndexedDB NÃO substitui o Supabase.
//
// Ele funciona como uma cópia local preparada para:
//
// - funcionamento offline
// - carregamento rápido
// - consulta local
// - futura sincronização
//
// A sincronização automática ainda NÃO é implementada
// neste arquivo.
//
// ============================================================


// ============================================================
// DADOS DE TESTE
// ============================================================
//
// OBJETIVO:
//
// Disponibilizar materiais fictícios somente quando:
//
// - o PMOBILE estiver sendo executado pela primeira vez
// - não existir inventário local
// - o inventário não tiver sido marcado como zerado
//
// IMPORTANTE:
//
// Esses dados não representam o estoque real.
//
// ============================================================

const materiaisTeste = [

    {
        codigo: "001",
        descricao: "Material de teste A",
        referencia: "",
        marca: "",
        local: "",
        quantidade: 100,
        quantidadeReservada: 0,
        disponivel: 100,
        ultimaEntrada: ""
    },

    {
        codigo: "002",
        descricao: "Material de teste B",
        referencia: "",
        marca: "",
        local: "",
        quantidade: 50,
        quantidadeReservada: 0,
        disponivel: 50,
        ultimaEntrada: ""
    },

    {
        codigo: "003",
        descricao: "Material de teste C",
        referencia: "",
        marca: "",
        local: "",
        quantidade: 25,
        quantidadeReservada: 0,
        disponivel: 25,
        ultimaEntrada: ""
    }

];


// ============================================================
// MATERIAIS EM MEMÓRIA
// ============================================================
//
// OBJETIVO:
//
// Manter os materiais disponíveis para o restante do PMOBILE.
//
// Esta variável representa a cópia atualmente carregada
// na memória da aplicação.
//
// ============================================================

let materiais = [];


// ============================================================
// CONTROLE DO INVENTÁRIO
// ============================================================
//
// OBJETIVO:
//
// Diferenciar:
//
// 1. primeira utilização
// 2. inventário existente
// 3. inventário zerado propositalmente
//
// ============================================================

const chaveInventarioZerado =
    "pmobile_inventario_zerado";


// ============================================================
// CONFIGURAÇÃO DO INDEXEDDB
// ============================================================

const nomeBanco =
    "PMOBILE";

const versaoBanco =
    1;

const nomeTabela =
    "materiais";


// ============================================================
// FUNÇÃO: normalizarMaterialLocal()
//
// OBJETIVO:
//
// Garantir que qualquer material recebido pela camada local
// tenha sempre a mesma estrutura.
//
// Isso é especialmente importante porque os dados podem vir:
//
// - do Supabase
// - da importação
// - do IndexedDB
// - de dados de teste
//
// ============================================================

function normalizarMaterialLocal(material) {

    if (!material) {

        return null;

    }


    return {

        codigo:
            material.codigo ?? "",

        descricao:
            material.descricao ?? "",

        referencia:
            material.referencia ?? "",

        marca:
            material.marca ?? "",

        local:
            material.local ?? "",

        quantidade:
            Number(
                material.quantidade ?? 0
            ),

        quantidadeReservada:
            Number(
                material.quantidadeReservada ?? 0
            ),

        disponivel:
            Number(
                material.disponivel ??
                (
                    Number(material.quantidade ?? 0) -
                    Number(material.quantidadeReservada ?? 0)
                )
            ),

        ultimaEntrada:
            material.ultimaEntrada ?? ""

    };

}


// ============================================================
// FUNÇÃO: abrirBanco()
//
// OBJETIVO:
//
// Criar ou abrir o banco IndexedDB utilizado pelo PMOBILE.
//
// ============================================================

function abrirBanco() {

    return new Promise(
        function(resolve, reject) {

            const requisicao =
                indexedDB.open(
                    nomeBanco,
                    versaoBanco
                );


            // ==================================================
            // CRIAÇÃO / ATUALIZAÇÃO DO BANCO
            // ==================================================

            requisicao.onupgradeneeded =
                function(evento) {

                    const banco =
                        evento.target.result;


                    if (
                        !banco.objectStoreNames.contains(
                            nomeTabela
                        )
                    ) {

                        banco.createObjectStore(
                            nomeTabela,
                            {
                                keyPath: "id",
                                autoIncrement: true
                            }
                        );

                    }

                };


            // ==================================================
            // ABERTURA CONCLUÍDA
            // ==================================================

            requisicao.onsuccess =
                function(evento) {

                    resolve(
                        evento.target.result
                    );

                };


            // ==================================================
            // ERRO
            // ==================================================

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
// FUNÇÃO: salvarMateriais()
//
// OBJETIVO:
//
// Salvar uma cópia completa do inventário no IndexedDB.
//
// USO FUTURO:
//
// Essa função poderá ser chamada depois de uma consulta
// bem-sucedida ao Supabase.
//
// Exemplo:
//
// Supabase
//    ↓
// materiais
//    ↓
// salvarMateriais()
//    ↓
// IndexedDB
//
// ============================================================

async function salvarMateriais(
    inventario = materiais
) {

    try {

        const banco =
            await abrirBanco();


        const transacao =
            banco.transaction(
                nomeTabela,
                "readwrite"
            );


        const tabela =
            transacao.objectStore(
                nomeTabela
            );


        // ====================================================
        // LIMPAR CÓPIA ANTERIOR
        // ====================================================

        tabela.clear();


        // ====================================================
        // NORMALIZAR E GRAVAR
        // ====================================================

        inventario.forEach(
            function(material) {

                const materialNormalizado =
                    normalizarMaterialLocal(
                        material
                    );


                if (!materialNormalizado) {

                    return;

                }


                tabela.add(
                    materialNormalizado
                );

            }
        );


        // ====================================================
        // FINALIZAR TRANSAÇÃO
        // ====================================================

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


    } catch (erro) {

        console.error(
            "Erro ao salvar materiais no IndexedDB:",
            erro
        );

        throw erro;

    }

}


// ============================================================
// FUNÇÃO: salvarCopiaLocalDoSupabase()
//
// OBJETIVO:
//
// Gravar no IndexedDB uma cópia dos materiais recebidos
// do Supabase.
//
// ESTA É UMA DAS PRINCIPAIS FUNÇÕES DA NOVA CAMADA.
//
// Ela deixa explícito que:
//
// Supabase = fonte central
//
// IndexedDB = cópia local
//
// ============================================================

async function salvarCopiaLocalDoSupabase(
    materiaisSupabase
) {

    if (
        !Array.isArray(
            materiaisSupabase
        )
    ) {

        throw new Error(
            "Os materiais recebidos do Supabase precisam ser uma lista."
        );

    }


    const inventarioLocal =
        materiaisSupabase
            .map(
                normalizarMaterialLocal
            )
            .filter(
                function(material) {

                    return material !== null;

                }
            );


    await salvarMateriais(
        inventarioLocal
    );


    // ========================================================
    // O INVENTÁRIO DEIXOU DE ESTAR ZERADO
    // ========================================================

    if (
        inventarioLocal.length > 0
    ) {

        desmarcarInventarioZerado();

    }


    // ========================================================
    // ATUALIZAR MEMÓRIA
    // ========================================================

    materiais =
        [...inventarioLocal];


    return materiais;

}


// ============================================================
// FUNÇÃO: limparMateriais()
//
// OBJETIVO:
//
// Remover a cópia local do inventário.
//
// IMPORTANTE:
//
// Esta função NÃO apaga materiais do Supabase.
//
// Ela atua SOMENTE no IndexedDB.
//
// A exclusão dos materiais do banco central continua sendo
// responsabilidade da função correspondente ao Supabase.
//
// ============================================================

async function limparMateriais() {

    try {

        const banco =
            await abrirBanco();


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


        return new Promise(
            function(resolve, reject) {

                transacao.oncomplete =
                    function() {

                        banco.close();


                        materiais = [];


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
                                "Transação abortada."
                            )
                        );

                    };

            }
        );


    } catch (erro) {

        console.error(
            "Erro ao limpar o inventário local:",
            erro
        );

        throw erro;

    }

}


// ============================================================
// FUNÇÃO: carregarMateriais()
//
// OBJETIVO:
//
// Carregar a cópia local do inventário armazenada no IndexedDB.
//
// COMPORTAMENTO:
//
// Se existir inventário local:
//
//     IndexedDB → materiais
//
// Se o inventário tiver sido zerado:
//
//     materiais = []
//
// Se for a primeira utilização:
//
//     materiaisTeste
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


        return new Promise(
            function(resolve, reject) {

                requisicao.onsuccess =
                    function(evento) {

                        const dados =
                            evento.target.result;


                        banco.close();


                        // ====================================
                        // EXISTE INVENTÁRIO LOCAL
                        // ====================================

                        if (
                            dados.length > 0
                        ) {

                            materiais =
                                dados
                                    .map(
                                        normalizarMaterialLocal
                                    )
                                    .filter(
                                        function(material) {

                                            return material !== null;

                                        }
                                    );


                            resolve(
                                materiais
                            );


                            return;

                        }


                        // ====================================
                        // INVENTÁRIO FOI ZERADO
                        // ====================================

                        if (
                            inventarioEstaZerado()
                        ) {

                            materiais = [];


                            resolve(
                                materiais
                            );


                            return;

                        }


                        // ====================================
                        // PRIMEIRA UTILIZAÇÃO
                        // ====================================

                        materiais =
                            materiaisTeste.map(
                                normalizarMaterialLocal
                            );


                        resolve(
                            materiais
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
            "Erro ao carregar o inventário local:",
            erro
        );


        // ====================================================
        // FALLBACK
        // ====================================================

        if (
            inventarioEstaZerado()
        ) {

            materiais = [];

        } else {

            materiais =
                materiaisTeste.map(
                    normalizarMaterialLocal
                );

        }


        return materiais;

    }

}


// ============================================================
// FUNÇÃO: existeInventarioLocal()
//
// OBJETIVO:
//
// Verificar se existe pelo menos um material armazenado
// no IndexedDB.
//
// RETORNO:
//
// true  → existe inventário local
//
// false → não existe inventário local
//
// ============================================================

async function existeInventarioLocal() {

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


        return new Promise(
            function(resolve, reject) {

                requisicao.onsuccess =
                    function(evento) {

                        banco.close();


                        resolve(
                            evento.target.result > 0
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
            "Erro ao verificar inventário local:",
            erro
        );


        return false;

    }

}


// ============================================================
// FUNÇÃO: inventarioEstaZerado()
//
// OBJETIVO:
//
// Verificar se o usuário marcou explicitamente
// o inventário local como zerado.
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
//
// OBJETIVO:
//
// Informar ao PMOBILE que o inventário local foi
// zerado propositalmente.
//
// IMPORTANTE:
//
// Isto NÃO apaga nada do Supabase.
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
//
// OBJETIVO:
//
// Remover a marca de inventário zerado.
//
// Normalmente utilizada quando uma nova cópia de inventário
// é gravada localmente.
//
// ============================================================

function desmarcarInventarioZerado() {

    localStorage.removeItem(
        chaveInventarioZerado
    );

}


// ============================================================
// FUNÇÃO: obterMateriaisLocais()
//
// OBJETIVO:
//
// Retornar os materiais atualmente carregados na memória.
//
// IMPORTANTE:
//
// Esta função NÃO consulta o Supabase.
//
// ============================================================

function obterMateriaisLocais() {

    return materiais;

}


// ============================================================
// FUNÇÃO: substituirMateriaisLocais()
//
// OBJETIVO:
//
// Substituir somente os dados que estão em memória.
//
// IMPORTANTE:
//
// Esta função NÃO grava automaticamente no IndexedDB
// e NÃO altera o Supabase.
//
// Ela serve para operações internas controladas.
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
// INICIALIZAÇÃO DA CAMADA LOCAL
// ============================================================
//
// Carrega a cópia local existente.
//
// IMPORTANTE:
//
// Esta chamada NÃO consulta o Supabase.
//
// ============================================================

carregarMateriais();