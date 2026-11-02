// Chave PUBLICÁVEL Supabase para uso no navegador. Nunca use service_role aqui.
const URL = "https://rxyvllbebtgbfbqoimwe.supabase.co";
const PUBLIC_KEY = "sb_publishable_Ckh6ls7eIh_11wviwxMlCQ_25Oes0QF";
const PERMITIDAS=new Set(["pmentregas_notificacoes_listar","pmentregas_notificacao_ler","pmentregas_push_registrar",
  "autenticar_usuario",
  "pmcoletas_rmexpress_motoristas",
  "pmentregas_gerencia_notas",
  "pmentregas_gerencia_atribuir",
  "pmentregas_historico_resumo",
  "pmentregas_historico_listar",
  "pmcoletas_motorista_entregas_listar_v2",
  "pmcoletas_motorista_confirmar_rota",
  "pmcoletas_motorista_confirmar_entrega",
  "pmentregas_gerencia_notas_categoria",
  "pmentregas_gerencia_contadores",
  "pmentregas_central_resumo",
  "pmentregas_central_atribuicoes",
  "pmentregas_gerencia_atribuir_lote",
  "pmentregas_gerencia_transferir",
  "pmentregas_destino_salvar",
  "pmentregas_destinos_listar"
]);

export async function rpc(nome,parametros={},opcoes={}) {
  if (!PERMITIDAS.has(nome)) throw new Error("Operação não autorizada no cliente.");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try {
    const resposta=await fetch(URL+"/rest/v1/rpc/"+nome,{
      method:"POST",
      headers:{"apikey":PUBLIC_KEY,"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(parametros),
      signal:opcoes.signal||controller.signal,
      cache:"no-store"
    });
    const texto=await resposta.text();
    let retorno=null;
    if(texto){
      try{retorno=JSON.parse(texto);}catch{throw new Error("Resposta inesperada do Supabase.");}
    }
    if(!resposta.ok){
      const detalhe=typeof retorno?.message==="string" ? retorno.message : "Falha na operação.";
      throw new Error(detalhe);
    }
    return retorno;
  }catch(erro){
    if(erro?.name==="AbortError")throw new Error("Consulta interrompida ou demorou demais. Verifique a conexão.");
    if(erro instanceof TypeError)throw new Error("Não foi possível conectar ao Supabase.");
    throw erro;
  }finally{clearTimeout(timeout);}
}

export async function autenticar(usuario,credencial){
  const dados=await rpc("autenticar_usuario",{p_usuario:usuario,p_credencial:credencial});
  const conta=Array.isArray(dados)?dados[0]:null;
  if(!conta?.ativo || conta.precisa_criar_senha)throw new Error("Acesso indisponível. Verifique os dados ou crie sua senha no PMobile.");
  return {id:conta.id,nome:conta.nome,usuario:conta.usuario,nivel:String(conta.nivel||"").toUpperCase()};
}

export async function listarMotoristas(sessao){
  return rpc("pmcoletas_rmexpress_motoristas",{p_usuario:sessao.usuario,p_credencial:sessao.credencial});
}

export function registrarDispositivo(sessao,token,remover=false){
  return rpc('pmentregas_push_registrar',{p_usuario:sessao.usuario,p_credencial:sessao.credencial,p_token:token,p_remover:remover});
}

export async function buscarDisponiveis(sessao,busca="",offset=0,limit=60){
  return rpc("pmentregas_gerencia_notas",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial,
    p_busca:String(busca).trim().slice(0,100),p_limit:limit,p_offset:offset
  });
}

export async function atribuirMotorista(sessao,rastreioId,motoristaId){
  return rpc("pmentregas_gerencia_atribuir",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial,
    p_rastreio_id:rastreioId,p_motorista_usuario_id:Number(motoristaId)
  });
}

export async function resumirHistoricoEntregas(sessao){
  return rpc("pmentregas_historico_resumo",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial
  });
}

