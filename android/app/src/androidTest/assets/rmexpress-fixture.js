(()=>{
 const principal=window.parent===window;
 const qa=principal?(window.__rmexpressTeste={pronto:false,erro:'',capturar:false,etapa:'',voltar:false,gravacoes:0,autenticacoes:[],nativo:Boolean(window.__rmexpressNativo)}):window.parent.__rmexpressTeste;
 const conta=usuario=>({id:usuario==='motorista_fixture'?43:42,usuario,nome:usuario==='motorista_fixture'?'Motorista fictício':'Administrador fictício',nivel:usuario==='motorista_fixture'?'RMMOTORISTAS':'ADMIN',ativo:true,precisa_criar_senha:false});
 const responder=dados=>({ok:true,text:async()=>JSON.stringify(dados)});
 const operacoes=new Set(['pmentregas_gerencia_atribuir','pmentregas_gerencia_atribuir_lote','pmentregas_gerencia_transferir','pmcoletas_motorista_confirmar_entrega','pmcoletas_motorista_confirmar_rota']);
 const rpc=(nome,body={})=>{
  if(operacoes.has(nome)){qa.gravacoes++;throw Error('Escrita operacional bloqueada: '+nome);}
  if(nome==='autenticar_usuario'){if(body.p_credencial!=='senha-ficticia')throw Error('Credencial incorreta');qa.autenticacoes.push(body.p_usuario);return [conta(body.p_usuario)];}
  if(nome==='pmentregas_notificacoes_listar')return {itens:[{id:'901',tipo:'NF_ATRIBUIDA',titulo:'Aviso fictício',mensagem:'NF de teste <texto>',criado_em:new Date().toISOString(),lida_em:null}],nao_lidas:1};
  if(nome==='pmentregas_notificacao_ler'||nome==='pmentregas_push_registrar')return true;
  return [];
 };
 window.fetch=async(url,config={})=>{if(!String(url).includes('/rest/v1/rpc/'))throw Error('Rede externa bloqueada');return responder(rpc(String(url).split('/').pop(),JSON.parse(config.body||'{}')));};
 const chain=()=>{const q={};for(const n of ['select','eq','neq','order','range','limit','in','is','not','or','gte','lte','ilike','single','maybeSingle'])q[n]=()=>q;
  for(const n of ['insert','update','delete','upsert'])q[n]=()=>{qa.gravacoes++;throw Error('Escrita bloqueada')};q.then=(a,b)=>Promise.resolve({data:[],error:null,count:0}).then(a,b);return q;};
 window.supabase={createClient:()=>({from:()=>chain(),rpc:async(n,b)=>({data:rpc(n,b),error:null}),channel:()=>({on(){return this},subscribe(){return this}})})};
 window.alert=()=>{};window.confirm=()=>false;
 window.addEventListener('error',e=>{qa.erro=String(e.error?.stack||e.message)});
 if(!principal)return;
 const $=id=>document.getElementById(id),check=(a,m)=>{if(!a)throw Error(m)};
 const esperar=async(fn,m)=>{const end=Date.now()+25000;while(!fn()&&Date.now()<end)await new Promise(r=>setTimeout(r,50));check(fn(),m);};
 async function voltar(){qa.voltar=true;if(!qa.nativo){voltarTelaAnteriorPmobile();qa.voltar=false;}await esperar(()=>!qa.voltar,'Voltar do Android não executou');}
 async function captura(etapa){qa.etapa=etapa;qa.capturar=true;if(!qa.nativo){if(!window.__rmexpressCapturas){qa.capturar=false;return;}const b=document.createElement('button');b.textContent='Continuar teste';b.style.cssText='position:fixed;right:8px;top:8px;z-index:99999';b.onclick=()=>{qa.capturar=false;b.remove();};document.body.append(b);}await esperar(()=>!qa.capturar,'Captura não concluída');}
 function entrar(usuario){window.usuarioPmobileAtual=conta(usuario);window.credencialPmobileAtual='senha-ficticia';$('inicio').style.display='none';$('loginPmobile').style.display='none';$('aplicacao').style.display='block';atualizarVisibilidadeConfiguracoes();mostrarTelaSistema('homeSistema',null,true);}
 window.addEventListener('DOMContentLoaded',async()=>{
  try{
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   localStorage.setItem('rmexpress-teste-estoque','estoque-preservado');
   entrar('admin_fixture');check(!$('menuRMExpress').hidden,'Acesso RMEXPRESS ausente');$('menuRMExpress').click();
   await esperar(()=>$('rmexpressFrame')?.contentWindow?.PMEntregasIntegracao,'Aplicação integrada não carregou');
   const w=$('rmexpressFrame').contentWindow,d=w.document;
   await esperar(()=>!$('rmexpressFrame').hidden&&!d.getElementById('aplicacao').hidden,'Sessão integrada não abriu');
   check(qa.autenticacoes.includes('admin_fixture'),'Não validou a sessão no servidor');
   check(d.getElementById('loginSenha').value==='','Senha foi colocada no formulário');
   await captura('admin');
   for(const area of ['painel','entregas','roteiros','gerencia','central']){
    d.querySelector('[data-view="'+area+'"]').click();check(!d.getElementById('view-'+area).hidden,'Área ausente: '+area);
    await voltar();await esperar(()=>!d.getElementById('view-inicio').hidden,'Não voltou de '+area);check(obterTelaSistemaAtual()==='rmexpress','Saiu da aba ao retornar');
   }
   d.getElementById('abrirNotificacoes').click();check(!d.getElementById('painelNotificacoes').hidden,'Caixa ausente');await voltar();check(d.getElementById('painelNotificacoes').hidden,'Voltar não fechou a caixa');
   await voltar();check(obterTelaSistemaAtual()==='homeSistema','Não retornou ao PMobile');
   entrar('motorista_fixture');$('menuRMExpress').click();await esperar(()=>!$('rmexpressFrame').hidden&&d.getElementById('perfilUsuario').textContent==='RMMOTORISTAS','Troca de conta não atualizou a sessão');
   check(d.getElementById('tabGerencia').hidden&&d.getElementById('tabCentral').hidden,'Motorista recebeu área administrativa');await captura('motorista');
   window.usuarioPmobileAtual={...conta('restrito'),nivel:'NIVEL2'};window.credencialPmobileAtual='senha-ficticia';atualizarVisibilidadeConfiguracoes();check($('menuRMExpress').hidden&&$('rmexpressFrame').hidden,'Perfil sem permissão manteve acesso');
   window.usuarioPmobileAtual=null;window.credencialPmobileAtual=null;atualizarVisibilidadeConfiguracoes();check(d.getElementById('aplicacao').hidden,'Saída deixou dados da conta visíveis');
   check(localStorage.getItem('rmexpress-teste-estoque')==='estoque-preservado','Dados locais foram alterados');
   check(qa.gravacoes===0,'O teste tentou alterar operações reais');qa.pronto=true;
  }catch(e){qa.erro=String(e.stack||e)}finally{localStorage.removeItem('rmexpress-teste-estoque');if(!qa.nativo){const result=document.createElement('output');result.id='rmexpressResultadoTeste';result.textContent=qa.pronto?'Teste RMEXPRESS aprovado: cinco áreas, retorno, troca de conta, isolamento e estoque preservado.':qa.erro;document.body.append(result);}}
 });
})();
