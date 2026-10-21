// ============================================================
// IMPORTAÇÃO NF
// ============================================================
//
// Importa uma planilha Excel para uma área bruta e isolada
// do Supabase. Nenhuma coluna é pré-modelada: cada linha é
// armazenada como JSONB para inspeção antes do desenho final
// do Rastreio.
//
// ============================================================

const TAMANHO_LOTE_IMPORTACAO_NF = 250;

let importacaoNFEmAndamento = false;


// ============================================================
// SESSÃO
// ============================================================

function obterSessaoImportacaoNF() {

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

    return {
        usuario: usuario.usuario,
        credencial
    };

}


// ============================================================
// ABRIR TELA
// ============================================================

async function abrirImportacaoNF() {

    mostrarTelaSistema(
        "importacaoNF",
        "menuImportacaoNF"
    );

    await carregarHistoricoImportacaoNF();

}


// ============================================================
// LER PLANILHA
// ============================================================

async function prepararImportacaoNF() {

    const arquivo =
        document.getElementById("arquivoImportacaoNF")?.files?.[0];

    if (!arquivo) {
        mostrarResultadoImportacaoNF(
            "erro",
            "Selecione uma planilha Excel antes de importar."
        );
        return;
    }

    await analisarArquivoImportacaoNF(
        arquivo
    );

}


// ============================================================
// LER PLANILHA ONLINE
// ============================================================

async function prepararImportacaoNFOnline() {

    const campo =
        document.getElementById("linkImportacaoNF");

    const urlInformada =
        campo?.value?.trim();

    if (!urlInformada) {
        mostrarResultadoImportacaoNF(
            "erro",
            "Insira o link público da planilha."
        );
        return;
    }

    if (!window.XLSX) {
        mostrarResultadoImportacaoNF(
            "erro",
            "A biblioteca Excel ainda não foi carregada."
        );
        return;
    }

    try {

        atualizarStatusImportacaoNF(
            "🟡 Baixando planilha online..."
        );

        const urlDownload =
            normalizarUrlPlanilhaOnlineNF(
                urlInformada
            );

        const hostOnline =
            new URL(urlDownload)
                .hostname
                .toLowerCase();

        const microsoft365 =
            hostOnline === "1drv.ms" ||
            hostOnline === "onedrive.live.com" ||
            hostOnline.endsWith(".onedrive.live.com") ||
            hostOnline === "automotivacba-my.sharepoint.com";

        let buffer;
        let nomeArquivo;
        let tipo;

        if (microsoft365) {

            const respostaProxy =
                await window.clienteSupabase.functions.invoke(
                    "pmobile-nf-download",
                    {
                        body: {
                            url: urlDownload
                        }
                    }
                );

            if (respostaProxy.error) {
                throw new Error(
                    respostaProxy.error.message ||
                    "Não foi possível baixar a planilha pelo Microsoft 365."
                );
            }

            const dadosProxy =
                respostaProxy.data;

            if (!(dadosProxy instanceof Blob)) {
                throw new Error(
                    "O Microsoft 365 não retornou um arquivo utilizável."
                );
            }

            buffer =
                await dadosProxy.arrayBuffer();

            nomeArquivo =
                "planilha-sharepoint.xlsx";

            tipo =
                dadosProxy.type ||
                "application/octet-stream";

        } else {

            const resposta =
                await fetch(
                    urlDownload,
                    {
                        method: "GET",
                        redirect: "follow"
                    }
                );

            if (!resposta.ok) {
                throw new Error(
                    "O link respondeu HTTP " +
                    resposta.status +
                    "."
                );
            }

            buffer =
                await resposta.arrayBuffer();

            nomeArquivo =
                obterNomeArquivoOnlineNF(
                    resposta,
                    urlDownload
                );

            tipo =
                resposta.headers.get("content-type") ||
                "application/octet-stream";

        }

        if (!buffer.byteLength) {
            throw new Error(
                "O link não retornou nenhum arquivo."
            );
        }

        const arquivo =
            new File(
                [buffer],
                nomeArquivo,
                {
                    type: tipo
                }
            );

        await analisarArquivoImportacaoNF(
            arquivo
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao ler planilha online:",
            erro
        );

        mostrarResultadoImportacaoNF(
            "erro",
            "Não foi possível ler o link. " +
            (
                erro.message ||
                "Verifique se a planilha é pública e permite download."
            )
        );

    }

}


