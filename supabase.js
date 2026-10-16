// ============================================================
// PMOBILE
// ARQUIVO: supabase.js
// ============================================================
//
// OBJETIVO:
//
// Centralizar a comunicação básica do PMOBILE com o Supabase.
//
// RESPONSABILIDADES DESTE ARQUIVO:
//
// 1. Configurar a URL do projeto Supabase.
// 2. Configurar a Publishable Key.
// 3. Inicializar o cliente Supabase.
// 4. Disponibilizar o cliente para os demais arquivos.
// 5. Testar a leitura da tabela "materiais".
// 6. Verificar os materiais existentes.
// 7. Identificar possíveis problemas nos registros.
// 8. Mostrar o status da conexão/verificação.
// 9. Mostrar detalhes dos problemas encontrados.
// 10. Permitir limpar os materiais do Supabase.
//
// IMPORTANTE:
//
// O Supabase é o banco central do PMOBILE.
//
// A importação dos materiais continua sendo realizada pelo
// arquivo:
//
//     importacao.js
//
// Este arquivo NÃO realiza a importação da planilha.
//
// Este arquivo também NÃO altera o IndexedDB.
//
// ============================================================
//
// ORGANIZAÇÃO VISUAL:
//
// Este arquivo NÃO define aparência dos avisos.
//
// Toda a aparência deve ficar exclusivamente no:
//
//     style.css
//
// Os elementos criados aqui possuem IDs próprios:
//
//     #statusSupabase
//     #resultadoVerificacaoSupabase
//
// Dessa forma, posição, cores, transparência, bordas,
// tamanhos, espaçamentos e responsividade podem ser
// controlados somente pelo CSS.
//
// ============================================================



// ============================================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================================
//
// URL principal do projeto Supabase.
//
// ============================================================

const SUPABASE_URL =
    "https://rxyvllbebtgbfbqoimwe.supabase.co";



// ============================================================
// CHAVE PÚBLICA DO SUPABASE
// ============================================================
//
// Publishable Key utilizada pelo frontend.
//
// Essa chave pode ser utilizada no navegador.
//
// IMPORTANTE:
//
// Chaves secretas ou service_role NUNCA devem ser
// colocadas neste arquivo.
//
// ============================================================

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Ckh6ls7eIh_11wviwxMlCQ_25Oes0QF";



// ============================================================
// FUNÇÃO: mostrarStatusSupabase()
// ============================================================
//
// OBJETIVO:
//
// Criar ou atualizar o aviso de status do Supabase.
//
// O aviso pode apresentar mensagens como:
//
//     🟢 Supabase inicializado com sucesso
//
//     🟡 Verificando todos os materiais...
//
//     ⚠️ 93.912 materiais verificados.
//        2 problemas encontrados.
//
// FUNCIONAMENTO:
//
// 1. Procura o elemento #statusSupabase.
// 2. Se não existir, cria o elemento.
// 3. Limpa o conteúdo anterior.
// 4. Insere a nova mensagem.
// 5. Adiciona o botão "✕".
// 6. O botão permite fechar somente o aviso.
//
// IMPORTANTE:
//
// Nenhuma aparência visual é definida aqui.
//
// Toda a aparência deste aviso deve ser controlada no:
//
//     style.css
//
// utilizando:
//
//     #statusSupabase
//     #statusSupabase button
//
// PARÂMETRO:
//
// mensagem
//     Texto que será apresentado ao usuário.
//
// ============================================================

function mostrarStatusSupabase(
    mensagem
) {

    // ========================================================
    // PROCURAR AVISO EXISTENTE
    // ========================================================

    let status =
        document.getElementById(
            "statusSupabase"
        );


    // ========================================================
    // CRIAR AVISO CASO NÃO EXISTA
    // ========================================================

    if (!status) {

        status =
            document.createElement(
                "div"
            );


        status.id =
            "statusSupabase";


        // ====================================================
        // ADICIONAR À PÁGINA
        // ====================================================

        document.body.appendChild(
            status
        );

    }


    // ========================================================
    // LIMPAR CONTEÚDO ANTERIOR
    // ========================================================

    status.innerHTML =
        "";


    // ========================================================
    // CRIAR TEXTO DO STATUS
    // ========================================================

    const textoStatus =
        document.createElement(
            "span"
        );


    textoStatus.textContent =
        mensagem;


    // ========================================================
    // ADICIONAR TEXTO AO AVISO
    // ========================================================

    status.appendChild(
        textoStatus
    );


    // ========================================================
    // CRIAR BOTÃO FECHAR
    // ========================================================

    const botaoFechar =
        document.createElement(
            "button"
        );


    botaoFechar.type =
        "button";


    botaoFechar.textContent =
        "✕";


    botaoFechar.title =
        "Fechar aviso";


    // ========================================================
    // FUNÇÃO DO BOTÃO
    // ========================================================

    botaoFechar.onclick =
        fecharStatusSupabase;


    // ========================================================
    // ADICIONAR BOTÃO AO AVISO
    // ========================================================

    status.appendChild(
        botaoFechar
    );

}



