const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const modules=["pesquisa-local.js","estoque-local.js","reservas-local.js","conferencias-local.js","comparar-verificar.js","divergencias-local.js","locais-local.js","importacao-local.js"];
const files=modules.map(n=>"dados-locais/"+n).concat("dados-locais.js");
function ambiente(){
 const codigo=files.map(p=>fs.readFileSync(path.join(root,p),"utf8")).join("\n").replace(
  "  window.abrirDadosLocaisPmobile=abrir;",
  "  window.__bkp={consultar,estado};\n  window.abrirDadosLocaisPmobile=abrir;");
 const pending=[], elementos=new Map(), filtros=new Map();
 const mk=id=>({id,innerHTML:"",textContent:"",hidden:false,dataset:{},
   replaceChildren(){this.innerHTML="";this.textContent="";},
   append(){},appendChild(){}});
 const get=id=>{if(!elementos.has(id))elementos.set(id,mk(id));return elementos.get(id);};
 const document={readyState:"loading",addEventListener(){},
   getElementById(id){return elementos.get(id)||null;},
   querySelector(selector){let match=selector.match(/data-dl-(?:busca|comparar)=[\\"]([^"]+)/);
      if(!match)return null;
      const f=filtros.get(match[1]);return f||null;},
   createElement:()=>mk("created")
 };
 const sandbox={window:{usuarioPmobileAtual:{usuario:"teste"},credencialPmobileAtual:"credencial",
   clienteSupabase:{rpc(name,args){return new Promise(resolve=>pending.push({name,args,resolve}));}}},
   document,navigator:{onLine:true},console,setTimeout,clearTimeout};
 vm.runInNewContext(codigo,sandbox);
 for(const aba of ["pesquisa","comparar","divergencias","locais"]){
   get("dlResultados-"+aba); get("dlPagina-"+aba); get("dlResumo-"+aba);
   filtros.set(aba,{elements:{termo:{value:""},tipo:{value:"codigo"}}});
 }
 get("dlMensagem");
 const api=sandbox.window.__bkp;
 assert.ok(api,"API testável");
 return {api,pending,get,filtros};
}
function material(codigo,descricao){
 return {codigo,descricao,dogo_quantidade:10,local_quantidade:6,
  dogo_reservada:0,local_reservada:0,dogo_local:"A",local_local:"B",
  diferenca_quantidade:true,diferenca_reserva:false,diferenca_local:true,
  sem_dogo:false,pendente_quantidade:false,pendente_reserva:false,
  pendente_local:false};
}
async function turn(){await Promise.resolve();await Promise.resolve();}

test("consulta por aba serializada entrega apenas o filtro mais recente",async()=>{
 const {api,pending,get,filtros}=ambiente();
 api.estado.tela="comparar";
 filtros.get("comparar").elements.termo.value="antigo";
 const processo=api.consultar("comparar");
 assert.equal(pending.length,1);
 assert.equal(pending[0].args.p_termo,"antigo");
 assert.equal(api.estado.busy,true);
 filtros.get("comparar").elements.termo.value="novo";
 await api.consultar("comparar");
 assert.equal(pending.length,1,"não iniciar segunda chamada simultânea");
 pending[0].resolve({data:[material("A","Antigo")],error:null});
 await turn();
 assert.equal(pending.length,2);
 assert.equal(pending[1].args.p_termo,"novo");
 assert.equal(api.estado.resultados.comparar,undefined,"resultado antigo ignorado");
 pending[1].resolve({data:[material("B","Novo")],error:null});
 await processo;
 assert.equal(api.estado.resultados.comparar[0].codigo,"B");
 assert.match(get("dlResultados-comparar").innerHTML,/Novo/);
 assert.doesNotMatch(get("dlResultados-comparar").innerHTML,/Antigo/);
 assert.equal(api.estado.busy,false);
});
test("erro obsoleto não apaga resultados novos",async()=>{
 const {api,pending,get,filtros}=ambiente();
 api.estado.tela="comparar";
 const processo=api.consultar("comparar");
 filtros.get("comparar").elements.termo.value="atualizado";
 await api.consultar("comparar");
 pending[0].resolve({error:{message:"Falha antiga"},data:null});
 await turn();
 assert.equal(pending.length,2);
 pending[1].resolve({error:null,data:[material("C","Atualizado")]});
 await processo;
 assert.match(get("dlResultados-comparar").innerHTML,/Atualizado/);
 assert.doesNotMatch(get("dlMensagem").textContent,/Falha antiga/);
 assert.equal(api.estado.busy,false);
});
test("consulta de tela abandonada não altera o conteúdo",async()=>{
 const {api,pending,get}=ambiente();
 api.estado.tela="locais";
 const p=api.consultar("locais");
 api.estado.tela="inicio";
 pending[0].resolve({error:null,data:[material("X","Invisível")]});
 await p;
 assert.equal(api.estado.resultados.locais,undefined);
 assert.doesNotMatch(get("dlResultados-locais").innerHTML,/Invisível/);
 assert.equal(api.estado.busy,false);
});
test("erro vigente remove busy e mantém mensagem legível",async()=>{
 const {api,pending,get}=ambiente();
 api.estado.tela="comparar";
 const p=api.consultar("comparar");
 pending[0].resolve({data:null,error:{message:"Supabase indisponível"}});
 await p;
 assert.equal(api.estado.busy,false);
 assert.equal(get("dlMensagem").textContent,"Supabase indisponível");
});
