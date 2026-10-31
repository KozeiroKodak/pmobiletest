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
  // Mesmo padrão de pictogramas SVG utilizado nas Configurações 3.0.
  // Ícones são decorativos, sem acesso a dados externos.
  const ICONES = {
    pesquisa:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    estoque:'<path d="M4 7 12 3l8 4v10l-8 4-8-4z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
    reservas:'<path d="M3 8h18M5 8l2-4h10l2 4v12H5z"/><path d="M9 12h6"/>',
    conferencias:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2m-7 7 2 2 4-4m-6 8h8"/>',
    comparar:'<path d="M4 6h16M4 18h16M8 3v6m8 6v6"/><path d="m5 13 3-3 3 3m2-2 3 3 3-3"/>',
    divergencias:'<path d="M12 3 2 20h20z"/><path d="M12 9v5m0 3h.01"/>',
    locais:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
    importar:'<path d="M4 17v4h16v-4M12 3v13m-5-5 5 5 5-5"/><path d="M4 7V4h4"/>'
  };
  const icone=(id)=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(ICONES[id]||ICONES.estoque)+'</svg>';
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
  function paginacao(aba) {
    return '<nav class="reservas-paginacao" aria-label="Páginas de '+TITULOS[aba]+'">'+
      '<button class="botao-secundario" type="button" data-dl-page="-1" data-dl-aba="'+aba+'">‹ Anterior</button>'+
      '<span id="dlPagina-'+aba+'">Página 1</span>'+
      '<button class="botao-secundario" type="button" data-dl-page="1" data-dl-aba="'+aba+'">Próxima ›</button></nav>';
  }
  function resumo(aba) {
    const classe=aba==="locais"?"locais-v3-resumo":"conferencias-resumo";
    return '<div class="'+classe+'" id="dlResumo-'+aba+'" aria-label="Indicadores da página"></div>';
  }
  // Pesquisa continua usando o próprio template; os dois módulos de contagem
  // compartilham a estrutura e o comportamento VISUAL nativos de Contagem manual.
  function pesquisarForm(aba) {
    if(aba==="reservas"){
      return '<div class="painel painel-reservas">'+
        '<div id="dlResultados-reservas" aria-live="polite"></div>'+
        paginacao("reservas")+'</div>';
    }
    const contagem=aba==="estoque"||aba==="conferencias";
    const nome=aba==="conferencias"?"Conferências locais":aba==="estoque"?
      "Estoque manual":"Pesquisa local";
    const etapa=aba==="conferencias"?"Encontre um material para registrar uma conferência.":
      aba==="estoque"?"Encontre um material para atualizar o estoque.":"Encontre um material no cadastro local.";
    const classe=contagem?"contagem-v2":"pesquisa-v2";
    const prefix=classe;
    const subtitulo=contagem?"Inventário / "+nome:"Catálogo / Pesquisa local";
    const selector=contagem?'<div class="seletor-contagem-manual-wrapper">'+
      '<select class="seletor-contagem-manual-nativo" aria-hidden="true" tabindex="-1" name="tipo">'+
      '<option value="codigo">CÓD</option><option value="referencia">REF</option>'+
      '<option value="descricao">DESC</option></select>'+
      '<button type="button" class="seletor-contagem-manual" data-dl-seletor aria-label="Alternar tipo de pesquisa">CÓD</button></div>':
      '<select class="pesquisa-v2-select" name="tipo" aria-label="Tipo de pesquisa">'+
      '<option value="codigo">Código</option><option value="referencia">Referência</option>'+
      '<option value="descricao">Descrição</option></select>';
    const buttons=['codigo','referencia','descricao'].map(tipo=>{
      const label={codigo:"Código",referencia:"Referência",descricao:"Descrição"}[tipo];
      return '<button type="button" data-dl-tipo="'+tipo+'" class="'+(tipo==="codigo"?"ativo":"")+
        '" aria-pressed="'+(tipo==="codigo"?"true":"false")+'">'+label+'</button>';
    }).join('');
    const controls=contagem?
      '<div class="acoes-contagem-manual-config"><button type="button" class="botao-aba botao-config-contagem-manual"'+
      ' data-dl-config="'+aba+'" aria-label="Informações do estoque local">⚙</button></div>':'';
    const panel='<div class="painel '+classe+(contagem?' dl-contagem-principal':'')+'">'+
      '<div class="'+prefix+'-topo"><div class="'+prefix+'-marca">'+
      '<span class="'+prefix+'-icone">'+(contagem?'▤':'⌕')+'</span>'+
      '<div><strong>PMobile</strong><small>'+subtitulo+'</small></div></div>'+
      '<span class="'+prefix+'-selo">● '+(contagem?'Registro local':'Dados locais')+'</span></div>'+
      '<div class="'+prefix+'-intro"><h2>'+nome+'</h2><p>'+etapa+'</p></div>'+
      (contagem?'<h3 class="contagem-v2-etapa">01 · Localizar material</h3>':'')+
      '<form class="'+(contagem?'linha-formulario linha-contagem-manual-busca':'dl-pesquisa-original')+
      '" data-dl-busca="'+aba+'">'+
      '<div class="'+prefix+'-campo"><span aria-hidden="true">⌕</span>'+
      '<input type="search" name="termo" placeholder="Digite o código" autocomplete="off" aria-label="Buscar material"></div>'+
      selector+
      '<div class="'+prefix+'-tipos" role="group" aria-label="Pesquisar por">'+buttons+'</div>'+
      '<button type="submit" class="'+(contagem?'botao-aba botao-buscar-contagem-manual':'pesquisa-v2-buscar')+
      '">⌕ &nbsp; Buscar material</button>'+controls+'</form>'+
      '<div class="'+prefix+'-resultados" id="dlResultados-'+aba+'" aria-live="polite"></div>'+
      (contagem?'<p class="dl-informacao" id="dlConfig-'+aba+'" hidden>'+
        'Base independente: somente o catálogo e o histórico de Dados locais são utilizados.</p>':'')+
      '</div>';
    return panel+(contagem?'':paginacao(aba));
  }
  function compararForm(aba) {
    const titulo=aba==="locais"?"Buscar alteração de local":aba==="divergencias"?
      "Pesquisar divergências":"Pesquisar material";
    return '<div class="painel painel-locais"><div class="dl-nativo-comparador">'+
      resumo(aba)+
      '<form class="locais-v3-ferramentas" data-dl-comparar="'+aba+'">'+
      '<label> '+titulo+'<input type="search" name="termo" placeholder="Código, produto ou local..." autocomplete="off"></label>'+
      '<span class="locais-v3-ajuda">Comparação automática ao abrir a tela e ao pesquisar. Indicadores da página atual.</span>'+
      '</form><div id="dlResultados-'+aba+'" aria-live="polite"></div>'+
      paginacao(aba)+'</div></div>';
  }
  function painel(id,conteudo,nota) {
    return '<section data-dl-panel="'+id+'" hidden>'+
      '<div class="dl-retorno"><button type="button" class="botao-voltar-tela" data-dl-back aria-label="Voltar">‹</button>'+
      '<span>'+escape(nota||"Contagem local, independente da Dogo.")+'</span></div>'+
      conteudo+'</section>';
  }
  function cartaoMenu(id) {
    const descricoes={
      pesquisa:"Consultar códigos, referências e descrições",
      estoque:"Preencher quantidades, reservas e local",
      reservas:"Acompanhar reservas do estoque local",
      conferencias:"Registrar e consultar contagens realizadas",
      comparar:"Verificar automaticamente as duas bases",
      divergencias:"Acompanhar diferenças de quantidades",
      locais:"Ver locais anteriores e novos locais",
      importar:"Atualizar cadastro sem alterar contagens"
    };
    return '<button type="button" class="configuracoes-v3-card" data-dl-open="'+id+'">'+
      '<span class="configuracoes-v3-icone">'+icone(id)+'</span>'+
      '<span class="configuracoes-v3-textos"><strong>'+TITULOS[id]+'</strong>'+
      '<small>'+descricoes[id]+'</small></span>'+
      '<span class="configuracoes-v3-canto" aria-hidden="true">↗</span></button>';
  }
  function htmlPrincipal() {
    return '<div class="dl-app"><div class="cabecalho-pagina">'+
      '<p class="cabecalho-caminho" id="dlCabecalhoCaminho">PMOBILE / Dados locais</p>'+
      '<h1 id="dlCabecalhoTitulo">Dados locais</h1>'+
      '<p id="dlCabecalhoDescricao">Cadastro permanente, controle manual e comparação com a Dogo.</p>'+
      '</div><div id="dlMensagem" role="status" aria-live="polite"></div>'+
      '<section data-dl-panel="inicio" class="configuracoes-v3-hub">'+
      '<div class="configuracoes-v3-grupo"><p class="configuracoes-v3-etiqueta">ESTOQUE LOCAL</p>'+
      '<div class="configuracoes-v3-grade">'+["pesquisa","estoque","reservas","conferencias"].map(cartaoMenu).join("")+'</div></div>'+
      '<div class="configuracoes-v3-grupo"><p class="configuracoes-v3-etiqueta">VERIFICAÇÃO E CADASTRO</p>'+
      '<div class="configuracoes-v3-grade">'+["comparar","divergencias","locais","importar"].map(cartaoMenu).join("")+'</div></div>'+
      '<p class="dl-informacao">As funções originais da Dogo permanecem inalteradas.</p></section>'+
      painel("pesquisa",pesquisarForm("pesquisa"),"Pesquisa na base independente da Dogo.")+
      painel("estoque",pesquisarForm("estoque")+
        '<form id="dlFormEstoque" class="painel contagem-v2 contagem-v2-registro" hidden>'+
        '<h3 class="contagem-v2-etapa" id="dlEditorTitulo">02 · Registrar estoque local</h3>'+
        '<div class="linha-formulario">'+
        '<label class="contagem-v2-label">Quantidade do item<input id="dlQtdItem" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label class="contagem-v2-label">Quantidade total<input id="dlQtdTotal" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label class="contagem-v2-label">Itens reservados<input id="dlQtdReservada" type="number" min="0" step="any" placeholder="Não preenchido"></label>'+
        '<label class="contagem-v2-label">Local<input id="dlLocal" type="text" placeholder="Não preenchido"></label>'+
        '<button class="botao-aba contagem-v2-salvar" type="submit">✓ &nbsp; Salvar estoque local</button></div></form>',
        "Altere somente o estoque manual; a Dogo permanece intacta.")+
      painel("reservas",pesquisarForm("reservas"),"Materiais com reservas preenchidas no estoque local.")+
      painel("conferencias",pesquisarForm("conferencias")+
        '<form id="dlFormConferencia" class="painel contagem-v2 contagem-v2-registro" hidden>'+
        '<h3 class="contagem-v2-etapa">02 · Registrar conferência local</h3>'+
        '<div id="dlConSelecionado" class="dl-material-selecionado"></div>'+
        '<div class="linha-formulario">'+
        '<label class="contagem-v2-label">Código do material<input id="dlConCodigo" readonly required></label>'+
        '<label class="contagem-v2-label">Local encontrado<input id="dlConLocal" placeholder="Ex.: A-03-12"></label>'+
        '<label class="contagem-v2-label">Quantidade física<input id="dlConQuantidade" type="number" min="0" step="any" required></label>'+
        '<button class="botao-aba contagem-v2-salvar" type="submit">✓ &nbsp; Salvar conferência</button>'+
        '</div></form>'+
        '<div class="painel contagem-v2 contagem-v2-lista">'+
        '<div class="contagem-v2-lista-titulo"><div><h3>Contagens registradas</h3>'+
        '<p>Histórico local independente</p></div><span aria-hidden="true">▤</span></div>'+
        '<div id="dlHistorico"></div></div>',
        "Conferências locais são separadas do histórico original.")+
      painel("comparar",compararForm("comparar"),"Comparação automática entre Dogo e Contagem local.")+
      painel("divergencias",compararForm("divergencias"),"Diferenças entre as duas bases, sem alterar os registros.")+
      painel("locais",compararForm("locais"),"Local anterior (Dogo) e novo local (Contagem local).")+
      painel("importar",'<div class="painel"><h3>Importar cadastro permanente</h3>'+
        '<p class="dl-informacao">Apenas código, referência, descrição e marca. Quantidades e locais manuais serão preservados.</p>'+
        '<form id="dlFormImportar">'+
        '<label for="dlArquivo">Planilha Dogo</label>'+
        '<input class="arquivo-importacao" type="file" id="dlArquivo" accept=".xlsx,.xls,.xlsb,.xlsm,.csv,.html,.htm" required>'+
        '<div class="acoes-importacao"><button class="botao-aba botao-importar-materiais" type="submit" id="dlBotaoImportar">Importar planilha</button></div></form>'+
        '<p id="dlProgresso" role="status" aria-live="polite"></p>'+
        '<div id="dlProgressoBarra" role="progressbar" aria-label="Importação" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>'+
        '<span id="dlProgressoPreenchimento" style="width:0%"></span></div></div>',
        "Importação cumulativa: não elimina os materiais já cadastrados.")+
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
    // A busca de Locais acompanha o campo nativo e consulta sob demanda.
    // Não existe botão obrigatório para comparar; mantém atualização automática.
    let timerBusca=null;
    section.addEventListener("input",e=>{
      const input=e.target.closest('form[data-dl-comparar] input[name="termo"]');
      if(!input)return;
      const form=input.closest("form[data-dl-comparar]"),aba=form.dataset.dlComparar;
      clearTimeout(timerBusca);
      timerBusca=setTimeout(()=>{
        if(estado.tela!==aba)return;
        estado.offsets[aba]=0;
        consultar(aba);
      },450);
    });
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
    const cabTitulo=$("dlCabecalhoTitulo"),cabCaminho=$("dlCabecalhoCaminho"),cabDescricao=$("dlCabecalhoDescricao");
    if(cabTitulo)cabTitulo.textContent=nome==="inicio"?"Dados locais":TITULOS[nome];
    if(cabCaminho)cabCaminho.textContent=nome==="inicio"?"PMOBILE / Dados locais":"PMOBILE / Dados locais / "+TITULOS[nome];
    if(cabDescricao)cabDescricao.textContent=nome==="inicio"?
      "Cadastro permanente, controle manual e comparação com a Dogo.":
      "Estoque independente da Dogo · Dados locais";
    document.querySelectorAll("#dadosLocais [data-dl-panel]").forEach((p)=>{
      p.hidden=p.dataset.dlPanel!==nome;
    });
    const menu=$("menuDadosLocais");if(menu)menu.classList.add("ativo");
    if (["reservas","comparar","divergencias","locais"].includes(nome)){
      estado.offsets[nome]=0;consultar(nome);
    }else if(nome==="conferencias"){
      $("dlFormConferencia").hidden=true;
      listarConferencias();
    }
  }
  function voltar() {if(estado.tela!=="inicio"){tela("inicio");return true;}if(typeof window.mostrarTelaSistema==="function"){window.mostrarTelaSistema("homeSistema",null,true);return true;}return false;}
  function onClick(e) {
    const abrirBtn=e.target.closest("[data-dl-open]");
    if(abrirBtn){tela(abrirBtn.dataset.dlOpen);return;}
    if(e.target.closest("[data-dl-back]")){voltar();return;}
    const config=e.target.closest("[data-dl-config]");
    if(config){const el=$("dlConfig-"+config.dataset.dlConfig);if(el)el.hidden=!el.hidden;return;}
    const seletor=e.target.closest("[data-dl-seletor]");
    if(seletor){
      const form=seletor.closest("form"), tipos=["codigo","referencia","descricao"];
      const atual=form.elements.tipo.value,proximo=tipos[(tipos.indexOf(atual)+1)%tipos.length];
      const chip=form.querySelector('[data-dl-tipo="'+proximo+'"]');
      if(chip)chip.click();
      return;
    }
    const tipoBtn=e.target.closest("[data-dl-tipo]");
    if(tipoBtn){
      const form=tipoBtn.closest("form[data-dl-busca]");
      const tipo=tipoBtn.dataset.dlTipo;
      if(!form||!["codigo","referencia","descricao"].includes(tipo))return;
      const seletor=form.elements.tipo,campo=form.elements.termo;
      seletor.value=tipo;
      campo.placeholder={codigo:"Digite o código",referencia:"Digite a referência",
        descricao:"Digite a descrição"}[tipo];
      const rotulo=form.querySelector("[data-dl-seletor]");
      if(rotulo)rotulo.textContent={codigo:"CÓD",referencia:"REF",descricao:"DESC"}[tipo];
      form.querySelectorAll("[data-dl-tipo]").forEach(btn=>{
        const ativo=btn.dataset.dlTipo===tipo;
        btn.classList.toggle("ativo",ativo);
        btn.setAttribute("aria-pressed",String(ativo));
      });
      campo.focus();
      return;
    }
    const page=e.target.closest("[data-dl-page]");
    if(page){
      const aba=page.dataset.dlAba, delta=Number(page.dataset.dlPage);
      const tamanho=["comparar","divergencias","locais"].includes(aba)?100:aba==="reservas"?20:50;
      estado.offsets[aba]=Math.max(0,(estado.offsets[aba]||0)+delta*tamanho);
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
    if(conferir){
      const codigo=conferir.dataset.dlConferir;
      const origem=conferir.dataset.dlSource||estado.tela;
      const material=(estado.resultados[origem]||[]).find(m=>m.codigo===codigo);
      if(estado.tela!=="conferencias")tela("conferencias");
      selecionarConferencia(material||{codigo,descricao:"Material"});
      return;
    }
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
      if(["pesquisa","estoque","reservas","conferencias"].includes(aba)){
        const data=await rpc("listar",{p_termo:termo,p_tipo:tipo,p_limite:aba==="reservas"?20:50,p_offset:offset,p_somente_reservas:aba==="reservas"});
        estado.resultados[aba]=Array.isArray(data)?data:[];
        desenharMateriais(aba,estado.resultados[aba]);
      }else{
        const modo=aba==="divergencias"?"divergencias":aba==="locais"?"locais":"todos";
        const data=await rpc("comparar",{p_termo:termo,p_limite:100,p_offset:offset,p_modo:modo});
        estado.resultados[aba]=Array.isArray(data)?data:[];
        estado.ultimaComparacao=Date.now();
        desenharComparacao(aba,estado.resultados[aba]);
      }
      const pag=$("dlPagina-"+aba);
      if(pag)pag.textContent="Página "+(Math.floor(offset/(["comparar","divergencias","locais"].includes(aba)?100:aba==="reservas"?20:50))+1);
    }catch(e){lista.textContent=e.message;mensagem(e.message,true);}
  }
  function indicador(rotulo,numero,tipo) {
    return '<div class="locais-v3-indicador '+(tipo==="alerta"?"alerta":tipo==="ok"?"sucesso":"")+
      '"><span>'+rotulo+'</span><strong>'+Number(numero).toLocaleString("pt-BR")+'</strong></div>';
  }
  function detalhe(rotulo,v) {
    return '<div><small>'+rotulo+'</small><b>'+escape(valor(v))+'</b></div>';
  }
  function atualizarResumo(aba,itens,comparacao) {
    const area=$("dlResumo-"+aba);if(!area)return;
    if(comparacao){
      const diferentes=itens.filter(m=>m.diferenca_quantidade||m.diferenca_reserva||m.diferenca_local).length;
      const semDogo=itens.filter(m=>m.sem_dogo).length;
      const pendentes=itens.filter(m=>m.pendente_quantidade||m.pendente_reserva||m.pendente_local).length;
      area.innerHTML=indicador("Diferentes",diferentes,"alerta")+
        indicador("Sem Dogo",semDogo,"alerta")+indicador("Pendentes",pendentes);
    }
  }
  function desenharMateriais(aba,itens) {
    const el=$("dlResultados-"+aba);el.replaceChildren();
    if(aba==="reservas"){
      if(!itens.length){
        el.innerHTML='<div class="reservas-vazio"><strong>Nenhum item em reserva</strong>'+
          '<span>Materiais com reserva local maior que zero aparecerão aqui.</span></div>';
        return;
      }
      const dados=(v)=>escape(v===null||v===undefined||v===""?"—":v);
      const headers=["ID","Descrição","Referência","Marca","Quantidade","Solicitante"];
      el.innerHTML='<div class="reservas-cabecalho">'+headers.map(t=>'<span>'+t+'</span>').join("")+'</div>'+
        itens.map(m=>'<article class="reserva-item">'+
          '<div class="reserva-celula reserva-id" data-label="ID">'+dados(m.codigo)+'</div>'+
          '<div class="reserva-celula reserva-descricao" data-label="Descrição">'+dados(m.descricao)+'</div>'+
          '<div class="reserva-celula reserva-referencia" data-label="Referência">'+dados(m.referencia)+'</div>'+
          '<div class="reserva-celula reserva-marca" data-label="Marca">'+dados(m.marca)+'</div>'+
          '<div class="reserva-celula reserva-quantidade" data-label="Quantidade">'+num(m.quantidade_reservada)+'</div>'+
          '<div class="reserva-celula reserva-solicitante" data-label="Solicitante">—</div>'+
          '</article>').join("");
      return;
    }
    if(!itens.length){
      el.innerHTML='<div class="pesquisa-v2-vazio"><strong>Nenhum material encontrado</strong>'+
        '<p>Confira o material e tente novamente.</p></div>';return;
    }
    if(aba==="estoque"||aba==="conferencias"){
      itens.forEach(m=>{
        const bloco=document.createElement("div");
        bloco.className="resultado-contagem-manual";
        const titulo=document.createElement("h3");
        titulo.textContent=m.codigo+" — "+(m.descricao||"Material");
        const detalhes=document.createElement("p");
        detalhes.textContent="Referência: "+valor(m.referencia)+" | Local: "+valor(m.local)+
          " | Estoque local: "+num(m.quantidade_total);
        const btn=document.createElement("button");
        btn.type="button";btn.className="botao-principal";
        btn.textContent=aba==="conferencias"?"Selecionar para conferência":"Editar estoque local";
        if(aba==="conferencias"){
          btn.dataset.dlConferir=m.codigo;btn.dataset.dlSource=aba;
        }else{btn.dataset.dlEdit=m.codigo;btn.dataset.dlSource=aba;}
        bloco.append(titulo,detalhes,btn);
        el.appendChild(bloco);
      });
      return;
    }
    const cont=document.createElement("p");cont.className="pesquisa-v2-contagem";
    cont.textContent=itens.length+" material(is) nesta página";el.appendChild(cont);
    itens.forEach((m)=>{
      const cadastrado=m.quantidade_total!==null||m.quantidade_item!==null||
        m.quantidade_reservada!==null||Boolean(m.local);
      const card=document.createElement("details");card.className="pesquisa-v2-card";
      const sum=document.createElement("summary");
      const cod=document.createElement("span");cod.className="pesquisa-v2-codigo";cod.textContent=m.codigo;
      const status=document.createElement("span");status.className="pesquisa-v2-disponivel"+(cadastrado?"":" zero");
      status.textContent=cadastrado?"Dados preenchidos":"Pendente";
      const desc=document.createElement("strong");desc.textContent=m.descricao;
      const ref=document.createElement("small");ref.textContent="Ref.: "+valor(m.referencia)+" · Toque para detalhes";
      sum.append(cod,status,desc,ref);card.appendChild(sum);
      const detalhes=document.createElement("div");detalhes.className="pesquisa-v2-detalhes";
      [["Código",m.codigo],["Referência",m.referencia],["Marca",m.marca],
       ["Local",m.local],["Quantidade do item",num(m.quantidade_item)],
       ["Quantidade total",num(m.quantidade_total)],["Itens reservados",num(m.quantidade_reservada)]]
       .forEach(([label,v])=>{
         const box=document.createElement("div"),small=document.createElement("small"),bold=document.createElement("b");
         small.textContent=label;bold.textContent=valor(v);box.append(small,bold);detalhes.appendChild(box);
       });
      card.appendChild(detalhes);
      const acoes=document.createElement("div");acoes.className="dl-local-acoes";
      [["Editar estoque local","dlEdit","dlSource"],["Conferir material","dlConferir",null]]
        .forEach(([texto,prop,second])=>{
          const btn=document.createElement("button");btn.type="button";btn.className="botao-aba";
          btn.textContent=texto;btn.dataset[prop]=m.codigo;
          if(second)btn.dataset[second]=aba;
          acoes.appendChild(btn);
        });
      card.appendChild(acoes);el.appendChild(card);
    });
  }
  function desenharComparacao(aba,itens) {
    const el=$("dlResultados-"+aba);el.replaceChildren();
    atualizarResumo(aba,itens,true);
    if(!itens.length){
      el.innerHTML='<p class="locais-v3-sem-resultado">Nenhuma ocorrência nesta página. '+
        (aba==="locais"?"Locais vazios na Contagem local continuam pendentes, não divergentes.":"")+
        '</p>';return;
    }
    // Divergências originais usam um resumo Faltantes/Sobras e cartões
    // registro-divergencia — não os cartões de movimentação de Locais.
    if(aba==="divergencias"){
      const validos=itens.filter(m=>m.dogo_quantidade!==null&&
        m.local_quantidade!==null&&!m.sem_dogo);
      const faltantes=validos.filter(m=>Number(m.local_quantidade)<Number(m.dogo_quantidade));
      const sobras=validos.filter(m=>Number(m.local_quantidade)>Number(m.dogo_quantidade));
      const sum=arr=>arr.reduce((total,m)=>total+
        Math.abs(Number(m.local_quantidade)-Number(m.dogo_quantidade)),0);
      el.innerHTML='<div class="dl-divergencias-resumo">'+
        '<p>🔴 <strong>Faltantes:</strong> '+faltantes.length+' produtos / '+
        num(sum(faltantes))+' unidades</p>'+
        '<p>🟢 <strong>Sobras:</strong> '+sobras.length+' produtos / '+
        num(sum(sobras))+' unidades</p></div>'+
        itens.map(m=>{
          const tipo=m.sem_dogo?"NÃO CADASTRADO NA DOGO":
            m.local_quantidade===null?"PENDENTE":
            m.diferenca_quantidade?(Number(m.local_quantidade)<Number(m.dogo_quantidade)?"🔴 FALTANTE":"🟢 SOBRA"):
            m.diferenca_reserva?"RESERVA DIVERGENTE":"VERIFICAR";
          return '<div class="registro-divergencia"><h3>'+escape(m.descricao)+'</h3>'+
            '<p><strong>Código:</strong> '+escape(m.codigo)+'</p>'+
            '<p><strong>Dogo:</strong> '+num(m.dogo_quantidade)+
            ' · <strong>Local:</strong> '+num(m.local_quantidade)+'</p>'+
            '<p><strong>Classificação:</strong> '+tipo+'</p></div>';
        }).join("");
      return;
    }
    el.innerHTML=itens.map(m=>{
      const difer=m.diferenca_quantidade||m.diferenca_reserva||m.diferenca_local;
      const pend=m.pendente_quantidade||m.pendente_reserva||m.pendente_local;
      const st=m.sem_dogo?"Não cadastrado na Dogo":difer?"Divergente":pend?"Pendente":"Conferido";
      const classe=difer?"pendente":"confirmado";
      const local='<div class="locais-v3-local"><span class="locais-v3-rotulo">ALTERAÇÃO DE LOCAL</span>'+
        '<div class="locais-v3-trajeto"><div class="locais-v3-endereco">'+
        '<span>Local anterior</span><strong>'+escape(valor(m.dogo_local))+'</strong></div>'+
        '<span class="locais-v3-seta" aria-hidden="true">→</span>'+
        '<div class="locais-v3-endereco"><span>Novo local</span><strong>'+
        escape(valor(m.local_local))+'</strong></div></div></div>';
      return '<details class="local-alterado-card locais-v3-cartao">'+
        '<summary class="locais-v3-resumo-cartao">'+
        '<div class="locais-v3-topo"><div class="locais-v3-produto">'+
        '<h3>'+escape(m.descricao)+'</h3><p>Cód. '+escape(m.codigo)+'</p></div>'+
        '<span class="local-alterado-status '+classe+'">'+st+'</span></div>'+local+
        '<div class="locais-v3-metricas">'+
        '<div><span>Estoque Dogo</span><strong>'+num(m.dogo_quantidade)+'</strong></div>'+
        '<div><span>Estoque local</span><strong>'+num(m.local_quantidade)+'</strong></div>'+
        '</div><span class="locais-v3-expandir"><span class="fechado">Ver mais detalhes</span>'+
        '<span class="aberto">Ocultar detalhes</span>'+
        '<span class="locais-v3-chevron" aria-hidden="true">⌄</span></span></summary>'+
        '<div class="locais-v3-detalhes">'+
        '<div><span>Reservas Dogo</span><strong>'+num(m.dogo_reservada)+'</strong></div>'+
        '<div><span>Reservas locais</span><strong>'+num(m.local_reservada)+'</strong></div>'+
        '<div><span>Situação</span><strong>'+(m.sem_dogo?"Cadastro não encontrado na Dogo":
        pend?"Campos não preenchidos tratados como pendentes":st)+'</strong></div></div></details>';
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
  function selecionarConferencia(material) {
    $("dlConCodigo").value=material.codigo;
    $("dlConQuantidade").value="";
    $("dlConLocal").value="";
    $("dlConSelecionado").textContent=material.codigo+" — "+(material.descricao||"Material");
    const form=$("dlFormConferencia");
    form.hidden=false;
    form.scrollIntoView({block:"nearest",behavior:"smooth"});
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
      $("dlFormConferencia").hidden=true;
      mensagem("Conferência local registrada, sem alterar o estoque permanente.");
      await listarConferencias();
    }finally{estado.busy=false;}
  }
  async function listarConferencias() {
    const el=$("dlHistorico");if(!el)return;
    el.textContent="Carregando contagens...";
    try{
      const data=await rpc("listar_conferencias",{p_limite:50});
      const itens=Array.isArray(data)?data:[];
      el.replaceChildren();
      if(!itens.length){
        const vazio=document.createElement("p");
        vazio.textContent="Nenhuma conferência local registrada.";
        el.appendChild(vazio);return;
      }
      itens.forEach(m=>{
        const card=document.createElement("div");
        card.className="registro-contagem-manual";
        const titulo=document.createElement("h3");
        titulo.textContent=m.codigo+" — "+(m.descricao||"Material");
        const detalhes=document.createElement("p");
        detalhes.textContent="Local: "+valor(m.local_encontrado)+
          " | Físico: "+num(m.quantidade_fisica);
        const responsavel=document.createElement("p");
        responsavel.textContent="Realizado por: "+(m.usuario_nome||"Não identificado");
        const data=document.createElement("p");
        data.textContent="Data/hora: "+(m.criado_em?new Date(m.criado_em).toLocaleString("pt-BR"):"—");
        const status=document.createElement("p");
        status.textContent="REGISTRO LOCAL";
        card.append(titulo,detalhes,responsavel,data,status);el.appendChild(card);
      });
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
  function atualizarProgressoImportacao(indice,total) {
    const barra=$("dlProgressoBarra"),preenchimento=$("dlProgressoPreenchimento");
    if(!barra||!preenchimento)return;
    barra.hidden=false;
    const porcentagem=total>0?Math.max(0,Math.min(100,Math.round(indice/total*100))):0;
    barra.setAttribute("aria-valuenow",String(porcentagem));
    preenchimento.style.width=porcentagem+"%";
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
      atualizarProgressoImportacao(contexto.indice,materiais.length);
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
        atualizarProgressoImportacao(contexto.indice,materiais.length);
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