// ============================================================
// FUNÇÃO: fecharStatusSupabase()
// ============================================================
//
// OBJETIVO:
//
// Fechar/remover da tela o aviso:
//
//     #statusSupabase
//
// IMPORTANTE:
//
// Esta função altera somente a interface.
//
// Ela NÃO:
//
// - cancela consultas;
// - interrompe a verificação;
// - desconecta o Supabase;
// - remove dados;
// - altera materiais.
//
// Se uma verificação estiver acontecendo, ela continuará
// normalmente mesmo depois que o usuário fechar o aviso.
//
// ============================================================

function fecharStatusSupabase() {

    // ========================================================
    // PROCURAR AVISO
    // ========================================================

    const status =
        document.getElementById(
            "statusSupabase"
        );


    // ========================================================
    // AVISO NÃO EXISTE
    // ========================================================

    if (!status) {

        return;

    }


    // ========================================================
    // REMOVER AVISO
    // ========================================================

    status.remove();

}



// ============================================================
// FUNÇÃO: mostrarErrosSupabase()
// ============================================================
//
// OBJETIVO:
//
// Mostrar na tela os problemas encontrados durante
// a verificação dos materiais.
//
// PARÂMETROS:
//
// erros
//     Array contendo as mensagens dos problemas.
//
// totalEncontrado
//     Quantidade total de materiais analisados.
//
// quantidadeErros
//     Quantidade total de problemas encontrados.
//
// FUNCIONAMENTO:
//
// 1. Procura #resultadoVerificacaoSupabase.
// 2. Se não existir, cria o painel.
// 3. Mostra o total de materiais verificados.
// 4. Mostra a quantidade de problemas.
// 5. Exibe os detalhes dos problemas.
// 6. Limita a apresentação aos primeiros 20 problemas.
// 7. Adiciona um botão "Fechar".
//
// IMPORTANTE:
//
// Todos os problemas continuam disponíveis no console.
//
// Nenhuma aparência visual é definida aqui.
//
// O visual deve ser controlado exclusivamente pelo:
//
//     style.css
//
// utilizando:
//
//     #resultadoVerificacaoSupabase
//     #resultadoVerificacaoSupabase h3
//     #resultadoVerificacaoSupabase p
//     #resultadoVerificacaoSupabase ul
//     #resultadoVerificacaoSupabase li
//     #resultadoVerificacaoSupabase hr
//     #resultadoVerificacaoSupabase button
//
// ============================================================

