const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const codigo=fs.readFileSync(path.join(root,"rastreio.js"),"utf8");
const pagina=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"implementacoes/rastreio.css"),"utf8");
const sandbox={window:{addEventListener(){}},console,Date};
vm.createContext(sandbox);
vm.runInContext(codigo+"\n;globalThis.testarStatus=statusVisualRastreio;globalThis.testarRM=ehRMExpressRastreio;",sandbox);
const status=sandbox.testarStatus;
const passado="2025-01-01T12:00:00.000Z";
const futuro="2100-01-01T12:00:00.000Z";

test("terceirizadas pendentes ou em transporte exibem COLETADO, independentemente do prazo",()=>{
 for(const nome of ["LEOMAR","REDE","RODOVIA SUL","EXPRESSO CAXIENSE","SÃO MIGUEL"]){
   assert.equal(status({transportadora:nome,status:"PENDENTE",previsao_entrega:passado}),"COLETADO",nome);
   assert.equal(status({transportadora:nome,status:"EM_TRANSPORTE",previsao_entrega:futuro}),"COLETADO",nome);
 }
});
test("RM Express continua com regras próprias de atraso e entrega",()=>{
 for(const nome of ["RM EXPRESS","rm express","RM-Express","RMEXPRESS","R.M. EXPRESS"]){
  assert.equal(sandbox.testarRM({transportadora:nome}),true,nome);
  assert.equal(status({transportadora:nome,status:"PENDENTE",previsao_entrega:passado}),"ATRASADO",nome);
  assert.equal(status({transportadora:nome,status:"PENDENTE",previsao_entrega:futuro}),"PENDENTE",nome);
  assert.equal(status({transportadora:nome,status:"ENTREGUE",previsao_entrega:passado}),"ENTREGUE",nome);
 }
});
test("cancelados e entregues oficiais não são reclassificados; transportadora vazia não é coletada",()=>{
 assert.equal(status({transportadora:"LEOMAR",status:"CANCELADO",previsao_entrega:passado}),"CANCELADO");
 assert.equal(status({transportadora:"LEOMAR",status:"ENTREGUE",previsao_entrega:passado}),"ENTREGUE");
 assert.equal(status({transportadora:"",status:"PENDENTE",previsao_entrega:futuro}),"PENDENTE");
});
test("filtro COLETADO existe e cor é verde nos cartões",()=>{
 assert.match(pagina,/<option value="COLETADO">Coletado<\/option>/);
 assert.match(css,/\.rastreio-card\[data-status="COLETADO"\]\s*\{\s*border-left:\s*3px solid var\(--verde\)/);
 assert.match(css,/\.rastreio-card\[data-status="COLETADO"\] \.rastreio-etiqueta\s*\{ color: var\(--verde\)/);
});
test("original e fallback Android usam as mesmas fontes",()=>{
 assert.equal(fs.readFileSync(path.join(root,"www/rastreio.js"),"utf8"),codigo);
 assert.equal(fs.readFileSync(path.join(root,"www/implementacoes/rastreio.css"),"utf8"),css);
 assert.equal(fs.readFileSync(path.join(root,"www/index.html"),"utf8"),pagina);
});
