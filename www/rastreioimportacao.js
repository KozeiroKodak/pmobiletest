// PMOBILE - Importação manual de Rastreio
// Usa o mesmo padrão de leitura da Importação NF, mas transforma
// cada linha operacional em um rastreio independente.

const TAMANHO_LOTE_RASTREIO = 250;
let importacaoRastreioEmAndamento = false;
let dadosImportacaoRastreio = null;
let mapaMotoristasRastreio = {};
let importarSemMotoristaRastreio = true;

function obterSessaoRastreioImportacao() {
    const usuario =
        (typeof usuarioPmobileAtual !== "undefined" && usuarioPmobileAtual)
            ? usuarioPmobileAtual
            : window.usuarioPmobileAtual;

    const credencial =
        (typeof credencialPmobileAtual !== "undefined" && credencialPmobileAtual)
            ? credencialPmobileAtual
            : window.credencialPmobileAtual;

    if (!usuario?.usuario || !credencial) {
        throw new Error("Sessão do PMOBILE sem credencial disponível.");
    }

    return { usuario: usuario.usuario, credencial };
}

function abrirArquivoRastreio() {
    document.getElementById("arquivoRastreio")?.click();
}

function alternarImportacaoSemMotoristaRastreio(checkbox) {
    importarSemMotoristaRastreio = Boolean(checkbox?.checked);
    if (importarSemMotoristaRastreio) {
        mapaMotoristasRastreio = {};
    }
    if (dadosImportacaoRastreio) {
        if (modoAutomatico) {
            // Sincronização automática: não oferecer segunda importação manual.
            const previa = document.getElementById("rastreioImportacaoPrevia");
            if (previa) previa.replaceChildren();
        } else {
            renderizarPreviaImportacaoRastreio();
        }
    } else {
        montarMapaMotoristasUI();
    }
}

async function prepararImportacaoRastreio(arquivoExterno = null, modoAutomatico = false) {
    const arquivo =
        arquivoExterno ||
        document.getElementById("arquivoRastreio")?.files?.[0];

    if (!arquivo) return;

    if (typeof Worker === "undefined") {
        mostrarStatusImportacaoRastreio(
            "🔴 Este dispositivo não oferece Web Worker para processar a planilha com segurança."
        );
        return;
    }

    try {
        iniciarProgressoImportacaoRastreio();
        mostrarStatusImportacaoRastreio("🟡 Preparando leitura da planilha de Rastreio...");
        await new Promise(resolve => setTimeout(resolve, 0));

        // O ArrayBuffer é transferido para o Worker. Depois do postMessage,
        // a thread principal deixa de ser proprietária do buffer, evitando
        // manter uma segunda cópia enquanto o SheetJS processa a planilha.
        const buffer = await arquivo.arrayBuffer();
        // Links de compartilhamento do OneDrive podem devolver uma página de
        // login/visualização HTML em vez dos bytes do Excel.
        const cabecalho = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 512));
        const assinaturaZip = cabecalho.length >= 4 && cabecalho[0] === 0x50 && cabecalho[1] === 0x4b &&
            ((cabecalho[2] === 0x03 && cabecalho[3] === 0x04) || (cabecalho[2] === 0x05 && cabecalho[3] === 0x06));
        const assinaturaOle = cabecalho.length >= 8 && [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i) => cabecalho[i] === v);
        const inicioTexto = new TextDecoder("utf-8").decode(cabecalho).replace(/^\\uFEFF/, "").trimStart().toLowerCase();
        if (!assinaturaZip && !assinaturaOle && (/^(<!doctype\\s+html|<html|<head|<body|<table|<script)/.test(inicioTexto) || /<html[\\s>]/.test(inicioTexto.slice(0, 300)))) {
            throw new Error("O OneDrive devolveu uma página HTML, não o arquivo Excel. Verifique se o link permite baixar o arquivo diretamente.");
        }
        if (!buffer.byteLength) throw new Error("O arquivo recebido está vazio.");
        // XLSX/XLSM são ZIP (PK); XLS/XLSB podem usar contêiner OLE.
        // Nunca encaminhar HTML, JSON ou páginas de erro ao SheetJS.
        // CSV é permitido somente na importação manual, não na sincronização OneDrive.
        if (arquivoExterno && !assinaturaZip && !assinaturaOle) {
            const trecho = new TextDecoder("utf-8").decode(cabecalho).replace(/[\\r\\n\\t]+/g, " ").slice(0, 90);
            throw new Error("O download do OneDrive não retornou bytes de Excel (assinatura inválida). Conteúdo inicial: " + trecho.replace(/[<>]/g, "") + ". Verifique o link de download.");
        }
        const worker = new Worker("./rastreioimportacao.worker.js");

        const resultado = await new Promise((resolve, reject) => {
            let concluido = false;

            const finalizar = callback => valor => {
                if (concluido) return;
                concluido = true;
                try {
                    worker.terminate();
                } catch {}
                callback(valor);
            };

            worker.onmessage = evento => {
                const dados = evento.data || {};

                // Progresso é uma mensagem intermediária. Não pode passar por
                // finalizar(), pois finalizar() encerra o Worker. Antes, a
                // primeira atualização (8%) terminava o processador exatamente
                // antes do XLSX.read(), deixando a importação parada em 8%.
                if (dados.tipo === "progresso") {
                    mostrarStatusImportacaoRastreio(dados.mensagem || "🟡 Processando planilha...");
                    atualizarProgressoImportacaoRastreio(dados);
                    return;
                }

                if (dados.tipo === "resultado") {
                    finalizar(resolve)(dados.resultado);
                    return;
                }

                if (dados.tipo === "erro") {
                    finalizar(reject)(
                        new Error(dados.mensagem || "Não foi possível processar a planilha.")
                    );
                }
            };

            worker.onerror = finalizar(erro => {
                reject(
                    new Error(
                        erro?.message ||
                        "O processador da planilha não pôde ser iniciado."
                    )
                );
            });

            try {
                worker.postMessage(
                    {
                        buffer,
                        tamanhoBytes: arquivo.size,
                        nomeArquivo: arquivo.name
                    },
                    [buffer]
                );
            } catch (erro) {
                try {
                    worker.terminate();
                } catch {}
                reject(erro);
            }
        });

        const metadadosArquivo = {
            name: arquivo.name,
            size: arquivo.size
        };

        concluirProgressoImportacaoRastreio();

        dadosImportacaoRastreio = {
            arquivo: metadadosArquivo,
            nomeAba: resultado.nomeAba,
            colunas: resultado.colunas,
            linhas: resultado.linhas,
            deslocamentoLinha: resultado.deslocamentoLinha,
            sha256: resultado.sha256,
            tamanhoBytes: resultado.tamanhoBytes || arquivo.size,
            modelo: resultado.modelo,
            modeloIndices: resultado.modeloIndices
        };

        mapaMotoristasRastreio = montarMapaMotoristasInicial(
            resultado.linhas,
            resultado.modelo,
            resultado.modeloIndices
        );

        renderizarPreviaImportacaoRastreio();

        if (!modoAutomatico) mostrarStatusImportacaoRastreio(
            importarSemMotoristaRastreio
                ? "🟢 Planilha analisada. A importação será feita sem selecionar motorista."
                : "🟢 Planilha analisada. Revise os motoristas antes de enviar."
        );
    } catch (erro) {
        console.error("Erro ao preparar Rastreio:", erro);
        dadosImportacaoRastreio = null;
        mostrarStatusImportacaoRastreio(
            "🔴 " + (erro.message || "Não foi possível ler a planilha.")
        );
    }
}

// ============================================================
// LER PLANILHA COMPARTILHADA ONLINE
// Reaproveita a mesma leitura da Importação NF:
// Google Sheets/Drive são convertidos para download XLSX;
// Microsoft 365/SharePoint usa o proxy já existente no Supabase.
// ============================================================


const RASTREIO_ONEDRIVE_INTERVALO_PADRAO = 15000;
const RASTREIO_ONEDRIVE_STORAGE = "pmcoletas.rastreio.onedrive.sync.v1";
const RASTREIO_ONEDRIVE_CONFIG_STORAGE = "pmcoletas.rastreio.onedrive.config.v2";
let sincronizacaoOneDriveRastreioAtiva = false;
let sincronizacaoOneDriveRastreioTimer = null;
let sincronizacaoOneDriveRastreioExecutando = false;
let sincronizacaoOneDriveRastreioUrl = "";
let sincronizacaoOneDriveRastreioUltimaLinha = 0;
let sincronizacaoOneDriveRastreioVerificada = false;

