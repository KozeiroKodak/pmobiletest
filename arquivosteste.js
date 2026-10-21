// ============================================================
// PMOBILE — ARQUIVOS DE TESTE
// ============================================================
//
// Área administrativa para armazenar arquivos brutos no Supabase
// sem restrição de extensão. O objetivo é permitir auditoria de
// formatos/arquivos que ainda não possuem fluxo definitivo.
//
// Limite por arquivo: 20 MB.
// ============================================================

const PMOBILE_ARQUIVOS_TESTE_LIMITE_BYTES = 20 * 1024 * 1024;

function validarAcessoArquivosTeste() {
    if (
        !window.usuarioPmobileAtual ||
        window.usuarioPmobileAtual.nivel !== "ADMIN" ||
        !window.credencialPmobileAtual
    ) {
        alert("Acesso administrativo negado.");
        return false;
    }

    return true;
}

function abrirArquivosTeste() {
    if (!validarAcessoArquivosTeste()) {
        return;
    }

    const admin = document.getElementById("painelConfiguracoesAdmin");
    const manutencao = document.getElementById("painelConfiguracoesManutencao");
    const usuarios = document.getElementById("painelGerenciamentoUsuarios");
    const arquivos = document.getElementById("painelArquivosTeste");
    const conta = document.getElementById("painelConfiguracoesUsuario");

    if (admin) admin.style.display = "none";
    if (manutencao) manutencao.style.display = "none";
    if (usuarios) usuarios.style.display = "none";
    if (conta) conta.style.display = "none";
    if (arquivos) arquivos.style.display = "block";

    listarArquivosTeste();
}

function fecharArquivosTeste() {
    const arquivos = document.getElementById("painelArquivosTeste");
    const admin = document.getElementById("painelConfiguracoesAdmin");
    const conta = document.getElementById("painelConfiguracoesUsuario");

    if (arquivos) arquivos.style.display = "none";
    if (admin) admin.style.display = "block";
    if (conta) conta.style.display = "block";
}

function calcularSha256PmobileArquivosTeste(buffer) {
    return crypto.subtle.digest("SHA-256", buffer).then(function(digest) {
        return Array.from(new Uint8Array(digest))
            .map(function(byte) {
                return byte.toString(16).padStart(2, "0");
            })
            .join("");
    });
}

function arrayBufferParaBase64Pmobile(buffer) {
    const bytes = new Uint8Array(buffer);
    const tamanhoBloco = 0x8000;
    let binario = "";

    for (let inicio = 0; inicio < bytes.length; inicio += tamanhoBloco) {
        const bloco = bytes.subarray(
            inicio,
            Math.min(inicio + tamanhoBloco, bytes.length)
        );

        binario += String.fromCharCode.apply(null, bloco);
    }

    return btoa(binario);
}

function formatarTamanhoArquivoTeste(bytes) {
    const tamanho = Number(bytes) || 0;

    if (tamanho < 1024) {
        return tamanho + " B";
    }

    if (tamanho < 1024 * 1024) {
        return (tamanho / 1024).toFixed(1) + " KB";
    }

    return (tamanho / (1024 * 1024)).toFixed(2) + " MB";
}

