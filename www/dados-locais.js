/* PMobile — Dados locais (módulos independentes, sem alterar as funções Dogo). */
(function () {
  "use strict";
  const IDS = ["pesquisa","estoque","reservas","conferencias","comparar","divergencias","locais","importar"];
  const TITULOS = {
    pesquisa:"Pesquisa local", estoque:"Estoque manual", reservas:"Reservas locais",
    conferencias:"Conferências locais", comparar:"Comparar e verificar",
    divergencias:"Divergências locais", locais:"Locais do estoque local",
    importar:"Importar catálogo Dogo"
  };
  const ICONES = {
    pesquisa:"🔎",estoque:"✍️",reservas:"📦",conferencias:"🗂️",
    comparar:"⚖️",divergencias:"⚠️",locais:"📍",importar:"📥"
  };
  const estado = { tela:"inicio",material:null,resultados:{},offsets:{},busy:false,
    ultimaComparacao:0,importando:false };
  const $ = (id) => document.getElementById(id);
  const escape = (v) => String(v == null ? "" : v)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const valor = (v) => (v === null || v === undefined || v === "" ? "Não informado" : String(v));
  const num = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("pt-BR"));
  const norm = (v) => String(v == null ? "" : v).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]/g,"");

  function mensagem(texto, erro) {
    const el = $("dlMensagem"); if (!el) return;
    el.textContent=texto || "";el.dataset.erro=erro ? "true" : "false";
  }
  function sessao() {
    const usuario=window.usuarioPmobileAtual?.usuario;
    const credencial=window.credencialPmobileAtual;
    if (!usuario || !credencial) throw new Error("Entre no PMobile para acessar Dados locais.");
    if (!window.clienteSupabase || !navigator.onLine) throw new Error("Dados locais requerem conexão com o Supabase nesta versão.");
    return {p_usuario:usuario,p_credencial:credencial};
  }
  async function rpc(nome,parametros) {
    const {data,error}=await window.clienteSupabase.rpc("pmobile_local_"+nome,
      Object.assign({},sessao(),parametros||{}));
    if (error) {
      const falha=new Error(error.message || "Falha na consulta ao banco local.");
      falha.code=error.code;
      falha.status=error.status;
      falha.details=error.details;
      throw falha;
    }
    return data;
  }
  function pesquisarForm(aba) {
    return '<form class="dl-search" data-dl-busca="'+aba+'">'+
      '<label>Pesquisar <input name="termo" placeholder="Código, referência ou descrição" autocomplete="off"></label>'+
      '<label>Campo <select name="tipo"><option value="todos">Todos</option>'+
      '<option value="codigo">Código</option><option value="referencia">Referência</option>'+
      '<option value="descricao">Descrição</option></select></label>'+
      '<button type="submit">Pesquisar</button></form>'+
      '<div class="dl-resultados" id="dlResultados-'+aba+'"></div>'+
      '<div class="dl-paginacao"><button data-dl-page="-1" data-dl-aba="'+aba+'">Anterior</button>'+
      '<span id="dlPagina-'+aba+'">Página 1</span>'+
      '<button data-dl-page="1" data-dl-aba="'+aba+'">Próxima</button></div>';
  }
  function compararForm(aba) {
    return '<form class="dl-search" data-dl-comparar="'+aba+'"><label>Material'+
      '<input name="termo" placeholder="Código ou descrição"></label>'+
      '<button type="submit">Atualizar comparação</button></form>'+
      '<div class="dl-resultados" id="dlResultados-'+aba+'"></div>'+
      '<div class="dl-paginacao"><button data-dl-page="-1" data-dl-aba="'+aba+'">Anterior</button>'+
      '<span id="dlPagina-'+aba+'">Página 1</span>'+
      '<button data-dl-page="1" data-dl-aba="'+aba+'">Próxima</button></div>';
  }
  function painel(id,conteudo,nota) {
    return '<section class="dl-panel" data-dl-panel="'+id+'" hidden>'+
      '<div class="dl-top"><button type="button" data-dl-back>‹ Voltar</button>'+
      '<div><h2>'+TITULOS[id]+'</h2><p>'+escape(nota||"Base independente da Dogo.")+'</p></div></div>'+
      conteudo+'</section>';
  }
  function htmlPrincipal() {
    const cards=IDS.map((id)=>'<button type="button" class="dl-card" data-dl-open="'+id+'">'+
      '<span class="dl-card-icon">'+ICONES[id]+'</span><span><strong>'+TITULOS[id]+'</strong>'+
      '<small>'+(id==="importar"?"Somente cadastro; não importa quantidades ou locais":
        id==="comparar"?"Consulta automática entre as duas bases":"Dados exclusivos do estoque local")+
      '</small></span><span>›</span></button>').join("");
    return '<div class="dl-app"><header class="dl-cabecalho"><span class="dl-kicker">PMOBILE / ESTOQUE INDEPENDENTE</span>'+
      '<h1>Dados locais</h1><p>Cadastro permanente, controle manual e comparação com a Dogo.</p></header>'+
      '<div id="dlMensagem" role="status" aria-live="polite"></div>'+
      '<section data-dl-panel="inicio"><div class="dl-grid">'+cards+'</div>'+
      '<p class="dl-informacao">A base Dogo e as funcionalidades originais permanecem separadas.</p></section>'+
      painel("pesquisa",pesquisarForm("pesquisa"),"Consulta somente o catálogo permanente.")+
      painel("estoque",pesquisarForm("estoque")+
        '<form id="dlFormEstoque" class="dl-editor" hidden><h3 id="dlEditorTitulo">Editar material</h3>'+
        '<div class="dl-campos">'+
        '<label>Quantidade do item <input id="dlQtdItem" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label>Quantidade total <input id="dlQtdTotal" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label>Itens reservados <input id="dlQtdReservada" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label>Local <input id="dlLocal" type="text" placeholder="Não preenchido"></label>'+
        '</div><button type="submit">Salvar no estoque local</button></form>',
        "As alterações nunca são gravadas em public.materiais (Dogo).")+
      painel("reservas",pesquisarForm("reservas"),"Somente materiais com reservas locais informadas.")+
      painel("conferencias",'<form id="dlFormConferencia" class="dl-editor">'+
        '<div class="dl-campos"><label>Código do material <input id="dlConCodigo" required></label>'+
        '<label>Quantidade física <input id="dlConQuantidade" type="number" min="0" step="any" required></label>'+
        '<label>Local encontrado <input id="dlConLocal"></label></div>'+
        '<button type="submit">Registrar conferência local</button></form>'+
        '<h3>Histórico de conferências locais</h3><div id="dlHistorico"></div>',
        "Histórico independente. Registrar conferência não sobrescreve o estoque manual.")+
      painel("comparar",compararForm("comparar"),"A comparação é calculada automaticamente ao consultar ou atualizar os dados.")+
      painel("divergencias",compararForm("divergencias"),"Divergências da nova base, sem alterar a aba original.")+
      painel("locais",compararForm("locais"),"Diferenças de localização da nova base, sem confirmar mudanças na Dogo.")+
      painel("importar",'<p>Selecione a planilha Dogo. Apenas código, referência, descrição e marca serão importados;'+
        ' quantidades, reservas e locais continuam intocados.</p>'+
        '<form id="dlFormImportar" class="dl-editor">'+
        '<label>Planilha Dogo <input type="file" id="dlArquivo" accept=".xlsx,.xls,.xlsb,.xlsm,.csv,.html,.htm" required></label>'+
        '<button type="submit" id="dlBotaoImportar">Importar cadastro permanente</button></form>'+
        '<p id="dlProgresso" role="status" aria-live="polite"></p>',
        "A importação é cumulativa: não apaga materiais ou contagens anteriores.")+
      '</div>';
  }
  function init() {
    const menuBase=$("menuContagemManual");
    const conteudo=$("conteudoPrincipal");
    if (!menuBase || !conteudo || $("dadosLocais")) return;
    const menu=document.createElement("button");
    menu.type="button";menu.id="menuDadosLocais";menu.className="home-app-card";
    menu.title="Dados locais";menu.innerHTML='<span class="home-app-icone" aria-hidden="true">🗄️</span>'+
      '<span class="home-app-conteudo"><strong>Dados locais</strong>'+
      '<small>Estoque independente e comparação</small></span>'+
      '<span class="home-app-seta" aria-hidden="true">›</span>';
    menu.addEventListener("click",abrir);
    menuBase.insertAdjacentElement("afterend",menu);
    const section=document.createElement("section");
    section.className="tela-sistema";section.id="dadosLocais";section.style.display="none";
    section.innerHTML=htmlPrincipal();conteudo.appendChild(section);
    section.addEventListener("click",onClick);
    section.addEventListener("submit",onSubmit);
    // Arquivo diferente invalida somente o estado em memória; o cadastro já
    // gravado no Supabase permanece intacto.
    $("dlArquivo").addEventListener("change",()=>{
      estado.importacaoAtual=null;
      $("dlBotaoImportar").textContent="Importar cadastro permanente";
    });
    document.addEventListener("visibilitychange",function(){
      if (!document.hidden && ativo() && ["comparar","divergencias","locais"].includes(estado.tela)
        && Date.now()-estado.ultimaComparacao>60000) consultar(estado.tela);
    });
    // Atualização automática somente enquanto a tela comparativa estiver aberta.
    // Não adiciona pesquisas periódicas às outras abas do PMobile.
    setInterval(function(){
      if (!document.hidden && ativo() && ["comparar","divergencias","locais"].includes(estado.tela)
          && !estado.busy && Date.now()-estado.ultimaComparacao>=60000) consultar(estado.tela);
    },60000);
  }
  function ativo() { return $("dadosLocais")?.style.display!=="none"; }
  function abrir() {
    if (typeof window.mostrarTelaSistema!=="function") {
      alert("Navegação do PMobile indisponível.");return;
    }
    window.mostrarTelaSistema("dadosLocais","menuDadosLocais");
    tela("inicio");
  }
  function tela(nome) {
    if (nome!=="inicio" && !IDS.includes(nome))return;
    estado.tela=nome;mensagem("");
    document.querySelectorAll("#dadosLocais [data-dl-panel]").forEach((p)=>{
      p.hidden=p.dataset.dlPanel!==nome;
    });
    const menu=$("menuDadosLocais");if(menu)menu.classList.add("ativo");
    if (["pesquisa","estoque","reservas","comparar","divergencias","locais"].includes(nome)){
      estado.offsets[nome]=0;consultar(nome);
    }else if(nome==="conferencias"){listarConferencias();}
  }
  function voltar() {if(estado.tela!=="inicio"){tela("inicio");return true;}if(typeof window.mostrarTelaSistema==="function"){window.mostrarTelaSistema("homeSistema",null,true);return true;}return false;}
  function onClick(e) {
    const abrirBtn=e.target.closest("[data-dl-open]");
    if(abrirBtn){tela(abrirBtn.dataset.dlOpen);return;}
    if(e.target.closest("[data-dl-back]")){voltar();return;}
    const page=e.target.closest("[data-dl-page]");
    if(page){
      const aba=page.dataset.dlAba, delta=Number(page.dataset.dlPage);
      estado.offsets[aba]=Math.max(0,(estado.offsets[aba]||0)+delta*(["comparar","divergencias","locais"].includes(aba)?100:50));
      consultar(aba);return;
    }
    const edit=e.target.closest("[data-dl-edit]");
    if(edit){
      const origem=edit.dataset.dl-source;
      const item=(estado.resultados[origem]||[]).find((m)=>m.codigo===edit.dataset.dlEdit);
      if(item){tela("estoque"); selecionar(item);}
      return;
    }
    const conferir=e.target.closest("[data-dl-conferir]");
    if(conferir){const codigo=conferir.dataset.dlConferir;tela("conferencias");$("dlConCodigo").value=codigo;return;}
  }
  async function onSubmit(e) {
    const form=e.target;e.preventDefault();
    try{
      if(form.dataset.dlBusca){estado.offsets[form.dataset.dlBusca]=0;await consultar(form.dataset.dlBusca);}
      else if(form.dataset.dlComparar){estado.offsets[form.dataset.dlComparar]=0;await consultar(form.dataset.dlComparar);}
      else if(form.id==="dlFormEstoque"){await salvarEstoque();}
      else if(form.id==="dlFormConferencia"){await registrarConferencia();}
      else if(form.id==="dlFormImportar"){await importar();}
    }catch(erro){mensagem(erro.message,true);}
  }
  function obterFiltros(aba) {
    const form=document.querySelector('#dadosLocais [data-dl-busca="'+aba+'"], #dadosLocais [data-dl-comparar="'+aba+'"]');
    return {termo:form?.elements?.termo?.value?.trim()||"",tipo:form?.elements?.tipo?.value||"todos"};
  }
  async function consultar(aba) {
    const lista=$("dlResultados-"+aba);if(!lista)return;
    lista.textContent="Carregando dados locais...";
    const {termo,tipo}=obterFiltros(aba);
    const offset=estado.offsets[aba]||0;
    try{
      if(["pesquisa","estoque","reservas"].includes(aba)){
        const data=await rpc("listar",{p_termo:termo,p_tipo:tipo,p_limite:50,p_offset:offset,p_somente_reservas:aba==="reservas"});
        estado.resultados[aba]=Array.isArray(data)?data:[];
        desenharMateriais(aba,estado.resultados[aba]);
      }else{
        const modo=aba==="divergencias"?"divergencias":aba==="locais"?"locais":"todos";
        const data=await rpc("comparar",{p_termo:termo,p_limite:100,p_offset:offset,p_modo:modo});
        estado.resultados[aba]=Array.isArray(data)?data:[];
        estado.ultimaComparacao=Date.now();
        desenharComparacao(aba,estado.resultados[aba]);
      }
      const pag=$("dlPagina-"+aba);if(pag)pag.textContent="Página "+(Math.floor(offset/(["comparar","divergencias","locais"].includes(aba)?100:50))+1);
    }catch(e){lista.textContent=e.message;mensagem(e.message,true);}
  }
  function desenharMateriais(aba,itens) {
    const el=$("dlResultados-"+aba);el.replaceChildren();
    if(!itens.length){el.textContent="Nenhum material encontrado.";return;}
    el.innerHTML=itens.map((m)=>'<article class="dl-item">'+
      '<div><strong>'+escape(m.codigo)+' — '+escape(m.descricao)+'</strong>'+
      '<small>Ref.: '+escape(valor(m.referencia))+' · Local: '+escape(valor(m.local))+'</small>'+
      '<small>Quantidade total: '+num(m.quantidade_total)+' · Reservados: '+num(m.quantidade_reservada)+
      ' · Qtd. item: '+num(m.quantidade_item)+'</small></div>'+
      '<div class="dl-item-acoes"><button type="button" data-dl-edit="'+escape(m.codigo)+'" data-dl-source="'+aba+'">Editar local</button>'+
      '<button type="button" data-dl-conferir="'+escape(m.codigo)+'">Conferir</button></div></article>').join("");
  }
  function desenharComparacao(aba,itens) {
    const el=$("dlResultados-"+aba);el.replaceChildren();
    if(!itens.length){el.textContent="Nenhuma ocorrência encontrada nesta página.";return;}
    el.innerHTML=itens.map((m)=>{
      const difer=[m.diferenca_quantidade,m.diferenca_reserva,m.diferenca_local,m.sem_dogo].some(Boolean);
      const pend=[m.pendente_quantidade,m.pendente_reserva,m.pendente_local].some(Boolean);
      const estadoTexto=m.sem_dogo?"Não encontrado na Dogo":difer?"Divergente":pend?"Pendente de preenchimento":"Conferido";
      return '<article class="dl-item"><div><strong>'+escape(m.codigo)+' — '+escape(m.descricao)+'</strong>'+
        '<small><b>'+estadoTexto+'</b></small>'+
        '<small>Quantidade total: Dogo '+num(m.dogo_quantidade)+' / Local '+num(m.local_quantidade)+
        (m.diferenca_quantidade?' · DIFERENTE':'')+'</small>'+
        '<small>Reservas: Dogo '+num(m.dogo_reservada)+' / Local '+num(m.local_reservada)+
        (m.diferenca_reserva?' · DIFERENTE':'')+'</small>'+
        '<small>Localização: Dogo '+escape(valor(m.dogo_local))+' / Local '+escape(valor(m.local_local))+
        (m.diferenca_local?' · DIFERENTE':'')+'</small></div></article>';
    }).join("");
  }
  function selecionar(m) {
    estado.material=m;
    $("dlEditorTitulo").textContent="Editar: "+m.codigo+" — "+m.descricao;
    $("dlQtdItem").value=m.quantidade_item??"";
    $("dlQtdTotal").value=m.quantidade_total??"";
    $("dlQtdReservada").value=m.quantidade_reservada??"";
    $("dlLocal").value=m.local??"";
    $("dlFormEstoque").hidden=false;
    $("dlFormEstoque").scrollIntoView({block:"nearest",behavior:"smooth"});
  }
  function quantidade(id) {
    const texto=$(id).value.trim().replace(",",".");
    if(!texto)return null;
    const n=Number(texto);
    if(!Number.isFinite(n)||n<0)throw new Error("Informe quantidades válidas, iguais ou maiores que zero.");
    return n;
  }
  async function salvarEstoque() {
    const m=estado.material;if(!m)throw new Error("Selecione um material para editar.");
    if(estado.busy)return;estado.busy=true;
    try{
      await rpc("salvar_estoque",{
        p_codigo:m.codigo,p_quantidade_item:quantidade("dlQtdItem"),
        p_quantidade_total:quantidade("dlQtdTotal"),
        p_quantidade_reservada:quantidade("dlQtdReservada"),
        p_local:$("dlLocal").value.trim()||null
      });
      mensagem("Estoque local salvo. Comparando automaticamente com a Dogo...");
      $("dlFormEstoque").hidden=true;estado.material=null;
      await consultar("estoque");
      try {
        const atual=await rpc("comparar",{p_termo:m.codigo,p_limite:50,p_offset:0,p_modo:"todos"});
        const comparado=(Array.isArray(atual)?atual:[]).find((x)=>x.codigo===m.codigo);
        const divergente=!!comparado && [comparado.diferenca_quantidade,comparado.diferenca_reserva,
          comparado.diferenca_local,comparado.sem_dogo].some(Boolean);
        mensagem("Estoque local salvo. "+(divergente?"Diferença identificada na comparação automática.":
          comparado?"Comparação automática concluída.":"Comparação disponível na aba própria."));
      } catch(erroComparacao) {
        mensagem("Estoque salvo. Comparação pendente: "+erroComparacao.message,true);
      }
    }finally{estado.busy=false;}
  }
  async function registrarConferencia() {
    if(estado.busy)return;estado.busy=true;
    try{
      const q=quantidade("dlConQuantidade");
      if(q===null)throw new Error("Informe a quantidade física.");
      await rpc("registrar_conferencia",{p_codigo:$("dlConCodigo").value.trim(),
        p_quantidade_fisica:q,p_local_encontrado:$("dlConLocal").value.trim()||null});
      $("dlFormConferencia").reset();
      mensagem("Conferência local registrada, sem alterar o estoque permanente.");
      await listarConferencias();
    }finally{estado.busy=false;}
  }
  async function listarConferencias() {
    const el=$("dlHistorico");if(!el)return;el.textContent="Carregando...";
    try{
      const data=await rpc("listar_conferencias",{p_limite:50});
      const itens=Array.isArray(data)?data:[];
      el.innerHTML=itens.length?itens.map((m)=>'<article class="dl-item"><div>'+
        '<strong>'+escape(m.codigo)+' — '+escape(m.descricao)+'</strong>'+
        '<small>Físico: '+num(m.quantidade_fisica)+' · Local: '+escape(valor(m.local_encontrado))+
        '</small><small>'+escape(m.usuario_nome)+' · '+escape(new Date(m.criado_em).toLocaleString("pt-BR"))+
        '</small></div></article>').join(""):"Nenhuma conferência local registrada.";
    }catch(e){el.textContent=e.message;mensagem(e.message,true);}
  }
  // Os arquivos XLS legados podem conter controles e surrogates isolados.
  // Essas sequências não devem chegar ao corpo JSON do PostgREST.
  function textoSeguroCatalogo(valor) {
    const fonte=String(valor??"").normalize("NFC");
    let destino="";
    for(let i=0;i<fonte.length;i++){
      const cp=fonte.codePointAt(i);
      if(cp>=0xD800&&cp<=0xDFFF)continue; // surrogate UTF-16 sem par
      if(cp<32||cp===127){destino+=" ";continue;}
      destino+=String.fromCodePoint(cp);
      if(cp>0xFFFF)i++;
    }
    return destino.replace(/\s+/g," ").trim();
  }
  function erroJsonImportacao(erro) {
    return String(erro?.code||"")==="PGRST102" ||
      /empty or invalid json|invalid json|json parse/i.test(String(erro?.message||""));
  }
  function erroTemporarioImportacao(erro) {
    const codigo=String(erro?.code||"");
    const status=Number(erro?.status||erro?.statusCode||0);
    return status===408||status===429||status>=500||
      /^(08|53|57P01)/.test(codigo) ||
      /fetch failed|failed to fetch|networkerror|load failed|timed out|timeout|connection reset/i.test(String(erro?.message||""));
  }
  function espera(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  async function enviarLoteCatalogo(lote,progresso) {
    for(let tentativa=1;tentativa<=4;tentativa++){
      try{
        await rpc("importar_catalogo",{p_materiais:lote});
        return;
      }catch(erro){
        if(erroJsonImportacao(erro)){
          // Nunca insistir no mesmo JSON rejeitado; isolar o registro.
          if(lote.length===1)throw new Error(
            "Cadastro "+lote[0].codigo+" rejeitado como JSON pelo servidor. "+
            "Os registros anteriores foram preservados. Detalhe: "+erro.message);
          const meio=Math.floor(lote.length/2);
          await enviarLoteCatalogo(lote.slice(0,meio),progresso);
          await enviarLoteCatalogo(lote.slice(meio),progresso);
          return;
        }
        if(tentativa===4||!erroTemporarioImportacao(erro))throw erro;
        if(progresso)progresso.textContent=
          "Conexão instável. Repetindo lote ("+(tentativa+1)+"/4); dados anteriores preservados.";
        await espera(Math.min(8000,500*Math.pow(2,tentativa-1)));
      }
    }
  }
  function chaveArquivoCatalogo(arquivo,materiais) {
    const meio=materiais[Math.floor(materiais.length/2)]||{};
    return [window.usuarioPmobileAtual?.usuario||"",arquivo.name,arquivo.size,
      arquivo.lastModified,materiais.length,materiais[0]?.codigo||"",
      meio.codigo||"",materiais[materiais.length-1]?.codigo||""].join("|");
  }
  function lerCheckpointCatalogo(chave,total) {
    try {
      const obj=JSON.parse(localStorage.getItem("PMOBILE_DADOS_LOCAIS_IMPORTACAO_V2")||"null");
      if(obj&&obj.chave===chave&&obj.total===total&&
         Number.isInteger(obj.indice)&&obj.indice>=0&&obj.indice<=total)return obj.indice;
    }catch(e){ /* armazenamento indisponível: a importação continua sem checkpoint */ }
    return 0;
  }
  function salvarCheckpointCatalogo(chave,indice,total) {
    try{localStorage.setItem("PMOBILE_DADOS_LOCAIS_IMPORTACAO_V2",
      JSON.stringify({chave,indice,total,atualizadoEm:Date.now()}));}
    catch(e){/* armazenamento cheio ou desativado: a operação continua */}
  }
  function removerCheckpointCatalogo() {
    try{localStorage.removeItem("PMOBILE_DADOS_LOCAIS_IMPORTACAO_V2");}
    catch(e){/* opcional */}
  }
  function lerPlanilha(arquivo) {
    return arquivo.arrayBuffer().then((buffer)=>{
      if(!window.XLSX)throw new Error("Biblioteca de planilhas não carregada.");
      const livro=window.XLSX.read(buffer,{type:"array"});
      const planilha=livro.Sheets[livro.SheetNames[0]];
      if(!planilha)throw new Error("Planilha sem dados.");
      const linhas=window.XLSX.utils.sheet_to_json(planilha,{header:1,defval:"",raw:false,blankrows:false});
      const colunas={
        codigo:["produto","codigo","cod","codigoproduto"],
        descricao:["descricao","descricaoproduto","descricaomaterial","des"],
        referencia:["referencia","ref","referenciaproduto"],
        marca:["marca","fabricante"]
      };
      let cabecalho=null, indices=null;
      for(let i=0;i<Math.min(linhas.length,30);i++){
        const vals=(linhas[i]||[]).map(norm);
        const codigo=vals.findIndex((x)=>colunas.codigo.includes(x));
        const descricao=vals.findIndex((x)=>colunas.descricao.includes(x));
        if(codigo>=0&&descricao>=0){
          cabecalho=i;
          indices={codigo,descricao,
            referencia:vals.findIndex((x)=>colunas.referencia.includes(x)),
            marca:vals.findIndex((x)=>colunas.marca.includes(x))};
          break;
        }
      }
      if(indices===null)throw new Error("Não encontrei as colunas Produto/Código e Descrição na planilha.");
      const mapa=new Map();
      for(let i=cabecalho+1;i<linhas.length;i++){
        const row=linhas[i]||[];
        const codigo=textoSeguroCatalogo(row[indices.codigo]);
        const descricao=textoSeguroCatalogo(row[indices.descricao]);
        if(!codigo||!descricao)continue;
        mapa.set(codigo,{codigo,descricao,
          referencia:indices.referencia>=0?textoSeguroCatalogo(row[indices.referencia])||null:null,
          marca:indices.marca>=0?textoSeguroCatalogo(row[indices.marca])||null:null});
      }
      return [...mapa.values()];
    });
  }
  async function importar() {
    if(estado.importando)return;
    const arquivo=$("dlArquivo").files?.[0];
    if(!arquivo)throw new Error("Selecione uma planilha.");
    if(arquivo.size>50*1024*1024)throw new Error("Arquivo acima de 50 MB.");
    sessao();
    estado.importando=true;
    $("dlBotaoImportar").disabled=true;
    const alvo=$("dlProgresso");
    try{
      alvo.textContent="Lendo e validando a planilha...";
      let contexto=estado.importacaoAtual;
      const identidade=[arquivo.name,arquivo.size,arquivo.lastModified].join("|");
      if(!contexto||contexto.identidade!==identidade){
        const materiais=await lerPlanilha(arquivo);
        if(!materiais.length)throw new Error("A planilha não possui cadastros válidos.");
        const chave=chaveArquivoCatalogo(arquivo,materiais);
        contexto={materiais,chave,identidade,
          indice:lerCheckpointCatalogo(chave,materiais.length)};
        estado.importacaoAtual=contexto;
      }
      const {materiais,chave}=contexto;
      if(contexto.indice>0)
        alvo.textContent="Retomando de "+contexto.indice.toLocaleString("pt-BR")+
          " / "+materiais.length.toLocaleString("pt-BR")+" registros confirmados...";
      // Lotes de 250 evitam requisições JSON grandes; em PGRST102 o lote
      // é subdividido para localizar dados problemáticos sem descartar materiais.
      for(let i=contexto.indice;i<materiais.length;i+=250){
        const lote=materiais.slice(i,i+250);
        try{await enviarLoteCatalogo(lote,alvo);}
        catch(erro){
          // Um lote parcialmente gravado será reenviado por upsert, sem duplicar
          // materiais e sem sobrescrever quantidade, reserva ou localização.
          contexto.indice=i;
          salvarCheckpointCatalogo(chave,i,materiais.length);
          alvo.textContent="Importação interrompida em "+
            i.toLocaleString("pt-BR")+" / "+materiais.length.toLocaleString("pt-BR")+
            ". Os registros anteriores foram preservados. Selecione o mesmo arquivo e use Retomar.";
          throw erro;
        }
        contexto.indice=i+lote.length;
        salvarCheckpointCatalogo(chave,contexto.indice,materiais.length);
        alvo.textContent="Importados "+contexto.indice.toLocaleString("pt-BR")+
          " / "+materiais.length.toLocaleString("pt-BR")+" cadastros.";
      }
      mensagem("Importação concluída: "+materiais.length.toLocaleString("pt-BR")+
        " cadastros processados. Estoques e locais manuais preservados.");
      alvo.textContent="Concluído: "+materiais.length.toLocaleString("pt-BR")+
        " cadastros processados.";
      removerCheckpointCatalogo();
      estado.importacaoAtual=null;
      $("dlArquivo").value="";
      $("dlBotaoImportar").textContent="Importar cadastro permanente";
    }finally{
      estado.importando=false;
      $("dlBotaoImportar").disabled=false;
      if(estado.importacaoAtual)$("dlBotaoImportar").textContent="Retomar importação";
    }
  }

  window.abrirDadosLocaisPmobile=abrir;
  window.voltarUmNivelDadosLocais=function(telaAtual) {
    if(telaAtual!=="dadosLocais")return false;
    return voltar();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