function usuarioRastreioEhAdmin() {
    const usuario = (typeof usuarioPmobileAtual !== "undefined" && usuarioPmobileAtual)
        ? usuarioPmobileAtual : window.usuarioPmobileAtual;
    return String(usuario?.nivel || "").toUpperCase() === "ADMIN";
}
function obterConfiguracaoOneDriveRastreio() {
    try { return JSON.parse(localStorage.getItem(RASTREIO_ONEDRIVE_CONFIG_STORAGE) || "null") || null; } catch { return null; }
}
function salvarConfiguracaoOneDriveRastreio(configuracao) {
    try { localStorage.setItem(RASTREIO_ONEDRIVE_CONFIG_STORAGE, JSON.stringify(configuracao)); } catch {}
}
function salvarPreferenciasOneDriveRastreio() {
    const config = obterConfiguracaoOneDriveRastreio() || {};
    const campo = document.getElementById("linkOneDriveRastreio");
    config.url = campo?.value?.trim() || config.url || "";
    config.manterLink = true;
    config.tempoReal = document.getElementById("sincronizarAlteracoesOneDriveRastreio")?.checked !== false;
    config.intervalo = obterIntervaloOneDriveRastreio();
    config.ativo = sincronizacaoOneDriveRastreioAtiva;
    config.salvoEm = new Date().toISOString();
    if (config.manterLink && config.url) salvarConfiguracaoOneDriveRastreio(config);
    else if (!config.manterLink) limparConfiguracaoOneDriveRastreio();
}

function limparConfiguracaoOneDriveRastreio() {
    try { localStorage.removeItem(RASTREIO_ONEDRIVE_CONFIG_STORAGE); } catch {}
}
let ultimoAcessoAdminRastreio = null;
function atualizarAcessoAdminRastreio() {
    const permitido = usuarioRastreioEhAdmin();
    document.querySelectorAll(".rastreio-admin-only").forEach(el => { el.hidden = !permitido; });
    if (ultimoAcessoAdminRastreio === permitido) return;
    ultimoAcessoAdminRastreio = permitido;
    if (permitido) restaurarConfiguracaoOneDriveRastreio();
    else if (sincronizacaoOneDriveRastreioAtiva) pararSincronizacaoOneDriveRastreio();
}

let restaurandoLinkOneDriveServidor = false;
async function restaurarConfiguracaoOneDriveRastreio() {
    if (!usuarioRastreioEhAdmin() || restaurandoLinkOneDriveServidor) return;
    restaurandoLinkOneDriveServidor = true;
    try {
        const sessao = obterSessaoRastreioImportacao();
        const {data,error} = await window.clienteSupabase.rpc("pmobile_rastreio_config_link", {p_usuario:sessao.usuario,p_credencial:sessao.credencial});
        if (error) throw error;
        const campo = document.getElementById("linkOneDriveRastreio");
        if (campo && data) campo.value = data;
        const config = obterConfiguracaoOneDriveRastreio();
        if (data && config?.ativo && !sincronizacaoOneDriveRastreioAtiva) iniciarSincronizacaoOneDriveRastreio(true);
    } catch (erro) { console.warn("Não foi possível carregar link OneDrive do Supabase:", erro); }
    finally { restaurandoLinkOneDriveServidor = false; }
}
async function salvarLinkOneDriveRastreioSupabase() {
    if (!usuarioRastreioEhAdmin()) return mostrarStatusOneDriveRastreio("Somente administradores podem salvar o link.");
    const url = document.getElementById("linkOneDriveRastreio")?.value?.trim();
    if (!url) return mostrarStatusOneDriveRastreio("Informe o link do OneDrive.");
    try {
        const sessao = obterSessaoRastreioImportacao();
        const {error} = await window.clienteSupabase.rpc("pmobile_rastreio_config_link",{p_usuario:sessao.usuario,p_credencial:sessao.credencial,p_url:url});
        if (error) throw error;
        salvarConfiguracaoOneDriveRastreio({...obterConfiguracaoOneDriveRastreio(),url,manterLink:true,intervalo:15000,tempoReal:true,ativo:sincronizacaoOneDriveRastreioAtiva});
        mostrarStatusOneDriveRastreio("🟢 Link salvo no Supabase. Disponível aos administradores.");
    } catch(erro) { mostrarStatusOneDriveRastreio("🔴 Falha ao salvar link: "+(erro.message||erro)); }
}

function obterEstadoSincronizacaoOneDriveRastreio(url) {
    try {
        const bruto = localStorage.getItem(RASTREIO_ONEDRIVE_STORAGE);
        const estados = bruto ? JSON.parse(bruto) : {};
        return estados[url] || null;
    } catch {
        return null;
    }
}

function salvarEstadoSincronizacaoOneDriveRastreio(url, estado) {
    try {
        const bruto = localStorage.getItem(RASTREIO_ONEDRIVE_STORAGE);
        const estados = bruto ? JSON.parse(bruto) : {};
        estados[url] = estado;
        localStorage.setItem(RASTREIO_ONEDRIVE_STORAGE, JSON.stringify(estados));
    } catch (erro) {
        console.warn("Não foi possível salvar o estado da sincronização OneDrive:", erro);
    }
}

function obterIntervaloOneDriveRastreio() { return 15000; }

function mostrarStatusOneDriveRastreio(mensagem) {
    const area = document.getElementById("statusOneDriveRastreio");
    if (area) area.textContent = mensagem;
    window.estadoOneDriveRastreio = { ...(window.estadoOneDriveRastreio || {}), mensagem, atualizadoEm: Date.now() };
}

function atualizarIndicadorOneDriveRastreio(ativo, estado = null) {
    const indicador = document.getElementById("indicadorOneDriveRastreio");
    if (!indicador) return;

    indicador.classList.remove("ativo", "conectando", "erro", "conectado");

    if (!ativo) {
        indicador.textContent = "○ Sincronização parada";
        return;
    }

    if (estado === "erro") {
        window.estadoOneDriveRastreio = { estado: "erro", atualizadoEm: Date.now() };
        indicador.textContent = "● Falha na sincronização";
        indicador.classList.add("erro");
        return;
    }

    if (!sincronizacaoOneDriveRastreioVerificada) {
        indicador.textContent = "● Verificando OneDrive...";
        indicador.classList.add("conectando");
        return;
    }

    window.estadoOneDriveRastreio = { estado: "conectado", atualizadoEm: Date.now() };
    indicador.textContent = "● OneDrive conectado";
    indicador.classList.add("ativo", "conectado");
}

function agendarProximaSincronizacaoOneDriveRastreio() {
    if (!sincronizacaoOneDriveRastreioAtiva) return;

    clearTimeout(sincronizacaoOneDriveRastreioTimer);
    sincronizacaoOneDriveRastreioTimer = setTimeout(
        () => sincronizarOneDriveRastreio(),
        obterIntervaloOneDriveRastreio()
    );
}

function iniciarSincronizacaoOneDriveRastreio(restaurando = false) {
    if (!usuarioRastreioEhAdmin()) {
        mostrarStatusOneDriveRastreio("🔒 Recurso disponível somente para administradores.");
        return;
    }
    const campo = document.getElementById("linkOneDriveRastreio");
    const url = campo?.value?.trim();
    if (!url) { mostrarStatusOneDriveRastreio("🔴 Informe o link compartilhado do arquivo Excel no OneDrive."); return; }
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (!(host === "1drv.ms" || host === "onedrive.live.com" || host.endsWith(".onedrive.live.com") || host.endsWith(".sharepoint.com"))) {
            throw new Error("Use um link compartilhado do OneDrive/SharePoint.");
        }
    } catch (erro) { mostrarStatusOneDriveRastreio("🔴 " + (erro.message || "Link inválido.")); return; }

    sincronizacaoOneDriveRastreioUrl = url;
    const estado = obterEstadoSincronizacaoOneDriveRastreio(url);
    sincronizacaoOneDriveRastreioUltimaLinha = Number(estado?.ultimaLinha || 0);
    sincronizacaoOneDriveRastreioVerificada = false;
    sincronizacaoOneDriveRastreioAtiva = true;

    const configuracaoAtual = {
        url,
        manterLink: true,
        tempoReal: document.getElementById("sincronizarAlteracoesOneDriveRastreio")?.checked !== false,
        intervalo: obterIntervaloOneDriveRastreio(),
        ativo: true,
        salvoEm: new Date().toISOString()
    };

    if (configuracaoAtual.manterLink) {
        salvarConfiguracaoOneDriveRastreio(configuracaoAtual);
    } else {
        limparConfiguracaoOneDriveRastreio();
    }

    atualizarIndicadorOneDriveRastreio(true);
    mostrarStatusOneDriveRastreio(restaurando
        ? "🟡 Restaurando sincronização do OneDrive..."
        : sincronizacaoOneDriveRastreioUltimaLinha > 0
            ? "🟢 Sincronização reativada. Verificando a planilha..."
            : "🟡 Primeiro acesso: lendo a planilha para criar a linha de base...");
    sincronizarOneDriveRastreio();
}