function mostrarErrosSupabase(
    erros,
    totalEncontrado,
    quantidadeErros
) {

    // ========================================================
    // PROCURAR PAINEL EXISTENTE
    // ========================================================

    let area =
        document.getElementById(
            "resultadoVerificacaoSupabase"
        );


    // ========================================================
    // CRIAR PAINEL CASO NÃO EXISTA
    // ========================================================

    if (!area) {

        area =
            document.createElement(
                "div"
            );


        area.id =
            "resultadoVerificacaoSupabase";


        // ====================================================
        // ADICIONAR À PÁGINA
        // ====================================================

        document.body.appendChild(
            area
        );

    }


    // ========================================================
    // INICIAR CONTEÚDO DO PAINEL
    // ========================================================

    let html =
        "";


    // ========================================================
    // TÍTULO
    // ========================================================

    html +=
        "<h3>⚠️ Problemas encontrados</h3>";


    // ========================================================
    // TOTAL DE MATERIAIS
    // ========================================================

    html +=
        "<p><strong>" +
        totalEncontrado.toLocaleString(
            "pt-BR"
        ) +
        "</strong> materiais verificados.</p>";


    // ========================================================
    // TOTAL DE PROBLEMAS
    // ========================================================

    html +=
        "<p><strong>" +
        quantidadeErros.toLocaleString(
            "pt-BR"
        ) +
        "</strong> problemas encontrados.</p>";


    // ========================================================
    // DIVISOR
    // ========================================================

    html +=
        "<hr>";


    // ========================================================
    // NENHUM DETALHE DISPONÍVEL
    // ========================================================

    if (
        erros.length === 0
    ) {

        html +=
            "<p>🟢 Nenhum problema detalhado encontrado.</p>";

    } else {

        // ====================================================
        // TÍTULO DOS DETALHES
        // ====================================================

        html +=
            "<p><strong>Detalhes:</strong></p>";


        // ====================================================
        // ABRIR LISTA
        // ====================================================

        html +=
            "<ul>";


        // ====================================================
        // MOSTRAR NO MÁXIMO 20 PROBLEMAS
        // ====================================================

        erros
            .slice(
                0,
                20
            )
            .forEach(
                erro => {

                    html +=
                        "<li>" +
                        escaparHTML(
                            erro
                        ) +
                        "</li>";

                }
            );


        // ====================================================
        // FECHAR LISTA
        // ====================================================

        html +=
            "</ul>";


        // ====================================================
        // EXISTEM MAIS DE 20 PROBLEMAS
        // ====================================================

        if (
            erros.length > 20
        ) {

            html +=
                "<p>" +
                "⚠️ Apenas os primeiros 20 problemas " +
                "estão sendo exibidos." +
                "</p>";

        }

    }


    // ========================================================
    // BOTÃO FECHAR
    // ========================================================

    html +=
        "<br>" +
        "<button " +
        "type=\"button\" " +
        "onclick=\"fecharErrosSupabase()\">" +
        "Fechar" +
        "</button>";


    // ========================================================
    // MOSTRAR CONTEÚDO
    // ========================================================

    area.innerHTML =
        html;

}



// ============================================================
// FUNÇÃO: fecharErrosSupabase()
// ============================================================
//
// OBJETIVO:
//
// Fechar/remover o painel:
//
//     #resultadoVerificacaoSupabase
//
// Esta função afeta somente a interface.
//
// Os erros encontrados continuam existindo durante
// a execução da verificação e também permanecem registrados
// no console do navegador.
//
// ============================================================

function fecharErrosSupabase() {

    // ========================================================
    // PROCURAR PAINEL
    // ========================================================

    const area =
        document.getElementById(
            "resultadoVerificacaoSupabase"
        );


    // ========================================================
    // PAINEL NÃO EXISTE
    // ========================================================

    if (!area) {

        return;

    }


    // ========================================================
    // REMOVER PAINEL
    // ========================================================

    area.remove();

}



// ============================================================
// FUNÇÃO: escaparHTML()
// ============================================================
//
// OBJETIVO:
//
// Converter caracteres especiais em entidades HTML.
//
// Isso evita que informações vindas do banco sejam
// interpretadas pelo navegador como código HTML.
//
// EXEMPLO:
//
//     <
// passa a ser:
//     &lt;
//
// PARÂMETRO:
//
// texto
//     Valor que será exibido.
//
// RETORNO:
//
// Texto seguro para inserção dentro do HTML.
//
// ============================================================

function escaparHTML(
    texto
) {

    return String(
        texto ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}



// ============================================================
// INICIALIZAÇÃO DO CLIENTE SUPABASE
// ============================================================
//
// OBJETIVO:
//
// Criar o cliente utilizado pelo PMOBILE para conversar
// com o banco Supabase.
//
// Depois da inicialização:
//
//     window.clienteSupabase
//
// ficará disponível globalmente para os demais arquivos.
//
// ============================================================

if (!window.supabase) {

    // ========================================================
    // BIBLIOTECA NÃO ENCONTRADA
    // ========================================================

    console.error(
        "❌ Biblioteca do Supabase não foi carregada."
    );


    mostrarStatusSupabase(
        "❌ Biblioteca do Supabase não foi carregada"
    );

} else {

    // ========================================================
    // BIBLIOTECA ENCONTRADA
    // ========================================================

    console.log(
        "✅ Biblioteca do Supabase carregada."
    );


    try {

        // ====================================================
        // CRIAR CLIENTE SUPABASE
        // ====================================================

        const clienteSupabase =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );


        // ====================================================
        // DISPONIBILIZAR CLIENTE GLOBALMENTE
        // ====================================================

        window.clienteSupabase =
            clienteSupabase;


        // ====================================================
        // REGISTRAR SUCESSO NO CONSOLE
        // ====================================================

        console.log(
            "✅ Cliente Supabase inicializado com sucesso."
        );


        // ====================================================
        // MOSTRAR STATUS
        // ====================================================

        mostrarStatusSupabase(
            "🟢 Supabase inicializado com sucesso"
        );


        // ====================================================
        // INICIAR VERIFICAÇÃO DOS MATERIAIS
        // ====================================================
        //
        // O pequeno atraso continua preservado para garantir
        // que a página tenha tempo de concluir a inicialização.
        //
        // ====================================================

        setTimeout(
            testarLeituraSupabase,
            500
        );


    } catch (erro) {

        // ====================================================
        // ERRO NA INICIALIZAÇÃO
        // ====================================================

        console.error(
            "❌ Erro ao inicializar o Supabase:",
            erro
        );


        mostrarStatusSupabase(
            "🔴 Erro ao inicializar o Supabase"
        );

    }

}



