/* PMobile / Dados locais: importacao. Módulo independente da Dogo. */
(function(){
 "use strict";
 const registry=window.PMobileDadosLocaisModulos||(window.PMobileDadosLocaisModulos=Object.create(null));
 registry.importacao=function(ctx){
  const {$,estado,norm,rpc,sessao,mensagem,painel}=ctx;
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

  function template(){return painel("importar",'<div class="painel"><h3>Importar cadastro permanente</h3>'+
        '<p class="dl-informacao">Apenas código, referência, descrição e marca. Quantidades e locais manuais serão preservados.</p>'+
        '<form id="dlFormImportar">'+
        '<label for="dlArquivo">Planilha Dogo</label>'+
        '<input class="arquivo-importacao" type="file" id="dlArquivo" accept=".xlsx,.xls,.xlsb,.xlsm,.csv,.html,.htm" required>'+
        '<div class="acoes-importacao"><button class="botao-aba botao-importar-materiais" type="submit" id="dlBotaoImportar">Importar planilha</button></div></form>'+
        '<p id="dlProgresso" role="status" aria-live="polite"></p>'+
        '<div id="dlProgressoBarra" role="progressbar" aria-label="Importação" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>'+
        '<span id="dlProgressoPreenchimento" style="width:0%"></span></div></div>',
        "Importação cumulativa: não elimina os materiais já cadastrados.");}
  return {textoSeguroCatalogo,erroJsonImportacao,erroTemporarioImportacao,enviarLoteCatalogo,chaveArquivoCatalogo,lerPlanilha,importar,template};
 };
})();