function pararSincronizacaoOneDriveRastreio() {
    sincronizacaoOneDriveRastreioAtiva = false;
    sincronizacaoOneDriveRastreioVerificada = false;
    clearTimeout(sincronizacaoOneDriveRastreioTimer);
    sincronizacaoOneDriveRastreioTimer = null;
    const config = obterConfiguracaoOneDriveRastreio();
    if (config?.manterLink && config.url) {
        config.ativo = false;
        salvarConfiguracaoOneDriveRastreio(config);
    } else {
        limparConfiguracaoOneDriveRastreio();
    }
    atualizarIndicadorOneDriveRastreio(false);
    mostrarStatusOneDriveRastreio("○ Sincronização parada.");
}

function limparLinhaBaseOneDriveRastreio() {
    if (!usuarioRastreioEhAdmin()) { mostrarStatusOneDriveRastreio("🔒 Apenas administradores podem alterar a linha de base."); return; }
    if (!sincronizacaoOneDriveRastreioUrl) return;
    try {
        const bruto = localStorage.getItem(RASTREIO_ONEDRIVE_STORAGE);
        const estados = bruto ? JSON.parse(bruto) : {};
        delete estados[sincronizacaoOneDriveRastreioUrl];
        localStorage.setItem(RASTREIO_ONEDRIVE_STORAGE, JSON.stringify(estados));
    } catch {}
    sincronizacaoOneDriveRastreioUltimaLinha = 0;
    mostrarStatusOneDriveRastreio("🟡 Linha de base apagada. A próxima leitura criará uma nova.");
}

async function baixarPlanilhaOneDriveRastreio(url) {
    const nomePadrao = "Planilha de Frete Online";

    // OneDrive pessoal e empresarial: usar primeiro o proxy Supabase,
    // evitando CORS e diferenças entre WebView e navegador.
    // Se a rede/proxy falhar no APK, tentar a ponte nativa.
    let erroProxy = null;
    if (window.clienteSupabase?.functions?.invoke) {
        try {
            mostrarStatusOneDriveRastreio("🟡 Baixando planilha pelo Supabase...");
            const { data, error } = await window.clienteSupabase.functions.invoke(
                "pmobile-rastreio-download", { body: { url } }
            );
            if (error) {
                let mensagem = error.message || "Falha ao baixar pelo Supabase.";
                if (error.context?.json) {
                    try { const detalhe = await error.context.json(); mensagem = detalhe?.error || mensagem; } catch {}
                }
                throw new Error(mensagem);
            }
            if (!data) throw new Error("O Supabase não retornou a planilha.");
            const blob = data instanceof Blob ? data : new Blob([data]);
            if (!blob.size) throw new Error("O arquivo recebido está vazio.");
            const assinatura = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
            const zip = assinatura[0] === 0x50 && assinatura[1] === 0x4b;
            const ole = assinatura[0] === 0xd0 && assinatura[1] === 0xcf;
            if (!zip && !ole) {
                throw new Error("O OneDrive retornou uma página ou resposta inválida, não um Excel. Confira o acesso ao link compartilhado.");
            }
            mostrarStatusOneDriveRastreio("🟢 Download pelo Supabase concluído.");
            return new File([blob], nomePadrao, { type: "application/octet-stream" });
        } catch (erro) {
            erroProxy = erro;
            const mensagem = String(erro?.message || erro);
            // Erros de autorização/HTML não são falhas de rede: o fallback
            // nativo repetiria o mesmo acesso e esconderia o diagnóstico.
            if (!window.PMCOLETAS_ONEDRIVE?.iniciarDownload ||
                /HTTP\\s*(401|403)|login|autentica|permiss/i.test(mensagem)) {
                throw erro;
            }
            console.warn("Proxy OneDrive indisponível; tentando ponte nativa:", erro);
        }
    }
    // A ponte nativa é alternativa somente no APK.
    if (window.PMCOLETAS_ONEDRIVE?.iniciarDownload) {
        const iniciar = JSON.parse(
            window.PMCOLETAS_ONEDRIVE.iniciarDownload(url)
        );

        if (!iniciar.ok || !iniciar.id) {
            throw new Error(
                iniciar.error || "Não foi possível iniciar o download nativo do OneDrive."
            );
        }

        const id = iniciar.id;
        let status = null;
        const limiteEspera = Date.now() + 300000;

        try {
            while (Date.now() < limiteEspera) {
                status = JSON.parse(
                    window.PMCOLETAS_ONEDRIVE.obterStatus(id)
                );

                if (!status.ok) {
                    throw new Error(
                        status.error || "Não foi possível consultar o download do OneDrive."
                    );
                }

                if (status.status === "completed") break;

                if (status.status === "error") {
                    throw new Error(
                        status.error || "O download nativo do OneDrive falhou."
                    );
                }

                if (status.totalBytes > 0) {
                    const percentual = Math.min(
                        100,
                        Math.round(
                            (status.downloadedBytes / status.totalBytes) * 100
                        )
                    );

                    mostrarStatusOneDriveRastreio(
                        "🟡 Baixando do OneDrive: " + percentual + "%"
                    );
                } else {
                    mostrarStatusOneDriveRastreio(
                        "🟡 Baixando a planilha do OneDrive..."
                    );
                }

                await new Promise(resolve => setTimeout(resolve, 400));
            }

            if (!status || status.status !== "completed") {
                throw new Error(
                    "Tempo limite ao baixar a planilha do OneDrive."
                );
            }

            // O download terminou: fechar o progresso em 100% antes de
            // entregar o arquivo ao parser da planilha.
            mostrarStatusOneDriveRastreio("🟢 Download do OneDrive concluído: 100%");
            await new Promise(resolve => setTimeout(resolve, 150));

            const partes = [];
            let offset = 0;
            let tamanhoTotal = 0;

            while (true) {
                const respostaChunk = JSON.parse(
                    window.PMCOLETAS_ONEDRIVE.obterChunk(id, offset)
                );

                if (!respostaChunk.ok) {
                    throw new Error(
                        respostaChunk.error ||
                        "Não foi possível ler o arquivo baixado."
                    );
                }

                if (respostaChunk.base64) {
                    const binario = atob(respostaChunk.base64);
                    const bytes = new Uint8Array(binario.length);

                    for (let indice = 0; indice < binario.length; indice++) {
                        bytes[indice] = binario.charCodeAt(indice);
                    }

                    partes.push(bytes);
                    tamanhoTotal += bytes.length;
                }

                offset = Number(respostaChunk.nextOffset || offset);

                if (respostaChunk.done) break;
            }

            // Não criamos uma segunda Uint8Array gigante para concatenar os
            // chunks. O Blob/File aceita as partes diretamente, reduzindo o
            // pico de memória antes do parser assumir o arquivo.
            let nome = nomePadrao;

            try {
                const parsed = new URL(url);
                const nomeUrl = decodeURIComponent(
                    parsed.pathname.split("/").pop() || ""
                );

                if (/\.(xlsx?|xlsm|xlsb)$/i.test(nomeUrl)) {
                    nome = nomeUrl;
                }
            } catch {}

            mostrarStatusOneDriveRastreio("🟢 Download do OneDrive concluído: 100%");

            const arquivoNativo = new File(partes, nome, { type: "application/octet-stream" });
            const inicio = new Uint8Array(await arquivoNativo.slice(0, 8).arrayBuffer());
            const excelZip = inicio[0] === 0x50 && inicio[1] === 0x4b;
            const excelOle = inicio[0] === 0xd0 && inicio[1] === 0xcf;
            if (!excelZip && !excelOle) {
                throw new Error("Download nativo não retornou Excel (possível página HTML do OneDrive).");
            }
            return arquivoNativo;
        } catch (erro) {
            try {
                window.PMCOLETAS_ONEDRIVE.cancelarDownload(id);
            } catch {}
            throw erro;
        }
    }

    throw erroProxy || new Error("Download indisponível: conexão com o Supabase não encontrada.");
}

