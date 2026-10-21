// ============================================================
// PMOBILE - IMPORTAÇÃO DE INVENTÁRIO
// VERSÃO: IMPORTAÇÃO SEGURA VIA STAGING + RPC POSTGRESQL
// ============================================================
//
// OBJETIVO GERAL
// --------------
// 1. Ler o arquivo exportado pelo DOGO (HTML disfarçado de XLS)
//    ou um Excel verdadeiro.
// 2. Diagnosticar os registros antes da conversão.
// 3. Código/descrição/referência/marca/local vazios são AVISOS e
//    NÃO bloqueiam a importação.
// 4. Preparar a nova carga em:
//      public.materiais_importacao_temporaria
// 5. Somente após TODOS os lotes chegarem ao Supabase, chamar:
//      public.pmobile_finalizar_importacao_materiais(uuid)
// 6. A função PostgreSQL substitui public.materiais dentro de uma
//    única transação. Se falhar, o estoque anterior é preservado.
// 7. Depois do sucesso, baixar o inventário oficial com os IDs
//    gerados pelo Supabase e salvar a cópia no IndexedDB.
//
// DEPENDÊNCIAS
// ------------
// - supabase.js -> window.clienteSupabase
// - dados.js    -> salvarCopiaLocalDoSupabase() ou salvarMateriais()
// - SheetJS     -> window.XLSX para Excel verdadeiro
//
// IMPORTANTE
// ----------
// Este arquivo NÃO apaga public.materiais diretamente.
// A troca oficial fica sob responsabilidade do PostgreSQL.
//
// ============================================================


// ============================================================
// CONFIGURAÇÕES
// ============================================================

const LIMITE_ARQUIVO_MB = 100;

// Quantidade de registros enviados por requisição para a staging.
const TAMANHO_LOTE_SUPABASE = 500;

// Quantidade de registros lidos por página ao reconstruir a cópia offline.
const TAMANHO_PAGINA_COPIA_LOCAL = 1000;


// ============================================================
// CONTROLE DE IMPORTAÇÃO
// ============================================================

let importacaoSupabaseEmAndamento = false;


// ============================================================
// DIAGNÓSTICO DA IMPORTAÇÃO
// ============================================================

let diagnosticoImportacao = {
    total: 0,
    ok: 0,
    observacoes: [],
    erros: [],
    codigosEncontrados: new Map()
};


// ============================================================
// FUNÇÃO: atualizarBarraProgresso
// ============================================================
//
// Atualiza a área visual da importação.
//
// Faixas utilizadas:
// 0–50%   -> leitura/processamento do arquivo
// 50–90%  -> envio para a staging do Supabase
// 90–95%  -> troca transacional no PostgreSQL
// 95–100% -> reconstrução da cópia IndexedDB
//
// ============================================================

function atualizarBarraProgresso(percentual, mensagem) {

    const resultado =
        document.getElementById("resultadoImportacao");

    if (!resultado) {
        return;
    }

    const valor =
        Math.max(
            0,
            Math.min(100, Math.round(percentual))
        );

    resultado.innerHTML =
        "<p><strong>" +
        (mensagem || "Importando inventário...") +
        "</strong></p>" +
        "<div class=\"barra-progresso-container\">" +
            "<div class=\"barra-progresso barra-progresso--dinamica\" style=\"--progresso-percentual:" + valor + "\"></div>" +
        "</div>" +
        "<p class=\"progresso-percentual\"><strong>" +
            valor +
            "%" +
        "</strong></p>";
}


// ============================================================
// FUNÇÃO: iniciarDiagnosticoImportacao
// ============================================================
//
// Zera o diagnóstico da importação anterior.
//
// ============================================================

function iniciarDiagnosticoImportacao() {

    diagnosticoImportacao = {
        total: 0,
        ok: 0,
        observacoes: [],
        erros: [],
        codigosEncontrados: new Map()
    };
}


// ============================================================
// FUNÇÃO: valorVazio
// ============================================================
//
// Considera vazio:
// null, undefined, "", ou texto contendo apenas espaços.
//
// ============================================================

function valorVazio(valor) {

    return (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === ""
    );
}


// ============================================================
// FUNÇÃO: numeroValidoOriginal
// ============================================================
//
// Valida o valor numérico ANTES da conversão.
//
// Valor vazio continua sendo aceito e depois será convertido para 0.
// Valores claramente não numéricos são classificados como erro.
//
// ============================================================

function numeroValidoOriginal(valor) {

    if (valorVazio(valor)) {
        return {
            valido: true,
            vazio: true
        };
    }

    if (typeof valor === "number") {
        return {
            valido: Number.isFinite(valor),
            vazio: false
        };
    }

    const texto =
        String(valor)
            .trim()
            .replace(/\s/g, "");

    const formatoNumero =
        /^[+-]?\d+(?:[.,]\d+)?$/;

    const formatoMilhar =
        /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;

    return {
        valido:
            formatoNumero.test(texto) ||
            formatoMilhar.test(texto),
        vazio: false
    };
}


// ============================================================
// FUNÇÃO: analisarMaterialImportado
// ============================================================
//
// Classifica a linha original.
//
// OBSERVAÇÕES NÃO BLOQUEANTES:
// - código vazio
// - descrição vazia
// - referência vazia
// - marca vazia
// - local vazio
// - última entrada vazia
//
// ERROS DE DIAGNÓSTICO:
// - quantidade estimada inválida
// - quantidade reservada inválida
// - código duplicado
//
// IMPORTANTE:
// O diagnóstico continua informativo. Esta versão NÃO cancela a
// importação apenas porque diagnosticoImportacao.erros possui itens.
// Isso preserva a decisão atual do projeto.
//
// ============================================================

