import {centralResumo,centralAtribuicoes,transferirMotorista,salvarDestino,listarDestinos} from "./api.js";
import {enderecoValido} from "./rota.js";
const $=id=>document.getElementById(id);
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const inteiro=n=>Number(n||0).toLocaleString("pt-BR");
export function somarCentral(linhas){
 return linhas.reduce((a,m)=>({
  motoristas:a.motoristas+Number(Boolean(m.motorista_ativo)),
  atribuidas:a.atribuidas+Number(m.atribuidas||0),
  pendentes:a.pendentes+Number(m.pendentes||0),
  concluidas:a.concluidas+Number(m.concluidas||0),
  entreguesNF:a.entreguesNF+Number(m.total_notas_entregues||0)
 }),{motoristas:0,atribuidas:0,pendentes:0,concluidas:0,entreguesNF:0});
}
export function progressoAtribuicoes(motorista){
 const total=Math.max(0,Number(motorista.atribuidas)||0);
 const concluidas=Math.max(0,Number(motorista.concluidas)||0);
 return {percentual:total?Math.min(100,Math.round(100*concluidas/total)):0,
  semAtribuicoes:total===0,atencao:!motorista.motorista_ativo&&Number(motorista.pendentes)>0};
}
// These counts describe loaded records, never totals for the whole operation.
export function pendenciasCarregadas(itens,destinos=new Map()){
 const abertas=itens.filter(x=>!x.entregue);
 return {abertas:abertas.length,semDestino:abertas.filter(x=>!enderecoValido(destinos.get(x.rastreio_id))).length,
  aguardandoRoteiro:abertas.filter(x=>!x.rota_confirmada).length};
}
export function iniciarCentral(){
 let sessao=null,linhas=[],atribuicoes=[],destinos=new Map(),mais=false,carregando=false,seq=0,executando=false;
 const ativa=()=>Boolean(sessao&&["ADMIN","RMADMIN"].includes(sessao.nivel));
 function status(m,erro=false){
  $("centralStatus").textContent=m;$("centralStatus").classList.toggle("erro",erro);
 }
 function renderResumo(){
  const soma=somarCentral(linhas);
  for(const [id,k] of [["centralMotoristas","motoristas"],["centralAtribuidas","atribuidas"],
    ["centralPendentes","pendentes"],["centralConcluidas","concluidas"],["centralNFs","entreguesNF"]]){
    $(id).textContent=inteiro(soma[k]);
  }
  $("centralMotoristasLista").innerHTML=linhas.map(m=>{
   const progresso=progressoAtribuicoes(m);
   return '<article class="central-motorista'+(progresso.atencao?' central-atencao':'')+'"><div class="central-motorista-topo"><strong>'+html(m.motorista_nome)+'</strong>'+
   '<span class="central-disponibilidade">'+(m.motorista_ativo?'Ativo':'Inativo')+'</span></div>'+
   '<div class="central-progresso"><span>'+progresso.percentual+'% dos registros concluídos</span><progress max="100" value="'+progresso.percentual+'" aria-label="Progresso das atribuições de '+html(m.motorista_nome)+'"></progress></div>'+
   '<small>'+inteiro(m.pendentes)+' pendente(s) · '+inteiro(m.concluidas)+' concluído(s)</small>'+
   (progresso.atencao?'<p class="central-alerta">Motorista inativo com registros pendentes. Revise a atribuição.</p>':progresso.semAtribuicoes?'<p class="subtle">Sem registros atribuídos.</p>':'')+
   '<button class="btn btn-secondary" data-central-motorista="'+html(m.motorista_id)+'">Ver atribuições</button></article>';
  }).join("")||'<div class="empty">Nenhum motorista cadastrado.</div>';
  const anterior=$("centralFiltroMotorista").value;
  $("centralFiltroMotorista").replaceChildren(new Option("Todos os motoristas",""),
   ...linhas.map(m=>new Option(m.motorista_nome,String(m.motorista_id))));
  $("centralFiltroMotorista").value=Array.from($("centralFiltroMotorista").options).some(x=>x.value===anterior)?anterior:"";
 }
 function renderAtribuicoes(){
  const pendencias=pendenciasCarregadas(atribuicoes,destinos);
  $("centralContexto").textContent=atribuicoes.length+" registros carregados · "+pendencias.abertas+" em aberto · "+pendencias.semDestino+" sem destino conferido · "+pendencias.aguardandoRoteiro+" aguardando confirmação de roteiro.";
  $("centralSincronizacao").textContent="Lista consultada em "+new Date().toLocaleString("pt-BR")+". Os indicadores acima abrangem o resumo da operação.";
  $("centralAtribuicoesLista").innerHTML=atribuicoes.map(item=>{
   const d=destinos.get(item.rastreio_id);
   const locked=item.entregue||item.rota_confirmada;
   const options=linhas.filter(m=>m.motorista_ativo&&String(m.motorista_id)!==String(item.motorista_id))
    .map(m=>'<option value="'+html(m.motorista_id)+'">'+html(m.motorista_nome)+'</option>').join("");
   return '<article class="central-nota">'+
   '<div class="delivery-head"><div><small>NF '+html(item.notas_fiscais||"—")+'</small><h3>'+html(item.cliente||"Cliente não informado")+'</h3></div>'+
   '<span class="status-chip '+(item.entregue?"status-entregue":"status-pendente")+'">'+(item.entregue?"Entregue":item.rota_confirmada?"Em rota":"Pendente")+'</span></div>'+
   '<p class="destination">'+html(item.regiao||"Região não informada")+' · Linha '+html(item.linha_origem||"—")+'</p>'+
   '<p class="subtle">Motorista: <strong>'+html(item.motorista_nome)+'</strong></p>'+
   '<details class="central-edicao"><summary>'+(enderecoValido(d)?'Destino conferido · Revisar detalhes':'Conferir destino')+'</summary><div class="central-controles"><label><span>Endereço confirmado (rua, número, cidade, UF)</span>'+
   '<input type="text" data-endereco="'+html(item.rastreio_id)+'" value="'+html(d?.endereco||"")+'" maxlength="300" placeholder="Confirme o destino completo"></label>'+
   '<div class="central-coords"><label><span>Latitude (opcional, confirmada)</span><input type="number" step="any" min="-90" max="90" data-lat="'+html(item.rastreio_id)+'" value="'+html(d?.latitude??"")+'" placeholder="-30.03"></label>'+
   '<label><span>Longitude (opcional, confirmada)</span><input type="number" step="any" min="-180" max="180" data-lon="'+html(item.rastreio_id)+'" value="'+html(d?.longitude??"")+'" placeholder="-51.22"></label></div>'+
   '<button type="button" class="btn btn-secondary" data-salvar-destino="'+html(item.rastreio_id)+'">Salvar destino</button></div>'+
   (!locked?'<div class="central-controles"><label><span>Transferir antes de iniciar o roteiro</span>'+
   '<select data-novo-motorista="'+html(item.rastreio_id)+'"><option value="">Escolha outro motorista</option>'+options+'</select></label>'+
   '<button type="button" class="btn btn-secondary" data-transferir="'+html(item.rastreio_id)+'" '+(!options?'disabled':'')+'>Transferir</button></div>':
   '<p class="subtle">Transferência bloqueada: roteiro confirmado ou entrega concluída.</p>')+'</details>'+
   '</article>';
  }).join("")||'<div class="empty">Nenhuma atribuição para os filtros selecionados.</div>';
  $("centralCarregarMais").hidden=!mais;
  $("centralCarregarMais").disabled=carregando;
 }
 async function carregarLista(reinicio=true){
  if(!ativa()||executando||carregando&&!reinicio)return;
  const atual=sessao,id=++seq;
  if(reinicio){atribuicoes=[];mais=false;$("centralContexto").textContent="Consultando registros para os filtros selecionados…";$("centralSincronizacao").textContent="";$("centralAtribuicoesLista").innerHTML='<div class="empty">Carregando registros...</div>';}
  carregando=true;status("Consultando atribuições reais...");
  try{
   const filtro=$("centralFiltroMotorista").value;
   const dados=await centralAtribuicoes(atual,filtro||null,$("centralBusca").value,atribuicoes.length);
   if(id!==seq||sessao!==atual)return;
   if(!Array.isArray(dados))throw Error("Resposta inesperada.");
   const conhecidos=new Set(atribuicoes.map(x=>x.rastreio_id));
   atribuicoes.push(...dados.filter(x=>!conhecidos.has(x.rastreio_id)));
   mais=dados.length===60;
   renderAtribuicoes();
   status(atribuicoes.length+" atribuição(ões) carregada(s).");
  }catch(e){if(id===seq)status("Erro ao consultar: "+e.message,true);}
  finally{if(id===seq){carregando=false;$("centralCarregarMais").disabled=false;}}
 }
 async function carregar(){
  if(!ativa())return;
  const atual=sessao,id=++seq;
  status("Atualizando indicadores de produção...");
  try{
   const [resumo,dest]=await Promise.all([centralResumo(atual),listarDestinos(atual)]);
   if(id!==seq||sessao!==atual)return;
   if(!Array.isArray(resumo)||!Array.isArray(dest))throw Error("Resposta inesperada.");
   linhas=resumo;destinos=new Map(dest.map(x=>[x.rastreio_id,x]));
   renderResumo();await carregarLista(true);
  }catch(e){if(id===seq)status("Falha ao carregar Central: "+e.message,true);}
 }
 function sair(){
  seq++;sessao=null;linhas=[];atribuicoes=[];destinos.clear();mais=false;carregando=false;
  $("centralPainelReal").hidden=true;
  $("centralAtribuicoesLista").replaceChildren();$("centralMotoristasLista").replaceChildren();
  $("centralFiltroMotorista").replaceChildren(new Option("Todos os motoristas",""));
  $("centralBusca").value="";
  $("centralContexto").textContent="As pendências serão exibidas após consultar as atribuições.";
  $("centralSincronizacao").textContent="";
  for(const id of ["centralMotoristas","centralAtribuidas","centralPendentes","centralConcluidas","centralNFs"])$(id).textContent="—";
  status("Entre com um usuário ADMIN ou RMADMIN.");
 }
 async function entrar(s){
  sair();if(!s||!["ADMIN","RMADMIN"].includes(s.nivel))return;
  sessao=s;$("centralPainelReal").hidden=false;await carregar();
 }
 async function executarAcao(botao,tipo){
  if(!ativa()||executando||!navigator.onLine)return;
  const id=tipo==="transferir"?botao.dataset.transferir:botao.dataset.salvarDestino;
  const item=atribuicoes.find(x=>x.rastreio_id===id);
  if(!item)return;
  const atual=sessao;
  let chamada;
  if(tipo==="transferir"){
   const novo=botao.closest(".central-nota").querySelector("select[data-novo-motorista]")?.value;
   if(!novo)return status("Selecione outro motorista.",true);
   const nome=linhas.find(x=>String(x.motorista_id)===novo)?.motorista_nome||"";
   if(!window.confirm("Transferir a NF "+item.notas_fiscais+" para "+nome+"? Esta ação altera o Supabase."))return;
   chamada=()=>transferirMotorista(atual,id,novo);
  }else{
   const endereco=botao.closest(".central-nota").querySelector("input[data-endereco]")?.value.trim();
   if(!endereco||endereco.length<10||!endereco.includes(",")||!/[0-9]/.test(endereco))return status("Confirme rua, número e cidade separados por vírgula.",true);
   if(!window.confirm("Registrar como DESTINO CONFERIDO: "+endereco+"? Verifique antes de salvar."))return;
   const card=botao.closest(".central-nota");
   const latRaw=card.querySelector("input[data-lat]")?.value.trim()||"";
   const lonRaw=card.querySelector("input[data-lon]")?.value.trim()||"";
   if(Boolean(latRaw)!==Boolean(lonRaw))return status("Preencha latitude e longitude juntas, ou deixe ambas vazias.",true);
   const lat=latRaw?Number(latRaw):null,lon=lonRaw?Number(lonRaw):null;
   if(lat!==null&&(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180))return status("Coordenadas inválidas.",true);
   chamada=()=>salvarDestino(atual,id,endereco,lat,lon);
  }
  executando=true;botao.disabled=true;
  try{
   const res=await chamada();if(res!==true)throw Error("Operação não confirmada pelo servidor.");
   status(tipo==="transferir"?"Motorista transferido.":"Endereço confirmado.");
   await carregar();
  }catch(e){status("Alteração não confirmada: "+e.message+"; confira no servidor.",true);}
  finally{executando=false;if(botao.isConnected)botao.disabled=false;}
 }
 $("centralAtualizar").addEventListener("click",carregar);
 $("centralCarregarMais").addEventListener("click",()=>carregarLista(false));
 $("centralFiltroMotorista").addEventListener("change",()=>carregarLista(true));
 let debounce; $("centralBusca").addEventListener("input",()=>{clearTimeout(debounce);debounce=setTimeout(()=>carregarLista(true),350);});
 $("centralMotoristasLista").addEventListener("click",e=>{const b=e.target.closest("[data-central-motorista]");if(!b)return;$("centralFiltroMotorista").value=b.dataset.centralMotorista;carregarLista(true);});
 $("centralAtribuicoesLista").addEventListener("click",e=>{const transfer=e.target.closest("[data-transferir]");const dest=e.target.closest("[data-salvar-destino]");if(transfer)executarAcao(transfer,"transferir");if(dest)executarAcao(dest,"destino");});
 sair();return {entrar,sair,carregar};
}