async function sincronizarOneDriveRastreio(forcar = false) {
    if (!usuarioRastreioEhAdmin() || sincronizacaoOneDriveRastreioExecutando) return;

    if (!sincronizacaoOneDriveRastreioUrl) {
        const campo = document.getElementById("linkOneDriveRastreio");
        sincronizacaoOneDriveRastreioUrl = campo?.value?.trim() || "";
    }

    if (!sincronizacaoOneDriveRastreioUrl) {
        mostrarStatusOneDriveRastreio("🔴 Informe o link compartilhado do arquivo Excel do OneDrive.");
        return;
    }

    if (!sincronizacaoOneDriveRastreioAtiva && !forcar) return;

    sincronizacaoOneDriveRastreioExecutando = true;
    try {
        const arquivo = await baixarPlanilhaOneDriveRastreio(sincronizacaoOneDriveRastreioUrl);
        await prepararImportacaoRastreio(arquivo, true);
        if (!dadosImportacaoRastreio) throw new Error("A planilha não pôde ser analisada.");

        const url = sincronizacaoOneDriveRastreioUrl;
        const estadoAnterior = obterEstadoSincronizacaoOneDriveRastreio(url);
        const hashAtual = dadosImportacaoRastreio.sha256 || null;
        // Se a rotina foi parada durante o download, não aplicar o resultado atrasado.
        if (!forcar && !sincronizacaoOneDriveRastreioAtiva) {
            mostrarStatusOneDriveRastreio("○ Sincronização interrompida antes do envio ao banco.");
            return;
        }

        if (!forcar && estadoAnterior?.sha256 && hashAtual && estadoAnterior.sha256 === hashAtual) {
            sincronizacaoOneDriveRastreioVerificada = true;
            atualizarIndicadorOneDriveRastreio(true);
            mostrarStatusOneDriveRastreio("🟢 OneDrive conectado · nenhuma alteração detectada · " + new Date().toLocaleTimeString("pt-BR"));
            if (sincronizacaoOneDriveRastreioAtiva) {
                agendarProximaSincronizacaoOneDriveRastreio();
            }
            return;
        }

        const tempoReal =
            document.getElementById("sincronizarAlteracoesOneDriveRastreio")?.checked !== false;

        if (estadoAnterior && !tempoReal) {
            sincronizacaoOneDriveRastreioVerificada = true;
            atualizarIndicadorOneDriveRastreio(true);
            mostrarStatusOneDriveRastreio(
                "🟢 OneDrive conectado · alterações da planilha estão pausadas. " +
                "Ative a opção para aplicar as alterações pendentes."
            );
            if (sincronizacaoOneDriveRastreioAtiva) {
                agendarProximaSincronizacaoOneDriveRastreio();
            }
            return;
        }

        const lotePreparado = prepararLinhasRastreioParaEnvio(0, dadosImportacaoRastreio.linhas.length, true);
        const totalAnterior = Number(estadoAnterior?.totalLinhas || 0);
        const totalNovo = lotePreparado.resultado.length;
        if (!totalNovo) {
            throw new Error("A planilha não contém lançamentos válidos. A base anterior foi preservada.");
        }
        if (totalAnterior >= 100 && totalNovo < totalAnterior) {
            const removidos = totalAnterior - totalNovo;
            const limiteSeguro = Math.max(25, Math.ceil(totalAnterior * 0.03));
            if (removidos > limiteSeguro) {
                throw new Error("A planilha perdeu " + removidos.toLocaleString("pt-BR") +
                    " linhas desde a última sincronização. Alteração grande bloqueada para evitar perda de dados.");
            }
        }
        const sessao = obterSessaoRastreioImportacao();
        const chave = await calcularChaveFonteOneDriveRastreio(url);

        // O RPC v2 valida a planilha e grava em uma única transação PostgreSQL.
        // Evita repetir a transferência de milhares de linhas em dois RPCs.
        if (!forcar && !sincronizacaoOneDriveRastreioAtiva) {
            mostrarStatusOneDriveRastreio("○ Sincronização parada antes da gravação.");
            return;
        }
        mostrarStatusOneDriveRastreio("🟡 Validando e sincronizando rastreios com segurança...");
        const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_sincronizar_fonte_v2", {
            p_usuario: sessao.usuario,
            p_credencial: sessao.credencial,
            p_chave: chave,
            p_url: url,
            p_arquivo_nome: dadosImportacaoRastreio.arquivo.name,
            p_sha256: hashAtual,
            p_linhas: lotePreparado.resultado,
            p_substituir: false
        });
        if (resposta.error) throw resposta.error;

        // Grava a coluna O (% FINAL) pelo identificador estável da linha e NF.
        // O RPC principal mantém a mesma identidade do rastreio e de sua entrega.
        const percentuais = lotePreparado.resultado.map(item => ({
            linha_origem: item.linha_origem,
            notas_fiscais: item.notas_fiscais,
            percentual_final: item.percentual_final
        }));
        const valoresPercentuais = await window.clienteSupabase.rpc("pmobile_rastreio_aplicar_percentuais_fonte", {
            p_usuario: sessao.usuario,
            p_credencial: sessao.credencial,
            p_chave: chave,
            p_linhas: percentuais
        });
        if (valoresPercentuais.error) throw valoresPercentuais.error;
        await salvarValoresTotalPlanilha();

        const resultado = Array.isArray(resposta.data) ? resposta.data[0] : resposta.data;
        const ultimaLinhaAtual = (Number(dadosImportacaoRastreio.deslocamentoLinha) || 2) + dadosImportacaoRastreio.linhas.length - 1;
        salvarEstadoSincronizacaoOneDriveRastreio(url, {
            ultimaLinha: ultimaLinhaAtual,
            totalLinhas: totalNovo,
            sha256: hashAtual,
            atualizadoEm: new Date().toISOString()
        });
        sincronizacaoOneDriveRastreioUltimaLinha = ultimaLinhaAtual;
        sincronizacaoOneDriveRastreioVerificada = true;
        atualizarIndicadorOneDriveRastreio(true);

        mostrarStatusOneDriveRastreio(
            "🟢 OneDrive conectado · " +
            Number(resultado?.novas || 0).toLocaleString("pt-BR") + " novas · " +
            Number(resultado?.alteradas || 0).toLocaleString("pt-BR") + " alteradas · " +
            Number(resultado?.removidas || 0).toLocaleString("pt-BR") + " removidas."
        );
        if (typeof carregarRastreios === "function") await carregarRastreios();
        if (sincronizacaoOneDriveRastreioAtiva) {
            agendarProximaSincronizacaoOneDriveRastreio();
        }
    } catch (erro) {
        console.error("Erro na sincronização OneDrive do Rastreio:", erro);
        sincronizacaoOneDriveRastreioVerificada = false;
        atualizarIndicadorOneDriveRastreio(sincronizacaoOneDriveRastreioAtiva, "erro");
        mostrarStatusOneDriveRastreio("🔴 Falha na sincronização: " + (erro.message || "erro desconhecido"));

        // Falhas transitórias não podem matar a sincronização automática.
        // O próximo ciclo é agendado somente quando a sincronização continua ativa.
        if (sincronizacaoOneDriveRastreioAtiva) {
            agendarProximaSincronizacaoOneDriveRastreio();
        }
    } finally {
        sincronizacaoOneDriveRastreioExecutando = false;
    }
}

async function calcularChaveFonteOneDriveRastreio(url) {
    const texto = String(url || "").trim().toLowerCase();
    if (!texto) throw new Error("Link do OneDrive inválido.");
    if (window.crypto?.subtle) {
        const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return texto;
}

async function limparTodosDadosRastreio() {
    if (!usuarioRastreioEhAdmin()) {
        mostrarStatusOneDriveRastreio("🔒 Apenas administradores podem limpar os dados.");
        return;
    }
    if (!window.confirm("ATENÇÃO! Isso apagará TODOS os rastreios, histórico, importações e fontes de sincronização. Esta ação não pode ser desfeita. Continuar?")) return;

    try {
        const sessao = obterSessaoRastreioImportacao();
        const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_limpar_todos_dados", {
            p_usuario: sessao.usuario,
            p_credencial: sessao.credencial
        });
        if (resposta.error) throw resposta.error;

        pararSincronizacaoOneDriveRastreio();
        limparConfiguracaoOneDriveRastreio();
        localStorage.removeItem(RASTREIO_ONEDRIVE_STORAGE);
        const campo = document.getElementById("linkOneDriveRastreio");
        const manter = document.getElementById("manterLinkOneDriveRastreio");
        if (campo) campo.value = "";
        if (manter) manter.checked = false;
        if (typeof carregarRastreios === "function") await carregarRastreios();
        mostrarStatusOneDriveRastreio("🟢 Todos os dados de Rastreio foram limpos. Uma nova planilha pode ser cadastrada.");
    } catch (erro) {
        mostrarStatusOneDriveRastreio("🔴 Não foi possível limpar os dados: " + (erro.message || "erro desconhecido"));
    }
}


