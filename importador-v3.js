/* Microsoft Graph V3 - laboratório somente leitura. OAuth SPA PKCE. */
(function(){
"use strict";
const key="pmobile_v3_client",stateKey="pmobile_v3_pkce";
let token="",expires=0,items=[];
const $=id=>document.getElementById(id);
const status=m=>{if($("pmv3Status"))$("pmv3Status").textContent=m;};
const redirect=()=>location.origin+location.pathname;
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
async function challenge(v){return b64(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));}
const client=()=>($("pmv3ClientId")?.value||"").trim();
const auth="https://login.microsoftonline.com/common/oauth2/v2.0";
async function conectar(){
 const id=client();
 if(!/^[0-9a-f-]{36}$/i.test(id)){status("🔴 Informe um Client ID válido do registro Microsoft Entra.");return;}
 localStorage.setItem(key,id);
 const verifier=random(),state=random();
 sessionStorage.setItem(stateKey,JSON.stringify({verifier,state,redirect:redirect(),time:Date.now()}));
 const p=new URLSearchParams({client_id:id,response_type:"code",redirect_uri:redirect(),response_mode:"query",scope:"openid profile offline_access Files.Read",code_challenge:await challenge(verifier),code_challenge_method:"S256",state,prompt:"select_account"});
 status("🟡 Abrindo login Microsoft...");
 location.assign(auth+"/authorize?"+p.toString());
}
async function retorno(){
 const q=new URLSearchParams(location.search);
 if(!q.has("code")&&!q.has("error"))return;
 const clean=()=>history.replaceState(null,"",location.pathname+location.hash);
 const raw=sessionStorage.getItem(stateKey);
 if(!raw){status("🔴 Sessão de autenticação não encontrada. Inicie o login novamente.");clean();return;}
 const p=JSON.parse(raw);sessionStorage.removeItem(stateKey);
 if(q.get("error")){status("🔴 Microsoft: "+(q.get("error_description")||q.get("error")));clean();return;}
 if(q.get("state")!==p.state||Date.now()-p.time>600000){status("🔴 Retorno OAuth inválido ou expirado.");clean();return;}
 try{
 const form=new URLSearchParams({client_id:localStorage.getItem(key)||"",grant_type:"authorization_code",code:q.get("code"),redirect_uri:p.redirect,code_verifier:p.verifier,scope:"openid profile offline_access Files.Read"});
 const res=await fetch(auth+"/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
 const d=await res.json();if(!res.ok||!d.access_token)throw Error(d.error_description||d.error||"Falha no token");
 token=d.access_token;expires=Date.now()+Number(d.expires_in||3600)*1000;
 status("🟢 Microsoft conectada. Selecione 'Listar arquivos Excel'.");
 }catch(e){status("🔴 Login: "+e.message);}finally{clean();}
}
async function graph(path){
 if(!token||Date.now()>expires-60000)throw Error("Sessão expirada. Conecte a Microsoft novamente.");
 const r=await fetch("https://graph.microsoft.com/v1.0"+path,{headers:{Authorization:"Bearer "+token}});
 if(!r.ok){const e=await r.json().catch(()=>({}));throw Error("Graph HTTP "+r.status+": "+(e.error?.message||"Verifique permissões"));}
 return r;
}
async function listar(){
 try{
 status("🟡 Buscando arquivos na raiz do OneDrive...");
 const r=await graph("/me/drive/root/children?$select=id,name,size,eTag,file&$top=200");
 const d=await r.json();
 items=(d.value||[]).filter(x=>/\.(xlsx|xlsm|xlsb|xls)$/i.test(x.name)&&x.file);
 const select=$("pmv3Arquivo");select.replaceChildren(new Option("Selecione a planilha",""));
 for(const x of items)select.add(new Option(x.name+" ("+Math.round((x.size||0)/1024)+" KB)",x.id));
 status("🟢 "+items.length+" arquivo(s) Excel na raiz. Pastas e itens compartilhados ainda não são listados nesta versão.");
 }catch(e){status("🔴 "+e.message);}
}
async function testar(){
 try{
 const id=$("pmv3Arquivo")?.value;if(!id)throw Error("Selecione um arquivo.");
 status("🟡 Obtendo Excel via Microsoft Graph...");
 const r=await graph("/me/drive/items/"+encodeURIComponent(id)+"/content");
 const blob=await r.blob();const h=new Uint8Array(await blob.slice(0,8).arrayBuffer());
 if(!((h[0]===80&&h[1]===75)||(h[0]===208&&h[1]===207)))throw Error("Graph não retornou um arquivo Excel válido.");
 const nome=items.find(x=>x.id===id)?.name||"arquivo.xlsx";
 status("🟢 Download confirmado: "+nome+" · "+blob.size.toLocaleString("pt-BR")+" bytes · assinatura Excel válida. Nenhum dado foi gravado.");
 }catch(e){status("🔴 "+e.message);}
}
window.PMImportadorV3={conectar,listar,testar,desconectar(){token="";expires=0;items=[];sessionStorage.removeItem(stateKey);status("○ Desconectado. Nenhum token foi salvo permanentemente.");}};
document.addEventListener("DOMContentLoaded",()=>{if($("pmv3ClientId"))$("pmv3ClientId").value=localStorage.getItem(key)||"";if($("pmv3Redirect"))$("pmv3Redirect").textContent="URI de retorno (SPA): "+redirect();retorno();});
})();