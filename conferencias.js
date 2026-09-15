// ============================================================
// PMOBILE
// ARQUIVO: conferencias.js
// ============================================================
//
// OBJETIVO:
//
// Controlar os dados das conferências realizadas.
//
// O Supabase é a fonte central das conferências.
//
// Este arquivo faz a ligação entre:
//
//     Supabase
//          ↕
//     conferencias.js
//          ↕
//     restante do PMOBILE
//
// IMPORTANTE:
//
// O Supabase utiliza nomes de campos em snake_case.
//
// Exemplo:
//
//     codigo_material
//     quantidade_esperada
//     quantidade_fisica
//
// O restante do PMOBILE utiliza nomes em camelCase.
//
// Exemplo:
//
//     codigo
//     quantidadeEsperada
//     quantidadeFisica
//
// Este arquivo faz essa conversão.
//
// ============================================================


// ============================================================
// VARIÁVEL: conferencias
// ============================================================
//
// OBJETIVO:
//
// Armazenar temporariamente na memória do navegador
// as conferências carregadas do Supabase.
//
// IMPORTANTE:
//
// Esta variável NÃO é o banco de dados.
//
// A fonte oficial dos dados é:
//
//     Supabase → tabela conferencias
//
// A variável existe apenas para disponibilizar os dados
// para as telas do PMOBILE.
//
// ============================================================

let conferencias = [];


// ============================================================
// FUNÇÃO: obterClienteSupabaseConferencias()
//
// OBJETIVO:
//
// Garantir que o cliente Supabase esteja disponível.
//
// RETORNO:
//
// Retorna:
//
//     window.clienteSupabase
//
// ERRO:
//
// Caso o cliente não tenha sido inicializado,
// interrompe a operação.
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
//
// OBJETIVO:
//
// Converter um registro vindo do Supabase para o formato
// utilizado internamente pelo PMOBILE.
//
// Supabase:
//
//     codigo_material
//     descricao_material
//     referencia_material
//     quantidade_esperada
//     quantidade_fisica
//
// PMOBILE:
//
//     codigo
//     descricao
//     referencia
//     quantidadeEsperada
//     quantidadeFisica
//
// ============================================================

function converterConferenciaSupabaseParaPMobile(
    registro
) {

    if (!registro) {
        return null;
    }


    return {

        // ====================================================
        // IDENTIFICAÇÃO
        // ====================================================

        id:
            registro.id ?? null,

        materialId:
            registro.material_id ?? null,


        // ====================================================
        // DADOS DO MATERIAL
        // ====================================================

        codigo:
            registro.codigo_material ?? "",

        descricao:
            registro.descricao_material ?? "",

        referencia:
            registro.referencia_material ?? "",


        // ====================================================
        // QUANTIDADES
        // ====================================================

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


        // ====================================================
        // STATUS
        // ====================================================

        status:
            registro.status ?? "CONFERIDO",


        // ====================================================
        // USUÁRIO
        // ====================================================

        usuarioId:
            registro.usuario_id ?? null,


        // ====================================================
        // DATA
        // ====================================================

        data:
            registro.criado_em ?? null,

        criadoEm:
            registro.criado_em ?? null

    };

}


