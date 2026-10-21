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
// A tela Pesquisa utiliza uma interface unificada:
//
// Pesquisa
// └── Código / Referência / Descrição
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

    "contagemManual",

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

    "menuContagemManual",

    "menuConferencia",

    "menuConferencias",

    "menuDivergencias",

    "menuConfiguracoes"

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

    const inicio = document.getElementById("inicio");
    const login = document.getElementById("loginPmobile");
    const aplicacao = document.getElementById("aplicacao");

    if (inicio) {
        inicio.style.display = "none";
    }

    if (aplicacao) {
        aplicacao.style.display = "none";
    }

    if (login) {
        login.style.display = "block";

        const usuario = document.getElementById("loginUsuario");

        if (usuario) {
            setTimeout(function() {
                usuario.focus();
            }, 0);
        }
    }

}


// ============================================================
// LOGIN — SENHA / PRIMEIRO ACESSO
// ============================================================
//
// No primeiro acesso, basta informar o usuário aprovado.
// O banco verifica internamente se existe uma ativação pendente
// (token de aprovação ainda válido e nenhuma senha criada).
//
// Depois que a senha existe, o login normal usa usuário + senha.
//
// ============================================================

let usuarioPmobileAtual = null;
let credencialPmobileAtual = null;


function voltarInicio() {

    const inicio = document.getElementById("inicio");
    const login = document.getElementById("loginPmobile");

    if (login) {
        login.style.display = "none";
    }

    if (inicio) {
        inicio.style.display = "block";
    }

}


function sairPmobile() {

    usuarioPmobileAtual = null;
    credencialPmobileAtual = null;
    window.credencialPmobileAtual = null;
    window.usuarioPmobileAtual = null;

    limparLoginPmobileSalvo();

    const checkbox = document.getElementById("loginManterLogin");
    if (checkbox) {
        checkbox.checked = false;
    }

    const aplicacao = document.getElementById("aplicacao");
    const login = document.getElementById("loginPmobile");
    const inicio = document.getElementById("inicio");
    const campoUsuario = document.getElementById("loginUsuario");
    const campoSenha = document.getElementById("loginSenha");
    const status = document.getElementById("loginStatus");

    if (aplicacao) {
        aplicacao.style.display = "none";
    }

    if (login) {
        login.style.display = "block";
    }

    if (inicio) {
        inicio.style.display = "none";
    }

    if (campoSenha) {
        campoSenha.value = "";
    }

    usuarioPmobileCadastroSenha = null;
    const criarSenha = document.getElementById("criarSenhaPmobile");
    if (criarSenha) {
        criarSenha.style.display = "none";
    }

    if (campoUsuario) {
        campoUsuario.value = "";
        campoUsuario.focus();
    }

    if (status) {
        status.textContent = "";
        status.classList.remove("erro");
    }

    atualizarVisibilidadeConfiguracoes();

}


function sanitizarCampoUsuarioPmobile(campo) {

    if (!campo) {
        return;
    }

    const valorAnterior = campo.value;

    campo.value = valorAnterior.replace(
        /[^A-Za-z0-9._-]/g,
        ""
    );

}

// ============================================================
// SESSÃO PERSISTENTE LOCAL — INDEXEDDB
// ============================================================
//
// O login mantido não depende de localStorage.
// A sessão é armazenada em uma base local persistente,
// apropriada para o web layer do PMOBILE.
//
// ============================================================

const PMOBILE_IDB_NOME = "PMOBILE_LOCAL";
const PMOBILE_IDB_VERSAO = 2;
const PMOBILE_IDB_STORE = "sessao";
const PMOBILE_IDB_STORE_CONTAGENS_MANUAIS = "contagensManuais";
const PMOBILE_IDB_CHAVE_LOGIN = "login";


function abrirBancoLocalPmobile() {

    return new Promise(function(resolve, reject) {

        if (!window.indexedDB) {
            reject(new Error("IndexedDB indisponível neste dispositivo."));
            return;
        }

        const requisicao =
            window.indexedDB.open(
                PMOBILE_IDB_NOME,
                PMOBILE_IDB_VERSAO
            );

        requisicao.onupgradeneeded = function(evento) {

            const banco = evento.target.result;

            if (!banco.objectStoreNames.contains(PMOBILE_IDB_STORE)) {
                banco.createObjectStore(PMOBILE_IDB_STORE);
            }

            if (!banco.objectStoreNames.contains(PMOBILE_IDB_STORE_CONTAGENS_MANUAIS)) {
                banco.createObjectStore(PMOBILE_IDB_STORE_CONTAGENS_MANUAIS, {
                    keyPath: "id"
                });
            }

        };

        requisicao.onsuccess = function() {
            resolve(requisicao.result);
        };

        requisicao.onerror = function() {
            reject(requisicao.error || new Error("Não foi possível abrir o armazenamento local."));
        };

    });

}


