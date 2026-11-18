/* PMobile - fotos de perfil locais por conta (sem alterar autenticação ou Supabase).
 * Persistência IndexedDB para sobreviver a recarga e atualização OTA web.
 * O armazenamento compartilhado entre dispositivos exige integração backend
 * com autenticação por usuário; esta etapa não expõe bucket público.
 */
(function () {
  "use strict";
  const DB_NAME="pmobile-fotos-perfil-v1", STORE="fotos", MAX_INPUT=6*1024*1024;
  const PHOTO_SIZE=384, MAX_JPEG=320*1024;
  let identity=null, displayedKey=null, imageUrl=null, revision=0, busy=false;
  const $=id=>document.getElementById(id);
  const all=selector=>Array.from(document.querySelectorAll(selector));
  const status=message=>{const node=$("pmPerfilFotoStatus");if(node)node.textContent=message;};
  function current() {
    const u=window.usuarioPmobileAtual;
    if(!u||!u.usuario||u.id===undefined||u.id===null)return null;
    return {key:String(u.id),user:String(u.usuario),name:String(u.nome||u.usuario)};
  }
  function initials(name) {
    const words=String(name||"?").trim().split(/\s+/).filter(Boolean);
    return ((words[0]||"?").slice(0,1)+(words.length>1?words[words.length-1].slice(0,1):"")).toLocaleUpperCase("pt-BR");
  }
  function openDb() {
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error("Armazenamento local indisponível neste aparelho."));
      let req;
      try{req=indexedDB.open(DB_NAME,1);}catch(err){reject(err);return;}
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("Falha ao abrir armazenamento de fotos."));
    });
  }
  async function database(mode,action){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,mode),os=tx.objectStore(STORE);
        let result;
        let request;
        try{request=action(os);}catch(err){reject(err);return;}
        request.onsuccess=()=>{result=request.result;};
        request.onerror=()=>reject(request.error||new Error("Falha ao acessar a foto."));
        tx.oncomplete=()=>resolve(result);
        tx.onerror=()=>reject(tx.error||new Error("Falha ao salvar a foto."));
        tx.onabort=()=>reject(tx.error||new Error("A gravação foi cancelada."));
      });
    }finally{db.close();}
  }
  function setPhoto(blob){
    if(imageUrl){URL.revokeObjectURL(imageUrl);imageUrl=null;}
    if(blob instanceof Blob&&blob.size>0)imageUrl=URL.createObjectURL(blob);
    all("[data-pm-profile-photo]").forEach(img=>{
      if(imageUrl){img.src=imageUrl;img.hidden=false;}
      else {img.removeAttribute("src");img.hidden=true;}
    });
    all("[data-pm-profile-initials]").forEach(node=>{
      node.textContent=initials(identity?.name);
      node.hidden=!!imageUrl;
    });
    const remove=$("pmPerfilFotoRemover");
    if(remove)remove.disabled=!imageUrl||busy;
  }
  async function refresh(force=false){
    const next=current();
    const key=next?.key||null;
    identity=next;
    const home=$("pmPerfilHome");
    if(home)home.hidden=!next;
    const label=$("pmPerfilNome");
    if(label)label.textContent=next?next.name:"Nenhum usuário autenticado";
    const handle=$("pmPerfilUsuario");
    if(handle)handle.textContent=next?"@"+next.user:"";
    if(!force&&key===displayedKey)return;
    displayedKey=key;
    const ticket=++revision;
    setPhoto(null);
    if(!key)return;
    try{
      const blob=await database("readonly",os=>os.get(key));
      if(ticket===revision&&current()?.key===key)setPhoto(blob);
    }catch(err){
      if(ticket===revision)status("Não foi possível carregar a foto: "+String(err.message||err));
    }
  }
  function show(){
    const user=current();
    if(!user){status("Entre com sua conta para editar a foto.");return;}
    identity=user;
    const dialog=$("pmPerfilFotoDialog");
    if(!dialog)return;
    status("A imagem é salva somente neste aparelho, para esta conta.");
    if(typeof dialog.showModal==="function"){if(!dialog.open)dialog.showModal();}
    else dialog.setAttribute("open","");
    refresh(false);
  }
  function close(){
    const dialog=$("pmPerfilFotoDialog");
    if(!dialog)return;
    if(typeof dialog.close==="function"&&dialog.open)dialog.close();
    else dialog.removeAttribute("open");
    const picker=$("pmPerfilFotoArquivo");
    if(picker)picker.value="";
  }
  function imageLoad(blob){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Imagem inválida ou incompatível."));};
      img.src=url;
    });
  }
  async function optimize(file){
    if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type))
      throw new Error("Use uma foto JPG, PNG ou WebP.");
    if(file.size>MAX_INPUT)throw new Error("A foto original deve ter no máximo 6 MB.");
    const img=await imageLoad(file);
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>16000||img.naturalHeight>16000)
      throw new Error("Dimensões de imagem inválidas.");
    const canvas=document.createElement("canvas");
    canvas.width=PHOTO_SIZE;canvas.height=PHOTO_SIZE;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("O Android não permitiu processar a foto.");
    const side=Math.min(img.naturalWidth,img.naturalHeight);
    ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,PHOTO_SIZE,PHOTO_SIZE);
    const toBlob=quality=>new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(new Error("Não foi possível converter a foto.")),"image/jpeg",quality));
    let output=await toBlob(.82);
    if(output.size>MAX_JPEG)output=await toBlob(.62);
    if(output.size>MAX_JPEG)throw new Error("A imagem excede o tamanho permitido após otimização.");
    return output;
  }
  async function save(file){
    if(busy)return;
    const user=current();
    if(!user)return status("Faça login para salvar uma foto.");
    busy=true;status("Preparando sua foto...");
    try{
      const blob=await optimize(file);
      if(current()?.key!==user.key)throw new Error("A conta mudou durante o envio.");
      await database("readwrite",os=>os.put(blob,user.key));
      if(current()?.key!==user.key)throw new Error("A conta mudou antes da confirmação.");
      identity=user;displayedKey=user.key;++revision;setPhoto(blob);
      status("Foto salva neste aparelho. Nenhuma informação de acesso foi alterada.");
      window.dispatchEvent(new CustomEvent("pmobile:foto-perfil-alterada",{detail:{usuario:user.user,local:true}}));
    }catch(err){status("Não foi possível salvar: "+String(err.message||err));}
    finally{busy=false;setPhotoUrlButtons();}
  }
  function setPhotoUrlButtons(){
    const remove=$("pmPerfilFotoRemover");
    if(remove)remove.disabled=!imageUrl||busy;
    const choose=$("pmPerfilFotoEscolher");
    if(choose)choose.disabled=busy;
  }
  async function remove(){
    if(busy)return;
    const user=current();
    if(!user)return status("Faça login para remover sua foto.");
    if(!window.confirm("Remover a foto deste perfil neste aparelho?"))return;
    busy=true;status("Removendo foto...");
    try{
      await database("readwrite",os=>os.delete(user.key));
      if(current()?.key===user.key){identity=user;displayedKey=user.key;++revision;setPhoto(null);}
      status("Foto removida deste aparelho.");
      window.dispatchEvent(new CustomEvent("pmobile:foto-perfil-alterada",{detail:{usuario:user.user,local:true}}));
    }catch(err){status("Não foi possível remover: "+String(err.message||err));}
    finally{busy=false;setPhotoUrlButtons();}
  }
  function init(){
    const picker=$("pmPerfilFotoArquivo");
    if(picker)picker.addEventListener("change",async event=>{
      const file=event.target.files?.[0];
      if(file)await save(file);
      picker.value="";
    });
    $("pmPerfilFotoEscolher")?.addEventListener("click",()=>picker?.click());
    $("pmPerfilFotoRemover")?.addEventListener("click",remove);
    $("pmPerfilFotoFechar")?.addEventListener("click",close);
    $("pmPerfilFotoDialog")?.addEventListener("click",event=>{
      if(event.target.id==="pmPerfilFotoDialog")close();
    });
    document.addEventListener("click",event=>{
      const trigger=event.target.closest("[data-pm-open-profile]");
      if(trigger){event.preventDefault();show();}
    });
    window.addEventListener("pmobile:sessao-alterada",()=>refresh());
    window.addEventListener("pageshow",()=>refresh());
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
    refresh(true);
  }
  window.PMobilePerfilFotos=Object.freeze({abrir:show,atualizarInterface:()=>refresh(true)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
