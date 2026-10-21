// ============================================================
// PMOBILE
// ARQUIVO: conferencias.js
// ============================================================
//
// OBJETIVO:
//
// Controlar o histórico das conferências realizadas.
//
// ARQUITETURA:
//
// ONLINE:
//   Supabase = fonte central
//   IndexedDB = cópia local do histórico
//
// OFFLINE:
//   IndexedDB = histórico local
//   Fila offline = conferências ainda não sincronizadas
//
// QUANDO A INTERNET VOLTAR:
//
//   fila offline
//        ↓
//   Supabase
//        ↓
//   sucesso / já existente
//        ↓
//   permanece no histórico local
//   e é removida somente da fila
//
// IMPORTANTE:
//
// - conferencia_id é o identificador único da conferência.
// - O histórico local NÃO substitui o Supabase.
// - O Supabase continua sendo a fonte central.
// - O IndexedDB serve como cópia/fallback offline.
// - Não existe bloqueio para material sem código ou descrição.
// ============================================================


// ============================================================
// VARIÁVEL GLOBAL
// ============================================================

let conferencias = [];


// ============================================================
// CONFIGURAÇÃO DO HISTÓRICO LOCAL
// ============================================================
//
// Este banco é separado:
//
// PMOBILE_HISTORICO_CONFERENCIAS
//
// Isso evita alterar a estrutura do banco:
//
// PMOBILE_FILA_CONFERENCIAS
//
// usado pelo conferencia.js.
// ============================================================

const nomeBancoHistoricoConferencias =
    "PMOBILE_HISTORICO_CONFERENCIAS";

const versaoBancoHistoricoConferencias =
    1;

const nomeTabelaHistoricoConferencias =
    "historico";


// ============================================================
// FUNÇÃO: obterClienteSupabaseConferencias()
// ============================================================
//
// OBJETIVO:
//
// Retornar o cliente Supabase inicializado.
//
// ============================================================

function obterClienteSupabaseConferencias() {

    if (!window.clienteSupabase) {

        throw new Error(
            "Cliente Supabase não foi inicializado."
        );

    }

    return window.clienteSupabase;

}


// ============================================================
// FUNÇÃO: converterConferenciaSupabaseParaPMobile()
// ============================================================
//
// OBJETIVO:
//
// Converter o registro do Supabase para o formato utilizado
// pelo PMOBILE.
//
// ============================================================

function converterConferenciaSupabaseParaPMobile(
    registro
) {

    if (!registro) {

        return null;

    }


    return {

        id:
            registro.id ?? null,

        conferenciaId:
            registro.conferencia_id ?? null,

        materialId:
            registro.material_id ?? null,

        codigo:
            registro.codigo_material ?? "",

        descricao:
            registro.descricao_material ?? "",

        referencia:
            registro.referencia_material ?? "",

        quantidadeEsperada:
            Number(
                registro.quantidade_esperada ?? 0
            ),

        quantidadeFisica:
            Number(
                registro.quantidade_fisica ?? 0
            ),

        diferenca:
            Number(
                registro.diferenca ?? 0
            ),

        status:
            registro.status ?? "CONFERIDO",

        usuarioId:
            registro.usuario_id ?? null,

        usuarioNome:
            registro.usuario_nome ?? "",

        data:
            registro.criado_em ?? null,

        criadoEm:
            registro.criado_em ?? null

    };

}


// ============================================================
// FUNÇÃO: converterConferenciaPMobileParaSupabase()
// ============================================================
//
// OBJETIVO:
//
// Converter uma conferência do PMOBILE para o formato
// utilizado na tabela public.conferencias.
//
// ============================================================

