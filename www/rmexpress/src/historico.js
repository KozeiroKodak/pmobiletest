import { listarHistoricoEntregas, resumirHistoricoEntregas } from "./api.js";

const $ = id => document.getElementById(id);
const ESC = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>ESC[c]);
const inteiro = value => Number(value || 0).toLocaleString("pt-BR");
const LIMITE=40;

function dataBR(value){
  if(!value)return "Data não informada";
  const d=new Date(value);
  return Number.isNaN(d.valueOf()) ? "Data não informada"
    : d.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"});
}

export function iniciarHistoricoGerencia({obterSessao}){
  let resumos=[];
  let registros=[];
  let mais=false;
  let token=0;
  let carregando=false;

  function aviso(texto,erro=false){
    const el=$("statusHistorico");
    el.textContent=texto;
    el.classList.toggle("erro",erro);
  }

  function limpar(){
    token++;
    resumos=[];
    registros=[];
    mais=false;
    carregando=false;
    $("historicoTotalNotas").textContent="—";
    $("historicoTotalRegistros").textContent="—";
    $("historicoTotalMotoristas").textContent="—";
    $("motoristasHistorico").replaceChildren();
    $("listaHistorico").replaceChildren();
    $("filtroHistoricoMotorista").replaceChildren(new Option("Todos os motoristas",""));
    $("buscaHistorico").value="";
    $("carregarMaisHistorico").hidden=true;
    $("atualizarHistorico").disabled=false;
    aviso("");
  }

  function renderResumo(){
    $("historicoTotalNotas").textContent=inteiro(resumos.reduce((s,x)=>s+Number(x.total_notas||0),0));
    $("historicoTotalRegistros").textContent=inteiro(resumos.reduce((s,x)=>s+Number(x.total_registros||0),0));
    $("historicoTotalMotoristas").textContent=inteiro(resumos.filter(x=>Number(x.total_notas)>0).length);
    const cards=$("motoristasHistorico");
    cards.innerHTML=resumos.length?resumos.map(m=>`
      <article class="historico-motorista">
        <div class="historico-motorista-top">
          <strong>${escape(m.motorista_nome||"Motorista")}</strong>
          <span>${inteiro(m.total_notas)} NF(s)</span>
        </div>
        <small>${inteiro(m.total_registros)} registro(s) de entrega</small>
        <button type="button" class="btn btn-secondary" data-filtrar-historico="${escape(m.motorista_usuario_id)}">Ver notas</button>
      </article>`).join(""):'<div class="empty">Nenhum motorista cadastrado para o histórico.</div>';
    const seletor=$("filtroHistoricoMotorista");
    const anterior=seletor.value;
    seletor.replaceChildren(new Option("Todos os motoristas",""),...resumos.map(m=>new Option(m.motorista_nome||"Motorista",String(m.motorista_usuario_id))));
    if(Array.from(seletor.options).some(o=>o.value===anterior))seletor.value=anterior;
  }

  function renderLista(){
    $("listaHistorico").innerHTML=registros.length ? registros.map(item=>`
      <article class="historico-nota">
        <div class="delivery-head">
          <div><small>NF ${escape(item.numero_nf)}</small><h3>${escape(item.cliente||"Cliente não informado")}</h3></div>
          <span class="status-chip status-entregue">Entregue</span>
        </div>
        <div class="historico-meta">
          <span>Motorista: <strong>${escape(item.motorista_nome)}</strong></span>
          <span>Concluída: <strong>${escape(dataBR(item.entregue_em))}</strong></span>
          <span>Região: <strong>${escape(item.regiao||"Não informada")}</strong></span>
        </div>
      </article>`).join("")
      : '<div class="empty"><strong>Nenhuma NF entregue encontrada</strong><p>As primeiras entregas confirmadas pelos motoristas aparecerão automaticamente aqui.</p></div>';
    $("carregarMaisHistorico").hidden=!mais;
    $("carregarMaisHistorico").disabled=carregando;
  }

  async function carregarLista(reiniciar=true){
    const sessao=obterSessao();
    if(!sessao)return;
    if(carregando && !reiniciar)return;
    const chamada=++token;
    if(reiniciar){registros=[];mais=false;renderLista();}
    carregando=true;
    $("atualizarHistorico").disabled=true;
    $("carregarMaisHistorico").disabled=true;
    aviso("Consultando histórico de entregas...");
    try{
      const selecionado=$("filtroHistoricoMotorista").value;
      const resultados=await listarHistoricoEntregas(
        sessao,selecionado||null,$("buscaHistorico").value,registros.length,LIMITE
      );
      if(chamada!==token||obterSessao()!==sessao)return;
      if(!Array.isArray(resultados))throw new Error("Resposta inválida do histórico.");
      const ids=new Set(registros.map(x=>x.id));
      registros=[...registros,...resultados.filter(x=>x.id&&!ids.has(x.id))];
      mais=resultados.length===LIMITE;
      aviso(registros.length+" NF(s) exibida(s). Histórico atualizado diretamente do Supabase.");
    }catch(erro){
      if(chamada===token)aviso("Falha na consulta do histórico: "+(erro.message||"Verifique sua conexão."),true);
    }finally{
      if(chamada===token){
        carregando=false;
        $("atualizarHistorico").disabled=false;
        renderLista();
      }
    }
  }

  async function carregar(){
    const sessao=obterSessao();
    if(!sessao)return;
    const chamada=++token;
    $("atualizarHistorico").disabled=true;
    aviso("Carregando totais por motorista...");
    try{
      const resultado=await resumirHistoricoEntregas(sessao);
      if(chamada!==token||obterSessao()!==sessao)return;
      if(!Array.isArray(resultado))throw new Error("Resposta inválida dos totais.");
      resumos=resultado;
      renderResumo();
      await carregarLista(true);
    }catch(erro){
      if(chamada===token){
        $("atualizarHistorico").disabled=false;
        aviso("Não foi possível carregar os contadores: "+(erro.message||"Verifique sua conexão."),true);
      }
    }
  }

  $("atualizarHistorico").addEventListener("click",carregar);
  $("carregarMaisHistorico").addEventListener("click",()=>carregarLista(false));
  $("filtroHistoricoMotorista").addEventListener("change",()=>carregarLista(true));
  let buscaTimer;
  $("buscaHistorico").addEventListener("input",()=>{
    clearTimeout(buscaTimer);
    buscaTimer=setTimeout(()=>carregarLista(true),400);
  });
  $("motoristasHistorico").addEventListener("click",e=>{
    const btn=e.target.closest("button[data-filtrar-historico]");
    if(!btn)return;
    $("filtroHistoricoMotorista").value=btn.dataset.filtrarHistorico;
    carregarLista(true);
  });
  limpar();
  return {carregar,limpar};
}
