/* PMobile — reorganização por pontos de acesso, sem duplicar módulos antigos. */
(function() {
 "use strict";
 const itensConfig=[
   ["💰","Valores Total","abrirValoresTotal","Resumo financeiro atual"],
   ["📊","Frete Geral 2","abrirValoresTotal2","Versão analítica existente"],
   ["📦","Importar Estoque","abrirImportacao","Importação Dogo original"],
   ["🗂️","Conferências","abrirConferencias","Histórico existente"]
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
       const ic=document.createElement("span");ic.className="configuracoes-v3-icone";ic.textContent=icone;
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