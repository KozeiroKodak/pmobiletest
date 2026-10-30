const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const raiz=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(raiz,"dados-locais.js"),"utf8");
function criar(){
  const code=src.replace("  window.abrirDadosLocaisPmobile=abrir;",
    "  window.__visualPmobile={htmlPrincipal,desenharMateriais,desenharComparacao,icone};\n"+
    "  window.abrirDadosLocaisPmobile=abrir;");
  assert.notEqual(code,src);
  const els=new Map();
  const doc={readyState:"loading",addEventListener(){},getElementById(id){return els.get(id)||null}};
  const app={window:{},document:doc,navigator:{onLine:false},console,setTimeout,
    localStorage:{getItem(){return null},setItem(){},removeItem(){}}};
  vm.runInNewContext(code,app);
  const elemento=(id)=>{const el={innerHTML:"",replaceChildren(){this.innerHTML=""}};els.set(id,el);return el};
  return {api:app.window.__visualPmobile,elemento};
}
test("o hub usa oito cartões com SVG, agrupados como Configurações nativa",()=>{
  const {api}=criar();
  const html=api.htmlPrincipal();
  assert.equal((html.match(/data-dl-open=/g)||[]).length,8);
  assert.equal((html.match(/class="dl-card-icon"/g)||[]).length,8);
  assert.ok(html.includes("dl-secao-titulo"));
  assert.ok(html.includes("dl-progresso-barra"));
  assert.ok(html.includes("class=\"dl-primario\""));
  for(const aba of ["pesquisa","estoque","reservas","conferencias","comparar","divergencias","locais","importar"]){
    assert.ok(html.includes('data-dl-panel="'+aba+'"'),"aba "+aba);
  }
  for(const id of ["dlFormEstoque","dlFormConferencia","dlFormImportar","dlArquivo","dlBotaoImportar"]){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
});
test("Pesquisa local mantém botões de edição e conferência em cartões expansíveis",()=>{
  const {api,elemento}=criar();
  const alvo=elemento("dlResultados-pesquisa");elemento("dlResumo-pesquisa");
  api.desenharMateriais("pesquisa",[{
    codigo:"100",descricao:"<script>malicioso</script>",referencia:"AB",marca:"M",
    quantidade_total:null,quantidade_item:null,quantidade_reservada:null,local:null
  }]);
  assert.ok(alvo.innerHTML.includes("<details"));
  assert.ok(alvo.innerHTML.includes("dl-item-summary"));
  assert.ok(alvo.innerHTML.includes('data-dl-edit="100"'));
  assert.ok(alvo.innerHTML.includes('data-dl-conferir="100"'));
  assert.ok(!alvo.innerHTML.includes("<script>"));
  assert.ok(alvo.innerHTML.includes("&lt;script&gt;"));
  assert.ok(alvo.innerHTML.includes("Pendente"));
});
test("Locais locais exibe local anterior e novo sem botão de gravação na Dogo",()=>{
  const {api,elemento}=criar();
  const alvo=elemento("dlResultados-locais");elemento("dlResumo-locais");
  api.desenharComparacao("locais",[{
    codigo:"200",descricao:"Material teste",dogo_local:"A-01",local_local:"B-02",
    dogo_quantidade:10,local_quantidade:null,dogo_reservada:0,local_reservada:null,
    diferenca_quantidade:false,diferenca_reserva:false,diferenca_local:true,
    sem_dogo:false,pendente_quantidade:true,pendente_reserva:true,pendente_local:false
  }]);
  assert.ok(alvo.innerHTML.includes("Local anterior"));
  assert.ok(alvo.innerHTML.includes("Novo local"));
  assert.ok(alvo.innerHTML.includes("A-01"));
  assert.ok(alvo.innerHTML.includes("B-02"));
  assert.ok(!alvo.innerHTML.includes("confirmar_alteracao_local"));
});
test("Locais e Divergências exibem estado vazio sem declarar estoque correto",()=>{
  const {api,elemento}=criar();
  for(const aba of ["locais","divergencias"]){
    const el=elemento("dlResultados-"+aba);elemento("dlResumo-"+aba);
    api.desenharComparacao(aba,[]);
    assert.ok(el.innerHTML.includes("Nenhuma ocorrência encontrada"));
    if(aba==="locais")assert.ok(el.innerHTML.includes("pendentes, não divergências"));
  }
});
test("CSS restrito a Dados locais e réplica Android igual à Web",()=>{
  const css=fs.readFileSync(path.join(raiz,"implementacoes/dados-locais.css"),"utf8");
  assert.ok(css.includes("#dadosLocais .dl-card"));
  assert.ok(css.includes("#dadosLocais .dl-trajeto"));
  assert.ok(css.includes("#dadosLocais .dl-cabecalho"));
  for(const p of ["index.html","dados-locais.js","reorganizacao-pmobile.js","implementacoes/dados-locais.css"]){
    assert.equal(fs.readFileSync(path.join(raiz,p),"utf8"),fs.readFileSync(path.join(raiz,"www",p),"utf8"),p);
  }
});
