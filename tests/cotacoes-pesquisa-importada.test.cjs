'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','cotacoes-pesquisa-importada.js'),'utf8');
const mockCities=(n,start=0,total=120)=>Array.from({length:n},(_,i)=>({
 uf:'RS',destino:'DESTINO '+(start+i),total_transportadoras:2,total_cidades:total,
 transportadoras:[{transportadora:'Transcelo',tda:'-'},{transportadora:'Fritz',tda:''}]
}));
function setup({unauthorized=false, empty=false}={}){
 const els=new Map(),listeners={},calls=[];
 const node=(tag='div')=>({
  tag,children:[],dataset:{},value:'',textContent:'',hidden:false,disabled:false,
  replaceChildren(){this.children=[]},appendChild(e){this.children.push(e)},
  getAttribute(){return null}
 });
 const el=id=>{if(!els.has(id))els.set(id,node());return els.get(id)};
 const document={getElementById:el,createElement:tag=>node(tag),
  addEventListener:(name,fn)=>{listeners[name]=fn}};
 const win={
  usuarioPmobileAtual:unauthorized?null:{usuario:'consulta'},
  credencialPmobileAtual:unauthorized?null:'credencial-simulada',
  mostrarTelaSistema(id){this.screen=id},
  addEventListener(name,fn){listeners[name]=fn},
  clienteSupabase:{rpc:async(nome,args)=>{
   calls.push({nome,args});
   if(nome==='pmobile_cotacoes_cidades_detalhadas_v2'){
    if(empty)return {data:[]};
    if(args.p_busca==='CANOAS')return {data:[{uf:'RS',destino:'CANOAS',total_transportadoras:3,total_cidades:1,transportadoras:[{transportadora:'Transcelo',tda:'-'}]}]};
    const offset=args.p_offset||0;
    return {data:mockCities(Math.min(80,120-offset),offset,120)};
   }
   return {error:{message:'RPC inesperada: '+nome}};
  }}
 };
 vm.runInNewContext(source,{window:win,document,console,setTimeout,clearTimeout,
  getComputedStyle:()=>({display:'block'})});
 return {el,win,calls,listeners};
}
test('abre quarta tela e consulta 80 cidades ativas inicialmente',async()=>{
 const t=setup();
 await t.win.abrirPesquisaImportacoes();
 assert.equal(t.win.screen,'cotacoesPesquisaImportadas');
 assert.equal(t.calls.length,1);
 assert.equal(t.calls[0].nome,'pmobile_cotacoes_cidades_detalhadas_v2');
 assert.equal(t.calls[0].args.p_offset,0);
 assert.equal(t.el('cotPesqImportLista').children.length,80);
 assert.equal(t.el('cotPesqImportMais').hidden,false);
 assert.match(t.el('cotPesqImportContagem').textContent,/80 de 120/);
});
test('carregar mais mantém as cidades anteriores e incrementa offset',async()=>{
 const t=setup();
 await t.win.abrirPesquisaImportacoes();
 await t.win.carregarMaisCidadesImportadas();
 assert.equal(t.calls[1].args.p_offset,80);
 assert.equal(t.el('cotPesqImportLista').children.length,120);
 assert.equal(t.el('cotPesqImportMais').hidden,true);
});
test('busca consulta servidor, não filtra apenas as 80 primeiras cidades',async()=>{
 const t=setup();
 await t.win.abrirPesquisaImportacoes();
 t.el('cotPesqImportBusca').value='CANOAS';
 t.win.pesquisarCidadesImportadas();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(t.calls[1].args.p_busca,'CANOAS');
 assert.equal(t.calls[1].args.p_offset,0);
 assert.equal(t.el('cotPesqImportLista').children.length,1);
 assert.equal(t.el('cotPesqImportLista').children[0].dataset.cotCidadeDestino,'CANOAS');
});
test('tocar na cidade abre transportadoras pré-carregadas sem segunda RPC, mesmo offline',async()=>{
 const t=setup();
 await t.win.abrirPesquisaImportacoes();
 const anterior=t.calls.length;
 t.win.clienteSupabase.rpc=async()=>{throw Error('rede móvel desconectada');};
 t.listeners.click({target:{closest:()=>({dataset:{cotCidadeUf:'RS',cotCidadeDestino:'DESTINO 4'}})}});
 assert.equal(t.calls.length,anterior);
 assert.equal(t.el('cotPesqImportDetalhe').hidden,false);
 assert.equal(t.el('cotPesqImportTransportadoras').children.length,2);
 assert.match(t.el('cotPesqImportTransportadoras').children[0].children[1].textContent,/TDA: -/);
 assert.match(t.el('cotPesqImportTransportadoras').children[1].children[1].textContent,/não informada/);
 assert.match(t.el('cotPesqImportStatus').textContent,/2 transportadora/);
 t.win.voltarCidadesImportadas();
 assert.equal(t.el('cotPesqImportBuscador').hidden,false);
 assert.equal(t.el('cotPesqImportLista').children.length,80);
});
test('sem dados informa lista vazia, sem inventar transportadoras',async()=>{
 const t=setup({empty:true});
 await t.win.abrirPesquisaImportacoes();
 assert.equal(t.el('cotPesqImportLista').children.length,1);
 assert.match(t.el('cotPesqImportLista').children[0].textContent,/Nenhuma cidade importada/);
});
test('sem credenciais não faz leitura do Supabase',async()=>{
 const t=setup({unauthorized:true});
 await t.win.abrirPesquisaImportacoes();
 assert.equal(t.calls.length,0);
 assert.match(t.el('cotPesqImportStatus').textContent,/Faça login/);
});
test('módulo somente leitura não chama escrita ou rastreios',()=>{
 assert.doesNotMatch(source,/pmobile_rastreio_listar|pmobile_cotacoes_importar_|pmobile_cotacoes_transportadoras_cidade_v1|\.insert\(|\.update\(|\.delete\(/);
});

test('importação atualizada invalida o cache e carrega novos dados',async()=>{
 const t=setup();
 await t.win.abrirPesquisaImportacoes();
 assert.equal(t.calls.length,1);
 t.listeners['pmobile:cotacoes-atualizadas']();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(t.calls.length,2);
 assert.equal(t.calls[1].nome,'pmobile_cotacoes_cidades_detalhadas_v2');
});
test('resposta sem transportadoras não abre detalhes inconsistentes',async()=>{
 const t=setup();
 t.win.clienteSupabase.rpc=async()=>({data:[{uf:'RS',destino:'CANOAS',total_transportadoras:1,total_cidades:1}]});
 await t.win.abrirPesquisaImportacoes();
 assert.match(t.el('cotPesqImportStatus').textContent,/Resposta incompleta/);
 assert.equal(t.el('cotPesqImportLista').children.length,0);
});