function analisarMaterialImportado(linha, numeroRegistro) {

    diagnosticoImportacao.total++;

    let possuiObservacao = false;
    let possuiErro = false;

    const codigo =
        linha.Produto ??
        linha.produto ??
        linha.Codigo ??
        linha.codigo ??
        "";

    if (valorVazio(codigo)) {

        possuiObservacao = true;

        diagnosticoImportacao.observacoes.push({
            registro: numeroRegistro,
            campo: "Produto",
            mensagem: "Código do produto vazio."
        });

    } else {

        const codigoTexto =
            String(codigo).trim();

        if (
            diagnosticoImportacao
                .codigosEncontrados
                .has(codigoTexto)
        ) {

            possuiErro = true;

            const registroAnterior =
                diagnosticoImportacao
                    .codigosEncontrados
                    .get(codigoTexto);

            diagnosticoImportacao.erros.push({
                registro: numeroRegistro,
                campo: "Produto",
                mensagem:
                    "Código duplicado. Também aparece no registro " +
                    registroAnterior +
                    "."
            });

        } else {

            diagnosticoImportacao
                .codigosEncontrados
                .set(
                    codigoTexto,
                    numeroRegistro
                );
        }
    }

    const descricao =
        linha.Descricao ??
        linha.descricao ??
        linha.Descrição ??
        linha.descrição ??
        "";

    if (valorVazio(descricao)) {
        possuiObservacao = true;

        diagnosticoImportacao.observacoes.push({
            registro: numeroRegistro,
            campo: "Descricao",
            mensagem: "Descrição vazia."
        });
    }

    const referencia =
        linha.Referencia ??
        linha.referencia ??
        linha.Referência ??
        linha.referência ??
        "";

    if (valorVazio(referencia)) {
        possuiObservacao = true;

        diagnosticoImportacao.observacoes.push({
            registro: numeroRegistro,
            campo: "Referencia",
            mensagem: "Referência vazia."
        });
    }

    const marca =
        linha.Marca ??
        linha.marca ??
        "";

    if (valorVazio(marca)) {
        possuiObservacao = true;

        diagnosticoImportacao.observacoes.push({
            registro: numeroRegistro,
            campo: "Marca",
            mensagem: "Marca vazia."
        });
    }

    const local =
        linha.Local ??
        linha.local ??
        "";

    if (valorVazio(local)) {
        possuiObservacao = true;

        diagnosticoImportacao.observacoes.push({
            registro: numeroRegistro,
            campo: "Local",
            mensagem: "Local vazio."
        });
    }

    const ultimaEntrada =
        linha["Ultima Entrada"] ??
        linha["Última Entrada"] ??
        linha.ultimaEntrada ??
        "";

    if (valorVazio(ultimaEntrada)) {
        possuiObservacao = true;

        diagnosticoImportacao.observacoes.push({
            registro: numeroRegistro,
            campo: "Ultima Entrada",
            mensagem: "Data da última entrada vazia."
        });
    }

    const quantidade =
        linha["Qtde. Est."] ??
        linha["Qtde Est."] ??
        linha.quantidade ??
        "";

    if (!numeroValidoOriginal(quantidade).valido) {
        possuiErro = true;

        diagnosticoImportacao.erros.push({
            registro: numeroRegistro,
            campo: "Qtde. Est.",
            mensagem:
                "Quantidade estimada inválida: " +
                String(quantidade)
        });
    }

    const quantidadeReservada =
        linha["Qtde. Rsr."] ??
        linha["Qtde Rsr."] ??
        linha.quantidadeReservada ??
        "";

    if (!numeroValidoOriginal(quantidadeReservada).valido) {
        possuiErro = true;

        diagnosticoImportacao.erros.push({
            registro: numeroRegistro,
            campo: "Qtde. Rsr.",
            mensagem:
                "Quantidade reservada inválida: " +
                String(quantidadeReservada)
        });
    }

    if (possuiErro) {
        return "ERRO";
    }

    if (possuiObservacao) {
        return "OBSERVACAO";
    }

    diagnosticoImportacao.ok++;

    return "OK";
}


// ============================================================
// FUNÇÃO: converterNumero
// ============================================================
//
// Converte valores do DOGO para Number.
//
// Exemplos:
// "10,50"    -> 10.5
// "1.000,50" -> 1000.5
// vazio      -> 0
//
// ============================================================

function converterNumero(valor) {

    if (valorVazio(valor)) {
        return 0;
    }

    if (typeof valor === "number") {
        return Number.isFinite(valor)
            ? valor
            : 0;
    }

    let texto =
        String(valor)
            .trim()
            .replace(/\s/g, "");

    if (
        texto.includes(".") &&
        texto.includes(",")
    ) {

        texto =
            texto
                .replace(/\./g, "")
                .replace(",", ".");

    } else if (texto.includes(",")) {

        texto =
            texto.replace(",", ".");
    }

    const numero =
        Number(texto);

    return Number.isFinite(numero)
        ? numero
        : 0;
}


// ============================================================
// FUNÇÃO: criarMaterial
// ============================================================
//
// Converte uma linha da planilha para o formato interno PMOBILE.
//
// Nesta fase ainda NÃO existe idSupabase.
// O ID somente será conhecido depois da finalização PostgreSQL.
//
// ============================================================

