/* PMobile / Dados locais: estoque. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.estoque=function(ctx){
  const {$,estado,rpc,mensagem,consultar,painel,pesquisarForm}=ctx;
  function selecionar(m) {
    estado.material=m;
    $("dlEditorTitulo").textContent="Editar: "+m.codigo+" — "+m.descricao;
    $("dlQtdItem").value=m.quantidade_item??"";
    $("dlQtdTotal").value=m.quantidade_total??"";
    $("dlQtdReservada").value=m.quantidade_reservada??"";
    $("dlLocal").value=m.local??"";
    $("dlFormEstoque").hidden=false;
    $("dlFormEstoque").scrollIntoView({block:"nearest",behavior:"smooth"});
  }

  function quantidade(id) {
    const texto=$(id).value.trim().replace(",",".");
    if(!texto)return null;
    const n=Number(texto);
    if(!Number.isFinite(n)||n<0)throw new Error("Informe quantidades válidas, iguais ou maiores que zero.");
    return n;
  }

  async function salvarEstoque() {
    const m=estado.material;if(!m)throw new Error("Selecione um material para editar.");
    if(estado.busy)return;estado.busy=true;
    try{
      await rpc("salvar_estoque",{
        p_codigo:m.codigo,p_quantidade_item:quantidade("dlQtdItem"),
        p_quantidade_total:quantidade("dlQtdTotal"),
        p_quantidade_reservada:quantidade("dlQtdReservada"),
        p_local:$("dlLocal").value.trim()||null
      });
      mensagem("Estoque local salvo. Comparando automaticamente com a Dogo...");
      $("dlFormEstoque").hidden=true;estado.material=null;
      await consultar("estoque");
      try {
        const atual=await rpc("comparar",{p_termo:m.codigo,p_limite:50,p_offset:0,p_modo:"todos"});
        const comparado=(Array.isArray(atual)?atual:[]).find((x)=>x.codigo===m.codigo);
        const divergente=!!comparado && [comparado.diferenca_quantidade,comparado.diferenca_reserva,
          comparado.diferenca_local,comparado.sem_dogo].some(Boolean);
        mensagem("Estoque local salvo. "+(divergente?"Diferença identificada na comparação automática.":
          comparado?"Comparação automática concluída.":"Comparação disponível na aba própria."));
      } catch(erroComparacao) {
        mensagem("Estoque salvo. Comparação pendente: "+erroComparacao.message,true);
      }
    }finally{estado.busy=false;}
  }

  function template(){return painel("estoque",pesquisarForm("estoque")+
        '<form id="dlFormEstoque" class="painel contagem contagem-registro" hidden>'+
        '<h3 class="contagem-etapa" id="dlEditorTitulo">02 · Registrar estoque local</h3>'+
        '<div class="linha-formulario">'+
        '<label class="contagem-label">Quantidade do item<input id="dlQtdItem" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label class="contagem-label">Quantidade total<input id="dlQtdTotal" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label class="contagem-label">Itens reservados<input id="dlQtdReservada" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label class="contagem-label">Local<input id="dlLocal" type="text" placeholder="Não preenchido"></label>'+
        '<button class="botao-aba contagem-salvar" type="submit">✓ &nbsp; Salvar estoque local</button></div></form>',
        "Altere somente o estoque manual; a Dogo permanece intacta.");}
  return {selecionar,quantidade,salvarEstoque,template};
 };
})();
