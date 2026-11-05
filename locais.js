// ============================================================
// LOCAIS — ALTERADOS / VAZIOS
// ============================================================

const SETORES_PADRAO_LOCAIS_PMP = [
    "A01", "B01", "C01", "D01", "E01", "F01", "G01",
    "H01", "I01", "J01", "K01", "L01", "M01", "P01", "P02"
];

// A grade física segue o mesmo padrão informado para A01.
// A estrutura fica centralizada aqui para ajustes futuros sem
// alterar a lógica de ocupação.
const ESTRUTURA_LOCAIS_PMP = SETORES_PADRAO_LOCAIS_PMP.map(function(area) {
    return {
        area,
        letras: ["A", "B", "C", "D", "E", "F"],
        inicio: 1,
        fim: 30
    };
});

// Posições especiais de pallets cruzados, fisicamente válidas mesmo
// estando à frente de outra estante. São endereços individuais.
const LOCAIS_CRUZADOS_PMP = {
    "B01": ["B01A01"],
    "D01": ["D01C01"],
    "F01": ["F01E01"],
    "H01": ["H01G01"],
    "J01": ["J01I01"]
};

let abaLocaisAtual = "alterados";
let localVaziosDetalheAtual = null;
let paginaLocaisDerivadosAtual = 1;
const ITENS_POR_PAGINA_LOCAIS_DERIVADOS = 20;

function abrirLocais() {
    const usuario = window.usuarioPmobileAtual;

    if (!usuario || usuario.nivel !== "ADMIN") {
        alert("Acesso administrativo negado.");
        return;
    }

    mostrarTelaSistema("locais", "menuConfiguracoes");
    alternarAbaLocais("alterados");
}

function alternarAbaLocais(aba) {
    abaLocaisAtual = ["alterados", "vazios", "derivados"].includes(aba)
        ? aba
        : "alterados";

    const alterados = document.getElementById("painelLocaisAlterados");
    const vazios = document.getElementById("painelLocaisVazios");
    const botaoAlterados = document.getElementById("abaLocaisAlterados");
    const botaoVazios = document.getElementById("abaLocaisVazios");
    const botaoDerivados = document.getElementById("abaLocaisDerivados");
    const derivados = document.getElementById("painelLocaisDerivados");

    if (alterados) alterados.style.display = abaLocaisAtual === "alterados" ? "block" : "none";
    if (vazios) vazios.style.display = abaLocaisAtual === "vazios" ? "block" : "none";
    if (derivados) derivados.style.display = abaLocaisAtual === "derivados" ? "block" : "none";

    if (botaoAlterados) botaoAlterados.classList.toggle("ativo", abaLocaisAtual === "alterados");
    if (botaoVazios) botaoVazios.classList.toggle("ativo", abaLocaisAtual === "vazios");
    if (botaoDerivados) botaoDerivados.classList.toggle("ativo", abaLocaisAtual === "derivados");

    if (abaLocaisAtual === "alterados") {
        carregarLocaisAlterados();
    } else if (abaLocaisAtual === "vazios") {
        carregarLocaisVazios();
    } else {
        carregarLocaisDerivados();
    }
}

async function carregarLocaisDerivados() {
    const area = document.getElementById("listaLocaisDerivados");
    if (!area) return;

    area.innerHTML = '<div class="locais-carregando">Carregando materiais fora dos setores padrão...</div>';

    try {
        const cliente = obterClienteSupabase();
        if (!cliente) throw new Error("Supabase indisponível.");

        paginaLocaisDerivadosAtual = 1;
        await buscarPaginaLocaisDerivados(area, paginaLocaisDerivadosAtual);

    } catch (erro) {
        console.error("Erro ao carregar materiais derivados:", erro);
        area.innerHTML =
            '<div class="locais-vazio locais-vazio-erro">' +
                '<span>!</span><strong>Não foi possível carregar</strong>' +
                '<p>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar os materiais.") + '</p>' +
            '</div>';
    }
}

async function buscarPaginaLocaisDerivados(area, pagina) {
    const cliente = obterClienteSupabase();
    if (!cliente) throw new Error("Supabase indisponível.");

    const offset = (pagina - 1) * ITENS_POR_PAGINA_LOCAIS_DERIVADOS;

    const { data, error } = await cliente.rpc("listar_locais_derivados", {
        p_limit: ITENS_POR_PAGINA_LOCAIS_DERIVADOS,
        p_offset: offset
    });

    if (error) throw error;

    const registros = Array.isArray(data) ? data : [];
    const totalRegistros = registros.length
        ? Number(registros[0].total_registros || 0)
        : 0;

    renderizarPaginaLocaisDerivados(area, registros, totalRegistros);
}

