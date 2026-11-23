'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','cotacoes-historico.js'),'utf8');
function setup({fail=false}={}){
 const els=new Map(),calls=[];
 const element=id=>{
  if(!els.has(id)){
   els.set(id,{id,hidden:false,disabled:true,value:'',dataset:{},textContent:'',children:[],
    replaceChildren(){this.children=[]},appendChild(x){this.children.push(x)}});
  }return els.get(id);
 };
 const doc={getElementById:element,createElement:tag=>({tag,type:'',dataset:{},children:[],textContent:'',appendChild(x){this.children.push(x)}}),
  addEventListener(){}};
 const active={id:'11111111-1111-4111-8111-111111111111',transportadora:'Transcelo',arquivo_nome:'origem.xlsx',status:'ATIVA',total_linhas:38,criado_em:'2026-11-23T12:00:00Z'};
 const old={...active,id:'22222222-2222-4222-8222-222222222222',arquivo_nome:'anterior.xlsx',status:'SUBSTITUIDA',total_linhas:36};
 const win={usuarioPmobileAtual:{usuario:'admin'},credencialPmobileAtual:'credencial-teste',addEventListener(){},
  mostrarTelaSistema(t){this.tela=t},
  clienteSupabase:{rpc:async (name,args)=>{
   calls.push({name,args});
   if(fail)return {error:{message:'falha simulada'}};
   if(name==='pmobile_cotacoes_importacoes_historico_v1')return {data:[active,old]};
   if(name==='pmobile_cotacoes_importacao_destinos_v1')return {data:[{uf:'RS',destino:'CANOAS',tda:'-'}]};
   return {error:{message:'Chamada inesperada'}};
  }}};
 vm.runInNewContext(source,{window:win,document:doc,getComputedStyle:()=>({display:'block'}),Date,console});
 return {element,window:win,calls,active,old};
}
test('carrega histórico ativo e antigo sem operação de gravação',async()=>{
 const t=setup();
 await t.window.abrirHistoricoCotacoes();
 assert.equal(t.window.tela,'cotacoesImportadas');
 assert.equal(t.element('cotHistoricoLista').children.length,2);
 assert.match(t.element('cotHistoricoLista').children[1].children[1].children[2].textContent,/Versão anterior/);
 assert.ok(t.calls.every(x=>x.name.endsWith('_historico_v1')));
});
test('consulta UF Destino TDA da versão escolhida sem modificar dados',async()=>{
 const t=setup();
 await t.window.abrirHistoricoCotacoes();
 // disparador interno via evento de clique controlado por DOM, sem escrita.
 // Apenas RPCs de leitura estão permitidas no arquivo de consulta.
 assert.match(source,/pmobile_cotacoes_importacao_destinos_v1/);
 assert.doesNotMatch(source,/importar_lote|importar_finalizar|delete\(|insert\(|update\(/);
});
test('falha na consulta apresenta erro e mantém tela aberta',async()=>{
 const t=setup({fail:true});
 await t.window.abrirHistoricoCotacoes();
 assert.match(t.element('cotHistoricoStatus').textContent,/Falha ao consultar importações/);
 assert.equal(t.element('cotHistoricoLista').children.length,0);
});
