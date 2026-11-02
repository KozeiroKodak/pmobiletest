import {readFile,writeFile,mkdir,readdir,cp,unlink} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]};
const accepted=name=>['index.html','style.css','app.js'].includes(name)||/^src\/[a-zA-Z0-9_/-]+\.(js|css)$/.test(name);
const files=new Map();let version;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
if(option('--source')){
 const source=resolve(option('--source'));version=JSON.parse(await readFile(join(source,'package.json'),'utf8')).version;
 const collect=async path=>{for(const e of await readdir(join(source,path),{withFileTypes:true})){const name=path+'/'+e.name;if(e.isDirectory())await collect(name);else if(accepted(name))files.set(name,await readFile(join(source,name)));}};
 for(const name of ['index.html','style.css','app.js'])files.set(name,await readFile(join(source,name)));
 await collect('src');
 if(args.includes('--native')){
  const base='android/app/src',target='android/app/src';
  for(const name of ['NotificacoesBridge.java','NotificacoesService.java']){
   const bytes=await readFile(join(source,'native',base,'main/java/com/pmentregas/app',name),'utf8');
   await writeFile(join(root,target,'main/java/com/pmobile/app',name),bytes.replaceAll('com.pmentregas','com.pmobile'));
  }
  for(const name of ['NotificacoesInstrumentedTest.java','PushInternetTest.java']){
   const bytes=await readFile(join(source,'native',base,'androidTest/java/com/pmentregas/app',name),'utf8');
   await writeFile(join(root,target,'androidTest/java/com/pmobile/app',name),bytes.replaceAll('com.pmentregas','com.pmobile'));
  }
  await cp(join(source,'native',base,'main/res/drawable/ic_notificacao.xml'),join(root,target,'main/res/drawable/ic_notificacao.xml'));
 }
}else{
 const manifestUrl='https://raw.githubusercontent.com/KozeiroKodak/pmentregas-ota/main/manifest.json';
 const manifestResponse=await fetch(manifestUrl,{signal:AbortSignal.timeout(20000)});if(!manifestResponse.ok)throw Error('Manifesto PMEntregas indisponível');
 const m=await manifestResponse.json();version=m.webVersion;
 if(!/^https:\/\/github\.com\/KozeiroKodak\/pmentregas-ota\/releases\/download\//.test(m.package)||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error('Origem do pacote inválida');
 const response=await fetch(m.package,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Pacote indisponível');
 const zip=Buffer.from(await response.arrayBuffer());if(zip.length>5000000||digest(zip)!==m.sha256)throw Error('Pacote não aprovado pela verificação SHA-256');
 let end=-1;for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('ZIP inválido');
 let offset=zip.readUInt32LE(end+16),total=0;const count=zip.readUInt16LE(end+10);if(count>1000)throw Error('ZIP excessivo');
 for(let i=0;i<count;i++){
  if(zip.readUInt32LE(offset)!==0x02014b50)throw Error('Diretório ZIP inválido');
  const method=zip.readUInt16LE(offset+10),compressed=zip.readUInt32LE(offset+20),size=zip.readUInt32LE(offset+24),nl=zip.readUInt16LE(offset+28),el=zip.readUInt16LE(offset+30),cl=zip.readUInt16LE(offset+32),local=zip.readUInt32LE(offset+42);
  const name=zip.subarray(offset+46,offset+46+nl).toString('utf8');offset+=46+nl+el+cl;
  if(!accepted(name))continue;
  total+=size;if(size>2000000||total>10000000||files.has(name))throw Error('Limites do pacote excedidos');
  if(zip.readUInt32LE(local)!==0x04034b50)throw Error('Entrada ZIP inválida');
  const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),packed=zip.subarray(start,start+compressed);
  const bytes=method===0?packed:method===8?inflateRawSync(packed,{maxOutputLength:2000000}):null;
  if(!bytes||bytes.length!==size)throw Error('Compressão inválida');files.set(name,bytes);
 }
}
for(const name of ['index.html','style.css','app.js','src/integracao.js'])if(!files.has(name))throw Error('PMEntregas ainda não inclui a integração: '+name);
const destination=join(root,'rmexpress');await mkdir(destination,{recursive:true});
let anterior;try{anterior=JSON.parse(await readFile(join(destination,'origem.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(const [name,sha] of Object.entries(anterior?.arquivos||{}))if(accepted(name)&&!files.has(name)){
 const current=await readFile(join(destination,name));if(digest(current)!==sha)throw Error('Arquivo removido foi editado localmente: '+name);await unlink(join(destination,name));
}
const hashes={};for(const [name,bytes] of [...files].sort(([a],[b])=>a.localeCompare(b))){await mkdir(dirname(join(destination,name)),{recursive:true});await writeFile(join(destination,name),bytes);hashes[name]=digest(bytes);}
await writeFile(join(destination,'package.json'),JSON.stringify({private:true,type:'module'})+'\n');
await writeFile(join(destination,'origem.json'),JSON.stringify({repositorio:'KozeiroKodak/pmentregas',versao:version,arquivos:hashes},null,2)+'\n');
console.log('RMEXPRESS sincronizado: '+files.size+' arquivos originais do PMEntregas; versão '+version);