function criarMaterial(linha) {

    const codigo =
        linha.Produto ??
        linha.produto ??
        linha.Codigo ??
        linha.codigo ??
        "";

    const descricao =
        linha.Descricao ??
        linha.descricao ??
        linha.Descrição ??
        linha.descrição ??
        "";

    const referencia =
        linha.Referencia ??
        linha.referencia ??
        linha.Referência ??
        linha.referência ??
        "";

    const marca =
        linha.Marca ??
        linha.marca ??
        "";

    const local =
        linha.Local ??
        linha.local ??
        "";

    const quantidade =
        converterNumero(
            linha["Qtde. Est."] ??
            linha["Qtde Est."] ??
            linha.quantidade
        );

    const quantidadeReservada =
        converterNumero(
            linha["Qtde. Rsr."] ??
            linha["Qtde Rsr."] ??
            linha.quantidadeReservada
        );

    const ultimaEntrada =
        linha["Ultima Entrada"] ??
        linha["Última Entrada"] ??
        linha.ultimaEntrada ??
        "";

    return {
        codigo:
            valorVazio(codigo)
                ? ""
                : String(codigo).trim(),

        descricao:
            valorVazio(descricao)
                ? ""
                : String(descricao).trim(),

        referencia:
            valorVazio(referencia)
                ? null
                : String(referencia).trim(),

        marca:
            valorVazio(marca)
                ? null
                : String(marca).trim(),

        local:
            valorVazio(local)
                ? null
                : String(local).trim(),

        quantidade,

        quantidadeReservada,

        disponivel:
            quantidade -
            quantidadeReservada,

        ultimaEntrada:
            valorVazio(ultimaEntrada)
                ? null
                : String(ultimaEntrada).trim()
    };
}


// ============================================================
// FUNÇÃO: atualizarDiagnosticoTela
// ============================================================
//
// Exibe o diagnóstico da planilha.
// Limita os detalhes a 50 para evitar travamento do navegador.
//
// ============================================================

function atualizarDiagnosticoTela() {

    const resultado =
        document.getElementById("resultadoImportacao");

    if (!resultado) {
        return;
    }

    const total =
        diagnosticoImportacao.total;

    const observacoes =
        diagnosticoImportacao.observacoes.length;

    const erros =
        diagnosticoImportacao.erros.length;

    const LIMITE_DETALHES = 50;

    let html =
        "<hr>" +
        "<h3>🔎 Diagnóstico da importação</h3>" +
        "<p>" +
        total.toLocaleString("pt-BR") +
        " materiais verificados.</p>" +
        "<p>" +
        (observacoes + erros).toLocaleString("pt-BR") +
        " observações/erros encontrados.</p>";

    html +=
        erros > 0
            ? "<p><strong>🔴 Erros: " +
              erros.toLocaleString("pt-BR") +
              "</strong></p>"
            : "<p><strong>🟢 Erros: 0</strong></p>";

    html +=
        observacoes > 0
            ? "<p><strong>🟡 Observações: " +
              observacoes.toLocaleString("pt-BR") +
              "</strong></p>"
            : "<p><strong>🟢 Observações: 0</strong></p>";

    const detalhes = [
        ...diagnosticoImportacao.erros.map(
            item => ({
                tipo: "🔴",
                item
            })
        ),

        ...diagnosticoImportacao.observacoes.map(
            item => ({
                tipo: "🟡",
                item
            })
        )
    ];

    if (detalhes.length > 0) {

        html +=
            "<p><strong>Detalhes:</strong></p><ul>";

        const quantidadeExibida =
            Math.min(
                detalhes.length,
                LIMITE_DETALHES
            );

        for (
            let i = 0;
            i < quantidadeExibida;
            i++
        ) {

            const detalhe =
                detalhes[i];

            html +=
                "<li>" +
                detalhe.tipo +
                " Registro " +
                detalhe.item.registro +
                ": " +
                detalhe.item.mensagem +
                "</li>";
        }

        html += "</ul>";

        if (
            detalhes.length >
            LIMITE_DETALHES
        ) {

            html +=
                "<p><em>Mostrando os primeiros " +
                LIMITE_DETALHES +
                " detalhes de " +
                detalhes.length.toLocaleString("pt-BR") +
                ".</em></p>";
        }
    }

    html +=
        "<br>" +
        "<button type=\"button\" " +
        "onclick=\"fecharDiagnosticoImportacao()\">" +
        "Fechar" +
        "</button>";

    resultado.innerHTML =
        html;
}


// ============================================================
// FUNÇÃO: fecharDiagnosticoImportacao
// ============================================================

function fecharDiagnosticoImportacao() {

    const resultado =
        document.getElementById("resultadoImportacao");

    if (resultado) {
        resultado.innerHTML = "";
    }
}


// ============================================================
// FUNÇÃO: lerInicioArquivo
// ============================================================
//
// Lê somente os primeiros 100 KB para detectar HTML.
//
// ============================================================

async function lerInicioArquivo(arquivo) {

    const tamanhoLeitura =
        Math.min(
            arquivo.size,
            100 * 1024
        );

    return await arquivo
        .slice(0, tamanhoLeitura)
        .text();
}


// ============================================================
// FUNÇÃO: detectarHTML
// ============================================================
//
// O DOGO pode gerar arquivo com extensão .xls cujo conteúdo real
// é HTML. Esta função detecta esse caso.
//
// ============================================================

