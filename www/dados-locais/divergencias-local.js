/* PMobile / Dados locais: divergencias. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.divergencias=function(ctx){
  const {$,estado,escape,valor,num,norm,rpc,sessao,mensagem,consultar,paginacao,resumo,painel,pesquisarForm,compararForm,atualizarResumo,desenharMateriais,desenharComparacao,quantidade}=ctx;
  function render(itens){
  const el=$("dlResultados-divergencias");el.replaceChildren();
  atualizarResumo("divergencias",itens,true);
const validos=itens.filter(m=>m.dogo_quantidade!==null&&
        m.local_quantidade!==null&&!m.sem_dogo);
      const faltantes=validos.filter(m=>Number(m.local_quantidade)<Number(m.dogo_quantidade));
      const sobras=validos.filter(m=>Number(m.local_quantidade)>Number(m.dogo_quantidade));
      const sum=arr=>arr.reduce((total,m)=>total+
        Math.abs(Number(m.local_quantidade)-Number(m.dogo_quantidade)),0);
      el.innerHTML='<div class="dl-divergencias-resumo">'+
        '<p>🔴 <strong>Faltantes:</strong> '+faltantes.length+' produtos / '+
        num(sum(faltantes))+' unidades</p>'+
        '<p>🟢 <strong>Sobras:</strong> '+sobras.length+' produtos / '+
        num(sum(sobras))+' unidades</p></div>'+
        itens.map(m=>{
          // Uma divergência confirmada de reservas não pode ser ocultada
          // apenas porque o campo de quantidade física ainda está vazio.
          const tipo=m.sem_dogo?"NÃO CADASTRADO NA DOGO":
            m.diferenca_quantidade?(Number(m.local_quantidade)<Number(m.dogo_quantidade)?"🔴 FALTANTE":"🟢 SOBRA"):
            m.diferenca_reserva?"RESERVA DIVERGENTE":
            m.local_quantidade===null?"PENDENTE":"VERIFICAR";
          return '<div class="registro-divergencia"><h3>'+escape(m.descricao)+'</h3>'+
            '<p><strong>Código:</strong> '+escape(m.codigo)+'</p>'+
            '<p><strong>Dogo:</strong> '+num(m.dogo_quantidade)+
            ' · <strong>Local:</strong> '+num(m.local_quantidade)+'</p>'+
            '<p><strong>Classificação:</strong> '+tipo+'</p></div>';
        }).join("");
      return;
  }

  function template(){return painel("divergencias",compararForm("divergencias"),"Diferenças entre as duas bases, sem alterar os registros.");}
  return {render,template};
 };
})();