// ============================================================
// FUNÇÃO: testarLeituraSupabase()
// ============================================================
//
// OBJETIVO:
//
// Fazer a verificação completa da tabela:
//
//     public.materiais
//
// A função percorre todos os registros disponíveis.
//
// VERIFICAÇÕES ATUAIS:
//
// 1. Se o Supabase responde.
// 2. Quantos materiais existem.
// 3. Se o material possui código.
// 4. Se existem códigos duplicados.
// 5. Se o material possui descrição.
// 6. Se quantidade está preenchida.
// 7. Se quantidade_reservada está preenchida.
// 8. Se disponivel está preenchido.
//
// FUNCIONAMENTO:
//
// A consulta é realizada em lotes de 1.000 registros.
//
// Isso evita solicitar todos os materiais em uma única
// resposta do Supabase.
//
// IMPORTANTE:
//
// Esta rotina foi mantida exatamente nesta etapa.
//
// A futura transferência da verificação para o banco
// Supabase/PostgreSQL continua pausada enquanto trabalhamos
// na organização visual do PMOBILE.
//
// ============================================================

async function testarLeituraSupabase() {

    console.log(
        "🟡 Iniciando verificação completa da tabela materiais..."
    );


    mostrarStatusSupabase(
        "🟡 Verificando todos os materiais..."
    );


    try {

        // ====================================================
        // TAMANHO DE CADA LOTE
        // ====================================================

        const tamanhoLote =
            1000;


        // ====================================================
        // POSIÇÃO INICIAL
        // ====================================================

        let inicio =
            0;


        // ====================================================
        // TOTAL DE MATERIAIS ENCONTRADOS
        // ====================================================

        let totalEncontrado =
            0;


        // ====================================================
        // TOTAL DE PROBLEMAS
        // ====================================================

        let quantidadeErros =
            0;


        // ====================================================
        // LISTA DE PROBLEMAS
        // ====================================================

        const erros =
            [];


        // ====================================================
        // CONTROLE DE CÓDIGOS
        // ====================================================
        //
        // O Set é utilizado para detectar códigos duplicados
        // durante a leitura dos lotes.
        //
        // ====================================================

        const codigosEncontrados =
            new Set();


        // ====================================================
        // CONSULTAR LOTES
        // ====================================================

        while (true) {

            // =================================================
            // CALCULAR FINAL DO LOTE
            // =================================================

            const fim =
                inicio +
                tamanhoLote -
                1;


            console.log(
                "🔎 Consultando registros:",
                inicio,
                "até",
                fim
            );


            // =================================================
            // CONSULTAR TABELA MATERIAIS
            // =================================================

            const resultado =
                await window.clienteSupabase
                    .from(
                        "materiais"
                    )
                    .select(
                        "id,codigo,descricao,referencia,marca,local,quantidade,quantidade_reservada,disponivel,ultima_entrada"
                    )
                    .order(
                        "id",
                        {
                            ascending: true
                        }
                    )
                    .range(
                        inicio,
                        fim
                    );


            // =================================================
            // ERRO RETORNADO PELO SUPABASE
            // =================================================

            if (
                resultado.error
            ) {

                console.error(
                    "❌ Erro retornado pelo Supabase:",
                    resultado.error
                );


                throw resultado.error;

            }


            // =================================================
            // OBTER REGISTROS
            // =================================================

            const dados =
                resultado.data || [];


            // =================================================
            // NENHUM REGISTRO NO LOTE
            // =================================================

            if (
                dados.length === 0
            ) {

                break;

            }


            // =================================================
            // ANALISAR MATERIAIS DO LOTE
            // =================================================

            dados.forEach(
                material => {

                    // =========================================
                    // CONTAR MATERIAL
                    // =========================================

                    totalEncontrado++;


                    // =========================================
                    // VERIFICAR CÓDIGO
                    // =========================================

                    if (
                        !material.codigo ||
                        String(
                            material.codigo
                        ).trim() === ""
                    ) {

                        quantidadeErros++;


                        erros.push(
                            "ID " +
                            material.id +
                            ": código vazio."
                        );

                    } else {

                        const codigo =
                            String(
                                material.codigo
                            ).trim();


                        // =====================================
                        // VERIFICAR CÓDIGO DUPLICADO
                        // =====================================

                        if (
                            codigosEncontrados.has(
                                codigo
                            )
                        ) {

                            quantidadeErros++;


                            erros.push(
                                "Código duplicado: " +
                                codigo +
                                " (ID " +
                                material.id +
                                ")."
                            );

                        } else {

                            codigosEncontrados.add(
                                codigo
                            );

                        }

                    }


                    // =========================================
                    // VERIFICAR DESCRIÇÃO
                    // =========================================

                    if (
                        !material.descricao ||
                        String(
                            material.descricao
                        ).trim() === ""
                    ) {

                        quantidadeErros++;


                        erros.push(
                            "ID " +
                            material.id +
                            ": descrição vazia."
                        );

                    }


                    // =========================================
                    // VERIFICAR QUANTIDADE
                    // =========================================

                    if (
                        material.quantidade === null ||
                        material.quantidade === undefined
                    ) {

                        quantidadeErros++;


                        erros.push(
                            "ID " +
                            material.id +
                            ": quantidade ausente."
                        );

                    }


                    // =========================================
                    // VERIFICAR QUANTIDADE RESERVADA
                    // =========================================

                    if (
                        material.quantidade_reservada === null ||
                        material.quantidade_reservada === undefined
                    ) {

                        quantidadeErros++;


                        erros.push(
                            "ID " +
                            material.id +
                            ": quantidade reservada ausente."
                        );

                    }


                    // =========================================
                    // VERIFICAR DISPONÍVEL
                    // =========================================

                    if (
                        material.disponivel === null ||
                        material.disponivel === undefined
                    ) {

                        quantidadeErros++;


                        erros.push(
                            "ID " +
                            material.id +
                            ": quantidade disponível ausente."
                        );

                    }

                }
            );


            // =================================================
            // ATUALIZAR AVISO DE PROGRESSO
            // =================================================

            mostrarStatusSupabase(
                "🟡 Verificando materiais: " +
                totalEncontrado.toLocaleString(
                    "pt-BR"
                )
            );


            // =================================================
            // ÚLTIMO LOTE
            // =================================================

            if (
                dados.length <
                tamanhoLote
            ) {

                break;

            }


            // =================================================
            // PREPARAR PRÓXIMO LOTE
            // =================================================

            inicio +=
                tamanhoLote;


            // =================================================
            // LIBERAR INTERFACE DO NAVEGADOR
            // =================================================

            await permitirAtualizacaoNavegador();

        }


        // ====================================================
        // VERIFICAÇÃO CONCLUÍDA
        // ====================================================

        console.log(
            "🟢 Verificação completa concluída."
        );


        console.log(
            "Total de materiais:",
            totalEncontrado
        );


        console.log(
            "Quantidade de problemas:",
            quantidadeErros
        );


        console.log(
            "Problemas:",
            erros
        );


        // ====================================================
        // CASO 1:
        // TABELA MATERIAIS VAZIA
        // ====================================================

        if (
            totalEncontrado === 0
        ) {

            mostrarStatusSupabase(
                "🟡 Supabase respondeu, mas a tabela materiais está vazia."
            );


            return;

        }


        // ====================================================
        // CASO 2:
        // NENHUM PROBLEMA
        // ====================================================

        if (
            quantidadeErros === 0
        ) {

            mostrarStatusSupabase(
                "🟢 Supabase OK! " +
                totalEncontrado.toLocaleString(
                    "pt-BR"
                ) +
                " materiais verificados sem erros."
            );


            console.log(
                "🟢 Nenhum problema encontrado."
            );


            return;

        }


        // ====================================================
        // CASO 3:
        // PROBLEMAS ENCONTRADOS
        // ====================================================

        mostrarStatusSupabase(
            "⚠️ " +
            totalEncontrado.toLocaleString(
                "pt-BR"
            ) +
            " materiais verificados. " +
            quantidadeErros.toLocaleString(
                "pt-BR"
            ) +
            " problemas encontrados."
        );


        // ====================================================
        // MOSTRAR DETALHES DOS PROBLEMAS
        // ====================================================

        mostrarErrosSupabase(
            erros,
            totalEncontrado,
            quantidadeErros
        );


    } catch (erro) {

        // ====================================================
        // ERRO DURANTE A VERIFICAÇÃO
        // ====================================================

        console.error(
            "❌ Erro durante a verificação do Supabase:",
            erro
        );


        mostrarStatusSupabase(
            "🔴 Erro ao verificar os materiais no Supabase."
        );

    }

}



