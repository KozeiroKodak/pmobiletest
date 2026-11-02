/* The PMEntregas application is isolated from stock styles and element IDs. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),perfis=new Set(['ADMIN','RMADMIN','RMMOTORISTAS']);
 let sessao=null,geracao=0,frame=null,api=null,ativa=false,autenticada=false,filaPush=Promise.resolve(),registrado='';
 const ponte=()=>window.PMEntregasNotificacoes;
 function estadoNativo(){try{return JSON.parse(ponte()?.estado()||'{}')}catch{return {}}}
 function atual(){const u=window.usuarioPmobileAtual,c=window.credencialPmobileAtual;return u&&perfis.has(u.nivel)&&typeof c==='string'&&c?{id:u.id,usuario:u.usuario,nivel:u.nivel,credencial:c}:null;}
 function status(texto,erro=false){$('rmexpressStatus').textContent=texto;$('rmexpressStatus').classList.toggle('erro',erro);$('rmexpressTentar').hidden=!erro;}
 function ordenar(acao){const tarefa=filaPush.then(acao,acao);filaPush=tarefa.catch(()=>{});return tarefa;}
 async function dispositivo(s,token,remover){const modulo=await import('./rmexpress/src/api.js');return modulo.registrarDispositivo(s,token,remover);}
 function atualizarPush(){
  const n=estadoNativo(),s=sessao,g=geracao;
  if(!s||!navigator.onLine||!n.token||!n.permitida||registrado===n.token)return;
  void ordenar(()=>g===geracao?dispositivo(s,n.token,false):false).then(ok=>{if(ok&&g===geracao)registrado=n.token;}).catch(()=>{});
 }
 function sairDaTela(){ativa=false;api?.ativar(false);window.mostrarTelaSistema('homeSistema',null,true);}
 async function autenticarFrame(){
  if(!api||!sessao||autenticada)return;
  const g=geracao,s=sessao;status('Validando sua sessão RMEXPRESS…');frame.hidden=true;
  try{await api.entrar(s.usuario,s.credencial);if(g!==geracao)return;autenticada=true;frame.hidden=false;status('');api.ativar(ativa);}
  catch{if(g===geracao)status('Não foi possível validar a sessão. Verifique a conexão e tente novamente.',true);}
 }
 function sincronizarSessao(){
  const nova=atual(),anterior=sessao;
  if(nova&&anterior&&nova.usuario===anterior.usuario&&nova.credencial===anterior.credencial&&nova.nivel===anterior.nivel){atualizarPush();return;}
  const token=registrado||estadoNativo().token;geracao++;registrado='';sessao=nova;autenticada=false;
  api?.sair();if(frame)frame.hidden=true;
  try{ponte()?.vincularUsuario(nova?String(nova.id):'')}catch{}
  if(anterior&&token)void ordenar(()=>dispositivo(anterior,token,true)).catch(()=>{});
  $('menuRMExpress').hidden=!nova;
  if(!nova){ativa=false;status('Entre com uma conta autorizada do PMobile.');if(window.obterTelaSistemaAtual?.()==='rmexpress')sairDaTela();}
  else{atualizarPush();if(ativa)void autenticarFrame();try{if(ponte()?.possuiDestino())queueMicrotask(abrir);}catch{}}
 }
 function abrir(){
  sincronizarSessao();if(!sessao){status('Seu perfil não tem acesso à operação RMEXPRESS.',true);return;}
  ativa=true;window.mostrarTelaSistema('rmexpress','menuRMExpress');
  if(!frame){frame=document.createElement('iframe');frame.id='rmexpressFrame';frame.title='Operação RMEXPRESS';frame.hidden=true;frame.addEventListener('load',()=>{if(!api)status('Não foi possível carregar RMEXPRESS. Tente novamente.',true);});frame.src='rmexpress/index.html';$('rmexpressConteudo').append(frame);status('Carregando RMEXPRESS…');}
  else if(autenticada)api.ativar(true);else void autenticarFrame();
 }
 function voltar(tela){if(tela!=='rmexpress')return false;if(autenticada&&api?.voltar())return true;sairDaTela();return true;}
 Object.defineProperty(window,'PMobileRMExpress',{value:Object.freeze({abrir,sincronizarSessao,
  conectarFrame(origem){if(!frame||origem!==frame.contentWindow)return;api=origem.PMEntregasIntegracao;void autenticarFrame();}
 })});
 window.PMobileModulos.registrarRetorno('rmexpress',voltar);
 $('menuRMExpress').addEventListener('click',abrir);
 $('rmexpressVoltar').addEventListener('click',()=>voltar('rmexpress'));
 $('rmexpressTentar').addEventListener('click',()=>{if(api)void autenticarFrame();else if(frame){frame.src='rmexpress/index.html';status('Carregando RMEXPRESS…');}});
 window.addEventListener('pmobile:sessao-alterada',sincronizarSessao);
 window.addEventListener('pmobile:tela-alterada',()=>{ativa=window.obterTelaSistemaAtual?.()==='rmexpress';document.body.classList.toggle('rmexpress-ativa',ativa);api?.ativar(ativa&&autenticada);});
 window.addEventListener('pmentregas-push',()=>{atualizarPush();if(frame)frame.contentWindow.dispatchEvent(new frame.contentWindow.Event('pmentregas-push'));try{if(ponte()?.possuiDestino()&&sessao)abrir();}catch{}});
 window.addEventListener('online',atualizarPush);
 sincronizarSessao();
})();
