/* PMobile — interface única entre navegação e módulos legados.
 * Registro explícito, sem avaliar nomes de funções recebidos da interface.
 * Mantém compatibilidade com as funções globais antigas do HTML.
 */
(function(){
 "use strict";
 const retornos=new Map();
 const acoes=new Map();
 const identificador=(nome)=>typeof nome==="string"&&/^[a-z][a-z0-9-]{0,63}$/.test(nome);
 function registrar(map,nome,fn){
   if(!identificador(nome)||typeof fn!=="function")throw new TypeError("Contrato de módulo inválido");
   if(map.has(nome)&&map.get(nome)!==fn)throw new Error("Módulo registrado duas vezes: "+nome);
   map.set(nome,fn);
 }
 function registrarRetorno(nome,fn){registrar(retornos,nome,fn);}
 function registrarAcao(nome,fn){registrar(acoes,nome,fn);}
 function consumirRetorno(telaAtual){
   // A ordem reproduz a navegação histórica, mas os módulos gerenciam o
   // comportamento de retorno sem dependências diretas do script central.
   for(const [nome,retornar] of retornos){
     try{
       if(retornar(telaAtual)===true)return nome;
     }catch(erro){
       console.error("PMobile: falha no retorno do módulo "+nome,erro);
     }
   }
   return null;
 }
 function executarAcao(nome){
   if(!identificador(nome)||!acoes.has(nome))return false;
   // Erros operacionais permanecem com a ação de origem, sem serem ocultados.
   acoes.get(nome)();
   return true;
 }
 const api=Object.freeze({registrarRetorno,registrarAcao,consumirRetorno,executarAcao});
 Object.defineProperty(window,"PMobileModulos",{value:api,writable:false,configurable:false});
})();
