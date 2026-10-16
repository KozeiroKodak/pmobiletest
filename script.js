// ============================================================
// PMOBILE
// ARQUIVO: script.js
// ============================================================
//
// OBJETIVO:
//
// Controlar a navegação visual do PMOBILE.
//
// ESTRUTURA:
//
// A sidebar permanece visível depois que o usuário entra
// no sistema.
//
// Somente o conteúdo localizado à direita da sidebar muda.
//
// A tela Pesquisa possui também navegação interna:
//
// Pesquisa
// ├── Menu de pesquisa
// ├── Pesquisa por código
// ├── Pesquisa por descrição
// └── Pesquisa por referência
//
// A lógica específica de:
//
// - Pesquisa de materiais
// - Importação
// - Conferência
// - Conferências
// - Divergências
// - Supabase
//
// continua nos arquivos responsáveis.
//
// ============================================================


// ============================================================
// LISTA DAS TELAS PRINCIPAIS DO SISTEMA
// ============================================================
//
// Estas são as telas controladas pela sidebar.
//
// As subtelas da Pesquisa NÃO entram nesta lista,
// porque pertencem internamente à tela #pesquisa.
//
// ============================================================

const telasSistema = [

    "homeSistema",

    "pesquisa",

    "conferencia",

    "conferencias",

    "divergencias",

    "importacao",

    "configuracoes"

];


// ============================================================
// LISTA DOS ITENS DA SIDEBAR
// ============================================================
//
// Utilizada para remover o destaque visual antes de
// selecionar outro item.
//
// ============================================================

const itensMenuSistema = [

    "menuPesquisa",

    "menuImportacao",

    "menuConferencia",

    "menuConferencias",

    "menuDivergencias",

    "menuConfiguracoes"

];


// ============================================================
// LISTA DAS ÁREAS INTERNAS DA PESQUISA
// ============================================================
//
// A tela Pesquisa possui quatro estados internos:
//
// menuPesquisaInterno
//     Tela inicial com as opções.
//
// pesquisaCodigo
//     Pesquisa por código.
//
// pesquisaDescricao
//     Pesquisa por descrição.
//
// pesquisaReferencia
//     Pesquisa por referência.
//
// ============================================================

const telasPesquisa = [

    "menuPesquisaInterno",

    "pesquisaCodigo",

    "pesquisaDescricao",

    "pesquisaReferencia"

];


// ============================================================
// FUNÇÃO: esconderTelasSistema()
// ============================================================
//
// OBJETIVO:
//
// Esconder todas as telas principais do sistema.
//
// A sidebar permanece visível.
//
// Esta função NÃO controla as subtelas internas da Pesquisa.
//
// ============================================================

function esconderTelasSistema() {

    telasSistema.forEach(

        function(idTela) {

            const tela =
                document.getElementById(
                    idTela
                );


            if (tela) {

                tela.style.display =
                    "none";

            }

        }

    );

}


// ============================================================
// FUNÇÃO: limparMenuAtivo()
// ============================================================
//
// OBJETIVO:
//
// Remover o destaque visual de todos os itens da sidebar.
//
// Depois disso, mostrarTelaSistema() pode destacar
// somente o item correspondente à tela atual.
//
// ============================================================

function limparMenuAtivo() {

    itensMenuSistema.forEach(

        function(idItem) {

            const item =
                document.getElementById(
                    idItem
                );


            if (item) {

                item.classList.remove(
                    "ativo"
                );

            }

        }

    );

}


// ============================================================
// FUNÇÃO: mostrarTelaSistema()
// ============================================================
//
// OBJETIVO:
//
// Trocar a tela principal exibida no PMOBILE.
//
// PARÂMETROS:
//
// idTela
//     ID da tela que será exibida.
//
// idMenu
//     ID do item da sidebar que deverá ficar destacado.
//
// FUNCIONAMENTO:
//
// 1. Esconde todas as telas principais.
// 2. Remove os destaques da sidebar.
// 3. Mostra a tela solicitada.
// 4. Destaca o item correspondente da sidebar.
//
// ============================================================

function mostrarTelaSistema(
    idTela,
    idMenu
) {

    esconderTelasSistema();

    limparMenuAtivo();


    // ========================================================
    // MOSTRAR TELA
    // ========================================================

    const tela =
        document.getElementById(
            idTela
        );


    if (tela) {

        tela.style.display =
            "block";

    }


    // ========================================================
    // DESTACAR ITEM DA SIDEBAR
    // ========================================================

    if (idMenu) {

        const itemMenu =
            document.getElementById(
                idMenu
            );


        if (itemMenu) {

            itemMenu.classList.add(
                "ativo"
            );

        }

    }

}


