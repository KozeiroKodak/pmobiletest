/* PMobile — Cotações por Região; consulta somente leitura. */
(function(){
"use strict";
let mapa = new Map();
let regiaoAtual = "";
let ultimaConsulta = 0;
let consultaAtual = null;
const $ = id => document.getElementById(id);
const normal = v => String(v == null ? "" : v).trim().replace(/\s+/g," ");
const chave = v => normal(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR");
const html = v => normal(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function abrirOpcoesCotacoes(){mostrarTelaSistema("opcoesCotacoes","menuTransportes");}
function abrirCotacoesRegiao(){mostrarTelaSistema("cotacoesRegiao","menuTransportes");$("cotBusca").value="";if(mapa.size){renderRegioes();if(Date.now()-ultimaConsulta<30000)return;}carregarCotacoesRegiao();}
function voltarOpcoesCotacoes(){mostrarTelaSistema("opcoesCotacoes","menuTransportes");}
function voltarListaCotacoes(){mostrarTelaSistema("cotacoesRegiao","menuTransportes");}
function renderRegioes(){
 const termo=chave($("cotBusca").value);
 const lista=[...mapa.values()].filter(x=>chave(x.nome).includes(termo)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
 $("cotLista").innerHTML=lista.length?lista.map(x=>'<button type="button" class="cot-row" data-cot-regiao="'+html(chave(x.nome))+'"><span>📍 '+html(x.nome)+'</span><small>'+x.transportadoras.size+' transportadora(s) ›</small></button>').join(""):'<div class="cot-empty">Nenhuma região encontrada.</div>';
}
function abrirDetalheCotacao(ch){
 const item=mapa.get(ch);if(!item)return;
 regiaoAtual=ch;$("cotDetalheTitulo").textContent=item.nome;
 const nomes=[...item.transportadoras.values()].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
 $("cotDetalheStatus").textContent=nomes.length+' transportadora(s) identificada(s) nos registros disponíveis.';
 $("cotDetalheLista").innerHTML=nomes.length?nomes.map(n=>'<div class="cot-row"><span>🚛 '+html(n.nome)+'</span><small>'+(n.origem==="planilha"?(n.tda?"TDA: "+html(n.tda):"TDA não informada"):"Atende esta região")+'</small></div>').join(""):'<div class="cot-empty">Nenhuma transportadora identificada para esta região nos registros disponíveis.</div>';
 mostrarTelaSistema("cotacoesDetalhe","menuTransportes");
}
async function carregarCotacoesRegiao(){
 if(consultaAtual)return consultaAtual;
 consultaAtual = executarConsultaCotacoes();
 try{await consultaAtual;}finally{consultaAtual=null;}
}
async function executarConsultaCotacoes(){
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
    if(transportadora&&!/^TOTAL(?:\s*GERAL)?$/i.test(transportadora)&&!/^[-–—]+$/.test(transportadora))novo.get(id).transportadoras.set(chave(transportadora),{nome:transportadora,tda:"",origem:"rastreio"});
   }
   total+=pagina.length;
   if(!mapa.size && total===pagina.length){mapa=novo;renderRegioes();}
   if(total%2000===0){mapa=novo;renderRegioes();status.textContent="Carregando regiões: "+total.toLocaleString("pt-BR")+" registros...";}
   if(pagina.length<limite)break;
  }
  // Dados de planilhas ficam isolados do Rastreio; falha nesta consulta não apaga a lista legada.
  let totalImportados=0,avisoImportados="";
  try{
   for(let offset=0;offset<200000;offset+=limite){
    const {data,error}=await window.clienteSupabase.rpc("pmobile_cotacoes_listar_v1",{
     p_usuario:usuario.usuario,p_credencial:credencial,p_limit:limite,p_offset:offset
    });
    if(error)throw error;
    const pagina=Array.isArray(data)?data:[];
    for(const row of pagina){
     const uf=normal(row.uf),destino=normal(row.destino),transportadora=normal(row.transportadora);
     if(!/^[A-Z]{2}$/.test(uf)||!destino||!transportadora)continue;
     const nome=destino+" / "+uf,id=chave(nome);
     if(!novo.has(id))novo.set(id,{nome,transportadoras:new Map()});
     novo.get(id).transportadoras.set(chave(transportadora),{nome:transportadora,tda:normal(row.tda),origem:"planilha"});
    }
    totalImportados+=pagina.length;
    if(pagina.length<limite)break;
   }
  }catch(erro){avisoImportados=" (planilhas indisponíveis)";console.warn("Consulta de planilhas de cotações:",erro);}
  mapa=novo;ultimaConsulta=Date.now();status.textContent=mapa.size+' região(ões)/destino(s) encontrados em '+total.toLocaleString("pt-BR")+' registros de rastreio e '+totalImportados.toLocaleString("pt-BR")+' localidades importadas'+avisoImportados+'.';
  renderRegioes();
 }catch(e){console.error("Cotações por região:",e);status.textContent="Não foi possível atualizar: "+(e.message||e);if(!mapa.size)$("cotLista").innerHTML="";}
}
// Se o Android publicar nova planilha no Supabase, invalidar o cache
// de cotações do PC. Não alterar o Rastreio nem criar consultas duplicadas.
["pmobile:rastreio-atualizado","pmobile:cotacoes-atualizadas"].forEach(evento=>window.addEventListener(evento,()=>{
 mapa=new Map();
 ultimaConsulta=0;
 const lista=$("cotacoesRegiao"),detalhe=$("cotacoesDetalhe");
 const visivel=el=>!!el&&getComputedStyle(el).display!=="none"&&el.getClientRects().length>0;
 if(visivel(lista)||visivel(detalhe))carregarCotacoesRegiao();
}));
document.addEventListener("click",e=>{const b=e.target.closest("[data-cot-regiao]");if(b)abrirDetalheCotacao(b.dataset.cotRegiao);});
document.addEventListener("input",e=>{if(e.target?.id==="cotBusca")renderRegioes();});
window.abrirOpcoesCotacoes=abrirOpcoesCotacoes;window.abrirCotacoesRegiao=abrirCotacoesRegiao;window.voltarOpcoesCotacoes=voltarOpcoesCotacoes;window.voltarListaCotacoes=voltarListaCotacoes;
window.PMobileModulos?.registrarAcao("cotacoes",abrirOpcoesCotacoes);
})();
