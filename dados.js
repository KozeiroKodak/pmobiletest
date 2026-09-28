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
        idSupabase: "teste-001",

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
        idSupabase: "teste-002",

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
        idSupabase: "teste-003",

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


// ============================================================
// VERSÃO DO BANCO
// ============================================================
//
// VERSÃO 2:
//
// A versão 1 utilizava:
//
//     keyPath: "id"
//     autoIncrement: true
//
// Isso fazia o IndexedDB criar uma identidade própria
// para cada material.
//
// A partir da versão 2:
//
//     keyPath: "idSupabase"
//     autoIncrement: false
//
// O ID original do Supabase passa a ser a identidade
// principal do material dentro da cópia local.
//
// ============================================================

const versaoBanco =
    2;


const nomeTabela =
    "materiais";


// ============================================================
// FUNÇÃO: normalizarMaterialLocal()
// ============================================================
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
// IMPORTANTE:
//
// O idSupabase representa a identidade ORIGINAL do material
// no Supabase.
//
// Ele NÃO deve ser substituído por um ID automático
// criado pelo IndexedDB.
//
// ============================================================

function normalizarMaterialLocal(material) {

    if (!material) {

        return null;

    }


    // ========================================================
    // PRESERVAR ID DO SUPABASE
    // ========================================================
    //
    // Prioridade:
    //
    // 1. material.idSupabase
    // 2. material.id
    //
    // O segundo caso existe porque os registros vindos
    // diretamente do Supabase normalmente possuem o campo
    // "id".
    //
    // ========================================================

    const idSupabase =
        material.idSupabase ??
        material.id ??
        null;


    // ========================================================
    // MATERIAL PRECISA TER IDENTIDADE
    // ========================================================
    //
    // Materiais reais vindos do Supabase possuem ID.
    //
    // Dados de teste também possuem um idSupabase próprio.
    //
    // Se não houver identidade, o registro não deve ser
    // colocado na camada local.
    //
    // ========================================================

    if (
        idSupabase === null ||
        idSupabase === undefined ||
        idSupabase === ""
    ) {

        console.warn(
            "Material ignorado por não possuir idSupabase:",
            material
        );

        return null;

    }


    // ========================================================
    // ESTRUTURA PADRONIZADA
    // ========================================================

    return {

        // ====================================================
        // IDENTIDADE CENTRAL
        // ====================================================
        //
        // Este valor é o mesmo ID utilizado pelo Supabase.
        //
        idSupabase:
            idSupabase,


        // ====================================================
        // ALIAS DO ID
        // ====================================================
        //
        // Mantemos também "id" apontando para o mesmo ID.
        //
        // Isso ajuda na compatibilidade com partes existentes
        // do PMOBILE que ainda possam acessar material.id.
        //
        id:
            idSupabase,


        // ====================================================
        // DADOS DO MATERIAL
        // ====================================================

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


        // ====================================================
        // QUANTIDADES
        // ====================================================

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


        // ====================================================
        // DATA DA ÚLTIMA ENTRADA
        // ====================================================

        ultimaEntrada:
            material.ultimaEntrada ?? ""

    };

}


// ============================================================
// FUNÇÃO: abrirBanco()
// ============================================================
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


                    // ==========================================
                    // VERSÃO ANTERIOR
                    // ==========================================
                    //
                    // A versão 1 utilizava um objectStore com:
                    //
                    // keyPath: "id"
                    // autoIncrement: true
                    //
                    // Essa estrutura não é adequada para a nova
                    // identidade baseada no Supabase.
                    //
                    // Portanto, o objectStore antigo é removido
                    // e recriado utilizando idSupabase.
                    //
                    // IMPORTANTE:
                    //
                    // Os dados antigos da versão 1 não possuem
                    // garantia de que seu "id" automático
                    // corresponda ao ID real do Supabase.
                    //
                    // Por segurança, eles não são reutilizados
                    // como identidade central.
                    //
                    // O inventário correto será novamente
                    // carregado a partir do Supabase.
                    //
                    // ==========================================

                    if (
                        banco.objectStoreNames.contains(
                            nomeTabela
                        )
                    ) {

                        banco.deleteObjectStore(
                            nomeTabela
                        );

                    }


                    // ==========================================
                    // NOVA ESTRUTURA
                    // ==========================================

                    banco.createObjectStore(
                        nomeTabela,
                        {
                            keyPath: "idSupabase",
                            autoIncrement: false
                        }
                    );

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
// ============================================================
//
// OBJETIVO:
//
// Salvar uma cópia completa do inventário no IndexedDB.
//
// USO:
//
// Essa função pode receber:
//
// - materiais vindos do Supabase
// - materiais de teste
// - materiais já normalizados
//
// COMPORTAMENTO:
//
// A cópia local anterior é substituída pelo inventário
// recebido.
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
        //
        // Isso mantém o IndexedDB como uma cópia do inventário
        // mais recente recebido.
        //
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


                // ==============================================
                // PUT EM VEZ DE ADD
                // ==============================================
                //
                // PUT utiliza idSupabase como chave.
                //
                // Isso evita que o IndexedDB crie uma nova
                // identidade para o material.
                //
                tabela.put(
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
// ============================================================
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


    // ========================================================
    // NORMALIZAR INVENTÁRIO
    // ========================================================

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


    // ========================================================
    // GRAVAR CÓPIA LOCAL
    // ========================================================

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
// ============================================================
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
// ============================================================
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
                            materiaisTeste
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
                materiaisTeste
                    .map(
                        normalizarMaterialLocal
                    )
                    .filter(
                        function(material) {

                            return material !== null;

                        }
                    );

        }


        return materiais;

    }

}


// ============================================================
// FUNÇÃO: existeInventarioLocal()
// ============================================================
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
// ============================================================
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
// ============================================================
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
// ============================================================
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
// ============================================================
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
// ============================================================
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
// FUNÇÃO: obterMaterialLocalPorIdSupabase()
// ============================================================
//
// OBJETIVO:
//
// Localizar diretamente um material utilizando seu ID original
// do Supabase.
//
// USO FUTURO:
//
// Essa função será especialmente útil para:
//
// - conferência offline
// - recuperação de material
// - fila de sincronização
// - relacionamento com conferencias
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


        return new Promise(
            function(resolve, reject) {

                requisicao.onsuccess =
                    function(evento) {

                        const resultado =
                            evento.target.result;


                        banco.close();


                        if (!resultado) {

                            resolve(null);

                            return;

                        }


                        const material =
                            normalizarMaterialLocal(
                                resultado
                            );


                        resolve(
                            material
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
            "Erro ao buscar material local por idSupabase:",
            erro
        );

        return null;

    }

}


// ============================================================
// FUNÇÃO: contarMateriaisLocais()
// ============================================================
//
// OBJETIVO:
//
// Retornar a quantidade de materiais atualmente armazenados
// no IndexedDB.
//
// USO FUTURO:
//
// Pode ser utilizada para:
//
// - indicador de sincronização
// - diagnóstico offline
// - confirmação de carregamento
// - testes
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


        return new Promise(
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
