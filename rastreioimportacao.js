// PMOBILE - Importação manual de Rastreio
// Usa o mesmo padrão de leitura da Importação NF, mas transforma
// cada linha operacional em um rastreio independente.

const TAMANHO_LOTE_RASTREIO = 250;
let importacaoRastreioEmAndamento = false;
let dadosImportacaoRastreio = null;
let mapaMotoristasRastreio = {};

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

async function prepararImportacaoRastreio() {
    const arquivo = document.getElementById("arquivoRastreio")?.files?.[0];
    if (!arquivo) return;

    if (!window.XLSX) {
        mostrarStatusImportacaoRastreio("🔴 Biblioteca Excel ainda não carregada.");
        return;
    }

    try {
        mostrarStatusImportacaoRastreio("🟡 Lendo planilha de Rastreio...");

        const buffer = await arquivo.arrayBuffer();
        const workbook = window.XLSX.read(buffer, { type: "array", cellDates: false });

        if (!workbook.SheetNames?.length) {
            throw new Error("A planilha não possui uma aba utilizável.");
        }

        // O arquivo operacional pode ter abas auxiliares antes de LANÇAMENTOS
        // (por exemplo, RESUMO). Procura a primeira aba compatível com os
        // campos de rastreio, dando preferência explícita a LANÇAMENTOS.
        const ordemAbas = [
            ...workbook.SheetNames.filter(nome => normalizarChaveRastreio(nome) === "LANCAMENTOS"),
            ...workbook.SheetNames.filter(nome => normalizarChaveRastreio(nome) !== "LANCAMENTOS")
        ];

        let nomeAba = null;
        let matriz = null;
        let colunas = null;
        let modelo = null;

        for (const candidata of ordemAbas) {
            const matrizCandidata = window.XLSX.utils.sheet_to_json(workbook.Sheets[candidata], {
                header: 1,
                defval: null,
                raw: false,
                blankrows: false
            });

            if (!matrizCandidata.length) continue;

            // Algumas planilhas possuem títulos/linhas auxiliares antes do cabeçalho.
            // Procura o cabeçalho real nas primeiras 30 linhas.
            const limiteCabecalho = Math.min(matrizCandidata.length, 30);

            for (let indiceCabecalho = 0; indiceCabecalho < limiteCabecalho; indiceCabecalho++) {
                const linhaCabecalho = matrizCandidata[indiceCabecalho] || [];
                const colunasCandidata = normalizarColunasRastreio(linhaCabecalho);
                const modeloCandidato = detectarModeloRastreio(colunasCandidata);

                if (modeloCandidato.cliente && modeloCandidato.notaFiscal &&
                    modeloCandidato.dataEnvio && modeloCandidato.turno) {
                    nomeAba = candidata;
                    matriz = matrizCandidata.slice(indiceCabecalho);
                    colunas = colunasCandidata;
                    modelo = modeloCandidato;
                    break;
                }
            }

            if (nomeAba) break;
        }

        if (!nomeAba || !matriz || !colunas || !modelo) {
            throw new Error(
                "Não consegui identificar uma aba de lançamentos com Cliente, Nota Fiscal, Data Envio e Turno. " +
                "Confira os cabeçalhos da planilha."
            );
        }
        const linhas = [];

        for (let i = 1; i < matriz.length; i++) {
            const valores = Array.isArray(matriz[i]) ? matriz[i] : [];
            if (valores.every(v => v == null || String(v).trim() === "")) continue;

            const dados = {};
            colunas.forEach((coluna, indice) => {
                let valor = indice < valores.length ? valores[indice] : null;
                if (valor === undefined || valor === "") valor = null;
                dados[coluna] = valor;
            });

            linhas.push({ linha_numero: i + 1, dados });
        }

        if (!linhas.length) throw new Error("A planilha possui cabeçalho, mas nenhuma linha de dados.");

        const sha256 = await calcularSha256Rastreio(buffer);
        dadosImportacaoRastreio = {
            arquivo,
            nomeAba,
            colunas,
            linhas,
            sha256,
            tamanhoBytes: arquivo.size,
            modelo
        };

        mapaMotoristasRastreio = montarMapaMotoristasInicial(linhas, modelo);
        renderizarPreviaImportacaoRastreio();
        mostrarStatusImportacaoRastreio("🟢 Planilha analisada. Revise os motoristas antes de enviar.");
    } catch (erro) {
        console.error("Erro ao preparar Rastreio:", erro);
        dadosImportacaoRastreio = null;
        mostrarStatusImportacaoRastreio("🔴 " + (erro.message || "Não foi possível ler a planilha."));
    }
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
        cliente: achar("Cliente", "Destinatário"),
        notaFiscal: achar("Nota Fiscal", "NF", "Notas Fiscais"),
        transportadora: achar("Transportadora", "Transportador"),
        motorista: achar("Motorista"),
        regiao: achar("Região", "Regiao", "Cidade", "Destino"),
        volume: achar("Volume", "Volumes"),
        peso: achar("Peso"),
        valorNF: achar("Valor NF", "Valor"),
        dataEnvio: achar("Data Envio", "Data de Envio"),
        turno: achar("Turno Envio", "Turno")
    };
}

