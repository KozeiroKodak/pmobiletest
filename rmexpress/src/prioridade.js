// Regra de prioridade do PMEntregas, espelhada em
// private.pmentregas_prioridade_nf no Supabase.
// Prioridade por NF agrupada: E(1) > P(2) > R(3) > outras(4).
const CLASSIFICACOES=Object.freeze([
  Object.freeze({ordem:1,rotulo:"Expressa",tipo:"expressa",letra:"E"}),
  Object.freeze({ordem:2,rotulo:"Prioridade",tipo:"prioritaria",letra:"P"}),
  Object.freeze({ordem:3,rotulo:"Reenvio",tipo:"reenvio",letra:"R"}),
  Object.freeze({ordem:4,rotulo:"Normal",tipo:"normal",letra:null})
]);

export function separarNotas(valor){
  return String(valor??"").split(/\s+-\s+|[;,]+/).map(nf=>nf.trim()).filter(Boolean);
}

export function classificarNF(valor){
  const partes=separarNotas(valor);
  const codigos=partes.map(nf=>{
    const suffix=/^[0-9]+([EPR])$/i.exec(nf);
    return suffix?suffix[1].toUpperCase():null;
  });
  const prioridade=codigos.includes("E")?1:codigos.includes("P")?2:codigos.includes("R")?3:4;
  return {...CLASSIFICACOES[prioridade-1],agrupada:partes.length>1,quantidade:partes.length};
}

export const CATEGORIAS_NF = Object.freeze([
  Object.freeze({id:"todas",nome:"Todas",ordem:null}),
  Object.freeze({id:"expressa",nome:"Expressas",ordem:1}),
  Object.freeze({id:"prioritaria",nome:"Prioridades",ordem:2}),
  Object.freeze({id:"reenvio",nome:"Reenvios",ordem:3}),
  Object.freeze({id:"normal",nome:"Outras",ordem:4})
]);

export function contarCategorias(registros){
  if(!Array.isArray(registros))throw new TypeError("Registros inválidos");
  const contagem={todas:registros.length,expressa:0,prioritaria:0,reenvio:0,normal:0};
  for(const item of registros){
    const categoria=classificarNF(item?.notas_fiscais).tipo;
    const chave=categoria==="prioritaria"?"prioritaria":categoria;
    contagem[chave]++;
  }
  return contagem;
}

export function filtrarCategoria(registros,categoria="todas"){
  if(!Array.isArray(registros))throw new TypeError("Registros inválidos");
  const valida=CATEGORIAS_NF.some(x=>x.id===categoria);
  if(!valida)throw new Error("Categoria inválida");
  return categoria==="todas" ? [...registros] :
    registros.filter(item=>classificarNF(item?.notas_fiscais).tipo===categoria);
}
