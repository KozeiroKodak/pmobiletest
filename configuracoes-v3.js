/* ============================================================
   PMOBILE — Configurações 3.0
   Camada exclusiva de navegação. Preserva IDs, funções de
   importação, banco, permissões e componentes originais.
   ============================================================ */
(function () {
    "use strict";

    const areas = {
        rastreios: {
            titulo: "Importação de rastreios",
            caminho: "Dados e integrações",
            descricao: "Importe planilhas e gerencie a sincronização OneDrive.",
            painel: "painelConfiguracoesImportacao"
        },
        nf: {
            titulo: "Importação NF",
            caminho: "Dados e integrações",
            descricao: "Acesso às planilhas e ao histórico de notas fiscais.",
            painel: "painelConfiguracoesNF"
        },
        sistema: {
            titulo: "Sistema",
            caminho: "Aplicativo",
            descricao: "Atualizações e informações do PMobile.",
            painel: "painelConfiguracoesSistema"
        },
        conta: {
            titulo: "Minha conta",
            caminho: "Aplicativo",
            descricao: "Informações do usuário e da sessão atual.",
            painel: "painelConfiguracoesUsuario"
        },
        admin: {
            titulo: "Administração",
            caminho: "Área administrativa",
            descricao: "Ferramentas de gerenciamento do PMobile.",
            painel: "painelConfiguracoesAdmin"
        }
    };

    const subareas = {
        usuarios: { titulo: "Usuários", painel: "painelGerenciamentoUsuarios" },
        arquivos: { titulo: "Arquivos de teste", painel: "painelArquivosTeste" },
        manutencao: { titulo: "Manutenção", painel: "painelConfiguracoesManutencao" }
    };

    let areaAtual = null;
    let subareaAtual = null;
    // Rastreia somente subtelas externas realmente abertas pela Administração.
    let origemSubtelaAdmin = null;

    function elemento(id) {
        return document.getElementById(id);
    }

    function ehAdmin() {
        return !!(window.usuarioPmobileAtual && window.usuarioPmobileAtual.nivel === "ADMIN");
    }

    function esconderPainelSeExistir(id) {
        const painel = elemento(id);
        if (painel) painel.style.display = "none";
    }

    function limparSelecaoVisual() {
        const tela = elemento("configuracoes");
        if (!tela) return;

        tela.querySelectorAll(".config-v3-visivel").forEach(function (painel) {
            painel.classList.remove("config-v3-visivel");
        });
    }

    function atualizarAcessoVisual() {
        const admin = ehAdmin();
        const adminBotao = elemento("configuracoesV3AbrirAdmin");
        const nfBotao = elemento("configuracoesV3AbrirNF");
        if (adminBotao) adminBotao.hidden = !admin;
        if (nfBotao) nfBotao.hidden = !admin;
    }

    function apresentarCabecalho(config, sub) {
        const caminho = elemento("configuracoesV3Caminho");
        const titulo = elemento("configuracoesV3Titulo");
        const descricao = elemento("configuracoesV3Descricao");
        if (caminho) caminho.textContent = sub
            ? "PMOBILE / Administração"
            : "PMOBILE / " + config.caminho;
        if (titulo) titulo.textContent = sub ? sub.titulo : config.titulo;
        if (descricao) descricao.textContent = sub
            ? "Ferramenta administrativa do PMobile."
            : config.descricao;
    }

    function atualizarTela() {
        const tela = elemento("configuracoes");
        if (!tela) return;

        atualizarAcessoVisual();
        limparSelecaoVisual();

        const detalhe = areaAtual !== null;
        const hub = elemento("configuracoesV3Hub");
        const cabecalho = elemento("configuracoesV3Cabecalho");

        tela.classList.toggle("configuracoes-v3-detalhe", detalhe);
        if (hub) hub.hidden = detalhe;
        if (cabecalho) cabecalho.hidden = !detalhe;

        if (!detalhe) return;

        const area = areas[areaAtual];
        const sub = subareaAtual ? subareas[subareaAtual] : null;
        if (!area) return;
        apresentarCabecalho(area, sub);

        const id = sub ? sub.painel : area.painel;
        const painel = elemento(id);
        if (painel) painel.classList.add("config-v3-visivel");

        // Os detalhes antigos continuam existindo para não perder campos,
        // ações e listeners. Nesta navegação a página é aberta diretamente.
        if (!sub && painel) {
            const detalhes = painel.querySelector(":scope > details.configuracoes-accordion");
            if (detalhes) detalhes.open = true;
        }

        // Evita manter a posição de rolagem de um módulo diferente.
        window.scrollTo({ top: 0, behavior: "auto" });
    }

    function prepararPainelAdmin() {
        const admin = elemento("painelConfiguracoesAdmin");
        if (admin) admin.style.display = ehAdmin() ? "block" : "none";
        esconderPainelSeExistir("painelGerenciamentoUsuarios");
        esconderPainelSeExistir("painelConfiguracoesManutencao");
        esconderPainelSeExistir("painelArquivosTeste");
    }

    window.mostrarInicioConfiguracoesV3 = function () {
        areaAtual = null;
        subareaAtual = null;
        origemSubtelaAdmin = null;
        atualizarTela();
    };

    window.abrirAreaConfiguracoesV3 = function (nome) {
        const config = areas[nome];
        if (!config) return;

        if ((nome === "nf" || nome === "admin") && !ehAdmin()) {
            alert("Acesso administrativo negado.");
            return;
        }

        if (nome === "nf") {
            if (typeof atualizarAcessoAdminRastreio === "function") {
                atualizarAcessoAdminRastreio();
            }
            const nf = elemento("painelConfiguracoesNF");
            if (!nf || nf.hidden) {
                alert("A importação de notas fiscais não está disponível para esta sessão.");
                return;
            }
        }

        if (nome === "admin") {
            prepararPainelAdmin();
        } else {
            esconderPainelSeExistir("painelGerenciamentoUsuarios");
            esconderPainelSeExistir("painelConfiguracoesManutencao");
            esconderPainelSeExistir("painelArquivosTeste");
        }

        areaAtual = nome;
        subareaAtual = null;
        atualizarTela();
    };

    window.abrirSubareaConfiguracoesV3 = function (nome) {
        if (!ehAdmin()) {
            alert("Acesso administrativo negado.");
            return;
        }

        if (nome === "locais" || nome === "divergencias") {
            const abrir = nome === "locais" ? window.abrirLocais : window.abrirDivergencias;
            if (typeof abrir !== "function") return;
            const atualAntes = typeof obterTelaSistemaAtual === "function"
                ? obterTelaSistemaAtual()
                : null;
            abrir();
            const atualDepois = typeof obterTelaSistemaAtual === "function"
                ? obterTelaSistemaAtual()
                : null;
            // Só arma o retorno se a função original realmente abriu a subtela.
            if (atualAntes === "configuracoes" &&
                atualDepois === (nome === "locais" ? "locais" : "divergencias")) {
                origemSubtelaAdmin = atualDepois;
            }
            return;
        }
        if (nome === "tokens") {
            // A função atual ainda é informativa; não criar fluxos fictícios.
            if (typeof abrirSolicitacoesResetToken === "function") abrirSolicitacoesResetToken();
            return;
        }

        if (!subareas[nome]) return;

        if (nome === "usuarios") {
            if (typeof abrirGerenciamentoUsuarios === "function") {
                abrirGerenciamentoUsuarios();
            }
        } else if (nome === "arquivos") {
            if (typeof abrirArquivosTeste === "function") {
                abrirArquivosTeste();
            }
        } else if (nome === "manutencao") {
            if (typeof abrirManutencaoBanco === "function") {
                abrirManutencaoBanco();
            }
            const admin = elemento("painelConfiguracoesAdmin");
            if (admin) admin.style.display = "none";
        }

        const painel = elemento(subareas[nome].painel);
        // Respeita a validação original: se ela não abriu o painel,
        // não permite exibir uma página vazia ou sem autorização.
        if (!painel || painel.style.display === "none") return;

        areaAtual = "admin";
        subareaAtual = nome;
        atualizarTela();
    };

    window.voltarConfiguracoesV3 = function () {
        if (subareaAtual) {
            if (subareaAtual === "usuarios" && typeof fecharGerenciamentoUsuarios === "function") {
                fecharGerenciamentoUsuarios();
            } else if (subareaAtual === "arquivos" && typeof fecharArquivosTeste === "function") {
                fecharArquivosTeste();
            }
            prepararPainelAdmin();
            areaAtual = ehAdmin() ? "admin" : null;
            subareaAtual = null;
            atualizarTela();
            return;
        }

        areaAtual = null;
        atualizarTela();
    };

    // Consumidor de Voltar: respeita cada etapa interna das Configurações.
    window.voltarUmNivelConfiguracoesV3 = function (telaAtual) {
        if (telaAtual === "configuracoes" && (subareaAtual !== null || areaAtual !== null)) {
            window.voltarConfiguracoesV3();
            return true;
        }

        if ((telaAtual === "locais" || telaAtual === "divergencias") &&
            origemSubtelaAdmin === telaAtual) {
            origemSubtelaAdmin = null;
            if (typeof mostrarTelaSistema === "function") {
                mostrarTelaSistema("configuracoes", "menuConfiguracoes", true);
            }
            // A página pai é Administração, não o menu inicial do PMobile.
            window.abrirAreaConfiguracoesV3("admin");
            return true;
        }
        return false;
    };

    document.addEventListener("DOMContentLoaded", function () {
        // Se a aplicação for aberta sem passar pela função de navegação,
        // mantém a tela inicial coesa e protege os cartões administrativos.
        if (elemento("configuracoesV3Hub")) {
            window.mostrarInicioConfiguracoesV3();
        }
    });
})();