function detectarHTML(texto) {

    if (!texto) {
        return false;
    }

    const inicio =
        texto
            .trim()
            .substring(0, 2000)
            .toLowerCase();

    return (
        inicio.includes("<html") ||
        inicio.includes("<table") ||
        inicio.includes("<!doctype html") ||
        inicio.includes("<meta") ||
        inicio.includes("<head")
    );
}


// ============================================================
// FUNÇÃO: limparTextoHTML
// ============================================================
//
// Normaliza texto extraído de células HTML.
//
// ============================================================

function limparTextoHTML(texto) {

    if (
        texto === null ||
        texto === undefined
    ) {
        return "";
    }

    return String(texto)
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}


// ============================================================
// FUNÇÃO: normalizarCabecalho
// ============================================================
//
// Remove acentos e símbolos para facilitar comparação.
//
// ============================================================

function normalizarCabecalho(valor) {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}


// ============================================================
// FUNÇÃO: localizarColuna
// ============================================================

function localizarColuna(
    cabecalhos,
    possibilidades
) {

    const normalizados =
        cabecalhos.map(
            cabecalho =>
                normalizarCabecalho(
                    cabecalho
                )
        );

    for (
        const possibilidade
        of possibilidades
    ) {

        const alvo =
            normalizarCabecalho(
                possibilidade
            );

        const indice =
            normalizados.indexOf(
                alvo
            );

        if (indice !== -1) {
            return indice;
        }
    }

    return -1;
}


// ============================================================
// FUNÇÃO: validarColunas
// ============================================================
//
// Colunas estruturais exigidas:
// Produto, Descrição, Qtde. Est. e Qtde. Rsr.
//
// Esta validação é diferente do diagnóstico de uma linha vazia:
// se a COLUNA não existe, não é possível interpretar o arquivo.
//
// ============================================================

function validarColunas(cabecalhos) {

    const produto =
        localizarColuna(
            cabecalhos,
            [
                "Produto",
                "Codigo",
                "Código"
            ]
        );

    const descricao =
        localizarColuna(
            cabecalhos,
            [
                "Descricao",
                "Descrição"
            ]
        );

    const quantidade =
        localizarColuna(
            cabecalhos,
            [
                "Qtde. Est.",
                "Qtde Est.",
                "Quantidade"
            ]
        );

    const reservada =
        localizarColuna(
            cabecalhos,
            [
                "Qtde. Rsr.",
                "Qtde Rsr.",
                "Quantidade Reservada"
            ]
        );

    const faltantes = [];

    if (produto === -1) {
        faltantes.push("Produto");
    }

    if (descricao === -1) {
        faltantes.push("Descricao");
    }

    if (quantidade === -1) {
        faltantes.push("Qtde. Est.");
    }

    if (reservada === -1) {
        faltantes.push("Qtde. Rsr.");
    }

    return {
        valido:
            faltantes.length === 0,
        faltantes,
        produto,
        descricao,
        quantidade,
        reservada
    };
}


// ============================================================
// FUNÇÃO: criarLinhaPorCabecalhos
// ============================================================

function criarLinhaPorCabecalhos(
    cabecalhos,
    celulas
) {

    const linha = {};

    for (
        let i = 0;
        i < cabecalhos.length;
        i++
    ) {

        linha[cabecalhos[i]] =
            celulas[i] !== undefined
                ? celulas[i]
                : "";
    }

    return linha;
}


// ============================================================
// FUNÇÃO: encontrarTabelaHTML
// ============================================================
//
// Analisa as tabelas do HTML e escolhe aquela cujo cabeçalho
// melhor corresponde ao estoque do DOGO.
//
// ============================================================

function encontrarTabelaHTML(documento) {

    const tabelas =
        Array.from(
            documento.querySelectorAll("table")
        );

    if (!tabelas.length) {
        return null;
    }

    let melhorTabela = null;
    let maiorPontuacao = -1;

    for (const tabela of tabelas) {

        const linhas =
            Array.from(
                tabela.querySelectorAll("tr")
            );

        if (!linhas.length) {
            continue;
        }

        let melhorCabecalho = null;
        let melhorPontuacaoTabela = -1;

        for (
            let i = 0;
            i < Math.min(linhas.length, 20);
            i++
        ) {

            const cabecalhos =
                Array.from(
                    linhas[i]
                        .querySelectorAll("th, td")
                ).map(
                    celula =>
                        limparTextoHTML(
                            celula.textContent
                        )
                );

            const validacao =
                validarColunas(
                    cabecalhos
                );

            let pontuacao = 0;

            if (validacao.produto !== -1) {
                pontuacao += 3;
            }

            if (validacao.descricao !== -1) {
                pontuacao += 3;
            }

            if (validacao.quantidade !== -1) {
                pontuacao += 2;
            }

            if (validacao.reservada !== -1) {
                pontuacao += 2;
            }

            if (
                pontuacao >
                melhorPontuacaoTabela
            ) {

                melhorPontuacaoTabela =
                    pontuacao;

                melhorCabecalho =
                    i;
            }
        }

        if (
            melhorPontuacaoTabela >
            maiorPontuacao
        ) {

            maiorPontuacao =
                melhorPontuacaoTabela;

            melhorTabela = {
                tabela,
                indiceCabecalho:
                    melhorCabecalho,
                pontuacao:
                    melhorPontuacaoTabela
            };
        }
    }

    if (
        !melhorTabela ||
        maiorPontuacao < 10
    ) {
        return null;
    }

    return melhorTabela;
}


// ============================================================
// FUNÇÃO: processarArquivoHTML
// ============================================================
//
// Processa o HTML exportado pelo DOGO.
//
// ============================================================