// ============================================================
// FUNÇÃO: converterConferenciaPMobileParaSupabase()
//
// OBJETIVO:
//
// Converter uma conferência do formato interno do PMOBILE
// para o formato utilizado pela tabela do Supabase.
//
// PMOBILE:
//
//     codigo
//     descricao
//     quantidadeEsperada
//     quantidadeFisica
//
// Supabase:
//
//     codigo_material
//     descricao_material
//     quantidade_esperada
//     quantidade_fisica
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


    return {

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
// FUNÇÃO: carregarConferencias()
//
// OBJETIVO:
//
// Carregar o histórico diretamente do Supabase.
//
// Depois da consulta:
//
//     Supabase
//          ↓
//     conversão
//          ↓
//     conferencias
//
// A variável conferencias sempre ficará no formato
// utilizado pelo PMOBILE.
//
// ============================================================

async function carregarConferencias() {

    try {

        // ====================================================
        // OBTER CLIENTE SUPABASE
        // ====================================================

        const clienteSupabase =
            obterClienteSupabaseConferencias();


        // ====================================================
        // CONSULTAR CONFERÊNCIAS
        // ====================================================

        const { data, error } =
            await clienteSupabase

                .from("conferencias")

                .select(
                    "id,material_id,codigo_material,descricao_material,referencia_material,quantidade_esperada,quantidade_fisica,diferenca,status,usuario_id,criado_em"
                )

                .order(
                    "criado_em",
                    {
                        ascending: false
                    }
                );


        // ====================================================
        // VERIFICAR ERRO
        // ====================================================

        if (error) {

            throw error;

        }


        // ====================================================
        // CONVERTER DADOS
        // ====================================================

        conferencias =
            Array.isArray(data)
                ? data
                    .map(
                        converterConferenciaSupabaseParaPMobile
                    )
                    .filter(
                        function (registro) {
                            return registro !== null;
                        }
                    )
                : [];


        // ====================================================
        // LOG
        // ====================================================

        console.log(
            "Conferências carregadas do Supabase:",
            conferencias.length
        );


        // ====================================================
        // RETORNO
        // ====================================================

        return conferencias;


    } catch (erro) {

        // ====================================================
        // TRATAMENTO DE ERRO
        // ====================================================

        console.error(
            "Erro ao carregar conferências do Supabase:",
            erro
        );


        // ====================================================
        // MANTER APLICAÇÃO ESTÁVEL
        // ====================================================

        conferencias = [];


        return [];

    }

}


// ============================================================
// FUNÇÃO: salvarConferencias()
//
// OBJETIVO:
//
// Manter compatibilidade com o restante do PMOBILE.
//
// IMPORTANTE:
//
// Esta função NÃO utiliza localStorage.
//
// O salvamento de uma conferência é realizado pela:
//
//     salvarConferenciaSupabase()
//
// Depois do salvamento, esta função pode ser utilizada
// para atualizar a lista em memória.
//
// ============================================================

async function salvarConferencias() {

    return await carregarConferencias();

}


// ============================================================
// FUNÇÃO: salvarConferenciaSupabase()
//
// OBJETIVO:
//
// Gravar uma nova conferência diretamente no Supabase.
//
// FLUXO:
//
//     PMOBILE
//        ↓
//     converter
//        ↓
//     Supabase
//        ↓
//     converter
//        ↓
//     memória do PMOBILE
//
// ============================================================

async function salvarConferenciaSupabase(
    contagem
) {

    // ========================================================
    // VALIDAR DADOS
    // ========================================================

    if (!contagem) {

        throw new Error(
            "Dados da conferência não foram informados."
        );

    }


    // ========================================================
    // OBTER CLIENTE SUPABASE
    // ========================================================

    const clienteSupabase =
        obterClienteSupabaseConferencias();


    // ========================================================
    // CONVERTER PARA FORMATO DO SUPABASE
    // ========================================================

    const registro =
        converterConferenciaPMobileParaSupabase(
            contagem
        );


    // ========================================================
    // INSERIR NO SUPABASE
    // ========================================================

    const { data, error } =
        await clienteSupabase

            .from("conferencias")

            .insert(
                registro
            )

            .select()
            .single();


    // ========================================================
    // VERIFICAR ERRO
    // ========================================================

    if (error) {

        console.error(
            "Erro ao salvar conferência no Supabase:",
            error
        );

        throw error;

    }


    // ========================================================
    // CONVERTER RESPOSTA
    // ========================================================

    const conferenciaSalva =
        converterConferenciaSupabaseParaPMobile(
            data
        );


    // ========================================================
    // ATUALIZAR MEMÓRIA
    // ========================================================

    if (conferenciaSalva) {

        conferencias.unshift(
            conferenciaSalva
        );

    }


    // ========================================================
    // LOG
    // ========================================================

    console.log(
        "Conferência salva no Supabase:",
        conferenciaSalva
    );


    // ========================================================
    // RETORNO
    // ========================================================

    return conferenciaSalva;

}


// ============================================================
// FUNÇÃO: limparConferenciasSupabase()
// ============================================================
//
// OBJETIVO:
//
// Excluir TODAS as conferências armazenadas no Supabase.
//
// IMPORTANTE:
//
// Esta função:
//     - NÃO apaga materiais
//     - NÃO apaga importações
//     - NÃO altera a tabela materiais
//     - apaga somente a tabela conferencias
//
// Depois da exclusão:
//     - a memória do PMOBILE é limpa
//     - a tela de conferências é atualizada
//
// ============================================================

async function limparConferenciasSupabase() {

    // ========================================================
    // CONFIRMAÇÃO
    // ========================================================

    const confirmar = confirm(
        "⚠️ ATENÇÃO!\n\n" +
        "Todas as conferências realizadas serão apagadas.\n\n" +
        "Os materiais do inventário NÃO serão apagados.\n\n" +
        "Deseja continuar?"
    );


    if (!confirmar) {

        return;

    }


    // ========================================================
    // OBTER CLIENTE SUPABASE
    // ========================================================

    let clienteSupabase;

    try {

        clienteSupabase =
            obterClienteSupabaseConferencias();

    } catch (erro) {

        console.error(
            "Erro ao obter cliente Supabase:",
            erro
        );

        alert(
            "❌ Não foi possível acessar o Supabase."
        );

        return;

    }


    // ========================================================
    // EXECUTAR EXCLUSÃO
    // ========================================================

    try {

        console.log(
            "Iniciando limpeza das conferências..."
        );


        const { error } =
            await clienteSupabase

                .from("conferencias")

                .delete()

                // A coluna id é obrigatória,
                // portanto esta condição seleciona
                // todos os registros.
                .not(
                    "id",
                    "is",
                    null
                );


        // ====================================================
        // VERIFICAR ERRO
        // ====================================================

        if (error) {

            console.error(
                "Erro ao limpar conferências:",
                error
            );

            throw error;

        }


        // ====================================================
        // LIMPAR MEMÓRIA
        // ====================================================

        conferencias = [];


        // ====================================================
        // ATUALIZAR TELA
        // ====================================================

        const resultado =
            document.getElementById(
                "resultadoConferencias"
            );


        if (resultado) {

            resultado.innerHTML =
                "<p>✅ Todas as conferências foram apagadas.</p>";

        }


        // ====================================================
        // CONFIRMAÇÃO
        // ====================================================

        alert(
            "✅ Conferências apagadas com sucesso!"
        );


        console.log(
            "Todas as conferências foram excluídas."
        );


    } catch (erro) {

        console.error(
            "Erro ao limpar conferências:",
            erro
        );


        alert(
            "❌ Não foi possível limpar as conferências.\n\n" +
            "Verifique a conexão com o Supabase."
        );

    }

}