// ============================================================
// NORMALIZAR LINK ONLINE
// ============================================================

function normalizarUrlPlanilhaOnlineNF(
    urlInformada
) {

    let url;

    try {
        url =
            new URL(
                urlInformada
            );
    } catch {
        throw new Error(
            "O link informado não é uma URL válida."
        );
    }

    if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
    ) {
        throw new Error(
            "O link deve começar com http:// ou https://."
        );
    }

    const host =
        url.hostname.toLowerCase();

    const matchGoogle =
        url.pathname.match(
            /^\/spreadsheets\/d\/([^/]+)/
        );

    if (
        (
            host === "docs.google.com" ||
            host === "sheets.google.com"
        ) &&
        matchGoogle
    ) {

        return (
            "https://docs.google.com/spreadsheets/d/" +
            encodeURIComponent(matchGoogle[1]) +
            "/export?format=xlsx"
        );

    }

    const matchDrive =
        url.pathname.match(
            /^\/file\/d\/([^/]+)/
        );

    if (
        host === "drive.google.com" &&
        matchDrive
    ) {

        return (
            "https://drive.google.com/uc?export=download&id=" +
            encodeURIComponent(matchDrive[1])
        );

    }

    // OneDrive / Microsoft 365:
    // links compartilhados normalmente apontam para uma página
    // de visualização. O parâmetro download=1 solicita o arquivo
    // diretamente, mantendo a origem em somente leitura.
    if (
        host === "1drv.ms" ||
        host === "onedrive.live.com" ||
        host.endsWith(".onedrive.live.com") ||
        host === "automotivacba-my.sharepoint.com"
    ) {

        url.searchParams.set(
            "download",
            "1"
        );

        return url.toString();

    }

    return url.toString();

}


// ============================================================
// NOME DO ARQUIVO ONLINE
// ============================================================

function obterNomeArquivoOnlineNF(
    resposta,
    url
) {

    const disposicao =
        resposta.headers.get(
            "content-disposition"
        );

    const nomeHeader =
        disposicao?.match(
            /filename\*?=(?:UTF-8''|")?([^";]+)/
        )?.[1];

    if (nomeHeader) {
        try {
            return decodeURIComponent(
                nomeHeader
            ).trim();
        } catch {
            return nomeHeader.trim();
        }
    }

    try {

        const pathname =
            new URL(url).pathname;

        const nome =
            decodeURIComponent(
                pathname.split("/").pop() || ""
            ).trim();

        if (
            nome &&
            /\\.(xlsx?|xlsm|csv)$/i.test(nome)
        ) {
            return nome;
        }

    } catch {
        // usa nome padrão abaixo
    }

    return "planilha-online.xlsx";

}


// ============================================================
// ANALISAR ARQUIVO
// ============================================================