async function salvarLoginPmobile(usuario, senha, dadosUsuario) {

    try {

        const banco =
            await abrirBancoLocalPmobile();

        await new Promise(function(resolve, reject) {

            const transacao =
                banco.transaction(
                    PMOBILE_IDB_STORE,
                    "readwrite"
                );

            const loja =
                transacao.objectStore(
                    PMOBILE_IDB_STORE
                );

            loja.put(
                {
                    usuario: usuario,
                    senha: senha,
                    dadosUsuario: dadosUsuario,
                    salvoEm: new Date().toISOString()
                },
                PMOBILE_IDB_CHAVE_LOGIN
            );

            transacao.oncomplete = resolve;
            transacao.onerror = function() {
                reject(
                    transacao.error ||
                    new Error("Não foi possível salvar a sessão.")
                );
            };
            transacao.onabort = function() {
                reject(
                    transacao.error ||
                    new Error("A gravação da sessão foi cancelada.")
                );
            };

        });

        banco.close();

    } catch (erro) {

        console.warn(
            "⚠️ Não foi possível salvar o login local:",
            erro
        );

    }

}


async function limparLoginPmobileSalvo() {

    try {

        const banco =
            await abrirBancoLocalPmobile();

        await new Promise(function(resolve, reject) {

            const transacao =
                banco.transaction(
                    PMOBILE_IDB_STORE,
                    "readwrite"
                );

            const loja =
                transacao.objectStore(
                    PMOBILE_IDB_STORE
                );

            loja.delete(
                PMOBILE_IDB_CHAVE_LOGIN
            );

            transacao.oncomplete = resolve;
            transacao.onerror = function() {
                reject(
                    transacao.error ||
                    new Error("Não foi possível remover a sessão.")
                );
            };
            transacao.onabort = function() {
                reject(
                    transacao.error ||
                    new Error("A remoção da sessão foi cancelada.")
                );
            };

        });

        banco.close();

    } catch (erro) {

        console.warn(
            "⚠️ Não foi possível remover o login salvo:",
            erro
        );

    }

}


async function obterLoginPmobileSalvo() {

    try {

        const banco =
            await abrirBancoLocalPmobile();

        const dados =
            await new Promise(function(resolve, reject) {

                const transacao =
                    banco.transaction(
                        PMOBILE_IDB_STORE,
                        "readonly"
                    );

                const loja =
                    transacao.objectStore(
                        PMOBILE_IDB_STORE
                    );

                const requisicao =
                    loja.get(
                        PMOBILE_IDB_CHAVE_LOGIN
                    );

                requisicao.onsuccess = function() {
                    resolve(requisicao.result || null);
                };

                requisicao.onerror = function() {
                    reject(
                        requisicao.error ||
                        new Error("Não foi possível ler a sessão.")
                    );
                };

            });

        banco.close();

        if (
            !dados ||
            !dados.usuario ||
            !dados.senha ||
            !dados.dadosUsuario
        ) {
            return null;
        }

        return dados;

    } catch (erro) {

        console.warn(
            "⚠️ Login local indisponível:",
            erro
        );

        return null;

    }

}


function restaurarSessaoPmobile(dadosUsuario, senha) {

    usuarioPmobileAtual = dadosUsuario;
    window.usuarioPmobileAtual = dadosUsuario;
    credencialPmobileAtual = senha;
    window.credencialPmobileAtual = senha;

    atualizarVisibilidadeConfiguracoes();

    const inicio = document.getElementById("inicio");
    const login = document.getElementById("loginPmobile");
    const criarSenha = document.getElementById("criarSenhaPmobile");
    const aplicacao = document.getElementById("aplicacao");

    if (inicio) inicio.style.display = "none";
    if (login) login.style.display = "none";
    if (criarSenha) criarSenha.style.display = "none";
    if (aplicacao) aplicacao.style.display = "block";

    mostrarTelaSistema("homeSistema", null);

}


async function tentarRestaurarLoginPmobile() {

    const checkbox = document.getElementById("loginManterLogin");
    const salvo = await obterLoginPmobileSalvo();

    if (checkbox) {
        checkbox.checked = !!salvo;
    }

    if (!salvo) {
        return;
    }

    if (!navigator.onLine) {
        restaurarSessaoPmobile(salvo.dadosUsuario, salvo.senha);
        console.log("📴 PMOBILE iniciou offline com login mantido.");
        return;
    }

    if (!window.clienteSupabase) {
        restaurarSessaoPmobile(salvo.dadosUsuario, salvo.senha);
        console.log("📴 Supabase indisponível; mantendo sessão salva.");
        return;
    }

    try {

        const resultado = await window.clienteSupabase.rpc(
            "autenticar_usuario",
            {
                p_usuario: salvo.usuario,
                p_credencial: salvo.senha
            }
        );

        if (resultado.error) {
            throw resultado.error;
        }

        const usuarioValidado =
            Array.isArray(resultado.data)
                ? resultado.data[0]
                : resultado.data;

        if (!usuarioValidado || usuarioValidado.precisa_criar_senha) {
            limparLoginPmobileSalvo();
            mostrarStatusLogin(
                "A sessão salva não é mais válida. Entre novamente.",
                true
            );
            return;
        }

        restaurarSessaoPmobile(usuarioValidado, salvo.senha);
        await salvarLoginPmobile(salvo.usuario, salvo.senha, usuarioValidado);

        console.log("✅ Login mantido e validado pelo servidor.");

    } catch (erro) {

        console.warn(
            "⚠️ Não foi possível validar o login salvo. Mantendo sessão offline:",
            erro
        );

        restaurarSessaoPmobile(salvo.dadosUsuario, salvo.senha);

    }

}