function normalizarUrlPlanilhaOnlineRastreio(urlInformada) {
    let url;

    try {
        url = new URL(urlInformada);
    } catch {
        throw new Error("O link informado não é uma URL válida.");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("O link deve começar com http:// ou https://.");
    }

    const host = url.hostname.toLowerCase();

    const matchGoogle = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)/);

    if (
        (host === "docs.google.com" || host === "sheets.google.com") &&
        matchGoogle
    ) {
        return (
            "https://docs.google.com/spreadsheets/d/" +
            encodeURIComponent(matchGoogle[1]) +
            "/export?format=xlsx"
        );
    }

    const matchDrive = url.pathname.match(/^\/file\/d\/([^/]+)/);

    if (host === "drive.google.com" && matchDrive) {
        return (
            "https://drive.google.com/uc?export=download&id=" +
            encodeURIComponent(matchDrive[1])
        );
    }

    if (
        host === "1drv.ms" ||
        host === "onedrive.live.com" ||
        host.endsWith(".onedrive.live.com") ||
        host === "automotivacba-my.sharepoint.com"
    ) {
        if (url.pathname.startsWith("/:x:/g/")) {
            url.search = "?download=1";
            return url.toString();
        }

        url.searchParams.set("download", "1");
        return url.toString();
    }

    return url.toString();
}

function obterNomeArquivoOnlineRastreio(resposta, url) {
    const disposicao = resposta.headers.get("content-disposition");

    const nomeHeader = disposicao?.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/
    )?.[1];

    if (nomeHeader) {
        try {
            return decodeURIComponent(nomeHeader).trim();
        } catch {
            return nomeHeader.trim();
        }
    }

    try {
        const pathname = new URL(url).pathname;
        const nome = decodeURIComponent(
            pathname.split("/").pop() || ""
        ).trim();

        if (nome && /\.(xlsx?|xlsm|xlsb|csv)$/i.test(nome)) {
            return nome;
        }
    } catch {
        // usa o nome padrão
    }

    return "planilha-online.xlsx";
}

function normalizarChaveRastreio(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

function normalizarColunasRastreio(cabecalho) {
    const usados = new Set();

    return cabecalho.map((valor, indice) => {
        let nome = String(valor ?? "").trim();
        if (!nome) nome = "COLUNA_" + (indice + 1);

        const base = nome;
        let contador = 2;
        while (usados.has(nome)) nome = base + "_" + contador++;
        usados.add(nome);
        return nome;
    });
}

function detectarModeloRastreio(colunas) {
    const porChave = {};
    colunas.forEach(c => porChave[normalizarChaveRastreio(c)] = c);

    const achar = (...nomes) => {
        for (const nome of nomes) {
            const encontrado = porChave[normalizarChaveRastreio(nome)];
            if (encontrado) return encontrado;
        }
        return null;
    };

    return {
        cliente: achar(
            "Cliente",
            "Destinatário",
            "Cliente / Destinatário",
            "Cliente Destinatário"
        ),
        notaFiscal: achar(
            "Nota Fiscal",
            "NF",
            "Notas Fiscais",
            "Nº NF",
            "N° NF",
            "Numero NF",
            "Número NF",
            "Nº Nota Fiscal",
            "N° Nota Fiscal"
        ),
        transportadora: achar("Transportadora", "Transportador"),
        motorista: achar("Motorista"),
        regiao: achar("Região", "Regiao", "Cidade", "Destino"),
        volume: achar("Volume", "Volumes"),
        peso: achar("Peso"),
        valorNF: achar("Valor NF", "Valor"),
        valorFreteEmbutido: achar("Valor Frete Embutido", "Frete Embutido", "Frete Imbutido", "Valor Frete Imbutido"),
        valorFrete: achar("Frete Transporte", "Valor Frete", "Frete Transportadora", "Valor do Frete", "Frete"),
        custoNunes: achar("Custo Nunes", "Custo Nunes:"),
        custoFinal: achar("Custo Final"),
        percentualFinal: achar("% Final", "Percentual Final", "Porcentagem Final"),
        dataEnvio: achar("Data Envio", "Data de Envio"),
        turno: achar("Turno Envio", "Turno")
    };
}

function chaveNotaFiscalRastreio(valor) {
    return String(valor ?? "")
        .trim()
        .replace(/\\s+/g, " ")
        .toUpperCase();
}

function montarMapaMotoristasInicial(linhas, modelo, modeloIndices) {
    const mapa = {};
    if (modelo.motorista) return mapa;

    const indiceNotaFiscal = modeloIndices?.notaFiscal ?? -1;
    linhas.forEach(valores => {
        const notaFiscal = indiceNotaFiscal >= 0
            ? String(valores?.[indiceNotaFiscal] ?? "").trim()
            : "";
        const chave = chaveNotaFiscalRastreio(notaFiscal);
        if (chave && !(chave in mapa)) mapa[chave] = "";
    });

    return mapa;
}

function montarMapaMotoristasUI() {
    const area = document.getElementById("rastreioMapaMotoristas");
    if (!area || !dadosImportacaoRastreio) return;

    const modelo = dadosImportacaoRastreio.modelo;

    if (importarSemMotoristaRastreio) {
        area.innerHTML = '<div class="rastreio-importacao-aviso">✓ Opção ativa: os rastreios serão importados sem selecionar motorista.</div>';
        return;
    }

    if (modelo.motorista) {
        area.innerHTML =
            '<div class="rastreio-importacao-aviso">✓ A planilha já possui a coluna <strong>Motorista</strong>. Nenhum preenchimento adicional é necessário.</div>';
        return;
    }

    const notasFiscais = Object.keys(mapaMotoristasRastreio);

    if (!notasFiscais.length) {
        area.innerHTML =
            '<div class="rastreio-importacao-aviso">Não foi encontrada nenhuma Nota Fiscal válida para montar o vínculo de motorista.</div>';
        return;
    }

    const indiceNotaFiscal = dadosImportacaoRastreio.modeloIndices?.notaFiscal ?? -1;

    const indiceCliente = dadosImportacaoRastreio.modeloIndices?.cliente ?? -1;
    const nomesNotas = new Map();
    const clientesNotas = new Map();
    dadosImportacaoRastreio.linhas.forEach(valores => {
        const nota = indiceNotaFiscal >= 0
            ? String(valores?.[indiceNotaFiscal] ?? "").trim()
            : "";
        const cliente = indiceCliente >= 0
            ? String(valores?.[indiceCliente] ?? "").trim()
            : "";
        const chave = chaveNotaFiscalRastreio(nota);
        if (chave && !nomesNotas.has(chave)) {
            nomesNotas.set(chave, nota);
            clientesNotas.set(chave, cliente);
        }
    });

    area.innerHTML =
        '<div class="rastreio-importacao-motoristas-titulo">' +
            '<strong>Motorista por Nota Fiscal</strong>' +
            '<span>Defina o motorista uma vez. O PMOBILE aplicará o vínculo a todas as linhas da mesma NF.</span>' +
        '</div>' +
        '<div class="rastreio-importacao-motoristas-lista">' +
            notasFiscais.map(chave => {
                const nota = nomesNotas.get(chave) || chave;
                const cliente = clientesNotas.get(chave) || "Cliente não informado";
                return '<label>' +
                    '<span class="rastreio-importacao-nf-cliente">' +
                        '<strong>' + escaparHtmlRastreio(nota) + '</strong>' +
                        '<em> - ' + escaparHtmlRastreio(cliente) + '</em>' +
                    '</span>' +
                    '<input type="text" readonly data-nf-motorista="' + escaparHtmlRastreio(chave) + '"' +
                        ' value="' + escaparHtmlRastreio(mapaMotoristasRastreio[chave]) + '"' +
                        ' placeholder="Selecione o motorista"' +
                        ' aria-label="Motorista da Nota Fiscal ' + escaparHtmlRastreio(nota) + '"' +
                        ' onclick="abrirEditorMotoristaRastreio(this)">' +
                '</label>';
            }).join("") +
        '</div>';
}

function fecharEditorMotoristaRastreio() {
    const modal = document.getElementById("rastreioEditorMotorista");
    if (!modal) return;
    modal.classList.remove("aberto");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("rastreio-modal-aberto");
}

function salvarEditorMotoristaRastreio() {
    const modal = document.getElementById("rastreioEditorMotorista");
    const campo = document.getElementById("rastreioEditorMotoristaInput");
    const chave = modal?.dataset?.alvo || "";
    const alvo = chave
        ? document.querySelector('[data-nf-motorista="' + CSS.escape(chave) + '"]')
        : null;

    if (!modal || !campo || !alvo) return;

    const nome = campo.value.trim();
    mapaMotoristasRastreio[chave] = nome;
    alvo.value = nome;
    fecharEditorMotoristaRastreio();
    renderizarPreviaImportacaoRastreio();
}

function abrirEditorMotoristaRastreio(input) {
    const chave = input?.dataset?.nfMotorista;
    if (!chave) return;

    let modal = document.getElementById("rastreioEditorMotorista");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "rastreioEditorMotorista";
        modal.className = "rastreio-editor-motorista";
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML =
            '<div class="rastreio-editor-motorista-fundo" data-fechar-rastreio-editor></div>' +
            '<div class="rastreio-editor-motorista-dialog" role="dialog" aria-modal="true" aria-labelledby="rastreioEditorMotoristaTitulo">' +
                '<div class="rastreio-editor-motorista-cabecalho">' +
                    '<div>' +
                        '<span class="rastreio-editor-motorista-kicker">VÍNCULO OPERACIONAL</span>' +
                        '<h3 id="rastreioEditorMotoristaTitulo">Motorista da Nota Fiscal</h3>' +
                        '<p id="rastreioEditorMotoristaRegiao"></p>' +
                    '</div>' +
                    '<button type="button" class="rastreio-editor-motorista-fechar" aria-label="Fechar">×</button>' +
                '</div>' +
                '<div class="rastreio-editor-motorista-campo">' +
                    '<label for="rastreioEditorMotoristaInput">Nome do motorista</label>' +
                    '<input id="rastreioEditorMotoristaInput" type="text" autocomplete="name" placeholder="Digite o nome completo">' +
                    '<small>Esse nome será aplicado a todas as linhas desta Nota Fiscal.</small>' +
                '</div>' +
                '<div class="rastreio-editor-motorista-acoes">' +
                    '<button type="button" class="botao-secundario" data-cancelar-rastreio-editor>Cancelar</button>' +
                    '<button type="button" class="botao-principal" data-salvar-rastreio-editor>Salvar motorista</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);

        modal.addEventListener("click", evento => {
            if (evento.target.matches("[data-fechar-rastreio-editor], [data-cancelar-rastreio-editor]")) {
                fecharEditorMotoristaRastreio();
            }
        });
        modal.querySelector(".rastreio-editor-motorista-fechar")
            ?.addEventListener("click", fecharEditorMotoristaRastreio);
        modal.querySelector("[data-salvar-rastreio-editor]")
            ?.addEventListener("click", salvarEditorMotoristaRastreio);
        modal.querySelector("#rastreioEditorMotoristaInput")
            ?.addEventListener("keydown", evento => {
                if (evento.key === "Enter") {
                    evento.preventDefault();
                    salvarEditorMotoristaRastreio();
                    return;
                }
                if (evento.key === "Escape") {
                    evento.preventDefault();
                    evento.stopPropagation();
                    fecharEditorMotoristaRastreio();
                }
            });
    }

    const campo = modal.querySelector("#rastreioEditorMotoristaInput");
    const identificacao = modal.querySelector("#rastreioEditorMotoristaRegiao");
    modal.dataset.alvo = chave;

    const indiceNotaFiscal = dadosImportacaoRastreio.modeloIndices?.notaFiscal ?? -1;
    const notaFiscal = dadosImportacaoRastreio.linhas
        .map(linha => indiceNotaFiscal >= 0 ? String(linha?.[indiceNotaFiscal] ?? "").trim() : "")
        .find(nota => chaveNotaFiscalRastreio(nota) === chave) || chave;

    identificacao.textContent = "NF " + notaFiscal;
    campo.value = mapaMotoristasRastreio[chave] || "";
    modal.classList.add("aberto");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("rastreio-modal-aberto");

    requestAnimationFrame(() => {
        campo.focus();
        campo.select();
    });
}

