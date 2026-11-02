window.__limpeza={pronto:false,erro:'',gravacoes:0,bloqueadas:[],redes:0,etapa:'',capturar:false,telas:[]};
(()=>{
 const qa=window.__limpeza;
 Object.defineProperty(navigator,'onLine',{get:()=>false});
 window.fetch=async()=>{qa.redes++;throw Error('Rede bloqueada no teste offline')};
 window.alert=()=>{};window.confirm=()=>false;
 const chain=()=>{const q={};for(const n of ['select','eq','neq','order','range','limit','in','is','not','or','gte','lte','ilike','single','maybeSingle'])q[n]=()=>q;
  for(const n of ['insert','update','delete','upsert'])q[n]=()=>{qa.gravacoes++;throw Error('Escrita bloqueada: '+n)};
  q.then=(a,b)=>Promise.resolve({data:[],error:null,count:0}).then(a,b);return q};
 window.supabase={createClient:()=>({from:()=>chain(),rpc:async (nome,parametros={})=>{const leituraLink=nome==='pmobile_rastreio_config_link'&&!Object.hasOwn(parametros,'p_url');if(!leituraLink&&nome!=='pmobile_rastreio_estado_central'&&!/obter|listar|diagnosticar|buscar|consultar|comparar/.test(nome)){qa.gravacoes++;qa.bloqueadas.push(nome);throw Error('RPC de escrita bloqueada: '+nome)}return {data:[],error:null}},channel:()=>({on(){return this},subscribe(){return this}})})};
 window.addEventListener('error',e=>{qa.erro=String(e.error?.stack||e.message)});
 window.addEventListener('DOMContentLoaded',async()=>{
  const check=(value,label)=>{if(!value)throw Error(label)},$=id=>document.getElementById(id);
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const capture=async etapa=>{qa.etapa=etapa;qa.capturar=true;document.activeElement?.blur();while(qa.capturar)await new Promise(r=>setTimeout(r,70))};
  const visible=id=>$(id)&&getComputedStyle($(id)).display!=='none';
  async function screen(id){await frame();check(visible(id),'Tela não abriu: '+id);check(document.documentElement.scrollWidth<=innerWidth+1,'Transbordamento: '+id);qa.telas.push(id)}
  try{
   await frame();check(!$('sistema'),'Estrutura lateral ainda existe');
   check(visible('inicio'),'Início não exibido');await abrirSistema();await screen('loginPmobile');
   window.usuarioPmobileAtual={usuario:'fixture',nome:'Teste',nivel:'ADMIN'};window.credencialPmobileAtual='ficticia';
   $('inicio').style.display='none';$('loginPmobile').style.display='none';$('aplicacao').style.display='block';
   atualizarVisibilidadeConfiguracoes();mostrarTelaSistema('homeSistema',null,true);await screen('homeSistema');
   check(getComputedStyle($('conteudoPrincipal')).marginLeft==='0px','Espaço lateral permaneceu');await capture('home');
   abrirContagemManual();await screen('contagemManual');voltarMenu();await screen('homeSistema');
   abrirConfiguracoes();await screen('configuracoes');voltarMenu();
   if(window.abrirTransportesPmobile){
    for(const id of ['menuValoresTotal','menuImportacao','menuConferencias','menuRastreio','menuOpcoesCotacoes'])check(!$(id),'Entrada antiga ocultada: '+id);
    $('menuTransportes').click();await screen('transportes');
    document.querySelector('[data-pm-transporte="rastreio"]').click();await screen('rastreio');
    voltarMenu();abrirDadosLocaisPmobile();await screen('dadosLocais');await capture('dados-locais');
    const botoes=[...document.querySelectorAll('#dadosLocais [data-dl-open]')];check(botoes.length===8,'Módulos locais ausentes');
    for(const b of botoes){const id=b.dataset.dlOpen;b.click();await frame();const p=document.querySelector('[data-dl-panel="'+id+'"]');check(p&&!p.hidden,'Painel local ausente: '+id);check(document.documentElement.scrollWidth<=innerWidth+1,'Largura local: '+id);qa.telas.push('local:'+id);check(voltarUmNivelDadosLocais('dadosLocais'),'Retorno local não funcionou')}
    voltarUmNivelDadosLocais('dadosLocais');await screen('homeSistema');
    check(typeof obterConferenciasPendentes==='function'&&typeof sincronizarConferenciasPendentes==='function','Fila offline removida');
   }
   check(qa.gravacoes===0,'Operações bloqueadas: '+JSON.stringify(qa.bloqueadas));check(!qa.erro,qa.erro);qa.pronto=true;
  }catch(e){qa.erro=String(e.stack||e)}
 });
})();