async function processarArquivoHTML(arquivo) {

    atualizarBarraProgresso(
        0,
        "📄 Processando arquivo DOGO..."
    );

    const texto =
        await arquivo.text();

    if (
        !texto ||
        texto.trim() === ""
    ) {

        throw new Error(
            "O arquivo DOGO está vazio."
        );
    }

    const parser =
        new DOMParser();

    const documento =
        parser.parseFromString(
            texto,
            "text/html"
        );

    const resultadoTabela =
        encontrarTabelaHTML(
            documento
        );

    if (!resultadoTabela) {

        throw new Error(
            "Nenhuma tabela de estoque compatível foi encontrada no arquivo DOGO."
        );
    }

    const tabela =
        resultadoTabela.tabela;

    const linhas =
        Array.from(
            tabela.querySelectorAll("tr")
        );

    const indiceCabecalho =
        resultadoTabela.indiceCabecalho;

    const linhaCabecalho =
        linhas[indiceCabecalho];

    const cabecalhos =
        Array.from(
            linhaCabecalho
                .querySelectorAll("th, td")
        ).map(
            celula =>
                limparTextoHTML(
                    celula.textContent
                )
        );

    const validacao =
        validarColunas(
            cabecalhos
        );

    if (!validacao.valido) {

        throw new Error(
            "Colunas obrigatórias não encontradas: " +
            validacao.faltantes.join(", ")
        );
    }

    atualizarBarraProgresso(
        5,
        "📄 Processando arquivo DOGO..."
    );

    const novoInventario = [];

    for (
        let i = indiceCabecalho + 1;
        i < linhas.length;
        i++
    ) {

        const celulas =
            Array.from(
                linhas[i]
                    .querySelectorAll("td, th")
            );

        if (!celulas.length) {
            continue;
        }

        const valores =
            celulas.map(
                celula =>
                    limparTextoHTML(
                        celula.textContent
                    )
            );

        const possuiConteudo =
            valores.some(
                valor =>
                    !valorVazio(valor)
            );

        if (!possuiConteudo) {
            continue;
        }

        const linha =
            criarLinhaPorCabecalhos(
                cabecalhos,
                valores
            );

        const numeroRegistro =
            novoInventario.length + 1;

        analisarMaterialImportado(
            linha,
            numeroRegistro
        );

        novoInventario.push(
            criarMaterial(linha)
        );

        if (
            novoInventario.length %
            1000 ===
            0
        ) {

            const totalLinhas =
                Math.max(
                    1,
                    linhas.length -
                    (indiceCabecalho + 1)
                );

            const percentual =
                5 +
                (
                    novoInventario.length /
                    totalLinhas
                ) *
                45;

            atualizarBarraProgresso(
                Math.min(
                    50,
                    percentual
                ),
                "📄 Processando arquivo DOGO..."
            );

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        0
                    )
            );
        }
    }

    if (!novoInventario.length) {

        throw new Error(
            "A tabela foi encontrada, mas nenhum registro de material foi extraído."
        );
    }

    atualizarBarraProgresso(
        50,
        "📄 Arquivo DOGO processado."
    );

    return novoInventario;
}


// ============================================================
// FUNÇÃO: processarArquivoExcel
// ============================================================
//
// Processa um Excel verdadeiro usando SheetJS.
//
// ============================================================

async function processarArquivoExcel(arquivo) {

    if (
        typeof XLSX ===
        "undefined"
    ) {

        throw new Error(
            "A biblioteca XLSX não foi carregada."
        );
    }

    const arrayBuffer =
        await arquivo.arrayBuffer();

    const workbook =
        XLSX.read(
            arrayBuffer,
            {
                type: "array"
            }
        );

    if (
        !workbook.SheetNames ||
        workbook.SheetNames.length === 0
    ) {

        throw new Error(
            "Nenhuma planilha encontrada no arquivo Excel."
        );
    }

    const planilha =
        workbook.Sheets[
            workbook.SheetNames[0]
        ];

    const linhas =
        XLSX.utils.sheet_to_json(
            planilha,
            {
                defval: ""
            }
        );

    if (!linhas.length) {

        throw new Error(
            "A planilha não possui registros."
        );
    }

    // No Excel verdadeiro, também conferimos se as colunas
    // estruturais necessárias realmente existem.
    const cabecalhos =
        Object.keys(linhas[0] || {});

    const validacao =
        validarColunas(
            cabecalhos
        );

    if (!validacao.valido) {

        throw new Error(
            "Colunas obrigatórias não encontradas: " +
            validacao.faltantes.join(", ")
        );
    }

    const novoInventario = [];

    for (
        let i = 0;
        i < linhas.length;
        i++
    ) {

        const linha =
            linhas[i];

        const possuiConteudo =
            Object.values(linha).some(
                valor =>
                    !valorVazio(valor)
            );

        if (!possuiConteudo) {
            continue;
        }

        const numeroRegistro =
            novoInventario.length + 1;

        analisarMaterialImportado(
            linha,
            numeroRegistro
        );

        novoInventario.push(
            criarMaterial(linha)
        );

        if (
            novoInventario.length %
            1000 ===
            0
        ) {

            const percentual =
                (
                    novoInventario.length /
                    linhas.length
                ) *
                50;

            atualizarBarraProgresso(
                Math.min(
                    50,
                    percentual
                ),
                "📄 Processando arquivo Excel..."
            );

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        0
                    )
            );
        }
    }

    if (!novoInventario.length) {

        throw new Error(
            "Nenhum material foi encontrado na planilha."
        );
    }

    atualizarBarraProgresso(
        50,
        "📄 Arquivo Excel processado."
    );

    return novoInventario;
}