function renderizarPaginaLocaisDerivados(area, registros, totalRegistros) {
    const totalPaginas = Math.max(
        1,
        Math.ceil(totalRegistros / ITENS_POR_PAGINA_LOCAIS_DERIVADOS)
    );

    paginaLocaisDerivadosAtual = Math.min(
        Math.max(1, paginaLocaisDerivadosAtual),
        totalPaginas
    );

    area.dataset.totalRegistrosLocaisDerivados = String(totalRegistros);

    area.innerHTML =
        '<div class="locais-resumo-derivados">' +
            '<strong>' + totalRegistros + '</strong> material(is) fora dos setores padrão' +
        '</div>' +
        '<div class="locais-derivados-cabecalho">' +
            '<span>ID</span>' +
            '<span>Descrição</span>' +
            '<span>Referência</span>' +
            '<span>Local</span>' +
            '<span>Quantidade</span>' +
        '</div>' +
        registros.map(renderizarLocalDerivado).join("") +
        '<div class="locais-paginacao-derivados">' +
            '<button type="button" class="botao-secundario" onclick="mudarPaginaLocaisDerivados(-1)"' +
                (paginaLocaisDerivadosAtual <= 1 ? ' disabled' : '') +
                '>Anterior</button>' +
            '<span>Página ' + paginaLocaisDerivadosAtual + '/' + totalPaginas + ' · ' + totalRegistros + ' material(is)</span>' +
            '<button type="button" class="botao-secundario" onclick="mudarPaginaLocaisDerivados(1)"' +
                (paginaLocaisDerivadosAtual >= totalPaginas ? ' disabled' : '') +
                '>Próxima</button>' +
        '</div>';
}

async function mudarPaginaLocaisDerivados(direcao) {
    const area = document.getElementById("listaLocaisDerivados");
    if (!area) return;

    const totalPaginasConhecidas = Math.max(1, Math.ceil(
        Number(area.dataset.totalRegistrosLocaisDerivados || 0) /
        ITENS_POR_PAGINA_LOCAIS_DERIVADOS
    ));

    const novaPagina = paginaLocaisDerivadosAtual + Number(direcao || 0);

    if (novaPagina < 1) return;
    if (totalPaginasConhecidas > 1 && novaPagina > totalPaginasConhecidas) return;

    paginaLocaisDerivadosAtual = novaPagina;

    try {
        await buscarPaginaLocaisDerivados(area, novaPagina);
    } catch (erro) {
        console.error("Erro ao paginar materiais derivados:", erro);
    }
}
async function carregarLocaisAlterados() {
    const area = document.getElementById("listaLocaisAlterados");
    if (!area) return;

    area.innerHTML = '<div class="locais-carregando">Carregando alterações...</div>';

    try {
        const cliente = obterClienteSupabase();
        if (!cliente) throw new Error("Supabase indisponível.");

        const usuarioSessao =
            (typeof usuarioPmobileAtual !== "undefined" && usuarioPmobileAtual?.usuario)
                ? usuarioPmobileAtual
                : window.usuarioPmobileAtual;
        const credencialSessao =
            (typeof credencialPmobileAtual !== "undefined" && credencialPmobileAtual)
                ? credencialPmobileAtual
                : window.credencialPmobileAtual;

        if (!usuarioSessao?.usuario || !credencialSessao) {
            throw new Error("Sessão do usuário não disponível para consultar locais alterados.");
        }

        const { data, error } = await cliente.rpc("pmobile_contagens_manuais_listar", {
            p_usuario: usuarioSessao.usuario,
            p_credencial: credencialSessao,
            p_somente_alterados: true
        });

        if (error) throw error;

        const registros = Array.isArray(data) ? data : [];

        if (!registros.length) {
            area.innerHTML =
                '<div class="locais-vazio">' +
                    '<span>✓</span>' +
                    '<strong>Nenhum local alterado</strong>' +
                    '<p>As alterações encontradas na contagem manual aparecerão aqui.</p>' +
                '</div>';
            return;
        }

        area.innerHTML = registros.map(renderizarLocalAlterado).join("");

    } catch (erro) {
        console.error("Erro ao carregar locais alterados:", erro);
        area.innerHTML =
            '<div class="locais-vazio locais-vazio-erro">' +
                '<span>!</span>' +
                '<strong>Não foi possível carregar</strong>' +
                '<p>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar as alterações.") + '</p>' +
            '</div>';
    }
}