async function analisarArquivoImportacaoNF(
    arquivo
) {

    const resultado =
        document.getElementById("resultadoImportacaoNF");

    if (!arquivo) {
        throw new Error(
            "Arquivo não informado."
        );
    }

    if (!window.XLSX) {
        mostrarResultadoImportacaoNF(
            "erro",
            "A biblioteca Excel ainda não foi carregada."
        );
        return;
    }

    try {

        const buffer =
            await arquivo.arrayBuffer();

        const workbook =
            window.XLSX.read(
                buffer,
                {
                    type: "array",
                    cellDates: false
                }
            );

        const nomeAba =
            workbook.SheetNames?.[0];

        if (!nomeAba) {
            throw new Error(
                "A planilha não possui uma aba utilizável."
            );
        }

        const planilha =
            workbook.Sheets[nomeAba];

        const matriz =
            window.XLSX.utils.sheet_to_json(
                planilha,
                {
                    header: 1,
                    defval: null,
                    raw: false,
                    blankrows: false
                }
            );

        if (!matriz.length) {
            throw new Error(
                "A planilha está vazia."
            );
        }

        const cabecalhoBruto =
            Array.isArray(matriz[0])
                ? matriz[0]
                : [];

        const colunas =
            normalizarColunasImportacaoNF(
                cabecalhoBruto
            );

        const linhas =
            [];

        for (
            let i = 1;
            i < matriz.length;
            i++
        ) {

            const valores =
                Array.isArray(matriz[i])
                    ? matriz[i]
                    : [];

            if (
                valores.every(
                    valor =>
                        valor === null ||
                        valor === undefined ||
                        String(valor).trim() === ""
                )
            ) {
                continue;
            }

            const dados =
                {};

            colunas.forEach(
                (
                    coluna,
                    indice
                ) => {

                    let valor =
                        indice < valores.length
                            ? valores[indice]
                            : null;

                    if (
                        valor === undefined ||
                        valor === ""
                    ) {
                        valor = null;
                    }

                    dados[coluna] =
                        valor;

                }
            );

            linhas.push(
                {
                    linha_numero: i + 1,
                    dados
                }
            );

        }

        if (!linhas.length) {
            throw new Error(
                "A planilha possui cabeçalho, mas nenhuma linha de dados."
            );
        }

        const sha256 =
            await calcularSha256ImportacaoNF(
                buffer
            );

        window.dadosImportacaoNFAtual = {
            arquivo,
            nomeAba,
            colunas,
            linhas,
            sha256,
            tamanhoBytes: arquivo.size
        };

        mostrarResumoImportacaoNF();

        atualizarStatusImportacaoNF(
            "🟢 Planilha analisada. Revise as colunas antes de enviar."
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao preparar Importação NF:",
            erro
        );

        window.dadosImportacaoNFAtual =
            null;

        mostrarResultadoImportacaoNF(
            "erro",
            erro.message ||
            "Não foi possível ler a planilha."
        );

    }

}

// ============================================================
// NORMALIZAR COLUNAS
// ============================================================

function normalizarColunasImportacaoNF(
    cabecalho
) {

    const usados =
        new Set();

    return cabecalho.map(
        function(valor, indice) {

            let nome =
                String(
                    valor ?? ""
                ).trim();

            if (!nome) {
                nome =
                    "COLUNA_" +
                    (indice + 1);
            }

            const base =
                nome;

            let contador =
                2;

            while (
                usados.has(
                    nome
                )
            ) {

                nome =
                    base +
                    "_" +
                    contador++;

            }

            usados.add(nome);

            return nome;

        }
    );

}


// ============================================================
// SHA-256
// ============================================================

async function calcularSha256ImportacaoNF(
    buffer
) {

    if (
        !window.crypto ||
        !window.crypto.subtle
    ) {
        return null;
    }

    const digest =
        await window.crypto.subtle.digest(
            "SHA-256",
            buffer
        );

    return Array
        .from(
            new Uint8Array(digest)
        )
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");

}


// ============================================================
// RESUMO
// ============================================================

