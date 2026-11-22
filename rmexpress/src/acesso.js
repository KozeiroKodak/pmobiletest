// Navegação de acesso; a autenticação real permanece em src/gerencia.js.
import {ehAdministrador,podeSelecionarModo,MODOS} from './modos.js';

export function iniciarAcesso({aoCancelar=()=>{},aoDemonstrar=()=>{},aoSelecionarModo=()=>true}={}){
 const $=id=>document.getElementById(id);
 let perfil=null,modo=null,tela="inicio",camada=false,motoristaHabilitado=false,verificacaoMotoristaConcluida=false;
 const estado=valor=>({...history.state,pmEntregasAcesso:valor});
 function gravar(valor,push=false){
  try{history[push?'pushState':'replaceState'](estado(valor),'');if(push)camada=true;}catch{}
 }
 function senhaOculta(){
  $('loginSenha').type='password';
  $('mostrarSenhaAcesso').textContent='Mostrar';
  $('mostrarSenhaAcesso').setAttribute('aria-label','Mostrar senha');
  $('mostrarSenhaAcesso').setAttribute('aria-pressed','false');
 }
 function exibir(destino){
  tela=destino;
  $('inicio').hidden=destino!=='inicio';
  $('loginPmobile').hidden=destino!=='login';
  $('selecaoModo').hidden=destino!=='selecao';
  $('aplicacao').hidden=destino!=='aplicacao';
  $('entrarPeloAplicativo').hidden=Boolean(perfil);
  document.body.dataset.acesso=destino;
  if(destino!=='login'){senhaOculta();$('loginSenha').value='';}
  window.scrollTo(0,0);
 }
 function inicio(){
  const voltar=camada;camada=false;exibir('inicio');
  if(voltar){try{history.back();return;}catch{}}
  gravar('inicio');
 }
 function login(){
  if(perfil)return;
  senhaOculta();
  if(tela!=='login')gravar('login',!camada);
  exibir('login');
  requestAnimationFrame(()=>{if(tela==='login')$('loginUsuario').focus();});
 }
 function atualizarSelecao(){
  $('nomeSelecaoModo').textContent=perfil?.nome||perfil?.usuario||'Administrador';
  const habilitado=podeSelecionarModo(perfil,MODOS.MOTORISTA,motoristaHabilitado);
  $('selecionarModoMotorista').disabled=!habilitado;
  $('mensagemSelecaoModo').textContent=habilitado
    ? 'Você pode entrar como motorista ou gerenciar a operação.'
    : verificacaoMotoristaConcluida
      ? 'Modo motorista indisponível para esta conta. Acesso administrativo continua liberado.'
      : 'Verificando se sua conta também está habilitada para entregas...';
 }
 function selecionarModo(destino){
  if(!perfil||!podeSelecionarModo(perfil,destino,motoristaHabilitado))return false;
  if(aoSelecionarModo(destino)===false)return false;
  modo=destino;
  exibir('aplicacao');
  gravar('aplicacao');
  return true;
 }
 function definirSessao(nova){
  perfil=nova||null;modo=null;motoristaHabilitado=false;verificacaoMotoristaConcluida=false;
  if(!perfil){inicio();return;}
  if(ehAdministrador(perfil)){
   atualizarSelecao();
   exibir('selecao');
   gravar('selecao');
  }else if(perfil.nivel==='RMMOTORISTAS'){
   selecionarModo(MODOS.MOTORISTA);
  }else{
   // Perfil sem autorização PMEntregas não fica preso em sessão sem tela.
   aoCancelar();
   login();
   $('statusLogin').textContent='Esta conta não possui acesso operacional ao PMEntregas.';
  }
 }
 function definirMotoristaHabilitado(habilitado){
  motoristaHabilitado=Boolean(habilitado);
  verificacaoMotoristaConcluida=true;
  if(ehAdministrador(perfil)){
   atualizarSelecao();
   if(modo===MODOS.MOTORISTA && !motoristaHabilitado){
    modo=null;exibir('selecao');gravar('selecao');
   }
  }
 }
 function alternarModo(){
  if(!ehAdministrador(perfil)||tela!=='aplicacao')return false;
  const proximo=modo===MODOS.ADMINISTRATIVO?MODOS.MOTORISTA:MODOS.ADMINISTRATIVO;
  if(!podeSelecionarModo(perfil,proximo,motoristaHabilitado)){
   modo=null;exibir('selecao');atualizarSelecao();gravar('selecao');return false;
  }
  return selecionarModo(proximo);
 }
 function voltar(){
  if(tela==='login'){$('voltarInicioAcesso').click();return true;}
  if(tela==='selecao'){$('sairSelecaoModo').click();return true;}
  return false;
 }
 $('iniciarAcesso').addEventListener('click',login);
 $('entrarPeloAplicativo').addEventListener('click',login);
 $('voltarInicioAcesso').addEventListener('click',()=>{aoCancelar();if(tela!=='inicio')inicio();});
 $('sairSelecaoModo').addEventListener('click',()=>{aoCancelar();}); // limpa credenciais via gerencia.sair
 $('selecionarModoAdministrativo').addEventListener('click',()=>selecionarModo(MODOS.ADMINISTRATIVO));
 $('selecionarModoMotorista').addEventListener('click',()=>selecionarModo(MODOS.MOTORISTA));
 $('mostrarSenhaAcesso').addEventListener('click',()=>{
  const mostrar=$('loginSenha').type==='password';
  $('loginSenha').type=mostrar?'text':'password';
  $('mostrarSenhaAcesso').textContent=mostrar?'Ocultar':'Mostrar';
  $('mostrarSenhaAcesso').setAttribute('aria-label',mostrar?'Ocultar senha':'Mostrar senha');
  $('mostrarSenhaAcesso').setAttribute('aria-pressed',String(mostrar));
 });
 $('abrirDemonstracaoAcesso').addEventListener('click',()=>{
  if(perfil)return;
  aoDemonstrar();
  modo=MODOS.MOTORISTA;
  aoSelecionarModo(modo);
  exibir('aplicacao');gravar('aplicacao');
 });
 window.addEventListener('popstate',evento=>{
  camada=false;
  if(perfil){
   const destino=modo?'aplicacao':'selecao';
   exibir(destino);gravar(destino);return;
  }
  if(evento.state?.pmEntregasAcesso==='login'){
   camada=true;exibir('login');senhaOculta();return;
  }
  if(tela==='login')aoCancelar();
  exibir('inicio');gravar('inicio');
 });
 exibir('inicio');gravar('inicio');
 return {definirSessao,definirMotoristaHabilitado,alternarModo,voltar,
  modoAtual:()=>modo,temSelecaoAberta:()=>tela==='selecao'};
}