// ============================================================
// FUNÇÃO: permitirAtualizacaoNavegador()
// ============================================================
//
// OBJETIVO:
//
// Dar ao navegador uma oportunidade de atualizar a interface
// entre a leitura de um lote e outro.
//
// Isso é especialmente útil durante testes em celulares,
// evitando bloquear continuamente a atualização visual.
//
// RETORNO:
//
// Promise resolvida no próximo ciclo disponível.
//
// ============================================================

function permitirAtualizacaoNavegador() {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                0
            );

        }
    );

}



// ============================================================
// FUNÇÃO: limparMateriaisSupabase()
// ============================================================
//
// OBJETIVO:
//
// Remover todos os materiais existentes na tabela:
//
//     public.materiais
//
// FLUXO:
//
// 1. Solicita confirmação do usuário.
// 2. Caso seja cancelado, encerra a função.
// 3. Mostra aviso de processamento.
// 4. Executa a exclusão no Supabase.
// 5. Informa sucesso ou erro.
//
// IMPORTANTE:
//
// Esta função NÃO remove:
//
// - usuários;
// - conferências;
// - histórico de importações;
// - dados do IndexedDB.
//
// Ela atua somente na tabela:
//
//     public.materiais
//
// ============================================================

async function limparMateriaisSupabase() {

    // ========================================================
    // CONFIRMAÇÃO
    // ========================================================

    const confirmar =
        confirm(
            "⚠️ ATENÇÃO!\n\n" +
            "Isso irá apagar TODOS os materiais importados " +
            "do Supabase.\n\n" +
            "Deseja continuar?"
        );


    // ========================================================
    // CANCELADO PELO USUÁRIO
    // ========================================================

    if (!confirmar) {

        return;

    }


    // ========================================================
    // MOSTRAR PROCESSAMENTO
    // ========================================================

    mostrarStatusSupabase(
        "🟡 Limpando materiais do Supabase..."
    );


    try {

        // ====================================================
        // EXCLUIR MATERIAIS
        // ====================================================

        const {
            error
        } =
            await window.clienteSupabase
                .from(
                    "materiais"
                )
                .delete()
                .neq(
                    "id",
                    0
                );


        // ====================================================
        // ERRO RETORNADO PELO SUPABASE
        // ====================================================

        if (error) {

            console.error(
                "❌ Erro ao limpar materiais:",
                error
            );


            mostrarStatusSupabase(
                "🔴 Erro ao limpar materiais."
            );


            alert(
                "❌ Não foi possível limpar os materiais.\n\n" +
                error.message
            );


            return;

        }


        // ====================================================
        // SUCESSO
        // ====================================================

        console.log(
            "✅ Todos os materiais foram removidos do Supabase."
        );


        mostrarStatusSupabase(
            "🟢 Materiais do Supabase limpos."
        );


        alert(
            "✅ Materiais importados removidos com sucesso!"
        );


    } catch (erro) {

        // ====================================================
        // ERRO INESPERADO
        // ====================================================

        console.error(
            "❌ Erro inesperado ao limpar materiais:",
            erro
        );


        mostrarStatusSupabase(
            "🔴 Erro inesperado na limpeza."
        );


        alert(
            "❌ Ocorreu um erro ao limpar os materiais."
        );

    }

}
