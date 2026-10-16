// ============================================================
// PMOBILE
// ARQUIVO: script.js
// ============================================================
//
// OBJETIVO:
//
// Controlar a navegação visual do PMOBILE.
//
// NOVO PADRÃO:
//
// A sidebar permanece visível depois que o usuário entra
// no sistema.
//
// Somente o conteúdo localizado à direita da sidebar muda.
//
// A lógica específica de:
//
// - Pesquisa
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
// LISTA DAS TELAS INTERNAS
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

const itensMenuSistema = [

    "menuPesquisa",

    "menuImportacao",

    "menuConferencia",

    "menuConferencias",

    "menuDivergencias",

    "menuConfiguracoes"

];


// ============================================================
// FUNÇÃO: esconderTelasSistema()
// ============================================================
//
// Esconde todas as telas internas.
//
// A sidebar NÃO é alterada.
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
// Remove o destaque visual de todos os itens da sidebar.
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
// PARÂMETROS:
//
// idTela
//     Tela que será exibida.
//
// idMenu
//     Item da sidebar que ficará destacado.
//
// ============================================================

function mostrarTelaSistema(
    idTela,
    idMenu
) {

    esconderTelasSistema();

    limparMenuAtivo();


    const tela =
        document.getElementById(
            idTela
        );


    if (tela) {

        tela.style.display =
            "block";

    }


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
// TELA INICIAL
// ============================================================
//
// FUNÇÃO:
//     abrirSistema()
//
// Sai da tela inicial e abre a aplicação.
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


    if (inicio) {

        inicio.style.display =
            "none";

    }


    if (aplicacao) {

        aplicacao.style.display =
            "block";

    }


    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// PESQUISA
// ============================================================

function abrirPesquisa() {

    mostrarTelaSistema(
        "pesquisa",
        "menuPesquisa"
    );

}


// ============================================================
// VOLTAR DA PESQUISA
// ============================================================
//
// Mantida por compatibilidade.
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


    script.onload =
        function() {

            console.log(
                "SheetJS carregado com sucesso."
            );

        };


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
// ABRIR MODAL
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
// FECHAR MODAL
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
// CONFIRMAR ZERAMENTO
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
        // RESULTADO
        // ====================================================

        const resultado =
            document.getElementById(
                "resultadoImportacao"
            );


        if (!resultado) {

            return;

        }


        if (
            apagarConferencias ===
            true
        ) {

            resultado.innerHTML =
                "<p>✅ Inventário e conferências foram apagados com sucesso.</p>";

        } else {

            resultado.innerHTML =
                "<p>✅ Inventário apagado com sucesso. As conferências foram mantidas.</p>";

        }


    } catch (erro) {

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
