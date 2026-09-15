// ============================================================
// PMOBILE
// ARQUIVO: conferencias.js
// ============================================================
//
// OBJETIVO:
//
// Controlar os dados das conferências realizadas.
//
// A partir desta versão:
//
// - O Supabase passa a ser a fonte central das conferências.
// - As conferências são gravadas na tabela "conferencias".
// - O histórico é carregado diretamente do Supabase.
// - O localStorage deixa de ser utilizado como banco principal.
//
// IMPORTANTE:
//
// Este arquivo mantém os nomes das funções:
//
//     carregarConferencias()
//     salvarConferencias()
//
// para manter compatibilidade com o restante do PMOBILE.
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
// Essa variável NÃO é mais a fonte principal dos dados.
//
// A fonte oficial é:
//
//     Supabase → tabela conferencias
//
// A variável serve apenas para a tela trabalhar com
// os dados que foram carregados.
//
// ============================================================

let conferencias = [];



// ============================================================
// FUNÇÃO: obterClienteSupabaseConferencias()
// ============================================================
//
// OBJETIVO:
//
// Garantir que o cliente Supabase esteja disponível.
//
// RETORNO:
//
// Retorna o cliente Supabase inicializado em:
//
//     window.clienteSupabase
//
// ERRO:
//
// Caso o Supabase ainda não tenha sido inicializado,
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
// FUNÇÃO: carregarConferencias()
// ============================================================
//
// OBJETIVO:
//
// Carregar o histórico de conferências diretamente
// do Supabase.
//
// TABELA:
//
//     public.conferencias
//
// RESULTADO:
//
// Os registros retornados são armazenados temporariamente
// na variável:
//
//     conferencias
//
// IMPORTANTE:
//
// O localStorage não é mais utilizado.
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
        // ARMAZENAR RESULTADOS NA MEMÓRIA
        // ====================================================

        conferencias =
            Array.isArray(data)
                ? data
                : [];



        console.log(
            "Conferências carregadas do Supabase:",
            conferencias.length
        );



        return conferencias;



    } catch (erro) {

        console.error(
            "Erro ao carregar conferências do Supabase:",
            erro
        );



        // ====================================================
        // EM CASO DE ERRO
        // ====================================================
        //
        // Mantemos a variável como lista vazia para
        // evitar que o restante da aplicação quebre.
        //
        // ====================================================

        conferencias = [];



        return [];

    }

}



// ============================================================
// FUNÇÃO: salvarConferencias()
// ============================================================
//
// OBJETIVO:
//
// Manter compatibilidade com o restante do PMOBILE.
//
// IMPORTANTE:
//
// Esta função NÃO grava mais a lista inteira no localStorage.
//
// O registro individual da conferência é feito pela função:
//
//     salvarConferenciaSupabase()
//
// Portanto, esta função apenas garante que o histórico
// disponível na memória esteja atualizado.
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
// Gravar UMA nova conferência diretamente no Supabase.
//
// TABELA:
//
//     public.conferencias
//
// DADOS GRAVADOS:
//
// - material_id
// - codigo_material
// - descricao_material
// - referencia_material
// - quantidade_esperada
// - quantidade_fisica
// - diferenca
// - status
//
// O campo "criado_em" é preenchido automaticamente
// pelo banco quando configurado dessa forma.
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
    // PREPARAR DADOS
    // ========================================================
    //
    // Aqui fazemos a conversão do formato utilizado
    // pelo PMOBILE para o formato da tabela Supabase.
    //
    // ========================================================

    const registro = {

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
    // ATUALIZAR MEMÓRIA LOCAL
    // ========================================================

    if (data) {

        conferencias.unshift(
            data
        );

    }



    // ========================================================
    // RETORNO
    // ========================================================

    console.log(
        "Conferência salva no Supabase:",
        data
    );



    return data;

}



// ============================================================
// FUNÇÃO: excluirConferenciaSupabase()
// ============================================================
//
// OBJETIVO:
//
// Excluir uma conferência específica do Supabase.
//
// PARÂMETRO:
//
// id
//     ID da conferência na tabela "conferencias".
//
// IMPORTANTE:
//
// Esta função não é chamada automaticamente.
// Ela fica disponível para uma futura função de
// exclusão do histórico.
//
// ============================================================

async function excluirConferenciaSupabase(
    id
) {

    // ========================================================
    // VALIDAR ID
    // ========================================================

    if (!id) {

        throw new Error(
            "ID da conferência não informado."
        );

    }



    // ========================================================
    // OBTER CLIENTE
    // ========================================================

    const clienteSupabase =
        obterClienteSupabaseConferencias();



    // ========================================================
    // EXCLUIR REGISTRO
    // ========================================================

    const { error } =
        await clienteSupabase

            .from("conferencias")

            .delete()

            .eq(
                "id",
                id
            );



    // ========================================================
    // VERIFICAR ERRO
    // ========================================================

    if (error) {

        console.error(
            "Erro ao excluir conferência:",
            error
        );

        throw error;

    }



    // ========================================================
    // REMOVER DA MEMÓRIA
    // ========================================================

    conferencias =
        conferencias.filter(
            function (contagem) {

                return contagem.id !== id;

            }
        );



    console.log(
        "Conferência excluída:",
        id
    );

}



// ============================================================
// INICIALIZAÇÃO
// ============================================================
//
// IMPORTANTE:
//
// Não executamos carregarConferencias() imediatamente.
//
// O motivo é que o arquivo supabase.js pode ainda estar
// inicializando o cliente Supabase.
//
// O carregamento será feito quando o histórico for aberto
// ou quando outra parte do sistema chamar:
//
//     carregarConferencias()
//
// ============================================================