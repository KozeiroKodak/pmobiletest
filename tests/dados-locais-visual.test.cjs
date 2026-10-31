const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const raiz=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(raiz,"dados-locais.js"),"utf8");
function compilar(){
  const code=source.replace("  window.abrirDadosLocaisPmobile=abrir;",
    "  window.__visualTeste={htmlPrincipal,desenharMateriais,desenharComparacao,icone,atualizarResumo};\n"+
    "  window.abrirDadosLocaisPmobile=abrir;");
  assert.notEqual(code,source);
  const els=new Map();
  function mk(tag){
    return {tagName:tag,className:"",textContent:"",innerHTML:"",dataset:{},children:[],
      append(...x){this.children.push(...x)},
      appendChild(x){this.children.push(x);return x},
      replaceChildren(){this.children=[];this.innerHTML=""},
      setAttribute(){},classList:{toggle(){},add(){}}
    };
  }
  const document={readyState:"loading",addEventListener(){},
    getElementById(id){return els.get(id)||null;},
    createElement:mk};
  const sandbox={window:{},document,navigator:{onLine:false},console,setTimeout};
  vm.runInNewContext(code,sandbox);
  const elemento=id=>{const v=mk("div");els.set(id,v);return v};
  return {api:sandbox.window.__visualTeste,elemento};
}
test("o hub reaproveita exatamente as classes nativas de Configurações",()=>{
  const {api}=compilar(),html=api.htmlPrincipal();
  assert.equal((html.match(/class="configuracoes-v3-card"/g)||[]).length,8);
  assert.equal((html.match(/class="configuracoes-v3-icone"/g)||[]).length,8);
  assert.ok(html.includes('class="configuracoes-v3-grade"'));
  assert.ok(html.includes('class="cabecalho-pagina"'));
  for(const aba of ["pesquisa","estoque","reservas","conferencias","comparar","divergencias","locais","importar"])
    assert.ok(html.includes('data-dl-panel="'+aba+'"'),aba);
});
test("Pesquisa local e estoque utilizam campos, seletores e botões originais",()=>{
  const {api}=compilar(),h=api.htmlPrincipal();
  assert.ok(h.includes('class="painel pesquisa-v2"'));
  assert.ok(h.includes('class="pesquisa-v2-campo"'));
  assert.ok(h.includes('class="pesquisa-v2-tipos"'));
  assert.ok(h.includes('class="pesquisa-v2-buscar"'));
  assert.ok(h.includes('class="painel contagem-v2 dl-contagem-principal"'));
  assert.ok(h.includes('class="botao-aba contagem-v2-salvar"'));
  assert.ok(h.includes('data-dl-tipo="codigo"'));
  assert.ok(h.includes('data-dl-tipo="referencia"'));
  assert.ok(h.includes('data-dl-tipo="descricao"'));
});
test("resultados da Pesquisa local renderizam exatamente a hierarquia da Pesquisa original",()=>{
  const {api,elemento}=compilar();const el=elemento("dlResultados-pesquisa");
  api.desenharMateriais("pesquisa",[{
    codigo:"001",descricao:"Parafuso",referencia:"ABC",marca:"Teste",local:null,
    quantidade_total:null,quantidade_item:null,quantidade_reservada:null
  }]);
  assert.equal(el.children[1].className,"pesquisa-v2-card");
  assert.equal(el.children[1].children[0].tagName,"summary");
  assert.equal(el.children[1].children[1].className,"pesquisa-v2-detalhes");
  assert.equal(el.children[1].children[2].className,"dl-local-acoes");
});
test("Locais locais reaproveita mesmo cartão, local anterior e novo local",()=>{
  const {api,elemento}=compilar();
  const el=elemento("dlResultados-locais");elemento("dlResumo-locais");
  api.desenharComparacao("locais",[{
    codigo:"200",descricao:"Material",dogo_local:"A-01",local_local:"B-02",
    dogo_quantidade:10,local_quantidade:null,dogo_reservada:0,local_reservada:null,
    diferenca_quantidade:false,diferenca_reserva:false,diferenca_local:true,
    sem_dogo:false,pendente_quantidade:true,pendente_reserva:true,pendente_local:false
  }]);
  assert.ok(el.innerHTML.includes('class="local-alterado-card locais-v3-cartao"'));
  assert.ok(el.innerHTML.includes('class="locais-v3-resumo-cartao"'));
  assert.ok(el.innerHTML.includes('class="locais-v3-trajeto"'));
  assert.ok(el.innerHTML.includes("Local anterior"));
  assert.ok(el.innerHTML.includes("Novo local"));
  assert.ok(el.innerHTML.includes("A-01"));
  assert.ok(el.innerHTML.includes("B-02"));
  assert.ok(!el.innerHTML.includes("Confirmar alteração no ERP"));
});
test("Conferências locais reproduz estrutura de Contagem manual, não formulário isolado",()=>{
  const {api}=compilar(),h=api.htmlPrincipal();
  assert.ok(h.includes('data-dl-busca="conferencias"'));
  assert.ok(h.includes('class="painel contagem-v2 dl-contagem-principal"'));
  assert.ok(h.includes('class="contagem-v2-topo"'));
  assert.ok(h.includes('class="contagem-v2-tipos"'));
  assert.ok(h.includes('class="botao-aba botao-buscar-contagem-manual"'));
  assert.ok(h.includes('id="dlFormConferencia" class="painel contagem-v2 contagem-v2-registro" hidden'));
  assert.ok(h.includes('class="contagem-v2-lista-titulo"'));
  assert.ok(h.includes('id="dlHistorico"'));
  assert.ok(source.includes('card.className="registro-contagem-manual"'));
  assert.ok(!source.includes('ERP - OK')); // status ERP pertence ao módulo original
});
test("CSS está escopado, usa regras copiadas do nativo e espelha Android",()=>{
  const css=fs.readFileSync(path.join(raiz,"implementacoes/dados-locais.css"),"utf8");
  for(const token of ["#dadosLocais .pesquisa-v2","#dadosLocais .contagem-v2",
    "#dadosLocais .locais-v3-cartao","#dadosLocais .configuracoes-v3-card",
    "#dlHistorico details.registro-conferencia"])assert.ok(css.includes(token),token);
  for(const p of ["index.html","dados-locais.js","reorganizacao-pmobile.js","implementacoes/dados-locais.css"])
    assert.equal(fs.readFileSync(path.join(raiz,p),"utf8"),
                 fs.readFileSync(path.join(raiz,"www",p),"utf8"),p);
});


