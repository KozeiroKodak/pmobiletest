const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
test('RMEXPRESS conserva os arquivos originais e o mesmo pacote no APK',()=>{
 const origem=JSON.parse(fs.readFileSync(path.join(root,'rmexpress/origem.json'),'utf8'));
 assert.equal(origem.repositorio,'KozeiroKodak/pmentregas');
 for(const [file,sha] of Object.entries(origem.arquivos)){
  const bytes=fs.readFileSync(path.join(root,'rmexpress',file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha,file);
  assert.deepEqual(bytes,fs.readFileSync(path.join(root,'www/rmexpress',file)),file);
 }
});
function ambiente(nivel='ADMIN'){
 const nodes=new Map(),events={},retornos={};let tela='homeSistema';
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',classList:{toggle(){}},addEventListener(n,fn){this[n]=fn},append(f){this.frame=f;nodes.set(f.id,f)}});return nodes.get(id)};
 const window={usuarioPmobileAtual:{id:42,usuario:'fixture',nivel},credencialPmobileAtual:'ficticia',PMobileModulos:{registrarRetorno(n,fn){retornos[n]=fn}},obterTelaSistemaAtual:()=>tela,mostrarTelaSistema(id){tela=id},addEventListener(n,fn){events[n]=fn}};
 const sandbox={window,navigator:{onLine:true},document:{body:{classList:{toggle(){}}},getElementById:node,createElement(){return {hidden:true,contentWindow:{},addEventListener(){}}}},queueMicrotask,console};
 vm.runInNewContext(fs.readFileSync(path.join(root,'rmexpress.js'),'utf8'),sandbox);
 return {window,node,retornos,events};
}
test('perfis autorizados usam a aba; NIVEL2 não cria o aplicativo integrado',()=>{
 for(const nivel of ['ADMIN','RMADMIN','RMMOTORISTAS']){const h=ambiente(nivel);assert.equal(h.node('menuRMExpress').hidden,false);h.window.PMobileRMExpress.abrir();assert.equal(h.window.obterTelaSistemaAtual(),'rmexpress');}
 const h=ambiente('NIVEL2');h.window.PMobileRMExpress.abrir();assert.equal(h.node('menuRMExpress').hidden,true);assert.equal(h.window.obterTelaSistemaAtual(),'homeSistema');assert.equal(h.node('rmexpressConteudo').frame,undefined);
});
test('frame externo não recebe sessão e saída bloqueia autenticação atrasada',async()=>{
 const h=ambiente();h.window.PMobileRMExpress.abrir();const frame=h.node('rmexpressConteudo').frame;let liberar,chamadas=0;
 const api={entrar(){chamadas++;return new Promise(r=>{liberar=r})},sair(){},ativar(){},voltar(){return false}};
 h.window.PMobileRMExpress.conectarFrame({PMEntregasIntegracao:api});assert.equal(chamadas,0);
 frame.contentWindow.PMEntregasIntegracao=api;h.window.PMobileRMExpress.conectarFrame(frame.contentWindow);assert.equal(chamadas,1);
 h.window.usuarioPmobileAtual=null;h.window.credencialPmobileAtual=null;h.events['pmobile:sessao-alterada']();liberar({nivel:'ADMIN'});await new Promise(r=>setImmediate(r));
 assert.equal(frame.hidden,true);assert.equal(h.node('menuRMExpress').hidden,true);assert.equal(h.window.obterTelaSistemaAtual(),'homeSistema');
});