function mostrarResumoImportacaoNF() {

    const dados =
        window.dadosImportacaoNFAtual;

    const resumo =
        document.getElementById(
            "resultadoImportacaoNF"
        );

    if (!dados || !resumo) {
        return;
    }

    resumo.innerHTML =
        "<div class=\"importacao-nf-resumo\">" +
            "<strong>" +
                escaparHtmlImportacaoNF(dados.arquivo.name) +
            "</strong>" +
            "<span>" +
                dados.linhas.length.toLocaleString("pt-BR") +
                " linhas de dados</span>" +
            "<span>" +
                dados.colunas.length.toLocaleString("pt-BR") +
                " colunas</span>" +
            "<span>Aba: " +
                escaparHtmlImportacaoNF(dados.nomeAba) +
            "</span>" +
        "</div>" +
        "<div class=\"importacao-nf-colunas\">" +
            dados.colunas
                .map(
                    coluna =>
                        "<span>" +
                        escaparHtmlImportacaoNF(coluna) +
                        "</span>"
                )
                .join("") +
        "</div>" +
        "<div class=\"importacao-nf-acoes-preparo\">" +
            "<button class=\"botao-principal\" type=\"button\" onclick=\"enviarImportacaoNF()\">" +
                "Enviar ao Supabase" +
            "</button>" +
            "<button class=\"botao-secundario\" type=\"button\" onclick=\"limparPreparacaoImportacaoNF()\">" +
                "Cancelar" +
            "</button>" +
        "</div>";

}


// ============================================================
// ENVIAR PARA SUPABASE
// ============================================================

async function enviarImportacaoNF() {

    if (importacaoNFEmAndamento) {
        return;
    }

    const dados =
        window.dadosImportacaoNFAtual;

    if (!dados) {
        mostrarResultadoImportacaoNF(
            "erro",
            "Prepare a planilha antes de enviar."
        );
        return;
    }

    importacaoNFEmAndamento =
        true;

    const status =
        document.getElementById(
            "statusImportacaoNF"
        );

    let importacaoId =
        null;

    try {

        const sessao =
            obterSessaoImportacaoNF();

        const respostaCriacao =
            await window.clienteSupabase.rpc(
                "pmobile_nf_criar_importacao",
                {
                    p_usuario: sessao.usuario,
                    p_credencial: sessao.credencial,
                    p_arquivo_nome: dados.arquivo.name,
                    p_colunas: dados.colunas,
                    p_sha256: dados.sha256,
                    p_tamanho_bytes: dados.tamanhoBytes
                }
            );

        if (respostaCriacao.error) {
            throw respostaCriacao.error;
        }

        importacaoId =
            Array.isArray(respostaCriacao.data)
                ? respostaCriacao.data[0]
                : respostaCriacao.data;

        if (
            importacaoId &&
            typeof importacaoId === "object"
        ) {
            importacaoId =
                importacaoId.pmobile_nf_criar_importacao ||
                importacaoId.id;
        }

        if (!importacaoId) {
            throw new Error(
                "O Supabase não retornou o ID da importação."
            );
        }

        atualizarStatusImportacaoNF(
            "🟡 Enviando linhas ao Supabase..."
        );

        let enviadas =
            0;

        for (
            let inicio = 0;
            inicio < dados.linhas.length;
            inicio += TAMANHO_LOTE_IMPORTACAO_NF
        ) {

            const lote =
                dados.linhas.slice(
                    inicio,
                    inicio +
                    TAMANHO_LOTE_IMPORTACAO_NF
                );

            const respostaLote =
                await window.clienteSupabase.rpc(
                    "pmobile_nf_inserir_lote",
                    {
                        p_usuario: sessao.usuario,
                        p_credencial: sessao.credencial,
                        p_importacao_id: importacaoId,
                        p_linhas: lote
                    }
                );

            if (respostaLote.error) {
                throw respostaLote.error;
            }

            enviadas +=
                lote.length;

            const percentual =
                Math.round(
                    (enviadas /
                        dados.linhas.length) *
                    100
                );

            atualizarStatusImportacaoNF(
                "🟡 Enviando linhas ao Supabase... " +
                percentual +
                "% (" +
                enviadas.toLocaleString("pt-BR") +
                "/" +
                dados.linhas.length.toLocaleString("pt-BR") +
                ")"
            );

        }

        const respostaFinal =
            await window.clienteSupabase.rpc(
                "pmobile_nf_finalizar_importacao",
                {
                    p_usuario: sessao.usuario,
                    p_credencial: sessao.credencial,
                    p_importacao_id: importacaoId,
                    p_status: "CONCLUIDA"
                }
            );

        if (respostaFinal.error) {
            throw respostaFinal.error;
        }

        atualizarStatusImportacaoNF(
            "🟢 Importação NF concluída: " +
            enviadas.toLocaleString("pt-BR") +
            " linhas enviadas e confirmadas no Supabase."
        );

        window.dadosImportacaoNFAtual =
            null;

        const campoArquivo =
            document.getElementById(
                "arquivoImportacaoNF"
            );

        if (campoArquivo) {
            campoArquivo.value =
                "";
        }

        await carregarHistoricoImportacaoNF();

    } catch (erro) {

        console.error(
            "❌ Erro ao enviar Importação NF:",
            erro
        );

        if (importacaoId) {

            try {

                const sessao =
                    obterSessaoImportacaoNF();

                await window.clienteSupabase.rpc(
                    "pmobile_nf_finalizar_importacao",
                    {
                        p_usuario: sessao.usuario,
                        p_credencial: sessao.credencial,
                        p_importacao_id: importacaoId,
                        p_status: "ERRO"
                    }
                );

            } catch (erroFinalizacao) {

                console.error(
                    "❌ Não foi possível marcar a importação como ERRO:",
                    erroFinalizacao
                );

            }

        }

        atualizarStatusImportacaoNF(
            "🔴 Falha na Importação NF: " +
            (
                erro.message ||
                "erro desconhecido"
            )
        );

    } finally {

        importacaoNFEmAndamento =
            false;

    }

}


