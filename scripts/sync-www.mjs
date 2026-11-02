import {readdir,mkdir,cp} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function copy(directory=''){
 for(const entry of await readdir(join(root,directory),{withFileTypes:true})){
  const path=directory?directory+'/'+entry.name:entry.name;
  if(entry.isDirectory()){
   if(directory||['implementacoes','dados-locais','rmexpress'].includes(path))await copy(path);
  }else if(/\.(html|css|js)$/.test(path)){
   await mkdir(dirname(join(root,'www',path)),{recursive:true});await cp(join(root,path),join(root,'www',path));
  }
 }
}
await copy();console.log('Fallback PMobile sincronizado com as fontes principais.');