async function confirmarAlteracaoLocal(contagemId) {
    if (!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN" || !window.credencialPmobileAtual) {
        alert("Acesso administrativo negado.");
        return;
    }

    if (!confirm("Confirmar que esta alteração de local já foi realizada no ERP?")) {
        return;
    }

    try {
        const cliente = obterClienteSupabase();

        const { error } = await cliente.rpc("confirmar_alteracao_local", {
            p_admin_usuario: window.usuarioPmobileAtual.usuario,
            p_admin_credencial: window.credencialPmobileAtual,
            p_contagem_id: contagemId
        });

        if (error) throw error;

        await carregarLocaisAlterados();

    } catch (erro) {
        console.error("Erro ao confirmar alteração de local:", erro);
        alert(erro?.message || "Não foi possível confirmar a alteração.");
    }
}

function carregarLocaisVazios() {
    const area = document.getElementById("listaAreasVazias");
    if (!area) return;

    if (!ESTRUTURA_LOCAIS_PMP.length) {
        area.innerHTML =
            '<div class="locais-vazio"><strong>Nenhuma área configurada</strong>' +
            '<p>A estrutura física dos locais ainda não foi cadastrada no PMOBILE.</p></div>';
        return;
    }

    area.innerHTML = '<div class="locais-carregando">Calculando posições...</div>';

    Promise.resolve().then(async function() {
        try {
            const cliente = obterClienteSupabase();
            if (!cliente) throw new Error("Supabase indisponível.");

            const { data, error } = await cliente.rpc("listar_locais_ocupados");

            if (error) throw error;

            const ocupados = new Set(
                (Array.isArray(data) ? data : [])
                    .map(function(item) {
                        return normalizarLocalPmobile(item.local);
                    })
                    .filter(Boolean)
            );

            window._pmobileLocaisVaziosOcupados = ocupados;

            area.innerHTML = ESTRUTURA_LOCAIS_PMP.map(function(estrutura) {
                const posicoes = gerarPosicoesAreaPmobile(estrutura);
                const vazios = posicoes.filter(function(local) {
                    return !ocupados.has(normalizarLocalPmobile(local));
                });
                const ocupadas = posicoes.length - vazios.length;

                return (
                    '<article class="local-vazio-area-card">' +
                        '<div class="local-vazio-area-info">' +
                            '<span class="local-vazio-area-legenda">Área</span>' +
                            '<strong>' + escapeHtmlPmobile(estrutura.area) + '</strong>' +
                        '</div>' +
                        '<div class="local-vazio-metrica"><span>Total</span><strong>' + posicoes.length + '</strong></div>' +
                        '<div class="local-vazio-metrica"><span>Ocupados</span><strong>' + ocupadas + '</strong></div>' +
                        '<div class="local-vazio-metrica destaque"><span>Vazios</span><strong>' + vazios.length + '</strong></div>' +
                        '<button type="button" class="botao-lupa-local" onclick="abrirDetalhesLocaisVazios(\'' +
                            escapeHtmlPmobile(estrutura.area) +
                        '\')" aria-label="Ver posições vazias de ' + escapeHtmlPmobile(estrutura.area) + '" title="Ver posições vazias">⌕</button>' +
                    '</article>'
                );
            }).join("");

        } catch (erro) {
            console.error("Erro ao calcular locais vazios:", erro);
            area.innerHTML =
                '<div class="locais-vazio locais-vazio-erro">' +
                    '<span>!</span><strong>Não foi possível calcular</strong>' +
                    '<p>' + escapeHtmlPmobile(erro?.message || "Erro ao consultar o estoque.") + '</p>' +
                '</div>';
        }
    });
}

