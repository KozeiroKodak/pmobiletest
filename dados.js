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

    if (
        typeof mostrarStatusSupabase === "function"
    ) {

        mostrarStatusSupabase(
            mensagem,
            true
        );

        return;

    }


    console.log(
        mensagem
    );

}


// ============================================================
// FUNÇÃO: normalizarMaterialLocal()
// ============================================================
//
// OBJETIVO:
//
// Padronizar qualquer material recebido:
//
// - Supabase;
// - IndexedDB;
// - importação;
// - outras partes do PMOBILE.
//
// O Supabase utiliza seus próprios nomes de campos.
//
// O IndexedDB utiliza a estrutura interna do PMOBILE.
//
// ============================================================

function normalizarMaterialLocal(
    material
) {

    if (!material) {

        return null;

    }


    // ========================================================
    // ID DO SUPABASE
    // ========================================================
    //
    // Primeiro tentamos idSupabase.
    //
    // Depois id.
    //
    // Isso permite receber tanto materiais já normalizados
    // quanto registros diretamente vindos do Supabase.
    //
    // ========================================================

    const idSupabase =
        material.idSupabase ??
        material.id ??
        null;


    // ========================================================
    // VALIDAR IDENTIDADE
    // ========================================================

    if (
        idSupabase === null ||
        idSupabase === undefined ||
        idSupabase === ""
    ) {

        console.warn(
            "Material ignorado por não possuir ID do Supabase:",
            material
        );

        return null;

    }


    // ========================================================
    // CAMPOS DO MATERIAL
    // ========================================================
    //
    // Aceitamos tanto:
    //
    // quantidadeReservada
    //
    // quanto:
    //
    // quantidade_reservada
    //
    // O mesmo vale para ultimaEntrada.
    //
    // Isso deixa a camada local mais resistente a diferenças
    // entre os nomes utilizados no JavaScript e no PostgreSQL.
    //
    // ========================================================

    const quantidade =
        Number(
            material.quantidade ??
            material.qtdeEst ??
            material["Qtde. Est."] ??
            0
        );


    const quantidadeReservada =
        Number(
            material.quantidadeReservada ??
            material.quantidade_reservada ??
            material.qtdeRsr ??
            material["Qtde. Rsr."] ??
            0
        );


    const disponivel =
        Number(
            material.disponivel ??
            material.quantidade_disponivel ??
            (
                quantidade -
                quantidadeReservada
            )
        );


    const ultimaEntrada =
        material.ultimaEntrada ??
        material.ultima_entrada ??
        "";


    // ========================================================
    // ESTRUTURA LOCAL PADRONIZADA
    // ========================================================

    return {

        // ====================================================
        // IDENTIDADE CENTRAL
        // ====================================================

        idSupabase:
            idSupabase,


        // ====================================================
        // COMPATIBILIDADE
        // ====================================================

        id:
            idSupabase,


        // ====================================================
        // DADOS DO MATERIAL
        // ====================================================

        codigo:
            material.codigo ??
            material.produto ??
            "",


        descricao:
            material.descricao ??
            "",


        referencia:
            material.referencia ??
            "",


        marca:
            material.marca ??
            "",


        local:
            material.local ??
            "",


        // ====================================================
        // QUANTIDADES
        // ====================================================

        quantidade:
            quantidade,


        quantidadeReservada:
            quantidadeReservada,


        disponivel:
            disponivel,


        // ====================================================
        // DATA
        // ====================================================

        ultimaEntrada:
            ultimaEntrada

    };

}


