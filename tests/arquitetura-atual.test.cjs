const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const entregas=fs.existsSync(path.join(root,'src/acesso.js')),mobile=fs.existsSync(path.join(root,'dados-locais.js'));
test('fila antiga conserva IDs e só remove registros depois de confirmação do envio',async()=>{
 const vm=require('node:vm'),sandbox={window:{addEventListener(){}},document:{addEventListener(){}},navigator:{onLine:true},console:{log(){},warn(){},error(){}},setInterval(){return 1}};
 vm.runInNewContext(read('conferencia.js'),sandbox);
 const item={id:7,conferencia:{conferenciaId:'fixture-id-estavel',codigo:'FICTICIO'}};let fila=[item],enviadas=[],removidas=[],falhar=true;
 sandbox.obterConferenciasPendentes=async()=>fila;
 sandbox.mostrarStatusSincronizacaoConferencias=()=>{};
 sandbox.salvarConferenciaSupabase=async registro=>{enviadas.push(registro.conferenciaId);if(falhar)throw Error('falha simulada')};
 sandbox.removerConferenciaPendente=async id=>{removidas.push(id);fila=fila.filter(x=>x.id!==id)};
 await sandbox.sincronizarConferenciasPendentes();assert.equal(fila.length,1);assert.deepEqual(removidas,[]);
 falhar=false;await sandbox.sincronizarConferenciasPendentes();assert.equal(fila.length,0);assert.deepEqual(removidas,[7]);assert.deepEqual(enviadas,['fixture-id-estavel','fixture-id-estavel']);
 sandbox.navigator.onLine=false;fila=[item];await sandbox.sincronizarConferenciasPendentes();assert.equal(fila.length,1);assert.equal(enviadas.length,2);
});
test('entrada atual resolve recursos e não conserva estrutura lateral removida',()=>{
 const html=read('index.html');assert.doesNotMatch(html,/<aside\b[^>]*id="sistema"/);
 for(const [,url]of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^https?:|^\/\//.test(url))assert.ok(fs.existsSync(path.resolve(root,url.split(/[?#]/)[0])),url);
 for(const file of ['style.css',...(!entregas?['implementacoes/home.css']:[])])assert.doesNotMatch(read(file),/\.sidebar-[\w-]+|--sidebar-(?:largura|mobile)|#sistema\b/);
 if(!entregas){const htmlMirror=read('www/index.html');assert.equal(html,htmlMirror);assert.match(read('script.js'),/function voltarTelaAnteriorPmobile/);}
});
test('recursos obsoletos ficam fora da distribuição e acessos atuais permanecem',()=>{
 if(entregas){assert.doesNotMatch(read('style.css'),/\.auth-(?:panel|heading|form|feedback)\b|\.login-manter-login\b|#criarSenhaPmobile\b/);return;}
 const obsolete=mobile?['bancoimportacao.js']:['pesquisa.js','locais.js','popupescolha.js','implementacoes/pesquisa.css','implementacoes/locais.css','implementacoes/popupescolha.css'];
 for(const p of obsolete)for(const prefix of ['','www/'])assert.equal(fs.existsSync(path.join(root,prefix+p)),false,prefix+p);
 const html=read('index.html');
 if(mobile){assert.match(html,/id="menuTransportes"/);for(const id of ['menuValoresTotal','menuImportacao','menuRastreio','menuConferencias','menuOpcoesCotacoes'])assert.ok(!html.includes('id="'+id+'"'),id);const fila=read('conferencia.js');assert.match(fila,/function obterConferenciasPendentes/);assert.match(fila,/function sincronizarConferenciasPendentes/);}
 else{assert.match(html,/id="contagemManual"/);assert.doesNotMatch(read('script.js'),/function (?:abrirPesquisa|confirmarZeramento|abrirGerenciamentoUsuarios)\b/);}
});