function montarMapaMotoristasInicial(linhas, modelo) {
    const mapa = {};
    if (modelo.motorista) return mapa;

    linhas.forEach(linha => {
        const regiao = String(linha.dados?.[modelo.regiao] ?? "").trim();
        if (regiao && !(regiao in mapa)) mapa[regiao] = "";
    });

    return mapa;
}

function montarMapaMotoristasUI() {
    const area = document.getElementById("rastreioMapaMotoristas");
    if (!area || !dadosImportacaoRastreio) return;

    const modelo = dadosImportacaoRastreio.modelo;

    if (modelo.motorista) {
        area.innerHTML =
            '<div class="rastreio-importacao-aviso">✓ A planilha já possui a coluna <strong>Motorista</strong>. Nenhum preenchimento adicional é necessário.</div>';
        return;
    }

    const regioes = Object.keys(mapaMotoristasRastreio);

    if (!regioes.length) {
        area.innerHTML =
            '<div class="rastreio-importacao-aviso">Não foi encontrada uma região/destino para montar o vínculo de motorista.</div>';
        return;
    }

    area.innerHTML =
        '<div class="rastreio-importacao-motoristas-titulo">' +
            '<strong>Motorista por região</strong>' +
            '<span>Preencha uma vez. O PMOBILE aplicará ao conjunto de linhas daquela região.</span>' +
        '</div>' +
        '<div class="rastreio-importacao-motoristas-lista">' +
            regioes.map(regiao =>
                '<label>' +
                    '<span>' + escaparHtmlRastreio(regiao) + '</span>' +
                    '<input type="text" data-regiao-motorista="' + escaparHtmlRastreio(regiao) + '"' +
                        ' value="' + escaparHtmlRastreio(mapaMotoristasRastreio[regiao]) + '"' +
                        ' placeholder="Nome do motorista">' +
                '</label>'
            ).join("") +
        '</div>';
}