function abrirCriacaoSenha(usuario, dadosUsuario) {

    usuarioPmobileCadastroSenha = usuario;

    const login = document.getElementById("loginPmobile");
    const criarSenha = document.getElementById("criarSenhaPmobile");
    const status = document.getElementById("criarSenhaStatus");
    const senha = document.getElementById("criarSenha");
    const confirmar = document.getElementById("confirmarSenha");

    if (login) {
        login.style.display = "none";
    }

    if (criarSenha) {
        criarSenha.style.display = "block";
    }

    if (status) {
        status.textContent = "";
        status.classList.remove("erro");
    }

    if (senha) senha.value = "";
    if (confirmar) confirmar.value = "";

    const nome = document.getElementById("criarSenhaNome");
    if (nome && dadosUsuario && dadosUsuario.nome) {
        nome.textContent = dadosUsuario.nome;
    }

    if (senha) {
        setTimeout(function() {
            senha.focus();
        }, 0);
    }

}


function voltarLoginCriacaoSenha() {

    usuarioPmobileCadastroSenha = null;
    const criarSenha = document.getElementById("criarSenhaPmobile");
    const login = document.getElementById("loginPmobile");

    if (criarSenha) {
        criarSenha.style.display = "none";
    }

    if (login) {
        login.style.display = "block";
    }

}


function mostrarStatusCriarSenha(mensagem, erro = false) {

    const status = document.getElementById("criarSenhaStatus");

    if (!status) {
        return;
    }

    status.textContent = mensagem;
    status.classList.toggle("erro", erro);

}


async function criarSenhaPmobile(event) {

    if (event) {
        event.preventDefault();
    }

    const campoSenha = document.getElementById("criarSenha");
    const campoConfirmar = document.getElementById("confirmarSenha");

    const senha = campoSenha ? campoSenha.value : "";
    const confirmar = campoConfirmar ? campoConfirmar.value : "";

    if (!usuarioPmobileCadastroSenha) {
        voltarLoginCriacaoSenha();
        mostrarStatusLogin(
            "A ativação deste usuário não está mais disponível.",
            true
        );
        return;
    }

    if (!senha || !confirmar) {
        mostrarStatusCriarSenha(
            "Digite e confirme a senha.",
            true
        );
        return;
    }

    if (senha.length < 8) {
        mostrarStatusCriarSenha(
            "A senha deve ter pelo menos 8 caracteres.",
            true
        );
        return;
    }

    if (senha !== confirmar) {
        mostrarStatusCriarSenha(
            "As senhas não coincidem.",
            true
        );
        return;
    }

    if (!window.clienteSupabase) {
        mostrarStatusCriarSenha(
            "Não foi possível conectar ao servidor.",
            true
        );
        return;
    }

    mostrarStatusCriarSenha("Criando senha...");

    try {

        const { data, error } =
            await window.clienteSupabase.rpc(
                "criar_senha_usuario",
                {
                    p_usuario: usuarioPmobileCadastroSenha,
                    p_senha: senha
                }
            );

        if (error) {
            console.error("❌ Erro ao criar senha:", error);
            mostrarStatusCriarSenha(
                error.message || "Não foi possível criar a senha.",
                true
            );
            return;
        }

        const usuarioCriado =
            Array.isArray(data)
                ? data[0]
                : data;

        if (!usuarioCriado) {
            mostrarStatusCriarSenha(
                "Não foi possível concluir a criação da senha.",
                true
            );
            return;
        }

        const manterLogin =
            document.getElementById("loginManterLogin");

        usuarioPmobileAtual = usuarioCriado;
        window.usuarioPmobileAtual = usuarioCriado;
        // A senha recém-criada passa a ser a credencial administrativa da sessão.
        // Sem isso, o usuário ADMIN conseguiria entrar no app, mas as operações
        // administrativas seriam bloqueadas por credencial ausente.
        credencialPmobileAtual = senha;
        window.credencialPmobileAtual = senha;

        if (manterLogin && manterLogin.checked) {
            await salvarLoginPmobile(
                usuarioCriado.usuario,
                senha,
                usuarioCriado
            );
        } else {
            limparLoginPmobileSalvo();
        }

        usuarioPmobileCadastroSenha = null;
        tokenPmobileCadastroSenha = null;

        atualizarVisibilidadeConfiguracoes();

        restaurarSessaoPmobile(
            usuarioCriado,
            senha
        );

        console.log(
            "✅ Senha criada e usuário ativado:",
            {
                id: usuarioCriado.id,
                usuario: usuarioCriado.usuario,
                nivel: usuarioCriado.nivel
            }
        );

    } catch (erro) {

        console.error(
            "❌ Falha inesperada ao criar senha:",
            erro
        );

        mostrarStatusCriarSenha(
            "Erro ao criar a senha. Tente novamente.",
            true
        );

    }

}