function capturarMapaMotoristasUI() {
    document.querySelectorAll("[data-nf-motorista]").forEach(input => {
        mapaMotoristasRastreio[input.dataset.nfMotorista] = input.value.trim();
    });
}

function normalizarTurnoRastreio(valor) {
    const chave = normalizarChaveRastreio(valor);
    if (chave === "MANHA") return "MANHA";
    if (chave === "TARDE") return "TARDE";
    return null;
}

function normalizarNumeroRastreio(valor) {
    if (valor == null || String(valor).trim() === "") return null;
    let texto = String(valor).trim().replace(/[^0-9,.-]/g, "");
    if (texto.includes(",") && texto.includes(".")) {
        if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) {
            texto = texto.replace(/\./g, "").replace(",", ".");
        } else {
            texto = texto.replace(/,/g, "");
        }
    } else if (texto.includes(",")) {
        texto = texto.replace(",", ".");
    }
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
}

function normalizarDataRastreio(valor) {
    if (valor == null || String(valor).trim() === "") return null;

    const texto = String(valor).trim();

    const montarDataValida = (ano, mes, dia) => {
        const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
        if (
            data.getFullYear() !== Number(ano) ||
            data.getMonth() !== Number(mes) - 1 ||
            data.getDate() !== Number(dia)
        ) {
            return null;
        }

        return String(ano) + "-" +
            String(mes).padStart(2, "0") + "-" +
            String(dia).padStart(2, "0");
    };

    const br = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (br) {
        return montarDataValida(br[3], br[2], br[1]);
    }

    const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        return montarDataValida(iso[1], iso[2], iso[3]);
    }

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return null;

    return data.getFullYear() + "-" +
        String(data.getMonth() + 1).padStart(2, "0") + "-" +
        String(data.getDate()).padStart(2, "0");
}

function calcularPrevisaoRastreio(dataISO, turno) {
    if (!dataISO || !turno) return null;
    return dataISO + (turno === "MANHA" ? "T12:00:00-03:00" : "T18:00:00-03:00");
}

function linhaPossuiDadosRastreio(valores) {
    if (!Array.isArray(valores)) return false;

    const { modeloIndices } = dadosImportacaoRastreio || {};
    if (!modeloIndices) return false;

    const chavesOperacionais = [
        "cliente",
        "notaFiscal",
        "transportadora",
        "motorista",
        "regiao",
        "volume",
        "peso",
        "valorNF",
        "dataEnvio",
        "turno"
    ];

    return chavesOperacionais.some(chave => {
        const indice = modeloIndices[chave];
        if (indice == null || indice < 0) return false;
        const valor = valores[indice];
        return valor != null && String(valor).trim() !== "";
    });
}

function linhaEstruturalRastreio(valores) {
    if (!Array.isArray(valores)) return false;

    const { modeloIndices } = dadosImportacaoRastreio || {};
    if (!modeloIndices) return false;

    const obter = chave => {
        const indice = modeloIndices[chave];
        return indice >= 0 ? String(valores[indice] ?? "").trim() : "";
    };

    const cliente = obter("cliente");
    const notaFiscal = obter("notaFiscal");
    const dataEnvio = obter("dataEnvio");
    const turno = obter("turno");
    const transportadora = normalizarChaveRastreio(obter("transportadora"));
    const motorista = obter("motorista");
    const regiao = obter("regiao");
    const volume = obter("volume");
    const peso = obter("peso");
    const valorNF = obter("valorNF");

    // Resíduos comuns de exportações: TOTAL, SOMA, cabeçalhos repetidos
    // ou linhas de fechamento. Não são rastreios e não devem gerar falso erro.
    const semCamposObrigatorios =
        !cliente && !notaFiscal && !dataEnvio && !turno;

    const marcadorEstrutural =
        transportadora === "TOTAL" ||
        transportadora === "TOTALGERAL" ||
        transportadora === "SOMA" ||
        transportadora === "FRETE";

    const semQualquerOutroDado =
        !motorista && !regiao && !volume && !peso && !valorNF;

    return semCamposObrigatorios && marcadorEstrutural && semQualquerOutroDado;
}

