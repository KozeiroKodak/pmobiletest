/* PMobile / Dados locais: pesquisa. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.pesquisa=function(ctx){
  const {$,estado,escape,valor,num,norm,rpc,sessao,mensagem,consultar,paginacao,resumo,painel,pesquisarForm,compararForm,atualizarResumo,desenharMateriais,desenharComparacao,quantidade}=ctx;
  function form(aba) {

    const contagem=aba==="estoque"||aba==="conferencias";
    const nome=aba==="conferencias"?"Conferências locais":aba==="estoque"?
      "Estoque manual":"Pesquisa local";
    const etapa=aba==="conferencias"?"Encontre um material para registrar uma conferência.":
      aba==="estoque"?"Encontre um material para atualizar o estoque.":"Encontre um material no cadastro local.";
    const classe=contagem?"contagem":"pesquisa";
    const prefix=classe;
    const subtitulo=contagem?"Inventário / "+nome:"Catálogo / Pesquisa local";
    const selector=contagem?'<div class="seletor-contagem-manual-wrapper">'+
      '<select class="seletor-contagem-manual-nativo" aria-hidden="true" tabindex="-1" name="tipo">'+
      '<option value="codigo">CÓD</option><option value="referencia">REF</option>'+
      '<option value="descricao">DESC</option></select>'+
      '<button type="button" class="seletor-contagem-manual" data-dl-seletor aria-label="Alternar tipo de pesquisa">CÓD</button></div>':
      '<select class="pesquisa-select" name="tipo" aria-label="Tipo de pesquisa">'+
      '<option value="codigo">Código</option><option value="referencia">Referência</option>'+
      '<option value="descricao">Descrição</option></select>';
    const buttons=['codigo','referencia','descricao'].map(tipo=>{
      const label={codigo:"Código",referencia:"Referência",descricao:"Descrição"}[tipo];
      return '<button type="button" data-dl-tipo="'+tipo+'" class="'+(tipo==="codigo"?"ativo":"")+
        '" aria-pressed="'+(tipo==="codigo"?"true":"false")+'">'+label+'</button>';
    }).join('');
    const controls=contagem?
      '<div class="acoes-contagem-manual-config"><button type="button" class="botao-aba botao-config-contagem-manual"'+
      ' data-dl-config="'+aba+'" aria-label="Informações do estoque local">⚙</button></div>':'';
    const panel='<div class="painel '+classe+(contagem?' dl-contagem-principal':'')+'">'+
      '<div class="'+prefix+'-topo"><div class="'+prefix+'-marca">'+
      '<span class="'+prefix+'-icone">'+(contagem?'▤':'⌕')+'</span>'+
      '<div><strong>PMobile</strong><small>'+subtitulo+'</small></div></div>'+
      '<span class="'+prefix+'-selo">● '+(contagem?'Registro local':'Dados locais')+'</span></div>'+
      '<div class="'+prefix+'-intro"><h2>'+nome+'</h2><p>'+etapa+'</p></div>'+
      (contagem?'<h3 class="contagem-etapa">01 · Localizar material</h3>':'')+
      '<form class="'+(contagem?'linha-formulario linha-contagem-manual-busca':'dl-pesquisa-original')+
      '" data-dl-busca="'+aba+'">'+
      '<div class="'+prefix+'-campo"><span aria-hidden="true">⌕</span>'+
      '<input type="search" name="termo" placeholder="Digite o código" autocomplete="off" aria-label="Buscar material"></div>'+
      selector+
      '<div class="'+prefix+'-tipos" role="group" aria-label="Pesquisar por">'+buttons+'</div>'+
      '<button type="submit" class="'+(contagem?'botao-aba botao-buscar-contagem-manual':'pesquisa-buscar')+
      '">⌕ &nbsp; Buscar material</button>'+controls+'</form>'+
      '<div class="'+prefix+'-resultados" id="dlResultados-'+aba+'" aria-live="polite"></div>'+
      (contagem?'<p class="dl-informacao" id="dlConfig-'+aba+'" hidden>'+
        'Base independente: somente o catálogo e o histórico de Dados locais são utilizados.</p>':'')+
      '</div>';
    return panel+(contagem?'':paginacao(aba));
  }

  function render(aba,itens) {
    const el=$("dlResultados-"+aba);el.replaceChildren();

    if(!itens.length){
      el.innerHTML='<div class="pesquisa-vazio"><strong>Nenhum material encontrado</strong>'+
        '<p>Confira o material e tente novamente.</p></div>';return;
    }
    if(aba==="estoque"||aba==="conferencias"){
      itens.forEach(m=>{
        const bloco=document.createElement("div");
        bloco.className="resultado-contagem-manual";
        const titulo=document.createElement("h3");
        titulo.textContent=m.codigo+" — "+(m.descricao||"Material");
        const detalhes=document.createElement("p");
        detalhes.textContent="Referência: "+valor(m.referencia)+" | Local: "+valor(m.local)+
          " | Estoque local: "+num(m.quantidade_total);
        const btn=document.createElement("button");
        btn.type="button";btn.className="botao-principal";
        btn.textContent=aba==="conferencias"?"Selecionar para conferência":"Editar estoque local";
        if(aba==="conferencias"){
          btn.dataset.dlConferir=m.codigo;btn.dataset.dlSource=aba;
        }else{btn.dataset.dlEdit=m.codigo;btn.dataset.dlSource=aba;}
        bloco.append(titulo,detalhes,btn);
        el.appendChild(bloco);
      });
      return;
    }
    const cont=document.createElement("p");cont.className="pesquisa-contagem";
    cont.textContent=itens.length+" material(is) nesta página";el.appendChild(cont);
    itens.forEach((m)=>{
      const cadastrado=m.quantidade_total!==null||m.quantidade_item!==null||
        m.quantidade_reservada!==null||Boolean(m.local);
      const card=document.createElement("details");card.className="pesquisa-card";
      const sum=document.createElement("summary");
      const cod=document.createElement("span");cod.className="pesquisa-codigo";cod.textContent=m.codigo;
      const status=document.createElement("span");status.className="pesquisa-disponivel"+(cadastrado?"":" zero");
      status.textContent=cadastrado?"Dados preenchidos":"Pendente";
      const desc=document.createElement("strong");desc.textContent=m.descricao;
      const ref=document.createElement("small");ref.textContent="Ref.: "+valor(m.referencia)+" · Toque para detalhes";
      sum.append(cod,status,desc,ref);card.appendChild(sum);
      const detalhes=document.createElement("div");detalhes.className="pesquisa-detalhes";
      [["Código",m.codigo],["Referência",m.referencia],["Marca",m.marca],
       ["Local",m.local],["Quantidade do item",num(m.quantidade_item)],
       ["Quantidade total",num(m.quantidade_total)],["Itens reservados",num(m.quantidade_reservada)]]
       .forEach(([label,v])=>{
         const box=document.createElement("div"),small=document.createElement("small"),bold=document.createElement("b");
         small.textContent=label;bold.textContent=valor(v);box.append(small,bold);detalhes.appendChild(box);
       });
      card.appendChild(detalhes);
      const acoes=document.createElement("div");acoes.className="dl-local-acoes";
      [["Editar estoque local","dlEdit","dlSource"],["Conferir material","dlConferir",null]]
        .forEach(([texto,prop,second])=>{
          const btn=document.createElement("button");btn.type="button";btn.className="botao-aba";
          btn.textContent=texto;btn.dataset[prop]=m.codigo;
          if(second)btn.dataset[second]=aba;
          acoes.appendChild(btn);
        });
      card.appendChild(acoes);el.appendChild(card);
    });
  }
  return {form,render};
 };
})();
