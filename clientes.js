/* PMobile — Clientes: auditoria de variações nos nomes da planilha OneDrive.
 * Somente leitura de rastreios; decisões ficam em tabela Supabase separada.
 */
(function(){
 "use strict";
 const A=window.PMobileClientesAnalise;
 if(!A)throw Error("Motor de análise de Clientes não carregado.");
 const $=id=>document.getElementById(id);
 const html=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const estado={grupos:[],decisoes:new Map(),banco:false,carregando:false,ultima:0,geracao:0,limite:20,pares:new Map()};
 function mensagem(txt,erro=false){
   const el=$("clientesStatus");if(!el)return;
   el.textContent=txt;el.classList.toggle("erro",erro);
 }
 function sessao(){
   const u=window.usuarioPmobileAtual,c=window.credencialPmobileAtual;
   if(!u||u.nivel!=="ADMIN"||!u.usuario||!c)throw Error("Clientes: acesso exclusivo ao administrador autenticado.");
   if(!window.clienteSupabase)throw Error("Conexão com Supabase indisponível.");
   return {p_usuario:u.usuario,p_credencial:c};
 }
 async function obterRegistros(){
   const auth=sessao(),todos=[],tamanho=500,paralelas=4,maximo=50000;
   for(let inicio=0;inicio<maximo;inicio+=tamanho*paralelas){
     const offsets=Array.from({length:paralelas},(_,j)=>inicio+j*tamanho);
     const paginas=await Promise.all(offsets.map(async offset=>{
       const r=await window.clienteSupabase.rpc("pmobile_rastreio_listar_v5",{
         ...auth,p_limit:tamanho,p_offset:offset
       });
       if(r.error)throw r.error;
       if(!Array.isArray(r.data))throw Error("Formato inesperado da consulta de rastreios.");
       return r.data;
     }));
     for(const p of paginas)todos.push(...p);
     mensagem("Analisando registros da planilha: "+todos.length.toLocaleString("pt-BR")+"...");
     if(paginas.some(p=>p.length<tamanho)){
       const vistos=new Set();
       return todos.filter(x=>{
         const id=String(x.id??"")+"|"+String(x.linha_origem??"");
         if(vistos.has(id))return false;
         vistos.add(id);return true;
       });
     }
   }
   throw Error("A base ultrapassou o limite seguro de leitura (50 mil linhas). Análise parcial não será exibida.");
 }
 async function obterDecisoes(){
   estado.decisoes=new Map();estado.banco=false;
   try{
     const r=await window.clienteSupabase.rpc("pmobile_clientes_listar_decisoes",sessao());
     if(r.error)throw r.error;
     if(!Array.isArray(r.data))throw Error("Resposta de decisões inválida.");
     for(const d of r.data)estado.decisoes.set(String(d.chave),String(d.status));
     estado.banco=true;
   }catch(e){
     console.warn("Clientes: armazenamento de decisões ainda indisponível.",e);
   }
 }
 function preencherCidades(){
   const select=$("clientesCidade");if(!select)return;
   const anterior=select.value,cidades=new Map();
   for(const g of estado.grupos)if(!cidades.has(g.local))cidades.set(g.local,g.cidade);
   select.replaceChildren(new Option("Todas as cidades / regiões",""));
   for(const [k,v] of [...cidades].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR")))
     select.add(new Option(v,k));
   select.value=cidades.has(anterior)?anterior:"";
 }
 function pendencias(grupo){
   const principal=grupo.variantes[0].nome;
   return grupo.variantes.slice(1).filter(v=>{
     const k=A.chave(grupo.local,principal,v.nome);
     return !["MESMO","DIFERENTES"].includes(estado.decisoes.get(k));
   }).length;
 }
 function listarFiltrados(){
   const cidade=$("clientesCidade")?.value||"",q=A.normalizar($("clientesBusca")?.value||""),
     situacao=$("clientesFiltro")?.value||"pendentes";
   return estado.grupos.filter(g=>{
     if(cidade&&g.local!==cidade)return false;
     const p=pendencias(g);
     if(situacao==="pendentes"&&p===0)return false;
     if(situacao==="conferidos"&&p!==0)return false;
     if(!q)return true;
     return A.normalizar(g.cidade).includes(q)||g.variantes.some(v=>
       A.normalizar(v.nome).includes(q)||[...v.nfs.values()].some(n=>A.normalizar(n.nf).includes(q)));
   });
 }
 function renderizarNotas(v){
   const notas=[...v.nfs.values()];
   if(!notas.length)return '<p class="clientes-vazio">Sem NF identificada.</p>';
   const montar=arr=>'<ul class="clientes-nfs">'+arr.map(n=>
     '<li><strong>NF '+html(n.nf)+'</strong>'+
       (n.transporte?' <small>· '+html(n.transporte)+'</small>':'')+'</li>').join("")+'</ul>';
   if(notas.length<=8)return montar(notas);
   return montar(notas.slice(0,5))+
     '<details class="clientes-mais-nfs"><summary>Ver todas as '+notas.length+
       ' NFs desta variação</summary>'+montar(notas)+'</details>';
 }
 function renderizarGrupo(g){
   const principal=g.variantes[0].nome;
   const entradas=g.variantes.map((v,i)=>{
     const k=i?A.chave(g.local,principal,v.nome):null,
       status=k?estado.decisoes.get(k)||"PENDENTE":"REFERENCIA",
       score=i?A.pontuar(principal,v.nome):100;
     let botoes="";
     if(i){
       const id=g.id+"-"+i;estado.pares.set(id,{chave:k,cidade:g.cidade,a:principal,b:v.nome});
       const disabled=estado.banco?"":" disabled title=\"Banco de decisões indisponível\"";
       botoes='<div class="clientes-acoes" role="group" aria-label="Conferir '+html(v.nome)+'">'+
         '<button type="button" data-cliente-par="'+id+'" data-cliente-status="MESMO"'+disabled+
           '>Mesmo cliente</button>'+
         '<button type="button" data-cliente-par="'+id+'" data-cliente-status="DIFERENTES"'+disabled+
           '>Clientes diferentes</button>'+
         '<button type="button" data-cliente-par="'+id+'" data-cliente-status="PENDENTE"'+disabled+
           '>Reabrir revisão</button></div>';
     }
     return '<div class="clientes-variante"><div class="clientes-variante-titulo">'+
       '<strong>'+html(v.nome)+'</strong><span class="clientes-marcador">'+
       (i===0?'Referência':status==="MESMO"?"Mesmo cliente":status==="DIFERENTES"?"Diferentes":
         "Revisar · "+score+"% semelhança")+'</span></div>'+
       '<p>'+v.ocorrencias+' registro(s) · '+v.nfs.size+' NF(s) distinta(s)</p>'+
       renderizarNotas(v)+botoes+'</div>';
   }).join("");
   const p=pendencias(g);
   return '<article class="clientes-grupo"><div class="clientes-grupo-cabecalho">'+
     '<div><small>'+html(g.cidade)+'</small><h3>'+html(principal)+'</h3></div>'+
     '<span class="clientes-marcador">'+(p?p+" pendência(s)":"Revisado")+'</span></div>'+
     '<p class="clientes-meta">'+g.variantes.length+' nomes registrados · '+
       g.totalNfs+' NF(s) vinculadas</p>'+entradas+'</article>';
 }
 function renderizar(){
   const lista=$("clientesResultados"),resumo=$("clientesResumo");
   if(!lista)return;
   estado.pares.clear();
   const filtrados=listarFiltrados();
   const pendentes=estado.grupos.filter(g=>pendencias(g)>0).length;
   if(resumo)resumo.textContent=estado.grupos.length+" grupo(s) de nomes semelhantes · "+
     pendentes+" pendente(s) · "+filtrados.length+" neste filtro";
   lista.innerHTML=filtrados.slice(0,estado.limite).map(renderizarGrupo).join("")||
     '<div class="painel clientes-vazio">Nenhum grupo encontrado para este filtro.</div>';
   const mais=$("clientesMais");
   if(mais){mais.hidden=filtrados.length<=estado.limite;
     mais.textContent="Mostrar mais ("+(filtrados.length-estado.limite)+")";}
 }
 async function atualizar(forcar=false){
   if(estado.carregando)return;
   try{
     sessao();
     if(!forcar&&estado.grupos.length&&Date.now()-estado.ultima<300000){
       renderizar();return;
     }
     estado.carregando=true;
     const geracao=++estado.geracao,botao=$("clientesAtualizar");
     if(botao)botao.disabled=true;
     mensagem("Consultando os rastreios no Supabase...");
     const linhas=await obterRegistros();
     if(geracao!==estado.geracao)return;
     const grupos=A.agrupar(linhas);
     await obterDecisoes();
     if(geracao!==estado.geracao)return;
     estado.grupos=grupos;estado.ultima=Date.now();estado.limite=20;
     preencherCidades();renderizar();
     mensagem(linhas.length.toLocaleString("pt-BR")+" registros analisados. "+
       (estado.banco?"Decisões sincronizadas no Supabase.":
       "Modo consulta: decisões indisponíveis até ativar o banco de auditoria."));
   }catch(e){mensagem("Não foi possível analisar os clientes: "+(e.message||e),true);}
   finally{estado.carregando=false;const btn=$("clientesAtualizar");if(btn)btn.disabled=false;}
 }
 async function decidir(el){
   const pair=estado.pares.get(el.dataset.clientePar),valor=el.dataset.clienteStatus;
   if(!pair||!["MESMO","DIFERENTES","PENDENTE"].includes(valor)||!estado.banco)return;
   if(valor==="MESMO"&&!confirm("Você conferiu os CNPJs das NFs e confirmou que representam o MESMO cliente?"))return;
   if(valor==="DIFERENTES"&&!confirm("Confirmar que os CNPJs correspondem a clientes diferentes?"))return;
   el.disabled=true;
   try{
     const r=await window.clienteSupabase.rpc("pmobile_clientes_salvar_decisao",{
       ...sessao(),p_chave:pair.chave,p_cidade:pair.cidade,p_nome_a:pair.a,
       p_nome_b:pair.b,p_status:valor
     });
     if(r.error)throw r.error;
     estado.decisoes.set(pair.chave,valor);
     renderizar();mensagem("Conferência registrada no Supabase. Nenhuma NF foi modificada.");
   }catch(e){mensagem("Falha ao salvar a conferência: "+(e.message||e),true);}
   finally{el.disabled=false;}
 }
 function abrir(){
   try{sessao();}catch(e){alert(e.message);return;}
   if(typeof window.mostrarTelaSistema!=="function")return;
   window.mostrarTelaSistema("clientes","menuTransportes");
   void atualizar();
 }
 function voltar(id){
   if(id!=="clientes")return false;
   if(typeof window.abrirTransportesPmobile!=="function")return false;
   window.abrirTransportesPmobile();return true;
 }
 function iniciar(){
   const tela=$("clientes");
   if(!tela)return;
   $("clientesAtualizar")?.addEventListener("click",()=>void atualizar(true));
   $("clientesMais")?.addEventListener("click",()=>{estado.limite+=20;renderizar();});
   for(const id of ["clientesCidade","clientesFiltro","clientesBusca"]){
     $(id)?.addEventListener(id==="clientesBusca"?"input":"change",()=>{
       estado.limite=20;renderizar();
     });
   }
   tela.addEventListener("click",e=>{
     const el=e.target.closest("[data-cliente-par][data-cliente-status]");
     if(el&&tela.contains(el))void decidir(el);
   });
 }
 window.PMobileModulos?.registrarAcao("clientes",abrir);
 window.PMobileModulos?.registrarRetorno("clientes",voltar);
 window.abrirClientesPmobile=abrir;
 window.addEventListener("pmobile:rastreio-atualizado",()=>{estado.ultima=0;});
 window.addEventListener("pmobile:sessao-alterada",()=>{
   if(!window.usuarioPmobileAtual){estado.grupos=[];estado.decisoes.clear();estado.ultima=0;}
 });
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar);
 else iniciar();
})();
