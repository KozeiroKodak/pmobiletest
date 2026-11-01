const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
function ponte(){
  const errors=[];
  const sandbox={window:{},console:{error(...x){errors.push(x)}}};
  vm.runInNewContext(read("pmobile-modulos.js"),sandbox);
  return {api:sandbox.window.PMobileModulos,window:sandbox.window,errors};
}
test("registro único de retorno: contratos imutáveis e ordem estável",()=>{
  const {api,window}=ponte();
  assert.ok(Object.isFrozen(api));
  assert.equal(Object.getOwnPropertyDescriptor(window,"PMobileModulos").writable,false);
  const chamadas=[];
  api.registrarRetorno("configuracoes",t=>{chamadas.push("config:"+t);return false;});
  api.registrarRetorno("transportes",t=>{chamadas.push("trans:"+t);return t==="transportes";});
  api.registrarRetorno("dados-locais",t=>{chamadas.push("dados:"+t);return t==="dadosLocais";});
  assert.equal(api.consumirRetorno("transportes"),"transportes");
  assert.deepEqual(chamadas,["config:transportes","trans:transportes"]);
  assert.equal(api.consumirRetorno("dadosLocais"),"dados-locais");
  assert.equal(api.consumirRetorno("homeSistema"),null);
  assert.throws(()=>api.registrarRetorno("transportes",()=>true),/registrado duas vezes/);
});
test("falhas de módulos não impedem o próximo handler de Voltar",()=>{
  const {api,errors}=ponte();
  api.registrarRetorno("falha",()=>{throw Error("indisponível");});
  api.registrarRetorno("valido",()=>true);
  assert.equal(api.consumirRetorno("configuracoes"),"valido");
  assert.equal(errors.length,1);
});
test("ações não aceitam strings arbitrárias nem acesso dinâmico a window",()=>{
  const {api}=ponte(),calls=[];
  api.registrarAcao("rastreio",()=>calls.push("rastreio"));
  assert.equal(api.executarAcao("rastreio"),true);
  assert.deepEqual(calls,["rastreio"]);
  assert.equal(api.executarAcao("desconhecida"),false);
  assert.equal(api.executarAcao("__proto__"),false);
  assert.throws(()=>api.registrarAcao("../segredo",()=>{}),/inválido/);
  assert.throws(()=>api.registrarAcao("rastreio",()=>{}),/registrado duas vezes/);
  assert.throws(()=>api.registrarAcao("cotacoes",null),/inválido/);
});
test("núcleo delega o retorno ao contrato e preserva histórico administrativo",()=>{
  const script=read("script.js");
  const start=script.indexOf("function voltarTelaAnteriorPmobile()");
  const end=script.indexOf("const itensMenuSistema =",start);
  assert.ok(start>0&&end>start);
  const fn=script.slice(start,end);
  function navegar(tela,historico,consumir){
    const destinos=[];
    const sandbox={window:{PMobileModulos:{consumirRetorno:consumir}},
      obterTelaSistemaAtual(){return tela;},
      historicoTelasSistema:historico,
      mostrarTelaSistema(id,menu,restaurar){destinos.push({id,restaurar});}};
    vm.runInNewContext(fn,sandbox);
    return {feito:sandbox.voltarTelaAnteriorPmobile(),destinos,historico};
  }
  const config=navegar("locais",["configuracoes"],()=> "configuracoes");
  assert.equal(config.feito,true);
  assert.equal(config.historico.length,0,"histórico de Configurações consumido");
  const local=navegar("dadosLocais",["pesquisa"],()=> "dados-locais");
  assert.equal(local.feito,true);
  assert.equal(local.historico.length,1);
  const standard=navegar("pesquisa",["homeSistema"],()=>null);
  assert.equal(standard.feito,true);
  assert.equal(standard.destinos[0].id,"homeSistema");
  assert.equal(standard.destinos[0].restaurar,true);
  assert.equal(navegar("homeSistema",[],()=>null).feito,false);
});
test("módulos legados publicam suas ações e preservam APIs históricas",()=>{
  const {api,window}=ponte();
  const doc={readyState:"loading",addEventListener(){},getElementById(){return null}};
  const sandbox={window,document:doc,console,
    mostrarTelaSistema(){},alert(){},getComputedStyle(){return {display:"none"};}};
  window.addEventListener=()=>{};
  window.usuarioPmobileAtual={nivel:"ADMIN"};
  vm.runInNewContext(read("valorestotal.js"),sandbox);
  vm.runInNewContext(read("rastreio.js"),sandbox);
  vm.runInNewContext(read("cotacoes.js"),sandbox);
  assert.equal(typeof sandbox.abrirValoresTotal,"function");
  assert.equal(typeof sandbox.abrirRastreio,"function");
  assert.equal(typeof window.abrirOpcoesCotacoes,"function");
  for(const id of ["valores-total","rastreio","cotacoes"])
    assert.throws(()=>api.registrarAcao(id,()=>{}),/registrado duas vezes/,id);
  const script=read("script.js");
  assert.match(script,/registrarAcao\("conferencias",abrirConferencias\)/);
  assert.match(script,/registrarAcao\("importar-estoque",abrirImportacao\)/);
  const reorg=read("reorganizacao-pmobile.js");
  assert.match(reorg,/PMobileModulos\?\.executarAcao/);
  assert.doesNotMatch(reorg,/window\[nome\]/);
  assert.match(reorg,/registrarRetorno\("transportes",voltar\)/);
});
test("ponte é carregada antes dos módulos antigos e espelhada no Android",()=>{
  const html=read("index.html"),mirror=read("www/index.html");
  assert.equal(html,mirror);
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1].split("?")[0]);
  const bridge=scripts.indexOf("pmobile-modulos.js");
  assert.ok(bridge>=0);
  for(const mod of ["valorestotal.js","rastreio.js","script.js","cotacoes.js","dados-locais.js","reorganizacao-pmobile.js"])
    assert.ok(scripts.indexOf(mod)>bridge,mod);
  for(const p of ["pmobile-modulos.js","script.js","valorestotal.js","rastreio.js","cotacoes.js","reorganizacao-pmobile.js","dados-locais.js"])
    assert.equal(read(p),read("www/"+p),p);
});