export async function listarHistoricoEntregas(sessao,motoristaId=null,busca="",offset=0,limit=40){
  return rpc("pmentregas_historico_listar",{
    p_usuario:sessao.usuario,
    p_credencial:sessao.credencial,
    p_motorista_usuario_id:motoristaId===null||motoristaId===""?null:Number(motoristaId),
    p_busca:String(busca).trim().slice(0,100),
    p_limit:limit,
    p_offset:offset
  });
}

export async function listarEntregasMotorista(sessao){
  return rpc("pmcoletas_motorista_entregas_listar_v2",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial
  });
}

export async function confirmarRotaMotorista(sessao,ordens){
  if(!Array.isArray(ordens)||!ordens.length||
    !ordens.every(x=>typeof x.id==="string"&&Number.isInteger(x.ordem)&&x.ordem>=1))
    throw new Error("Roteiro inválido.");
  return rpc("pmcoletas_motorista_confirmar_rota",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial,p_ordens:ordens
  });
}

export async function confirmarEntregaMotorista(sessao,rastreioId){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rastreioId||"")))
    throw new Error("Identificador de entrega inválido.");
  return rpc("pmcoletas_motorista_confirmar_entrega",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial,p_rastreio_id:rastreioId
  });
}

export async function contadoresDisponiveis(sessao){
  return rpc("pmentregas_gerencia_contadores",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial
  });
}

export async function buscarDisponiveisPorCategoria(sessao,categoria,busca="",offset=0,limit=60){
  const numero=Number(categoria);
  if(!Number.isInteger(numero)||numero<1||numero>4)
    throw new Error("Categoria inválida");
  return rpc("pmentregas_gerencia_notas_categoria",{
    p_usuario:sessao.usuario,p_credencial:sessao.credencial,
    p_categoria:numero,p_busca:String(busca).trim().slice(0,100),
    p_limit:limit,p_offset:offset
  });
}

const autenticacao = s => ({p_usuario:s.usuario,p_credencial:s.credencial});
export async function centralResumo(s){
 return rpc("pmentregas_central_resumo",autenticacao(s));
}
export async function centralAtribuicoes(s,motoristaId=null,busca="",offset=0){
 return rpc("pmentregas_central_atribuicoes",{
 ...autenticacao(s),p_motorista_id:motoristaId===null?null:Number(motoristaId),
 p_busca:String(busca).slice(0,100),p_offset:offset,p_limit:60
 });
}
export async function atribuirLote(s,ids,motoristaId){
 if(!Array.isArray(ids)||ids.length<1||ids.length>50||
    new Set(ids).size!==ids.length||ids.some(x=>!UUID.test(x)))throw Error("Selecione de 1 a 50 registros distintos.");
 return rpc("pmentregas_gerencia_atribuir_lote",{
 ...autenticacao(s),p_ids:ids,p_motorista_usuario_id:Number(motoristaId)
 });
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function transferirMotorista(s,id,motoristaId){
 if(!UUID.test(String(id)))throw Error("Rastreio inválido");
 return rpc("pmentregas_gerencia_transferir",{
 ...autenticacao(s),p_rastreio_id:id,p_novo_motorista_id:Number(motoristaId)
 });
}
export async function salvarDestino(s,id,endereco,latitude=null,longitude=null){
 if(!UUID.test(String(id))||String(endereco).trim().length<10)throw Error("Confirme um endereço completo.");
 if((latitude===null)!==(longitude===null))throw Error("Informe ambas as coordenadas ou nenhuma.");
 return rpc("pmentregas_destino_salvar",{
 ...autenticacao(s),p_rastreio_id:id,p_endereco:String(endereco).trim(),
 p_latitude:latitude,p_longitude:longitude
 });
}
export async function listarDestinos(s,motoristaId=null){
 return rpc("pmentregas_destinos_listar",{
 ...autenticacao(s),p_motorista_id:motoristaId
 });
}
