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
  assert.ok(h.includes('class="painel contagem-v2"'));
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
test("Conferências locais reproduz o padrão nativo de cartões",()=>{
  const {api}=compilar(),h=api.htmlPrincipal();
  assert.ok(h.includes('class="conferencias-conteudo"'));
  assert.ok(h.includes('id="dlHistorico"'));
  assert.ok(source.includes('class="registro-conferencia"'));
  assert.ok(source.includes('class="conferencias-resumo"'));
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
