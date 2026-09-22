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
// ============================================================


// ============================================================
// VARIÁVEL: conferencias
// ============================================================

let conferencias = [];


// ============================================================
// FUNÇÃO: obterClienteSupabaseConferencias()
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
// Converter o objeto do PMOBILE para o formato do Supabase.
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
// FUNÇÃO: carregarConferencias()
// ============================================================

async function carregarConferencias() {

    try {

        const clienteSupabase =
            obterClienteSupabaseConferencias();


        const { data, error } =
            await clienteSupabase

                .from("conferencias")

                .select(
                    "id,conferencia_id,material_id,codigo_material,descricao_material,referencia_material,quantidade_esperada,quantidade_fisica,diferenca,status,usuario_id,criado_em"
                )

                .order(
                    "criado_em",
                    {
                        ascending: false
                    }
                );


        if (error) {

            throw error;

        }


        conferencias =
            Array.isArray(data)
                ? data
                    .map(
                        converterConferenciaSupabaseParaPMobile
                    )
                    .filter(
                        function(registro) {

                            return registro !== null;

                        }
                    )
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


        conferencias = [];


        return [];

    }

}


// ============================================================
// FUNÇÃO: salvarConferencias()
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
// O conferencia_id é UNIQUE no banco.
//
// Se a mesma conferência for enviada novamente,
// o Supabase recusará a duplicata.
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
        // DUPLICAÇÃO
        // ====================================================
        //
        // PostgreSQL retorna código 23505 para violação
        // de UNIQUE.
        //
        // Nesse caso, a conferência já existe no banco.
        //
        // Para o sistema offline, isso significa que ela
        // já foi sincronizada anteriormente.
        //
        // ====================================================

        if (
            error.code === "23505"
        ) {

            console.warn(
                "Conferência já existe no Supabase:",
                contagem.conferenciaId
            );


            const { data: existente } =
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
                existente
            ) {

                const conferenciaExistente =
                    converterConferenciaSupabaseParaPMobile(
                        existente
                    );


                if (
                    conferenciaExistente
                ) {

                    const jaExiste =
                        conferencias.some(
                            function(item) {

                                return (
                                    item.conferenciaId ===
                                    conferenciaExistente.conferenciaId
                                );

                            }
                        );


                    if (
                        !jaExiste
                    ) {

                        conferencias.unshift(
                            conferenciaExistente
                        );

                    }

                }


                return conferenciaExistente;

            }


            // =================================================
            // Mesmo que o registro não seja retornado,
            // consideramos que ele já existe.
            // =================================================

            return {

                conferenciaId:
                    contagem.conferenciaId

            };

        }


        console.error(
            "Erro ao salvar conferência no Supabase:",
            error
        );


        throw error;

    }


    const conferenciaSalva =
        converterConferenciaSupabaseParaPMobile(
            data
        );


    if (
        conferenciaSalva
    ) {

        const jaExiste =
            conferencias.some(
                function(item) {

                    return (
                        item.conferenciaId ===
                        conferenciaSalva.conferenciaId
                    );

                }
            );


        if (
            !jaExiste
        ) {

            conferencias.unshift(
                conferenciaSalva
            );

        }

    }


    console.log(
        "Conferência salva no Supabase:",
        conferenciaSalva
    );


    return conferenciaSalva;

}


// ============================================================
// FUNÇÃO: limparConferenciasSupabase()
// ============================================================
//
// OBJETIVO:
//
// Apagar todas as conferências do Supabase.
//
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

        const { error } =
            await clienteSupabase

                .from("conferencias")

                .delete()

                .not(
                    "id",
                    "is",
                    null
                );


        if (
            error
        ) {

            throw error;

        }


        conferencias = [];


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
