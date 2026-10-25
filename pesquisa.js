// =========================================
// PMOBILE - PESQUISA
// =========================================
// Pesquisa de materiais.
//
// FONTE DOS DADOS:
//
// ONLINE:
// Supabase = fonte central
//
// OFFLINE:
// IndexedDB = cópia local
//
// Campos de pesquisa:
// 1. Código
// 2. Descrição
// 3. Referência
//
// Marca, Local e Quantidade NÃO são campos
// de pesquisa. São apenas exibidos no resultado.
// =========================================


function obterClienteSupabase() {
    if (!window.clienteSupabase) {
        throw new Error(
            "Cliente Supabase não foi inicializado."
        );
    }
    return window.clienteSupabase;
}


function escaparBuscaILike(valor) {
    return String(valor)
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
}


function limparResultado(areaResultado) {
    if (!areaResultado) {
        return;
    }
    areaResultado.innerHTML = "";
}


function estaOnline() {
    return navigator.onLine === true;
}


async function pesquisarLocalmente(
    campoPesquisa,
    buscaOriginal
) {
    try {
        if (typeof carregarMateriais === "function") {
            await carregarMateriais();
        }

        if (typeof obterMateriaisLocais !== "function") {
            throw new Error(
                "Função obterMateriaisLocais() não encontrada."
            );
        }

        const materiaisLocais =
            await obterMateriaisLocais();

        if (!Array.isArray(materiaisLocais)) {
            return [];
        }

        const busca =
            String(buscaOriginal)
                .trim()
                .toLowerCase();

        const resultados = [];

        for (
            let indice = 0;
            indice < materiaisLocais.length &&
            resultados.length < 100;
            indice++
        ) {
            const material =
                materiaisLocais[indice];

            if (!material) {
                continue;
            }

            let valorCampo = "";

            if (campoPesquisa === "codigo") {
                valorCampo =
                    material.codigo ?? "";
            } else if (campoPesquisa === "descricao") {
                valorCampo =
                    material.descricao ?? "";
            } else if (campoPesquisa === "referencia") {
                valorCampo =
                    material.referencia ?? "";
            }

            const valorNormalizado =
                String(valorCampo)
                    .trim()
                    .toLowerCase();

            const corresponde =
                campoPesquisa === "codigo"
                    ? valorNormalizado === busca
                    : valorNormalizado.includes(busca);

            if (corresponde) {
                resultados.push(material);
            }
        }

        return resultados;

    } catch (erro) {
        console.error(
            "Erro na pesquisa local:",
            erro
        );
        throw erro;
    }
}


function exibirResultadosPesquisa(resultados,areaResultado){
 if(!areaResultado)return;
 limparResultado(areaResultado);
 if(!Array.isArray(resultados)||!resultados.length){areaResultado.innerHTML='<div class="pesquisa-v2-vazio"><strong>Nenhum material encontrado</strong><p>Confira os dados e tente novamente.</p></div>';return;}
 const count=document.createElement("p");count.className="pesquisa-v2-contagem";count.textContent=resultados.length+" material(is) encontrado(s)";areaResultado.appendChild(count);
 resultados.forEach(function(m){
  const total=Number(m.quantidade??0),reservada=Number(m.quantidadeReservada??m.quantidade_reservada??0),disponivel=total-reservada;
  const card=document.createElement("details");card.className="pesquisa-v2-card";
  const sum=document.createElement("summary");
  const cod=document.createElement("span");cod.className="pesquisa-v2-codigo";cod.textContent=m.codigo??"-";
  const badge=document.createElement("span");badge.className="pesquisa-v2-disponivel"+(disponivel<=0?" zero":"");badge.textContent=disponivel>0?"Disponível":"Sem estoque";
  const desc=document.createElement("strong");desc.textContent=m.descricao??"-";
  const ref=document.createElement("small");ref.textContent="Ref.: "+(m.referencia??"-")+"  ·  Toque para detalhes";
  sum.append(cod,badge,desc,ref);card.appendChild(sum);
  const det=document.createElement("div");det.className="pesquisa-v2-detalhes";
  [["Código",m.codigo],["Referência",m.referencia],["Marca",m.marca],["Local",m.local],["Quantidade disponível",Number.isFinite(disponivel)?disponivel:"-"],["Quantidade reservada",Number.isFinite(reservada)?reservada:"-"]].forEach(([label,value])=>{const item=document.createElement("div"),small=document.createElement("small"),bold=document.createElement("b");small.textContent=label;bold.textContent=value??"-";item.append(small,bold);det.appendChild(item)});
  card.appendChild(det);areaResultado.appendChild(card);
 });
}