function alternarCampoSenha(idCampo, botao) {

    const campo = document.getElementById(idCampo);

    if (!campo) {
        return;
    }

    const mostrar = campo.type === "password";

    campo.type = mostrar ? "text" : "password";

    if (botao) {
        botao.textContent = mostrar ? "Ocultar" : "Mostrar";
    }

}


function alternarSenhaLogin() {

    const senha = document.getElementById("loginSenha");
    const botao = document.querySelector(".login-mostrar-senha");

    if (!senha) {
        return;
    }

    const mostrar = senha.type === "password";

    senha.type = mostrar ? "text" : "password";

    if (botao) {
        botao.textContent = mostrar ? "Ocultar" : "Mostrar";
    }

}


function mostrarStatusLogin(mensagem, erro = false) {

    const status = document.getElementById("loginStatus");

    if (!status) {
        return;
    }

    status.textContent = mensagem;
    status.classList.toggle("erro", erro);

}


async function entrarInterface(event) {

    if (event) {
        event.preventDefault();
    }

    const campoUsuario =
        document.getElementById("loginUsuario");

    const campoSenha =
        document.getElementById("loginSenha");

    const usuario =
        campoUsuario
            ? campoUsuario.value.trim()
            : "";

    // Usuário: somente letras, números, ponto, hífen e sublinhado.
    // Impede caracteres inválidos de chegarem à autenticação ou ao login salvo.
    if (usuario && !/^[A-Za-z0-9._-]+$/.test(usuario)) {
        mostrarStatusLogin(
            "Usuário contém caracteres inválidos.",
            true
        );

        if (campoUsuario) {
            campoUsuario.focus();
        }

        return;
    }

    const senha =
        campoSenha
            ? campoSenha.value
            : "";

    if (!usuario) {
        mostrarStatusLogin(
            "Informe o usuário.",
            true
        );
        return;
    }

    if (!window.clienteSupabase) {
        mostrarStatusLogin(
            "Não foi possível conectar ao servidor.",
            true
        );
        return;
    }

    mostrarStatusLogin("Validando acesso...");

    try {

        // Primeiro acesso: usuário aprovado, ainda sem senha.
        if (!senha) {

            const { data, error } =
                await window.clienteSupabase.rpc(
                    "autenticar_usuario",
                    {
                        p_usuario: usuario
                    }
                );

            if (error) {
                console.error(
                    "❌ Erro ao verificar primeiro acesso:",
                    error
                );

                mostrarStatusLogin(
                    "Não foi possível validar o acesso.",
                    true
                );
                return;
            }

            const usuarioAtivacao =
                Array.isArray(data)
                    ? data[0]
                    : data;

            if (
                usuarioAtivacao &&
                usuarioAtivacao.precisa_criar_senha
            ) {
                abrirCriacaoSenha(
                    usuarioAtivacao.usuario,
                    usuarioAtivacao
                );

                mostrarStatusCriarSenha(
                    "Seu usuário foi aprovado. Agora crie sua senha de acesso."
                );

                return;
            }

            mostrarStatusLogin(
                "Usuário ou senha inválidos.",
                true
            );
            return;
        }

        // Login normal: usuário + senha.
        const {
            data,
            error
        } =
            await window.clienteSupabase.rpc(
                "autenticar_usuario",
                {
                    p_usuario: usuario,
                    p_credencial: senha
                }
            );

        if (error) {
            console.error(
                "❌ Erro na autenticação:",
                error
            );

            mostrarStatusLogin(
                "Não foi possível validar o acesso.",
                true
            );
            return;
        }

        const usuarioAutenticado =
            Array.isArray(data)
                ? data[0]
                : data;

        if (!usuarioAutenticado) {
            mostrarStatusLogin(
                "Usuário ou senha inválidos.",
                true
            );

            if (campoSenha) {
                campoSenha.value = "";
                campoSenha.focus();
            }

            return;
        }

        usuarioPmobileAtual = usuarioAutenticado;
        window.usuarioPmobileAtual = usuarioAutenticado;
        credencialPmobileAtual = senha;

        const manterLogin =
            document.getElementById("loginManterLogin");

        if (manterLogin && manterLogin.checked) {
            await salvarLoginPmobile(
                usuario,
                senha,
                usuarioAutenticado
            );
        } else {
            limparLoginPmobileSalvo();
        }

        atualizarVisibilidadeConfiguracoes();

        console.log(
            "✅ Usuário autenticado:",
            {
                id: usuarioAutenticado.id,
                usuario: usuarioAutenticado.usuario,
                nivel: usuarioAutenticado.nivel
            }
        );

        const inicio =
            document.getElementById("inicio");

        const login =
            document.getElementById("loginPmobile");

        const aplicacao =
            document.getElementById("aplicacao");

        if (inicio) {
            inicio.style.display = "none";
        }

        if (login) {
            login.style.display = "none";
        }

        if (aplicacao) {
            aplicacao.style.display = "block";
        }

        mostrarTelaSistema(
            "homeSistema",
            null
        );

    } catch (erro) {

        console.error(
            "❌ Falha inesperada no login:",
            erro
        );

        mostrarStatusLogin(
            "Erro ao entrar no PMOBILE. Tente novamente.",
            true
        );

    }

}


