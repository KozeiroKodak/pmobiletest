/* PMobile — Pesquisa independente de cidades de planilhas ativas (somente leitura). */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const estado={pesquisa:"",offset:0,limite:80,total:0,carregando:false,sequencia:0,
 cidades:[],cache:new Map(),selecionado:null,temporizador:null};
const normal=v=>String(v==null?"":v).trim();
function status(texto,erro=false){
 const el=$("cotPesqImportStatus");
 if(el){el.textContent=texto;el.dataset.erro=erro?"sim":"nao";}
}
function elemento(tag,texto,classe){
 const e=document.createElement(tag);
 if(classe)e.className=classe;
 if(texto!==undefined)e.textContent=String(texto);
 return e;
}
function limpar(el){if(el)el.replaceChildren();}
function credenciais(){
 const usuario=window.usuarioPmobileAtual?.usuario;
 const credencial=window.credencialPmobileAtual;
 if(!usuario||!credencial)throw Error("Faça login para consultar as importações.");
 return {p_usuario:usuario,p_credencial:credencial};
}
async function consulta(nome,parametros){
 if(!window.clienteSupabase?.rpc)throw Error("Conexão com Supabase indisponível.");
 const {data,error}=await window.clienteSupabase.rpc(nome,parametros);
 if(error)throw Error(error.message||"Falha na consulta ao Supabase.");
 if(!Array.isArray(data))throw Error("O Supabase retornou uma resposta inválida.");
 return data;
}
function atualizarControle(){
 const b=$("cotPesqImportMais");
 if(b){
  b.hidden=!estado.cidades.length||estado.cidades.length>=estado.total;
  b.disabled=estado.carregando;
 }
 const cont=$("cotPesqImportContagem");
 if(cont)cont.textContent=estado.total?
  estado.cidades.length.toLocaleString("pt-BR")+" de "+estado.total.toLocaleString("pt-BR")+" cidades exibidas":
  "Nenhuma cidade encontrada";
}
function adicionarCidades(rows){
 const lista=$("cotPesqImportLista");
 if(!lista)return;
 for(const r of rows){
  const uf=normal(r.uf).toUpperCase(),destino=normal(r.destino);
  if(!/^[A-Z]{2}$/.test(uf)||!destino)continue;
  const b=elemento("button",undefined,"cot-row cot-pesq-import-linha");
  b.type="button";
  b.dataset.cotCidadeUf=uf;
  b.dataset.cotCidadeDestino=destino;
  b.appendChild(elemento("span","📍 "+destino+" / "+uf));
  const qt=Number(r.total_transportadoras)||0;
  b.appendChild(elemento("small",qt+" transportadora(s) ›"));
  lista.appendChild(b);
 }
}
function mostrarDetalhe(visivel){
 const buscador=$("cotPesqImportBuscador"),detalhe=$("cotPesqImportDetalhe");
 if(buscador)buscador.hidden=visivel;
 if(detalhe)detalhe.hidden=!visivel;
}
async function carregarCidades(acrescentar=false){
 if(estado.carregando)return;
 if(!acrescentar){estado.cidades=[];estado.cache.clear();estado.offset=0;limpar($("cotPesqImportLista"));}
 const seq=++estado.sequencia;
 estado.carregando=true;atualizarControle();
 status("Consultando cidades das planilhas importadas...");
 try{
  const registros=await consulta("pmobile_cotacoes_cidades_detalhadas_v2",{
   ...credenciais(),p_busca:estado.pesquisa,p_limit:estado.limite,p_offset:estado.offset
  });
  if(seq!==estado.sequencia)return;
  const validos=registros.filter(r=>/^[A-Z]{2}$/.test(normal(r.uf).toUpperCase())&&normal(r.destino));
  if(validos.some(r=>!Array.isArray(r.transportadoras)))
   throw Error("Resposta incompleta do catálogo. Atualize o PMobile antes de consultar.");
  for(const r of validos){
   estado.cache.set(normal(r.uf).toUpperCase()+"|"+normal(r.destino),r.transportadoras);
  }
  estado.total=registros.length?(Number(registros[0].total_cidades)||0):(acrescentar?estado.cidades.length:0);
  estado.cidades.push(...validos);
  estado.offset+=registros.length;
  adicionarCidades(validos);
  if(!estado.total){
   const lista=$("cotPesqImportLista");
   if(lista)lista.appendChild(elemento("p",
    estado.pesquisa?"Nenhuma cidade corresponde à pesquisa.":"Nenhuma cidade importada está ativa no momento.","cot-empty"));
  }
  status(estado.total?estado.total.toLocaleString("pt-BR")+" cidade(s) de importações ativas. Selecione uma para ver as transportadoras.":
   "Nenhuma cidade encontrada.",false);
 }catch(e){
  if(seq!==estado.sequencia)return;
  status("Não foi possível consultar as cidades: "+(e.message||e),true);
 }finally{
  if(seq===estado.sequencia){estado.carregando=false;atualizarControle();}
 }
}
async function abrirPesquisaImportacoes(){
 if(typeof window.mostrarTelaSistema!=="function")return;
 window.mostrarTelaSistema("cotacoesPesquisaImportadas","menuTransportes");
 if(estado.temporizador)clearTimeout(estado.temporizador);
 estado.pesquisa="";
 estado.selecionado=null;
 estado.cache.clear();
 estado.carregando=false;
 estado.total=0;
 ++estado.sequencia;
 const input=$("cotPesqImportBusca");if(input)input.value="";
 mostrarDetalhe(false);
 await carregarCidades(false);
}
function pesquisarCidadesImportadas(){
 if(estado.temporizador)clearTimeout(estado.temporizador);
 estado.pesquisa=normal($("cotPesqImportBusca")?.value);
 estado.total=0;
 estado.carregando=false;
 ++estado.sequencia; // Ignora respostas antigas quando o filtro muda.
 carregarCidades(false);
}
function programarPesquisaCidadesImportadas(){
 if(estado.temporizador)clearTimeout(estado.temporizador);
 estado.temporizador=setTimeout(pesquisarCidadesImportadas,300);
}
function abrirCidadeImportada(uf,destino){
 if(!/^[A-Z]{2}$/.test(uf)||!normal(destino))return;
 if(estado.temporizador)clearTimeout(estado.temporizador);
 const rows=estado.cache.get(uf+"|"+normal(destino));
 if(!Array.isArray(rows)){
  status("Os dados desta cidade ainda não estão disponíveis. Atualize a lista e tente novamente.",true);
  return;
 }
 estado.selecionado={uf,destino};
 estado.carregando=false;
 ++estado.sequencia;
 const title=$("cotPesqImportCidadeTitulo");
 if(title)title.textContent=destino+" / "+uf;
 const lista=$("cotPesqImportTransportadoras");
 limpar(lista);
 mostrarDetalhe(true);
 if(!rows.length){
  if(lista)lista.appendChild(elemento("p","Nenhuma transportadora ativa para esta cidade.","cot-empty"));
 }
 for(const r of rows){
  const item=elemento("div",undefined,"cot-row cot-pesq-import-transportadora");
  const bloco=elemento("span");
  bloco.appendChild(elemento("strong","🚛 "+normal(r.transportadora)));
  item.appendChild(bloco);
  item.appendChild(elemento("small",normal(r.tda)?"TDA: "+normal(r.tda):"TDA não informada"));
  if(lista)lista.appendChild(item);
 }
 status(rows.length+" transportadora(s) atendem "+destino+" / "+uf+".");
}
function voltarCidadesImportadas(){
 ++estado.sequencia;
 estado.selecionado=null;
 mostrarDetalhe(false);
 status(estado.total?estado.total.toLocaleString("pt-BR")+" cidade(s) encontradas.":"Pesquise uma cidade ou UF.");
 atualizarControle();
}
document.addEventListener("click",e=>{
 const alvo=e.target.closest("[data-cot-cidade-uf][data-cot-cidade-destino]");
 if(alvo)abrirCidadeImportada(alvo.dataset.cotCidadeUf,alvo.dataset.cotCidadeDestino);
});
window.addEventListener("pmobile:cotacoes-atualizadas",()=>{
 const tela=$("cotacoesPesquisaImportadas");
 if(tela&&getComputedStyle(tela).display!=="none"){
  estado.selecionado=null;estado.cache.clear();mostrarDetalhe(false);pesquisarCidadesImportadas();
 }
});
window.abrirPesquisaImportacoes=abrirPesquisaImportacoes;
window.pesquisarCidadesImportadas=pesquisarCidadesImportadas;
window.programarPesquisaCidadesImportadas=programarPesquisaCidadesImportadas;
window.carregarMaisCidadesImportadas=()=>carregarCidades(true);
window.voltarCidadesImportadas=voltarCidadesImportadas;
})();