test("folhas de estilo da Pesquisa, Locais e Contagem são cópias das originais sob escopo local",()=>{
  const css=fs.readFileSync(path.join(raiz,"implementacoes/dados-locais.css"),"utf8");
  const search=fs.readFileSync(path.join(raiz,"implementacoes/pesquisa.css"),"utf8");
  const count=fs.readFileSync(path.join(raiz,"implementacoes/contagemmanual.css"),"utf8");
  const places=fs.readFileSync(path.join(raiz,"implementacoes/locais-v3.css"),"utf8");
  const expectedSearch=search.slice(search.indexOf("/* PMobile Pesquisa 2.0")).replaceAll("#pesquisa","#dadosLocais");
  const expectedCount=count.slice(count.indexOf("/* Contagem manual 2.0")).replaceAll("#contagemManual","#dadosLocais");
  const expectedPlaces=places.replaceAll("#locais","#dadosLocais");
  assert.ok(css.includes(expectedSearch),"CSS real da Pesquisa não foi reutilizado");
  assert.ok(css.includes(expectedCount),"CSS real da Contagem não foi reutilizado");
  assert.ok(css.includes(expectedPlaces),"CSS real dos Locais não foi reutilizado");
});


test("Reservas locais usa a grade original em vez da tela Pesquisa",()=>{
  const {api,elemento}=compilar(),html=api.htmlPrincipal();
  assert.ok(html.includes('class="painel painel-reservas"'));
  assert.ok(html.includes('id="dlResultados-reservas"'));
  const el=elemento("dlResultados-reservas");
  api.desenharMateriais("reservas",[{codigo:"101",descricao:"Parafuso",referencia:"R1",
    marca:"M",quantidade_reservada:5}]);
  assert.ok(el.innerHTML.includes('class="reservas-cabecalho"'));
  assert.ok(el.innerHTML.includes('class="reserva-item"'));
  assert.ok(el.innerHTML.includes('class="reserva-celula reserva-quantidade"'));
  assert.ok(!el.innerHTML.includes('class="pesquisa-v2-card"'));
});
test("Importação local utiliza botão e input nativos sem zerar o catálogo",()=>{
  const {api}=compilar(),html=api.htmlPrincipal();
  assert.ok(html.includes('class="arquivo-importacao"'));
  assert.ok(html.includes('class="acoes-importacao"'));
  assert.ok(html.includes('class="botao-aba botao-importar-materiais"'));
  assert.ok(!html.includes("Zerar inventário"));
});
test("CSS inclui tema Ciano Industrial efetivo e não adiciona espaçamento duplo",()=>{
  const css=fs.readFileSync(path.join(raiz,"implementacoes/dados-locais.css"),"utf8");
  const theme=fs.readFileSync(path.join(raiz,"cyan-theme.css"),"utf8");
  assert.ok(theme.includes('#contagemManual .contagem-v2-tipos button.ativo'));
  assert.ok(css.includes('background:#126776'));
  assert.ok(css.includes('#dadosLocais .dl-app{'));
  assert.ok(css.includes('max-width:none;'));
  assert.ok(css.includes('padding:0;'));
  assert.ok(css.includes('@media(max-width:380px)'));
});

test("Conferência local exige escolha de material antes de abrir registro",()=>{
 const {api}=compilar(),html=api.htmlPrincipal();
 assert.ok(html.includes('id="dlConCodigo" readonly required'));
 assert.ok(html.includes('id="dlConSelecionado"'));
 assert.ok(source.includes('function selecionarConferencia(material)'));
 assert.ok(source.includes('data-dl-conferir'));
 assert.ok(source.includes('["pesquisa","estoque","reservas","conferencias"].includes(aba)'));
});
test("contagem local não carrega 94 mil materiais automaticamente ao abrir",()=>{
 assert.ok(source.includes('if (["reservas","comparar","divergencias","locais"].includes(nome))'));
});