function formatarDataArquivoTeste(valor) {
    if (!valor) {
        return "—";
    }

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

async function importarArquivoTeste() {
    if (!validarAcessoArquivosTeste()) {
        return;
    }

    const input = document.getElementById("arquivoTeste");
    const status = document.getElementById("statusArquivosTeste");

    if (!input || !input.files || !input.files.length) {
        if (status) {
            status.textContent = "Selecione um arquivo.";
        }
        return;
    }

    const arquivo = input.files[0];

    if (arquivo.size < 1) {
        if (status) {
            status.textContent = "O arquivo está vazio.";
        }
        return;
    }

    if (arquivo.size > PMOBILE_ARQUIVOS_TESTE_LIMITE_BYTES) {
        if (status) {
            status.textContent = "O arquivo excede o limite de 20 MB.";
        }
        return;
    }

    if (status) {
        status.textContent = "Lendo arquivo e preparando envio...";
    }

    try {
        const buffer = await arquivo.arrayBuffer();
        const sha256 = await calcularSha256PmobileArquivosTeste(buffer);
        const conteudoBase64 = arrayBufferParaBase64Pmobile(buffer);

        const { data, error } = await window.clienteSupabase.rpc(
            "pmobile_arquivos_teste_inserir",
            {
                p_usuario: window.usuarioPmobileAtual.usuario,
                p_credencial: window.credencialPmobileAtual,
                p_arquivo_nome: arquivo.name,
                p_mime_type: arquivo.type || null,
                p_tamanho_bytes: arquivo.size,
                p_sha256: sha256,
                p_conteudo_base64: conteudoBase64
            }
        );

        if (error) {
            throw error;
        }

        if (status) {
            status.textContent =
                "Arquivo armazenado com sucesso. ID: " + String(data);
        }

        input.value = "";
        await listarArquivosTeste();

    } catch (erro) {
        console.error("Erro ao importar arquivo de teste:", erro);

        if (status) {
            status.textContent =
                "Não foi possível armazenar o arquivo: " +
                (erro && erro.message ? erro.message : String(erro));
        }
    }
}

async function listarArquivosTeste() {
    if (!validarAcessoArquivosTeste()) {
        return;
    }

    const lista = document.getElementById("listaArquivosTeste");

    if (!lista) {
        return;
    }

    lista.innerHTML = "<p>Carregando arquivos...</p>";

    try {
        const { data, error } = await window.clienteSupabase.rpc(
            "pmobile_arquivos_teste_listar",
            {
                p_usuario: window.usuarioPmobileAtual.usuario,
                p_credencial: window.credencialPmobileAtual
            }
        );

        if (error) {
            throw error;
        }

        const arquivos = Array.isArray(data) ? data : [];

        if (!arquivos.length) {
            lista.innerHTML = "<p>Nenhum arquivo de teste armazenado.</p>";
            return;
        }

        lista.innerHTML = arquivos.map(function(arquivo) {
            const nome = escapeHtmlPmobile(arquivo.arquivo_nome || "arquivo");
            const mime = escapeHtmlPmobile(arquivo.mime_type || "tipo não informado");
            const usuario = escapeHtmlPmobile(arquivo.usuario_nome || "—");
            const sha = escapeHtmlPmobile(arquivo.sha256 || "—");

            return (
                '<article class="arquivo-teste-card">' +
                    '<strong>' + nome + '</strong>' +
                    '<small>' + mime + ' · ' +
                        formatarTamanhoArquivoTeste(arquivo.tamanho_bytes) +
                    '</small>' +
                    '<small>Importado por ' + usuario + ' · ' +
                        formatarDataArquivoTeste(arquivo.criado_em) +
                    '</small>' +
                    '<code>' + sha + '</code>' +
                '</article>'
            );
        }).join("");

    } catch (erro) {
        console.error("Erro ao listar arquivos de teste:", erro);
        lista.innerHTML = "<p>Não foi possível carregar os arquivos.</p>";
    }
}

async function limparArquivosTeste() {
    if (!validarAcessoArquivosTeste()) {
        return;
    }

    const confirmar = window.confirm(
        "Apagar todos os arquivos de teste armazenados no Supabase?"
    );

    if (!confirmar) {
        return;
    }

    const status = document.getElementById("statusArquivosTeste");

    if (status) {
        status.textContent = "Limpando arquivos...";
    }

    try {
        const { data, error } = await window.clienteSupabase.rpc(
            "pmobile_arquivos_teste_limpar",
            {
                p_usuario: window.usuarioPmobileAtual.usuario,
                p_credencial: window.credencialPmobileAtual
            }
        );

        if (error) {
            throw error;
        }

        if (status) {
            status.textContent =
                String(data) + " arquivo(s) de teste removido(s).";
        }

        await listarArquivosTeste();

    } catch (erro) {
        console.error("Erro ao limpar arquivos de teste:", erro);

        if (status) {
            status.textContent =
                "Não foi possível limpar os arquivos: " +
                (erro && erro.message ? erro.message : String(erro));
        }
    }
}
