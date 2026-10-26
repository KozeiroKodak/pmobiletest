/* Laboratório SharePoint: teste somente leitura, sem persistência de arquivos ou credenciais. */
(function(){"use strict";
const el=id=>document.getElementById(id);
const status=msg=>{if(el("pmspStatus"))el("pmspStatus").textContent=msg;};
function url(){const raw=(el("pmspLink")?.value||"").trim();let u;try{u=new URL(raw);}catch{throw Error("Informe uma URL válida.");}if(u.protocol!=="https:"||!(/(^|\.)sharepoint\.com$/i.test(u.hostname)||/(^|\.)1drv\.ms$/i.test(u.hostname)))throw Error("Use um link HTTPS de SharePoint ou OneDrive.");return u;}
async function testar(){let u;try{u=url();}catch(e){status("🔴 "+e.message);return;}status("🟡 Testando acesso direto ao arquivo...");
try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);let r;try{r=await fetch(u.href,{method:"GET",credentials:"omit",redirect:"follow",signal:controller.signal,headers:{Accept:"application/octet-stream"}});}finally{clearTimeout(timer);}
if(!r.ok)throw Error("HTTP "+r.status+" — o servidor não autorizou o download.");
const ct=r.headers.get("content-type")||"";const buf=new Uint8Array(await r.arrayBuffer());const excel=(buf[0]===0x50&&buf[1]===0x4b)||(buf[0]===0xd0&&buf[1]===0xcf);
if(!excel)throw Error("A resposta não é um Excel (tipo: "+(ct||"desconhecido")+"). Possível página de login ou visualização.");
status("🟢 Excel acessível: "+buf.length.toLocaleString("pt-BR")+" bytes. Nenhum dado foi alterado.");
}catch(e){status("🔴 "+(e.name==="AbortError"?"Tempo limite de 18 segundos.":e.message==="Failed to fetch"?"Bloqueio de rede/CORS ou autenticação. Abrir no navegador não garante acesso por API.":e.message));}}
window.PMSharePointLab={testar,abrir(){try{window.open(url().href,"_blank","noopener,noreferrer");}catch(e){status("🔴 "+e.message);}},limpar(){if(el("pmspLink"))el("pmspLink").value="";status("Aguardando link do SharePoint.");}};
})();