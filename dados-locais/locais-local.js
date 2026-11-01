/* PMobile / Dados locais: locais. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.locais=function(ctx){
  const {$,escape,valor,num,painel,compararForm,atualizarResumo}=ctx;
  function render(aba,itens) {
    const el=$("dlResultados-"+aba);el.replaceChildren();
    atualizarResumo(aba,itens,true);
    if(!itens.length){
      el.innerHTML='<p class="locais-sem-resultado">Nenhuma ocorrência nesta página. '+
        (aba==="locais"?"Locais vazios na Contagem local continuam pendentes, não divergentes.":"")+
        '</p>';return;
    }
    // Divergências originais usam um resumo Faltantes/Sobras e cartões
    // registro-divergencia — não os cartões de movimentação de Locais.

    el.innerHTML=itens.map(m=>{
      const difer=m.diferenca_quantidade||m.diferenca_reserva||m.diferenca_local;
      const pend=m.pendente_quantidade||m.pendente_reserva||m.pendente_local;
      const st=m.sem_dogo?"Não cadastrado na Dogo":difer?"Divergente":pend?"Pendente":"Conferido";
      const classe=difer?"pendente":"confirmado";
      const local='<div class="locais-local"><span class="locais-rotulo">ALTERAÇÃO DE LOCAL</span>'+
        '<div class="locais-trajeto"><div class="locais-endereco">'+
        '<span>Local anterior</span><strong>'+escape(valor(m.dogo_local))+'</strong></div>'+
        '<span class="locais-seta" aria-hidden="true">→</span>'+
        '<div class="locais-endereco"><span>Novo local</span><strong>'+
        escape(valor(m.local_local))+'</strong></div></div></div>';
      return '<details class="local-alterado-card locais-cartao">'+
        '<summary class="locais-resumo-cartao">'+
        '<div class="locais-topo"><div class="locais-produto">'+
        '<h3>'+escape(m.descricao)+'</h3><p>Cód. '+escape(m.codigo)+'</p></div>'+
        '<span class="local-alterado-status '+classe+'">'+st+'</span></div>'+local+
        '<div class="locais-metricas">'+
        '<div><span>Estoque Dogo</span><strong>'+num(m.dogo_quantidade)+'</strong></div>'+
        '<div><span>Estoque local</span><strong>'+num(m.local_quantidade)+'</strong></div>'+
        '</div><span class="locais-expandir"><span class="fechado">Ver mais detalhes</span>'+
        '<span class="aberto">Ocultar detalhes</span>'+
        '<span class="locais-chevron" aria-hidden="true">⌄</span></span></summary>'+
        '<div class="locais-detalhes">'+
        '<div><span>Reservas Dogo</span><strong>'+num(m.dogo_reservada)+'</strong></div>'+
        '<div><span>Reservas locais</span><strong>'+num(m.local_reservada)+'</strong></div>'+
        '<div><span>Situação</span><strong>'+(m.sem_dogo?"Cadastro não encontrado na Dogo":
        pend?"Campos não preenchidos tratados como pendentes":st)+'</strong></div></div></details>';
    }).join("");
  }

  function template(){return painel("locais",compararForm("locais"),"Local anterior (Dogo) e novo local (Contagem local).");}
  return {render,template};
 };
})();
