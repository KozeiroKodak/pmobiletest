const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),read=f=>fs.readFileSync(path.join(root,f),"utf8");
const files=["pesquisa-local","estoque-local","reservas-local","conferencias-local",
 "comparar-verificar","divergencias-local","locais-local","importacao-local"]
 .map(n=>"dados-locais/"+n+".js");
const expected={
 pesquisa:["form","render"],estoque:["selecionar","quantidade","salvarEstoque","template"],
 reservas:["form","render","template"],
 conferencias:["selecionarConferencia","registrarConferencia","listarConferencias","template"],
 comparar:["form","atualizarResumo","template"],divergencias:["render","template"],
 locais:["render","template"],importacao:["importar","template"]
};
function initialize({exclude=null,invalid=null,throwing=null}={}){
 const events={},elements=new Map(),errors=[];
 const base={id:"menuContagemManual",insertAdjacentElement(where,el){elements.set(el.id,el);}};
 elements.set(base.id,base);
 let alerted=null;
 const sandbox={
  window:{alert(msg){alerted=msg;}},
  document:{readyState:"loading",addEventListener(name,fn){events[name]=fn;},
   getElementById(id){return elements.get(id)||null;},
   createElement(tag){return {tagName:tag,addEventListener(name,fn){this[name]=fn;}};}},
  navigator:{onLine:false},console:{error(...x){errors.push(x);},warn(){},log(){}},
  setTimeout,clearTimeout
 };
 const declarations=files.filter(f=>f!==exclude).map(read).join("\n");
 const patch=invalid?
  "window.PMobileDadosLocaisModulos."+invalid+"=()=>({template(){}});":
  throwing?"window.PMobileDadosLocaisModulos."+throwing+"=()=>{throw Error('falha simulada')};":"";
 const hub=read("dados-locais.js").replace(
  "  window.abrirDadosLocaisPmobile=abrir;",
  "  window.__contratosTeste={CONTRATOS,contexto,modulos};\n  window.abrirDadosLocaisPmobile=abrir;"
 );
 vm.runInNewContext(declarations+"\n"+patch+"\n"+hub,sandbox);
 return {window:sandbox.window,events,elements,errors,get alerted(){return alerted;}};
}
test("oito módulos cumprem a API pública e recebem contexto imutável",()=>{
 const {window}=initialize();
 const {CONTRATOS,contexto,modulos}=window.__contratosTeste;
 assert.ok(Object.isFrozen(contexto));assert.ok(Object.isFrozen(modulos));
 assert.deepEqual(Object.keys(CONTRATOS),Object.keys(expected));
 for(const [name,methods] of Object.entries(expected)){
  assert.ok(Object.isFrozen(modulos[name]),name);
  assert.deepEqual(Array.from(CONTRATOS[name]),methods,name);
  for(const method of methods)assert.equal(typeof modulos[name][method],"function",name+"."+method);
 }
 assert.equal(typeof window.abrirDadosLocaisPmobile,"function");
});
test("módulo ausente falha controladamente sem derrubar a Dogo",()=>{
 const app=initialize({exclude:"dados-locais/locais-local.js"});
 assert.equal(app.window.__contratosTeste,undefined);
 assert.equal(typeof app.window.abrirDadosLocaisPmobile,"function");
 assert.doesNotThrow(()=>app.window.abrirDadosLocaisPmobile());
 assert.match(app.alerted,/Dados locais não puderam iniciar/);
 assert.doesNotThrow(()=>app.events.DOMContentLoaded());
 const menu=app.elements.get("menuDadosLocais");
 assert.match(menu.textContent,/indisponíveis/);
 assert.equal(app.window.voltarUmNivelDadosLocais("dadosLocais"),false);
});
test("contrato incorreto e erro de fábrica são controlados",()=>{
 for(const opts of [{invalid:"conferencias"},{throwing:"locais"}]){
  const app=initialize(opts);
  assert.equal(app.window.__contratosTeste,undefined);
  assert.ok(app.errors.length>0);
  assert.doesNotThrow(()=>app.window.abrirDadosLocaisPmobile());
  assert.match(app.alerted,/atualização do PMobile/);
 }
});
test("módulos têm dependências limitadas e não acessam tabelas Dogo",()=>{
 const allowed=["$","estado","escape","valor","num","norm","rpc","sessao","mensagem",
  "consultar","paginacao","resumo","painel","pesquisarForm","compararForm","atualizarResumo","quantidade"];
 for(const file of files){
  const code=read(file),deps=/const \{([^}]+)\}=ctx;/.exec(code);
  assert.ok(deps,"dependências explícitas: "+file);
  const keys=deps[1].split(",").map(s=>s.trim());
  assert.ok(keys.length<=9,"dependências excessivas: "+file);
  assert.ok(keys.every(n=>allowed.includes(n)),"dependência desconhecida: "+file);
  assert.doesNotMatch(code,/\.from\(["']materiais["']\)/,"acesso Dogo proibido: "+file);
 }
});
test("recursos da entrada web existem e são idênticos no Android",()=>{
 const html=read("index.html");assert.equal(html,read("www/index.html"));
 const resources=[
  ...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*\shref="([^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)
 ].map(m=>m[1].split("?")[0]).filter(p=>!/^https?:\/\//.test(p));
 for(const resource of resources){
  assert.ok(fs.existsSync(path.join(root,resource)),"asset ausente: "+resource);
  assert.ok(fs.existsSync(path.join(root,"www",resource)),"asset Android ausente: "+resource);
  assert.equal(read(resource),read("www/"+resource),"asset diverge: "+resource);
 }
 assert.equal(new Set(resources).size,resources.length,"script ou estilo duplicado no index");
});