// ============================================================
// FUNÇÃO: gerarIdImportacao
// ============================================================
//
// Gera o UUID usado para identificar a carga temporária.
//
// crypto.randomUUID() é preferido.
// O fallback mantém compatibilidade com navegadores que não
// oferecem randomUUID.
//
// ============================================================

function gerarIdImportacao() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
        "function"
    ) {

        return window.crypto.randomUUID();
    }

    // UUID v4 compatível para fallback.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
        .replace(
            /[xy]/g,
            function (caractere) {

                const aleatorio =
                    Math.floor(
                        Math.random() * 16
                    );

                const valor =
                    caractere === "x"
                        ? aleatorio
                        : (
                            aleatorio &
                            0x3 |
                            0x8
                        );

                return valor.toString(16);
            }
        );
}


// ============================================================
// FUNÇÃO: limparStagingImportacao
// ============================================================
//
// Remove somente os registros temporários pertencentes ao UUID
// da importação atual.
//
// É usada principalmente se o envio de algum lote falhar antes
// da chamada da função PostgreSQL.
//
// Uma falha nessa limpeza NÃO deve esconder o erro original.
//
// ============================================================

async function limparStagingImportacao(
    importacaoId
) {

    if (
        !window.clienteSupabase ||
        !importacaoId
    ) {
        return;
    }

    const {
        error
    } =
        await window.clienteSupabase
            .from(
                "materiais_importacao_temporaria"
            )
            .delete()
            .eq(
                "importacao_id",
                importacaoId
            );

    if (error) {

        console.warn(
            "Não foi possível limpar a staging da importação:",
            error
        );
    }
}


// ============================================================
// FUNÇÃO: prepararImportacaoNoSupabase
// ============================================================
//
// Envia os materiais para a tabela temporária.
//
// DIFERENÇA PARA A VERSÃO ANTIGA:
// A versão antiga apagava public.materiais ANTES de enviar os
// novos lotes.
//
// Esta versão NÃO toca no inventário oficial durante o upload.
// Portanto, se internet cair no lote 80, public.materiais ainda
// contém integralmente o estoque anterior.
//
// Cada registro recebe:
// - importacao_id -> UUID desta tentativa
// - ordem         -> posição original na planilha
//
// ============================================================

async function prepararImportacaoNoSupabase(
    materiais,
    importacaoId
) {

    let enviados = 0;

    for (
        let inicio = 0;
        inicio < materiais.length;
        inicio += TAMANHO_LOTE_SUPABASE
    ) {

        const lote =
            materiais
                .slice(
                    inicio,
                    inicio +
                    TAMANHO_LOTE_SUPABASE
                )
                .map(
                    function (
                        material,
                        indiceLote
                    ) {

                        return {
                            importacao_id:
                                importacaoId,

                            // +1 para a ordem começar em 1.
                            ordem:
                                inicio +
                                indiceLote +
                                1,

                            codigo:
                                material.codigo,

                            descricao:
                                material.descricao,

                            referencia:
                                material.referencia,

                            marca:
                                material.marca,

                            local:
                                material.local,

                            quantidade:
                                material.quantidade,

                            quantidade_reservada:
                                material.quantidadeReservada,

                            disponivel:
                                material.disponivel,

                            ultima_entrada:
                                material.ultimaEntrada
                        };
                    }
                );

        const {
            error
        } =
            await window.clienteSupabase
                .from(
                    "materiais_importacao_temporaria"
                )
                .insert(lote);

        if (error) {

            throw new Error(
                "Erro ao preparar o lote " +
                (
                    Math.floor(
                        inicio /
                        TAMANHO_LOTE_SUPABASE
                    ) +
                    1
                ) +
                " no Supabase: " +
                error.message
            );
        }

        enviados +=
            lote.length;

        // Upload ocupa 50% até 90%.
        const percentual =
            50 +
            (
                enviados /
                materiais.length
            ) *
            40;

        atualizarBarraProgresso(
            percentual,
            "☁️ Preparando novo inventário no Supabase..."
        );

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    0
                )
        );
    }

    return enviados;
}


// ============================================================
// FUNÇÃO: finalizarImportacaoNoPostgreSQL
// ============================================================
//
// Chama a função criada no PostgreSQL:
//
// public.pmobile_finalizar_importacao_materiais(uuid)
//
// A função executa:
// 1. conta a staging;
// 2. apaga public.materiais;
// 3. insere o novo inventário;
// 4. confere a quantidade inserida;
// 5. limpa a staging;
// 6. retorna a quantidade inserida.
//
// Tudo acontece dentro da mesma transação da RPC.
// Qualquer erro faz rollback da substituição.
//
// ============================================================

async function finalizarImportacaoNoPostgreSQL(
    importacaoId,
    quantidadeEsperada
) {

    atualizarBarraProgresso(
        92,
        "🗄️ Finalizando inventário no PostgreSQL..."
    );

    const {
        data,
        error
    } =
        await window.clienteSupabase
            .rpc(
                "pmobile_finalizar_importacao_materiais",
                {
                    p_importacao_id:
                        importacaoId
                }
            );

    if (error) {

        throw new Error(
            "O PostgreSQL não conseguiu finalizar a importação: " +
            error.message
        );
    }

    const quantidadeInserida =
        Number(data ?? 0);

    if (
        quantidadeInserida !==
        quantidadeEsperada
    ) {

        // A própria função PostgreSQL já confere staging x insert.
        // Esta segunda verificação protege também o cliente.
        throw new Error(
            "A importação foi finalizada, mas a quantidade retornada pelo banco (" +
            quantidadeInserida.toLocaleString("pt-BR") +
            ") é diferente da quantidade esperada (" +
            quantidadeEsperada.toLocaleString("pt-BR") +
            ")."
        );
    }

    return quantidadeInserida;
}


