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
// 5. Verificar a tabela "materiais".
// 6. Solicitar ao PostgreSQL o diagnóstico dos materiais.
// 7. Buscar somente materiais problemáticos quando necessário.
// 8. Mostrar o status da conexão/verificação.
// 9. Mostrar detalhes dos problemas encontrados.
// 10. Permitir limpar os materiais do Supabase.
//
// IMPORTANTE:
//
// O Supabase é o banco central do PMOBILE.
//
// A importação dos materiais continua sendo realizada pelo:
//
//     importacao.js
//
// Este arquivo NÃO realiza a importação da planilha.
//
// Este arquivo também NÃO altera o IndexedDB.
//
// ============================================================
//
// VERIFICAÇÃO DOS MATERIAIS
// ============================================================
//
// VERSÃO ATUAL:
//
// A verificação pesada foi transferida para o PostgreSQL.
//
//     PMOBILE
//        ↓
//     pmobile_diagnosticar_materiais()
//        ↓
//     PostgreSQL verifica a tabela
//        ↓
//     PMOBILE recebe somente o resumo
//
// Caso existam problemas:
//
//     PMOBILE
//        ↓
//     pmobile_listar_problemas_materiais()
//        ↓
//     PostgreSQL retorna somente os registros problemáticos
//
// Isso reduz drasticamente:
//
// - quantidade de requisições;
// - transferência de dados;
// - processamento no celular;
// - consumo de memória;
// - tempo de verificação.
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
// Elementos utilizados:
//
//     #statusSupabase
//     #resultadoVerificacaoSupabase
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
// Chaves secretas ou service_role NUNCA devem ser colocadas
// neste arquivo.
//
// ============================================================

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Ckh6ls7eIh_11wviwxMlCQ_25Oes0QF";




// ============================================================
// CONTROLE DE STATUS PRIORITÁRIO
// ============================================================
//
// OBJETIVO:
//
// Informar se a barra de status está sendo utilizada por uma
// operação que não pode ser sobrescrita por mensagens comuns.
//
// PRINCIPAL USO:
//
// Sincronização do inventário offline.
//
// Durante a sincronização:
//
//     🟡 Sincronizando inventário offline...
//
//     🟡 Sincronizando inventário offline... 1.000 materiais
//
//     🟢 Offline OK — 93.948 materiais sincronizados.
//
// mensagens normais do Supabase não poderão substituir esse
// status.
//
// O bloqueio permanece ativo até o usuário fechar o aviso.
//
// ============================================================

let statusSupabasePrioritario =
    false;




// ============================================================
// FUNÇÃO: mostrarStatusSupabase()
// ============================================================
//
// OBJETIVO:
//
// Criar ou atualizar o aviso de status do Supabase.
//
// PARÂMETROS:
//
// mensagem
//
//     Texto que será exibido.
//
// prioridade
//
//     false:
//         mensagem normal.
//
//     true:
//         mensagem prioritária.
//
//         Uma mensagem prioritária bloqueia temporariamente
//         outras mensagens normais.
//
// EXEMPLOS:
//
//     mostrarStatusSupabase(
//         "🟢 Supabase inicializado com sucesso"
//     );
//
// Mensagem prioritária:
//
//     mostrarStatusSupabase(
//         "🟡 Sincronizando inventário offline...",
//         true
//     );
//
// FUNCIONAMENTO:
//
// 1. Ativa o modo prioritário quando prioridade = true.
// 2. Bloqueia mensagens normais enquanto o modo estiver ativo.
// 3. Procura #statusSupabase.
// 4. Caso não exista, cria o elemento.
// 5. Limpa o conteúdo anterior.
// 6. Insere a nova mensagem.
// 7. Cria o botão "✕".
// 8. O fechamento libera novamente o status normal.
//
// IMPORTANTE:
//
// Esta função altera somente a interface.
//
// ============================================================

