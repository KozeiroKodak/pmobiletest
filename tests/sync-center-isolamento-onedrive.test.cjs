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


const manual=fs.readFileSync(path.join(dir,"contagemmanual.js"),"utf8");
function executarSnapshot(overrides={}){
  const trecho=source.match(/async function snapshot\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(trecho);
  const ctx={
    window:{estadoSincronizacaoPmobile:{}},navigator:{onLine:true},
    APP:"pmobile",busy:false,lastError:"",
    lerContagensManuais:async()=>[],
    obterMateriaisLocais:()=>[1],
    obterConferenciasPendentes:async()=>[],
    obterDataUltimaSincronizacao:async()=>null,
    ...overrides
  };
  return {ctx,resultado:vm.runInNewContext(trecho[0]+";snapshot()",ctx)};
}
test("falha de leitura das conferências nunca confirma tudo sincronizado",async()=>{
  const {resultado}=executarSnapshot({
    obterConferenciasPendentes:async()=>{throw Error("Fila indisponível");}
  });
  const data=await resultado;
  assert.equal(data.conferences,null);
  assert.equal(data.state,"error");
  assert.match(data.verificationError,/Conferências/);
});
test("verificação ausente ou inválida permanece inconclusiva",async()=>{
  for(const verificacao of [undefined,async()=>null]){
    const {resultado}=executarSnapshot({obterConferenciasPendentes:verificacao});
    assert.equal((await resultado).state,"attention");
  }
  assert.equal((await executarSnapshot({obterMateriaisLocais:()=>null}).resultado).state,"attention");
  assert.equal((await executarSnapshot({lerContagensManuais:async()=>[{sincronizado:false}]}).resultado).state,"pending");
});
test("sincronização manual devolve resultado real para a central",async()=>{
  const trecho=manual.match(/async function atualizarContagensManuais\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(trecho);
  const criar=(baixar,emAndamento=false)=>{
    const ctx={
      sincronizacaoContagensManuaisEmAndamento:emAndamento,
      obterLimpezaContagensManuaisSupabase:async()=>null,
      sincronizarContagensManuaisPendentes:async()=>{},
      baixarContagensManuaisSupabase:baixar,
      exibirContagensManuais:()=>{},
      document:{getElementById:()=>null},
      console:{warn:()=>{}}
    };
    return {ctx,executar:vm.runInNewContext(trecho[0]+";atualizarContagensManuais",ctx)};
  };
  const sucesso=criar(async()=>true);
  assert.equal(await sucesso.executar(),true);
  assert.equal(sucesso.ctx.sincronizacaoContagensManuaisEmAndamento,false);
  assert.equal(await criar(async()=>false).executar(),false);
  assert.equal(await criar(async()=>{throw Error("Servidor");}).executar(),false);
  assert.equal(await criar(async()=>true,true).executar(),false);
});
test("botão sincronizar não oculta falha da consulta de contagens",async()=>{
  const trecho=source.match(/async function retry\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(trecho);
  const ctx={
    busy:false,lastAttempt:null,lastError:"",navigator:{onLine:true},
    APP:"pmobile",render:async()=>{},
    atualizarContagensManuais:async()=>false,
    sincronizarMateriaisLocaisComSupabase:async()=>({sucesso:true}),
    avaliarSincronizacoesPmobile:async()=>{},
    console:{warn:()=>{}}
  };
  await vm.runInNewContext(trecho[0]+";retry()",ctx);
  assert.equal(ctx.busy,false);
  assert.match(ctx.lastError,/Contagens manuais/);
});

test("indicador descreve somente o que foi verificado localmente",()=>{
  assert.match(source,/Sem pendências locais/);
  assert.doesNotMatch(source,/Registros confirmados/);
});
