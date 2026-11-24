'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('implementacoes/home.css');
const script=read('script.js');
function simularNavegacao(){
 const inicio=script.indexOf('function mostrarTelaSistema(');
 const fim=script.indexOf('// TELA INICIAL',inicio);
 assert.ok(inicio>=0&&fim>inicio);
 const trecho=script.slice(inicio,fim);
 const classes=new Set(),chamadas=[],telas=new Map();
 const getTela=id=>{
  if(!telas.has(id))telas.set(id,{id,style:{display:'none'},classList:{add(){}}});
  return telas.get(id);
 };
 const contexto={
  window:{usuarioPmobileAtual:{nivel:'ADMIN'},dispatchEvent(){},scrollTo(...p){chamadas.push(p)}},
  document:{body:{classList:{
   toggle(c,val){if(val)classes.add(c);else classes.delete(c)},
   remove(c){classes.delete(c)}
  }},getElementById:getTela},
  historicoTelasSistema:[],TELAS_NIVEL2_PMOBILE:new Set(['homeSistema','pesquisa']),
  obterTelaSistemaAtual:()=>null,esconderTelasSistema:()=>{},limparMenuAtivo:()=>{},
  Event:class{constructor(n){this.type=n}}
 };
 vm.createContext(contexto);
 vm.runInContext(trecho,contexto);
 return {ctx:contexto,classes,chamadas,telas};
}
test('Home habilita ajuste e volta ao topo, outras abas restauram fluxo original',()=>{
 const a=simularNavegacao();
 a.ctx.mostrarTelaSistema('homeSistema',null);
 assert.ok(a.classes.has('pmobile-home-ativa'));
 assert.equal(a.chamadas.length,1);
 assert.equal(a.telas.get('homeSistema').style.display,'block');
 a.ctx.mostrarTelaSistema('pesquisa',null);
 assert.ok(!a.classes.has('pmobile-home-ativa'));
 assert.equal(a.chamadas.length,1);
});
test('ajuste da Home não altera o layout das outras telas',()=>{
 assert.match(css,/@media\s*\(max-width:\s*700px\)\s*\{\s*body\.pmobile-home-ativa/);
 assert.match(css,/body\.pmobile-home-ativa\s*\{\s*padding-bottom:\s*0\s*;/);
 assert.match(css,/body\.pmobile-home-ativa #aplicacao,\s*body\.pmobile-home-ativa #conteudoPrincipal\s*\{[^}]*min-height:\s*calc\(100dvh - var\(--status-altura,\s*52px\)\)/s);
 assert.match(css,/body\.pmobile-home-ativa #homeSistema\s*\{[^}]*height:\s*auto/s);
 assert.doesNotMatch(css,/body\.pmobile-home-ativa[^\n]*overflow-y:\s*hidden/);
});
test('desliga a classe na saída da sessão e nas telas iniciais',()=>{
 for(const func of ['function mostrarBoasVindasPmobile()','function abrirLoginPmobile()','function sairPmobile()']){
  const i=script.indexOf(func);
  assert.ok(i>=0,func);
  assert.match(script.slice(i,i+1000),/document\.body\?\.classList\?\.remove\("pmobile-home-ativa"\)/,func);
 }
});
test('versão web e Android usam os mesmos scripts e a mesma folha',()=>{
 for(const p of ['script.js','implementacoes/home.css','index.html']){
  assert.equal(read(p),read('www/'+p),p);
 }
 const html=read('index.html');
 assert.match(html,/implementacoes\/home\.css\?v=0\.0\.437-scroll/);
 assert.match(html,/script\.js\?v=0\.0\.437-home/);
 const links=[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
 assert.match(links.at(-1),/cba-theme\.css/);
});
