const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
test('perfil disponível sem expor novo cartão no menu restrito de nível 2',()=>{
 const html=get('index.html');
 assert.match(html,/id="pmPerfilHome"/);
 assert.match(html,/data-pm-open-profile/);
 assert.match(html,/id="pmPerfilFotoDialog"/);
 assert.match(html,/id="pmPerfilFotoArquivo"[^>]*accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(html,/id="pmPerfilFotoRemover"/);
 assert.ok(html.indexOf('src="perfil-fotos.js')>html.indexOf('src="script.js'));
 const script=get('script.js');
 assert.match(script,/menuConfiguracoes: isAdmin/);
 assert.match(script,/menusPermitidos = new Set/);
});
test('persistência isolada e foto otimizada antes da gravação',()=>{
 const js=get('perfil-fotos.js');
 assert.match(js,/indexedDB\.open\(DB_NAME,1\)/);
 assert.match(js,/key:String\(u\.id\)/);
 assert.match(js,/os\.put\(blob,user\.key\)/);
 assert.match(js,/os\.delete\(user\.key\)/);
 assert.match(js,/canvas\.toBlob/);
 assert.match(js,/MAX_INPUT=6\*1024\*1024/);
 assert.doesNotMatch(js,/service_role|supabase\.storage|localStorage/);
});
test('arquivos de reserva para OTA em paridade com as fontes',()=>{
 for(const p of ['index.html','perfil-fotos.js','perfil-fotos.css']){
   assert.equal(get(p),get('www/'+p),p);
 }
});