function abrirDetalhesLocaisVazios(areaNome) {
    const estrutura = ESTRUTURA_LOCAIS_PMP.find(function(item) {
        return item.area === areaNome;
    });
    if (!estrutura) return;

    localVaziosDetalheAtual = estrutura;

    const painel = document.getElementById("detalhesLocaisVazios");
    const titulo = document.getElementById("tituloDetalhesLocaisVazios");
    const lista = document.getElementById("listaDetalhesLocaisVazios");

    if (!painel || !titulo || !lista) return;

    const ocupados = window._pmobileLocaisVaziosOcupados || new Set();
    const vazios = gerarPosicoesAreaPmobile(estrutura).filter(function(local) {
        return !ocupados.has(normalizarLocalPmobile(local));
    });

    titulo.textContent = estrutura.area;
    lista.innerHTML = vazios.length
        ? vazios.map(function(local) {
            return '<div class="local-vazio-endereco">' + escapeHtmlPmobile(local) + '</div>';
        }).join("")
        : '<div class="locais-vazio"><strong>Nenhuma posição vazia</strong><p>Esta área está totalmente ocupada.</p></div>';

    mostrarTelaSistema("detalhesLocaisVazios", "menuLocais");
}

function fecharDetalhesLocaisVazios() {
    localVaziosDetalheAtual = null;

    // Consumir o histórico em vez de criar outra entrada que faria
    // o botão Voltar reabrir os detalhes da posição vazia.
    const retornou = typeof voltarTelaAnteriorPmobile === "function" &&
        voltarTelaAnteriorPmobile();

    if (!retornou || obterTelaSistemaAtual() !== "locais") {
        mostrarTelaSistema("locais", "menuConfiguracoes", true);
    }
    alternarAbaLocais("vazios");
}

function gerarPosicoesAreaPmobile(estrutura) {
    const resultado = [];

    (estrutura.letras || []).forEach(function(letra) {
        for (let numero = estrutura.inicio; numero <= estrutura.fim; numero += 1) {
            resultado.push(
                String(estrutura.area) +
                String(letra) +
                String(numero).padStart(2, "0")
            );
        }
    });

    (LOCAIS_CRUZADOS_PMP[estrutura.area] || []).forEach(function(local) {
        resultado.push(local);
    });

    return resultado;
}


function obterLocaisPadraoPmobile() {
    const locais = new Set();

    ESTRUTURA_LOCAIS_PMP.forEach(function(estrutura) {
        gerarPosicoesAreaPmobile(estrutura).forEach(function(local) {
            locais.add(normalizarLocalPmobile(local));
        });
    });

    return locais;
}

function normalizarLocalPmobile(valor) {
    return String(valor == null ? "" : valor).trim().toUpperCase();
}

function formatarDataLocal(valor) {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatarNumeroLocal(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero)
        ? numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
        : "-";
}

/* PMobile — Locais
 * Visualização sem alterar consultas, confirmações ou estrutura do Supabase.
 * local_original é o endereço registrado na contagem, nunca o local atual.
 */
