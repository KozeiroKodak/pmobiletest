// ============================================================
// PMOBILE
// ARQUIVO: conferenciasrealizadas.js
// ============================================================
//
// OBJETIVO:
//
// Controlar a tela de "Conferências Realizadas".
//
// A partir desta versão:
//
// - O histórico vem diretamente do Supabase.
// - A tabela utilizada é "conferencias".
// - A tela não depende mais do localStorage.
// - Os dados são carregados sempre que a tela é aberta.
// - Os registros do Supabase são convertidos para o formato
//   utilizado pela interface do PMOBILE.
//
// ============================================================


// ============================================================
// FUNÇÃO: escaparHTMLConferencias()
//
// OBJETIVO:
//
// Evitar que dados vindos do banco sejam interpretados como
// código HTML.
//
// Isso protege principalmente campos como:
// - descrição
// - código
// - referência
// - status
//
// ============================================================

function escaparHTMLConferencias(valor) {

    if (valor === null || valor === undefined) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// FUNÇÃO: formatarDataConferencia()
//
// OBJETIVO:
//
// Transformar a data do Supabase em uma apresentação
// mais amigável para o usuário.
//
// Exemplo:
//
// 2026-09-15T20:30:00.000Z
//
// vira:
//
// 15/09/2026 17:30
//
// ============================================================

function formatarDataConferencia(data) {

    if (!data) {
        return "Data não informada";
    }

    const dataConvertida = new Date(data);

    if (Number.isNaN(dataConvertida.getTime())) {
        return "Data inválida";
    }

    return dataConvertida.toLocaleString("pt-BR");
}


// ============================================================
// FUNÇÃO: exibirConferencias()
//
// OBJETIVO:
//
// Carregar as conferências do Supabase e exibir o histórico.
//
// IMPORTANTE:
//
// Esta função é assíncrona porque precisa esperar a consulta
// ao Supabase terminar antes de montar a tela.
//
// ============================================================

async function exibirConferencias() {
    const area = document.getElementById("resultadoConferencias");
    if (!area) return;
    area.textContent = "Carregando histórico de contagens...";
    let manuais = [];
    let legadas = [];
    let aviso = "";
    try {
        if (typeof atualizarContagensManuais === "function" && navigator.onLine) {
            await atualizarContagensManuais();
        }
        if (typeof lerContagensManuais === "function") {
            manuais = await lerContagensManuais();
        }
    } catch (erro) {
        console.warn("Histórico manual indisponível:", erro);
        aviso = "Não foi possível consultar as contagens manuais.";
    }
    try {
        if (typeof carregarConferencias === "function") {
            await carregarConferencias();
            legadas = Array.isArray(conferencias) ? conferencias : [];
        }
    } catch (erro) {
        console.warn("Histórico legado indisponível:", erro);
        aviso += " Histórico antigo indisponível no momento.";
    }
    const normalizadas = [];
    const ids = new Set();
    const adicionar = (item) => {
        const chave = String(item.id || item.conferenciaId || "");
        if (chave && ids.has(chave)) return;
        if (chave) ids.add(chave);
        normalizadas.push(item);
    };
    manuais.forEach(x => adicionar({
        id: x.id, tipo:"manual", codigo:x.codigo, descricao:x.descricao,
        referencia:x.referencia, quantidadeEsperada:Number(x.quantidadeEsperada || 0),
        quantidadeFisica:Number(x.quantidadeFisica || 0),
        localOriginal:x.localOriginal, localEncontrado:x.localEncontrado,
        usuarioNome:x.usuarioNome, data:x.dataHora,
        sincronizado:x.sincronizado, bloqueadoPorLimpeza:x.bloqueadoPorLimpeza
    }));
    legadas.forEach(x => adicionar({
        id:x.conferenciaId || x.id, tipo:"legado",
        codigo:x.codigo_material ?? x.codigo,
        descricao:x.descricao_material ?? x.descricao,
        referencia:x.referencia_material ?? x.referencia,
        quantidadeEsperada:Number(x.quantidade_esperada ?? x.quantidadeEsperada ?? 0),
        quantidadeFisica:Number(x.quantidade_fisica ?? x.quantidadeFisica ?? 0),
        usuarioNome:x.usuario_nome ?? x.usuarioNome,
        data:x.criado_em ?? x.criadoEm ?? x.data
    }));
    normalizadas.sort((a,b)=>new Date(b.data || 0)-new Date(a.data || 0));
    const totalOk = normalizadas.filter(x=>x.quantidadeFisica===x.quantidadeEsperada).length;
    const texto = x=>escaparHTMLConferencias(x == null ? "—" : x);
    const numero = n=>Number(n).toLocaleString("pt-BR",{maximumFractionDigits:2});
    area.innerHTML = '<div class="conferencias-resumo"><strong>Total: '+normalizadas.length+
        '</strong> · ✅ OK: '+totalOk+' · ❌ Divergências: '+(normalizadas.length-totalOk)+'</div>'+
        (aviso?'<p>'+texto(aviso)+'</p>':'')+
        (!normalizadas.length?'<p>Nenhuma contagem registrada ainda.</p>':'')+
        normalizadas.map(x=>{
            const diferenca=x.quantidadeFisica-x.quantidadeEsperada;
            const data=x.data?formatarDataConferencia(x.data):"Data não informada";
            const local=x.tipo==="manual"?
                '<p><strong>Local:</strong> '+texto(x.localOriginal)+' → '+texto(x.localEncontrado)+'</p>':'';
            const situacao=x.tipo==="manual"?
                '<p><strong>Sincronização:</strong> '+(x.bloqueadoPorLimpeza?'Revisão necessária':x.sincronizado?'Sincronizada':'Pendente')+'</p>':'';
            return '<article class="registro-conferencia">'+
                '<h3>'+texto(x.descricao || "Material")+'</h3>'+
                '<p><strong>Origem:</strong> '+(x.tipo==="manual"?'Contagem manual':'Conferência anterior')+'</p>'+
                '<p><strong>Código:</strong> '+texto(x.codigo)+'</p>'+
                '<p><strong>Referência:</strong> '+texto(x.referencia)+'</p>'+local+
                '<p><strong>Estoque esperado:</strong> '+numero(x.quantidadeEsperada)+'</p>'+
                '<p><strong>Quantidade física:</strong> '+numero(x.quantidadeFisica)+'</p>'+
                '<p><strong>Diferença:</strong> '+numero(diferenca)+'</p>'+
                '<p><strong>Status:</strong> '+(diferenca===0?'✅ OK':'❌ DIVERGÊNCIA')+'</p>'+
                '<p><strong>Realizado por:</strong> '+texto(x.usuarioNome)+'</p>'+
                '<p><strong>Data/hora:</strong> '+texto(data)+'</p>'+situacao+'</article>';
        }).join('');
}