// ============================================================
// HISTÓRICO
// ============================================================

async function carregarHistoricoImportacaoNF() {

    const lista =
        document.getElementById(
            "listaImportacoesNF"
        );

    if (!lista) {
        return;
    }

    lista.innerHTML =
        "<div class=\"importacao-nf-carregando\">Carregando importações...</div>";

    try {

        const sessao =
            obterSessaoImportacaoNF();

        const resposta =
            await window.clienteSupabase.rpc(
                "pmobile_nf_listar_importacoes",
                {
                    p_usuario: sessao.usuario,
                    p_credencial: sessao.credencial
                }
            );

        if (resposta.error) {
            throw resposta.error;
        }

        const importacoes =
            Array.isArray(resposta.data)
                ? resposta.data
                : [];

        if (!importacoes.length) {

            lista.innerHTML =
                "<div class=\"importacao-nf-vazio\">" +
                    "<strong>Nenhuma importação NF.</strong>" +
                    "<span>As planilhas enviadas aparecerão aqui.</span>" +
                "</div>";

            return;

        }

        lista.innerHTML =
            importacoes
                .map(
                    item =>
                        "<div class=\"importacao-nf-item\">" +
                            "<div>" +
                                "<strong>" +
                                    escaparHtmlImportacaoNF(item.arquivo_nome) +
                                "</strong>" +
                                "<span>" +
                                    escaparHtmlImportacaoNF(item.usuario_nome) +
                                "</span>" +
                            "</div>" +
                            "<div>" +
                                "<span>" +
                                    Number(item.total_linhas || 0).toLocaleString("pt-BR") +
                                    " linhas</span>" +
                                "<span>" +
                                    escaparHtmlImportacaoNF(item.status) +
                                "</span>" +
                            "</div>" +
                            "<button type=\"button\" class=\"botao-secundario\" onclick=\"abrirLinhasImportacaoNF('" +
                                String(item.id) +
                                "')\">" +
                                "Ver dados" +
                            "</button>" +
                        "</div>"
                )
                .join("");

    } catch (erro) {

        console.error(
            "❌ Erro ao carregar histórico de Importação NF:",
            erro
        );

        lista.innerHTML =
            "<div class=\"importacao-nf-erro\">" +
                escaparHtmlImportacaoNF(
                    erro.message ||
                    "Não foi possível carregar o histórico."
                ) +
            "</div>";

    }

}


