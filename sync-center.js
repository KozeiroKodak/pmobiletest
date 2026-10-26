/* Central de sincronização v1 — somente apresentação e ações existentes. */
(function(){
"use strict";
const APP="pmobile";
let expanded=false,busy=false,lastAttempt=null,lastError="",refreshing=false;
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
const time=t=>{if(!t)return "Não registrada";const d=new Date(t);return isNaN(d.getTime())?String(t):d.toLocaleString("pt-BR");};
async function snapshot(){
 const s=window.estadoSincronizacaoPmobile||{};
 const onedrive=window.estadoOneDriveRastreio||{};
 const online=navigator.onLine&&s.internetConfirmada!==false;
 let count=null,blocked=0,inventory=null,stamp=null,driver=null,unknown=0;
 if(typeof lerContagensManuais==="function"){try{const list=await lerContagensManuais();if(Array.isArray(list)){count=list.filter(x=>!x.sincronizado&&!x.bloqueadoPorLimpeza).length;blocked=list.filter(x=>!x.sincronizado&&x.bloqueadoPorLimpeza).length;}}catch(e){lastError=String(e.message||e);}}
 if(typeof obterMateriaisLocais==="function"){try{const a=obterMateriaisLocais();if(Array.isArray(a))inventory=a.length;}catch(e){}}
 if(typeof obterDataUltimaSincronizacao==="function"){try{stamp=await obterDataUltimaSincronizacao();}catch(e){}}
 if(APP==="coletas"&&window.PMColetasOffline){try{const all=await window.PMColetasOffline.listar();const user=String((typeof sessaoMotorista==="function" ? sessaoMotorista()?.usuario : null)||window.usuarioPmobileAtual?.usuario||"");const own=all.filter(x=>x.usuario===user);driver=own.filter(x=>x.estado==="pendente"||x.estado==="enviando").length;unknown=own.filter(x=>x.estado==="incerto").length;}catch(e){lastError=String(e.message||e);}}
 let conferences=null;
 if(APP==="pmobile"&&typeof obterConferenciasPendentes==="function"){try{const a=await obterConferenciasPendentes();if(Array.isArray(a))conferences=a.length;}catch(e){}}
 const pending=(count||0)+(driver||0)+(conferences||0);
 let state=busy?"busy":!online?"offline":unknown||blocked||s.erro||lastError||onedrive.estado==="erro"?"error":pending?"pending":(APP!=="coletas"&&inventory===0)||((APP!=="coletas")&&count===null)?"attention":"ok";
 // Não declarar sucesso se os módulos críticos ainda não foram verificados.
 
 if(state==="ok"&&APP==="coletas"&&driver===null)state="attention";
 return {online,count,blocked,inventory,stamp,driver,unknown,conferences,pending,state,onedrive};
}
const labels={ok:["Tudo sincronizado","Registros confirmados"],attention:["Sincronização requer atenção","Verifique os detalhes"],pending:["Operações pendentes","Aguardando confirmação do servidor"],offline:["Modo offline","Dados locais disponíveis, quando carregados"],busy:["Sincronizando...","Verificando operações"],error:["Sincronização requer revisão","Existem falhas ou registros a verificar"]};
let root,button,panel;
function detailRow(label,value){const row=el("div","sync-detail-row");row.append(el("span","",label),el("strong","",String(value)));return row;}
async function render(){
 if(refreshing||!root)return;refreshing=true;
 try{
 const d=await snapshot();const [title,sub]=labels[d.state];
 root.dataset.state=d.state;button.replaceChildren();
 const dot=el("span","sync-dot");const words=el("span","sync-words");words.append(el("strong","",title),el("small","",sub));
 button.append(dot,words,el("span","sync-chevron",expanded?"⌄":"⌃"));
 button.setAttribute("aria-expanded",String(expanded));
 panel.hidden=!expanded;
 if(expanded){
 panel.replaceChildren(detailRow("Conexão",d.online?"Online":"Offline"));
 if(d.inventory!==null)panel.append(detailRow("Materiais locais",d.inventory.toLocaleString("pt-BR")));
 if(d.count!==null)panel.append(detailRow("Contagens pendentes",d.count));
 if(d.conferences!==null)panel.append(detailRow("Conferências pendentes",d.conferences));
 if(d.driver!==null)panel.append(detailRow("Envios do motorista",d.driver));
 if(d.unknown)panel.append(detailRow("Envios incertos — revisar",d.unknown));
 if(d.blocked)panel.append(detailRow("Contagens bloqueadas — revisar",d.blocked));
 if(d.stamp)panel.append(detailRow("Último inventário",time(d.stamp)));
 if(lastAttempt)panel.append(detailRow("Última tentativa",time(lastAttempt)));
 if(d.onedrive.estado==="erro")panel.append(detailRow("OneDrive","Falha na sincronização"));
 if(d.onedrive.estado==="erro"&&d.onedrive.mensagem)panel.append(el("p","sync-error",d.onedrive.mensagem.slice(0,220)));
 if(lastError)panel.append(el("p","sync-error",lastError.slice(0,220)));
 if(d.unknown||d.blocked)panel.append(el("p","sync-note","Operações em revisão não são reenviadas automaticamente."));
 const action=el("button","sync-action",busy?"Sincronizando...":"↻  Sincronizar agora");
 action.type="button";action.disabled=busy||!d.online;action.addEventListener("click",retry);panel.append(action);
 panel.append(el("p","sync-note","A confirmação depende do servidor. Nenhum dado é apagado por este painel."));
 }
 }catch(e){console.warn("Central de sincronização:",e);}finally{refreshing=false;}
}
async function retry(){
 if(busy||!navigator.onLine)return;
 busy=true;lastAttempt=Date.now();lastError="";await render();
 try{
 if(APP==="coletas"&&window.PMColetasOffline)await window.PMColetasOffline.enviar();
 if(APP!=="coletas"&&typeof atualizarContagensManuais==="function")await atualizarContagensManuais();
 if(typeof sincronizarMateriaisLocaisComSupabase==="function") {
   const result=await sincronizarMateriaisLocaisComSupabase(false);
   if(result&&!result.sucesso&&!result.ignorada)lastError="Inventário: atualização não confirmada.";
 }
 if(typeof avaliarSincronizacoesPmobile==="function")await avaliarSincronizacoesPmobile();
 }catch(e){lastError=String(e.message||e);console.warn("Sincronização manual:",e);}
 finally{busy=false;await render();}
}
function init(){
 if(document.getElementById("pm-sync-center"))return;
 root=el("section","pm-sync-center");root.id="pm-sync-center";root.setAttribute("aria-label","Central de sincronização");
 button=el("button","sync-toggle");button.type="button";button.setAttribute("aria-controls","pm-sync-details");
 panel=el("div","sync-details");panel.id="pm-sync-details";panel.hidden=true;
 button.addEventListener("click",()=>{expanded=!expanded;render();});
 root.append(button,panel);document.body.append(root);
 render();setInterval(()=>{if(!document.hidden)render();},10000);
 window.addEventListener("online",render);window.addEventListener("offline",render);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)render();});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();