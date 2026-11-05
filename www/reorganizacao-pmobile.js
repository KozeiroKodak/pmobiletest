/* PMobile — reorganização por pontos de acesso, sem duplicar módulos antigos. */
(function() {
 "use strict";
 const itensConfig=[
   ["💰","Valores Total","valores-total","Resumo financeiro atual"],
   ["📦","Importar Estoque","importar-estoque","Importação Dogo original"],
   ["📋","Conferências","conferencias","Histórico existente"]
 ];
 const $=(id)=>document.getElementById(id);
 function executar(nome) {
   if(!window.PMobileModulos?.executarAcao(nome)){
     alert("Funcionalidade indisponível nesta versão.");
   }
 }
 function init(){
   const hub=$("configuracoesHub");
   if(hub&&!$("pmConfigFerramentas")){
     const grupo=document.createElement("div");
     grupo.className="configuracoes-grupo";grupo.id="pmConfigFerramentas";
     const titulo=document.createElement("p");
     titulo.className="configuracoes-etiqueta";titulo.textContent="FERRAMENTAS DO PMOBILE";
     const grade=document.createElement("div");grade.className="configuracoes-grade";
     itensConfig.forEach(([icone,nome,funcao,sub])=>{
       const botao=document.createElement("button");botao.type="button";botao.className="configuracoes-card";
       const ic=document.createElement("span");ic.className="configuracoes-icone";ic.textContent=icone;ic.setAttribute("aria-hidden","true");
       const conteudo=document.createElement("span");conteudo.className="configuracoes-textos";
       const strong=document.createElement("strong");strong.textContent=nome;
       const pequeno=document.createElement("small");pequeno.textContent=sub;
       conteudo.append(strong,pequeno);
       const canto=document.createElement("span");canto.className="configuracoes-canto";canto.textContent="›";
       botao.append(ic,conteudo,canto);botao.addEventListener("click",()=>executar(funcao));
       grade.appendChild(botao);
     });
     grupo.append(titulo,grade);
     const primeiro=hub.querySelector(".configuracoes-grupo");
     if(primeiro)primeiro.insertAdjacentElement("afterend",grupo);else hub.appendChild(grupo);
   }
   const card=$("menuTransportes");
   const conteudo=$("conteudoPrincipal");
   if(card && conteudo && !$("transportes")){
     const screen=document.createElement("section");
     screen.id="transportes";screen.className="tela-sistema";screen.style.display="none";
     screen.innerHTML='<div class="home-apps"><div class="home-apps-cabecalho">'+
       '<div><p class="home-apps-kicker">PMOBILE / TRANSPORTES</p><h1>Transportes</h1>'+
       '<p>Selecione uma funcionalidade.</p></div></div><div class="home-apps-grade">'+
       '<button class="home-app-card" type="button" data-pm-transporte="rastreio">'+
       '<span class="home-app-icone">🚚</span><span class="home-app-conteudo"><strong>Rastreio</strong>'+
       '<small>Relação de notas fiscais enviadas</small></span><span class="home-app-seta">›</span></button>'+
       '<button class="home-app-card" type="button" data-pm-transporte="cotacoes">'+
       '<span class="home-app-icone">📋</span><span class="home-app-conteudo"><strong>Opções de Cotações</strong>'+
       '<small>Consulte transportadoras por região</small></span><span class="home-app-seta">›</span></button>'+
       '</div></div>';
     conteudo.appendChild(screen);
     screen.addEventListener("click",(e)=>{
       const btn=e.target.closest("[data-pm-transporte]");
       if(btn)executar(btn.dataset.pmTransporte);
     });
   }
   const voltarCotacoes=document.querySelector("#opcoesCotacoes .cot-back");
   if(voltarCotacoes){
     voltarCotacoes.removeAttribute("onclick");
     voltarCotacoes.addEventListener("click",e=>{e.preventDefault();abrir();});
   }
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
 window.PMobileModulos?.registrarRetorno("transportes",voltar);
 window.abrirTransportesPmobile=abrir;
 window.voltarUmNivelTransportesPmobile=voltar;
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
 else init();
})();
