/* PMobile / Dados locais: conferencias. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.conferencias=function(ctx){
  const {$,estado,escape,valor,num,norm,rpc,sessao,mensagem,consultar,paginacao,resumo,painel,pesquisarForm,compararForm,atualizarResumo,desenharMateriais,desenharComparacao,quantidade}=ctx;
  function selecionarConferencia(material) {
    $("dlConCodigo").value=material.codigo;
    $("dlConQuantidade").value="";
    $("dlConLocal").value="";
    $("dlConSelecionado").textContent=material.codigo+" — "+(material.descricao||"Material");
    const form=$("dlFormConferencia");
    form.hidden=false;
    form.scrollIntoView({block:"nearest",behavior:"smooth"});
  }

  async function registrarConferencia() {
    if(estado.busy)return;estado.busy=true;
    try{
      const q=quantidade("dlConQuantidade");
      if(q===null)throw new Error("Informe a quantidade física.");
      await rpc("registrar_conferencia",{p_codigo:$("dlConCodigo").value.trim(),
        p_quantidade_fisica:q,p_local_encontrado:$("dlConLocal").value.trim()||null});
      $("dlFormConferencia").reset();
      $("dlFormConferencia").hidden=true;
      mensagem("Conferência local registrada, sem alterar o estoque permanente.");
      await listarConferencias();
    }finally{estado.busy=false;}
  }

  async function listarConferencias() {
    const el=$("dlHistorico");if(!el)return;
    el.textContent="Carregando contagens...";
    try{
      const data=await rpc("listar_conferencias",{p_limite:50});
      const itens=Array.isArray(data)?data:[];
      el.replaceChildren();
      if(!itens.length){
        const vazio=document.createElement("p");
        vazio.textContent="Nenhuma conferência local registrada.";
        el.appendChild(vazio);return;
      }
      itens.forEach(m=>{
        const card=document.createElement("div");
        card.className="registro-contagem-manual";
        const titulo=document.createElement("h3");
        titulo.textContent=m.codigo+" — "+(m.descricao||"Material");
        const detalhes=document.createElement("p");
        detalhes.textContent="Local: "+valor(m.local_encontrado)+
          " | Físico: "+num(m.quantidade_fisica);
        const responsavel=document.createElement("p");
        responsavel.textContent="Realizado por: "+(m.usuario_nome||"Não identificado");
        const data=document.createElement("p");
        data.textContent="Data/hora: "+(m.criado_em?new Date(m.criado_em).toLocaleString("pt-BR"):"—");
        const status=document.createElement("p");
        status.textContent="REGISTRO LOCAL";
        card.append(titulo,detalhes,responsavel,data,status);el.appendChild(card);
      });
    }catch(e){el.textContent=e.message;mensagem(e.message,true);}
  }
  // Os arquivos XLS legados podem conter controles e surrogates isolados.
  // Essas sequências não devem chegar ao corpo JSON do PostgREST.

  function template(){return painel("conferencias",pesquisarForm("conferencias")+
        '<form id="dlFormConferencia" class="painel contagem contagem-registro" hidden>'+
        '<h3 class="contagem-etapa">02 · Registrar conferência local</h3>'+
        '<div id="dlConSelecionado" class="dl-material-selecionado"></div>'+
        '<div class="linha-formulario">'+
        '<label class="contagem-label">Código do material<input id="dlConCodigo" readonly required></label>'+
        '<label class="contagem-label">Local encontrado<input id="dlConLocal" placeholder="Ex.: A-03-12"></label>'+
        '<label class="contagem-label">Quantidade física<input id="dlConQuantidade" type="number" min="0" step="any" required></label>'+
        '<button class="botao-aba contagem-salvar" type="submit">✓ &nbsp; Salvar conferência</button>'+
        '</div></form>'+
        '<div class="painel contagem contagem-lista">'+
        '<div class="contagem-lista-titulo"><div><h3>Contagens registradas</h3>'+
        '<p>Histórico local independente</p></div><span aria-hidden="true">▤</span></div>'+
        '<div id="dlHistorico"></div></div>',
        "Conferências locais são separadas do histórico original.");}
  return {selecionarConferencia,registrarConferencia,listarConferencias,template};
 };
})();
