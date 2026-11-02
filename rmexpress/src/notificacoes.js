import {rpc} from './api.js';

export function iniciarNotificacoes({abrirArea,gerenciarDispositivo=true}) {
 const $=id=>document.getElementById(id),ponte=()=>window.PMEntregasNotificacoes;
 let sessao=null,geracao=0,ocupado=false,timer=null,tokenRegistrado=null,itens=[];
 let filaPush=Promise.resolve();
 function ordenarPush(operacao){
  const tarefa=filaPush.then(operacao,operacao);
  filaPush=tarefa.catch(()=>{});return tarefa;
 }
 const permitidos=new Set(['ADMIN','RMADMIN','RMMOTORISTAS']);
 function nativa(){try{return JSON.parse(ponte()?.estado()||'{}')}catch{return {}}}
 function fechar(){$('painelNotificacoes').hidden=true;$('abrirNotificacoes').setAttribute('aria-expanded','false')}
 function renderizar(){
  $('listaNotificacoes').replaceChildren();
  for(const item of itens){
   const li=document.createElement('li'),botao=document.createElement('button'),titulo=document.createElement('strong'),texto=document.createElement('span'),data=document.createElement('small');
   botao.type='button';botao.className='notificacao-item';botao.classList.toggle('nao-lida',!item.lida_em);
   titulo.textContent=item.titulo;texto.textContent=item.mensagem;data.textContent=new Date(item.criado_em).toLocaleString('pt-BR');
   botao.append(titulo,texto,data);botao.addEventListener('click',()=>abrir(item));li.append(botao);$('listaNotificacoes').append(li);
  }
  $('notificacoesVazias').hidden=itens.length>0;
 }
 async function atualizar(){
  if(!sessao||ocupado||document.hidden||window.PMEntregasIntegracaoAtiva===false||!navigator.onLine)return;
  ocupado=true;const atual=sessao,id=geracao;
  try{
   const resultado=await rpc('pmentregas_notificacoes_listar',{p_usuario:atual.usuario,p_credencial:atual.credencial});
   if(id!==geracao)return;
   if(!Array.isArray(resultado?.itens))throw Error('Resposta inválida');
   itens=resultado.itens;$('totalNotificacoes').textContent=String(resultado.nao_lidas||0);renderizar();$('statusNotificacoes').textContent='';
   try{
    const destino=ponte()?.consumirDestino();
    if(['entregas','gerencia','central'].includes(destino)&&
      (destino==='entregas'||['ADMIN','RMADMIN'].includes(atual.nivel)))abrirArea(destino);
   }catch{}
   const estado=nativa();
   if(gerenciarDispositivo&&estado.token&&estado.permitida&&tokenRegistrado!==estado.token){
    await ordenarPush(()=>id===geracao?rpc('pmentregas_push_registrar',{p_usuario:atual.usuario,p_credencial:atual.credencial,p_token:estado.token}):false);
    if(id===geracao)tokenRegistrado=estado.token;
   }
  }catch{
   if(id===geracao)$('statusNotificacoes').textContent='Não foi possível atualizar os avisos. Tente novamente.';
  }finally{if(id===geracao)ocupado=false;}
 }
 async function abrir(item){
  const atual=sessao,id=geracao;if(!atual)return;
  try{
   await rpc('pmentregas_notificacao_ler',{p_usuario:atual.usuario,p_credencial:atual.credencial,p_id:item.id});
   if(id!==geracao)return;fechar();
   abrirArea(item.tipo==='NF_ATRIBUIDA'?'entregas':item.tipo==='NF_ENTREGUE'?'central':'gerencia');
   void atualizar();
  }catch{if(id===geracao)$('statusNotificacoes').textContent='Não foi possível abrir o aviso. Tente novamente.';}
 }
 function definirSessao(nova){
  const anterior=sessao,token=tokenRegistrado||nativa().token;geracao++;ocupado=false;tokenRegistrado=null;
  clearInterval(timer);timer=null;itens=[];fechar();$('listaNotificacoes').replaceChildren();$('totalNotificacoes').textContent='0';
  sessao=nova&&permitidos.has(nova.nivel)?nova:null;$('abrirNotificacoes').hidden=!sessao;
  if(gerenciarDispositivo)try{ponte()?.vincularUsuario(sessao?String(sessao.id):'')}catch{}
  if(gerenciarDispositivo&&anterior&&token&&(!sessao||sessao.usuario!==anterior.usuario))void ordenarPush(()=>rpc('pmentregas_push_registrar',{p_usuario:anterior.usuario,p_credencial:anterior.credencial,p_token:token,p_remover:true})).catch(()=>{});
  if(sessao){void atualizar();timer=setInterval(atualizar,30000);}
 }
 $('abrirNotificacoes').addEventListener('click',()=>{$('painelNotificacoes').hidden=false;$('abrirNotificacoes').setAttribute('aria-expanded','true');void atualizar()});
 $('fecharNotificacoes').addEventListener('click',fechar);
 $('atualizarNotificacoes').addEventListener('click',atualizar);
 $('ativarNotificacoes').addEventListener('click',()=>{
  const estado=nativa();if(!estado.configurada){$('statusNotificacoes').textContent='Os avisos do Android neste aparelho ainda não estão disponíveis.';return;}
  ponte().solicitarPermissao();
 });
 window.addEventListener('online',atualizar);document.addEventListener('visibilitychange',atualizar);
 window.addEventListener('pmentregas-push',()=>{void atualizar()});
 return {definirSessao,fechar};
}

