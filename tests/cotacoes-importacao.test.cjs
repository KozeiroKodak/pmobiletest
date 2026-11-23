'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const codigo=fs.readFileSync(path.join(__dirname,'..','cotacoes-importacao.js'),'utf8');
function simular(matriz,falharNoLote){
 const controles=new Map(),chamadas=[];
 function element(id){
  if(!controles.has(id)){
   controles.set(id,{
    id,disabled:true,hidden:false,files:[],value:'',dataset:{},textContent:'',children:[],
    scrollIntoView(){},replaceChildren(){this.children=[]},
    appendChild(x){this.children.push(x)}
   });
  }
  return controles.get(id);
 }
 const document={
  getElementById:element,
  createElement:tag=>({tag,textContent:'',className:'',children:[],appendChild(x){this.children.push(x)}})
 };
 const contexto={document,window:null,CustomEvent:class{constructor(type){this.type=type}}};
 const window={
  usuarioPmobileAtual:{usuario:'admin',nivel:'ADMIN'},
  credencialPmobileAtual:'credencial-de-teste',
  XLSX:{
   read:()=>{
    const abas=Array.isArray(matriz)?{'Cidades atendidas':matriz}:matriz;
    return {SheetNames:Object.keys(abas),Sheets:abas};
   },
   utils:{sheet_to_json:conteudo=>conteudo}
  },
  confirm:()=>true,
  dispatchEvent(){},
  clienteSupabase:{rpc:async (name,args)=>{
   chamadas.push({name,args});
   if(name==='pmobile_cotacoes_importar_iniciar_v1')return {data:'00000000-0000-4000-8000-000000000001'};
   if(name==='pmobile_cotacoes_importar_lote_v1'){
    if(falharNoLote&&chamadas.filter(x=>x.name===name).length===falharNoLote)
     return {error:{message:'falha de rede simulada'}};
    return {data:args.p_linhas.length};
   }
   if(name==='pmobile_cotacoes_importar_finalizar_v1')return {data:args.p_esperado};
   return {error:{message:'RPC inesperada'}};
  }}
 };
 contexto.window=window;
 vm.runInNewContext(codigo,contexto);
 element('cotImportacaoTransportadora').value='TRANSPORTADORA TESTE';
 element('cotImportacaoArquivo').files=[{name:'revisada.xlsx',size:500,arrayBuffer:async()=>new ArrayBuffer(0)}];
 return {window,element,chamadas};
}
test('planilha válida prepara e só envia após confirmação',async()=>{
 const t=simular([['UF','Destino','TDA'],['RS','CANOAS','0'],['RS','PORTO ALEGRE','-']]);
 await t.window.prepararArquivoCotacoes();
 assert.equal(t.chamadas.length,0);
 assert.equal(t.element('cotImportacaoConfirmar').disabled,false);
 await t.window.confirmarImportacaoCotacoes();
 assert.deepEqual(t.chamadas.map(x=>x.name),[
  'pmobile_cotacoes_importar_iniciar_v1',
  'pmobile_cotacoes_importar_lote_v1',
  'pmobile_cotacoes_importar_finalizar_v1']);
 assert.equal(t.chamadas[1].args.p_linhas[0].tda,'0');
 assert.equal(t.chamadas[1].args.p_linhas[1].tda,'-');
 assert.equal(t.element('cotImportacaoConfirmar').disabled,true);
});
test('arquivo com coluna CEP extra é aceito sem importar a coluna',async()=>{
 const t=simular([['UF','Destino','TDA','CEP'],['RS','CANOAS','0','92000000']]);
 await t.window.prepararArquivoCotacoes();
 assert.equal(t.element('cotImportacaoConfirmar').disabled,false);
 assert.equal(t.chamadas.length,0);
 await t.window.confirmarImportacaoCotacoes();
 const lote=t.chamadas.find(x=>x.name==='pmobile_cotacoes_importar_lote_v1');
 assert.ok(lote);
 assert.deepEqual(Object.keys(lote.args.p_linhas[0]),['uf','destino','tda']);
 assert.equal(lote.args.p_linhas[0].tda,'0');
});
test('Transcelo original: título, cabeçalho na linha 5, quinze colunas e exclusão explícita',async()=>{
 const linhas=[
  ['TRANSCELO — RELAÇÃO DE CIDADES ATENDIDAS'],
  ['Fonte: imagem enviada'],
  ['CEP e código municipal'],
  [],
  ['UF','Destino','Código município','CEP','TDA','Filial / Agência','SEG','TER','QUA','QUI','SEX','Turno 1','Turno 2','Atendimento','Observações'],
  ['RS','ALTO FELIZ','4300570','95773000','-','SÃO SEBASTIÃO DO CAÍ','SEG','TER','QUA','QUI','SEX','X','','ATENDE',''],
  ['RS','*MONTE ALVERNE','','','','','','','','','','','','NÃO ATENDEMOS',''],
  ['RS','SANTA CRUZ DO SUL','4316808','96800000','','LAJEADO','SEG','TER','QUA','QUI','SEX','X','X','ATENDE','']
 ];
 const t=simular({'Transportadora':[['Campo','Informação']],'Cidades atendidas':linhas,
 'Conferência':[['Pontos para conferência']]});
 await t.window.prepararArquivoCotacoes();
 assert.equal(t.chamadas.length,0);
 assert.equal(t.element('cotImportacaoConfirmar').disabled,false);
 assert.match(t.element('cotImportacaoStatus').textContent,/cabeçalho na linha 5/);
 assert.match(t.element('cotImportacaoStatus').textContent,/1 localidade/);
 await t.window.confirmarImportacaoCotacoes();
 const lote=t.chamadas.find(x=>x.name==='pmobile_cotacoes_importar_lote_v1');
 assert.equal(lote.args.p_linhas.length,2);
 assert.equal(lote.args.p_linhas[0].destino,'ALTO FELIZ');
 assert.equal(lote.args.p_linhas[1].destino,'SANTA CRUZ DO SUL');
 assert.equal(lote.args.p_linhas[0].tda,'-');
 assert.equal(lote.args.p_linhas[1].tda,'');
});
test('Transcelo editada: cabeçalho na linha 3',async()=>{
 const t=simular([['TRANSCELO — RELAÇÃO DE CIDADES ATENDIDAS'],[],['UF','Destino','TDA'],
  ['RS','ALTO FELIZ','-'],['RS','CANOAS','']]);
 await t.window.prepararArquivoCotacoes();
 assert.equal(t.element('cotImportacaoConfirmar').disabled,false);
 assert.match(t.element('cotImportacaoStatus').textContent,/cabeçalho na linha 3/);
 assert.equal(t.chamadas.length,0);
});
test('Alfa exportada: repetição de UF e Destino com TDAs diferentes é bloqueada',async()=>{
 const t=simular([['UF','Destino','TDA'],
  ['RS','ALTO ALEGRE','-'],['RS','ALTO ALEGRE',86.32]]);
 await t.window.prepararArquivoCotacoes();
 assert.equal(t.element('cotImportacaoConfirmar').disabled,true);
 assert.match(t.element('cotImportacaoStatus').textContent,/duplicada/);
 assert.equal(t.chamadas.length,0);
});
test('cidade repetida é sinalizada antes da gravação',async()=>{
 const t=simular([['UF','Destino','TDA'],['RS','CANOAS','0'],['rs','Cánoas','-']]);
 await t.window.prepararArquivoCotacoes();
 assert.match(t.element('cotImportacaoStatus').textContent,/duplicada/);
 assert.equal(t.chamadas.length,0);
});
test('erro no segundo lote impede a finalização',async()=>{
 const matriz=[['UF','Destino','TDA']];
 for(let i=0;i<201;i++)matriz.push(['RS','DESTINO '+i,'']);
 const t=simular(matriz,2);
 await t.window.prepararArquivoCotacoes();
 await t.window.confirmarImportacaoCotacoes();
 assert.equal(t.chamadas.filter(x=>x.name==='pmobile_cotacoes_importar_lote_v1').length,2);
 assert.equal(t.chamadas.some(x=>x.name==='pmobile_cotacoes_importar_finalizar_v1'),false);
 assert.match(t.element('cotImportacaoStatus').textContent,/sem confirmação final/i);
});