// ============================================================
// FUNÇÃO: esconderTelasPesquisa()
// ============================================================
//
// OBJETIVO:
//
// Esconder todas as áreas internas da Pesquisa.
//
// Esta função NÃO fecha a tela principal #pesquisa.
//
// Dessa forma, a sidebar continua mostrando:
//
//     Pesquisar material
//
// como item ativo.
//
// ============================================================

function esconderTelasPesquisa() {

    telasPesquisa.forEach(

        function(idTela) {

            const tela =
                document.getElementById(
                    idTela
                );


            if (tela) {

                tela.style.display =
                    "none";

            }

        }

    );

}


// ============================================================
// FUNÇÃO: mostrarTelaPesquisa()
// ============================================================
//
// OBJETIVO:
//
// Controlar exclusivamente a navegação interna do módulo
// Pesquisa.
//
// PARÂMETRO:
//
// idTela
//     Área interna que deverá ser mostrada.
//
// FUNCIONAMENTO:
//
// 1. Esconde todas as áreas internas.
// 2. Localiza a área solicitada.
// 3. Mostra somente essa área.
//
// IMPORTANTE:
//
// Esta função NÃO altera a sidebar.
//
// ============================================================

function mostrarTelaPesquisa(
    idTela
) {

    esconderTelasPesquisa();


    const tela =
        document.getElementById(
            idTela
        );


    if (tela) {

        tela.style.display =
            "block";

    }

}


// ============================================================
// TELA INICIAL
// ============================================================
//
// FUNÇÃO:
//     abrirSistema()
//
// OBJETIVO:
//
// Sair da tela inicial e entrar na aplicação.
//
// A sidebar passa a ficar disponível e a tela inicial
// do sistema é exibida.
//
// ============================================================

