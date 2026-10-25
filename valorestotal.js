// Resumo financeiro independente do Rastreio, persistido no Supabase.
function abrirValoresTotal() { mostrarTelaSistema("valoresTotal","menuValoresTotal"); carregarValoresTotal(); }
async function carregarValoresTotal() {
 const status=document.getElementById("valoresTotalStatus"), cards=document.getElementById("valoresTotalCards"); if(!cards)return;
 try { const sessao=obterSessaoRastreioImportacao(); const r=await window.clienteSupabase.rpc("pmobile_valores_total_obter",{p_usuario:sessao.usuario,p_credencial:sessao.credencial}); if(r.error)throw r.error;
 const v=Array.isArray(r.data)?r.data[0]:r.data;if(!v){status.textContent="Aguardando a próxima importação ou sincronização da planilha.";cards.replaceChildren();return;}
 const moeda=n=>n==null?"—":Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const campos=[["Total das notas fiscais",moeda(v.valor_notas)],["Fretes embutidos (cliente paga)",moeda(v.fretes_embutidos)],["Total dos fretes",moeda(v.total_fretes)],["Custo do frete Nunes",moeda(v.custo_nunes)],["Custo final",moeda(v.custo_final)],["% Final",v.percentual_final==null?"—":(Number(v.percentual_final)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%"];
 cards.replaceChildren();for(const [titulo,valor] of campos){const card=document.createElement("div");card.style.cssText="background:#1b1b1b;border:1px solid #333;border-radius:12px;padding:18px";const label=document.createElement("div");label.style.cssText="color:#aaa;font-size:13px;margin-bottom:10px";label.textContent=titulo;const numero=document.createElement("strong");numero.style.cssText="font-size:clamp(18px,3vw,26px);overflow-wrap:anywhere";numero.textContent=valor;card.append(label,numero);cards.append(card);}
 status.textContent="Fonte: "+(v.origem||"planilha")+" · Atualizado em "+new Date(v.atualizado_em).toLocaleString("pt-BR");
 }catch(e){status.textContent="Não foi possível carregar os valores: "+(e.message||e);}
}
function extrairValoresTotalPlanilha(){const d=typeof dadosImportacaoRastreio!=="undefined"?dadosImportacaoRastreio:null;if(!d?.linhas?.length)return null;
 const linha=[...d.linhas].reverse().find(l=>/^TOTAL(?:\s*GERAL)?$/i.test(String(l?.[0]??"").trim()));if(!linha)return null;
 const colunas=d.colunas||[];const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 const coluna=(nomes,indicePadrao)=>{const i=colunas.findIndex(c=>nomes.some(n=>norm(c).includes(norm(n))));return i>=0?i:indicePadrao;};
 const numero=v=>{if(typeof v==="number")return v;const t=String(v??"").replace(/[^\d,.-]/g,"");if(!t)return null;return Number(t.includes(",")?t.replace(/\./g,"").replace(",","."):t)||0;};
 return {p_valor_notas:numero(linha[coluna(["valor nf","valor n.f","valor nota"],6)]),p_fretes_embutidos:numero(linha[coluna(["frete embutido"],7)]),p_total_fretes:numero(linha[coluna(["frete transporte","valor frete"],8)]),p_custo_nunes:numero(linha[coluna(["custo nunes"],12)]),p_custo_final:numero(linha[coluna(["custo final"],13)]),p_percentual_final:numero(linha[coluna(["% final","percentual final"],14)]),p_origem:d.arquivo?.name||"OneDrive"};
}
async function salvarValoresTotalPlanilha(){const valores=extrairValoresTotalPlanilha();if(!valores)return;const sessao=obterSessaoRastreioImportacao();const r=await window.clienteSupabase.rpc("pmobile_valores_total_salvar",{p_usuario:sessao.usuario,p_credencial:sessao.credencial,...valores});if(r.error)throw r.error;if(document.getElementById("valoresTotal")?.style.display!=="none")await carregarValoresTotal();}