// ============================================================
// FUNÇÃO: buscarInventarioOficialDoSupabase
// ============================================================
//
// Depois da substituição, os IDs oficiais são gerados pela
// coluna identity de public.materiais.
//
// Por isso, a cópia IndexedDB NÃO deve usar diretamente os
// objetos da planilha. Precisamos ler os registros oficiais.
//
// A leitura é paginada para não depender do limite padrão da API.
//
// ============================================================

async function buscarInventarioOficialDoSupabase(
    quantidadeEsperada
) {

    const inventarioOficial = [];

    let inicio = 0;

    while (true) {

        const fim =
            inicio +
            TAMANHO_PAGINA_COPIA_LOCAL -
            1;

        const {
            data,
            error
        } =
            await window.clienteSupabase
                .from("materiais")
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

        if (error) {

            throw new Error(
                "Inventário central foi atualizado, mas não foi possível baixar a cópia offline: " +
                error.message
            );
        }

        if (
            !data ||
            data.length === 0
        ) {
            break;
        }

        inventarioOficial.push(
            ...data
        );

        const percentual =
            quantidadeEsperada > 0
                ? 95 +
                  Math.min(
                      5,
                      (
                          inventarioOficial.length /
                          quantidadeEsperada
                      ) *
                      5
                  )
                : 100;

        atualizarBarraProgresso(
            percentual,
            "💾 Atualizando cópia offline..."
        );

        if (
            data.length <
            TAMANHO_PAGINA_COPIA_LOCAL
        ) {
            break;
        }

        inicio +=
            TAMANHO_PAGINA_COPIA_LOCAL;

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    0
                )
        );
    }

    if (
        inventarioOficial.length !==
        quantidadeEsperada
    ) {

        throw new Error(
            "O Supabase possui " +
            inventarioOficial.length.toLocaleString("pt-BR") +
            " materiais na leitura pós-importação, mas eram esperados " +
            quantidadeEsperada.toLocaleString("pt-BR") +
            ". A importação central foi concluída; a cópia offline não será substituída."
        );
    }

    return inventarioOficial;
}


// ============================================================
// FUNÇÃO: salvarInventarioLocalComIds
// ============================================================
//
// Salva a cópia offline SOMENTE depois que os IDs oficiais
// estiverem disponíveis.
//
// Prioridade:
// 1. salvarCopiaLocalDoSupabase() -> função própria de dados.js.
// 2. salvarMateriais() -> fallback compatível.
//
// O fallback normaliza manualmente os nomes de campos vindos do
// PostgreSQL para o formato interno esperado pelo PMOBILE.
//
// ============================================================

async function salvarInventarioLocalComIds(
    inventarioSupabase
) {

    if (
        typeof salvarCopiaLocalDoSupabase ===
        "function"
    ) {

        await salvarCopiaLocalDoSupabase(
            inventarioSupabase
        );

        return;
    }

    if (
        typeof salvarMateriais !==
        "function"
    ) {

        throw new Error(
            "Nenhuma função de gravação do IndexedDB está disponível."
        );
    }

    const inventarioNormalizado =
        inventarioSupabase.map(
            material => ({
                id:
                    material.id,

                idSupabase:
                    material.id,

                codigo:
                    material.codigo ?? "",

                descricao:
                    material.descricao ?? "",

                referencia:
                    material.referencia ?? null,

                marca:
                    material.marca ?? null,

                local:
                    material.local ?? null,

                quantidade:
                    Number(
                        material.quantidade ?? 0
                    ),

                quantidadeReservada:
                    Number(
                        material.quantidade_reservada ?? 0
                    ),

                disponivel:
                    Number(
                        material.disponivel ?? 0
                    ),

                ultimaEntrada:
                    material.ultima_entrada ?? null
            })
        );

    await salvarMateriais(
        inventarioNormalizado
    );

    if (
        typeof materiais !==
        "undefined"
    ) {

        materiais =
            inventarioNormalizado;
    }
}


// ============================================================
// FUNÇÃO: importarParaSupabase
// ============================================================
//
// ORQUESTRADOR DA IMPORTAÇÃO CENTRAL.
//
// FLUXO NOVO:
// 1. gera UUID;
// 2. envia TODOS os lotes para staging;
// 3. chama RPC transacional;
// 4. somente depois busca IDs oficiais;
// 5. salva IndexedDB.
//
// O inventário oficial NÃO é apagado pelo JavaScript.
//
// ============================================================

