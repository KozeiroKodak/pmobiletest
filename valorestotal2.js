// Frete geral 2: cópia funcional isolada do módulo financeiro original.
// Não modifica a tela Frete Geral original nem duplica dados no Supabase.
function abrirValoresTotal2() {
 if(!window.usuarioPmobileAtual || window.usuarioPmobileAtual.nivel !== "ADMIN"){
  alert("Acesso administrativo negado."); return;
 }
 mostrarTelaSistema("valoresTotal2","menuValoresTotal2"); carregarValoresTotal2();
}
async function carregarValoresTotal2() {
 const status=document.getElementById("valoresTotal2Status"), cards=document.getElementById("valoresTotal2Cards"); if(!cards)return;
 try { const sessao=obterSessaoRastreioImportacao(); const r=await window.clienteSupabase.rpc("pmobile_valores_total_obter",{p_usuario:sessao.usuario,p_credencial:sessao.credencial}); if(r.error)throw r.error;
 const v=Array.isArray(r.data)?r.data[0]:r.data;if(!v){status.textContent="Aguardando a próxima importação ou sincronização da planilha.";cards.replaceChildren();return;}
 const moeda=n=>n==null?"—":Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const campos=[["Total das notas fiscais",moeda(v.valor_notas)],["Fretes embutidos (cliente paga)",moeda(v.fretes_embutidos)],["Total dos fretes",moeda(v.total_fretes)],["Custo do frete Nunes",moeda(v.custo_nunes)],["Custo final",moeda(v.custo_final)],["% Final",v.percentual_final==null||!Number.isFinite(Number(v.percentual_final))||Math.abs(Number(v.percentual_final))>1?"—":(Number(v.percentual_final)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})+"%"]];
 cards.replaceChildren();for(const [titulo,valor] of campos){const card=document.createElement("div");card.className="valores-kpi"+(titulo==="Custo final"?" destaque":titulo==="% Final"?" percentual":"");card.style.setProperty("--kpi-accent",titulo==="% Final"?(corFaixaPercentual(v.percentual_final)||"#666666"):titulo==="Custo final"?"#d7d7d7":"#666666");const label=document.createElement("div");label.className="valores-kpi-label";label.textContent=titulo;const numero=document.createElement("strong");numero.textContent=valor;card.append(label,numero);cards.append(card);}
 status.textContent="Fonte: "+(v.origem||"planilha")+" · Atualizado em "+new Date(v.atualizado_em).toLocaleString("pt-BR");
 await carregarValoresMensais2(cards,sessao);
 }catch(e){status.textContent="Não foi possível carregar os valores: "+(e.message||e);}
}
// Consultas financeiras sempre derivadas dos lançamentos ativos, sem tabelas duplicadas.
async function carregarValoresMensais2(cards,sessao) {
 const anterior=document.getElementById("valoresTotal2Mensais");if(anterior)anterior.remove();
 const secao=document.createElement("section");secao.id="valoresTotal2Mensais";secao.style.cssText="grid-column:1/-1;margin-top:24px";
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
   if(modo==="transportadora"){renderAnaliseTransportadoras2({conteudo,linhas,anos,transportadoras,meses,somar,moeda,percent});}
  };
  abas.append(botao("Ano",()=>mostrar("ano")),botao("Mês",()=>mostrar("mes")),botao("Transportadora",()=>mostrar("transportadora")));
  mostrar("transportadora");
 }catch(e){conteudo.textContent="Não foi possível carregar os resultados: "+(e.message||e);conteudo.style.color="#f88";}
}



/* Nova análise por transportadora — exclusivamente no Frete Geral 2.
 * Fontes: mesma RPC analítica da versão original. Sem valores inventados
 * e sem cálculo de tendências históricas não disponibilizadas pela RPC.
 */
