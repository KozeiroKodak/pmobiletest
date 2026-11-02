// Access-screen navigation only. Credentials and authorization remain in gerencia.js.
export function iniciarAcesso({aoCancelar=()=>{},aoDemonstrar=()=>{}}={}){
 const $=id=>document.getElementById(id);
 let autenticado=false,tela='inicio',camada=false;
 const estado=valor=>({...history.state,pmEntregasAcesso:valor});
 function gravar(valor,push=false){
  try{history[push?'pushState':'replaceState'](estado(valor),'');if(push)camada=true;}catch{/* Navigation still works when browser history is unavailable. */}
 }
 function senhaOculta(){
  $('loginSenha').type='password';$('mostrarSenhaAcesso').textContent='Mostrar';
  $('mostrarSenhaAcesso').setAttribute('aria-label','Mostrar senha');
  $('mostrarSenhaAcesso').setAttribute('aria-pressed','false');
 }
 function exibir(destino){
  tela=destino;
  $('inicio').hidden=destino!=='inicio';$('loginPmobile').hidden=destino!=='login';$('aplicacao').hidden=destino!=='aplicacao';
  $('entrarPeloAplicativo').hidden=autenticado;
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
  if(autenticado)return;
  senhaOculta();
  if(tela!=='login')gravar('login',!camada);
  exibir('login');
  requestAnimationFrame(()=>{if(tela==='login')$('loginUsuario').focus();});
 }
 function definirSessao(perfil){
  autenticado=Boolean(perfil);
  if(autenticado){exibir('aplicacao');gravar('aplicacao');}
  else inicio();
 }
 $('iniciarAcesso').addEventListener('click',login);
 $('entrarPeloAplicativo').addEventListener('click',login);
 $('voltarInicioAcesso').addEventListener('click',()=>{aoCancelar();if(tela!=='inicio')inicio();});
 $('mostrarSenhaAcesso').addEventListener('click',()=>{
  const mostrar=$('loginSenha').type==='password';$('loginSenha').type=mostrar?'text':'password';
  $('mostrarSenhaAcesso').textContent=mostrar?'Ocultar':'Mostrar';
  $('mostrarSenhaAcesso').setAttribute('aria-label',mostrar?'Ocultar senha':'Mostrar senha');
  $('mostrarSenhaAcesso').setAttribute('aria-pressed',String(mostrar));
 });
 $('abrirDemonstracaoAcesso').addEventListener('click',()=>{
  if(autenticado)return;aoDemonstrar();exibir('aplicacao');gravar('aplicacao');
 });
 window.addEventListener('popstate',evento=>{
  camada=false;
  if(autenticado){exibir('aplicacao');gravar('aplicacao');return;}
  if(evento.state?.pmEntregasAcesso==='login'){camada=true;exibir('login');senhaOculta();return;}
  if(tela==='login')aoCancelar();
  exibir('inicio');gravar('inicio');
 });
 exibir('inicio');gravar('inicio');
 return {definirSessao};
}
