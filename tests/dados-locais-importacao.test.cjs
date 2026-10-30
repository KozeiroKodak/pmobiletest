const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

function carregar(implementacao){
  const code=implementacao||fs.readFileSync(path.join(__dirname,"..","dados-locais.js"),"utf8");
  const instrumentado=code.replace("  window.abrirDadosLocaisPmobile=abrir;",
    "  window.__importacaoTeste={textoSeguroCatalogo,erroJsonImportacao,erroTemporarioImportacao,enviarLoteCatalogo,lerPlanilha,chaveArquivoCatalogo};\n"+
    "  window.abrirDadosLocaisPmobile=abrir;");
  assert.notEqual(instrumentado,code,"funções internas disponíveis para validação");
  const sandbox={
    window:{usuarioPmobileAtual:{usuario:"usuario-teste"},credencialPmobileAtual:"ficticia"},
    document:{readyState:"loading",addEventListener(){}},
    navigator:{onLine:true},
    console,setTimeout
  };
  vm.runInNewContext(instrumentado,sandbox,{filename:"dados-locais.js"});
  return {helpers:sandbox.window.__importacaoTeste,window:sandbox.window};
}
test("normalização elimina controles, NUL e surrogates inválidos mas mantém unicode válido",()=>{
  const {textoSeguroCatalogo:seguro}=carregar().helpers;
  assert.equal(seguro("  Parafuso\u0000\u0001 \uD800 ABC \uDC00  "),"Parafuso ABC");
  assert.equal(seguro("Material çã 🔩"),"Material çã 🔩");
  assert.doesNotThrow(()=>JSON.parse(JSON.stringify({descricao:seguro("A\uD800\u0000B")})));
});
test("planilha XLS em células textualizadas é sanitizada sem trazer quantidades da Dogo",async()=>{
  const {helpers,window}=carregar();
  window.XLSX={
    read(){return {SheetNames:["Estoque"],Sheets:{Estoque:{}}}},
    utils:{sheet_to_json(){return [
      ["Produto","Descrição","Referência","Marca","Qtde. Est.","Local"],
      ["00123","Arruela\u0000 \uD800 lisa","REF\u0001-1","M\uDC00arca","9999","Rua A"]
    ]}}
  };
  const resultado=await helpers.lerPlanilha({arrayBuffer:async()=>new ArrayBuffer(0)});
  assert.equal(resultado.length,1);
  const item=resultado[0];
  assert.equal(item.codigo,"00123");
  assert.equal(item.descricao,"Arruela lisa");
  assert.equal(item.referencia,"REF -1");
  assert.equal(item.marca,"Marca");
  assert.equal(Object.hasOwn(item,"quantidade"),false);
  assert.equal(Object.hasOwn(item,"local"),false);
});
test("PGRST102 subdivide os lotes e conserva todos os códigos",async()=>{
  const {helpers,window}=carregar();
  const enviados=[];
  window.clienteSupabase={rpc:async(nome,params)=>{
    assert.equal(nome,"pmobile_local_importar_catalogo");
    if(params.p_materiais.length>2)return {error:{code:"PGRST102",message:"Empty or invalid json"}};
    enviados.push(...params.p_materiais.map(x=>x.codigo));
    return {data:params.p_materiais.length,error:null};
  }};
  const lote=Array.from({length:9},(_,i)=>({codigo:"C"+i,descricao:"Item "+i}));
  await helpers.enviarLoteCatalogo(lote,null);
  assert.deepEqual(enviados,lote.map(x=>x.codigo));
});
test("registro rejeitado isoladamente informa código e não é omitido",async()=>{
  const {helpers,window}=carregar();
  window.clienteSupabase={rpc:async()=>({error:{code:"PGRST102",message:"Empty or invalid json"}})};
  await assert.rejects(helpers.enviarLoteCatalogo([
    {codigo:"200",descricao:"A"},{codigo:"201",descricao:"B"}],null),/Cadastro 200 rejeitado/);
});
test("fonte web e fallback Android idênticas",()=>{
  const p=path.join(__dirname,"..");
  assert.equal(fs.readFileSync(path.join(p,"dados-locais.js"),"utf8"),
               fs.readFileSync(path.join(p,"www/dados-locais.js"),"utf8"));
});