function renderAnaliseTransportadoras2({conteudo,linhas,anos,transportadoras,meses,somar,moeda,percent}){
  const painel=document.createElement("section");
  painel.className="frete2-analise";

  const cab=document.createElement("div");
  cab.className="frete2-cabecalho";
  const topo=document.createElement("div");
  const titulo=document.createElement("h4");
  titulo.textContent="Análise por transportadora";
  const descricao=document.createElement("p");
  descricao.textContent="Explore os valores e a composição dos fretes por transportadora.";
  topo.append(titulo,descricao);
  const total=document.createElement("span");
  total.className="frete2-contador";
  total.textContent="Carregando...";
  cab.append(topo,total);
  painel.append(cab);

  const filtros=document.createElement("div");
  filtros.className="frete2-filtros";
  const criarCampo=(titulo,controle)=>{
    const campo=document.createElement("label");
    campo.className="frete2-campo";
    const label=document.createElement("span");
    label.textContent=titulo;
    campo.append(label,controle);
    return campo;
  };
  const escolher=(itens)=>{
    const sel=document.createElement("select");
    for(const [valor,rotulo] of itens){
      const option=document.createElement("option");
      option.value=valor;option.textContent=rotulo;sel.append(option);
    }
    return sel;
  };
  const filtroAno=escolher([["","Todos os anos"],...anos.map(a=>[String(a),String(a)])]);
  filtroAno.value=anos.length?String(anos[0]):"";
  const filtroMes=escolher([["","Todos os meses"],...meses.map((nome,i)=>[String(i+1),nome[0].toUpperCase()+nome.slice(1)])]);
  const nomes=transportadoras.filter(n=>String(n||"").trim()).map(String);
  const filtroTransportadora=escolher([["","Todas as transportadoras"],...nomes.map(n=>[n,n])]);
  const linha1=document.createElement("div");
  linha1.className="frete2-filtros-linha";
  linha1.append(
    criarCampo("Ano",filtroAno),criarCampo("Mês",filtroMes),
    criarCampo("Transportadora",filtroTransportadora)
  );
  const pesquisa=document.createElement("input");
  pesquisa.type="search";pesquisa.placeholder="Buscar transportadora...";
  pesquisa.setAttribute("aria-label","Buscar transportadora");
  pesquisa.autocomplete="off";
  const ordem=escolher([
    ["custo","Custo final (maior)"],
    ["lancamentos","Mais lançamentos"],
    ["percentual","Maior % final"],
    ["nome","Nome (A–Z)"]
  ]);
  const linha2=document.createElement("div");
  linha2.className="frete2-busca-linha";
  linha2.append(criarCampo("Pesquisar",pesquisa),criarCampo("Ordenar por",ordem));
  filtros.append(linha1,linha2);
  painel.append(filtros);

  const aviso=document.createElement("p");
  aviso.className="frete2-aviso";
  aviso.hidden=true;
  painel.append(aviso);
  const lista=document.createElement("div");
  lista.className="frete2-lista";
  painel.append(lista);
  conteudo.append(painel);

  const formatarContagem=n=>Number(n||0).toLocaleString("pt-BR");
  const resumoFin=(registros)=>somar(registros);
  const statusNumero=n=>n==null||!Number.isFinite(Number(n))?null:Number(n);
  const linhaDetalhes=(grade,rotulo,valor)=>{
    const bloco=document.createElement("div");
    const label=document.createElement("span");
    label.textContent=rotulo;
    const numero=document.createElement("strong");
    numero.textContent=valor;
    bloco.append(label,numero);grade.append(bloco);
  };

  function render(){
    lista.replaceChildren();
    const ano=filtroAno.value,mes=filtroMes.value,nome=filtroTransportadora.value;
    const termo=pesquisa.value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const filtradas=linhas.filter(r=>
      (!ano||String(r.ano)===ano)&&
      (!mes||String(r.mes)===mes)&&
      (!nome||String(r.transportadora)===nome)
    );
    const porNome=new Map();
    for(const r of filtradas){
      const chave=String(r.transportadora||"").trim();
      if(!chave)continue;
      if(!porNome.has(chave))porNome.set(chave,[]);
      porNome.get(chave).push(r);
    }
    const agrupadas=[...porNome.entries()]
      .map(([nome,registros])=>({nome,resumo:resumoFin(registros)}))
      .filter(item=>item.nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(termo));
    const valorCusto=item=>statusNumero(item.resumo.custo_final);
    const valorPct=item=>statusNumero(item.resumo.percentual_final);
    agrupadas.sort((a,b)=>{
      const criterio=ordem.value;
      if(criterio==="nome")return a.nome.localeCompare(b.nome,"pt-BR");
      if(criterio==="lancamentos")return b.resumo.quantidade-a.resumo.quantidade||a.nome.localeCompare(b.nome,"pt-BR");
      const valor=criterio==="percentual"?valorPct:valorCusto;
      const nA=valor(a),nB=valor(b);
      if(nA===null&&nB===null)return a.nome.localeCompare(b.nome,"pt-BR");
      if(nA===null)return 1;
      if(nB===null)return -1;
      return nB-nA||a.nome.localeCompare(b.nome,"pt-BR");
    });
    const maxCusto=Math.max(0,...agrupadas.map(item=>valorCusto(item)||0));
    total.textContent=agrupadas.length+" transportadora"+(agrupadas.length===1?"":"s");
    aviso.hidden=agrupadas.every(item=>valorCusto(item)!==null);
    if(!aviso.hidden)aviso.textContent="Algumas transportadoras não possuem custo final completo para o período. Esses valores aparecem como —.";
    if(!agrupadas.length){
      const vazio=document.createElement("p");
      vazio.className="frete2-vazio";
      vazio.textContent="Nenhuma transportadora encontrada para os filtros selecionados.";
      lista.append(vazio);return;
    }
    for(let i=0;i<agrupadas.length;i++){
      const item=agrupadas[i],v=item.resumo,custo=valorCusto(item),pct=valorPct(item);
      const details=document.createElement("details");
      details.className="frete2-item";
      const summary=document.createElement("summary");
      summary.className="frete2-item-resumo";
      const pos=document.createElement("span");
      pos.className="frete2-posicao";
      pos.textContent=String(i+1);

      const info=document.createElement("div");
      info.className="frete2-info";
      const nomeEl=document.createElement("strong");
      nomeEl.textContent=item.nome;
      const contagem=document.createElement("small");
      contagem.textContent=formatarContagem(v.quantidade)+" lançamentos";
      const trilho=document.createElement("div");
      trilho.className="frete2-barra-fundo";
      if(custo!==null && maxCusto>0){
        const barra=document.createElement("div");
        barra.className="frete2-barra-valor";
        barra.style.width=(100*custo/maxCusto).toFixed(2)+"%";
        trilho.append(barra);
      }
      info.append(nomeEl,contagem,trilho);

      const colunaCusto=document.createElement("div");
      colunaCusto.className="frete2-valor";
      const custoLabel=document.createElement("span");
      custoLabel.textContent="Custo final";
      const custoNum=document.createElement("strong");
      custoNum.textContent=moeda(custo);
      colunaCusto.append(custoLabel,custoNum);
      const colunaPct=document.createElement("div");
      colunaPct.className="frete2-percentual";
      const pctLabel=document.createElement("span");
      pctLabel.textContent="% Final";
      const pctNum=document.createElement("strong");
      pctNum.textContent=percent(pct);
      colunaPct.append(pctLabel,pctNum);
      const seta=document.createElement("span");
      seta.className="frete2-seta";
      seta.setAttribute("aria-hidden","true");
      seta.textContent="⌄";
      summary.append(pos,info,colunaCusto,colunaPct,seta);
      details.append(summary);

      const detalhe=document.createElement("div");
      detalhe.className="frete2-detalhes";
      const subtitulo=document.createElement("p");
      subtitulo.textContent="Composição financeira de "+item.nome;
      detalhe.append(subtitulo);
      const grade=document.createElement("div");
      grade.className="frete2-detalhes-grade";
      [
        ["Total das notas fiscais",moeda(v.valor_notas)],
        ["Fretes embutidos (cliente paga)",moeda(v.fretes_embutidos)],
        ["Total dos fretes",moeda(v.total_fretes)],
        ["Custo do frete Nunes",moeda(v.custo_nunes)],
        ["Custo final",moeda(v.custo_final)],
        ["% Final",percent(v.percentual_final)]
      ].forEach(([rotulo,valor])=>linhaDetalhes(grade,rotulo,valor));
      detalhe.append(grade);
      details.append(detalhe);
      lista.append(details);
    }
  }
  [filtroAno,filtroMes,filtroTransportadora,ordem].forEach(x=>x.addEventListener("change",render));
  pesquisa.addEventListener("input",render);
  render();
}
