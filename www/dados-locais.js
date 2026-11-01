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
  function pesquisarForm(aba){return aba==="reservas"?modulos.reservas.form():modulos.pesquisa.form(aba);}
  function compararForm(aba){return modulos.comparar.form(aba);}
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
      modulos.estoque.template()+
      modulos.reservas.template()+
      modulos.conferencias.template()+
      modulos.comparar.template()+
      modulos.divergencias.template()+
      modulos.locais.template()+
      modulos.importacao.template()+
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
      const origem=edit.dataset.dlSource;
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
  function indicador(...a){return modulos.comparar.indicador(...a);}
  function detalhe(...a){return modulos.comparar.detalhe(...a);}
  function atualizarResumo(...a){return modulos.comparar.atualizarResumo(...a);}
  function desenharMateriais(aba,itens){return aba==="reservas"?modulos.reservas.render(itens):modulos.pesquisa.render(aba,itens);}
  function desenharComparacao(aba,itens){return aba==="divergencias"?modulos.divergencias.render(itens):modulos.locais.render(aba,itens);}
  function selecionar(...a){return modulos.estoque.selecionar(...a);}
  function selecionarConferencia(...a){return modulos.conferencias.selecionarConferencia(...a);}
  function quantidade(...a){return modulos.estoque.quantidade(...a);}
  async function salvarEstoque(...a){return modulos.estoque.salvarEstoque(...a);}
  async function registrarConferencia(...a){return modulos.conferencias.registrarConferencia(...a);}
  async function listarConferencias(...a){return modulos.conferencias.listarConferencias(...a);}
  function textoSeguroCatalogo(...a){return modulos.importacao.textoSeguroCatalogo(...a);}
  function erroJsonImportacao(...a){return modulos.importacao.erroJsonImportacao(...a);}
  function erroTemporarioImportacao(...a){return modulos.importacao.erroTemporarioImportacao(...a);}
  function espera(...a){return modulos.importacao.espera(...a);}
  async function enviarLoteCatalogo(...a){return modulos.importacao.enviarLoteCatalogo(...a);}
  function chaveArquivoCatalogo(...a){return modulos.importacao.chaveArquivoCatalogo(...a);}
  function lerCheckpointCatalogo(...a){return modulos.importacao.lerCheckpointCatalogo(...a);}
  function salvarCheckpointCatalogo(...a){return modulos.importacao.salvarCheckpointCatalogo(...a);}
  function removerCheckpointCatalogo(...a){return modulos.importacao.removerCheckpointCatalogo(...a);}
  function lerPlanilha(...a){return modulos.importacao.lerPlanilha(...a);}
  function atualizarProgressoImportacao(...a){return modulos.importacao.atualizarProgressoImportacao(...a);}
  async function importar(...a){return modulos.importacao.importar(...a);}
  // Módulos recebem somente a API comum; funções e estados próprios
  // ficam encapsulados em cada arquivo, sem modificar o inventário Dogo.
  const contexto=Object.freeze({$,estado,escape,valor,num,norm,rpc,sessao,mensagem,consultar,paginacao,resumo,painel,pesquisarForm,compararForm,atualizarResumo,desenharMateriais,desenharComparacao,quantidade});
  const factories=window.PMobileDadosLocaisModulos||{};
  const modulos={};
  for(const key of ["pesquisa","estoque","reservas","conferencias","comparar","divergencias","locais","importacao"]){
    if(typeof factories[key]!=="function")throw new Error("PMobile: módulo Dados locais ausente: "+key);
    modulos[key]=factories[key](contexto);
  }
  window.abrirDadosLocaisPmobile=abrir;
  window.voltarUmNivelDadosLocais=function(telaAtual) {
    if(telaAtual!=="dadosLocais")return false;
    return voltar();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