function avisoLoginTeste() {

    mostrarStatusLogin(
        "A recuperação da senha será feita pelo administrador."
    );

}


// ============================================================
// SOLICITAÇÃO DE NOVO USUÁRIO
// ============================================================

function abrirSolicitacaoCadastro() {

    const modal = document.getElementById("modalSolicitacaoCadastro");
    const status = document.getElementById("cadastroStatus");

    if (modal) {
        modal.style.display = "flex";
    }

    if (status) {
        status.textContent = "";
        status.classList.remove("erro");
    }

    const nome = document.getElementById("cadastroNome");
    if (nome) {
        setTimeout(function() {
            nome.focus();
        }, 0);
    }

}


function fecharSolicitacaoCadastro() {

    const modal = document.getElementById("modalSolicitacaoCadastro");

    if (modal) {
        modal.style.display = "none";
    }

}


function mostrarStatusCadastro(mensagem, erro = false) {

    const status = document.getElementById("cadastroStatus");

    if (!status) {
        return;
    }

    status.textContent = mensagem;
    status.classList.toggle("erro", erro);

}


async function enviarSolicitacaoCadastro(event) {

    if (event) {
        event.preventDefault();
    }

    const campoNome = document.getElementById("cadastroNome");
    const campoUsuario = document.getElementById("cadastroUsuario");

    const nome = campoNome ? campoNome.value.trim() : "";
    const usuario = campoUsuario ? campoUsuario.value.trim() : "";

    if (!nome || !usuario) {
        mostrarStatusCadastro("Informe o nome e o usuário desejado.", true);
        return;
    }

    if (!window.clienteSupabase) {
        mostrarStatusCadastro("Não foi possível conectar ao servidor.", true);
        return;
    }

    mostrarStatusCadastro("Enviando solicitação...");

    try {

        const { data, error } = await window.clienteSupabase.rpc(
            "solicitar_cadastro_usuario",
            {
                p_nome: nome,
                p_usuario: usuario
            }
        );

        if (error) {
            console.error("❌ Erro na solicitação de cadastro:", error);
            mostrarStatusCadastro(
                error.message || "Não foi possível enviar a solicitação.",
                true
            );
            return;
        }

        if (data == null) {
            mostrarStatusCadastro("Não foi possível registrar a solicitação.", true);
            return;
        }

        mostrarStatusCadastro(
            "Solicitação enviada. Aguarde a aprovação do administrador."
        );

        if (campoNome) {
            campoNome.value = "";
        }

        if (campoUsuario) {
            campoUsuario.value = "";
        }

    } catch (erro) {

        console.error("❌ Falha na solicitação de cadastro:", erro);
        mostrarStatusCadastro(
            "Erro ao enviar a solicitação. Tente novamente.",
            true
        );

    }

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

    mostrarTelaSistema(
        "pesquisa",
        "menuPesquisa"
    );

    const campo = document.getElementById("campoPesquisaMaterial");

    if (campo) {
        campo.focus();
    }

}


// ============================================================
// VOLTAR PARA HOME
// ============================================================
//
// FUNÇÃO:
//     voltarMenu()
//
// Mantida por compatibilidade com versões anteriores
// do PMOBILE.
// ============================================================

function voltarMenu() {

    mostrarTelaSistema(
        "homeSistema",
        null
    );

}


// ============================================================
// CONTAGEM MANUAL
// ============================================================

