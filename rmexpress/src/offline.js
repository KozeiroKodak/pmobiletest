// Cache somente LEITURA, particionado por usuário e criptografado com a senha
// do PMobile (senha não é persistida). Nunca enfileirar confirmações reais.
const NOME="pmentregas_cache_v1";
function abrir(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined")return reject(Error("IndexedDB indisponível"));
  const req=indexedDB.open(NOME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("cache"))req.result.createObjectStore("cache")};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
async function operacao(chave,tipo,valor){
 const db=await abrir();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction("cache",tipo==="get"?"readonly":"readwrite");
   const req=tipo==="get"?tx.objectStore("cache").get(chave):
    tipo==="put"?tx.objectStore("cache").put(valor,chave):tx.objectStore("cache").delete(chave);
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error);
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close()}
}
async function derivar(sessao,salt){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(sessao.credencial),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:170000,hash:"SHA-256"},key,
 {name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
const chave=s=>"motorista:"+String(s.usuario).toLowerCase();
export async function salvarCacheMotorista(sessao,entregas,destinos=[]){
 if(!crypto?.subtle||!Array.isArray(entregas))return false;
 try{
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await derivar(sessao,salt);
  const payload={salvoEm:new Date().toISOString(),registros:entregas,destinos};
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  const cifra=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,bytes);
  await operacao(chave(sessao),"put",{salt:[...salt],iv:[...iv],cifra:[...new Uint8Array(cifra)]});
  return true;
 }catch{return false;}
}
export async function lerCacheMotorista(sessao){
 if(!crypto?.subtle)return null;
 try{
  const dado=await operacao(chave(sessao),"get");
  if(!dado)return null;
  const key=await derivar(sessao,new Uint8Array(dado.salt));
  const texto=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(dado.iv)},key,new Uint8Array(dado.cifra));
  const result=JSON.parse(new TextDecoder().decode(texto));
  return Array.isArray(result.registros)?result:null;
 }catch{return null;}
}
export async function apagarCacheMotorista(sessao){
 try{await operacao(chave(sessao),"delete");return true;}catch{return false;}
}
