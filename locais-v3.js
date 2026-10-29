/* PMobile — Locais 3.0
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
    return '<details class="local-alterado-card locais-v3-cartao" data-local-status="'+st+'" data-local-busca="'+safe(busca,"")+'">'+
      '<summary class="locais-v3-resumo-cartao">'+
        '<div class="locais-v3-topo">'+
          '<div class="locais-v3-produto"><h3>'+safe(descricao,"Material")+'</h3>'+
            '<p>Cód. '+safe(item.codigo_material,"-")+(referencia?" · Ref. "+safe(referencia):"")+'</p></div>'+
          '<span class="local-alterado-status '+st+'">'+(ok?"✓ Confirmado":"Pendente")+'</span>'+
        '</div>'+
        '<div class="locais-v3-local">'+
          '<span class="locais-v3-rotulo">ALTERAÇÃO DE LOCAL</span>'+
          '<div class="locais-v3-trajeto">'+
            '<div class="locais-v3-endereco"><span>Local anterior</span><strong>'+safe(item.local_original)+'</strong></div>'+
            '<span class="locais-v3-seta" aria-hidden="true">→</span>'+
            '<div class="locais-v3-endereco"><span>Novo local</span><strong>'+safe(item.local_encontrado)+'</strong></div>'+
          '</div>'+
        '</div>'+
        '<div class="locais-v3-metricas">'+
          '<div><span>Estoque esperado</span><strong>'+safe(formatarNumeroLocal(item.quantidade_esperada),"-")+'</strong></div>'+
          '<div><span>Quantidade física</span><strong>'+safe(formatarNumeroLocal(item.quantidade_fisica),"-")+'</strong></div>'+
        '</div>'+
        '<div class="locais-v3-responsavel">'+
          '<span class="locais-v3-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2c0-3 3-5 7-5s7 2 7 5v2"/></svg></span>'+
          '<div><span>Contagem realizada por</span><strong>'+safe(item.usuario_nome,"Usuário não identificado")+'</strong></div>'+
        '</div>'+
        '<span class="locais-v3-expandir"><span class="fechado">Ver mais detalhes</span>'+
          '<span class="aberto">Ocultar detalhes</span> <span class="locais-v3-chevron" aria-hidden="true">⌄</span></span>'+
      '</summary>'+
      '<div class="locais-v3-detalhes">'+
        '<div><span>Data/hora</span><strong>'+safe(formatarDataLocal(item.data_hora),"-")+'</strong></div>'+
        '<div><span>Status no ERP</span><strong>'+(ok?"Confirmado":"Aguardando confirmação")+'</strong></div>'+
        confirmado+
        (botao?'<div class="locais-v3-confirmacao">'+botao+'</div>':"")+
      '</div>'+
    '</details>';
  }
  function cardDerivado(item) {
    const busca=[item.codigo,item.descricao,item.referencia,item.local].map(search).join(" ");
    return '<details class="local-derivado-card locais-v3-cartao" data-local-busca="'+safe(busca,"")+'">'+
      '<summary class="locais-v3-resumo-cartao">'+
        '<div class="locais-v3-topo">'+
          '<div class="locais-v3-produto"><h3>'+safe(item.descricao,"Material")+'</h3><p>Cód. '+safe(item.codigo,"-")+'</p></div>'+
          '<span class="locais-v3-derivado-tag">Fora do padrão</span>'+
        '</div>'+
        '<div class="locais-v3-trajeto locais-v3-trajeto-unico">'+
          '<div class="locais-v3-endereco"><span>Local cadastrado</span><strong>'+safe(item.local)+'</strong></div>'+
          '<div class="locais-v3-endereco"><span>Quantidade</span><strong>'+safe(formatarNumeroLocal(item.quantidade),"-")+'</strong></div>'+
        '</div>'+
        '<span class="locais-v3-expandir"><span class="fechado">Ver mais detalhes</span>'+
          '<span class="aberto">Ocultar detalhes</span> <span class="locais-v3-chevron" aria-hidden="true">⌄</span></span>'+
      '</summary>'+
      '<div class="locais-v3-detalhes">'+
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
    const vazio=document.getElementById(tipo==="alterados"?"locaisV3NenhumAlterado":tipo==="vazios"?"locaisV3NenhumVazio":"locaisV3NenhumDerivado");
    if (vazio) vazio.hidden=lista.length===0 || encontrados>0;
    if (tipo==="alterados") {
      document.querySelectorAll("#locais .locais-v3-filtros button").forEach(function(button){
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
      const aviso=document.getElementById("locaisV3BuscaPagina");
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
  window.aplicarFiltroLocaisV3=function(tipo) {
    if (!["todos","pendente","confirmado"].includes(tipo)) return;
    state.filtro=tipo;
    mostrarFiltros("alterados");
  };
  document.addEventListener("DOMContentLoaded",function(){
    const entradas=[
      ["locaisV3BuscarAlterados","alterados","buscaAlterados"],
      ["locaisV3BuscarVazios","vazios","buscaVazios"],
      ["locaisV3BuscarDerivados","derivados","buscaDerivados"]
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
