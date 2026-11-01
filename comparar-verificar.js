/* PMobile / Dados locais: comparar. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.comparar=function(ctx){
  const {$,estado,escape,valor,num,norm,rpc,sessao,mensagem,consultar,paginacao,resumo,painel,pesquisarForm,compararForm,desenharMateriais,desenharComparacao,quantidade}=ctx;
  function form(aba) {
    const titulo=aba==="locais"?"Buscar alteração de local":aba==="divergencias"?
      "Pesquisar divergências":"Pesquisar material";
    return '<div class="painel painel-locais"><div class="dl-nativo-comparador">'+
      resumo(aba)+
      '<form class="locais-v3-ferramentas" data-dl-comparar="'+aba+'">'+
      '<label> '+titulo+'<input type="search" name="termo" placeholder="Código, produto ou local..." autocomplete="off"></label>'+
      '<span class="locais-v3-ajuda">Comparação automática ao abrir a tela e ao pesquisar. Indicadores da página atual.</span>'+
      '</form><div id="dlResultados-'+aba+'" aria-live="polite"></div>'+
      paginacao(aba)+'</div></div>';
  }

  function indicador(rotulo,numero,tipo) {
    return '<div class="locais-v3-indicador '+(tipo==="alerta"?"alerta":tipo==="ok"?"sucesso":"")+
      '"><span>'+rotulo+'</span><strong>'+Number(numero).toLocaleString("pt-BR")+'</strong></div>';
  }

  function detalhe(rotulo,v) {
    return '<div><small>'+rotulo+'</small><b>'+escape(valor(v))+'</b></div>';
  }

  function atualizarResumo(aba,itens,comparacao) {
    const area=$("dlResumo-"+aba);if(!area)return;
    if(comparacao){
      const diferentes=itens.filter(m=>m.diferenca_quantidade||m.diferenca_reserva||m.diferenca_local).length;
      const semDogo=itens.filter(m=>m.sem_dogo).length;
      const pendentes=itens.filter(m=>m.pendente_quantidade||m.pendente_reserva||m.pendente_local).length;
      area.innerHTML=indicador("Diferentes",diferentes,"alerta")+
        indicador("Sem Dogo",semDogo,"alerta")+indicador("Pendentes",pendentes);
    }
  }

  function template(){return painel("comparar",compararForm("comparar"),"Comparação automática entre Dogo e Contagem local.");}
  return {form,indicador,detalhe,atualizarResumo,template};
 };
})();
