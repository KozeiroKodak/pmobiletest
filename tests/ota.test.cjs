const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const full=fs.readFileSync(path.join(root,'script.js'),'utf8');
const start=full.indexOf('(function configurarAtualizacoes() {');
const source=full.slice(start,full.indexOf('\n})();',start)+7);
function setup(bridge){
 const nodes=new Map(),steps=Array.from({length:4},()=>({dataset:{}})),frames=[],events={},calls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},hidden:false,textContent:'',removeAttribute(k){delete this[k]},getClientRects(){return []}});return nodes.get(id)};
 const window={PMOBILE_OTA:bridge,PMOBILE_OK:true,mostrarTelaSistema(){},abrirDadosLocaisPmobile(){},mostrarInicioConfiguracoes(){},abrirValoresTotal(){}};
 const sandbox={window,document:{readyState:'loading',getElementById:node,querySelectorAll:()=>steps,addEventListener(k,cb){events[k]=cb}},requestAnimationFrame(cb){frames.push(cb)},setInterval(){},console};
 vm.runInNewContext(source,sandbox);return {api:window.PMobileAtualizacoes,node,steps,events,frames,window};
}
test('download e aplicação são ações distintas; progresso não reinicia o aplicativo',()=>{
 const calls=[];let state={state:'available',currentVersion:'0.0.399',availableVersion:'0.0.400'};
 const h=setup({obterEstado:()=>JSON.stringify(state),baixarAtualizacao(){calls.push('download')},aplicarAtualizacao(){calls.push('apply')}});
 h.api.atualizar();assert.equal(h.node('otaBaixar').hidden,false);assert.equal(h.node('otaAplicar').hidden,true);
 h.api.executar('baixarAtualizacao');assert.deepEqual(calls,['download']);
 state={...state,state:'downloading',percent:42,downloadedBytes:1048576,totalBytes:2097152};h.api.atualizar();
 assert.equal(h.node('otaBarra').value,42);assert.equal(h.node('otaVerificar').disabled,true);assert.equal(h.node('otaAplicar').hidden,true);
 state={...state,state:'ready',percent:100};h.api.atualizar();assert.equal(h.node('otaAplicar').hidden,false);assert.deepEqual(calls,['download']);
 h.api.executar('aplicarAtualizacao');assert.deepEqual(calls,['download','apply']);
});
test('fases sem percentual são indeterminadas e as notas são texto seguro',()=>{
 const h=setup();h.api.renderizar({state:'verifying',percent:-1,releaseNotes:'<img src=x onerror=alert(1)>'});
 assert.equal(h.node('otaBarra').value,undefined);assert.equal(h.node('otaPorcentagem').textContent,'');
 assert.equal(h.node('otaNotas').textContent,'<img src=x onerror=alert(1)>');assert.equal(h.node('otaNovidades').hidden,false);
 h.api.renderizar({state:'error'});assert.equal(h.node('otaVerificar').disabled,false);assert.equal(h.node('otaVerificar').textContent,'Tentar novamente');
});
test('APKs anteriores mantêm verificação e navegador apresenta informação adequada',()=>{
 let count=0;const legacy=setup({procurarAtualizacoes(){count++}});legacy.api.atualizar();assert.equal(legacy.node('otaPainel').dataset.estado,'legacy');legacy.api.executar('procurarAtualizacoes');assert.equal(count,1);
 const web=setup();web.api.atualizar();assert.equal(web.node('otaPainel').dataset.estado,'unsupported');assert.equal(web.node('otaVerificar').disabled,true);
});
test('confirmação de abertura aguarda a pintura e os módulos essenciais',()=>{
 let count=0;const h=setup({obterEstado:()=>JSON.stringify({state:'idle',currentVersion:'0.0.400'}),confirmarInicializacao(v){assert.equal(v,'0.0.400');count++}});
 h.events.DOMContentLoaded();assert.equal(count,0);h.frames.shift()();assert.equal(count,0);h.frames.shift()();assert.equal(count,1);
 const missing=setup({obterEstado:()=>JSON.stringify({currentVersion:'0.0.400'}),confirmarInicializacao(){count++}});delete missing.window.abrirDadosLocaisPmobile;missing.events.DOMContentLoaded();missing.frames.shift()();missing.frames.shift()();assert.equal(count,1);
});
test('ponte Android disponível após a pintura ainda recebe a confirmação uma única vez',()=>{
 let count=0;const h=setup();h.events.DOMContentLoaded();h.frames.shift()();h.frames.shift()();
 h.window.PMOBILE_OTA={obterEstado:()=>JSON.stringify({currentVersion:'0.0.400'}),confirmarInicializacao(){count++}};
 h.api.atualizar();h.api.atualizar();assert.equal(count,1);
});