function mostrarStatusSupabase(
    mensagem,
    prioridade = false
) {

    // ========================================================
    // ATIVAR STATUS PRIORITÁRIO
    // ========================================================
    //
    // O dados.js chama esta função com prioridade = true
    // quando está sincronizando o inventário offline.
    //
    // ========================================================

    if (
        prioridade === true
    ) {

        statusSupabasePrioritario =
            true;

    }


    // ========================================================
    // BLOQUEAR MENSAGENS NORMAIS
    // ========================================================
    //
    // Se existe uma operação prioritária ativa e a nova
    // mensagem não é prioritária, ela não poderá substituir
    // o status atual.
    //
    // ========================================================

    if (
        statusSupabasePrioritario === true &&
        prioridade !== true
    ) {

        console.log(
            "ℹ️ Status comum do Supabase ignorado porque " +
            "existe um status prioritário ativo:",
            mensagem
        );

        return;

    }


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

    if (
        !status
    ) {

        status =
            document.createElement(
                "div"
            );

        status.id =
            "statusSupabase";

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
    // CRIAR TEXTO
    // ========================================================

    const textoStatus =
        document.createElement(
            "span"
        );

    textoStatus.textContent =
        mensagem;


    // ========================================================
    // ADICIONAR TEXTO
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

    botaoFechar.onclick =
        fecharStatusSupabase;


    // ========================================================
    // ADICIONAR BOTÃO
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
// Remover da tela o aviso:
//
//     #statusSupabase
//
// IMPORTANTE:
//
// Esta função também libera o modo de prioridade.
//
// Depois que o usuário fechar o aviso:
//
//     statusSupabasePrioritario = false
//
// mensagens normais do Supabase poderão aparecer novamente.
//
// Esta função NÃO:
//
// - cancela consultas;
// - desconecta o Supabase;
// - remove materiais;
// - altera o banco.
//
// Atua somente na interface.
//
// ============================================================

function fecharStatusSupabase() {

    // ========================================================
    // LIBERAR STATUS PRIORITÁRIO
    // ========================================================
    //
    // Se o aviso que estava na tela era prioritário, o
    // fechamento libera novamente a barra para mensagens
    // normais.
    //
    // ========================================================

    statusSupabasePrioritario =
        false;


    // ========================================================
    // PROCURAR AVISO
    // ========================================================

    const status =
        document.getElementById(
            "statusSupabase"
        );


    // ========================================================
    // SE NÃO EXISTIR, ENCERRAR
    // ========================================================

    if (
        !status
    ) {

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
// Mostrar os problemas encontrados pelo PostgreSQL.
//
// PARÂMETROS:
//
// erros
//     Array contendo mensagens dos problemas.
//
// totalEncontrado
//     Total de materiais existentes.
//
// quantidadeErros
//     Total de problemas detectados.
//
// FUNCIONAMENTO:
//
// 1. Procura #resultadoVerificacaoSupabase.
// 2. Cria o painel caso necessário.
// 3. Mostra quantidade de materiais.
// 4. Mostra quantidade de problemas.
// 5. Mostra até 20 detalhes.
// 6. Cria botão para fechar.
//
// IMPORTANTE:
//
// Os textos vindos do banco passam por escaparHTML() antes
// de serem inseridos no HTML.
//
// O resumo dos problemas é exibido SOMENTE neste painel.
//
// Quando o PostgreSQL encontrar problemas, a mensagem:
//
//     ⚠️ 93.948 materiais verificados.
//     2 problemas encontrados.
//
// NÃO será enviada também para #statusSupabase.
//
// Isso evita duplicidade de informação e mantém a barra de
// status disponível para mensagens operacionais, como:
//
// - conexão com Supabase;
// - sincronização do inventário;
// - progresso da sincronização;
// - conclusão da sincronização;
// - erros de conexão.
//
// ============================================================

function mostrarErrosSupabase(
    erros,
    totalEncontrado,
    quantidadeErros
) {

    // ========================================================
    // PROCURAR PAINEL
    // ========================================================

    let area =
        document.getElementById(
            "resultadoVerificacaoSupabase"
        );


    // ========================================================
    // CRIAR PAINEL
    // ========================================================

    if (
        !area
    ) {

        area =
            document.createElement(
                "div"
            );

        area.id =
            "resultadoVerificacaoSupabase";

        document.body.appendChild(
            area
        );

    }


    // ========================================================
    // INICIAR HTML
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


    html +=
        "<hr>";


    // ========================================================
    // SEM DETALHES
    // ========================================================

    if (
        erros.length === 0
    ) {

        html +=
            "<p>🟢 Nenhum problema detalhado encontrado.</p>";

    } else {

        html +=
            "<p><strong>Detalhes:</strong></p>";

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


        html +=
            "</ul>";


        // ====================================================
        // MAIS DE 20 PROBLEMAS
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
// Remover da tela:
//
//     #resultadoVerificacaoSupabase
//
// Atua somente na interface.
//
// ============================================================

function fecharErrosSupabase() {

    const area =
        document.getElementById(
            "resultadoVerificacaoSupabase"
        );

    if (!area) {

        return;

    }

    area.remove();

}




// ============================================================
// FUNÇÃO: escaparHTML()
// ============================================================
//
// OBJETIVO:
//
// Converter caracteres especiais para entidades HTML.
//
// Isso impede que informações vindas do banco sejam
// interpretadas como HTML pelo navegador.
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
// Criar o cliente utilizado pelo PMOBILE.
//
// Depois da inicialização:
//
//     window.clienteSupabase
//
// ficará disponível globalmente.
//
// ============================================================

if (!window.supabase) {

    // ========================================================
    // BIBLIOTECA NÃO CARREGADA
    // ========================================================

    console.error(
        "❌ Biblioteca do Supabase não foi carregada."
    );

    mostrarStatusSupabase(
        "❌ Biblioteca do Supabase não foi carregada"
    );

} else {

    console.log(
        "✅ Biblioteca do Supabase carregada."
    );


    try {

        // ====================================================
        // CRIAR CLIENTE
        // ====================================================

        const clienteSupabase =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );


        // ====================================================
        // DISPONIBILIZAR GLOBALMENTE
        // ====================================================

        window.clienteSupabase =
            clienteSupabase;


        console.log(
            "✅ Cliente Supabase inicializado com sucesso."
        );


        mostrarStatusSupabase(
            "🟢 Supabase inicializado com sucesso"
        );


        // ====================================================
        // INICIAR DIAGNÓSTICO
        // ====================================================
        //
        // Pequeno atraso mantido para permitir que a página
        // termine sua inicialização.
        //
        // ====================================================

        setTimeout(
            testarLeituraSupabase,
            500
        );


    } catch (erro) {

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
// Verificar a integridade da tabela:
//
//     public.materiais
//
// utilizando funções PostgreSQL executadas diretamente
// dentro do Supabase.
//
// ============================================================
//
// DIFERENÇA DA VERSÃO ANTERIOR
// ============================================================
//
// ANTES:
//
// O navegador executava consultas de 1.000 registros.
//
// Depois analisava:
//
// - código;
// - duplicidade;
// - descrição;
// - quantidade;
// - quantidade reservada;
// - disponível.
//
// Isso era repetido até percorrer toda a tabela.
//
// ============================================================
//
// AGORA:
//
// O PostgreSQL realiza a análise.
//
// PRIMEIRA RPC:
//
//     pmobile_diagnosticar_materiais()
//
// Retorna:
//
// - total_materiais
// - sem_codigo
// - sem_descricao
// - quantidade_nula
// - quantidade_reservada_nula
// - disponivel_nulo
// - codigos_duplicados
// - total_problemas
//
// SEGUNDA RPC:
//
//     pmobile_listar_problemas_materiais()
//
// É executada SOMENTE se:
//
//     total_problemas > 0
//
// Ela retorna somente os materiais problemáticos.
//
// ============================================================
//
// ALTERAÇÃO ATUAL:
//
// Caso o PostgreSQL encontre problemas:
//
//     total_problemas > 0
//
// o resultado NÃO será mais enviado para a barra:
//
//     #statusSupabase
//
// Os problemas continuam sendo exibidos normalmente através
// de:
//
//     mostrarErrosSupabase()
//
// Portanto:
//
// DIAGNÓSTICO POSTGRESQL
//        │
//        ├── console                     → MANTIDO
//        ├── popup/painel de problemas   → MANTIDO
//        └── barra #statusSupabase       → REMOVIDO
//
// A alteração evita que o resultado do diagnóstico concorra
// visualmente com o status operacional da sincronização.
//
// ============================================================
//
// IMPORTANTE:
//
// Esta função é SOMENTE DE LEITURA.
//
// Ela NÃO:
//
// - insere materiais;
// - altera materiais;
// - exclui materiais;
// - altera IndexedDB.
//
// ============================================================

async function testarLeituraSupabase() {

    console.log(
        "🟡 Iniciando diagnóstico PostgreSQL da tabela materiais..."
    );


    mostrarStatusSupabase(
        "🟡 Verificando materiais no PostgreSQL..."
    );


    try {

        // ====================================================
        // ETAPA 1
        // SOLICITAR DIAGNÓSTICO GERAL
        // ====================================================
        //
        // Uma única chamada substitui a antiga leitura de
        // aproximadamente 94 lotes de 1.000 materiais.
        //
        // ====================================================

        const {
            data: dadosDiagnostico,
            error: erroDiagnostico
        } =
            await window.clienteSupabase
                .rpc(
                    "pmobile_diagnosticar_materiais"
                );


        // ====================================================
        // ERRO NO DIAGNÓSTICO
        // ====================================================

        if (
            erroDiagnostico
        ) {

            console.error(
                "❌ Erro no diagnóstico PostgreSQL:",
                erroDiagnostico
            );

            throw erroDiagnostico;

        }


        // ====================================================
        // OBTER RESULTADO
        // ====================================================
        //
        // A função PostgreSQL retorna somente uma linha.
        //
        // Dependendo da resposta da biblioteca, tratamos tanto
        // array quanto objeto.
        //
        // ====================================================

        const diagnostico =
            Array.isArray(
                dadosDiagnostico
            )
                ? dadosDiagnostico[0]
                : dadosDiagnostico;


        // ====================================================
        // VALIDAR RESPOSTA
        // ====================================================

        if (
            !diagnostico
        ) {

            throw new Error(
                "O PostgreSQL não retornou o diagnóstico dos materiais."
            );

        }


        // ====================================================
        // CONVERTER BIGINT PARA NUMBER
        // ====================================================
        //
        // Os valores BIGINT do PostgreSQL podem chegar ao
        // JavaScript como texto.
        //
        // Number() permite utilizar comparações e
        // toLocaleString() normalmente.
        //
        // ====================================================

        const totalEncontrado =
            Number(
                diagnostico.total_materiais ??
                0
            );


        const quantidadeErros =
            Number(
                diagnostico.total_problemas ??
                0
            );


        // ====================================================
        // MOSTRAR DIAGNÓSTICO NO CONSOLE
        // ====================================================
        //
        // Mantemos o objeto completo para facilitar testes
        // e análise durante o desenvolvimento.
        //
        // ====================================================

        console.log(
            "🟢 Diagnóstico PostgreSQL concluído."
        );


        console.log(
            "Resumo do diagnóstico:",
            diagnostico
        );


        // ====================================================
        // CASO 1
        // TABELA VAZIA
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
        // CASO 2
        // NENHUM PROBLEMA
        // ====================================================
        //
        // Se não existem problemas, encerramos aqui.
        //
        // pmobile_listar_problemas_materiais()
        // NÃO será executada.
        //
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
        // CASO 3
        // PROBLEMAS ENCONTRADOS
        // ====================================================
        //
        // ALTERAÇÃO:
        //
        // A mensagem de resumo NÃO é mais enviada para:
        //
        //     mostrarStatusSupabase()
        //
        // Antes este bloco também mostrava:
        //
        //     ⚠️ 93.948 materiais verificados.
        //     2 problemas encontrados.
        //
        // na barra de status.
        //
        // Isso foi removido porque o próprio painel criado por
        // mostrarErrosSupabase() já apresenta:
        //
        // - total de materiais verificados;
        // - total de problemas;
        // - detalhes dos problemas.
        //
        // O diagnóstico continua normalmente abaixo.
        //
        // =================================================
                // ====================================================
        // ETAPA 2
        // BUSCAR SOMENTE MATERIAIS PROBLEMÁTICOS
        // ====================================================
        //
        // Esta consulta somente acontece quando:
        //
        //     total_problemas > 0
        //
        // Portanto não baixamos novamente os materiais
        // corretos.
        //
        // IMPORTANTE:
        //
        // O resultado desta etapa será utilizado pelo painel
        // de diagnóstico.
        //
        // Ele NÃO será enviado para a barra:
        //
        //     #statusSupabase
        //
        // ====================================================

        const {
            data: materiaisProblematicos,
            error: erroDetalhes
        } =
            await window.clienteSupabase
                .rpc(
                    "pmobile_listar_problemas_materiais"
                );


        // ====================================================
        // ERRO AO BUSCAR DETALHES
        // ====================================================

        if (
            erroDetalhes
        ) {

            console.error(
                "❌ Erro ao buscar detalhes dos problemas:",
                erroDetalhes
            );

            throw erroDetalhes;

        }


        // ====================================================
        // ARRAY DE MENSAGENS
        // ====================================================
        //
        // A função mostrarErrosSupabase() já trabalha com
        // mensagens em texto.
        //
        // Portanto transformamos os códigos retornados pelo
        // PostgreSQL em mensagens legíveis.
        //
        // ====================================================

        const erros =
            [];


        // ====================================================
        // TRADUÇÃO DOS TIPOS DE PROBLEMA
        // ====================================================

        const descricoesProblemas = {

            SEM_CODIGO:
                "código vazio.",

            SEM_DESCRICAO:
                "descrição vazia.",

            QUANTIDADE_NULA:
                "quantidade ausente.",

            QUANTIDADE_RESERVADA_NULA:
                "quantidade reservada ausente.",

            DISPONIVEL_NULO:
                "quantidade disponível ausente."

        };


        // ====================================================
        // PERCORRER SOMENTE MATERIAIS PROBLEMÁTICOS
        // ====================================================

        (
            materiaisProblematicos ||
            []
        ).forEach(

            material => {

                // =============================================
                // OBTER ARRAY DE PROBLEMAS
                // =============================================

                const problemas =
                    Array.isArray(
                        material.problemas
                    )
                        ? material.problemas
                        : [];


                // =============================================
                // PERCORRER PROBLEMAS DO MATERIAL
                // =============================================

                problemas.forEach(

                    problema => {


                        // =====================================
                        // CÓDIGO DUPLICADO
                        // =====================================
                        //
                        // Mantemos formato semelhante ao aviso
                        // utilizado anteriormente.
                        //
                        // =====================================

                        if (
                            problema ===
                            "CODIGO_DUPLICADO"
                        ) {

                            erros.push(
                                "Código duplicado: " +
                                String(
                                    material.codigo ??
                                    ""
                                ) +
                                " (ID " +
                                material.id +
                                ")."
                            );


                            return;

                        }


                        // =====================================
                        // DEMAIS PROBLEMAS
                        // =====================================

                        const descricao =
                            descricoesProblemas[
                                problema
                            ] ||
                            (
                                "problema identificado: " +
                                problema +
                                "."
                            );


                        erros.push(
                            "ID " +
                            material.id +
                            ": " +
                            descricao
                        );

                    }

                );

            }

        );


        // ====================================================
        // MOSTRAR DETALHES NO CONSOLE
        // ====================================================

        console.log(
            "Materiais problemáticos:",
            materiaisProblematicos ||
            []
        );


        console.log(
            "Problemas formatados:",
            erros
        );


        // ====================================================
        // MOSTRAR DETALHES NA INTERFACE
        // ====================================================
        //
        // O painel continua sendo exibido normalmente.
        //
        // Esta é agora a ÚNICA representação visual do
        // resultado quando o diagnóstico PostgreSQL encontra
        // problemas nos materiais.
        //
        // Exemplo:
        //
        //     ⚠️ Problemas encontrados
        //
        //     93.948 materiais verificados.
        //
        //     2 problemas encontrados.
        //
        //     Detalhes:
        //
        //     - ID XXXXX: código vazio.
        //     - ID XXXXX: descrição vazia.
        //
        // A barra #statusSupabase NÃO recebe esse resumo.
        //
        // Nenhuma alteração no style.css é necessária.
        //
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
        //
        // IMPORTANTE:
        //
        // Aqui estamos tratando um ERRO DE EXECUÇÃO/CONEXÃO,
        // e não um problema encontrado nos materiais.
        //
        // Por isso esta mensagem CONTINUA podendo utilizar a
        // barra de status.
        //
        // Exemplos:
        //
        // - RPC indisponível;
        // - falha de conexão;
        // - erro inesperado do PostgreSQL;
        // - erro de comunicação com o Supabase.
        //
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
// 1. Solicita confirmação.
// 2. Caso seja cancelado, encerra.
// 3. Mostra aviso de processamento.
// 4. Executa exclusão no Supabase.
// 5. Informa sucesso ou erro.
//
// IMPORTANTE:
//
// Esta função NÃO remove:
//
// - usuários;
// - conferências;
// - histórico de importações;
// - IndexedDB.
//
// Atua somente em:
//
//     public.materiais
//
// ============================================================

async function limparMateriaisSupabase() {

    // ========================================================
    // CONFIRMAÇÃO
    // ========================================================
    //
    // Como esta operação remove todos os materiais do banco
    // central, é obrigatório solicitar confirmação antes de
    // executar a exclusão.
    //
    // ========================================================

    const confirmar =
        confirm(
            "⚠️ ATENÇÃO!\n\n" +
            "Isso irá apagar TODOS os materiais importados " +
            "do Supabase.\n\n" +
            "Deseja continuar?"
        );


    // ========================================================
    // CANCELAMENTO
    // ========================================================

    if (
        !confirmar
    ) {

        return;

    }


    // ========================================================
    // MOSTRAR PROCESSAMENTO
    // ========================================================
    //
    // Esta é uma operação real sobre o banco.
    //
    // Portanto o status continua sendo exibido normalmente
    // na barra.
    //
    // ========================================================

    mostrarStatusSupabase(
        "🟡 Limpando materiais do Supabase..."
    );


    try {

        // ====================================================
        // EXCLUIR MATERIAIS
        // ====================================================
        //
        // A exclusão atua exclusivamente na tabela:
        //
        //     public.materiais
        //
        // O filtro:
        //
        //     .neq("id", 0)
        //
        // permite aplicar DELETE aos registros da tabela.
        //
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
        // ERRO
        // ====================================================

        if (
            error
        ) {

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
        //
        // Captura erros JavaScript ou outras falhas que não
        // tenham sido retornadas diretamente pelo Supabase.
        //
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