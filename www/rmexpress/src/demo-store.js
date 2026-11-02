import { ENTREGAS_DEMO } from "./demo-data.js";
import { STATUS_ENTREGA, atualizarStatus, moverParada, resumirEntregas } from "./domain.js";

// Apenas exemplos ficticios ficam neste armazenamento. Nunca importar dados reais aqui.
export const STORAGE_KEY="pmentregas_demo_v1";
const ids=ENTREGAS_DEMO.map(x=>x.id);
const validos=new Set(Object.values(STATUS_ENTREGA));

export function criarDemo(){
  return { ativo:true, ordem:[...ids], status:Object.fromEntries(ids.map(id=>[id,STATUS_ENTREGA.PENDENTE])) };
}

export function validarDemo(raw){
  if(!raw || raw.ativo!==true || !Array.isArray(raw.ordem) || !raw.status || typeof raw.status!=="object")return null;
  if(raw.ordem.length!==ids.length || new Set(raw.ordem).size!==ids.length || !ids.every(id=>raw.ordem.includes(id)))return null;
  if(!ids.every(id=>validos.has(raw.status[id])))return null;
  return {ativo:true,ordem:[...raw.ordem],status:Object.fromEntries(ids.map(id=>[id,raw.status[id]]))};
}

export function lerDemo(storage){
  try{return validarDemo(JSON.parse(storage.getItem(STORAGE_KEY)||"null"));}catch{return null;}
}

export function salvarDemo(storage,state){
  const seguro=validarDemo(state);
  if(!seguro)throw new Error("Dados da demonstração inválidos.");
  try{storage.setItem(STORAGE_KEY,JSON.stringify(seguro));return true;}catch{return false;}
}

export function limparDemo(storage){
  try{storage.removeItem(STORAGE_KEY);return true;}catch{return false;}
}

export function entregasDemo(state){
  if(!state?.ativo)return [];
  return state.ordem.map((id,indice)=>{
    const dados=ENTREGAS_DEMO.find(e=>e.id===id);
    return {...dados,ordem:indice+1,status:state.status[id]};
  });
}

export function alterarEntregaDemo(state,id,proximoStatus){
  const seguro=validarDemo(state);
  if(!seguro || !ids.includes(id))throw new Error("Entrega de demonstração inválida.");
  const alterada=atualizarStatus({id,status:seguro.status[id]},proximoStatus);
  return {...seguro,status:{...seguro.status,[id]:alterada.status}};
}

export function moverEntregaDemo(state,id,direcao){
  const seguro=validarDemo(state);
  if(!seguro || !ids.includes(id))throw new Error("Parada de demonstração inválida.");
  if(seguro.status[id]===STATUS_ENTREGA.ENTREGUE)throw new Error("Entrega concluída não pode mudar de ordem.");
  const pendentes=seguro.ordem.filter(x=>seguro.status[x]!==STATUS_ENTREGA.ENTREGUE);
  const novaOrdem=moverParada(pendentes,id,direcao);
  const concluidas=seguro.ordem.filter(x=>seguro.status[x]===STATUS_ENTREGA.ENTREGUE);
  return {...seguro,ordem:[...novaOrdem,...concluidas]};
}

export function resumoDemo(state){
  return resumirEntregas(entregasDemo(state));
}
