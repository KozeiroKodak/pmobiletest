// PMCOLETAS - Parser de Rastreio em Web Worker
// Mantém o SheetJS fora da thread principal para impedir congelamento do WebView.

importScripts("https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js");

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
        valorFreteEmbutido: achar(
            "Valor Frete Embutido",
            "Frete Embutido",
            "Frete Imbutido",
            "Valor Frete Imbutido"
        ),
        valorFrete: achar("Frete Transporte", "Valor Frete", "Frete Transportadora", "Valor do Frete", "Frete"),
        custoNunes: achar("Custo Nunes", "Custo Nunes:"),
        custoFinal: achar("Custo Final"),
        dataEnvio: achar("Data Envio", "Data de Envio"),
        turno: achar("Turno Envio", "Turno")
    };
}

function postarProgresso(mensagem, percentual = 0, etapa = "Processando") {
    self.postMessage({
        tipo: "progresso",
        mensagem,
        detalhe: mensagem,
        percentual,
        etapa
    });
}

function erroMensagem(erro) {
    return erro?.message || String(erro || "Erro desconhecido ao processar planilha.");
}

self.addEventListener("message", async evento => {
    const dados = evento.data || {};

    try {
        if (!(dados.buffer instanceof ArrayBuffer)) {
            throw new Error("O arquivo de Rastreio não foi transferido para o processador.");
        }

        const buffer = dados.buffer;
        const nomeArquivo = String(dados.nomeArquivo || "rastreio.xlsx");
        const opcoesExcelBase = {
            type: "array",
            cellDates: true,
            cellHTML: false,
            cellFormula: false,
            cellStyles: false,
            cellText: false,
            cellNF: false,
            bookDeps: false,
            bookVBA: false,
            // Leitura esparsa: a planilha pode declarar milhares de colunas
            // residuais (ex.: XCN), mas o Rastreio usa somente A:O.
            // dense:true força arrays gigantes por linha e pode prender o
            // WebView justamente na etapa inicial de abertura.
            dense: false,

            // Algumas exportações Excel deixam !ref muito maior que os
            // dados reais (ex.: LANÇAMENTOS = A1:XCN9428). O nodim faz o
            // SheetJS recalcular a dimensão a partir das células existentes,
            // evitando que a dimensão inflada contamine a leitura.
            nodim: true
        };

        postarProgresso(
            "Abrindo o arquivo e localizando a aba LANÇAMENTOS...",
            8,
            "Analisando estrutura"
        );

        // A fonte oficial do Rastreio é a aba LANÇAMENTOS.
        // O workbook é aberto UMA única vez. A versão anterior fazia um
        // XLSX.read limitado para localizar o cabeçalho e depois outro
        // XLSX.read completo, duplicando o custo de descompactar/analisar
        // arquivos .xlsm grandes no WebView Android.
        const nomeAba = "LANÇAMENTOS";

        postarProgresso(
            "Abrindo a planilha uma única vez. Esta é a etapa mais pesada do processamento...",
            12,
            "Abrindo planilha"
        );

        // Entrega o diagnóstico de 12% à interface antes da operação
        // síncrona mais pesada do SheetJS.
        await new Promise(resolve => setTimeout(resolve, 50));

        const workbook = XLSX.read(buffer, {
            ...opcoesExcelBase,
            sheets: nomeAba
        });

        postarProgresso(
            "Planilha aberta. Localizando a aba LANÇAMENTOS...",
            45,
            "Localizando aba"
        );

        const sheet = workbook.Sheets[nomeAba];
        if (!sheet) {
            throw new Error("A aba LANÇAMENTOS não foi encontrada na planilha.");
        }

        // Mesmo com nodim, a fonte de Rastreio só utiliza A:O.
        // Limitar !ref aqui protege as etapas seguintes contra resíduos
        // de dimensão e mantém o contrato do parser explícito.
        let limiteLinha = 0;
        if (sheet["!ref"]) {
            const refAtual = XLSX.utils.decode_range(sheet["!ref"]);
            limiteLinha = refAtual.e.r;
            refAtual.s.c = 0;
            refAtual.e.c = 14;
            sheet["!ref"] = XLSX.utils.encode_range(refAtual);
        }

        postarProgresso(
            "Aba LANÇAMENTOS encontrada. Convertendo as linhas para análise...",
            55,
            "Lendo lançamentos"
        );

        // A operação usa somente as 15 primeiras colunas (A:O) da aba LANÇAMENTOS.
        // Algumas planilhas carregam resíduos/formatação até XFD; limitar o range
        // evita que o SheetJS monte milhares de colunas desnecessárias.
        const matriz = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            range: { s: { r: 0, c: 0 }, e: { r: limiteLinha, c: 14 } },
            raw: true,
            blankrows: false
        });

        postarProgresso(
            "Linhas carregadas. Identificando o cabeçalho nas primeiras linhas...",
            78,
            "Localizando cabeçalho"
        );

        let indiceCabecalho = -1;
        let colunas = null;
        let modelo = null;

        for (let indice = 0; indice < Math.min(matriz.length, 30); indice++) {
            const colunasCandidata = normalizarColunasRastreio(
                matriz[indice] || []
            );
            const modeloCandidato = detectarModeloRastreio(colunasCandidata);

            if (
                modeloCandidato.cliente &&
                modeloCandidato.notaFiscal &&
                modeloCandidato.dataEnvio &&
                modeloCandidato.turno
            ) {
                indiceCabecalho = indice;
                colunas = colunasCandidata;
                modelo = modeloCandidato;
                break;
            }
        }

        if (!colunas || !modelo || indiceCabecalho < 0) {
            throw new Error(
                "Não consegui identificar o cabeçalho da aba LANÇAMENTOS com Cliente, Nota Fiscal, Data Envio e Turno."
            );
        }

        postarProgresso(
            "Cabeçalho encontrado. Mapeando as colunas da planilha...",
            84,
            "Mapeando colunas"
        );

        const modeloIndices = {};
        Object.keys(modelo).forEach(chave => {
            modeloIndices[chave] =
                modelo[chave] ? colunas.indexOf(modelo[chave]) : -1;
        });

        const deslocamentoLinha = indiceCabecalho + 2;
        matriz.splice(0, indiceCabecalho + 1);
        const linhas = matriz;

        postarProgresso(
            "Linhas carregadas. Validando quantidade e preparando a integridade do arquivo...",
            90,
            "Validando dados"
        );

        if (!linhas.length) {
            throw new Error("A planilha possui cabeçalho, mas nenhuma linha de dados.");
        }

        postarProgresso(
            "Calculando SHA-256 do arquivo para detectar alterações futuras...",
            94,
            "Calculando integridade"
        );

        const sha256Buffer = await crypto.subtle.digest("SHA-256", buffer);
        const sha256 = Array.from(new Uint8Array(sha256Buffer))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");

        postarProgresso(
            "Arquivo processado com sucesso.",
            100,
            "Concluído"
        );

        self.postMessage({
            tipo: "resultado",
            resultado: {
                nomeAba,
                indiceCabecalho,
                colunas,
                modelo,
                modeloIndices,
                deslocamentoLinha,
                linhas,
                sha256,
                tamanhoBytes: Number(dados.tamanhoBytes || buffer.byteLength)
            }
        });
    } catch (erro) {
        self.postMessage({
            tipo: "erro",
            mensagem: erroMensagem(erro)
        });
    }
}, false);
