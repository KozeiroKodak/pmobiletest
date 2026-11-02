// The standalone application and the PMobile tab use the same operational code.
export function estaIntegradoPmobile(){
 try{return window.parent!==window&&window.frameElement?.id==='rmexpressFrame'&&Boolean(window.parent.PMobileRMExpress);}catch{return false;}
}
export function iniciarIntegracaoPmobile({gerencia,notificacoes}){
 if(!estaIntegradoPmobile())return;
 document.body.classList.add('integrado-pmobile');
 window.PMEntregasIntegracaoAtiva=false;
 const api=Object.freeze({
  async entrar(usuario,credencial){
   gerencia.sair();
   const perfil=await gerencia.entrarIntegrado(usuario,credencial);
   if(!perfil||!['ADMIN','RMADMIN','RMMOTORISTAS'].includes(perfil.nivel)){gerencia.sair();throw Error('A sessão RMEXPRESS não pôde ser validada. Entre novamente no PMobile.');}
   return perfil;
  },
  sair(){window.PMEntregasIntegracaoAtiva=false;gerencia.sair();},
  ativar(ativa){window.PMEntregasIntegracaoAtiva=Boolean(ativa);if(ativa)window.dispatchEvent(new Event('pmentregas-push'));else notificacoes.fechar();},
  voltar(){return window.voltarAndroidPmentregas()===true;}
 });
 Object.defineProperty(window,'PMEntregasIntegracao',{value:api,configurable:false});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();window.parent.voltarTelaAnteriorPmobile();}});
 window.parent.PMobileRMExpress.conectarFrame(window);
}
