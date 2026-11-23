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
   read:()=>({SheetNames:['Cidades atendidas'],Sheets:{'Cidades atendidas':{}}}),
   utils:{sheet_to_json:()=>matriz}
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
test('arquivo com dados extras é bloqueado sem enviar nada',async()=>{
 const t=simular([['UF','Destino','TDA','CEP'],['RS','CANOAS','0','92000000']]);
 await t.window.prepararArquivoCotacoes();
 assert.equal(t.element('cotImportacaoConfirmar').disabled,true);
 await t.window.confirmarImportacaoCotacoes();
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
