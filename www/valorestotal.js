// Resumo financeiro calculado no Supabase diretamente dos rastreios operacionais ativos.
// Faixas de custo percentual: até 4% verde, acima de 4% amarelo, acima de 4,5% vermelho.
function corFaixaPercentual(valor) {
 const n=Number(valor);
 if(valor==null||!Number.isFinite(n)||n<0||n>1)return null;
 return n>0.045?"#ef6666":n>0.04?"#f0c35a":"#d7d7d7";
}

function abrirValoresTotal() { mostrarTelaSistema("valoresTotal","menuValoresTotal"); carregarValoresTotal(); }
async function carregarValoresTotal() {
 const status=document.getElementById("valoresTotalStatus"), cards=document.getElementById("valoresTotalCards"); if(!cards)return;
 try { const sessao=obterSessaoRastreioImportacao(); const r=await window.clienteSupabase.rpc("pmobile_valores_total_obter",{p_usuario:sessao.usuario,p_credencial:sessao.credencial}); if(r.error)throw r.error;
 const v=Array.isArray(r.data)?r.data[0]:r.data;if(!v){status.textContent="Aguardando a próxima importação ou sincronização da planilha.";cards.replaceChildren();return;}
 const moeda=n=>n==null?"—":Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const campos=[["Total das notas fiscais",moeda(v.valor_notas)],["Fretes embutidos (cliente paga)",moeda(v.fretes_embutidos)],["Total dos fretes",moeda(v.total_fretes)],["Custo do frete Nunes",moeda(v.custo_nunes)],["Custo final",moeda(v.custo_final)],["% Final",v.percentual_final==null||!Number.isFinite(Number(v.percentual_final))||Math.abs(Number(v.percentual_final))>1?"—":(Number(v.percentual_final)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%"]];
 cards.replaceChildren();for(const [titulo,valor] of campos){const card=document.createElement("div");card.className="valores-kpi"+(titulo==="Custo final"?" destaque":titulo==="% Final"?" percentual":"");card.style.setProperty("--kpi-accent",titulo==="% Final"?(corFaixaPercentual(v.percentual_final)||"#666666"):titulo==="Custo final"?"#d7d7d7":"#666666");const label=document.createElement("div");label.className="valores-kpi-label";label.textContent=titulo;const numero=document.createElement("strong");numero.textContent=valor;card.append(label,numero);cards.append(card);}
 status.textContent="Fonte: "+(v.origem||"planilha")+" · Atualizado em "+new Date(v.atualizado_em).toLocaleString("pt-BR");
 await carregarValoresMensais(cards,sessao);
 }catch(e){status.textContent="Não foi possível carregar os valores: "+(e.message||e);}
}
// A linha TOTAL do Excel NÃO é fonte financeira segura: pode conter apenas
// subtotal de uma região, agrupamento ou fórmula ainda não recalculada.
// O RPC no Supabase recompõe o resumo a partir dos rastreios ativos.
async function salvarValoresTotalPlanilha() {
 const sessao=obterSessaoRastreioImportacao();
 const r=await window.clienteSupabase.rpc("pmobile_valores_total_salvar",{
  p_usuario:sessao.usuario,p_credencial:sessao.credencial,
  p_valor_notas:null,p_fretes_embutidos:null,p_total_fretes:null,
  p_custo_nunes:null,p_custo_final:null,p_percentual_final:null,
  p_origem:"Lançamentos ativos do Rastreio"
 });
 if(r.error)throw r.error;
 if(document.getElementById("valoresTotal")?.style.display!=="none")await carregarValoresTotal();
}

// Consultas financeiras sempre derivadas dos lançamentos ativos, sem tabelas duplicadas.
async function carregarValoresMensais(cards,sessao) {
 const anterior=document.getElementById("valoresTotalMensais");if(anterior)anterior.remove();
 const secao=document.createElement("section");secao.id="valoresTotalMensais";secao.style.cssText="grid-column:1/-1;margin-top:24px";
 cards.after(secao);
 const titulo=document.createElement("h3");titulo.textContent="Visualizar por";titulo.style.cssText="font-size:20px;margin:0 0 14px";
 const abas=document.createElement("div");abas.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px";
 const conteudo=document.createElement("div");secao.append(titulo,abas,conteudo);
 const moeda=n=>n==null?"—":Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const percent=n=>n==null?"—":(Number(n)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%";
 const botao=(rotulo,acao)=>{const b=document.createElement("button");b.type="button";b.className="botao-aba";b.style.cssText="padding:10px 18px;border:1px solid #444;border-radius:9px;cursor:pointer";b.textContent=rotulo;b.addEventListener("click",acao);return b;};
 const cabecalho=(rotulo)=>{const h=document.createElement("h4");h.textContent=rotulo;h.style.cssText="font-size:18px;margin:12px 0";conteudo.append(h);};
 const cartao=(v)=>{const grade=document.createElement("div");grade.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin:12px 0 20px";
  const campos=[["Total das notas fiscais",moeda(v.valor_notas)],["Fretes embutidos (cliente paga)",moeda(v.fretes_embutidos)],["Total dos fretes",moeda(v.total_fretes)],["Custo do frete Nunes",moeda(v.custo_nunes)],["Custo final",moeda(v.custo_final)],["% Final",percent(v.percentual_final)]];
  for(const [nome,valor] of campos){const item=document.createElement("div");item.style.cssText="background:#1b1b1b;border:1px solid #333;border-radius:12px;padding:16px";if(nome==="% Final"){const cor=corFaixaPercentual(v.percentual_final);if(cor){item.style.borderColor=cor;item.style.background=cor==="#d7d7d7"?"#252525":cor==="#f0c35a"?"#2b2516":"#2d191b";}}const label=document.createElement("div");label.textContent=nome;label.style.cssText="color:#aaa;font-size:12px;margin-bottom:9px";const num=document.createElement("strong");num.textContent=valor;num.style.cssText="font-size:19px;overflow-wrap:anywhere";if(nome==="% Final"){const cor=corFaixaPercentual(v.percentual_final);if(cor)num.style.color=cor;}item.append(label,num);grade.append(item);}
  conteudo.append(grade);
  if([v.valor_notas,v.fretes_embutidos,v.total_fretes,v.custo_nunes,v.custo_final].some(x=>x==null)){const aviso=document.createElement("p");aviso.textContent="Alguns valores não estão preenchidos na planilha sincronizada.";aviso.style.cssText="color:#aaa;font-size:12px";conteudo.append(aviso);}
 };
 const somar=(linhas)=>{const campos=["valor_notas","fretes_embutidos","total_fretes","custo_nunes","custo_final"];const v={quantidade:linhas.reduce((a,r)=>a+Number(r.quantidade),0)};
  for(const k of campos)v[k]=linhas.length&&linhas.every(r=>r[k]!=null)?linhas.reduce((a,r)=>a+Number(r[k]),0):null;
  v.percentual_final=v.custo_final!=null&&v.valor_notas!=null&&v.valor_notas!==0?v.custo_final/v.valor_notas:null;return v;};
 const meses=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
 try{
  const resposta=await window.clienteSupabase.rpc("pmobile_valores_total_analitico_obter",{p_usuario:sessao.usuario,p_credencial:sessao.credencial});if(resposta.error)throw resposta.error;
  const linhas=Array.isArray(resposta.data)?resposta.data:[];if(!linhas.length){conteudo.textContent="Nenhum lançamento disponível.";return;}
  const anos=[...new Set(linhas.map(r=>Number(r.ano)))].sort((a,b)=>b-a);
  const transportadoras=[...new Set(linhas.map(r=>r.transportadora))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const mostrar=(modo)=>{
   conteudo.replaceChildren();
   for(const b of abas.children){const ativo=b.textContent===(modo==="ano"?"Ano":modo==="mes"?"Mês":"Transportadora");b.style.background=ativo?"#d7d7d7":"#242424";b.style.color=ativo?"#111":"#eee";}
   if(modo==="ano"){cabecalho("Valores por ano");for(const ano of anos){const grupo=document.createElement("details");grupo.style.cssText="border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;background:#1b1b1b";const resumo=document.createElement("summary");resumo.textContent=ano+" · "+somar(linhas.filter(r=>Number(r.ano)===ano)).quantidade.toLocaleString("pt-BR")+" lançamentos";resumo.style.cssText="cursor:pointer;font-weight:700";grupo.append(resumo);conteudo.append(grupo);const area=document.createElement("div");grupo.append(area);const antes=conteudo;area.append(...[]);const v=somar(linhas.filter(r=>Number(r.ano)===ano));const temporario=document.createElement("div");conteudo.append(temporario);cartao(v);while(temporario.nextSibling)area.append(temporario.nextSibling);temporario.remove();}}
   if(modo==="mes"){cabecalho("Valores por mês");for(const ano of anos){for(let mes=12;mes>=1;mes--){const grupoLinhas=linhas.filter(r=>Number(r.ano)===ano&&Number(r.mes)===mes);if(!grupoLinhas.length)continue;const d=document.createElement("details");d.style.cssText="border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;background:#1b1b1b";const s=document.createElement("summary");s.textContent=meses[mes-1]+" de "+ano+" · "+somar(grupoLinhas).quantidade.toLocaleString("pt-BR")+" lançamentos";s.style.cssText="cursor:pointer;font-weight:700";d.append(s);conteudo.append(d);const marca=document.createElement("div");conteudo.append(marca);cartao(somar(grupoLinhas));while(marca.nextSibling)d.append(marca.nextSibling);marca.remove();}}}
   if(modo==="transportadora"){cabecalho("Valores por transportadora");const filtros=document.createElement("div");filtros.style.cssText="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px";const escolha=(opcoes)=>{const sel=document.createElement("select");sel.style.cssText="background:#222;color:#fff;border:1px solid #555;border-radius:8px;padding:10px";for(const [valor,nome] of opcoes){const o=document.createElement("option");o.value=valor;o.textContent=nome;sel.append(o);}return sel;};const ano=escolha([["","Todos os anos"],...anos.map(a=>[String(a),String(a)])]);const mes=escolha([["","Todos os meses"],...meses.map((m,i)=>[String(i+1),m])]);filtros.append(ano,mes);conteudo.append(filtros);const lista=document.createElement("div");conteudo.append(lista);const render=()=>{lista.replaceChildren();for(const nome of transportadoras){const filtradas=linhas.filter(r=>r.transportadora===nome&&(!ano.value||String(r.ano)===ano.value)&&(!mes.value||String(r.mes)===mes.value));if(!filtradas.length)continue;const d=document.createElement("details");d.style.cssText="border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;background:#1b1b1b";const s=document.createElement("summary");s.textContent=nome+" · "+somar(filtradas).quantidade.toLocaleString("pt-BR")+" lançamentos";s.style.cssText="cursor:pointer;font-weight:700";d.append(s);lista.append(d);const marca=document.createElement("div");conteudo.append(marca);cartao(somar(filtradas));while(marca.nextSibling)d.append(marca.nextSibling);marca.remove();}};ano.addEventListener("change",render);mes.addEventListener("change",render);render();}
  };
  abas.append(botao("Ano",()=>mostrar("ano")),botao("Mês",()=>mostrar("mes")),botao("Transportadora",()=>mostrar("transportadora")));
  mostrar("ano");
 }catch(e){conteudo.textContent="Não foi possível carregar os resultados: "+(e.message||e);conteudo.style.color="#f88";}
}