function classificarLinhaRastreio(valores) {
    if (!linhaPossuiDadosRastreio(valores)) return "VAZIA";
    if (linhaEstruturalRastreio(valores)) return "ESTRUTURAL";
    return "OPERACIONAL";
}

function validarLinhasObrigatoriasRastreio() {
    if (!dadosImportacaoRastreio) {
        return {
            totalErros: 1,
            erros: ["Nenhuma planilha de Rastreio foi preparada."],
            totalOperacionais: 0,
            totalEstruturais: 0,
            totalVazias: 0
        };
    }

    const { modelo, modeloIndices, linhas } = dadosImportacaoRastreio;
    const deslocamentoLinha =
        Number(dadosImportacaoRastreio.deslocamentoLinha) || 2;
    const erros = [];
    let totalErros = 0;
    let totalOperacionais = 0;
    let totalEstruturais = 0;
    let totalVazias = 0;

    for (let indice = 0; indice < linhas.length; indice++) {
        const d = linhas[indice];
        const classificacao = classificarLinhaRastreio(d);

        if (classificacao === "VAZIA") {
            totalVazias++;
            continue;
        }

        if (classificacao === "ESTRUTURAL") {
            totalEstruturais++;
            continue;
        }

        totalOperacionais++;

        const valor = chave => {
            const indiceColuna = modeloIndices[chave];
            return indiceColuna >= 0 ? d?.[indiceColuna] : null;
        };

        const cliente = String(valor("cliente") ?? "").trim();
        const notasFiscais = String(valor("notaFiscal") ?? "").trim();
        const dataEnvio = normalizarDataRastreio(valor("dataEnvio"));
        const turno = normalizarTurnoRastreio(valor("turno"));

        const problemas = [];

        if (!cliente) problemas.push("Cliente vazio");
        if (!notasFiscais) problemas.push("Nota Fiscal vazia");
        if (!dataEnvio) problemas.push("Data Envio inválida");
        if (!turno) problemas.push("Turno deve ser MANHÃ ou TARDE");

        for (const chaveNumerica of ["volume", "peso", "valorNF"]) {
            const bruto = valor(chaveNumerica);
            if (bruto != null && String(bruto).trim() !== "" &&
                normalizarNumeroRastreio(bruto) == null) {
                const rotulo = chaveNumerica === "valorNF"
                    ? "Valor NF"
                    : chaveNumerica.charAt(0).toUpperCase() + chaveNumerica.slice(1);
                problemas.push(rotulo + " inválido");
            }
        }

        if (problemas.length) {
            totalErros += problemas.length;

            if (erros.length < 100) {
                erros.push(
                    "Linha " +
                    (deslocamentoLinha + indice) +
                    ": " +
                    problemas.join(", ") +
                    "."
                );
            }
        }
    }

    return {
        totalErros,
        erros,
        totalOperacionais,
        totalEstruturais,
        totalVazias
    };
}

function prepararLinhasRastreioParaEnvio(inicio = 0, fim = null, coletarAvisos = false) {
    const { modelo, modeloIndices, linhas } = dadosImportacaoRastreio;
    const deslocamentoLinha =
        Number(dadosImportacaoRastreio.deslocamentoLinha) || 2;
    const limite = fim == null ? linhas.length : Math.min(fim, linhas.length);
    const resultado = [];
    const erros = coletarAvisos ? [] : [];
    let totalErros = 0;

    for (let indice = inicio; indice < limite; indice++) {
        const d = linhas[indice];

        // Ignora linhas vazias e resíduos estruturais detectados na validação.
        if (classificarLinhaRastreio(d) !== "OPERACIONAL") continue;

        const valor = chave => {
            const indice = modeloIndices[chave];
            return indice >= 0 ? d[indice] : null;
        };
        const turno = normalizarTurnoRastreio(valor("turno"));
        const dataEnvio = normalizarDataRastreio(valor("dataEnvio"));
        const regiao = String(valor("regiao") ?? "").trim();
        const notaFiscal = String(valor("notaFiscal") ?? "").trim();
        const chaveNotaFiscal = chaveNotaFiscalRastreio(notaFiscal);
        const motoristaPlanilha = String(valor("motorista") ?? "").trim();
        const motorista = "";

        const item = {
            cliente: String(valor("cliente") ?? "").trim(),
            notas_fiscais: String(valor("notaFiscal") ?? ""),
            transportadora: String(valor("transportadora") ?? "").trim(),
            motorista,
            regiao,
            volume: normalizarNumeroRastreio(valor("volume")),
            peso: normalizarNumeroRastreio(valor("peso")),
            valor_nf: normalizarNumeroRastreio(valor("valorNF")),
            valor_frete_embutido: normalizarNumeroRastreio(valor("valorFreteEmbutido")),
            valor_frete: normalizarNumeroRastreio(valor("valorFrete")),
            custo_nunes: normalizarNumeroRastreio(valor("custoNunes")),
            custo_final: normalizarNumeroRastreio(valor("custoFinal")),
            percentual_final: normalizarNumeroRastreio(valor("percentualFinal")),
            data_envio: dataEnvio,
            turno,
            previsao_entrega: calcularPrevisaoRastreio(dataEnvio, turno),
            linha_origem: deslocamentoLinha + indice
        };

        if (coletarAvisos) {
            const problemas = [];
            if (!item.cliente) problemas.push("Cliente vazio.");
            if (!item.notas_fiscais.trim()) problemas.push("Nota Fiscal vazia.");
            if (!importarSemMotoristaRastreio && !item.motorista) problemas.push("Motorista não definido.");
            if (!item.data_envio) problemas.push("Data Envio inválida.");
            if (!item.turno) problemas.push("Turno deve ser MANHÃ ou TARDE.");

            totalErros += problemas.length;

            for (const problema of problemas) {
                if (erros.length < 100) {
                    erros.push("Linha " + (deslocamentoLinha + indice) + ": " + problema);
                }
            }
        }

        resultado.push(item);
    }

    return { resultado, erros, totalErros };
}
function renderizarPreviaImportacaoRastreio() {
    const area = document.getElementById("rastreioImportacaoPrevia");
    if (!area || !dadosImportacaoRastreio) return;

    montarMapaMotoristasUI();

    const amostra = dadosImportacaoRastreio.linhas.slice(0, 8);
    const modelo = dadosImportacaoRastreio.modelo;

    area.innerHTML =
        '<div class="rastreio-importacao-resumo">' +
            '<strong>' + escaparHtmlRastreio(dadosImportacaoRastreio.arquivo.name) + '</strong>' +
            '<span>' + dadosImportacaoRastreio.linhas.length.toLocaleString("pt-BR") + ' linhas</span>' +
            '<span>Aba: ' + escaparHtmlRastreio(dadosImportacaoRastreio.nomeAba) + '</span>' +
        '</div>' +
        '<div class="rastreio-importacao-previa-titulo">Amostra das primeiras linhas</div>' +
        '<div class="rastreio-importacao-tabela">' +
            '<div class="cab">' +
                '<span>Linha</span><span>Cliente</span><span>NF</span><span>Região</span><span>Turno</span><span>Motorista</span>' +
            '</div>' +
            amostra.map((linha, indiceAmostra) => {
                const d = linha;
                const indices = dadosImportacaoRastreio.modeloIndices;
                const regiao = indices.regiao >= 0 ? String(d[indices.regiao] ?? "").trim() : "";
                const notaFiscal = indices.notaFiscal >= 0 ? String(d[indices.notaFiscal] ?? "").trim() : "";
                const motorista = importarSemMotoristaRastreio
                    ? "—"
                    : (indices.motorista >= 0
                        ? String(d[indices.motorista] ?? "").trim()
                        : (mapaMotoristasRastreio[chaveNotaFiscalRastreio(notaFiscal)] || "—"));
                return '<div class="linha">' +
                    '<span>' + (dadosImportacaoRastreio.deslocamentoLinha + indiceAmostra) + '</span>' +
                    '<span>' + escaparHtmlRastreio(d[indices.cliente]) + '</span>' +
                    '<span>' + escaparHtmlRastreio(d[indices.notaFiscal]) + '</span>' +
                    '<span>' + escaparHtmlRastreio(regiao || "—") + '</span>' +
                    '<span>' + escaparHtmlRastreio(d[indices.turno]) + '</span>' +
                    '<span>' + escaparHtmlRastreio(motorista) + '</span>' +
                '</div>';
            }).join("") +
        '</div>' +
        '<div class="rastreio-importacao-acoes">' +
            '<button type="button" class="botao-principal" onclick="enviarImportacaoRastreio()">Importar rastreios</button>' +
            '<button type="button" class="botao-secundario" onclick="cancelarImportacaoRastreio()">Cancelar</button>' +
        '</div>';

    montarMapaMotoristasUI();
}

