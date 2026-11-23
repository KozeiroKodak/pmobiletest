/* PMobile — Consulta independente das planilhas importadas, sem modificar fonte original. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const estado={importacoes:new Map(),listaOffset:0,listaLimite:100,importacao:null,
 paginaOffset:0,paginaLimite:100,busca:"",geracao:0};
const normal=v=>String(v==null?"":v).trim();
const formatoData=v=>{
 if(!v)return "Data indisponível";
 const d=new Date(v);
 return Number.isNaN(d.getTime())?"Data indisponível":d.toLocaleString("pt-BR");
};
function status(mensagem,erro){
 const el=$("cotHistoricoStatus");
 if(el){el.textContent=mensagem;el.dataset.erro=erro?"sim":"nao";}
}
function limpar(el){if(el)el.replaceChildren();}
function textoElemento(tag,texto,classe){
 const el=document.createElement(tag);
 el.textContent=String(texto??"");
 if(classe)el.className=classe;
 return el;
}
function credenciais(){
 const usuario=window.usuarioPmobileAtual?.usuario;
 const credencial=window.credencialPmobileAtual;
 if(!usuario||!credencial)throw Error("Entre novamente para consultar as importações.");
 return {p_usuario:usuario,p_credencial:credencial};
}
async function rpc(nome,args){
 if(!window.clienteSupabase?.rpc)throw Error("Supabase indisponível.");
 const {data,error}=await window.clienteSupabase.rpc(nome,args);
 if(error)throw Error(error.message||"Não foi possível consultar.");
 return Array.isArray(data)?data:[];
}
function rotuloSituacao(s){
 return s==="ATIVA"?"Ativa":s==="SUBSTITUIDA"?"Versão anterior":"Não concluída";
}
function mostrarPainelDetalhe(mostrar){
 const detalhe=$("cotHistoricoDetalhe"),lista=$("cotHistoricoPainelLista");
 if(detalhe)detalhe.hidden=!mostrar;
 if(lista)lista.hidden=mostrar;
}
async function abrirHistoricoCotacoes(){
 if(typeof window.mostrarTelaSistema!=="function")return;
 window.mostrarTelaSistema("cotacoesImportadas","menuTransportes");
 mostrarPainelDetalhe(false);
 await carregarHistoricoCotacoes();
}
async function carregarHistoricoCotacoes(){
 const geracao=++estado.geracao;
 estado.listaOffset=0;
 estado.importacao=null;
 estado.importacoes.clear();
 mostrarPainelDetalhe(false);
 status("Consultando importações salvas...",false);
 const lista=$("cotHistoricoLista");
 limpar(lista);
 try{
  const params=credenciais();
  const rows=await rpc("pmobile_cotacoes_importacoes_historico_v1",{
   ...params,p_limit:estado.listaLimite,p_offset:0
  });
  if(geracao!==estado.geracao)return;
  for(const x of rows)estado.importacoes.set(x.id,x);
  renderLista(rows);
  status(rows.length?rows.length+" importação(ões) encontrada(s). As versões anteriores permanecem disponíveis para consulta.":"Nenhuma planilha foi importada ainda.",false);
 }catch(e){
  if(geracao!==estado.geracao)return;
  status("Falha ao consultar importações: "+(e.message||e),true);
 }
}
function renderLista(rows){
 const container=$("cotHistoricoLista");
 limpar(container);
 if(!container)return;
 if(!rows.length){container.appendChild(textoElemento("p","Não há importações cadastradas.","cot-empty"));return;}
 for(const item of rows){
  const b=document.createElement("button");
  b.type="button";b.className="cot-card cot-historico-item";
  b.dataset.cotImportacaoId=item.id;
  const icone=textoElemento("span","📑","cot-icon");
  const corpo=textoElemento("span","","cot-historico-descricao");
  corpo.appendChild(textoElemento("strong",item.transportadora));
  corpo.appendChild(textoElemento("small",item.arquivo_nome+" · "+(item.total_linhas||0).toLocaleString("pt-BR")+" localidades"));
  corpo.appendChild(textoElemento("small",formatoData(item.finalizado_em||item.criado_em)+" · "+rotuloSituacao(item.status)));
  b.appendChild(icone);b.appendChild(corpo);
  b.appendChild(textoElemento("span","›","cot-arrow"));
  container.appendChild(b);
 }
 const p=$("cotHistoricoPaginacao");
 if(p)p.hidden=false;
 const anterior=$("cotHistoricoAnterior"),proximo=$("cotHistoricoProximo");
 if(anterior)anterior.disabled=estado.listaOffset===0;
 if(proximo)proximo.disabled=rows.length<estado.listaLimite;
}
async function mudarPaginaHistorico(sentido){
 if(estado.importacao)return;
 const proximo=Math.max(0,estado.listaOffset+sentido*estado.listaLimite);
 if(proximo===estado.listaOffset)return;
 const g=++estado.geracao;
 status("Carregando histórico...",false);
 try{
  const rows=await rpc("pmobile_cotacoes_importacoes_historico_v1",{
   ...credenciais(),p_limit:estado.listaLimite,p_offset:proximo
  });
  if(g!==estado.geracao)return;
  if(!rows.length&&sentido>0){status("Não há mais registros.",false);return;}
  estado.listaOffset=proximo;
  for(const r of rows)estado.importacoes.set(r.id,r);
  renderLista(rows);
  status("Exibindo "+(proximo+1)+" a "+(proximo+rows.length)+" importações.",false);
 }catch(e){if(g===estado.geracao)status("Não foi possível mudar de página: "+e.message,true);}
}
async function abrirDetalheImportacao(id){
 const item=estado.importacoes.get(id);
 if(!item)return;
 estado.importacao=item;estado.paginaOffset=0;estado.busca="";
 const busca=$("cotHistoricoBusca");if(busca)busca.value="";
 mostrarPainelDetalhe(true);
 const titulo=$("cotHistoricoTitulo");
 if(titulo)titulo.textContent=item.transportadora;
 const sub=$("cotHistoricoDescricao");
 if(sub)sub.textContent=item.arquivo_nome+" · "+rotuloSituacao(item.status)+" · "+(item.total_linhas||0).toLocaleString("pt-BR")+" localidades · "+formatoData(item.finalizado_em||item.criado_em);
 await consultarDetalheImportacao();
}
async function consultarDetalheImportacao(){
 if(!estado.importacao)return;
 const g=++estado.geracao;
 status("Consultando localidades...",false);
 const area=$("cotHistoricoTabela");
 limpar(area);
 try{
  const rows=await rpc("pmobile_cotacoes_importacao_destinos_v1",{
   ...credenciais(),p_importacao_id:estado.importacao.id,p_busca:estado.busca,
   p_limit:estado.paginaLimite,p_offset:estado.paginaOffset
  });
  if(g!==estado.geracao)return;
  renderTabela(rows);
  status(rows.length?rows.length+" cidade(s) nesta página. Fonte preservada somente para consulta.":"Nenhuma localidade encontrada para este filtro.",false);
 }catch(e){if(g===estado.geracao)status("Não foi possível consultar localidades: "+(e.message||e),true);}
}
function renderTabela(rows){
 const area=$("cotHistoricoTabela");
 limpar(area);
 if(!area)return;
 if(rows.length){
  const tabela=document.createElement("table");
  tabela.className="cot-importacao-tabela";
  const cab=document.createElement("thead");
  const tr=document.createElement("tr");
  for(const col of ["UF","Destino","TDA"]){tr.appendChild(textoElemento("th",col));}
  cab.appendChild(tr);tabela.appendChild(cab);
  const corpo=document.createElement("tbody");
  for(const linha of rows){
   const r=document.createElement("tr");
   for(const v of [linha.uf,linha.destino,linha.tda]){
    r.appendChild(textoElemento("td",v));
   }
   corpo.appendChild(r);
  }
  tabela.appendChild(corpo);area.appendChild(tabela);
 }else area.appendChild(textoElemento("p","Nenhuma cidade nesta página.","cot-empty"));
 const anterior=$("cotHistoricoDestinosAnterior"),proximo=$("cotHistoricoDestinosProximo");
 if(anterior)anterior.disabled=estado.paginaOffset===0;
 if(proximo)proximo.disabled=rows.length<estado.paginaLimite;
 const indice=$("cotHistoricoPaginaDestino");
 if(indice)indice.textContent="Página "+(Math.floor(estado.paginaOffset/estado.paginaLimite)+1);
}
function voltarListaImportacoes(){
 ++estado.geracao;estado.importacao=null;estado.paginaOffset=0;estado.busca="";
 mostrarPainelDetalhe(false);
 status("Selecione uma transportadora para consultar as cidades e versões anteriores.",false);
}
function buscarDestinosImportados(){
 if(!estado.importacao)return;
 estado.busca=normal($("cotHistoricoBusca")?.value);
 estado.paginaOffset=0;
 consultarDetalheImportacao();
}
function paginaDestinosImportados(sentido){
 if(!estado.importacao)return;
 estado.paginaOffset=Math.max(0,estado.paginaOffset+sentido*estado.paginaLimite);
 consultarDetalheImportacao();
}
document.addEventListener("click",e=>{
 const b=e.target.closest("[data-cot-importacao-id]");
 if(b)abrirDetalheImportacao(b.dataset.cotImportacaoId);
});
window.addEventListener("pmobile:cotacoes-atualizadas",()=>{
 const tela=$("cotacoesImportadas");
 if(tela&&getComputedStyle(tela).display!=="none")carregarHistoricoCotacoes();
});
window.abrirHistoricoCotacoes=abrirHistoricoCotacoes;
window.carregarHistoricoCotacoes=carregarHistoricoCotacoes;
window.mudarPaginaHistorico=mudarPaginaHistorico;
window.voltarListaImportacoes=voltarListaImportacoes;
window.buscarDestinosImportados=buscarDestinosImportados;
window.paginaDestinosImportados=paginaDestinosImportados;
})();