function abrirContagemManual() {

    mostrarTelaSistema(
        "contagemManual",
        "menuContagemManual"
    );

    if (typeof exibirContagensManuais === "function") {
        exibirContagensManuais();
    }

    const campo = document.getElementById("campoContagemManual");
    if (campo) {
        campo.focus();
    }

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

function atualizarVisibilidadeConfiguracoes() {

    const usuario = window.usuarioPmobileAtual;
    const nivel = usuario ? usuario.nivel : null;
    const isAdmin = nivel === "ADMIN";
    const isNivel2 = nivel === "NIVEL2";

    const regras = {
        menuSair: !!usuario,
        menuConfiguracoes: isAdmin,
        menuImportacao: isAdmin,
        menuConferencia: isAdmin,
        menuConferencias: isAdmin,
        menuPesquisa: isAdmin || isNivel2,
        menuContagemManual: isAdmin || isNivel2,
        menuDivergencias: isAdmin || isNivel2
    };

    Object.keys(regras).forEach(function(id) {
        const botao = document.getElementById(id);
        if (botao) botao.style.display = regras[id] ? "" : "none";
    });

}


function abrirConfiguracoes() {

    mostrarTelaSistema(
        "configuracoes",
        "menuConfiguracoes"
    );

    const admin = document.getElementById("painelConfiguracoesAdmin");
    const manutencao = document.getElementById("painelConfiguracoesManutencao");
    const usuarios = document.getElementById("painelGerenciamentoUsuarios");
    const reset = document.getElementById("painelGerenciamentoReset");
    const conta = document.getElementById("painelConfiguracoesUsuario");
    const resumo = document.getElementById("resumoContaPmobile");
    const usuario = window.usuarioPmobileAtual;
    const isAdmin = usuario && usuario.nivel === "ADMIN";

    if (admin) admin.style.display = isAdmin ? "block" : "none";
    if (manutencao) manutencao.style.display = "none";
    if (usuarios) usuarios.style.display = "none";
    if (reset) reset.style.display = "none";
    if (conta) conta.style.display = "block";

    if (resumo) {
        resumo.innerHTML = usuario
            ? "<strong>" + (usuario.nome || usuario.usuario) + "</strong><br>Usuário: " + usuario.usuario + "<br>Nível: " + usuario.nivel
            : "Nenhum usuário autenticado.";
    }

}


function abrirManutencaoBanco() {

    if (!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN") {
        alert("Acesso administrativo negado.");
        return;
    }

    const manutencao = document.getElementById("painelConfiguracoesManutencao");
    if (manutencao) manutencao.style.display = "block";

}


async function abrirGerenciamentoUsuarios() {

    if (!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN" || !credencialPmobileAtual) {
        alert("Acesso administrativo negado.");
        return;
    }

    const painel = document.getElementById("painelGerenciamentoUsuarios");
    const manutencao = document.getElementById("painelConfiguracoesManutencao");
    const admin = document.getElementById("painelConfiguracoesAdmin");
    const conta = document.getElementById("painelConfiguracoesUsuario");
    const lista = document.getElementById("listaSolicitacoesCadastro");

    if (admin) admin.style.display = "none";
    if (manutencao) manutencao.style.display = "none";
    if (conta) conta.style.display = "none";
    if (painel) painel.style.display = "block";
    mostrarFiltroSolicitacoes("cadastro");

    if (!lista) return;

    lista.innerHTML = "<div class=\"solicitacao-carregando\">Carregando solicitações...</div>";

    try {
        const { data, error } = await window.clienteSupabase.rpc("listar_solicitacoes_cadastro", {
            p_admin_usuario: window.usuarioPmobileAtual.usuario,
            p_admin_credencial: credencialPmobileAtual
        });

        if (error) throw error;

        const solicitacoes = Array.isArray(data) ? data : [];
        const pendentes = solicitacoes.filter(function(s) {
            return s.status === "PENDENTE";
        });

        const contador = document.getElementById("contadorSolicitacoesCadastro");
        if (contador) contador.textContent = String(pendentes.length);

        if (!pendentes.length) {
            lista.innerHTML =
                '<div class="solicitacao-vazia">' +
                    '<span class="solicitacao-vazia-icone">✓</span>' +
                    '<strong>Nenhuma solicitação pendente</strong>' +
                    '<p>Quando alguém solicitar um cadastro, ele aparecerá aqui.</p>' +
                '</div>';
            return;
        }

        lista.innerHTML = pendentes.map(function(solicitacao) {
            const nome = escapeHtmlPmobile(solicitacao.nome);
            const usuario = escapeHtmlPmobile(solicitacao.usuario);
            const dataSolicitacao = formatarDataSolicitacaoPmobile(solicitacao.solicitado_em);
            const inicial = escapeHtmlPmobile(
                String(solicitacao.nome || solicitacao.usuario || "?").trim().charAt(0).toUpperCase()
            );

            return '<article class="solicitacao-facebook-card">' +
                '<div class="solicitacao-facebook-corpo">' +
                    '<div class="solicitacao-avatar" aria-hidden="true">' + inicial + '</div>' +
                    '<div class="solicitacao-dados">' +
                        '<strong>' + nome + '</strong>' +
                        '<span>@' + usuario + '</span>' +
                        '<small>Solicitou acesso ao PMOBILE · ' + dataSolicitacao + '</small>' +
                    '</div>' +
                '</div>' +
                '<div class="solicitacao-facebook-nivel">' +
                    '<label>Nível de acesso</label>' +
                    '<div class="seletor-nivel-usuario-wrapper">' +
                        '<select id="nivelSolicitacao_' + solicitacao.id + '" class="seletor-nivel-usuario-nativo" aria-hidden="true" tabindex="-1">' +
                            '<option value="NIVEL2">Nível 2</option>' +
                            '<option value="ADMIN">Administrativo</option>' +
                        '</select>' +
                        '<button type="button" class="seletor-nivel-usuario" id="botaoNivelSolicitacao_' + solicitacao.id + '" onclick="alternarSeletorNivelUsuario(' + solicitacao.id + ')" aria-haspopup="listbox" aria-expanded="false">Nível 2</button>' +
                        '<div id="menuNivelSolicitacao_' + solicitacao.id + '" class="menu-nivel-usuario" role="listbox" style="display:none;">' +
                            '<button type="button" onclick="selecionarNivelUsuario(' + solicitacao.id + ', \'NIVEL2\')">Nível 2 — Pesquisa, Contagem manual e Divergências</button>' +
                            '<button type="button" onclick="selecionarNivelUsuario(' + solicitacao.id + ', \'ADMIN\')">Administrativo — acesso total</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="solicitacao-facebook-acoes">' +
                    '<button type="button" class="botao-aprovar-solicitacao" onclick="aprovarCadastroUsuario(' + solicitacao.id + ')">Aprovar</button>' +
                    '<button type="button" class="botao-recusar-solicitacao" onclick="recusarCadastroUsuario(' + solicitacao.id + ')">Recusar</button>' +
                '</div>' +
            '</article>';
        }).join("");

    } catch (erro) {
        console.error("Erro ao listar solicitações:", erro);
        lista.innerHTML =
            '<div class="solicitacao-vazia solicitacao-vazia-erro">' +
                '<span class="solicitacao-vazia-icone">!</span>' +
                '<strong>Não foi possível carregar</strong>' +
                '<p>Tente novamente em alguns instantes.</p>' +
            '</div>';
    }

}


function fecharGerenciamentoUsuarios() {

    const painel = document.getElementById("painelGerenciamentoUsuarios");
    const admin = document.getElementById("painelConfiguracoesAdmin");
    const conta = document.getElementById("painelConfiguracoesUsuario");

    if (painel) painel.style.display = "none";
    if (admin) admin.style.display = "block";
    if (conta) conta.style.display = "block";

}


function mostrarFiltroSolicitacoes(tipo) {

    const cadastro = document.getElementById("listaSolicitacoesCadastro");
    const reset = document.getElementById("listaSolicitacoesReset");
    const filtroCadastro = document.getElementById("filtroSolicitacoesCadastro");
    const filtroReset = document.getElementById("filtroSolicitacoesReset");

    const ehCadastro = tipo === "cadastro";

    if (cadastro) cadastro.style.display = ehCadastro ? "block" : "none";
    if (reset) reset.style.display = ehCadastro ? "none" : "block";

    if (filtroCadastro) filtroCadastro.classList.toggle("ativo", ehCadastro);
    if (filtroReset) filtroReset.classList.toggle("ativo", !ehCadastro);

}


function formatarDataSolicitacaoPmobile(valor) {

    if (!valor) return "agora";

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
        return String(valor);
    }

    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

}

