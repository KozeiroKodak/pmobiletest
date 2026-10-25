// Resumo financeiro independente do Rastreio, persistido no Supabase.
function abrirValoresTotal() { mostrarTelaSistema("valoresTotal","menuValoresTotal"); carregarValoresTotal(); }
async function carregarValoresTotal() {
 const status=document.getElementById("valoresTotalStatus"), cards=document.getElementById("valoresTotalCards"); if(!cards)return;
 try { const sessao=obterSessaoRastreioImportacao(); const r=await window.clienteSupabase.rpc("pmobile_valores_total_obter",{p_usuario:sessao.usuario,p_credencial:sessao.credencial}); if(r.error)throw r.error;
 const v=Array.isArray(r.data)?r.data[0]:r.data;if(!v){status.textContent="Aguardando a próxima importação ou sincronização da planilha.";cards.replaceChildren();return;}
 const moeda=n=>n==null?"—":Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const campos=[["Total das notas fiscais",moeda(v.valor_notas)],["Fretes embutidos (cliente paga)",moeda(v.fretes_embutidos)],["Total dos fretes",moeda(v.total_fretes)],["Custo do frete Nunes",moeda(v.custo_nunes)],["Custo final",moeda(v.custo_final)],["% Final",v.percentual_final==null||!Number.isFinite(Number(v.percentual_final))||Math.abs(Number(v.percentual_final))>1?"—":(Number(v.percentual_final)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%"]];
 cards.replaceChildren();for(const [titulo,valor] of campos){const card=document.createElement("div");card.style.cssText="background:#1b1b1b;border:1px solid #333;border-radius:12px;padding:18px";const label=document.createElement("div");label.style.cssText="color:#aaa;font-size:13px;margin-bottom:10px";label.textContent=titulo;const numero=document.createElement("strong");numero.style.cssText="font-size:clamp(18px,3vw,26px);overflow-wrap:anywhere";numero.textContent=valor;card.append(label,numero);cards.append(card);}
 status.textContent="Fonte: "+(v.origem||"planilha")+" · Atualizado em "+new Date(v.atualizado_em).toLocaleString("pt-BR");
 await carregarValoresMensais(cards,sessao);
 }catch(e){status.textContent="Não foi possível carregar os valores: "+(e.message||e);}
}
function extrairValoresTotalPlanilha(){const d=typeof dadosImportacaoRastreio!=="undefined"?dadosImportacaoRastreio:null;if(!d?.linhas?.length)return null;
 const linha=[...d.linhas].reverse().find(l=>/^TOTAL(?:\s*GERAL)?$/i.test(String(l?.[0]??"").trim()));if(!linha)return null;
 const colunas=d.colunas||[];const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 const coluna=(nomes,indicePadrao)=>{const i=colunas.findIndex(c=>nomes.some(n=>norm(c).includes(norm(n))));return i>=0?i:indicePadrao;};
 const numero=v=>{if(typeof v==="number")return v;const t=String(v??"").replace(/[^\d,.-]/g,"");if(!t)return null;return Number(t.includes(",")?t.replace(/\./g,"").replace(",","."):t)||0;};
 return {p_valor_notas:numero(linha[coluna(["valor nf","valor n.f","valor nota"],6)]),p_fretes_embutidos:numero(linha[coluna(["frete embutido"],7)]),p_total_fretes:numero(linha[coluna(["frete transporte","valor frete"],8)]),p_custo_nunes:numero(linha[coluna(["custo nunes"],12)]),p_custo_final:numero(linha[coluna(["custo final"],13)]),p_percentual_final:(()=>{const i=colunas.findIndex(c=>["% final","percentual final"].some(n=>norm(c)===norm(n)));if(i<0)return null;const valor=numero(linha[i]);return valor!=null&&Number.isFinite(valor)&&Math.abs(valor)<=1?valor:null;})(),p_origem:d.arquivo?.name||"OneDrive"};
}
async function salvarValoresTotalPlanilha(){const valores=extrairValoresTotalPlanilha();if(!valores)return;const sessao=obterSessaoRastreioImportacao();const r=await window.clienteSupabase.rpc("pmobile_valores_total_salvar",{p_usuario:sessao.usuario,p_credencial:sessao.credencial,...valores});if(r.error)throw r.error;if(document.getElementById("valoresTotal")?.style.display!=="none")await carregarValoresTotal();}


// Resumo mensal por data de envio; somente a fonte sincronizada evita duplicar importações antigas.
async function carregarValoresMensais(cards,sessao) {
 const anterior=document.getElementById("valoresTotalMensais");if(anterior)anterior.remove();
 const secao=document.createElement("section");secao.id="valoresTotalMensais";secao.style.cssText="grid-column:1/-1;margin-top:24px";
 const titulo=document.createElement("h3");titulo.textContent="Valores por mês";titulo.style.cssText="font-size:20px;margin:0 0 8px";
 const descricao=document.createElement("p");descricao.textContent="Por data de envio · do mês mais recente ao mais antigo";descricao.style.cssText="color:#aaa;font-size:13px;margin:0 0 16px";
 secao.append(titulo,descricao);cards.after(secao);
 const moeda=n=>n==null?"—":Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 try {
  const resposta=await window.clienteSupabase.rpc("pmobile_valores_total_mensal_obter",{p_usuario:sessao.usuario,p_credencial:sessao.credencial});
  if(resposta.error)throw resposta.error;
  const meses=Array.isArray(resposta.data)?resposta.data:[];
  if(!meses.length){const vazio=document.createElement("p");vazio.textContent="Nenhum mês disponível na fonte sincronizada.";secao.append(vazio);return;}
  for(const m of meses){
   const detalhe=document.createElement("details");detalhe.style.cssText="background:#1b1b1b;border:1px solid #333;border-radius:12px;margin-bottom:12px;padding:16px";
   const cabecalho=document.createElement("summary");cabecalho.style.cssText="cursor:pointer;font-weight:700;font-size:17px";
   const partes=String(m.mes).split("-");const data=new Date(Number(partes[0]),Number(partes[1])-1,1);
   cabecalho.textContent=data.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})+" · "+Number(m.quantidade).toLocaleString("pt-BR")+" lançamentos";
   const grade=document.createElement("div");grade.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:16px";
   const itens=[["Total das notas fiscais",m.valor_notas],["Fretes embutidos (cliente paga)",m.fretes_embutidos],["Total dos fretes",m.total_fretes],["Custo do frete Nunes",m.custo_nunes],["Custo final",m.custo_final]];
   for(const [rotulo,valor] of itens){const item=document.createElement("div");item.style.cssText="background:#151515;border:1px solid #303030;border-radius:10px;padding:14px";const nome=document.createElement("div");nome.textContent=rotulo;nome.style.cssText="color:#aaa;font-size:12px;margin-bottom:8px";const numero=document.createElement("strong");numero.textContent=moeda(valor);numero.style.cssText="font-size:19px;overflow-wrap:anywhere";item.append(nome,numero);grade.append(item);}
   const percentual=document.createElement("div");percentual.style.cssText="background:#151515;border:1px solid #303030;border-radius:10px;padding:14px";const pctTitulo=document.createElement("div");pctTitulo.textContent="% Final";pctTitulo.style.cssText="color:#aaa;font-size:12px;margin-bottom:8px";const pctValor=document.createElement("strong");pctValor.style.fontSize="19px";pctValor.textContent=m.percentual_final==null?"—":(Number(m.percentual_final)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%";percentual.append(pctTitulo,pctValor);grade.append(percentual);
   detalhe.append(cabecalho,grade);
   if(m.custo_nunes==null||m.custo_final==null||m.percentual_final==null){const nota=document.createElement("p");nota.textContent="Alguns valores ainda não estão disponíveis na planilha sincronizada.";nota.style.cssText="color:#999;font-size:12px;margin:14px 0 0";detalhe.append(nota);}
ecao.append(detalhe);
  }
 }catch(e){const aviso=document.createElement("p");aviso.textContent="Não foi possível carregar os meses: "+(e.message||e);aviso.style.color="#f88";secao.append(aviso);}
}