function converterConferenciaPMobileParaSupabase(
    contagem
) {

    if (!contagem) {

        throw new Error(
            "Dados da conferência não foram informados."
        );

    }


    if (
        !contagem.conferenciaId
    ) {

        throw new Error(
            "ID único da conferência não foi informado."
        );

    }


    return {

        conferencia_id:
            contagem.conferenciaId,

        material_id:
            contagem.materialId ?? null,

        codigo_material:
            contagem.codigo ?? "",

        descricao_material:
            contagem.descricao ?? "",

        referencia_material:
            contagem.referencia ?? null,

        quantidade_esperada:
            Number(
                contagem.quantidadeEsperada ?? 0
            ),

        quantidade_fisica:
            Number(
                contagem.quantidadeFisica ?? 0
            ),

        diferenca:
            Number(
                contagem.diferenca ?? 0
            ),

        status:
            contagem.status ?? "CONFERIDO"

    };

}


// ============================================================
// FUNÇÃO: abrirBancoHistoricoConferencias()
// ============================================================
//
// OBJETIVO:
//
// Criar/abrir o IndexedDB utilizado para guardar a cópia
// local do histórico.
//
// ============================================================

function abrirBancoHistoricoConferencias() {

    return new Promise(
        function(resolve, reject) {

            const requisicao =
                indexedDB.open(
                    nomeBancoHistoricoConferencias,
                    versaoBancoHistoricoConferencias
                );


            requisicao.onupgradeneeded =
                function(evento) {

                    const banco =
                        evento.target.result;


                    if (
                        !banco.objectStoreNames.contains(
                            nomeTabelaHistoricoConferencias
                        )
                    ) {

                        banco.createObjectStore(
                            nomeTabelaHistoricoConferencias,
                            {
                                keyPath: "conferenciaId"
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
// FUNÇÃO: salvarConferenciaNoHistoricoLocal()
// ============================================================
//
// OBJETIVO:
//
// Salvar ou atualizar uma conferência no histórico local.
//
// A chave é conferenciaId.
//
// Isso evita duplicação.
//
// ============================================================

async function salvarConferenciaNoHistoricoLocal(
    conferencia
) {

    if (!conferencia) {

        return;

    }


    if (
        !conferencia.conferenciaId
    ) {

        console.warn(
            "Conferência sem conferenciaId não foi salva no histórico local."
        );

        return;

    }


    const banco =
        await abrirBancoHistoricoConferencias();


    const transacao =
        banco.transaction(
            nomeTabelaHistoricoConferencias,
            "readwrite"
        );


    const tabela =
        transacao.objectStore(
            nomeTabelaHistoricoConferencias
        );


    tabela.put(
        conferencia
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
                            "Transação do histórico local foi abortada."
                        )
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: salvarListaNoHistoricoLocal()
// ============================================================
//
// OBJETIVO:
//
// Salvar várias conferências no histórico local.
//
// ============================================================

async function salvarListaNoHistoricoLocal(
    lista
) {

    if (
        !Array.isArray(lista) ||
        lista.length === 0
    ) {

        return;

    }


    const banco =
        await abrirBancoHistoricoConferencias();


    const transacao =
        banco.transaction(
            nomeTabelaHistoricoConferencias,
            "readwrite"
        );


    const tabela =
        transacao.objectStore(
            nomeTabelaHistoricoConferencias
        );


    lista.forEach(
        function(conferencia) {

            if (
                conferencia &&
                conferencia.conferenciaId
            ) {

                tabela.put(
                    conferencia
                );

            }

        }
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
                            "Transação do histórico local foi abortada."
                        )
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: obterHistoricoLocalConferencias()
// ============================================================
//
// OBJETIVO:
//
// Recuperar todas as conferências armazenadas localmente.
//
// ============================================================

async function obterHistoricoLocalConferencias() {

    const banco =
        await abrirBancoHistoricoConferencias();


    const transacao =
        banco.transaction(
            nomeTabelaHistoricoConferencias,
            "readonly"
        );


    const tabela =
        transacao.objectStore(
            nomeTabelaHistoricoConferencias
        );


    const requisicao =
        tabela.getAll();


    return new Promise(
        function(resolve, reject) {

            requisicao.onsuccess =
                function(evento) {

                    banco.close();


                    const resultado =
                        Array.isArray(
                            evento.target.result
                        )
                            ? evento.target.result
                            : [];


                    resultado.sort(
                        function(a, b) {

                            const dataA =
                                new Date(
                                    a.criadoEm ||
                                    a.data ||
                                    0
                                ).getTime();


                            const dataB =
                                new Date(
                                    b.criadoEm ||
                                    b.data ||
                                    0
                                ).getTime();


                            return dataB - dataA;

                        }
                    );


                    resolve(
                        resultado
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
// FUNÇÃO: limparHistoricoLocalConferencias()
// ============================================================
//
// OBJETIVO:
//
// Limpar somente a cópia local do histórico.
//
// NÃO apaga o Supabase.
//
// Esta função é usada internamente quando necessário.
// ============================================================

async function limparHistoricoLocalConferenciasDoUsuario(
    usuarioId
) {

    if (
        usuarioId === null ||
        usuarioId === undefined ||
        Number.isNaN(Number(usuarioId))
    ) {
        throw new Error(
            "ID do usuário não informado para limpeza local."
        );
    }

    const banco =
        await abrirBancoHistoricoConferencias();

    const transacao =
        banco.transaction(
            nomeTabelaHistoricoConferencias,
            "readwrite"
        );

    const tabela =
        transacao.objectStore(
            nomeTabelaHistoricoConferencias
        );

    const requisicao =
        tabela.getAll();

    return new Promise(
        function(resolve, reject) {

            requisicao.onsuccess =
                function(evento) {

                    const registros =
                        Array.isArray(evento.target.result)
                            ? evento.target.result
                            : [];

                    registros.forEach(
                        function(registro) {

                            if (
                                Number(registro?.usuarioId) ===
                                Number(usuarioId)
                            ) {
                                tabela.delete(
                                    registro.conferenciaId
                                );
                            }

                        }
                    );

                };

            requisicao.onerror =
                function(evento) {

                    banco.close();

                    reject(
                        evento.target.error
                    );

                };

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
                            "Transação do histórico local foi abortada."
                        )
                    );

                };

        }
    );

}



    const banco =
        await abrirBancoHistoricoConferencias();


    const transacao =
        banco.transaction(
            nomeTabelaHistoricoConferencias,
            "readwrite"
        );


    const tabela =
        transacao.objectStore(
            nomeTabelaHistoricoConferencias
        );


    tabela.clear();


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
                            "Limpeza do histórico local foi abortada."
                        )
                    );

                };

        }
    );

}


// ============================================================
// FUNÇÃO: adicionarConferenciaSemDuplicar()
// ============================================================
//
// OBJETIVO:
//
// Adicionar uma conferência à variável global somente se o
// conferenciaId ainda não estiver presente.
//
// ============================================================

function adicionarConferenciaSemDuplicar(
    conferencia
) {

    if (!conferencia) {

        return;

    }


    if (
        !conferencia.conferenciaId
    ) {

        return;

    }


    const indice =
        conferencias.findIndex(
            function(item) {

                return (
                    item &&
                    item.conferenciaId ===
                    conferencia.conferenciaId
                );

            }
        );


    if (
        indice === -1
    ) {

        conferencias.push(
            conferencia
        );

        return;

    }


    // ========================================================
    // Se já existir, substituímos pelo registro mais completo.
    // ========================================================

    conferencias[indice] =
        {
            ...conferencias[indice],
            ...conferencia
        };

}


// ============================================================
// FUNÇÃO: ordenarConferencias()
// ============================================================
//
// OBJETIVO:
//
// Manter o histórico mais recente primeiro.
//
// ============================================================

function ordenarConferencias() {

    conferencias.sort(
        function(a, b) {

            const dataA =
                new Date(
                    a?.criadoEm ||
                    a?.data ||
                    0
                ).getTime();


            const dataB =
                new Date(
                    b?.criadoEm ||
                    b?.data ||
                    0
                ).getTime();


            return dataB - dataA;

        }
    );

}


// ============================================================
// FUNÇÃO: carregarConferenciasSupabase()
// ============================================================
//
// OBJETIVO:
//
// Carregar TODAS as conferências do Supabase usando paginação.
//
// Por que:
//
// O Supabase não deve depender de um único SELECT para um
// histórico que pode crescer continuamente.
//
// Cada página possui no máximo 1000 registros.
//
// ============================================================

async function carregarConferenciasSupabase() {

    const clienteSupabase =
        obterClienteSupabaseConferencias();


    const tamanhoPagina =
        1000;


    let inicio =
        0;


    let todas =
        [];


    while (true) {

        const fim =
            inicio +
            tamanhoPagina -
            1;


        const { data, error } =
            await clienteSupabase

                .from("conferencias")

                .select(
                    "id,conferencia_id,material_id,codigo_material,descricao_material,referencia_material,quantidade_esperada,quantidade_fisica,diferenca,status,usuario_id,usuario_nome,criado_em"
                )

                .order(
                    "criado_em",
                    {
                        ascending: false
                    }
                )

                .range(
                    inicio,
                    fim
                );


        if (error) {

            throw error;

        }


        const registros =
            Array.isArray(data)
                ? data
                : [];


        todas =
            todas.concat(
                registros
            );


        console.log(
            "Página de conferências carregada:",
            inicio,
            "-",
            fim,
            "Registros:",
            registros.length
        );


        if (
            registros.length <
            tamanhoPagina
        ) {

            break;

        }


        inicio +=
            tamanhoPagina;

    }


    return todas

        .map(
            converterConferenciaSupabaseParaPMobile
        )

        .filter(
            function(registro) {

                return (
                    registro !== null &&
                    registro.conferenciaId
                );

            }
        );

}


// ============================================================
// FUNÇÃO: carregarConferencias()
// ============================================================
//
// OBJETIVO:
//
// Carregar o histórico completo.
//
// ONLINE:
//
//   1. tenta Supabase;
//   2. salva cópia local;
//   3. inclui pendentes da fila;
//   4. remove duplicações.
//
// OFFLINE:
//
//   1. histórico local;
//   2. fila offline;
//   3. remove duplicações.
//
// ============================================================

async function carregarConferencias() {

    conferencias =
        [];


    // ========================================================
    // PRIMEIRO:
//
//    Recuperamos o histórico local.
//    Isso permite que o aplicativo tenha alguma informação
//    mesmo antes de consultar o Supabase.
// ========================================================

    let historicoLocal =
        [];


    try {

        historicoLocal =
            await obterHistoricoLocalConferencias();

    } catch (erro) {

        console.warn(
            "Não foi possível carregar o histórico local:",
            erro
        );

    }


    historicoLocal.forEach(
        adicionarConferenciaSemDuplicar
    );


    // ========================================================
    // SEGUNDO:
//
//    Recuperamos conferências pendentes da fila offline.
//
//    Esta função pertence ao conferencia.js.
//
//    Não exigimos que ela exista para o histórico funcionar.
// ========================================================

    if (
        typeof obterConferenciasPendentes ===
        "function"
    ) {

        try {

            const pendentes =
                await obterConferenciasPendentes();


            const pendentesConvertidos =
                [];


            pendentes.forEach(
                function(item) {

                    if (
                        item &&
                        item.conferencia
                    ) {

                        const conferencia =
                            item.conferencia;


                        if (
                            conferencia.conferenciaId
                        ) {

                            adicionarConferenciaSemDuplicar(
                                conferencia
                            );


                            pendentesConvertidos.push(
                                conferencia
                            );

                        }

                    }

                }
            );


            // =================================================
            // Salvar pendentes no histórico local.
            //
            // Assim uma conferência criada offline não depende
            // da fila para continuar aparecendo no histórico.
            // =================================================

            if (
                pendentesConvertidos.length > 0
            ) {

                try {

                    await salvarListaNoHistoricoLocal(
                        pendentesConvertidos
                    );

                } catch (erroHistoricoPendente) {

                    console.warn(
                        "Não foi possível copiar pendentes para o histórico local:",
                        erroHistoricoPendente
                    );

                }

            }

        } catch (erroFila) {

            console.warn(
                "Não foi possível carregar a fila offline:",
                erroFila
            );

        }

    }


    // ========================================================
    // TERCEIRO:
//
//    Se estiver online, tentamos atualizar pelo Supabase.
// ========================================================

    if (
        navigator.onLine !== false
    ) {

        try {

            const dadosSupabase =
                await carregarConferenciasSupabase();


            // =================================================
            // Substituir/mesclar com a versão oficial.
            // =================================================

            dadosSupabase.forEach(
                adicionarConferenciaSemDuplicar
            );


            // =================================================
            // Salvar cópia local atualizada.
            // =================================================

            try {

                await salvarListaNoHistoricoLocal(
                    dadosSupabase
                );

            } catch (erroHistorico) {

                console.warn(
                    "Supabase carregado, mas não foi possível atualizar o histórico local:",
                    erroHistorico
                );

            }


            console.log(
                "Conferências carregadas do Supabase:",
                dadosSupabase.length
            );


        } catch (erroSupabase) {

            console.warn(
                "Supabase indisponível para histórico. Usando dados locais:",
                erroSupabase
            );

        }

    }


    // ========================================================
    // ORDENAR
    // ========================================================

    ordenarConferencias();


    console.log(
        "Histórico final de conferências:",
        conferencias.length
    );


    return conferencias;

}


// ============================================================
// FUNÇÃO: salvarConferencias()
// ============================================================
//
// OBJETIVO:
//
// Manter compatibilidade com chamadas antigas do PMOBILE.
//
// ============================================================

async function salvarConferencias() {

    return await carregarConferencias();

}


// ============================================================
// FUNÇÃO: salvarConferenciaSupabase()
// ============================================================
//
// OBJETIVO:
//
// Salvar uma conferência no Supabase.
//
// PROTEÇÃO:
//
// conferencia_id é UNIQUE.
//
// Se a conferência já existir:
//
//   23505
//
// significa que ela já foi sincronizada.
//
// Nesse caso, recuperamos o registro existente.
//
// ============================================================

async function salvarConferenciaSupabase(
    contagem
) {

    if (!contagem) {

        throw new Error(
            "Dados da conferência não foram informados."
        );

    }


    const clienteSupabase =
        obterClienteSupabaseConferencias();


    const registro =
        converterConferenciaPMobileParaSupabase(
            contagem
        );


    const { data, error } =
        await clienteSupabase

            .from("conferencias")

            .insert(
                registro
            )

            .select()
            .single();


    if (error) {

        // ====================================================
        // DUPLICIDADE
        // ====================================================

        if (
            error.code === "23505"
        ) {

            console.warn(
                "Conferência já existe no Supabase:",
                contagem.conferenciaId
            );


            const resultadoExistente =
                await clienteSupabase

                    .from("conferencias")

                    .select(
                        "id,conferencia_id,material_id,codigo_material,descricao_material,referencia_material,quantidade_esperada,quantidade_fisica,diferenca,status,usuario_id,criado_em"
                    )

                    .eq(
                        "conferencia_id",
                        contagem.conferenciaId
                    )

                    .maybeSingle();


            if (
                resultadoExistente.error
            ) {

                console.warn(
                    "Não foi possível recuperar a conferência já existente:",
                    resultadoExistente.error
                );


                // =============================================
                // A inserção pode ter ocorrido antes de uma
                // falha na resposta.
                //
                // Retornamos o mínimo necessário para que a
                // fila não fique presa indefinidamente.
                // =============================================

                const conferenciaMinima =
                    {
                        ...contagem
                    };


                await salvarConferenciaNoHistoricoLocal(
                    conferenciaMinima
                );


                adicionarConferenciaSemDuplicar(
                    conferenciaMinima
                );


                ordenarConferencias();


                return conferenciaMinima;

            }


            const conferenciaExistente =
                converterConferenciaSupabaseParaPMobile(
                    resultadoExistente.data
                );


            if (
                conferenciaExistente
            ) {

                adicionarConferenciaSemDuplicar(
                    conferenciaExistente
                );


                try {

                    await salvarConferenciaNoHistoricoLocal(
                        conferenciaExistente
                    );

                } catch (erroHistoricoDuplicado) {

                    console.warn(
                        "Conferência existente foi recuperada, mas não foi possível atualizar o histórico local:",
                        erroHistoricoDuplicado
                    );

                }


                ordenarConferencias();


                return conferenciaExistente;

            }


            const conferenciaMinima =
                {
                    ...contagem
                };


            await salvarConferenciaNoHistoricoLocal(
                conferenciaMinima
            );


            adicionarConferenciaSemDuplicar(
                conferenciaMinima
            );


            ordenarConferencias();


            return conferenciaMinima;

        }


        console.error(
            "Erro ao salvar conferência no Supabase:",
            error
        );


        throw error;

    }


    // ========================================================
    // CONFERÊNCIA SALVA COM SUCESSO
    // ========================================================

    const conferenciaSalva =
        converterConferenciaSupabaseParaPMobile(
            data
        );


    if (
        conferenciaSalva
    ) {

        adicionarConferenciaSemDuplicar(
            conferenciaSalva
        );


        try {

            await salvarConferenciaNoHistoricoLocal(
                conferenciaSalva
            );

        } catch (erroHistorico) {

            console.warn(
                "Conferência salva no Supabase, mas não foi possível salvar a cópia local:",
                erroHistorico
            );

        }

    }


    ordenarConferencias();


    console.log(
        "Conferência salva no Supabase:",
        conferenciaSalva
    );


    return conferenciaSalva;

}


// ============================================================
// FUNÇÃO: obterConferencias()
// ============================================================
//
// OBJETIVO:
//
// Permitir que outros scripts obtenham o histórico atual.
//
// ============================================================

function obterConferencias() {

    return conferencias;

}


// ============================================================
// FUNÇÃO: sincronizarHistoricoConferencias()
// ============================================================
//
// OBJETIVO:
//
// Atualizar o histórico após uma sincronização da fila.
//
// Esta função pode ser chamada pelo conferencia.js ou pela
// tela de histórico.
//
// ============================================================

async function sincronizarHistoricoConferencias() {

    try {

        await carregarConferencias();

        console.log(
            "✅ Histórico de conferências atualizado."
        );

    } catch (erro) {

        console.error(
            "Erro ao atualizar histórico de conferências:",
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
// Quando a internet voltar, tentamos:
//   1. sincronizar a fila;
//   2. atualizar o histórico.
//
// ============================================================

window.addEventListener(
    "online",
    async function() {

        console.log(
            "🌐 Internet voltou. Atualizando histórico de conferências..."
        );


        // ====================================================
        // Primeiro:
//
//        O conferencia.js é responsável pela sincronização da
//        fila offline.
// ====================================================

        if (
            typeof sincronizarConferenciasPendentes ===
            "function"
        ) {

            try {

                await sincronizarConferenciasPendentes();

            } catch (erroSincronizacao) {

                console.error(
                    "Erro ao sincronizar fila de conferências:",
                    erroSincronizacao
                );

            }

        }


        // ====================================================
        // Depois:
//
//        Atualizamos o histórico oficial.
// ====================================================

        try {

            await carregarConferencias();

        } catch (erroHistorico) {

            console.error(
                "Erro ao atualizar histórico após retorno da internet:",
                erroHistorico
            );

        }

    }
);


// ============================================================
// INICIALIZAÇÃO
// ============================================================
//
// NÃO carregamos automaticamente aqui.
//
// Motivo:
//
// A tela de histórico pode controlar quando precisa dos dados.
//
// Isso evita consultas desnecessárias ao Supabase na abertura
// de telas que não precisam do histórico.
//
// ============================================================


// ============================================================
// FUNÇÃO: limparConferenciasSupabase()
// ============================================================
//
// OBJETIVO:
//
// Apagar todas as conferências do Supabase.
//
// IMPORTANTE:
//
// Esta operação NÃO deve apagar os materiais.
//
// Depois da limpeza:
//
// - Supabase = vazio
// - variável local = vazia
// - histórico local = vazio
// - fila offline = NÃO é apagada automaticamente
//
// A fila não deve ser destruída sem sincronização/decisão
// explícita.
// ============================================================

async function limparConferenciasSupabase() {

    const confirmar =
        confirm(
            "⚠️ ATENÇÃO!\n\n" +
            "Todas as conferências realizadas serão apagadas.\n\n" +
            "Os materiais do inventário NÃO serão apagados.\n\n" +
            "Deseja continuar?"
        );


    if (
        !confirmar
    ) {

        return;

    }


    let clienteSupabase;


    try {

        clienteSupabase =
            obterClienteSupabaseConferencias();

    } catch (erro) {

        console.error(
            erro
        );


        alert(
            "❌ Não foi possível acessar o Supabase."
        );


        return;

    }


    try {

        const usuarioSessao =
            (typeof usuarioPmobileAtual !== "undefined" &&
                usuarioPmobileAtual?.usuario)
                ? usuarioPmobileAtual
                : window.usuarioPmobileAtual;

        if (
            !usuarioSessao?.usuario ||
            !window.credencialPmobileAtual
        ) {
            throw new Error(
                "Sessão do usuário não está disponível."
            );
        }

        const { error } =
            await clienteSupabase.rpc(
                "limpar_conferencias",
                {
                    p_usuario: usuarioSessao.usuario,
                    p_credencial: window.credencialPmobileAtual
                }
            );


        if (
            error
        ) {

            throw error;

        }


        // ====================================================
        // Limpar memória.
        // ====================================================

        const usuarioIdAtual =
            Number(usuarioSessao.id);

        conferencias =
            conferencias.filter(
                function(contagem) {
                    return Number(contagem?.usuarioId) !== usuarioIdAtual;
                }
            );


        // ====================================================
        // Limpar cópia local.
        //
        // A fila offline NÃO é apagada.
        // ====================================================

        try {

            await limparHistoricoLocalConferenciasDoUsuario(
                usuarioIdAtual
            );

        } catch (erroLocal) {

            console.warn(
                "Conferências foram apagadas do Supabase, mas não foi possível limpar a cópia local:",
                erroLocal
            );

        }


        const resultado =
            document.getElementById(
                "resultadoConferencias"
            );


        if (
            resultado
        ) {

            resultado.innerHTML =
                "<p>✅ Todas as conferências foram apagadas.</p>";

        }


        alert(
            "✅ Conferências apagadas com sucesso!"
        );


    } catch (erro) {

        console.error(
            "Erro ao limpar conferências:",
            erro
        );


        alert(
            "❌ Não foi possível limpar as conferências."
        );

    }

}


// ============================================================
// FIM DO ARQUIVO
// ============================================================
//
// FUNCIONALIDADES:
//
// ✅ Histórico online pelo Supabase
// ✅ Histórico offline pelo IndexedDB
// ✅ Cópia local persistente
// ✅ Fila offline integrada ao histórico
// ✅ Paginação do Supabase em blocos de 1000
// ✅ Proteção contra duplicação por conferencia_id
// ✅ Conferências sincronizadas permanecem no histórico local
// ✅ Fallback automático para histórico local
// ✅ Compatibilidade com conferencia.js
// ✅ Compatibilidade com conferenciasrealizadas.js
// ✅ salvarConferenciaSupabase() mantida
// ✅ limparConferenciasSupabase() mantida
// ✅ Nenhuma alteração no banco Supabase necessária
//
// ============================================================
