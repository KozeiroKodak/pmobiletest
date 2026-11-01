/* PMobile / Dados locais: reservas. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.reservas=function(ctx){
  const {$,escape,num,paginacao,painel,pesquisarForm}=ctx;
  function form(){
return '<div class="painel painel-reservas">'+
        '<div id="dlResultados-reservas" aria-live="polite"></div>'+
        paginacao("reservas")+'</div>';
  }

  function render(itens){
    const el=$("dlResultados-reservas");el.replaceChildren();
if(!itens.length){
        el.innerHTML='<div class="reservas-vazio"><strong>Nenhum item em reserva</strong>'+
          '<span>Materiais com reserva local maior que zero aparecerão aqui.</span></div>';
        return;
      }
      const dados=(v)=>escape(v===null||v===undefined||v===""?"—":v);
      const headers=["ID","Descrição","Referência","Marca","Quantidade","Solicitante"];
      el.innerHTML='<div class="reservas-cabecalho">'+headers.map(t=>'<span>'+t+'</span>').join("")+'</div>'+
        itens.map(m=>'<article class="reserva-item">'+
          '<div class="reserva-celula reserva-id" data-label="ID">'+dados(m.codigo)+'</div>'+
          '<div class="reserva-celula reserva-descricao" data-label="Descrição">'+dados(m.descricao)+'</div>'+
          '<div class="reserva-celula reserva-referencia" data-label="Referência">'+dados(m.referencia)+'</div>'+
          '<div class="reserva-celula reserva-marca" data-label="Marca">'+dados(m.marca)+'</div>'+
          '<div class="reserva-celula reserva-quantidade" data-label="Quantidade">'+num(m.quantidade_reservada)+'</div>'+
          '<div class="reserva-celula reserva-solicitante" data-label="Solicitante">—</div>'+
          '</article>').join("");
      return;
  }

  function template(){return painel("reservas",pesquisarForm("reservas"),"Materiais com reservas preenchidas no estoque local.");}
  return {form,render,template};
 };
})();