function capturarMapaMotoristasUI() {
    document.querySelectorAll("[data-regiao-motorista]").forEach(input => {
        mapaMotoristasRastreio[input.dataset.regiaoMotorista] = input.value.trim();
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
    const br = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (br) {
        return br[3] + "-" + br[2].padStart(2, "0") + "-" + br[1].padStart(2, "0");
    }

    const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        return iso[1] + "-" + iso[2].padStart(2, "0") + "-" + iso[3].padStart(2, "0");
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

function prepararLinhasRastreioParaEnvio(inicio = 0, fim = null, coletarAvisos = false) {
    capturarMapaMotoristasUI();

    const { modelo, linhas } = dadosImportacaoRastreio;
    const limite = fim == null ? linhas.length : Math.min(fim, linhas.length);
    const resultado = [];
    const erros = coletarAvisos ? [] : [];

    for (let indice = inicio; indice < limite; indice++) {
        const linha = linhas[indice];
        const d = linha.dados;
        const turno = normalizarTurnoRastreio(d[modelo.turno]);
        const dataEnvio = normalizarDataRastreio(d[modelo.dataEnvio]);
        const regiao = modelo.regiao ? String(d[modelo.regiao] ?? "").trim() : "";
        const motoristaPlanilha = modelo.motorista ? String(d[modelo.motorista] ?? "").trim() : "";
        const motorista = motoristaPlanilha || mapaMotoristasRastreio[regiao] || "";

        const item = {
            cliente: String(d[modelo.cliente] ?? "").trim(),
            notas_fiscais: String(d[modelo.notaFiscal] ?? ""),
            transportadora: modelo.transportadora ? String(d[modelo.transportadora] ?? "").trim() : "",
            motorista,
            regiao,
            volume: modelo.volume ? normalizarNumeroRastreio(d[modelo.volume]) : null,
            peso: modelo.peso ? normalizarNumeroRastreio(d[modelo.peso]) : null,
            valor_nf: modelo.valorNF ? normalizarNumeroRastreio(d[modelo.valorNF]) : null,
            data_envio: dataEnvio,
            turno,
            previsao_entrega: calcularPrevisaoRastreio(dataEnvio, turno),
            linha_origem: linha.linha_numero
        };

        if (coletarAvisos) {
            const problemas = [];
            if (!item.cliente) problemas.push("Cliente vazio.");
            if (!item.notas_fiscais.trim()) problemas.push("Nota Fiscal vazia.");
            if (!item.motorista) problemas.push("Motorista não definido.");
            if (!item.data_envio) problemas.push("Data Envio inválida.");
            if (!item.turno) problemas.push("Turno deve ser MANHÃ ou TARDE.");

            totalErros += problemas.length;

            for (const problema of problemas) {
                if (erros.length < 100) {
                    erros.push("Linha " + linha.linha_numero + ": " + problema);
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
            '<span>' + dadosImportacaoRastreio.colunas.length + ' colunas</span>' +
            '<span>Aba: ' + escaparHtmlRastreio(dadosImportacaoRastreio.nomeAba) + '</span>' +
        '</div>' +
        '<div class="rastreio-importacao-colunas">' +
            dadosImportacaoRastreio.colunas.map(c => '<span>' + escaparHtmlRastreio(c) + '</span>').join("") +
        '</div>' +
        '<div class="rastreio-importacao-previa-titulo">Amostra das primeiras linhas</div>' +
        '<div class="rastreio-importacao-tabela">' +
            '<div class="cab">' +
                '<span>Linha</span><span>Cliente</span><span>NF</span><span>Região</span><span>Turno</span><span>Motorista</span>' +
            '</div>' +
            amostra.map(linha => {
                const d = linha.dados;
                const regiao = modelo.regiao ? String(d[modelo.regiao] ?? "").trim() : "";
                const motorista = modelo.motorista ? String(d[modelo.motorista] ?? "").trim() : (mapaMotoristasRastreio[regiao] || "—");
                return '<div class="linha">' +
                    '<span>' + linha.linha_numero + '</span>' +
                    '<span>' + escaparHtmlRastreio(d[modelo.cliente]) + '</span>' +
                    '<span>' + escaparHtmlRastreio(d[modelo.notaFiscal]) + '</span>' +
                    '<span>' + escaparHtmlRastreio(regiao || "—") + '</span>' +
                    '<span>' + escaparHtmlRastreio(d[modelo.turno]) + '</span>' +
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

            const resposta = await window.clienteSupabase.rpc("pmobile_rastreio_inserir_lote", {
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

function mostrarStatusImportacaoRastreio(mensagem) {
    const area = document.getElementById("statusImportacaoRastreio");
    if (area) area.textContent = mensagem;
}

async function calcularSha256Rastreio(buffer) {
    if (!window.crypto?.subtle) return null;

    const digest = await window.crypto.subtle.digest("SHA-256", buffer);

    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}
