export const STATUS_ENTREGA = Object.freeze({
  PENDENTE: "pendente",
  EM_ROTA: "em_rota",
  ENTREGUE: "entregue",
  OCORRENCIA: "ocorrencia"
});

const TRANSICOES = Object.freeze({
  [STATUS_ENTREGA.PENDENTE]: [STATUS_ENTREGA.EM_ROTA],
  [STATUS_ENTREGA.EM_ROTA]: [STATUS_ENTREGA.ENTREGUE, STATUS_ENTREGA.OCORRENCIA],
  [STATUS_ENTREGA.OCORRENCIA]: [STATUS_ENTREGA.EM_ROTA],
  [STATUS_ENTREGA.ENTREGUE]: []
});

// Lógica de dominio pura; nao realiza escrita externa.
export function resumirEntregas(entregas) {
  if (!Array.isArray(entregas)) throw new TypeError("entregas deve ser um array");
  const resultado = { total: entregas.length, pendentes: 0, emRota: 0, entregues: 0, ocorrencias: 0 };
  for (const entrega of entregas) {
    switch (entrega?.status) {
      case STATUS_ENTREGA.PENDENTE: resultado.pendentes++; break;
      case STATUS_ENTREGA.EM_ROTA: resultado.emRota++; break;
      case STATUS_ENTREGA.ENTREGUE: resultado.entregues++; break;
      case STATUS_ENTREGA.OCORRENCIA: resultado.ocorrencias++; break;
      default: break;
    }
  }
  return resultado;
}

export function ordenarParadas(paradas) {
  if (!Array.isArray(paradas)) throw new TypeError("paradas deve ser um array");
  return paradas.map((item, indice) => ({ item, indice }))
    .sort((a, b) => {
      const oa = Number.isInteger(a.item?.ordem) && a.item.ordem > 0 ? a.item.ordem : Number.MAX_SAFE_INTEGER;
      const ob = Number.isInteger(b.item?.ordem) && b.item.ordem > 0 ? b.item.ordem : Number.MAX_SAFE_INTEGER;
      return oa - ob || a.indice - b.indice;
    }).map(x => x.item);
}

export function atualizarStatus(entrega, proximo) {
  if (!entrega || typeof entrega !== "object") throw new TypeError("entrega inválida");
  const permitidos = TRANSICOES[entrega.status];
  if (!permitidos || !permitidos.includes(proximo)) {
    throw new Error("Transição de status não permitida.");
  }
  return {...entrega, status: proximo};
}

// Mover uma parada em uma lista imutavel; ignora movimento alem dos limites.
export function moverParada(ids, id, direcao) {
  if (!Array.isArray(ids) || !["subir","descer"].includes(direcao)) throw new TypeError("Dados da rota inválidos.");
  const indice = ids.indexOf(id);
  if (indice < 0) throw new Error("Parada não encontrada.");
  const novoIndice = indice + (direcao === "subir" ? -1 : 1);
  const resultado = [...ids];
  if (novoIndice >= 0 && novoIndice < resultado.length) {
    [resultado[indice], resultado[novoIndice]] = [resultado[novoIndice], resultado[indice]];
  }
  return resultado;
}

export function filtrarEntregas(entregas, termo = "", situacao = "todas") {
  if (!Array.isArray(entregas)) throw new TypeError("entregas deve ser um array");
  const normalizar = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const busca = normalizar(termo).trim();
  return entregas.filter(entrega =>
    (situacao === "todas" || entrega.status === situacao) &&
    (!busca || [entrega.nf, entrega.cliente, entrega.destino, entrega.regiao].some(x => normalizar(x).includes(busca)))
  );
}
