/* Importador alternativo: transporte independente; processamento compartilhado. */
(function(){
"use strict";
let ativo=false,executando=false,timer=null,ultimaHash="",ultimaUrl="";
const campo=()=>document.getElementById("linkOneDriveAlternativo");
const status=(m)=>{const e=document.getElementById("statusImportacaoAlternativa");if(e)e.textContent=m;};
const urlAtual=()=>campo()?.value.trim()||"";
const validar=(url)=>{const u=new URL(url);if(u.protocol!=="https:"||!/^(1drv\.ms|onedrive\.live\.com|[a-z0-9.-]+\.sharepoint\.com)$/i.test(u.hostname))throw Error("Informe um link HTTPS válido do OneDrive/SharePoint.");return u;};
const agendar=()=>{clearTimeout(timer);if(ativo)timer=setTimeout(()=>sincronizar(false),15000);};
async function obterArquivo(url){
  // Transporte V2 independente: não chama proxy antigo nem ponte nativa.
  if(!window.clienteSupabase?.functions?.invoke)throw Error("Cliente Supabase indisponível.");
  const {data,error}=await window.clienteSupabase.functions.invoke("pmobile-onedrive-v2",{body:{url}});
  if(error){
    let detail=error.message||"Falha no download V2";
    try{const json=await error.context?.json?.();if(json?.error)detail=json.error;}catch{}
    throw Error(detail);
  }
  if(!data)throw Error("O download V2 não retornou conteúdo.");
  const blob=data instanceof Blob?data:new Blob([data]);
  const a=new Uint8Array(await blob.slice(0,8).arrayBuffer());
  if(!((a[0]===80&&a[1]===75)||(a[0]===208&&a[1]===207)))throw Error("A rota V2 não retornou Excel.");
  return new File([blob],"onedrive-v2.xlsm",{type:"application/octet-stream"});
}
async function sincronizar(forcar=false){
  if(executando)return;
  if(typeof usuarioRastreioEhAdmin==="function"&&!usuarioRastreioEhAdmin()){status("🔴 A sincronização exige acesso administrativo.");return;}
  let url;
  try{url=validar(urlAtual()).href;}catch(e){status("🔴 "+e.message);return;}
  executando=true;status("🟡 Obtendo Excel pelo importador alternativo...");
  try{
    const arquivo=await obterArquivo(url);
    await prepararImportacaoRastreio(arquivo);
    if(!dadosImportacaoRastreio)throw Error("A planilha não pôde ser processada.");
    const hash=dadosImportacaoRastreio.sha256||"";
    if(!dadosImportacaoRastreio.linhas?.length)throw Error("Nenhuma linha operacional encontrada; nada foi enviado.");
    if(!forcar&&hash&&ultimaHash===hash&&ultimaUrl===url){status("🟢 Sem alterações · "+new Date().toLocaleTimeString("pt-BR"));return;}
    if(!document.getElementById("alteracoesOneDriveAlternativo")?.checked){status("🟡 Arquivo lido; aplicação das alterações desativada.");return;}
    if(!window.clienteSupabase?.rpc)throw Error("Supabase indisponível.");
    const lote=prepararLinhasRastreioParaEnvio(0,dadosImportacaoRastreio.linhas.length,true);
    if(!lote.resultado?.length)throw Error("Nenhuma linha válida para sincronização.");
    const sessao=obterSessaoRastreioImportacao();
    const chave=await calcularChaveFonteOneDriveRastreio(url);
    const {data,error}=await window.clienteSupabase.rpc("pmobile_rastreio_sincronizar_fonte",{
      p_usuario:sessao.usuario,p_credencial:sessao.credencial,p_chave:chave,p_url:url,
      p_arquivo_nome:arquivo.name,p_sha256:hash,p_linhas:lote.resultado,p_substituir:false
    });
    if(error)throw error;
    ultimaHash=hash;ultimaUrl=url;
    if(typeof salvarValoresTotalPlanilha==="function")await salvarValoresTotalPlanilha();
    if(typeof carregarRastreios==="function")await carregarRastreios();
    const d=Array.isArray(data)?data[0]:data;
    status("🟢 V2 sincronizado · "+Number(d?.novas||0)+" novas · "+Number(d?.alteradas||0)+" alteradas · "+Number(d?.removidas||0)+" removidas.");
  }catch(e){console.error("Importador alternativo:",e);status("🔴 "+(e.message||e));}
  finally{executando=false;agendar();}
}
window.PMImportadorAlternativo={
  sincronizar,
  iniciar(){ativo=true;sincronizar(true);},
  parar(){ativo=false;clearTimeout(timer);status("○ Sincronização alternativa parada.");},
  reler(){ultimaHash="";sincronizar(true);},
  async importarArquivo(file){if(!file)return;try{status("🟡 Lendo arquivo local...");await prepararImportacaoRastreio(file);status("🟢 Arquivo analisado. Confira a prévia no importador original antes de enviar.");}catch(e){status("🔴 "+e.message);}}
};
})();