(function () {
  "use strict";
  const state={filtro:"todos",buscaAlterados:"",buscaVazios:"",buscaDerivados:""};
  function safe(value,fallback="Não informado") {
    const raw=String(value == null ? "" : value).trim();
    return escapeHtmlPmobile(raw || fallback);
  }
  function search(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  }
  function status(item) {return item.alteracao_status==="CONFIRMADO"?"confirmado":"pendente";}
  function cardAlterado(item) {
    const st=status(item),ok=st==="confirmado";
    const referencia=String(item.referencia_material||"").trim();
    const descricao=String(item.descricao_material||"").trim();
    const busca=[item.codigo_material,descricao,referencia,item.local_original,item.local_encontrado,item.usuario_nome].map(search).join(" ");
    const id=String(item.id||"");
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const admin=window.usuarioPmobileAtual && window.usuarioPmobileAtual.nivel==="ADMIN";
    const botao=(!ok && admin && uuid)
      ? '<button class="botao-local-confirmar" type="button" data-local-confirmar="'+safe(id)+'">✓ Confirmar alteração no ERP</button>'
      : "";
    const confirmado=ok
      ? '<div><span>Confirmado por</span><strong>'+safe(item.alteracao_confirmada_por_nome)+'</strong></div>'+
        '<div><span>Confirmado em</span><strong>'+safe(item.alteracao_confirmada_em?formatarDataLocal(item.alteracao_confirmada_em):null)+'</strong></div>'
      : "";
    return '<details class="local-alterado-card locais-cartao" data-local-status="'+st+'" data-local-busca="'+safe(busca,"")+'">'+
      '<summary class="locais-resumo-cartao">'+
        '<div class="locais-topo">'+
          '<div class="locais-produto"><h3>'+safe(descricao,"Material")+'</h3>'+
            '<p>Cód. '+safe(item.codigo_material,"-")+(referencia?" · Ref. "+safe(referencia):"")+'</p></div>'+
          '<span class="local-alterado-status '+st+'">'+(ok?"✓ Confirmado":"Pendente")+'</span>'+
        '</div>'+
        '<div class="locais-local">'+
          '<span class="locais-rotulo">ALTERAÇÃO DE LOCAL</span>'+
          '<div class="locais-trajeto">'+
            '<div class="locais-endereco"><span>Local anterior</span><strong>'+safe(item.local_original)+'</strong></div>'+
            '<span class="locais-seta" aria-hidden="true">→</span>'+
            '<div class="locais-endereco"><span>Novo local</span><strong>'+safe(item.local_encontrado)+'</strong></div>'+
          '</div>'+
        '</div>'+
        '<div class="locais-metricas">'+
          '<div><span>Estoque esperado</span><strong>'+safe(formatarNumeroLocal(item.quantidade_esperada),"-")+'</strong></div>'+
          '<div><span>Quantidade física</span><strong>'+safe(formatarNumeroLocal(item.quantidade_fisica),"-")+'</strong></div>'+
        '</div>'+
        '<div class="locais-responsavel">'+
          '<span class="locais-avatar" aria-hidden="true">👤</span>'+
          '<div><span>Contagem realizada por</span><strong>'+safe(item.usuario_nome,"Usuário não identificado")+'</strong></div>'+
        '</div>'+
        '<span class="locais-expandir"><span class="fechado">Ver mais detalhes</span>'+
          '<span class="aberto">Ocultar detalhes</span> <span class="locais-chevron" aria-hidden="true">⌄</span></span>'+
      '</summary>'+
      '<div class="locais-detalhes">'+
        '<div><span>Data/hora</span><strong>'+safe(formatarDataLocal(item.data_hora),"-")+'</strong></div>'+
        '<div><span>Status no ERP</span><strong>'+(ok?"Confirmado":"Aguardando confirmação")+'</strong></div>'+
        confirmado+
        (botao?'<div class="locais-confirmacao">'+botao+'</div>':"")+
      '</div>'+
    '</details>';
  }
  function cardDerivado(item) {
    const busca=[item.codigo,item.descricao,item.referencia,item.local].map(search).join(" ");
    return '<details class="local-derivado-card locais-cartao" data-local-busca="'+safe(busca,"")+'">'+
      '<summary class="locais-resumo-cartao">'+
        '<div class="locais-topo">'+
          '<div class="locais-produto"><h3>'+safe(item.descricao,"Material")+'</h3><p>Cód. '+safe(item.codigo,"-")+'</p></div>'+
          '<span class="locais-derivado-tag">Fora do padrão</span>'+
        '</div>'+
        '<div class="locais-trajeto locais-trajeto-unico">'+
          '<div class="locais-endereco"><span>Local cadastrado</span><strong>'+safe(item.local)+'</strong></div>'+
          '<div class="locais-endereco"><span>Quantidade</span><strong>'+safe(formatarNumeroLocal(item.quantidade),"-")+'</strong></div>'+
        '</div>'+
        '<span class="locais-expandir"><span class="fechado">Ver mais detalhes</span>'+
          '<span class="aberto">Ocultar detalhes</span> <span class="locais-chevron" aria-hidden="true">⌄</span></span>'+
      '</summary>'+
      '<div class="locais-detalhes">'+
        '<div><span>Referência</span><strong>'+safe(item.referencia)+'</strong></div>'+
        '<div><span>Situação</span><strong>Fora dos setores padrão</strong></div>'+
      '</div>'+
    '</details>';
  }

  // Os renderizadores originais são utilizados pelas RPCs existentes.
  // Substituímos somente o HTML, nunca as consultas ou a ação de confirmar.
  window.renderizarLocalAlterado=cardAlterado;
  window.renderizarLocalDerivado=cardDerivado;

  function cards(tipo) {
    const container= document.getElementById(tipo==="alterados"?"listaLocaisAlterados":tipo==="vazios"?"listaAreasVazias":"listaLocaisDerivados");
    if (!container) return [];
    return Array.from(container.querySelectorAll(tipo==="alterados"?"details.local-alterado-card":tipo==="vazios"?".local-vazio-area-card":"details.local-derivado-card"));
  }
  function mostrarFiltros(tipo) {
    const lista=cards(tipo);
    const term=search(tipo==="alterados"?state.buscaAlterados:tipo==="vazios"?state.buscaVazios:state.buscaDerivados).trim();
    let encontrados=0;
    lista.forEach(function(card) {
      const situacao=card.dataset.localStatus;
      const area=card.querySelector(".local-vazio-area-info strong");
      const valor=tipo==="vazios"?(area?area.textContent:""):card.dataset.localBusca;
      const visivel=(!term || search(valor).includes(term)) &&
        (tipo!=="alterados" || state.filtro==="todos" || situacao===state.filtro);
      card.hidden=!visivel;
      if (visivel) encontrados++;
    });
    const vazio=document.getElementById(tipo==="alterados"?"locaisNenhumAlterado":tipo==="vazios"?"locaisNenhumVazio":"locaisNenhumDerivado");
    if (vazio) vazio.hidden=lista.length===0 || encontrados>0;
    if (tipo==="alterados") {
      document.querySelectorAll("#locais .locais-filtros button").forEach(function(button){
        const ativo=button.dataset.filtroLocal===state.filtro;
        button.classList.toggle("ativo",ativo);
        button.setAttribute("aria-pressed",String(ativo));
      });
    }
  }
  function atualizarContadores(tipo) {
    const lista=cards(tipo);
    if (tipo==="alterados") {
      const confirmados=lista.filter(x=>x.dataset.localStatus==="confirmado").length;
      const valores={total:lista.length,pendentes:lista.length-confirmados,confirmados};
      Object.keys(valores).forEach(k=>{
        const alvo=document.querySelector('[data-contador-local="'+k+'"]');
        if(alvo)alvo.textContent=String(valores[k]);
      });
    } else if (tipo==="vazios") {
      // Totais calculados a partir das posições reais exibidas pelo módulo.
      let ocupados=0,vazios=0,total=0;
      lista.forEach(function(card) {
        const vals=Array.from(card.querySelectorAll(".local-vazio-metrica strong")).map(x=>Number(x.textContent.replace(/\./g,"")));
        if(vals.length===3){total+=vals[0];ocupados+=vals[1];vazios+=vals[2];}
      });
      const counts={posicoes:total,ocupadas:ocupados,vazias:vazios};
      Object.keys(counts).forEach(k=>{const alvo=document.querySelector('[data-contador-local="'+k+'"]');if(alvo)alvo.textContent=counts[k].toLocaleString("pt-BR");});
    } else {
      const original=document.querySelector("#listaLocaisDerivados .locais-resumo-derivados strong");
      const numero=document.querySelector('[data-contador-local="derivados"]');
      if(numero)numero.textContent=original?original.textContent:"0";
      const aviso=document.getElementById("locaisBuscaPagina");
      if(aviso)aviso.textContent="Pesquisa nos "+lista.length+" registros desta página.";
    }
    mostrarFiltros(tipo);
  }
  function preparar(tipo) {
    const id=tipo==="alterados"?"listaLocaisAlterados":tipo==="vazios"?"listaAreasVazias":"listaLocaisDerivados";
    const area=document.getElementById(id);
    if(!area)return;
    const obs=new MutationObserver(function(){atualizarContadores(tipo);});
    obs.observe(area,{childList:true});
    atualizarContadores(tipo);
  }
  window.aplicarFiltroLocais=function(tipo) {
    if (!["todos","pendente","confirmado"].includes(tipo)) return;
    state.filtro=tipo;
    mostrarFiltros("alterados");
  };
  document.addEventListener("DOMContentLoaded",function(){
    const entradas=[
      ["locaisBuscarAlterados","alterados","buscaAlterados"],
      ["locaisBuscarVazios","vazios","buscaVazios"],
      ["locaisBuscarDerivados","derivados","buscaDerivados"]
    ];
    entradas.forEach(function([id,tipo,chave]){
      const input=document.getElementById(id);
      if(input)input.addEventListener("input",function(){state[chave]=input.value;mostrarFiltros(tipo);});
      preparar(tipo);
    });
    const alterados=document.getElementById("listaLocaisAlterados");
    if(alterados)alterados.addEventListener("click",function(evento){
      const botao=evento.target.closest("[data-local-confirmar]");
      if(botao && alterados.contains(botao)) {
        confirmarAlteracaoLocal(botao.dataset.localConfirmar);
      }
    });
  });
})();
