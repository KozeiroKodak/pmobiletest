/* PMobile — editor independente de avatar e fundo (OTA web).
 * Foto circular: JPEG 384px; fundo: JPEG otimizado sem recorte.
 * Fundo e ajustes: RPC credenciado, IndexedDB offline por conta.
 */
(function(){
"use strict";
const DB="pmobile-fotos-perfil-v1", STORE="fotos", MAX_FILE=10*1024*1024, MAX_BG=1250000;
const DEFAULT={x:50,y:50,zoom:100,degrade:55};
const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||min));
const opts=o=>({
 x:clamp(o?.x??50,0,100),y:clamp(o?.y??50,0,100),
 zoom:clamp(o?.zoom??100,100,200),degrade:clamp(o?.degrade??55,20,85)
});
let profileKey=null,screenBlob=null,background=null,backgroundURL=null,avatarBlob=null,revision=0,loading=false;
let mode="perfil",workingBlob=null,workingURL=null,newImage=false,working=opts(DEFAULT),saving=false;
const imageNodes=()=>[$("inicioFotoTelaCheia"),$("inicioFotoCompletaMobile")].filter(Boolean);
function current(){
 const u=window.usuarioPmobileAtual,c=window.credencialPmobileAtual;
 if(!u?.usuario||!c)return null;
 return {key:u.id==null?"login:"+String(u.usuario).trim().toLocaleLowerCase("pt-BR"):String(u.id),
   user:String(u.usuario),credential:String(c)};
}
function status(msg){
 if($("pmEditorStatus"))$("pmEditorStatus").textContent=msg;
}
function local(mode,action){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(Error("IndexedDB indisponível"));return;}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);
  };
  req.onerror=()=>reject(req.error||Error("Falha no banco local"));
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
   let value,request;
   try{request=action(store);}catch(e){db.close();reject(e);return;}
   request.onsuccess=()=>{value=request.result;};
   request.onerror=()=>reject(request.error||Error("Falha no armazenamento"));
   tx.oncomplete=()=>{db.close();resolve(value);};
   tx.onerror=()=>{db.close();reject(tx.error||Error("Transação falhou"));};
   tx.onabort=()=>{db.close();reject(tx.error||Error("Transação abortada"));};
  };
 });
}
const key=(type,user)=>type+":"+user.key;
function blobURL(blob){
 if(!(blob instanceof Blob)||!blob.size)return null;
 return URL.createObjectURL(blob);
}
function revoke(url){if(url)URL.revokeObjectURL(url);}
function fromBase64(str){
 const bin=atob(str);
 if(bin.length<100||bin.length>MAX_BG)throw Error("Fundo remoto fora do limite");
 const arr=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
 if(arr[0]!==255||arr[1]!==216||arr[2]!==255)throw Error("Formato remoto inválido");
 return new Blob([arr],{type:"image/jpeg"});
}
function toBase64(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
  reader.onerror=()=>reject(reader.error||Error("Falha ao codificar a foto"));
  reader.readAsDataURL(blob);
 });
}
async function rpc(user,func,fields={}){
 if(!navigator.onLine||!window.clienteSupabase)throw Error("Sem conexão com o Supabase");
 const {data,error}=await window.clienteSupabase.rpc(func,{
   p_usuario:user.user,p_credencial:user.credential,...fields
 });
 if(error)throw error;
 return data;
}
async function remoteWrite(user,rec,remove=false,sendBlob=false){
 const img=sendBlob&&rec.blob?await toBase64(rec.blob):null;
 const result=await rpc(user,"pmobile_fundo_perfil_salvar",{
  p_imagem_base64:img,p_x:rec.settings.x,p_y:rec.settings.y,
  p_zoom:rec.settings.zoom,p_degrade:rec.settings.degrade,p_remover:remove
 });
 if(result!==true)throw Error("Alteração de fundo não autorizada pelo servidor.");
}
function updateScreen(){
 const valid=current(),blob=valid&&valid.key===profileKey
   ? (background?.blob||avatarBlob) : null;
 const settings=opts(background?.settings||DEFAULT);
 if(screenBlob!==blob){
  revoke(backgroundURL);backgroundURL=blobURL(blob);screenBlob=blob;
  for(const img of imageNodes()){
   if(backgroundURL){img.src=backgroundURL;img.hidden=false;}
   else{img.removeAttribute("src");img.hidden=true;}
  }
 }
 const root=$("inicio");
 if(root){
  root.style.setProperty("--pm-fundo-x",settings.x+"%");
  root.style.setProperty("--pm-fundo-y",settings.y+"%");
  root.style.setProperty("--pm-fundo-zoom",String(settings.zoom/100));
  root.style.setProperty("--pm-fundo-escuro",String(settings.degrade/100));
 }
 window.PMobileInicioModelo9?.verificar?.();
}
function clear(){
 revision++;profileKey=null;avatarBlob=null;background=null;
 updateScreen();
 if($("pmPerfilFotoDialog")?.open)renderEditor();
}
async function refresh(force=false){
 const user=current();
 if(!user){clear();return;}
 if(!force&&user.key===profileKey)return;
 const token=++revision,changed=user.key!==profileKey;
 if(changed){
   profileKey=user.key;background=null;avatarBlob=null;
   updateScreen();
 }
 try{
  const rec=await local("readonly",store=>store.get(key("wallpaper",user)));
  if(token!==revision||current()?.key!==user.key)return;
  if(rec&&typeof rec==="object"&&rec.settings){
   background={blob:rec.blob instanceof Blob?rec.blob:null,settings:opts(rec.settings)};
   updateScreen();
  }
 }catch(e){console.warn("PMobile fundo local:",e);}
 if(!navigator.onLine||!window.clienteSupabase)return;
 try{
  const pending=await local("readonly",store=>store.get(key("wallpaper-pending",user)));
  if(token!==revision||current()?.key!==user.key)return;
  if(pending&&background){
   await remoteWrite(user,background,pending==="remove",true);
   await local("readwrite",store=>store.delete(key("wallpaper-pending",user)));
  }
  const remote=await rpc(user,"pmobile_fundo_perfil_ler");
  if(token!==revision||current()?.key!==user.key)return;
  if(!remote||typeof remote!=="object")return;
  const rec={blob:remote.imagem?fromBase64(remote.imagem):null,settings:opts(remote)};
  await local("readwrite",store=>store.put(rec,key("wallpaper",user)));
  if(token!==revision||current()?.key!==user.key)return;
  background=rec;updateScreen();
  if($("pmPerfilFotoDialog")?.open&&mode==="fundo"&&!newImage)renderEditor();
 }catch(e){
  if(token===revision)console.warn("Fundo disponível localmente; sincronização pendente:",e);
 }
}
function onAvatarReady(event){
 const user=current();
 if(!user){clear();return;}
 if(!event.detail||event.detail.chave!==user.key)return;
 if(profileKey!==user.key){
  // Nenhuma foto de fundo da conta anterior pode ser exibida.
  background=null;avatarBlob=null;profileKey=user.key;
 }
 avatarBlob=window.PMobilePerfilFotos?.obterFotoAtual?.()||null;
 updateScreen();
 if($("pmPerfilFotoDialog")?.open&&mode==="perfil"&&!newImage)renderEditor();
}
function imageLoad(blob){
 return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(blob);
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Imagem inválida ou incompatível"));};
  img.src=url;
 });
}
function toJpeg(canvas,q){
 return new Promise((resolve,reject)=>canvas.toBlob(
  data=>data?resolve(data):reject(Error("Não foi possível gerar JPEG")),"image/jpeg",q));
}
async function optimizeBackground(file){
 if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Escolha JPG, PNG ou WebP");
 if(file.size>MAX_FILE)throw Error("Imagem original deve ter no máximo 10 MB");
 const img=await imageLoad(file);
 if(!img.naturalWidth||!img.naturalHeight||Math.max(img.naturalWidth,img.naturalHeight)>16000)throw Error("Dimensões inválidas");
 let factor=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Canvas indisponível");
 for(let pass=0;pass<4;pass++){
  canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  for(const quality of [.83,.74,.63,.52]){
   const result=await toJpeg(canvas,quality);
   if(result.size>=100&&result.size<=MAX_BG)return result;
  }
  factor*=.82;
 }
 throw Error("Não foi possível reduzir o fundo ao limite permitido");
}
async function cropAvatar(blob,settings){
 const img=await imageLoad(blob),canvas=document.createElement("canvas");
 canvas.width=384;canvas.height=384;
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas indisponível");
 const o=opts(settings),scale=Math.max(384/img.naturalWidth,384/img.naturalHeight)*o.zoom/100;
 const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
 const left=(384-w)*o.x/100,top=(384-h)*o.y/100;
 ctx.fillStyle="#291d37";ctx.fillRect(0,0,384,384);
 ctx.drawImage(img,left,top,w,h);
 let result=await toJpeg(canvas,.83);
 if(result.size>320*1024)result=await toJpeg(canvas,.67);
 if(result.size<100||result.size>320*1024)throw Error("Recorte excedeu o limite");
 return result;
}
function setWorkingBlob(blob,changed=false){
 revoke(workingURL);workingURL=blobURL(blob);workingBlob=blob;newImage=changed;
 const img=$("pmEditorPreviewImagem");
 if(img){
  if(workingURL){img.src=workingURL;img.hidden=false;}
  else{img.removeAttribute("src");img.hidden=true;}
 }
 const placeholder=$("pmEditorPreviewPlaceholder");
 if(placeholder)placeholder.hidden=!!workingURL;
 updatePreview();
}
function updatePreview(){
 const o=opts(working);working=o;
 for(const field of [["X","x"],["Y","y"],["Zoom","zoom"],["Degrade","degrade"]]){
  const el=$("pmEditorCampo"+field[0]);
  if(el)el.value=String(o[field[1]]);
  const value=$("pmEditorValor"+field[0]);
  if(value)value.textContent=String(o[field[1]])+"%";
 }
 const img=$("pmEditorPreviewImagem");
 if(img){
  img.style.objectPosition=o.x+"% "+o.y+"%";
  img.style.transform="scale("+(o.zoom/100)+")";
 }
 const preview=$("pmEditorPreview");
 if(preview)preview.style.setProperty("--pm-editor-degrade",String(o.degrade/100));
}
function renderEditor(){
 const isAvatar=mode==="perfil";
 const avatar=$("pmEditorAbaPerfil"),wall=$("pmEditorAbaFundo");
 for(const [node,selected] of [[avatar,isAvatar],[wall,!isAvatar]]){
  if(node){node.classList.toggle("ativo",selected);node.setAttribute("aria-selected",String(selected));}
 }
 const frame=$("pmEditorPreview");
 if(frame)frame.classList.toggle("pm-editor-perfil",isAvatar);
 const shade=$("pmEditorLinhaDegrade");
 if(shade)shade.hidden=isAvatar;
 const title=$("pmEditorRotulo");
 if(title)title.textContent=isAvatar?"Enquadramento do perfil":"Enquadramento do fundo";
 const note=$("pmEditorAjuda");
 if(note)note.textContent=isAvatar
  ?"Mova, amplie e centralize o rosto dentro do círculo."
  :"Escolha uma foto vertical ou horizontal, mova a imagem e ajuste o degradê roxo.";
 working=opts(isAvatar?DEFAULT:(background?.settings||DEFAULT));
 setWorkingBlob(isAvatar?(window.PMobilePerfilFotos?.obterFotoAtual?.()||avatarBlob):background?.blob||avatarBlob,false);
 const remove=$("pmEditorRemover");
 if(remove)remove.textContent=isAvatar?"Remover foto do perfil":"Remover fundo personalizado";
 status(isAvatar?"Perfil circular: imagem 384 × 384 após salvar.":"Fundo independente; sem imagem própria, usa o avatar como alternativa.");
}
function choose(modeName){
 mode=modeName;renderEditor();
}
async function saveBackground(remove=false){
 const user=current();if(!user)throw Error("Faça login novamente");
 const selected=opts(working);
 const existing=background?.blob||null;
 const blob=remove?null:(newImage?await optimizeBackground(workingBlob):existing);
 if(current()?.key!==user.key)throw Error("A conta mudou");
 const rec={blob,settings:remove?opts(DEFAULT):selected};
 const online=!!(navigator.onLine&&window.clienteSupabase);
 if(online)await remoteWrite(user,rec,remove,newImage&&!remove);
 if(current()?.key!==user.key)throw Error("A conta mudou durante o salvamento");
 await local("readwrite",store=>store.put(rec,key("wallpaper",user)));
 if(online)await local("readwrite",store=>store.delete(key("wallpaper-pending",user)));
 else await local("readwrite",store=>store.put(remove?"remove":"save",key("wallpaper-pending",user)));
 background=rec;profileKey=user.key;updateScreen();
 if(!remove){setWorkingBlob(rec.blob||avatarBlob,false);}else{setWorkingBlob(avatarBlob,false);working=opts(DEFAULT);updatePreview();}
 return online?"Fundo e alinhamento salvos na sua conta.":"Fundo salvo neste aparelho; sincronização pendente até conectar.";
}
async function save(){
 if(saving)return;
 const user=current();if(!user){status("Faça login novamente.");return;}
 saving=true;const button=$("pmEditorSalvar");
 if(button)button.disabled=true;
 status("Salvando alterações...");
 try{
  let msg;
  if(mode==="perfil"){
   if(!workingBlob)throw Error("Escolha uma foto de perfil");
   const cropped=await cropAvatar(workingBlob,working);
   if(current()?.key!==user.key)throw Error("A conta mudou");
   const ok=await window.PMobilePerfilFotos?.salvarEditada?.(cropped);
   if(ok!==true)throw Error("Não foi possível salvar o perfil");
   avatarBlob=cropped;updateScreen();
   setWorkingBlob(cropped,false);working=opts(DEFAULT);updatePreview();
   msg="Foto circular salva. O fundo independente não foi alterado.";
  }else msg=await saveBackground(false);
  status(msg);
 }catch(e){status("Erro: "+String(e.message||e));}
 finally{saving=false;if(button)button.disabled=false;}
}
async function remove(){
 if(saving)return;
 if(mode==="perfil"){
  const ok=await window.PMobilePerfilFotos?.removerFoto?.();
  status(ok===true?"Avatar removido da sua conta.":"Remoção cancelada ou não concluída.");
  return;
 }
 if(!window.confirm("Remover somente a foto de fundo? O avatar será usado no lugar dela."))return;
 saving=true;
 try{status(await saveBackground(true));}catch(e){status("Falha na remoção: "+String(e.message||e));}
 finally{saving=false;}
}
function loadFile(file){
 if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>MAX_FILE){
  status("Use JPG, PNG ou WebP de até 10 MB.");return;
 }
 setWorkingBlob(file,true);
 status("Imagem carregada. Ajuste posição e zoom e toque em Salvar.");
}
function init(){
 $("pmEditorAbaPerfil")?.addEventListener("click",()=>choose("perfil"));
 $("pmEditorAbaFundo")?.addEventListener("click",()=>choose("fundo"));
 $("pmEditorSelecionar")?.addEventListener("click",()=>$("pmEditorArquivo")?.click());
 $("pmEditorArquivo")?.addEventListener("change",event=>{
  const file=event.target.files?.[0];
  if(file)loadFile(file);
  event.target.value="";
 });
 $("pmEditorSalvar")?.addEventListener("click",save);
 $("pmEditorRemover")?.addEventListener("click",remove);
 $("pmEditorRestaurar")?.addEventListener("click",()=>{
  working=opts(DEFAULT);updatePreview();status("Enquadramento centralizado na prévia. Salve para aplicar.");
 });
 for(const [suffix,attr] of [["X","x"],["Y","y"],["Zoom","zoom"],["Degrade","degrade"]]){
  $("pmEditorCampo"+suffix)?.addEventListener("input",e=>{
   working[attr]=Number(e.target.value);updatePreview();
  });
 }
 const frame=$("pmEditorPreview");
 let drag=null;
 frame?.addEventListener("pointerdown",event=>{
  if(!workingBlob)return;
  drag={x:event.clientX,y:event.clientY,h:working.x,v:working.y};
  frame.setPointerCapture?.(event.pointerId);
 });
 frame?.addEventListener("pointermove",event=>{
  if(!drag)return;
  const w=frame.clientWidth||250,h=frame.clientHeight||350;
  working.x=clamp(drag.h-((event.clientX-drag.x)/w)*100,0,100);
  working.y=clamp(drag.v-((event.clientY-drag.y)/h)*100,0,100);
  updatePreview();
 });
 const stop=()=>{drag=null;};
 frame?.addEventListener("pointerup",stop);
 frame?.addEventListener("pointercancel",stop);
 window.addEventListener("pmobile:foto-perfil-pronta",onAvatarReady);
 window.addEventListener("pmobile:sessao-alterada",()=>refresh(true));
 window.addEventListener("pageshow",()=>refresh(true));
 window.addEventListener("online",()=>refresh(true));
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh(true);});
 $("pmPerfilFotoDialog")?.addEventListener("close",()=>{
   revoke(workingURL);workingURL=null;workingBlob=null;newImage=false;
 });
 // A escolha antiga permanece no JS legado para compatibilidade,
 // mas os controles novos são o único editor visível.
 $("pmPerfilFotoDialog")?.addEventListener("click",event=>{
  if(event.target?.id==="pmPerfilFotoDialog")return;
 });
 renderEditor();refresh(true);
}
window.PMobileEditorFotos=Object.freeze({
 atualizar:()=>refresh(true),
 editarFundo:()=>{choose("fundo");window.PMobilePerfilFotos?.abrir?.();},
 editarPerfil:()=>{choose("perfil");window.PMobilePerfilFotos?.abrir?.();}
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();