function abrirPopupPesquisaMaterial() {
    const seletor = document.getElementById("tipoBuscaPesquisaMaterial");
    const botao = document.getElementById("botaoTipoBuscaPesquisaMaterial");
    if (!seletor || !botao || typeof abrirPopupEscolha !== "function") return;

    abrirPopupEscolha({
        titulo: "Pesquisar por",
        opcoes: [
            { value: "codigo", label: "Código", selected: seletor.value === "codigo" },
            { value: "referencia", label: "Referência", selected: seletor.value === "referencia" },
            { value: "descricao", label: "Descrição", selected: seletor.value === "descricao" }
        ],
        aoEscolher: function(tipo) {
            selecionarTipoBuscaPesquisaMaterial(tipo);
        }
    });
    botao.setAttribute("aria-expanded", "true");
}

function selecionarTipoBuscaPesquisaMaterial(tipo){
 const seletor=document.getElementById("tipoBuscaPesquisaMaterial"),campo=document.getElementById("campoPesquisaMaterial");
 if(!seletor||!campo)return;
 const nomes={codigo:"Digite o código",referencia:"Digite a referência",descricao:"Digite a descrição"};
 if(!nomes[tipo])tipo="codigo";
 seletor.value=tipo;campo.placeholder=nomes[tipo];
 document.querySelectorAll("#pesquisa [data-pesquisa-tipo]").forEach(b=>{b.classList.toggle("ativo",b.dataset.pesquisaTipo===tipo);b.setAttribute("aria-pressed",String(b.dataset.pesquisaTipo===tipo))});
 campo.focus();
}
function atualizarStatusPesquisaMaterial(fonte){
 const el=document.getElementById("statusPesquisaMaterial"),rodape=document.getElementById("pesquisaV2Fonte");
 if(el){el.textContent=navigator.onLine?"● Conectado":"● Modo offline";el.classList.toggle("offline",!navigator.onLine)}
 if(rodape&&fonte)rodape.textContent="Fonte: "+fonte;
}
window.addEventListener("online",()=>atualizarStatusPesquisaMaterial());
window.addEventListener("offline",()=>atualizarStatusPesquisaMaterial());
document.addEventListener("DOMContentLoaded",()=>atualizarStatusPesquisaMaterial());

async function pesquisarMaterialSelecionado() {
    const seletor = document.getElementById("tipoBuscaPesquisaMaterial");
    const campo = document.getElementById("campoPesquisaMaterial");
    const areaResultado = document.getElementById("resultadoPesquisaMaterial");

    if (!seletor || !campo || !areaResultado) {
        console.error("Elementos da pesquisa unificada não encontrados.");
        return;
    }

    const tipo = seletor.value || "codigo";
    const buscaOriginal = campo.value.trim();

    if (!buscaOriginal) {
        areaResultado.innerHTML = "<p>Digite um termo para pesquisar.</p>";
        campo.focus();
        return;
    }

    limparResultado(areaResultado);
    areaResultado.innerHTML = '<div class="pesquisa-v2-vazio"><strong>Pesquisando...</strong></div>';
    atualizarStatusPesquisaMaterial();

    if (!estaOnline()) {
        try {
            const resultados = await pesquisarLocalmente(tipo, buscaOriginal);
            exibirResultadosPesquisa(resultados, areaResultado); atualizarStatusPesquisaMaterial('base local');
        } catch (erro) {
            console.error("Erro na pesquisa offline:", erro);
            areaResultado.innerHTML = "<p>Erro ao consultar o banco local.</p>";
        }
        return;
    }

    try {
        const clienteSupabase = obterClienteSupabase();
        const busca = escaparBuscaILike(buscaOriginal);

        let consulta = clienteSupabase
            .from("materiais")
            .select("id,codigo,descricao,referencia,marca,local,quantidade,quantidade_reservada");

        if (tipo === "codigo") {
            consulta = consulta
                .eq("codigo", buscaOriginal)
                .order("codigo", { ascending: true });
        } else {
            const coluna = tipo === "referencia" ? "referencia" : "descricao";
            consulta = consulta
                .ilike(coluna, "%" + busca + "%", { escape: "\\" })
                .order(coluna, { ascending: true });
        }

        const { data, error } = await consulta.limit(100);

        if (error) {
            throw error;
        }

        exibirResultadosPesquisa(data || [], areaResultado); atualizarStatusPesquisaMaterial('Supabase');

    } catch (erro) {
        console.error("Erro na pesquisa online:", erro);

        try {
            const resultados = await pesquisarLocalmente(tipo, buscaOriginal);
            exibirResultadosPesquisa(resultados, areaResultado);
        } catch (erroLocal) {
            console.error("Erro no fallback local:", erroLocal);
            areaResultado.innerHTML =
                "<p>Não foi possível consultar o Supabase nem o banco local.</p>";
        }
    }
}


// O popup padrão controla abertura, fechamento e clique externo.