// ============================================================
// FUNÇÃO: abrirBanco()
// ============================================================
//
// OBJETIVO:
//
// Abrir ou criar o banco IndexedDB.
//
// A versão 3 adiciona:
//
//     configuracoes
//
// sem destruir os materiais já existentes.
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
            // ATUALIZAÇÃO DO BANCO
            // ==================================================

            requisicao.onupgradeneeded =
                function(evento) {

                    const banco =
                        evento.target.result;


                    // ==========================================
                    // STORE DE MATERIAIS
                    // ==========================================

                    if (
                        !banco.objectStoreNames.contains(
                            nomeTabela
                        )
                    ) {

                        banco.createObjectStore(
                            nomeTabela,
                            {
                                keyPath:
                                    "idSupabase",
                                autoIncrement:
                                    false
                            }
                        );

                    }


                    // ==========================================
                    // STORE DE CONFIGURAÇÕES
                    // ==========================================
                    //
                    // Utilizado para guardar informações locais
                    // como a última sincronização.
                    //
                    // ==========================================

                    if (
                        !banco.objectStoreNames.contains(
                            nomeTabelaConfiguracoes
                        )
                    ) {

                        banco.createObjectStore(
                            nomeTabelaConfiguracoes,
                            {
                                keyPath:
                                    "chave"
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
// ============================================================
//
// OBJETIVO:
//
// Substituir completamente a cópia local pelo inventário
// recebido.
//
// IMPORTANTE:
//
// Esta função NÃO altera o Supabase.
//
// Ela atua exclusivamente no IndexedDB.
//
// ============================================================

async function salvarMateriais(
    inventario = materiais
) {

    if (
        !Array.isArray(
            inventario
        )
    ) {

        throw new Error(
            "O inventário precisa ser uma lista."
        );

    }


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


                // ==========================================
                // LIMPAR INVENTÁRIO ANTERIOR
                // ==========================================

                tabela.clear();


                // ==========================================
                // INSERIR NOVA CÓPIA
                // ==========================================

                inventario.forEach(
                    function(material) {

                        const normalizado =
                            normalizarMaterialLocal(
                                material
                            );


                        if (!normalizado) {

                            return;

                        }


                        tabela.put(
                            normalizado
                        );

                    }
                );


                // ==========================================
                // TRANSAÇÃO CONCLUÍDA
                // ==========================================

                transacao.oncomplete =
                    function() {

                        banco.close();

                        materiais =
                            inventario
                                .map(
                                    normalizarMaterialLocal
                                )
                                .filter(
                                    function(material) {

                                        return material !== null;

                                    }
                                );


                        resolve(
                            materiais.length
                        );

                    };


                // ==========================================
                // ERRO
                // ==========================================

                transacao.onerror =
                    function(evento) {

                        banco.close();

                        reject(
                            evento.target.error
                        );

                    };


                // ==========================================
                // ABORTO
                // ==========================================

                transacao.onabort =
                    function(evento) {

                        banco.close();

                        reject(
                            evento.target.error ||
                            new Error(
                                "Transação do IndexedDB abortada."
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
// Receber materiais do Supabase e transformá-los na cópia
// local utilizada pelo PMOBILE.
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
    // NORMALIZAR
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
    // SALVAR
    // ========================================================

    await salvarMateriais(
        inventarioLocal
    );


    // ========================================================
    // DESMARCAR INVENTÁRIO ZERADO
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
        [
            ...inventarioLocal
        ];


    return materiais;

}


// ============================================================
// FUNÇÃO: obterConfiguracaoLocal()
// ============================================================
//
// OBJETIVO:
//
// Ler uma configuração armazenada no IndexedDB.
//
// ============================================================

async function obterConfiguracaoLocal(
    chave
) {

    try {

        const banco =
            await abrirBanco();


        const transacao =
            banco.transaction(
                nomeTabelaConfiguracoes,
                "readonly"
            );


        const tabela =
            transacao.objectStore(
                nomeTabelaConfiguracoes
            );


        const requisicao =
            tabela.get(
                chave
            );


        return await new Promise(
            function(resolve, reject) {

                requisicao.onsuccess =
                    function(evento) {

                        const resultado =
                            evento.target.result;


                        banco.close();


                        resolve(
                            resultado
                                ? resultado.valor
                                : null
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
            "Erro ao obter configuração local:",
            erro
        );

        return null;

    }

}


// ============================================================
// FUNÇÃO: salvarConfiguracaoLocal()
// ============================================================
//
// OBJETIVO:
//
// Gravar uma configuração no IndexedDB.
//
// ============================================================

async function salvarConfiguracaoLocal(
    chave,
    valor
) {

    const banco =
        await abrirBanco();


    return await new Promise(
        function(resolve, reject) {

            const transacao =
                banco.transaction(
                    nomeTabelaConfiguracoes,
                    "readwrite"
                );


            const tabela =
                transacao.objectStore(
                    nomeTabelaConfiguracoes
                );


            tabela.put({

                chave:
                    chave,

                valor:
                    valor

            });


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
                            "Transação de configuração abortada."
                        )
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: obterDataUltimaSincronizacao()
// ============================================================
//
// OBJETIVO:
//
// Retornar a data da última sincronização completa do
// inventário local.
//
// ============================================================

async function obterDataUltimaSincronizacao() {

    return await obterConfiguracaoLocal(
        chaveUltimaSincronizacao
    );

}


// ============================================================
// FUNÇÃO: registrarSincronizacao()
// ============================================================
//
// OBJETIVO:
//
// Registrar que uma sincronização completa terminou com
// sucesso.
//
// ============================================================

async function registrarSincronizacao() {

    const agora =
        new Date().toISOString();


    await salvarConfiguracaoLocal(
        chaveUltimaSincronizacao,
        agora
    );


    return agora;

}


// ============================================================
// FUNÇÃO: obterClienteSupabaseParaDados()
// ============================================================
//
// OBJETIVO:
//
// Recuperar o cliente Supabase criado pelo supabase.js.
//
// ============================================================

function obterClienteSupabaseParaDados() {

    if (
        !window.clienteSupabase
    ) {

        throw new Error(
            "Cliente Supabase ainda não foi inicializado."
        );

    }


    return window.clienteSupabase;

}


// ============================================================
// FUNÇÃO: sincronizarMateriaisLocaisComSupabase()
// ============================================================
//
// OBJETIVO PRINCIPAL:
//
// Baixar o inventário completo do Supabase e armazená-lo
// no IndexedDB do dispositivo.
//
// ESTA É A FUNÇÃO QUE RESOLVE O PROBLEMA DO SEGUNDO DISPOSITIVO.
//
// FLUXO:
//
//     Supabase
//        | páginas de 1.000
//        v
//     JavaScript
//        |
//        v
//     IndexedDB
//
// PARÂMETRO:
//
// forcar
//
// false:
//     Só executa automaticamente quando não existe cópia local.
//
// true:
//     Executa mesmo que já exista inventário local.
//
// ============================================================

async function sincronizarMateriaisLocaisComSupabase(
    forcar = false
) {

    // ========================================================
    // EVITAR DUPLICIDADE
    // ========================================================

    if (
        sincronizacaoEmAndamento
    ) {

        console.warn(
            "Já existe uma sincronização de materiais em andamento."
        );


        return {
            sucesso:
                false,

            ignorada:
                true,

            motivo:
                "sincronizacao_em_andamento"
        };

    }


    // ========================================================
    // VERIFICAR INTERNET
    // ========================================================

    if (
        navigator.onLine !== true
    ) {

        console.log(
            "📴 Dispositivo offline. Sincronização não executada."
        );


        mostrarStatusSincronizacaoOffline(
            "🔴 Offline indisponível — este dispositivo ainda não possui inventário local."
        );


        return {
            sucesso:
                false,

            offline:
                true
        };

    }


    // ========================================================
    // VERIFICAR SE PRECISA SINCRONIZAR
    // ========================================================

    if (
        !forcar
    ) {

        const quantidadeLocal =
            await contarMateriaisLocais();


        if (
            quantidadeLocal > 0
        ) {

            console.log(
                "📦 Já existe inventário local com " +
                quantidadeLocal.toLocaleString("pt-BR") +
                " materiais."
            );


            mostrarStatusSincronizacaoOffline(
                "🟢 Offline OK — " +
                quantidadeLocal.toLocaleString("pt-BR") +
                " materiais disponíveis."
            );


            return {
                sucesso:
                    true,

                sincronizada:
                    false,

                existente:
                    true,

                quantidade:
                    quantidadeLocal
            };

        }

    }


    sincronizacaoEmAndamento =
        true;


    mostrarStatusSincronizacaoOffline(
        "🟡 Sincronizando inventário offline..."
    );


    console.log(
        "🟡 Iniciando sincronização completa do inventário..."
    );


    try {

        const clienteSupabase =
            obterClienteSupabaseParaDados();


        const inventarioCompleto =
            [];


        let inicio =
            0;


        // ====================================================
        // PAGINAÇÃO
        // ====================================================
        //
        // Cada requisição busca uma página de registros.
        //
        // Exemplo:
        //
        // 0    → 999
        // 1000 → 1999
        // 2000 → 2999
        //
        // até o final da tabela.
        //
        // ====================================================

        while (true) {

            const fim =
                inicio +
                tamanhoPaginaSincronizacao -
                1;


            console.log(
                "🔄 Baixando materiais " +
                (inicio + 1).toLocaleString("pt-BR") +
                " até " +
                (fim + 1).toLocaleString("pt-BR") +
                "..."
            );


            const {
                data,
                error
            } =
                await clienteSupabase
                    .from(
                        "materiais"
                    )
                    .select(
                        "id,codigo,descricao,referencia,marca,local,quantidade,quantidade_reservada,disponivel,ultima_entrada"
                    )
                    .order(
                        "id",
                        {
                            ascending:
                                true
                        }
                    )
                    .range(
                        inicio,
                        fim
                    );


            // ================================================
            // ERRO
            // ================================================

            if (
                error
            ) {

                throw error;

            }


            // ================================================
            // GARANTIR ARRAY
            // ================================================

            const pagina =
                Array.isArray(data)
                    ? data
                    : [];


            // ================================================
            // ADICIONAR AO INVENTÁRIO COMPLETO
            // ================================================

            inventarioCompleto.push(
                ...pagina
            );


            console.log(
                "📦 Materiais recebidos até agora: " +
                inventarioCompleto.length.toLocaleString("pt-BR")
            );


            mostrarStatusSincronizacaoOffline(
                "🟡 Sincronizando inventário offline... " +
                inventarioCompleto.length.toLocaleString("pt-BR") +
                " materiais"
            );


            // ================================================
            // FINAL DA TABELA
            // ================================================
            //
            // Se retornou menos que o tamanho da página,
            // chegamos ao final.
            //
            // ================================================

            if (
                pagina.length <
                tamanhoPaginaSincronizacao
            ) {

                break;

            }


            inicio +=
                tamanhoPaginaSincronizacao;

        }


        // ====================================================
        // VALIDAR INVENTÁRIO RECEBIDO
        // ====================================================

        if (
            inventarioCompleto.length === 0
        ) {

            throw new Error(
                "O Supabase respondeu, mas nenhum material foi encontrado."
            );

        }


        // ====================================================
        // GRAVAR CÓPIA LOCAL
        // ====================================================

        console.log(
            "💾 Gravando " +
            inventarioCompleto.length.toLocaleString("pt-BR") +
            " materiais no IndexedDB..."
        );


        mostrarStatusSincronizacaoOffline(
            "🟡 Gravando inventário offline... " +
            inventarioCompleto.length.toLocaleString("pt-BR") +
            " materiais"
        );


        await salvarCopiaLocalDoSupabase(
            inventarioCompleto
        );


        // ====================================================
        // REGISTRAR DATA
        // ====================================================

        const dataSincronizacao =
            await registrarSincronizacao();


        // ====================================================
        // RESULTADO
        // ====================================================

        console.log(
            "🟢 Sincronização do inventário concluída."
        );


        console.log(
            "📦 Materiais armazenados localmente: " +
            inventarioCompleto.length.toLocaleString("pt-BR")
        );


        console.log(
            "🕒 Última sincronização: " +
            dataSincronizacao
        );


        mostrarStatusSincronizacaoOffline(
            "🟢 Offline OK — " +
            inventarioCompleto.length.toLocaleString("pt-BR") +
            " materiais sincronizados."
        );


        return {

            sucesso:
                true,

            sincronizada:
                true,

            quantidade:
                inventarioCompleto.length,

            data:
                dataSincronizacao

        };


    } catch (erro) {

        console.error(
            "❌ Erro ao sincronizar materiais:",
            erro
        );


        mostrarStatusSincronizacaoOffline(
            "🔴 Falha ao sincronizar o inventário offline."
        );


        return {

            sucesso:
                false,

            erro:
                erro

        };


    } finally {

        sincronizacaoEmAndamento =
            false;

    }

}


// ============================================================
// FUNÇÃO: garantirInventarioLocal()
// ============================================================
//
// OBJETIVO:
//
// Garantir que o dispositivo possua uma cópia local.
//
// COMPORTAMENTO:
//
// Se existir inventário local:
//
//     não baixa novamente.
//
// Se não existir:
//
//     estando online → sincroniza.
//
// Se estiver offline:
//
//     mantém o banco local vazio.
//
// ============================================================

async function garantirInventarioLocal() {

    try {

        const quantidadeLocal =
            await contarMateriaisLocais();


        // ====================================================
        // JÁ EXISTE CÓPIA LOCAL
        // ====================================================

        if (
            quantidadeLocal > 0
        ) {

            console.log(
                "✅ Cópia local disponível: " +
                quantidadeLocal.toLocaleString("pt-BR") +
                " materiais."
            );


            mostrarStatusSincronizacaoOffline(
                "🟢 Offline OK — " +
                quantidadeLocal.toLocaleString("pt-BR") +
                " materiais disponíveis."
            );


            return {

                disponivel:
                    true,

                quantidade:
                    quantidadeLocal

            };

        }


        // ====================================================
        // NÃO EXISTE CÓPIA
        // ====================================================

        if (
            navigator.onLine !== true
        ) {

            console.warn(
                "📴 Sem inventário local e sem internet."
            );


            mostrarStatusSincronizacaoOffline(
                "🔴 Offline indisponível — este dispositivo ainda não possui inventário local."
            );


            return {

                disponivel:
                    false,

                quantidade:
                    0,

                offline:
                    true

            };

        }


        // ====================================================
        // PRIMEIRA SINCRONIZAÇÃO
        // ====================================================

        console.log(
            "🟡 Nenhum inventário local encontrado."
        );


        console.log(
            "🟡 Iniciando primeira sincronização com o Supabase..."
        );


        return await sincronizarMateriaisLocaisComSupabase(
            false
        );

    } catch (erro) {

        console.error(
            "Erro ao garantir inventário local:",
            erro
        );


        return {

            disponivel:
                false,

            quantidade:
                0,

            erro:
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
                await sincronizarMateriaisLocaisComSupabase(
                    false
                );


            if (
                resultado &&
                resultado.sucesso
            ) {

                return materiais;

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
