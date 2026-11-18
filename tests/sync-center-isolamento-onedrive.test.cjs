const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const dir=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(dir,"sync-center.js"),"utf8");
test("rodape nao exibe OneDrive e ignora seu erro no resumo",async()=>{
  assert.doesNotMatch(source,/onedrive/i);
  const snap=source.match(/async function snapshot\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(snap,"snapshot encontrada");
  const ctx={
    window:{estadoSincronizacaoPmobile:{},estadoOneDriveRastreio:{estado:"erro",mensagem:"Erro remoto de teste"}},
    navigator:{onLine:true},
    APP:"pmobile",busy:false,lastError:"",
    lerContagensManuais:async()=>[],
    obterMateriaisLocais:()=>[1,2],
    obterConferenciasPendentes:async()=>[],
    obterDataUltimaSincronizacao:async()=>null
  };
  const data=await vm.runInNewContext(snap[0]+";snapshot()",ctx);
  assert.equal(data.state,"ok");
  assert.equal(data.pending,0);
  assert.equal(data.count,0);
  assert.equal(data.inventory,2);
  assert.equal(data.conferences,0);
  assert.equal(Object.hasOwn(data,"onedrive"),false);
});
test("painel preserva indicadores de inventario e pendencias",()=>{
 for(const label of ["Conexão","Materiais locais","Contagens pendentes","Conferências pendentes","Último inventário"]){
   assert.ok(source.includes('"'+label+'"'),label);
 }
 assert.match(source,/window\.estadoSincronizacaoPmobile/);
 assert.match(source,/sincronizarMateriaisLocaisComSupabase/);
 assert.match(source,/atualizarContagensManuais/);
});
test("copia OTA www e sincronizador original tem paridade",()=>{
 assert.equal(source,fs.readFileSync(path.join(dir,"www/sync-center.js"),"utf8"));
});