async function importarParaSupabase(materiaisNovos) {

    if (!window.clienteSupabase) {

        throw new Error(
            "Cliente Supabase não está disponível."
        );
    }

    if (
        importacaoSupabaseEmAndamento
    ) {

        throw new Error(
            "Já existe uma importação para o Supabase em andamento."
        );
    }

    if (
        !Array.isArray(materiaisNovos) ||
        materiaisNovos.length === 0
    ) {

        throw new Error(
            "Não existem materiais para importar."
        );
    }

    importacaoSupabaseEmAndamento =
        true;

    const importacaoId =
        gerarIdImportacao();

    let finalizacaoConcluida =
        false;

    try {

        atualizarBarraProgresso(
            50,
            "☁️ Preparando novo inventário no Supabase..."
        );

        const quantidadePreparada =
            await prepararImportacaoNoSupabase(
                materiaisNovos,
                importacaoId
            );

        if (
            quantidadePreparada !==
            materiaisNovos.length
        ) {

            throw new Error(
                "A quantidade preparada no Supabase não corresponde à quantidade da planilha."
            );
        }

        await finalizarImportacaoNoPostgreSQL(
            importacaoId,
            materiaisNovos.length
        );

        finalizacaoConcluida =
            true;

        // A partir deste ponto public.materiais já contém o novo
        // inventário. Se a cópia local falhar, NÃO fazemos rollback
        // do central porque a transação já foi concluída.
        const inventarioOficial =
            await buscarInventarioOficialDoSupabase(
                materiaisNovos.length
            );

        await salvarInventarioLocalComIds(
            inventarioOficial
        );

        atualizarBarraProgresso(
            100,
            "✅ Inventário central e cópia offline atualizados."
        );

        return {
            importacaoId,
            quantidade:
                materiaisNovos.length,
            inventarioOficial
        };

    } catch (erro) {

        // Se a RPC ainda não concluiu, podemos remover a carga
        // temporária desta tentativa.
        if (!finalizacaoConcluida) {

            try {

                await limparStagingImportacao(
                    importacaoId
                );

            } catch (erroLimpeza) {

                console.warn(
                    "Falha adicional ao limpar staging:",
                    erroLimpeza
                );
            }
        }

        throw erro;

    } finally {

        importacaoSupabaseEmAndamento =
            false;
    }
}


// ============================================================
// FUNÇÃO: importarExcel
// ============================================================
//
// Função principal chamada pelo HTML.
//
// IMPORTANTE:
// A versão antiga salvava o inventário da planilha no IndexedDB
// ANTES do Supabase. Como esses objetos ainda não possuíam ID,
// dados.js podia rejeitá-los.
//
// Nesta versão o IndexedDB somente é atualizado dentro de
// importarParaSupabase(), DEPOIS da finalização central e da
// recuperação dos IDs oficiais.
//
// ============================================================

async function importarExcel() {

    const input =
        document.getElementById(
            "arquivoExcel"
        );

    const resultado =
        document.getElementById(
            "resultadoImportacao"
        );

    if (!input) {

        alert(
            "Campo de arquivo não encontrado."
        );

        return;
    }

    if (
        !input.files ||
        !input.files.length
    ) {

        alert(
            "Selecione um arquivo para importar."
        );

        return;
    }

    const arquivo =
        input.files[0];

    const tamanhoMB =
        arquivo.size /
        (1024 * 1024);

    if (
        tamanhoMB >
        LIMITE_ARQUIVO_MB
    ) {

        alert(
            "O arquivo possui " +
            tamanhoMB.toFixed(2) +
            " MB.\n\n" +
            "O limite é " +
            LIMITE_ARQUIVO_MB +
            " MB."
        );

        return;
    }

    iniciarDiagnosticoImportacao();

    atualizarBarraProgresso(
        0,
        "🔎 Analisando arquivo..."
    );

    try {

        const inicioArquivo =
            await lerInicioArquivo(
                arquivo
            );

        const ehHTML =
            detectarHTML(
                inicioArquivo
            );

        let novoInventario;

        if (ehHTML) {

            novoInventario =
                await processarArquivoHTML(
                    arquivo
                );

        } else {

            novoInventario =
                await processarArquivoExcel(
                    arquivo
                );
        }

        // O diagnóstico é informativo.
        // Ele NÃO bloqueia código ou descrição vazios.
        atualizarDiagnosticoTela();

        // IMPORTANTE:
        // Não salvamos novoInventario diretamente no IndexedDB.
        // Primeiro o Supabase cria os IDs oficiais.
        const resultadoImportacao =
            await importarParaSupabase(
                novoInventario
            );

        try {

            localStorage.removeItem(
                "pmobile_inventario_zerado"
            );

        } catch (erroMarcador) {

            console.warn(
                "Não foi possível atualizar o marcador de inventário.",
                erroMarcador
            );
        }

        if (resultado) {

            resultado.innerHTML =
                "<p><strong>✅ Importação concluída!</strong></p>" +

                "<div style=\"" +
                    "width:100%;" +
                    "height:22px;" +
                    "background:#e5e7eb;" +
                    "border-radius:11px;" +
                    "overflow:hidden;" +
                    "margin:10px 0;" +
                "\">" +

                    "<div style=\"" +
                        "width:100%;" +
                        "height:100%;" +
                        "background:#16a34a;" +
                    "\"></div>" +

                "</div>" +

                "<p style=\"text-align:center;\"><strong>100%</strong></p>" +

                "<p>📦 Materiais importados: " +
                resultadoImportacao
                    .quantidade
                    .toLocaleString("pt-BR") +
                "</p>" +

                "<p>☁️ Supabase: atualizado.</p>" +
                "<p>💾 Cópia offline: atualizada com IDs oficiais.</p>";
        }

    } catch (erro) {

        console.error(
            "Erro durante a importação:",
            erro
        );

        if (resultado) {

            resultado.innerHTML =
                "<p>❌ <strong>Erro durante a importação.</strong></p>" +
                "<p>" +
                (
                    erro.message ||
                    String(erro)
                ) +
                "</p>";
        }
    }
}