function abrirSistema() {

    const inicio =
        document.getElementById(
            "inicio"
        );


    const aplicacao =
        document.getElementById(
            "aplicacao"
        );


    // ========================================================
    // ESCONDER TELA INICIAL
    // ========================================================

    if (inicio) {

        inicio.style.display =
            "none";

    }


    // ========================================================
    // MOSTRAR APLICAÇÃO
    // ========================================================

    if (aplicacao) {

        aplicacao.style.display =
            "block";

    }


    // ========================================================
    // ABRIR HOME
    // ========================================================

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// PESQUISA
// ============================================================
//
// FUNÇÃO:
//     abrirPesquisa()
//
// OBJETIVO:
//
// Abrir o módulo Pesquisa através da sidebar.
//
// Sempre que o usuário clicar em:
//
//     Pesquisar material
//
// a tela volta para o menu interno contendo:
//
// - Código
// - Descrição
// - Referência
//
// Nenhum resultado anterior é apagado.
//
// ============================================================

function abrirPesquisa() {

    // ========================================================
    // MOSTRAR TELA PRINCIPAL DA PESQUISA
    // ========================================================

    mostrarTelaSistema(
        "pesquisa",
        "menuPesquisa"
    );


    // ========================================================
    // MOSTRAR MENU INTERNO DA PESQUISA
    // ========================================================

    mostrarTelaPesquisa(
        "menuPesquisaInterno"
    );

}


// ============================================================
// PESQUISA POR CÓDIGO
// ============================================================
//
// FUNÇÃO:
//     abrirPesquisaCodigo()
//
// OBJETIVO:
//
// Abrir somente a subtela de pesquisa por código.
//
// O campo e os resultados continuam sendo controlados
// pelo arquivo:
//
//     pesquisa.js
//
// ============================================================

function abrirPesquisaCodigo() {

    mostrarTelaPesquisa(
        "pesquisaCodigo"
    );


    // ========================================================
    // COLOCAR CURSOR NO CAMPO
    // ========================================================

    const campo =
        document.getElementById(
            "campoPesquisaCodigo"
        );


    if (campo) {

        campo.focus();

    }

}


// ============================================================
// PESQUISA POR DESCRIÇÃO
// ============================================================
//
// FUNÇÃO:
//     abrirPesquisaDescricao()
//
// OBJETIVO:
//
// Abrir somente a subtela de pesquisa por descrição.
//
// Nenhuma consulta é realizada automaticamente.
//
// ============================================================

function abrirPesquisaDescricao() {

    mostrarTelaPesquisa(
        "pesquisaDescricao"
    );


    // ========================================================
    // COLOCAR CURSOR NO CAMPO
    // ========================================================

    const campo =
        document.getElementById(
            "campoPesquisaDescricao"
        );


    if (campo) {

        campo.focus();

    }

}


// ============================================================
// PESQUISA POR REFERÊNCIA
// ============================================================
//
// FUNÇÃO:
//     abrirPesquisaReferencia()
//
// OBJETIVO:
//
// Abrir somente a subtela de pesquisa por referência.
//
// A lógica de consulta permanece em:
//
//     pesquisa.js
//
// ============================================================

function abrirPesquisaReferencia() {

    mostrarTelaPesquisa(
        "pesquisaReferencia"
    );


    // ========================================================
    // COLOCAR CURSOR NO CAMPO
    // ========================================================

    const campo =
        document.getElementById(
            "campoPesquisaReferencia"
        );


    if (campo) {

        campo.focus();

    }

}


// ============================================================
// VOLTAR PARA O MENU DA PESQUISA
// ============================================================
//
// FUNÇÃO:
//     voltarPesquisa()
//
// OBJETIVO:
//
// Voltar de:
//
// - Código
// - Descrição
// - Referência
//
// para:
//
//     Escolha do tipo de pesquisa
//
// IMPORTANTE:
//
// Esta função NÃO:
//
// - fecha o módulo Pesquisa;
// - volta para a home;
// - apaga o campo digitado;
// - apaga resultados;
// - altera a sidebar.
//
// ============================================================

function voltarPesquisa() {

    mostrarTelaPesquisa(
        "menuPesquisaInterno"
    );

}


// ============================================================
// VOLTAR DA PESQUISA PARA HOME
// ============================================================
//
// FUNÇÃO:
//     voltarMenu()
//
// Mantida por compatibilidade com versões anteriores
// do PMOBILE.
//
// Caso algum código antigo ainda utilize voltarMenu(),
// ele continuará retornando para a home.
//
// O novo botão ← das subtelas NÃO utiliza esta função.
// Ele utiliza:
//
//     voltarPesquisa()
//
// ============================================================

function voltarMenu() {

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// CONFERÊNCIA
// ============================================================
//
// FUNÇÃO:
//     abrirConferencia()
//
// Abre a tela de conferência e destaca o item correspondente
// na sidebar.
//
// ============================================================

function abrirConferencia() {

    mostrarTelaSistema(
        "conferencia",
        "menuConferencia"
    );

}


// ============================================================
// VOLTAR DA CONFERÊNCIA
// ============================================================

function voltarMenuConferencia() {

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// CONFERÊNCIAS REALIZADAS
// ============================================================
//
// FUNÇÃO:
//     abrirConferencias()
//
// Abre a tela de conferências realizadas.
//
// Caso exibirConferencias() esteja disponível, os dados
// são atualizados ao abrir a tela.
//
// ============================================================

function abrirConferencias() {

    mostrarTelaSistema(
        "conferencias",
        "menuConferencias"
    );


    if (
        typeof exibirConferencias ===
        "function"
    ) {

        exibirConferencias();

    }

}


// ============================================================
// VOLTAR DAS CONFERÊNCIAS
// ============================================================

function voltarMenuConferencias() {

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// DIVERGÊNCIAS
// ============================================================
//
// FUNÇÃO:
//     abrirDivergencias()
//
// Abre a tela de divergências.
//
// Caso exibirDivergencias() esteja disponível, os dados
// são atualizados ao abrir a tela.
//
// ============================================================

function abrirDivergencias() {

    mostrarTelaSistema(
        "divergencias",
        "menuDivergencias"
    );


    if (
        typeof exibirDivergencias ===
        "function"
    ) {

        exibirDivergencias();

    }

}


// ============================================================
// VOLTAR DAS DIVERGÊNCIAS
// ============================================================

function voltarMenuDivergencias() {

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// IMPORTAÇÃO
// ============================================================
//
// FUNÇÃO:
//     abrirImportacao()
//
// OBJETIVO:
//
// Abrir a tela de importação.
//
// Também verifica se a biblioteca SheetJS já está disponível.
//
// Caso não esteja, tenta carregar:
//
//     xlsx.full.min.js
//
// ============================================================

function abrirImportacao() {

    mostrarTelaSistema(
        "importacao",
        "menuImportacao"
    );


    // ========================================================
    // VERIFICAR SE XLSX JÁ ESTÁ CARREGADO
    // ========================================================

    if (window.XLSX) {

        return;

    }


    // ========================================================
    // CARREGAR BIBLIOTECA LOCAL
    // ========================================================

    const script =
        document.createElement(
            "script"
        );


    script.src =
        "xlsx.full.min.js";


    // ========================================================
    // CARREGAMENTO CONCLUÍDO
    // ========================================================

    script.onload =
        function() {

            console.log(
                "SheetJS carregado com sucesso."
            );

        };


    // ========================================================
    // ERRO NO CARREGAMENTO
    // ========================================================

    script.onerror =
        function() {

            const resultado =
                document.getElementById(
                    "resultadoImportacao"
                );


            if (resultado) {

                resultado.innerHTML =
                    "<p>❌ Não foi possível carregar a biblioteca Excel.</p>";

            }

        };


    // ========================================================
    // ADICIONAR SCRIPT À PÁGINA
    // ========================================================

    document.body.appendChild(
        script
    );

}


// ============================================================
// VOLTAR DA IMPORTAÇÃO
// ============================================================

function voltarMenuImportacao() {

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// CONFIGURAÇÕES
// ============================================================
//
// FUNÇÃO:
//     abrirConfiguracoes()
//
// Abre a tela Configurações.
//
// ============================================================

function abrirConfiguracoes() {

    mostrarTelaSistema(
        "configuracoes",
        "menuConfiguracoes"
    );

}


// ============================================================
// VOLTAR DAS CONFIGURAÇÕES
// ============================================================

function voltarMenuConfiguracoes() {

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// MODAL DE ZERAMENTO DO INVENTÁRIO
// ============================================================


// ============================================================
// FUNÇÃO: abrirModalZerarInventario()
// ============================================================
//
// Mostra o modal de confirmação do zeramento.
//
// ============================================================

function abrirModalZerarInventario() {

    const modal =
        document.getElementById(
            "modalZerarInventario"
        );


    if (modal) {

        modal.style.display =
            "flex";

    }

}


// ============================================================
// FUNÇÃO: fecharModalZerarInventario()
// ============================================================
//
// Fecha o modal sem alterar os dados.
//
// ============================================================

function fecharModalZerarInventario() {

    const modal =
        document.getElementById(
            "modalZerarInventario"
        );


    if (modal) {

        modal.style.display =
            "none";

    }

}


// ============================================================
// FUNÇÃO: confirmarZeramento()
// ============================================================
//
// PARÂMETRO:
//
// apagarConferencias
//
//     true
//         Apaga também as conferências.
//
//     false
//         Mantém as conferências.
//
// OBJETIVO:
//
// Executar o processo já existente de zeramento do
// inventário.
//
// Esta rotina foi preservada nesta alteração.
//
// ============================================================

async function confirmarZeramento(
    apagarConferencias
) {

    try {

        // ====================================================
        // FECHAR MODAL
        // ====================================================

        fecharModalZerarInventario();


        // ====================================================
        // LIMPAR INVENTÁRIO
        // ====================================================

        await limparMateriais();


        // ====================================================
        // LIMPAR MATERIAIS DA MEMÓRIA
        // ====================================================

        materiais = [];


        // ====================================================
        // MARCAR INVENTÁRIO COMO ZERADO
        // ====================================================

        marcarInventarioZerado();


        // ====================================================
        // LIMPAR CONFERÊNCIAS OPCIONALMENTE
        // ====================================================

        if (
            apagarConferencias ===
            true
        ) {

            conferencias = [];


            localStorage.removeItem(
                "pmobile_conferencias"
            );

        }


        // ====================================================
        // LOCALIZAR ÁREA DE RESULTADO
        // ====================================================

        const resultado =
            document.getElementById(
                "resultadoImportacao"
            );


        if (!resultado) {

            return;

        }


        // ====================================================
        // INVENTÁRIO + CONFERÊNCIAS APAGADOS
        // ====================================================

        if (
            apagarConferencias ===
            true
        ) {

            resultado.innerHTML =
                "<p>✅ Inventário e conferências foram apagados com sucesso.</p>";

        }


        // ====================================================
        // SOMENTE INVENTÁRIO APAGADO
        // ====================================================

        else {

            resultado.innerHTML =
                "<p>✅ Inventário apagado com sucesso. As conferências foram mantidas.</p>";

        }


    } catch (erro) {

        // ====================================================
        // ERRO
        // ====================================================

        console.error(
            "Erro ao zerar o inventário:",
            erro
        );


        const resultado =
            document.getElementById(
                "resultadoImportacao"
            );


        if (resultado) {

            resultado.innerHTML =
                "<p>❌ Não foi possível zerar o inventário.</p>";

        }

    }

}


// ============================================================
// FIM - CONTROLE DE NAVEGAÇÃO DO PMOBILE
// ============================================================
