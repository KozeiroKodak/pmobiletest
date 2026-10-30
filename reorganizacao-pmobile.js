/* PMobile — reorganização por pontos de acesso, sem duplicar módulos antigos. */
(function() {
 "use strict";
 const iconesConfiguracoes={
   valores:'<circle cx="12" cy="12" r="9"/><path d="M12 6v12m3-9c-1-1-5-1-6 1-.8 1.5 1 2.3 3 2.6 3 .4 4 2 2.3 3.7-1.1 1-4.1 1.2-5.3-.2"/>',
   frete:'<path d="M4 20V11m5 9V6m5 14V9m5 11V3"/><path d="M2 21h20"/>',
   estoque:'<path d="M4 7 12 3l8 4v11l-8 4-8-4z"/><path d="m4 7 8 4 8-4M12 11v11"/>',
   conferencias:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2m-7 7 2 2 4-4m-6 8h8"/>'
 };
 const itensConfig=[
   ["valores","Valores Total","abrirValoresTotal","Resumo financeiro atual"],
   ["frete","Frete Geral 2","abrirValoresTotal2","Versão analítica existente"],
   ["estoque","Importar Estoque","abrirImportacao","Importação Dogo original"],
   ["conferencias","Conferências","abrirConferencias","Histórico existente"]
 ];
 const $=(id)=>document.getElementById(id);
 function executar(nome) {
   if(typeof window[nome]!=="function"){alert("Funcionalidade indisponível nesta versão.");return;}
   window[nome]();
 }
 function init(){
   const hub=$("configuracoesV3Hub");
   if(hub&&!$("pmConfigFerramentas")){
     const grupo=document.createElement("div");
     grupo.className="configuracoes-v3-grupo";grupo.id="pmConfigFerramentas";
     const titulo=document.createElement("p");
     titulo.className="configuracoes-v3-etiqueta";titulo.textContent="FERRAMENTAS DO PMOBILE";
     const grade=document.createElement("div");grade.className="configuracoes-v3-grade";
     itensConfig.forEach(([icone,nome,funcao,sub])=>{
       const botao=document.createElement("button");botao.type="button";botao.className="configuracoes-v3-card";
       const ic=document.createElement("span");ic.className="configuracoes-v3-icone";ic.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(iconesConfiguracoes[icone]||"")+'</svg>';
       const conteudo=document.createElement("span");conteudo.className="configuracoes-v3-textos";
       const strong=document.createElement("strong");strong.textContent=nome;
       const pequeno=document.createElement("small");pequeno.textContent=sub;
       conteudo.append(strong,pequeno);
       const canto=document.createElement("span");canto.className="configuracoes-v3-canto";canto.textContent="›";
       botao.append(ic,conteudo,canto);botao.addEventListener("click",()=>executar(funcao));
       grade.appendChild(botao);
     });
     grupo.append(titulo,grade);
     const primeiro=hub.querySelector(".configuracoes-v3-grupo");
     if(primeiro)primeiro.insertAdjacentElement("afterend",grupo);else hub.appendChild(grupo);
   }
   const rastreio=$("menuRastreio");
   const conteudo=$("conteudoPrincipal");
   if(rastreio && conteudo && !$("transportes")){
     const card=document.createElement("button");card.type="button";
     card.id="menuTransportes";card.className="home-app-card";
     card.innerHTML='<span class="home-app-icone" aria-hidden="true">🚚</span>'+
       '<span class="home-app-conteudo"><strong>Transportes</strong>'+
       '<small>Rastreio e opções de cotações</small></span>'+
       '<span class="home-app-seta" aria-hidden="true">›</span>';
     card.addEventListener("click",abrir);
     rastreio.insertAdjacentElement("beforebegin",card);
     const screen=document.createElement("section");
     screen.id="transportes";screen.className="tela-sistema";screen.style.display="none";
     screen.innerHTML='<div class="home-apps"><div class="home-apps-cabecalho">'+
       '<div><p class="home-apps-kicker">PMOBILE / TRANSPORTES</p><h1>Transportes</h1>'+
       '<p>Selecione uma funcionalidade.</p></div></div><div class="home-apps-grade">'+
       '<button class="home-app-card" type="button" data-pm-transporte="abrirRastreio">'+
       '<span class="home-app-icone">🚚</span><span class="home-app-conteudo"><strong>Rastreio</strong>'+
       '<small>Relação de notas fiscais enviadas</small></span><span class="home-app-seta">›</span></button>'+
       '<button class="home-app-card" type="button" data-pm-transporte="abrirOpcoesCotacoes">'+
       '<span class="home-app-icone">📋</span><span class="home-app-conteudo"><strong>Opções de Cotações</strong>'+
       '<small>Consulte transportadoras por região</small></span><span class="home-app-seta">›</span></button>'+
       '</div></div>';
     conteudo.appendChild(screen);
     screen.addEventListener("click",(e)=>{
       const btn=e.target.closest("[data-pm-transporte]");
       if(btn)executar(btn.dataset.pmTransporte);
     });
   }
   // Apenas os pontos de entrada do menu mudam; os elementos originais
   // continuam no DOM para não comprometer IDs, funções e listeners.
   ["menuValoresTotal","menuValoresTotal2","menuImportacao",
    "menuConferencias","menuRastreio","menuOpcoesCotacoes"].forEach((id)=>{
      const el=$(id);if(el)el.style.display="none";
    });
   const voltarCotacoes=document.querySelector("#opcoesCotacoes .cot-back");
   if(voltarCotacoes)voltarCotacoes.setAttribute("onclick","abrirTransportesPmobile()");
 }
 function abrir(){
   if(typeof window.mostrarTelaSistema!=="function")return;
   window.mostrarTelaSistema("transportes","menuTransportes");
 }
 function voltar(id){
   if(id!=="transportes")return false;
   if(typeof window.mostrarTelaSistema!=="function")return false;
   window.mostrarTelaSistema("homeSistema",null,true);return true;
 }
 window.abrirTransportesPmobile=abrir;
 window.voltarUmNivelTransportesPmobile=voltar;
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
 else init();
})();