function alternarSeletorNivelUsuario(solicitacaoId) {
    const menu = document.getElementById("menuNivelSolicitacao_" + solicitacaoId);
    const botao = document.getElementById("botaoNivelSolicitacao_" + solicitacaoId);
    if (!menu || !botao) return;

    const aberto = menu.style.display !== "none";
    menu.style.display = aberto ? "none" : "block";
    botao.setAttribute("aria-expanded", aberto ? "false" : "true");
}

function selecionarNivelUsuario(solicitacaoId, nivel) {
    const seletor = document.getElementById("nivelSolicitacao_" + solicitacaoId);
    const botao = document.getElementById("botaoNivelSolicitacao_" + solicitacaoId);
    const menu = document.getElementById("menuNivelSolicitacao_" + solicitacaoId);
    if (!seletor || !botao || !menu) return;

    seletor.value = nivel;
    botao.textContent = nivel === "ADMIN" ? "Administrativo" : "Nível 2";
    menu.style.display = "none";
    botao.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", function(evento) {
    document.querySelectorAll(".menu-nivel-usuario").forEach(function(menu) {
        const wrapper = menu.closest(".seletor-nivel-usuario-wrapper");
        if (wrapper && !wrapper.contains(evento.target)) {
            menu.style.display = "none";
            const botao = wrapper.querySelector(".seletor-nivel-usuario");
            if (botao) botao.setAttribute("aria-expanded", "false");
        }
    });
});

