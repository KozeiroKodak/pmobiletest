/* PMobile — Cotações por Região; consulta somente leitura. */
(function(){
"use strict";
let mapa = new Map();
let regiaoAtual = "";
const $ = id => document.getElementById(id);
const normal = v => String(v == null ? "" : v).trim().replace(/\s+/g," ");
const chave = v => normal(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR");
const html = v => normal(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function abrirOpcoesCotacoes(){mostrarTelaSistema("opcoesCotacoes","menuOpcoesCotacoes");}
function abrirCotacoesRegiao(){mostrarTelaSistema("cotacoesRegiao","menuOpcoesCotacoes");$("cotBusca").value="";carregarCotacoesRegiao();}
function voltarOpcoesCotacoes(){mostrarTelaSistema("opcoesCotacoes","menuOpcoesCotacoes");}
function voltarListaCotacoes(){mostrarTelaSistema("cotacoesRegiao","menuOpcoesCotacoes");}
function renderRegioes(){
 const termo=chave($("cotBusca").value);
 const lista=[...mapa.values()].filter(x=>chave(x.nome).includes(termo)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
 $("cotLista").innerHTML=lista.length?lista.map(x=>'<button type="button" class="cot-row" data-cot-regiao="'+html(chave(x.nome))+'"><span>📍 '+html(x.nome)+'</span><small>'+x.transportadoras.size+' transportadora(s) ›</small></button>').join(""):'<div class="cot-empty">Nenhuma região encontrada.</div>';
}
function abrirDetalheCotacao(ch){
 const item=mapa.get(ch);if(!item)return;
 regiaoAtual=ch;$("cotDetalheTitulo").textContent=item.nome;
 const nomes=[...item.transportadoras.values()].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 $("cotDetalheStatus").textContent=nomes.length+' transportadora(s) identificada(s) nos rastreios sincronizados.';
 $("cotDetalheLista").innerHTML=nomes.length?nomes.map(n=>'<div class="cot-row"><span>🚛 '+html(n)+'</span><small>Atende esta região</small></div>').join(""):'<div class="cot-empty">Nenhuma transportadora identificada para esta região nos registros disponíveis.</div>';
 mostrarTelaSistema("cotacoesDetalhe","menuOpcoesCotacoes");
}
async function carregarCotacoesRegiao(){
 const status=$("cotStatus");status.textContent="Consultando registros sincronizados...";
 try{
  const usuario=window.usuarioPmobileAtual, credencial=window.credencialPmobileAtual;
  if(!usuario?.usuario||!credencial)throw Error("Faça login para consultar as cotações.");
  if(!window.clienteSupabase?.rpc)throw Error("Conexão com Supabase indisponível.");
  const novo=new Map();let total=0;const limite=500;
  for(let offset=0;offset<100000;offset+=limite){
   const {data,error}=await window.clienteSupabase.rpc("pmobile_rastreio_listar_v3",{p_usuario:usuario.usuario,p_credencial:credencial,p_limit:limite,p_offset:offset});
   if(error)throw error;
   const pagina=Array.isArray(data)?data:[];
   for(const row of pagina){
    const regiao=normal(row.regiao),transportadora=normal(row.transportadora);
    if(!regiao||/^TOTAL(?:\s*GERAL)?$/i.test(regiao))continue;
    const id=chave(regiao);if(!novo.has(id))novo.set(id,{nome:regiao,transportadoras:new Map()});
    if(transportadora&&!/^TOTAL(?:\s*GERAL)?$/i.test(transportadora)&&!/^[-–—]+$/.test(transportadora))novo.get(id).transportadoras.set(chave(transportadora),transportadora);
   }
   total+=pagina.length;
   if(pagina.length<limite)break;
  }
  mapa=novo;status.textContent=mapa.size+' região(ões) encontrada(s) em '+total.toLocaleString("pt-BR")+' registro(s).';
  renderRegioes();
 }catch(e){console.error("Cotações por região:",e);status.textContent="Não foi possível consultar: "+(e.message||e);$("cotLista").innerHTML="";}
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-cot-regiao]");if(b)abrirDetalheCotacao(b.dataset.cotRegiao);});
document.addEventListener("input",e=>{if(e.target?.id==="cotBusca")renderRegioes();});
window.abrirOpcoesCotacoes=abrirOpcoesCotacoes;window.abrirCotacoesRegiao=abrirCotacoesRegiao;window.voltarOpcoesCotacoes=voltarOpcoesCotacoes;window.voltarListaCotacoes=voltarListaCotacoes;
})();