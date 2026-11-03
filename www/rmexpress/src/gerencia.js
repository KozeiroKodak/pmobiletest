import { classificarNF, CATEGORIAS_NF } from "./prioridade.js";
import { iniciarHistoricoGerencia } from "./historico.js";
import { autenticar, listarMotoristas, buscarDisponiveis, buscarDisponiveisPorCategoria, contadoresDisponiveis, atribuirMotorista, atribuirLote } from "./api.js";

const $ = id => document.getElementById(id);
const PERFIS_GERENCIA=new Set(["ADMIN","RMADMIN"]);

// RMADMIN só opera como motorista se constar na lista autorizada pelo Supabase.
export function podeAtuarComoMotorista(perfil,motoristas=[]){
  if(!perfil)return false;
  if(perfil.nivel==="RMMOTORISTAS")return true;
  return perfil.nivel==="RMADMIN" && motoristas.some(m=>String(m.id)===String(perfil.id));
}
const LIMITE=60;

function escapar(valor){
  return String(valor??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function numero(valor){
  if(valor==null || valor==="")return "—";
  const n=Number(valor);
  return Number.isFinite(n)?n.toLocaleString("pt-BR",{maximumFractionDigits:2}):"—";
}
function textoData(valor){
  if(!valor)return "Não informada";
  const partes=String(valor).slice(0,10).split("-");
  return partes.length===3?partes.reverse().join("/"):"Não informada";
}

export function iniciarGerencia({aoAlterarSessao=()=>{},aoSessaoMotorista=()=>{},aoSessaoAdmin=()=>{},aoSessaoNotificacoes=()=>{}}={}){
  let sessao=null;
  let motoristas=[];
  let notas=[];
  let temMais=false;
  let carregando=false;
  let consultaId=0;
  let tentandoEntrar=false;
  let versaoLogin=0;
  let buscaTimer=null;
  let categoriaAtiva="todas";
  let contadoresVersao=0;
  const salvando=new Set();
  const selecionadas=new Set();
  let loteOcupado=false;
  function atualizarLote(){
    const disponiveis=new Set(notas.map(x=>String(x.id)));
    for(const id of selecionadas) if(!disponiveis.has(id)) selecionadas.delete(id);
    $("gerenciaLote").hidden=!autorizada();
    $("loteSelecionadas").textContent=selecionadas.size+" selecionado(s) · máximo 50";
    $("atribuirLote").disabled=!navigator.onLine||!selecionadas.size||loteOcupado;
    const anterior=$("loteMotorista").value;
    $("loteMotorista").replaceChildren(new Option("Selecione um motorista",""),...motoristas.map(m=>new Option(m.nome,String(m.id))));
    if(motoristas.some(m=>String(m.id)===anterior))$("loteMotorista").value=anterior;
  }
  const historico=iniciarHistoricoGerencia({obterSessao:()=>autorizada()?sessao:null});

  function autorizada(){return Boolean(sessao&&PERFIS_GERENCIA.has(sessao.nivel));}
  function aviso(texto,erro=false){
    const el=$("gerenciaStatus");
    el.textContent=texto;
    el.classList.toggle("erro",erro);
  }
  function mensagemLogin(texto,erro=false){
    $("statusLogin").textContent=texto;
    $("statusLogin").classList.toggle("erro",erro);
  }
  function selecionarCategoria(id){
    if(!CATEGORIAS_NF.some(c=>c.id===id))return;
    categoriaAtiva=id;
    document.querySelectorAll("[data-gerencia-categoria]").forEach(botao=>{
      const ativo=botao.dataset.gerenciaCategoria===id;
      botao.classList.toggle("active",ativo);
      botao.setAttribute("aria-pressed",String(ativo));
    });
  }
  function renderizarContadores(dados=null){
    const base={todas:0,expressa:0,prioritaria:0,reenvio:0,normal:0};
    if(Array.isArray(dados)){
      const mapa={1:"expressa",2:"prioritaria",3:"reenvio",4:"normal"};
      for(const item of dados){
        const chave=mapa[Number(item.categoria)];
        if(chave)base[chave]=Math.max(0,Number(item.total)||0);
      }
      base.todas=base.expressa+base.prioritaria+base.reenvio+base.normal;
    }
    document.querySelectorAll("[data-gerencia-count]").forEach(no=>{
      no.textContent=dados?base[no.dataset.gerenciaCount].toLocaleString("pt-BR"):"—";
    });
  }
  async function carregarContadores(){
    if(!autorizada())return;
    const atual=sessao;
    const id=++contadoresVersao;
    $("contadoresGerenciaStatus").textContent="Atualizando quantidades no Supabase...";
    try{
      const resultado=await contadoresDisponiveis(atual);
      if(id!==contadoresVersao||sessao!==atual)return;
      if(!Array.isArray(resultado))throw new Error("Resposta inválida.");
      renderizarContadores(resultado);
      $("contadoresGerenciaStatus").textContent="Quantidades totais disponíveis, independentemente da página ou pesquisa.";
    }catch(erro){
      if(id!==contadoresVersao||sessao!==atual)return;
      renderizarContadores();
      $("contadoresGerenciaStatus").textContent="Contadores indisponíveis. "+(erro.message||"Atualize a consulta.");
    }
  }
  function atualizarAutenticacao(){
    const ativa=Boolean(sessao);
    $("formLoginPmobile").hidden=ativa;
    $("usuarioAutenticado").hidden=!ativa;
    $("tabGerencia").hidden=!autorizada();
    if(ativa){
      $("nomeUsuario").textContent=sessao.nome||sessao.usuario;
      $("perfilUsuario").textContent=sessao.nivel;
    }else{
      $("nomeUsuario").textContent="";
      $("perfilUsuario").textContent="";
    }
    $("estadoGerencia").hidden=autorizada();
    $("conteudoGerencia").hidden=!autorizada();
  }
  function limparLogin(){
    aoSessaoNotificacoes(null);
    versaoLogin++;tentandoEntrar=false;
    $("botaoLogin").disabled=false;$("botaoLogin").textContent="ENTRAR";
    $("formLoginPmobile").setAttribute("aria-busy","false");
    if(buscaTimer)clearTimeout(buscaTimer);
    consultaId++;
    contadoresVersao++;
    selecionarCategoria("todas");
    renderizarContadores();
    $("contadoresGerenciaStatus").textContent="";
    sessao=null;
    motoristas=[];
    notas=[];
    temMais=false;
    carregando=false;
    salvando.clear();
    selecionadas.clear();
    loteOcupado=false;
    $("gerenciaLote").hidden=true;
    aoSessaoAdmin(null);
    historico.limpar();
    $("loginSenha").value="";
    $("loginUsuario").value="";
    $("buscaGerencia").value="";
    $("listaGerencia").replaceChildren();
    $("resumoGerencia").textContent="";
    mensagemLogin("");
    aviso("");
    atualizarAutenticacao();
    aoSessaoMotorista(null);
    aoAlterarSessao(null);
  }
  async function entrar(evento,dados=null){
    evento.preventDefault();
    if(tentandoEntrar)return;
    const usuario=String(dados?.usuario??$("loginUsuario").value).trim();
    const credencial=dados?.credencial??$("loginSenha").value;
    $("loginSenha").value="";
    if(!usuario||!credencial){mensagemLogin("Informe usuário e senha do PMobile.",true);return;}
    const tentativa=++versaoLogin;
    tentandoEntrar=true;
    $("botaoLogin").disabled=true;
    $("botaoLogin").textContent="Entrando…";
    $("formLoginPmobile").setAttribute("aria-busy","true");
    mensagemLogin("Validando acesso no Supabase...");
    try {
      const perfil=await autenticar(usuario,credencial);
      if(tentativa!==versaoLogin)return;
      sessao={...perfil,credencial}; // Somente memoria; nunca salvar em localStorage.
      atualizarAutenticacao();
      aoSessaoNotificacoes(sessao);
      aoAlterarSessao({usuario:perfil.usuario,nome:perfil.nome,nivel:perfil.nivel});
      mensagemLogin("");
      if(autorizada()){
        aoSessaoAdmin(sessao);
        aviso("Acesso autorizado. Consultando notas disponíveis...");
        await carregarMotoristas();
        if(podeAtuarComoMotorista(perfil,motoristas))await aoSessaoMotorista(sessao);
        await carregarContadores();
        await carregarNotas(true);
        await historico.carregar();
      }else{
        if(podeAtuarComoMotorista(perfil,motoristas)) await aoSessaoMotorista(sessao);
        aviso("");
        $("estadoGerencia").textContent="Este perfil não possui autorização de gerência. Apenas ADMIN e RMADMIN podem atribuir motoristas.";
      }
    }catch(erro){
      if(tentativa===versaoLogin)mensagemLogin(erro.message||"Não foi possível entrar.",true);
    }finally{
      if(tentativa===versaoLogin){tentandoEntrar=false;
        $("botaoLogin").disabled=false;$("botaoLogin").textContent="ENTRAR";
        $("formLoginPmobile").setAttribute("aria-busy","false");}
    }
  }
  async function carregarMotoristas(){
    if(!autorizada())return;
    try {
      const resultado=await listarMotoristas(sessao);
      if(!autorizada())return;
      motoristas=Array.isArray(resultado)?resultado.filter(x=>x.id!=null&&x.nome):[];
      atualizarLote();
      if(!motoristas.length)aviso("Não existem motoristas ativos habilitados. Nenhuma atribuição poderá ser efetuada.",true);
    }catch(erro){
      motoristas=[];
      aviso("Falha ao consultar os motoristas: "+(erro.message||"tente novamente."),true);
    }
  }
  function renderizarNotas(){
    const nome=CATEGORIAS_NF.find(x=>x.id===categoriaAtiva)?.nome||"Todas";
    $("resumoGerencia").textContent=nome+": "+notas.length+" registro(s) carregado(s)"+(temMais?" · existem mais páginas":"");
    const lista=$("listaGerencia");
    if(!notas.length){
      lista.innerHTML='<div class="empty"><strong>Nenhuma nota disponível</strong><p>Verifique a pesquisa ou atualize a lista.</p></div>';
    }else{
      lista.innerHTML=notas.map(item=>{
        const id=escapar(item.id);
        const prioridade=classificarNF(item.notas_fiscais);
        const rotulo=prioridade.agrupada?prioridade.rotulo+" · Grupo":prioridade.rotulo;
        const opcoes=motoristas.map(m=>'<option value="'+escapar(m.id)+'">'+escapar(m.nome)+" · "+escapar(m.usuario||"")+"</option>").join("");
        return '<article class="gerencia-card" data-registro="'+id+'">'+
          '<div class="delivery-head"><div><small>NF '+escapar(item.notas_fiscais||"—")+'</small><h3>'+escapar(item.cliente||"Cliente não informado")+'</h3></div>'+
          '<span class="nf-prioridade nf-prioridade-'+prioridade.tipo+'" title="Nível '+prioridade.ordem+' de 4">'+escapar(rotulo)+'</span></div>'+
          '<p class="destination">⌖ '+escapar(item.regiao||"Região não informada")+'</p>'+
          '<div class="delivery-meta"><span>'+numero(item.volume)+' volumes</span><span>'+numero(item.peso)+' kg</span><span>Envio: '+textoData(item.data_envio)+'</span><span>'+escapar(item.turno||"Turno não informado")+'</span></div>'+
          '<label class="gerencia-selecao"><input type="checkbox" data-lote-id="'+id+'" '+(selecionadas.has(String(item.id))?'checked':'')+'> Selecionar para lote</label>'+
          '<div class="gerencia-atribuicao"><label><span>Motorista responsável</span><select data-motorista="'+id+'" aria-label="Motorista para NF '+escapar(item.notas_fiscais||"")+'"><option value="">Selecione um motorista</option>'+opcoes+'</select></label>'+
          '<button type="button" class="btn btn-primary" data-atribuir="'+id+'" '+(!motoristas.length?'disabled':'')+'>Atribuir</button></div></article>';
      }).join("");
    }
    $("carregarMaisGerencia").hidden=!temMais;
    $("carregarMaisGerencia").disabled=carregando;
    $("atualizarGerencia").disabled=carregando;
    atualizarLote();
  }
  async function carregarNotas(reiniciar=false){
    if(!autorizada()||carregando&&!reiniciar)return;
    const estaSessao=sessao;
    const id=++consultaId;
    if(reiniciar){
      notas=[];
      temMais=false;
      $("listaGerencia").innerHTML='<div class="empty"><strong>Carregando notas...</strong><p>Consultando a categoria selecionada no Supabase.</p></div>';
      $("resumoGerencia").textContent="Atualizando seleção...";
      $("carregarMaisGerencia").hidden=true;
    }
    carregando=true;
    $("atualizarGerencia").disabled=true;
    $("carregarMaisGerencia").disabled=true;
    aviso("Consultando notas disponíveis no Supabase...");
    try {
      const definicao=CATEGORIAS_NF.find(c=>c.id===categoriaAtiva);
      const resultado=definicao.ordem===null
        ? await buscarDisponiveis(estaSessao,$("buscaGerencia").value,notas.length,LIMITE)
        : await buscarDisponiveisPorCategoria(estaSessao,definicao.ordem,$("buscaGerencia").value,notas.length,LIMITE);
      if(id!==consultaId||!autorizada()||sessao!==estaSessao)return;
      if(!Array.isArray(resultado))throw new Error("Resposta inválida do servidor.");
      const vistos=new Set(notas.map(x=>x.id));
      notas=[...notas,...resultado.filter(x=>x?.id&&!vistos.has(x.id))];
      temMais=resultado.length===LIMITE;
      aviso("Somente notas RMExpress pendentes e ainda não atribuídas são exibidas.");
    }catch(erro){
      if(id===consultaId)aviso("Não foi possível consultar notas: "+(erro.message||"tente novamente."),true);
    }finally{
      if(id===consultaId){carregando=false;renderizarNotas();}
    }
  }
  async function atribuir(id,botao){
    if(!autorizada()||salvando.has(id)||!navigator.onLine)return;
    const item=notas.find(x=>String(x.id)===id);
    const select=botao.closest(".gerencia-card")?.querySelector("select[data-motorista]");
    const motorista=motoristas.find(x=>String(x.id)===String(select?.value));
    if(!item||!motorista){aviso("Escolha um motorista válido antes de atribuir.",true);return;}
    if(!window.confirm("Atribuir NF "+(item.notas_fiscais||"—")+" para "+motorista.nome+"? Essa operação altera o rastreio real no Supabase."))return;
    const atual=sessao;
    salvando.add(id);
    botao.disabled=true;
    botao.textContent="Atribuindo...";
    try{
      const resultado=await atribuirMotorista(atual,id,motorista.id);
      if(resultado!==true)throw new Error("Servidor não confirmou a atribuição.");
      if(!autorizada()||sessao!==atual)return;
      aviso("✓ NF atribuída a "+motorista.nome+". O registro já está disponível no sistema compartilhado.");
      await carregarContadores();
      await carregarNotas(true);
    }catch(erro){
      aviso("Atribuição não confirmada: "+(erro.message||"atualize e verifique a nota."),true);
    }finally{
      salvando.delete(id);
      if(botao.isConnected){botao.disabled=false;botao.textContent="Atribuir";}
    }
  }
  async function atribuirSelecao(){
    if(!autorizada()||!navigator.onLine||loteOcupado||!selecionadas.size)return;
    const id=$("loteMotorista").value;
    const motorista=motoristas.find(x=>String(x.id)===id);
    if(!motorista)return aviso("Escolha o motorista responsável pelo lote.",true);
    const ids=[...selecionadas];
    if(ids.length>50)return aviso("Máximo de 50 registros por lote.",true);
    if(!window.confirm("Atribuir "+ids.length+" registro(s) para "+motorista.nome+"? Operação REAL e atômica."))return;
    const atual=sessao;
    loteOcupado=true;$("atribuirLote").disabled=true;
    try{
      const qtd=await atribuirLote(atual,ids,motorista.id);
      if(Number(qtd)!==ids.length)throw Error("Resultado não corresponde ao lote solicitado.");
      if(atual!==sessao)return;
      selecionadas.clear();
      await Promise.all([carregarContadores(),carregarNotas(true)]);
      aviso("✓ "+qtd+" registro(s) atribuídos. O motorista já poderá consultar as NFs.");
    }catch(e){aviso("Lote não confirmado: "+e.message+"; atualize a listagem.",true);}
    finally{loteOcupado=false;atualizarLote();}
  }
  $("atribuirLote").addEventListener("click",atribuirSelecao);
  $("limparLote").addEventListener("click",()=>{
    selecionadas.clear();document.querySelectorAll("[data-lote-id]").forEach(x=>x.checked=false);atualizarLote();
  });
  $("listaGerencia").addEventListener("change",e=>{
    const item=e.target.closest("input[data-lote-id]");
    if(!item)return;
    if(item.checked&&selecionadas.size>=50){item.checked=false;return aviso("Selecione no máximo 50 registros.",true);}
    if(item.checked)selecionadas.add(item.dataset.loteId);
    else selecionadas.delete(item.dataset.loteId);
    atualizarLote();
  });
  $("formLoginPmobile").addEventListener("submit",entrar);
  $("sairPmobile").addEventListener("click",limparLogin);
  $("atualizarGerencia").addEventListener("click",async()=>{
    await carregarMotoristas();
    await Promise.all([carregarContadores(),carregarNotas(true),historico.carregar()]);
  });
  $("categoriasGerencia").addEventListener("click",evento=>{
    const botao=evento.target.closest("button[data-gerencia-categoria]");
    if(!botao||!autorizada())return;
    if(categoriaAtiva===botao.dataset.gerenciaCategoria)return;
    selecionarCategoria(botao.dataset.gerenciaCategoria);
    carregarNotas(true);
  });
  $("carregarMaisGerencia").addEventListener("click",()=>carregarNotas(false));
  $("buscaGerencia").addEventListener("input",()=>{
    if(buscaTimer)clearTimeout(buscaTimer);
    buscaTimer=setTimeout(()=>carregarNotas(true),400);
  });
  $("listaGerencia").addEventListener("click",evento=>{
    const botao=evento.target.closest("button[data-atribuir]");
    if(botao)atribuir(botao.dataset.atribuir,botao);
  });
  window.addEventListener("online",()=>{if(autorizada())aviso("Conexão restabelecida. Atualize a lista antes de atribuir.");});
  window.addEventListener("offline",()=>{if(autorizada())aviso("Sem conexão: não é possível atribuir notas reais offline.",true);});
  selecionarCategoria("todas");
  renderizarContadores();
  atualizarAutenticacao();
  return {estaAutorizada:autorizada,sair:limparLogin,
    async entrarIntegrado(usuario,credencial){
      await entrar({preventDefault(){}},{usuario,credencial});
      return sessao?{id:sessao.id,usuario:sessao.usuario,nivel:sessao.nivel}:null;
    }};
}
