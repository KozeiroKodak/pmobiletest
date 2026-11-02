// Jornada real do usuário RMMOTORISTAS. Usa RPCs oficiais do banco compartilhado.
// Nenhum cache de entregas/senhas em localStorage e nenhuma alteração offline.
import { listarEntregasMotorista, confirmarRotaMotorista, confirmarEntregaMotorista, listarDestinos } from "./api.js";
import {enderecoValido,coordenadaValida,urlNavegacao,sugerirSequencia} from "./rota.js";
import {salvarCacheMotorista,lerCacheMotorista} from "./offline.js";
import { CATEGORIAS_NF, contarCategorias, filtrarCategoria } from "./prioridade.js";

const $ = id => document.getElementById(id);
const limparHtml = valor => String(valor ?? "").replace(/[&<>"']/g,
  char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const formatar = numero => numero == null || numero === "" || !Number.isFinite(Number(numero))
  ? "—" : Number(numero).toLocaleString("pt-BR",{maximumFractionDigits:2});

export function ordenarEntregasMotorista(itens) {
  if (!Array.isArray(itens)) throw new TypeError("Lista de entregas inválida");
  return [...itens].sort((a,b)=>{
    if (Boolean(a.entregue)!==Boolean(b.entregue)) return a.entregue ? 1:-1;
    const oa=Number.isInteger(a.rota_ordem)&&a.rota_ordem>0?a.rota_ordem:999999;
    const ob=Number.isInteger(b.rota_ordem)&&b.rota_ordem>0?b.rota_ordem:999999;
    return oa-ob;
  });
}
export function resumoMotorista(itens) {
  const registros=itens.length;
  const concluidos=itens.filter(x=>x.entregue===true).length;
  return {registros,abertos:registros-concluidos,concluidos};
}
// Preserves the current/manual route order and grouped NFs.
export function proximaParadaMotorista(itens,destinos=new Map()) {
  const item=itens.find(x=>!x.entregue);
  if(!item)return null;
  const destino=destinos.get(item.id);
  return {item,destino,navegavel:enderecoValido(destino)};
}
export function roteiroPodeSerConfirmado(itens) {
  const abertos=itens.filter(x=>!x.entregue);
  return abertos.length>0 && abertos.some(x=>!x.rota_confirmada);
}
export function moverRoteiro(itens,id,direcao) {
  if (!["subir","descer"].includes(direcao)) throw new Error("Direção inválida");
  const abertos=itens.filter(x=>!x.entregue);
  const i=abertos.findIndex(x=>String(x.id)===String(id));
  if(i<0)throw new Error("Parada não encontrada");
  if(abertos.some(x=>x.rota_confirmada))throw new Error("Roteiro já confirmado.");
  const j=i+(direcao==="subir"?-1:1);
  const alterados=[...abertos];
  if(j>=0&&j<alterados.length) [alterados[i],alterados[j]]=[alterados[j],alterados[i]];
  return [...alterados,...itens.filter(x=>x.entregue)];
}

export function iniciarMotorista(){
  let sessao=null;
  let entregas=[];
  let carregando=false;
  let operando=false;
  let versao=0;
  let destinos=new Map();
  let dadosCache=false;
  let atualizadoEm=null;
  let categoriaAtiva="todas";
  const perfilAtivo=()=>Boolean(sessao && sessao.nivel==="RMMOTORISTAS");

  function status(texto,erro=false){
    for(const id of ["statusMotoristaReal","statusRoteiroMotorista"]){
      const no=$(id);if(!no)continue;
      no.textContent=texto;
      no.classList.toggle("erro",erro);
    }
  }
  function selecionarCategoria(id){
    if(!CATEGORIAS_NF.some(c=>c.id===id))return;
    categoriaAtiva=id;
    document.querySelectorAll("[data-motorista-categoria]").forEach(botao=>{
      const ativo=botao.dataset.motoristaCategoria===id;
      botao.classList.toggle("active",ativo);
      botao.setAttribute("aria-pressed",String(ativo));
    });
  }
  function atualizarCategorias(){
    const contagem=contarCategorias(entregas);
    document.querySelectorAll("[data-motorista-count]").forEach(el=>{
      el.textContent=(contagem[el.dataset.motoristaCount]||0).toLocaleString("pt-BR");
    });
  }
  function mostrarControles(){
    const ativo=perfilAtivo();
    $("atualizarMotorista").hidden=!ativo;
    $("painelCategoriasMotorista").hidden=!ativo;
    $("roteiroAcoesMotorista").hidden=!ativo;
    $("botaoConfirmarRoteiro").hidden=!ativo || !roteiroPodeSerConfirmado(entregas);
    $("botaoConfirmarRoteiro").disabled=carregando||operando||!navigator.onLine||dadosCache;
    $("proximaNavegar").disabled=!proximaParadaMotorista(entregas,destinos)?.navegavel||carregando||operando;
  }
  function desenharResumo(){
    const r=resumoMotorista(entregas);
    $("metricaTotal").textContent=String(r.registros);
    $("metricaAbertas").textContent=String(r.abertos);
    $("metricaConcluidas").textContent=String(r.concluidos);
    $("legendaJornada").textContent=dadosCache?"Cache local · Somente consulta":"Supabase · Registros reais";
    const pct=r.registros?Math.round(100*r.concluidos/r.registros):0;
    $("progressoTexto").textContent=pct+"% concluído";
    $("progressoPreenchimento").style.width=pct+"%";
    $("progressoBarra").setAttribute("aria-valuenow",String(pct));
    $("view-painel").querySelectorAll(".metric small")[0].textContent="Registros vinculados";
    const parada=proximaParadaMotorista(entregas,destinos);
    const proxima=parada?.item;
    $("proximaDescricao").textContent=proxima
      ? (proxima.cliente||"Cliente não informado")+" · NF "+(proxima.notas_fiscais||"—")+" · "+(proxima.regiao||"Destino não informado")
      : r.registros ? "Todas as suas entregas foram concluídas!" : "Nenhuma entrega atribuída a esta conta.";
    $("proximaAcoes").hidden=!proxima;
    $("proximaDestino").hidden=!proxima;
    $("proximaDestino").textContent=proxima ? parada.navegavel
      ? parada.destino.endereco : "Endereço ainda não conferido pela Gerência. A navegação será liberada após a conferência." : "";
    $("proximaSituacao").hidden=!proxima;
    $("proximaSituacao").textContent=proxima ? proxima.rota_confirmada ? "Roteiro confirmado" : "Revise e confirme o roteiro antes de concluir entregas" : "";
    $("proximaCarga").hidden=!proxima;
    $("proximaCarga").textContent=proxima ? formatar(proxima.volume)+" volumes · "+formatar(proxima.peso)+" kg · Turno "+(proxima.turno||"—") : "";
    $("proximaNavegar").disabled=!parada?.navegavel||carregando||operando;
    $("motoristaSincronizacao").hidden=!atualizadoEm;
    $("motoristaSincronizacao").textContent=atualizadoEm
      ? (dadosCache?"Consulta offline · Dados de ":"Última consulta ao servidor: ")+new Date(atualizadoEm).toLocaleString("pt-BR") : "";
    $("resumoOcorrencias").textContent="Dados do Supabase: "+r.abertos+" registro(s) aberto(s) e "+r.concluidos+" concluído(s). Algumas linhas podem agrupar várias NFs.";
  }
  function cartao(item){
    const id=limparHtml(item.id);
    const entregue=item.entregue===true;
    const rota=item.rota_confirmada===true;
    const badge=entregue?"Entregue":rota?"Roteiro confirmado":"Pendente";
    const destino=destinos.get(item.id);
    const nav=enderecoValido(destino)?'<button type="button" class="btn btn-secondary" data-navegar="'+id+'">Abrir Google Maps</button>':'';
    const cls=entregue?"entregue":rota?"em_rota":"pendente";
    return `<article class="delivery-card">
      <div class="delivery-head"><div><small>NF ${limparHtml(item.notas_fiscais||"—")}</small>
        <h3>${limparHtml(item.cliente||"Cliente não informado")}</h3></div>
        <span class="status-chip status-${cls}">${badge}</span></div>
      <p class="destination">⌖ ${limparHtml(item.regiao||"Região não informada")}</p>
      <div class="delivery-meta"><span>${formatar(item.volume)} volumes</span>
        <span>${formatar(item.peso)} kg</span>
        <span>Turno: ${limparHtml(item.turno||"—")}</span></div>
      <div class="delivery-actions">
      ${nav}
      ${!entregue && rota && !dadosCache ? `<button class="btn btn-primary" data-confirmar-entrega="${id}" type="button">Confirmar entrega real</button>` :
        entregue?'<span class="muted">Concluída no Supabase</span>':
        '<span class="muted">Confirme o roteiro antes de concluir a entrega.</span>'}
      </div>
    </article>`;
  }
  function desenharEntregas(){
    const termo=$("buscaEntregas").value.trim().toLocaleLowerCase("pt-BR");
    const filtro=$("filtroStatus").value;
    const categoriaAtual=filtrarCategoria(entregas,categoriaAtiva);
    const visiveis=categoriaAtual.filter(item=>{
      const busca=[item.notas_fiscais,item.cliente,item.regiao].some(x=>String(x??"").toLocaleLowerCase("pt-BR").includes(termo));
      const s=item.entregue?"entregue":item.rota_confirmada?"em_rota":"pendente";
      return busca && (filtro==="todas"||filtro===s);
    });
    $("quantidadeEntregas").textContent=visiveis.length+" visível(is) · "+categoriaAtual.length+" na categoria · "+entregas.length+" atribuídos";
    $("listaEntregas").innerHTML=visiveis.length?visiveis.map(cartao).join("") :
      '<div class="empty"><strong>Nenhuma entrega encontrada</strong><p>Verifique os filtros ou atualize os registros atribuídos.</p></div>';
  }
  function desenharRoteiro(){
    const abertos=entregas.filter(x=>!x.entregue);
    const travado=abertos.some(x=>x.rota_confirmada);
    $("quantidadeRoteiros").textContent=abertos.length+" paradas em aberto";
    $("listaRoteiros").innerHTML=abertos.length?abertos.map((item,index)=>`
      <li class="route-card">
        <div class="route-number">${index+1}</div>
        <div class="route-details">
          <strong>${limparHtml(item.cliente||"Cliente não informado")}</strong>
          <span>NF ${limparHtml(item.notas_fiscais||"—")} · ${limparHtml(item.regiao||"—")}</span>
          <small>${item.rota_confirmada?"Roteiro confirmado":"Aguardando confirmação"}</small>
          <small>${enderecoValido(destinos.get(item.id))?limparHtml(destinos.get(item.id).endereco):"Sem endereço conferido"}</small>
          <div class="route-navegar">${enderecoValido(destinos.get(item.id))?'<button type="button" class="btn btn-secondary" data-navegar="'+limparHtml(item.id)+'">Navegar</button>':""}</div>
        </div>
        <div class="route-controls">
          <button type="button" title="Subir" aria-label="Subir parada" data-roteiro-mover="subir" data-rota-id="${limparHtml(item.id)}" ${travado||index===0?"disabled":""}>↑</button>
          <button type="button" title="Descer" aria-label="Descer parada" data-roteiro-mover="descer" data-rota-id="${limparHtml(item.id)}" ${travado||index===abertos.length-1?"disabled":""}>↓</button>
        </div>
      </li>`).join("") :
      '<li class="empty">Nenhuma parada em aberto. Confira a aba Entregas.</li>';
    $("botaoConfirmarRoteiro").hidden=!roteiroPodeSerConfirmado(entregas);
    $("botaoConfirmarRoteiro").disabled=carregando||operando||!navigator.onLine||dadosCache;
  }
  function desenhar(){
    if(!perfilAtivo())return;
    mostrarControles();
    atualizarCategorias();
    desenharResumo();
    desenharEntregas();
    desenharRoteiro();
    $("routeDescricaoMotorista").textContent=dadosCache
      ? "MODO OFFLINE: consulta de cache criptografado. Confirmações bloqueadas até nova sincronização."
      : "Ordem manual ou sugestão aproximada (em linha reta), somente com coordenadas verificadas. Depois confirme o roteiro real no servidor.";
    $("botaoSugerirRota").hidden=false;
    $("botaoSugerirRota").disabled=dadosCache||!navigator.onLine||operando||carregando||!abertosParaSugestao();

  }
  function sair(){
    versao++;
    sessao=null;
    entregas=[];
    destinos=new Map();
    dadosCache=false;
    atualizadoEm=null;
    for(const id of ["proximaAcoes","proximaDestino","proximaSituacao","proximaCarga","motoristaSincronizacao"])$(id).hidden=true;
    selecionarCategoria("todas");
    atualizarCategorias();
    carregando=false;
    operando=false;
    $("atualizarMotorista").hidden=true;
    $("painelCategoriasMotorista").hidden=true;
    $("roteiroAcoesMotorista").hidden=true;
    status("");
  }
  async function carregar(){
    if(!perfilAtivo()||carregando||operando)return;
    const usuarioAtual=sessao;
    const id=++versao;
    carregando=true;
    status("Consultando as suas NFs no Supabase...");
    mostrarControles();
    try{
      const resultado=await listarEntregasMotorista(usuarioAtual);
      if(id!==versao||sessao!==usuarioAtual)return;
      if(!Array.isArray(resultado))throw new Error("O servidor retornou dados inesperados.");
      let novosDestinos=new Map();
      try{
        const dest=await listarDestinos(usuarioAtual);
        if(Array.isArray(dest))novosDestinos=new Map(dest.map(x=>[x.rastreio_id,x]));
      }catch{/* A destination lookup failure must not reuse a previous destination. */}
      if(id!==versao||sessao!==usuarioAtual)return;
      entregas=ordenarEntregasMotorista(resultado);
      destinos=novosDestinos;
      dadosCache=false;
      atualizadoEm=new Date().toISOString();
      await salvarCacheMotorista(usuarioAtual,entregas,[...destinos.values()]);
      if(id!==versao||sessao!==usuarioAtual)return;
      desenhar();
      status(resultado.length+" registro(s) atribuídos a esta conta. Atualizado do Supabase.");
    }catch(erro){
      if(id!==versao||sessao!==usuarioAtual)return;
      const cache=await lerCacheMotorista(usuarioAtual);
      if(id!==versao||sessao!==usuarioAtual)return;
      if(cache){
        entregas=ordenarEntregasMotorista(cache.registros);
        destinos=new Map((cache.destinos||[]).map(x=>[x.rastreio_id,x]));
        dadosCache=true;
        atualizadoEm=Number.isFinite(Date.parse(cache.salvoEm))?cache.salvoEm:null;
        desenhar();
        status("OFFLINE · Últimos dados: "+new Date(cache.salvoEm).toLocaleString("pt-BR")+". Nenhuma operação real habilitada.",true);
      }else{
        entregas=[];destinos=new Map();atualizadoEm=null;desenhar();
        status("Falha na consulta, sem cache disponível: "+(erro.message||"Tente novamente."),true);
      }
    }finally{
      if(id===versao){carregando=false;mostrarControles();}
    }
  }
  async function entrar(novaSessao){
    sair();
    if(!novaSessao || novaSessao.nivel!=="RMMOTORISTAS")return;
    sessao=novaSessao;
    desenhar();
    return carregar();
  }
  function abertosParaSugestao(){
    const abertos=entregas.filter(x=>!x.entregue);
    return abertos.length>1&&!abertos.some(x=>x.rota_confirmada)&&
      abertos.every(x=>coordenadaValida(destinos.get(x.id)));
  }
  async function sugerir(){
    if(!perfilAtivo()||operando||dadosCache||!abertosParaSugestao())return;
    if(!navigator.geolocation)return status("Localização indisponível neste dispositivo.",true);
    status("Solicitando sua localização para calcular uma sugestão aproximada...");
    try{
      const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,
        {enableHighAccuracy:false,maximumAge:30000,timeout:12000}));
      if(!perfilAtivo())return;
      const origem={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
      const abertos=entregas.filter(x=>!x.entregue).map(x=>({...x,...destinos.get(x.id)}));
      const ids=sugerirSequencia(abertos,origem).map(x=>x.id);
      const confirmadas=entregas.filter(x=>x.entregue);
      entregas=[...ids.map(id=>entregas.find(e=>e.id===id)),...confirmadas];
      desenhar();
      status("Sugestão por distância em linha reta aplicada só localmente. Confira a ordem; não calcula ruas, tráfego ou tempo.");
    }catch(e){status("Não foi possível sugerir a rota: "+(e.message||"localização não autorizada."),true);}
  }
  function navegar(id){
    if(!perfilAtivo())return;
    try{
      const url=urlNavegacao(destinos.get(id));
      window.open(url,"_blank","noopener,noreferrer");
    }catch(e){status(e.message,true);}
  }
  function reordenar(id,direcao){
    if(!perfilAtivo()||operando||dadosCache)return;
    try{
      entregas=moverRoteiro(entregas,id,direcao);
      desenhar();
      status("Ordem alterada apenas nesta tela. Toque em Confirmar roteiro para salvar no Supabase.");
    }catch(erro){status(erro.message||"Não foi possível reordenar.",true);}
  }
  async function confirmarRota(){
    if(!perfilAtivo()||carregando||operando||!navigator.onLine||dadosCache)return;
    if(!roteiroPodeSerConfirmado(entregas))return;
    const ordens=entregas.filter(x=>!x.entregue).map((item,i)=>({id:item.id,ordem:i+1}));
    if(!window.confirm("Confirmar esta sequência de "+ordens.length+" parada(s) no Supabase? Esta ação é REAL."))return;
    const atual=sessao;
    operando=true;mostrarControles();
    try{
      const resposta=await confirmarRotaMotorista(atual,ordens);
      if(resposta!==true)throw new Error("A confirmação do servidor não foi conclusiva.");
      status("Roteiro confirmado. Atualize a lista para conferir as atribuições.");
    }catch(erro){
      status("Confirmação de roteiro não verificada: "+(erro.message||"Consulte novamente."),true);
    }finally{operando=false;if(sessao===atual)await carregar();}
  }
  async function confirmarEntrega(id){
    if(!perfilAtivo()||operando||carregando||!navigator.onLine||dadosCache)return;
    const item=entregas.find(x=>String(x.id)===String(id));
    if(!item||item.entregue||!item.rota_confirmada)return;
    if(!window.confirm("CONFIRMAR ENTREGA REAL: NF "+(item.notas_fiscais||"—")+" para "+(item.cliente||"cliente")+"? Isso atualiza o Rastreio e o histórico."))return;
    const atual=sessao;
    operando=true;mostrarControles();
    try{
      const resposta=await confirmarEntregaMotorista(atual,item.id);
      if(resposta!==true)throw new Error("O servidor não confirmou a entrega.");
      status("Entrega confirmada no servidor. Recarregando suas notas...");
    }catch(erro){
      status("Resultado incerto: "+(erro.message||"Verifique a entrega no servidor."),true);
    }finally{operando=false;if(sessao===atual)await carregar();}
  }
  $("atualizarMotorista").addEventListener("click",carregar);
  $("proximaNavegar").addEventListener("click",()=>{
    if(carregando||operando)return;
    const parada=proximaParadaMotorista(entregas,destinos);
    if(parada?.navegavel)navegar(parada.item.id);
  });
  $("botaoSugerirRota").addEventListener("click",sugerir);
  document.addEventListener("click",e=>{
    const botao=e.target.closest("[data-navegar]");
    if(botao)navegar(botao.dataset.navegar);
  });
  $("categoriasMotorista").addEventListener("click",e=>{
    const botao=e.target.closest("button[data-motorista-categoria]");
    if(!botao||!perfilAtivo())return;
    selecionarCategoria(botao.dataset.motoristaCategoria);
    desenharEntregas();
  });
  $("botaoConfirmarRoteiro").addEventListener("click",confirmarRota);
  $("listaRoteiros").addEventListener("click",evento=>{
    const btn=evento.target.closest("button[data-roteiro-mover]");
    if(btn&&!btn.disabled)reordenar(btn.dataset.rotaId,btn.dataset.roteiroMover);
  });
  $("listaEntregas").addEventListener("click",evento=>{
    const btn=evento.target.closest("button[data-confirmar-entrega]");
    if(btn&&!btn.disabled)confirmarEntrega(btn.dataset.confirmarEntrega);
  });
  $("buscaEntregas").addEventListener("input",()=>{if(perfilAtivo())desenharEntregas();});
  $("filtroStatus").addEventListener("change",()=>{if(perfilAtivo())desenharEntregas();});
  window.addEventListener("online",()=>{if(perfilAtivo())status("Conexão disponível. Toque em Atualizar para consultar o Supabase.");});
  window.addEventListener("offline",()=>{if(perfilAtivo())status("Sem internet: as ações reais estão bloqueadas.",true);});
  sair();
  return {entrar,sair,estaAtivo:perfilAtivo,atualizar:carregar};
}
