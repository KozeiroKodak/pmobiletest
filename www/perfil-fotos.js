/* PMobile - fotos individuais: cache offline IndexedDB e sincronizacao privada no Supabase.
 * O backend autoriza por credenciais do autenticador atual, sem bucket publico.
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
    if(!u||!u.usuario)return null;
    // Identidade estável: ID preferencial; login como alternativa para contas legadas.
    const key=u.id===undefined||u.id===null ? "login:"+String(u.usuario).trim().toLocaleLowerCase("pt-BR") : String(u.id);
    return {key,user:String(u.usuario),name:String(u.nome||u.usuario)};
  }
  function initials(name) {
    const words=String(name||"?").trim().split(/\s+/).filter(Boolean);
    return words.length ? ((words[0]||"?").slice(0,1)+(words.length>1?words[words.length-1].slice(0,1):"")).toLocaleUpperCase("pt-BR") : "👤";
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
  // A foto é exibida apenas para a identidade da sessão ativa.
  async function rpcPhoto(name,user,base64) {
    const client=window.clienteSupabase,credential=window.credencialPmobileAtual;
    if(!client || !credential || !navigator.onLine)throw new Error("Servidor indisponível para sincronizar a foto.");
    const args={p_usuario:user.user,p_credencial:credential};
    if(name==="pmobile_foto_perfil_salvar")args.p_imagem_base64=base64;
    const {data,error}=await client.rpc(name,args);
    if(error)throw error;
    return data;
  }
  function fromBase64(str){
    const raw=atob(str);
    if(raw.length<100||raw.length>MAX_JPEG)throw new Error("Foto recebida fora do limite.");
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error("Foto recebida não é JPEG.");
    return new Blob([bytes],{type:"image/jpeg"});
  }
  function toBase64(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
      reader.onerror=()=>reject(reader.error||new Error("Falha ao preparar foto."));
      reader.readAsDataURL(blob);
    });
  }
  async function remoteWrite(user,blob){
    const result=await rpcPhoto("pmobile_foto_perfil_salvar",user,blob?await toBase64(blob):null);
    if(result!==true)throw new Error("Servidor não autorizou a alteração da foto.");
  }
  async function refresh(force=false){
    const next=current(),key=next?.key||null;
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
    let cached=null,pending=null,synced=false;
    try{
      [cached,pending,synced]=await Promise.all([
        database("readonly",os=>os.get(key)),
        database("readonly",os=>os.get("pending:"+key)),
        database("readonly",os=>os.get("synced:"+key))
      ]);
      if(ticket!==revision||current()?.key!==key)return;
      setPhoto(cached);
    }catch(err){if(ticket===revision)status("Foto local indisponível: "+String(err.message||err));}
    if(!navigator.onLine||!window.clienteSupabase||!window.credencialPmobileAtual)return;
    try{
      if(pending==="set"&&cached instanceof Blob){
        await remoteWrite(next,cached);
        await database("readwrite",os=>os.delete("pending:"+key));
        await database("readwrite",os=>os.put(true,"synced:"+key));
      } else if(pending==="remove"){
        await remoteWrite(next,null);
        await database("readwrite",os=>os.delete("pending:"+key));
        await database("readwrite",os=>os.put(true,"synced:"+key));
      }
      const remote=await rpcPhoto("pmobile_foto_perfil_ler",next);
      if(ticket!==revision||current()?.key!==key)return;
      if(typeof remote==="string"&&remote.length){
        const blob=fromBase64(remote);
        await database("readwrite",os=>os.put(blob,key));
        await database("readwrite",os=>os.put(true,"synced:"+key));
        if(ticket===revision&&current()?.key===key)setPhoto(blob);
      }else if(cached instanceof Blob&&!synced&&!pending){
        // Migração de foto antiga apenas local; servidor ainda não tem imagem.
        await remoteWrite(next,cached);
        await database("readwrite",os=>os.put(true,"synced:"+key));
        status("Sua foto local foi sincronizada com o Supabase.");
      }else if(synced||pending==="remove"){
        await database("readwrite",os=>os.delete(key));
        if(ticket===revision&&current()?.key===key)setPhoto(null);
      }
    }catch(err){
      if(ticket===revision)status("Foto disponível localmente. Falha na sincronização: "+String(err.message||err));
    }
  }
  function show(){
    const user=current();
    if(!user){status("Entre com sua conta para editar a foto.");return;}
    identity=user;
    const dialog=$("pmPerfilFotoDialog");
    if(!dialog)return;
    status("A foto pertence à sua conta e sincroniza com o Supabase quando há conexão.");
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
    if(!user)return status("Entre com sua conta para salvar uma foto.");
    busy=true;status("Preparando sua foto...");
    try{
      const blob=await optimize(file);
      if(current()?.key!==user.key)throw new Error("A conta mudou durante a operação.");
      const online=!!(window.clienteSupabase&&window.credencialPmobileAtual&&navigator.onLine);
      if(online)await remoteWrite(user,blob);
      if(current()?.key!==user.key)throw new Error("A conta mudou antes da confirmação.");
      await database("readwrite",os=>os.put(blob,user.key));
      await database("readwrite",os=>os.put(online?true:"set",(online?"synced:":"pending:")+user.key));
      if(online)await database("readwrite",os=>os.delete("pending:"+user.key));
      identity=user;displayedKey=user.key;++revision;setPhoto(blob);
      status(online?"Foto salva no Supabase e disponível em outros dispositivos.":"Foto salva neste aparelho. Sincronização pendente até voltar a conexão.");
      window.dispatchEvent(new CustomEvent("pmobile:foto-perfil-alterada",{detail:{usuario:user.user,remota:online}}));
    }catch(err){status("Não foi possível salvar a foto: "+String(err.message||err));}
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
    if(!user)return status("Entre para remover sua foto.");
    if(!window.confirm("Remover a foto deste perfil em todos os dispositivos?"))return;
    busy=true;status("Removendo foto...");
    try{
      const online=!!(window.clienteSupabase&&window.credencialPmobileAtual&&navigator.onLine);
      if(online)await remoteWrite(user,null);
      if(current()?.key!==user.key)throw new Error("A conta mudou durante a operação.");
      await database("readwrite",os=>os.delete(user.key));
      await database("readwrite",os=>os.put(online?true:"remove",(online?"synced:":"pending:")+user.key));
      if(online)await database("readwrite",os=>os.delete("pending:"+user.key));
      identity=user;displayedKey=user.key;++revision;setPhoto(null);
      status(online?"Foto removida da conta no Supabase.":"Foto removida localmente. Exclusão do servidor pendente até reconectar.");
      window.dispatchEvent(new CustomEvent("pmobile:foto-perfil-alterada",{detail:{usuario:user.user,remota:online}}));
    }catch(err){status("Não foi possível remover a foto: "+String(err.message||err));}
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
    window.addEventListener("pageshow",()=>refresh(true));
    window.addEventListener("online",()=>refresh(true));
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh(true);});
    refresh(true);
  }
  window.PMobilePerfilFotos=Object.freeze({abrir:show,atualizarInterface:()=>refresh(true)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