async function enviarImportacaoRastreio() {
    if (importacaoRastreioEmAndamento || !dadosImportacaoRastreio) return;

    importacaoRastreioEmAndamento = true;
    let importacaoId = null;

    try {
        const sessao = obterSessaoRastreioImportacao();
        if (sincronizacaoOneDriveRastreioAtiva) {
            throw new Error("Há uma sincronização OneDrive ativa. Pare a importação manual e atualize pela fonte sincronizada para não duplicar registros.");
        }

        // A importação é tolerante: campos ausentes, inválidos ou não
        // normalizáveis não bloqueiam o lote. A validação continua sendo
        // executada para registrar os avisos, enquanto o banco preserva
        // esses campos como NULL.
        const validacao = validarLinhasObrigatoriasRastreio();

        if (validacao.totalErros > 0) {
            console.warn("Importação de Rastreio com inconsistências toleradas:", {
                total: validacao.totalErros,
                amostra: validacao.erros
            });

            mostrarStatusImportacaoRastreio(
                "🟡 Importação tolerante: " +
                validacao.totalErros.toLocaleString("pt-BR") +
                " inconsistência(s) serão preservadas como campo vazio."
            );
        }

        const criacao = await window.clienteSupabase.rpc("pmobile_rastreio_criar_importacao", {
            p_usuario: sessao.usuario,
            p_credencial: sessao.credencial,
            p_arquivo_nome: dadosImportacaoRastreio.arquivo.name,
            p_colunas: dadosImportacaoRastreio.colunas,
            p_sha256: dadosImportacaoRastreio.sha256,
            p_tamanho_bytes: dadosImportacaoRastreio.tamanhoBytes
        });

        if (criacao.error) throw criacao.error;

        importacaoId = Array.isArray(criacao.data) ? criacao.data[0] : criacao.data;
        if (importacaoId && typeof importacaoId === "object") {
            importacaoId = importacaoId.pmobile_rastreio_criar_importacao || importacaoId.id;
        }
        if (!importacaoId) throw new Error("O Supabase não retornou o ID da importação.");

        capturarMapaMotoristasUI();

        let enviadas = 0;
        let totalAvisos = 0;
        const avisosAmostra = [];
        const totalLinhas = dadosImportacaoRastreio.linhas.length;

        for (let inicio = 0; inicio < totalLinhas; inicio += TAMANHO_LOTE_RASTREIO) {
            const lotePreparado = prepararLinhasRastreioParaEnvio(
                inicio,
                inicio + TAMANHO_LOTE_RASTREIO,
                true
            );

            totalAvisos += lotePreparado.totalErros || 0;
            if (avisosAmostra.length < 100) {
                avisosAmostra.push(...lotePreparado.erros.slice(0, 100 - avisosAmostra.length));
            }
            const lote = lotePreparado.resultado;

            const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_inserir_lote_v2", {
                p_usuario: sessao.usuario,
                p_credencial: sessao.credencial,
                p_importacao_id: importacaoId,
                p_linhas: lote
            });

            if (resposta.error) throw resposta.error;

            enviadas += lote.length;
            mostrarStatusImportacaoRastreio(
                "🟡 Importando Rastreio... " +
                Math.round((enviadas / totalLinhas) * 100) +
                "% (" + enviadas.toLocaleString("pt-BR") + "/" +
                totalLinhas.toLocaleString("pt-BR") + ")"
            );

            // Libera a referência do lote antes de seguir para o próximo.
            lotePreparado.resultado.length = 0;
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (totalAvisos > 0) {
            console.warn("Importação de Rastreio com avisos:", {
                total: totalAvisos,
                amostra: avisosAmostra
            });
        }

        const finalizacao = await window.clienteSupabase.rpc("pmobile_rastreio_finalizar_importacao", {
            p_usuario: sessao.usuario,
            p_credencial: sessao.credencial,
            p_importacao_id: importacaoId,
            p_status: "CONCLUIDA"
        });

        if (finalizacao.error) throw finalizacao.error;

        mostrarStatusImportacaoRastreio(
            "🟢 Rastreio importado: " + enviadas.toLocaleString("pt-BR") + " linhas."
        );

        await salvarValoresTotalPlanilha();
        cancelarImportacaoRastreio(false);
        await carregarRastreios();
    } catch (erro) {
        console.error("Erro ao importar Rastreio:", erro);

        if (importacaoId) {
            try {
                const sessao = obterSessaoRastreioImportacao();
                await window.clienteSupabase.rpc("pmobile_rastreio_finalizar_importacao", {
                    p_usuario: sessao.usuario,
                    p_credencial: sessao.credencial,
                    p_importacao_id: importacaoId,
                    p_status: "ERRO"
                });
            } catch (erroFinalizacao) {
                console.error("Erro ao finalizar importação:", erroFinalizacao);
            }
        }

        mostrarStatusImportacaoRastreio(
            "🔴 Falha na importação: " + (erro.message || "erro desconhecido")
        );
    } finally {
        importacaoRastreioEmAndamento = false;
    }
}

function cancelarImportacaoRastreio(limparStatus = true) {
    dadosImportacaoRastreio = null;
    mapaMotoristasRastreio = {};

    const arquivo = document.getElementById("arquivoRastreio");
    if (arquivo) arquivo.value = "";

    const previa = document.getElementById("rastreioImportacaoPrevia");
    if (previa) previa.innerHTML = "";

    const mapa = document.getElementById("rastreioMapaMotoristas");
    if (mapa) mapa.innerHTML = "";

    if (limparStatus) mostrarStatusImportacaoRastreio("");
}

function atualizarProgressoImportacaoRastreio(dados = {}) {
    const painel = document.getElementById("rastreioImportacaoProgresso");
    const etapa = document.getElementById("rastreioImportacaoEtapa");
    const percentual = document.getElementById("rastreioImportacaoPercentual");
    const detalhe = document.getElementById("rastreioImportacaoDetalhe");
    const barra = document.getElementById("rastreioImportacaoProgressoBarra");
    const trilho = barra?.parentElement;
    const log = document.getElementById("rastreioImportacaoLog");

    if (!painel) return;

    const valor = Math.max(0, Math.min(100, Number(dados.percentual ?? 0)));
    painel.hidden = false;
    if (etapa) etapa.textContent = dados.etapa || "Processando planilha";
    if (percentual) percentual.textContent = Math.round(valor) + "%";
    if (detalhe) detalhe.textContent = dados.detalhe || "";
    if (barra) barra.style.setProperty("--rastreio-progresso", valor + "%");
    if (trilho) trilho.setAttribute("aria-valuenow", String(Math.round(valor)));

    if (log && dados.detalhe) {
        const anterior = log.dataset.ultimaMensagem || "";
        if (anterior !== dados.detalhe) {
            const linha = document.createElement("div");
            linha.textContent = dados.detalhe;
            log.appendChild(linha);
            while (log.children.length > 6) log.removeChild(log.firstChild);
            log.dataset.ultimaMensagem = dados.detalhe;
        }
    }
}

function mostrarStatusImportacaoRastreio(mensagem) {
    const area = document.getElementById("statusImportacaoRastreio");
    if (area) area.textContent = mensagem;
}

function iniciarProgressoImportacaoRastreio() {
    const log = document.getElementById("rastreioImportacaoLog");
    if (log) {
        log.innerHTML = "";
        delete log.dataset.ultimaMensagem;
    }
    atualizarProgressoImportacaoRastreio({
        percentual: 0,
        etapa: "Preparando",
        detalhe: "Aguardando transferência do arquivo para o processador..."
    });
}

function concluirProgressoImportacaoRastreio() {
    atualizarProgressoImportacaoRastreio({
        percentual: 100,
        etapa: "Concluído",
        detalhe: "Planilha processada. Preparando os dados do Rastreio..."
    });
}

async function calcularSha256Rastreio(buffer) {
    if (!window.crypto?.subtle) return null;

    const digest = await window.crypto.subtle.digest("SHA-256", buffer);

    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", atualizarAcessoAdminRastreio); else atualizarAcessoAdminRastreio();
// A sessão é carregada após o DOM; reavaliar permissões quando o login concluir.
setInterval(atualizarAcessoAdminRastreio, 1500);