// ============================================================
// VISUALIZAR DADOS
// ============================================================

async function abrirLinhasImportacaoNF(
    importacaoId
) {

    const visualizacao =
        document.getElementById(
            "visualizacaoImportacaoNF"
        );

    if (!visualizacao) {
        return;
    }

    visualizacao.innerHTML =
        "<div class=\"importacao-nf-carregando\">Carregando primeiras linhas...</div>";

    try {

        const sessao =
            obterSessaoImportacaoNF();

        const resposta =
            await window.clienteSupabase.rpc(
                "pmobile_nf_obter_linhas",
                {
                    p_usuario: sessao.usuario,
                    p_credencial: sessao.credencial,
                    p_importacao_id: importacaoId,
                    p_limit: 20,
                    p_offset: 0
                }
            );

        if (resposta.error) {
            throw resposta.error;
        }

        const linhas =
            Array.isArray(resposta.data)
                ? resposta.data
                : [];

        if (!linhas.length) {
            visualizacao.innerHTML =
                "<div class=\"importacao-nf-vazio\">Nenhuma linha encontrada.</div>";
            return;
        }

        const primeiro =
            linhas[0]?.dados || {};

        const colunas =
            Object.keys(primeiro);

        visualizacao.innerHTML =
            "<div class=\"importacao-nf-tabela-cabecalho\">" +
                "<span>Linha</span>" +
                colunas
                    .map(
                        coluna =>
                            "<span>" +
                            escaparHtmlImportacaoNF(coluna) +
                            "</span>"
                    )
                    .join("") +
            "</div>" +
            linhas
                .map(
                    linha =>
                        "<div class=\"importacao-nf-tabela-linha\">" +
                            "<span>" +
                                linha.linha_numero +
                            "</span>" +
                            colunas
                                .map(
                                    coluna =>
                                        "<span>" +
                                        escaparHtmlImportacaoNF(
                                            linha.dados?.[coluna] ??
                                            ""
                                        ) +
                                        "</span>"
                                )
                                .join("") +
                        "</div>"
                )
                .join("");

    } catch (erro) {

        console.error(
            "❌ Erro ao visualizar Importação NF:",
            erro
        );

        visualizacao.innerHTML =
            "<div class=\"importacao-nf-erro\">" +
                escaparHtmlImportacaoNF(
                    erro.message ||
                    "Não foi possível carregar os dados."
                ) +
            "</div>";

    }

}


// ============================================================
// AUXILIARES
// ============================================================

function atualizarStatusImportacaoNF(
    mensagem
) {

    const status =
        document.getElementById(
            "statusImportacaoNF"
        );

    if (status) {
        status.textContent =
            mensagem;
    }

}


function mostrarResultadoImportacaoNF(
    tipo,
    mensagem
) {

    const resultado =
        document.getElementById(
            "resultadoImportacaoNF"
        );

    if (!resultado) {
        return;
    }

    resultado.className =
        "importacao-nf-resultado " +
        (
            tipo ||
            ""
        );

    resultado.textContent =
        mensagem;

}


function limparPreparacaoImportacaoNF() {

    window.dadosImportacaoNFAtual =
        null;

    const campo =
        document.getElementById(
            "arquivoImportacaoNF"
        );

    if (campo) {
        campo.value =
            "";
    }

    const resultado =
        document.getElementById(
            "resultadoImportacaoNF"
        );

    if (resultado) {
        resultado.innerHTML =
            "";
        resultado.className =
            "importacao-nf-resultado";
    }

}


function escaparHtmlImportacaoNF(
    valor
) {

    return String(
        valor ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}