async function aprovarCadastroUsuario(solicitacaoId) {

    if (!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN" || !credencialPmobileAtual) return;

    const seletor = document.getElementById("nivelSolicitacao_" + solicitacaoId);
    const nivel = seletor ? seletor.value : "NIVEL2";

    if (!confirm("Aprovar este usuário como " + (nivel === "ADMIN" ? "ADMINISTRATIVO" : "NÍVEL 2") + "?")) return;

    try {
        const { data, error } = await window.clienteSupabase.rpc("aprovar_solicitacao_cadastro", {
            p_admin_usuario: window.usuarioPmobileAtual.usuario,
            p_admin_credencial: credencialPmobileAtual,
            p_solicitacao_id: solicitacaoId,
            p_nivel: nivel
        });

        if (error) throw error;

        const usuarioCriado = Array.isArray(data) ? data[0] : data;
        if (!usuarioCriado) throw new Error("O servidor não retornou o novo usuário.");

        alert("Usuário aprovado!\\n\\nUsuário: " + usuarioCriado.usuario +
            "\\nNível: " + usuarioCriado.nivel +
            "\\n\\nTOKEN DE ACESSO (copie agora):\\n" + usuarioCriado.token);

        await abrirGerenciamentoUsuarios();

    } catch (erro) {
        console.error("Erro ao aprovar usuário:", erro);
        alert(erro.message || "Não foi possível aprovar o usuário.");
    }

}


async function recusarCadastroUsuario(solicitacaoId) {

    if (!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN" || !credencialPmobileAtual) return;
    if (!confirm("Recusar esta solicitação de cadastro?")) return;

    try {
        const { error } = await window.clienteSupabase.rpc("recusar_solicitacao_cadastro", {
            p_admin_usuario: window.usuarioPmobileAtual.usuario,
            p_admin_credencial: credencialPmobileAtual,
            p_solicitacao_id: solicitacaoId,
            p_motivo: "Recusada pelo administrador"
        });

        if (error) throw error;
        await abrirGerenciamentoUsuarios();

    } catch (erro) {
        console.error("Erro ao recusar usuário:", erro);
        alert(erro.message || "Não foi possível recusar a solicitação.");
    }

}


function escapeHtmlPmobile(valor) {
    return String(valor == null ? "" : valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function abrirSolicitacoesResetToken() {

    if (!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN") {
        alert("Acesso administrativo negado.");
        return;
    }

    alert("Solicitações de recuperação de token serão exibidas nesta área na próxima etapa.");

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
// BOTÃO VOLTAR DO ANDROID
// ============================================================
//
// O PMOBILE usa navegação visual por telas, sem histórico
// de navegador. Por isso o botão físico/gestual do Android
// precisa ser tratado pelo plugin App do Capacitor.
//
// Ordem:
// 1. Subtela da Pesquisa -> menu da Pesquisa.
// 2. Qualquer módulo -> Home.
// 3. Home -> fecha o aplicativo.
//
// IMPORTANTE:
// Este listener é carregado no web layer para funcionar
// também quando o arquivo for atualizado via OTA.
// ============================================================

(function configurarBotaoVoltarAndroid() {

    const capacitor =
        window.Capacitor;

    const app =
        capacitor &&
        capacitor.Plugins &&
        capacitor.Plugins.App;

    if (
        !app ||
        typeof app.addListener !== "function"
    ) {

        return;

    }

    app.addListener(
        "backButton",
        function() {

            const aplicacao =
                document.getElementById(
                    "aplicacao"
                );

            const inicio =
                document.getElementById(
                    "inicio"
                );

            // Fora da aplicação: não interfere.
            if (
                !aplicacao ||
                aplicacao.style.display === "none"
            ) {

                return;

            }

            // Detalhes de Locais Vazios -> retorna para Locais.
            const detalhesLocaisVazios = document.getElementById("detalhesLocaisVazios");
            if (detalhesLocaisVazios && detalhesLocaisVazios.style.display !== "none") {
                if (typeof fecharDetalhesLocaisVazios === "function") {
                    fecharDetalhesLocaisVazios();
                }
                return;
            }

            // Pesquisa: como existe uma única tela de pesquisa,
            // o botão Voltar retorna diretamente para Home.
            const pesquisa =
                document.getElementById(
                    "pesquisa"
                );

            if (
                pesquisa &&
                pesquisa.style.display !== "none"
            ) {

                voltarMenu();
                return;

            }

            // Qualquer módulo principal retorna para Home.
            const home =
                document.getElementById(
                    "homeSistema"
                );

            if (
                home &&
                home.style.display === "block"
            ) {

                if (
                    typeof app.exitApp ===
                    "function"
                ) {

                    app.exitApp();

                }

                return;

            }

            voltarMenu();

        }
    );

})();


// ============================================================
// FIM - CONTROLE DE NAVEGAÇÃO DO PMOBILE
// ============================================================

// ============================================================
// RESTAURAÇÃO AUTOMÁTICA DO LOGIN
// ============================================================
//
// Executada depois que todo o web layer foi carregado.
// O IndexedDB permanece mesmo após:
//
// - fechar o aplicativo;
// - reiniciar o aparelho;
// - ficar sem internet;
// - receber uma nova OTA.
//
// ============================================================

function configurarValidacaoCampoUsuarioPmobile() {

    const campoUsuario =
        document.getElementById("loginUsuario");

    if (!campoUsuario || campoUsuario.dataset.pmobileUsuarioSanitizado === "true") {
        return;
    }

    campoUsuario.dataset.pmobileUsuarioSanitizado = "true";

    campoUsuario.addEventListener(
        "input",
        function() {
            sanitizarCampoUsuarioPmobile(campoUsuario);
        }
    );

    sanitizarCampoUsuarioPmobile(campoUsuario);

}

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        function() {
            configurarValidacaoCampoUsuarioPmobile();
            tentarRestaurarLoginPmobile();
        }
    );

} else {

    tentarRestaurarLoginPmobile();

}


window.PMOBILE_OK = true;
