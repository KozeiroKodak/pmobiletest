// PMEntregas: separação de interface, sem substituir permissões do servidor.
export const MODOS=Object.freeze({MOTORISTA:"motorista",ADMINISTRATIVO:"administrativo"});
export const PERFIS_ADMIN=Object.freeze(["ADMIN","RMADMIN"]);
export function ehAdministrador(perfil){
 return Boolean(perfil && PERFIS_ADMIN.includes(String(perfil.nivel||"").toUpperCase()));
}
export function podeSelecionarModo(perfil,modo,motoristaHabilitado=false){
 if(modo===MODOS.ADMINISTRATIVO)return ehAdministrador(perfil);
 if(modo!==MODOS.MOTORISTA)return false;
 return Boolean(perfil?.nivel==="RMMOTORISTAS" || (ehAdministrador(perfil)&&motoristaHabilitado));
}
export function podeAbrirArea(perfil,modo,area,{motoristaHabilitado=false,demo=false}={}){
 if(area==="inicio")return true; // só navegação dentro da aplicação visível
 if(modo===MODOS.ADMINISTRATIVO){
  return ehAdministrador(perfil)&&["gerencia","central"].includes(area);
 }
 if(modo===MODOS.MOTORISTA){
  return (demo||podeSelecionarModo(perfil,modo,motoristaHabilitado))
   &&["painel","entregas","roteiros"].includes(area);
 }
 return false;
}
