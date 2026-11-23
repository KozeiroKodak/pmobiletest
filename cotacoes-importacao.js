(function(){
"use strict";
// Importador de cidades para Cotações; não toca no Rastreio nem envia planilhas sem confirmação.
const $=id=>document.getElementById(id);
const normal=v=>String(v==null?"":v).trim().replace(/\s+/g," ");
const chave=v=>normal(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR");
let linhas=[];
let nomeArquivo="";
let processando=false;
const limite=15000;
function status(mensagem,erro){
 const el=$("cotImportacaoStatus");
 if(el){el.textContent=mensagem;el.dataset.erro=erro?"sim":"nao";}
}
function atualizarBotao(){
 const botao=$("cotImportacaoConfirmar");
 if(botao)botao.disabled=processando||!linhas.length;
}
function abrirImportacaoCotacoes(){
 const painel=$("cotImportacaoPainel");
 if(!painel)return;
 painel.hidden=!painel.hidden;
 if(!painel.hidden){
  if(window.usuarioPmobileAtual?.nivel!=="ADMIN"){
   status("Somente administradores podem importar cidades. Os demais acessos continuam consultando normalmente.",true);
  }else if(!linhas.length)status("Selecione um Excel com as colunas UF, Destino e TDA.",false);
  painel.scrollIntoView({behavior:"smooth",block:"nearest"});
 }
}
function preview(rows){
 const alvo=$("cotImportacaoPrevia");
 if(!alvo)return;
 alvo.replaceChildren();
 if(!rows.length)return;
 const resumo=document.createElement("p");
 resumo.className="cot-importacao-resumo";
 resumo.textContent=rows.length.toLocaleString("pt-BR")+" cidades conferidas. Confira a prévia antes de enviar.";
 alvo.appendChild(resumo);
 const tabela=document.createElement("table");
 tabela.className="cot-importacao-tabela";
 const thead=document.createElement("thead");
 const trh=document.createElement("tr");
 for(const h of ["UF","Destino","TDA"]){const th=document.createElement("th");th.textContent=h;trh.appendChild(th);}
 thead.appendChild(trh);tabela.appendChild(thead);
 const tbody=document.createElement("tbody");
 for(const r of rows.slice(0,15)){
  const tr=document.createElement("tr");
  for(const val of [r.uf,r.destino,r.tda]){
   const td=document.createElement("td");td.textContent=val;tr.appendChild(td);
  }
  tbody.appendChild(tr);
 }
 tabela.appendChild(tbody);alvo.appendChild(tabela);
 if(rows.length>15){
  const aviso=document.createElement("small");
  aviso.textContent="Prévia das primeiras 15 linhas. A confirmação incluirá "+rows.length.toLocaleString("pt-BR")+" linhas.";
  alvo.appendChild(aviso);
 }
}
async function prepararArquivoCotacoes(){
 linhas=[];nomeArquivo="";preview([]);atualizarBotao();
 const input=$("cotImportacaoArquivo"),arquivo=input?.files?.[0];
 if(!arquivo){status("Nenhum arquivo selecionado.",true);return;}
 try{
  if(arquivo.size>20*1024*1024)throw Error("Arquivo acima de 20 MB.");
  if(!/\.(xlsx|xls|csv)$/i.test(arquivo.name))throw Error("Selecione um arquivo Excel ou CSV.");
  if(!window.XLSX?.read||!window.XLSX?.utils?.sheet_to_json)throw Error("Leitor de Excel indisponível.");
  status("Analisando arquivo localmente...",false);
  const livro=window.XLSX.read(await arquivo.arrayBuffer(),{type:"array",cellDates:false});
  if(!Array.isArray(livro.SheetNames)||!livro.SheetNames.length)throw Error("A planilha não contém abas.");
  // Planilhas de origem podem incluir título, observações, outras colunas e outras abas.
  // Importar EXCLUSIVAMENTE UF, Destino e TDA, identificados pelos nomes do cabeçalho.
  const abaPreferida=n=>/^(CIDADES ATENDIDAS|IMPORTACAO PMOBILE)$/.test(chave(n));
  const abas=[...livro.SheetNames].sort((a,b)=>Number(abaPreferida(b))-Number(abaPreferida(a)));
  let origem=null;
  for(const nomeAba of abas){
   const matriz=window.XLSX.utils.sheet_to_json(livro.Sheets[nomeAba],{
    header:1,raw:false,defval:"",blankrows:false
   });
   for(let pos=0;pos<Math.min(50,matriz.length);pos++){
    const nomes=(matriz[pos]||[]).map(v=>chave(v).replace(/[^A-Z0-9]/g,""));
    const col={uf:nomes.indexOf("UF"),destino:nomes.indexOf("DESTINO"),tda:nomes.indexOf("TDA")};
    if(col.uf>=0&&col.destino>=0&&col.tda>=0){
     origem={nomeAba,matriz,primeira:pos+1,col};
     break;
    }
   }
   if(origem)break;
  }
  if(!origem)throw Error("Cabeçalho UF, Destino e TDA não encontrado. Verifique os nomes dessas colunas na planilha.");
  const {matriz,col,primeira,nomeAba}=origem;
  const vistos=new Set(),falhas=[],extraidas=[];
  let excluidas=0;
  for(let i=primeira;i<matriz.length;i++){
   const r=matriz[i]||[];
   const uf=chave(r[col.uf]),destino=normal(r[col.destino]),tda=normal(r[col.tda]);
   if(!uf&&!destino&&!tda)continue;
   // A planilha original da Transcelo identifica localidades expressamente não atendidas.
   // Não transformá-las em cidades atendidas; informar o total excluído antes do envio.
   if(r.some(c=>/\bNAO\s+ATENDEMOS\b/.test(chave(c)))){excluidas++;continue;}
   if(uf==="UF"&&chave(destino)==="DESTINO"&&chave(tda)==="TDA")continue;
   if(!/^[A-Z]{2}$/.test(uf)||destino.length<2||destino.length>180||tda.length>100){
    falhas.push("Linha "+(i+1)+": confira UF, Destino e TDA.");continue;
   }
   const id=uf+"|"+chave(destino);
   if(vistos.has(id)){falhas.push("Linha "+(i+1)+": cidade duplicada ("+destino+" / "+uf+").");continue;}
   vistos.add(id);
   extraidas.push({uf,destino,tda});
   if(extraidas.length>limite)throw Error("Limite de "+limite.toLocaleString("pt-BR")+" localidades por arquivo.");
  }
  if(!extraidas.length)throw Error("Nenhum destino válido foi encontrado.");
  if(falhas.length)throw Error("Corrija "+falhas.length+" problema(s) na planilha. "+falhas.slice(0,4).join(" "));
  linhas=extraidas;nomeArquivo=arquivo.name;preview(linhas);
  const aviso=excluidas?" "+excluidas+" localidade(s) marcadas como NÃO ATENDEMOS foram excluídas.":"";
  status("Aba "+nomeAba+", cabeçalho na linha "+primeira+": "+linhas.length+" destinos preparados. Outras colunas ignoradas."+aviso+" Nada foi enviado; confira a prévia e informe a transportadora para confirmar.",false);
 }catch(e){
  linhas=[];nomeArquivo="";preview([]);
  status("Não foi possível preparar o arquivo: "+(e.message||e),true);
 }finally{atualizarBotao();}
}
async function rpc(nome,parametros){
 const api=window.clienteSupabase;
 if(!api?.rpc)throw Error("Conexão com Supabase indisponível.");
 const {data,error}=await api.rpc(nome,parametros);
 if(error)throw Error(error.message||"Falha de comunicação.");
 return data;
}
async function confirmarImportacaoCotacoes(){
 if(processando||!linhas.length)return;
 if(window.usuarioPmobileAtual?.nivel!=="ADMIN"){
  status("A importação exige acesso administrativo.",true);return;
 }
 const transportadora=normal($("cotImportacaoTransportadora")?.value);
 if(transportadora.length<2||transportadora.length>100){
  status("Informe o nome da transportadora (2 a 100 caracteres).",true);return;
 }
 const usuario=window.usuarioPmobileAtual?.usuario;
 const credencial=window.credencialPmobileAtual;
 if(!usuario||!credencial){status("Faça login novamente para importar.",true);return;}
 if(!window.confirm("Confirmar "+linhas.length.toLocaleString("pt-BR")+" cidades para "+transportadora+"? Se já houver dados desta transportadora, a nova lista ficará ativa após concluir o envio. A versão anterior continuará guardada no histórico."))return;
 processando=true;atualizarBotao();
 try{
  const comum={p_usuario:usuario,p_credencial:credencial};
  const id=await rpc("pmobile_cotacoes_importar_iniciar_v1",{
   ...comum,p_transportadora:transportadora,p_arquivo:nomeArquivo
  });
  if(typeof id!=="string"||!id)throw Error("Não foi possível iniciar a importação.");
  for(let i=0;i<linhas.length;i+=200){
   const bloco=linhas.slice(i,i+200);
   await rpc("pmobile_cotacoes_importar_lote_v1",{...comum,p_importacao_id:id,p_linhas:bloco});
   const total=Math.min(i+bloco.length,linhas.length);
   status("Enviando "+total.toLocaleString("pt-BR")+" / "+linhas.length.toLocaleString("pt-BR")+" cidades...",false);
  }
  const total=await rpc("pmobile_cotacoes_importar_finalizar_v1",{
   ...comum,p_importacao_id:id,p_esperado:linhas.length
  });
  status("Importação concluída: "+total+" cidades de "+transportadora+". A versão anterior desta transportadora foi preservada no histórico. Nenhuma outra transportadora foi alterada.",false);
  linhas=[];nomeArquivo="";
  if($("cotImportacaoArquivo"))$("cotImportacaoArquivo").value="";
  preview([]);
  window.dispatchEvent(new CustomEvent("pmobile:cotacoes-atualizadas"));
 }catch(e){
  status("Importação sem confirmação final: "+(e.message||e)+". Se a rede caiu durante a finalização, a lista pode ter sido publicada. Consulte Cotações por Região antes de reenviar.",true);
 }finally{processando=false;atualizarBotao();}
}
window.abrirImportacaoCotacoes=abrirImportacaoCotacoes;
window.prepararArquivoCotacoes=prepararArquivoCotacoes;
window.confirmarImportacaoCotacoes=confirmarImportacaoCotacoes;
})();