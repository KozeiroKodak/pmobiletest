const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const A=require("../clientes-analise.js");
function linha(cliente,regiao,nf,transportadora="TRANSPORTADORA"){
  return {cliente,regiao,notas_fiscais:String(nf),transportadora};
}
test("STUMPF: ordem das palavras, pontuação e abreviação",()=>{
  assert.ok(A.pontuar("STUMPF TRANSP.","TRANSP.STUMPF")>=75);
  assert.ok(A.pontuar("TRANSP STUMPF","TRANSP.STUMPF")>=75);
  const g=A.agrupar([linha("STUMPF TRANSP.","MONTENEGRO",11),linha("TRANSP.STUMPF","MONTENEGRO",22),linha("TRANSP STUMPF","MONTENEGRO",33)]);
  assert.equal(g.length,1);assert.equal(g[0].variantes.length,3);
});
test("JOÃO H C NUNES: acentos, pontuação e espaços",()=>{
  assert.ok(A.pontuar("JOAO H C NUNES","JOAO H. C. NUNES")>=75);
  const g=A.agrupar([linha("JOAO H C NUNES","PORTO ALEGRE",88),linha("JOAO H. C. NUNES","PORTO ALEGRE",99)]);
  assert.equal(g.length,1);
});
test("M A MECÂNICA POSTO DE MOLAS: mudanças na ordem de palavras",()=>{
  const g=A.agrupar([
    linha("M A MECANICA E POSTO DE MOLAS","BENTO GONÇALVES",1),
    linha("M A MECANICA POSTO E MOLAS","BENTO GONCALVES",2),
    linha("M A Mecanica Posto De Molas","BENTO GONÇALVES",3)
  ]);
  assert.equal(g.length,1);assert.equal(g[0].variantes.length,3);
});
test("RIO GRANDENSE: nome base vs. E CIA precisa revisão",()=>{
  const g=A.agrupar([
    linha("MOLAS RIO GRANDENSE","PORTO ALEGRE",18057),
    linha("MOLAS RIO GRANDENSE E CIA","PORTO ALEGRE",19222)
  ]);
  assert.equal(g.length,1);assert.equal(g[0].variantes.length,2);
  assert.notEqual(A.assinatura("MOLAS RIO GRANDENSE"),A.assinatura("MOLAS RIO GRANDENSE E CIA"));
});
test("sem correspondências automáticas entre cidades ou nomes sem relação",()=>{
  const g=A.agrupar([
    linha("MOLAS RIO GRANDENSE","PORTO ALEGRE",1),
    linha("MOLAS RIO GRANDENSE E CIA","MONTENEGRO",2),
    linha("OFICINA DO JOAO","PORTO ALEGRE",3),
    linha("AUTO PECAS ABC","PORTO ALEGRE",4)
  ]);
  assert.equal(g.length,0);
});
test("agrupar nomes repetidos preserva NFs distintas e transportadoras",()=>{
  const g=A.agrupar([
    linha("JOAO H C NUNES","PORTO ALEGRE",20338),
    linha("JOAO H C NUNES","PORTO ALEGRE",20338),
    linha("JOAO H. C. NUNES","PORTO ALEGRE",19490),
    linha("JOAO H. C. NUNES","PORTO ALEGRE",19490,"OUTRA TRANSPORTADORA")
  ]);
  assert.equal(g.length,1);assert.equal(g[0].totalNfs,3);
});
test("chaves de decisão são independentes da ordem dos nomes e de acentos",()=>{
  assert.equal(A.chave("PORTO ALEGRE","JOAO H C NUNES","JOAO H. C. NUNES"),A.chave("Porto Alegre","JOAO H. C. NUNES","JOAO H C NUNES"));
});
test("cliente só é acessível ao ADMIN; não altera rastreios",()=>{
  const js=get("clientes.js"),source=get("reorganizacao-pmobile.js"),sql=get("sql/pmobile_clientes_auditoria.sql");
  assert.match(js,/u\.nivel!=="ADMIN"/);
  assert.match(js,/pmobile_rastreio_listar_v5/);
  assert.match(js,/pmobile_clientes_salvar_decisao/);
  assert.doesNotMatch(js,/pmobile_rastreio_sincronizar|update\(|delete\(|insert\(/);
  assert.match(source,/atualizarPermissaoClientes/);
  assert.match(source,/data-pm-transporte=\\"clientes\\"/);
  assert.match(sql,/revoke all on table public\.pmobile_clientes_decisoes from public,anon,authenticated/);
  assert.match(sql,/u\.nivel='ADMIN'/);
  assert.doesNotMatch(sql,/update public\.rastreios|delete from public\.rastreios/);
});
test("OTA possui assets nas duas árvores, index e CSS na ordem correta",()=>{
  const a=get("index.html"),b=get("www/index.html");
  assert.equal(a,b);
  for(const file of ["clientes-analise.js","clientes.js","clientes.css","reorganizacao-pmobile.js"])
    assert.equal(get(file),get("www/"+file),file);
  assert.match(a,/id="clientes"/);
  assert.match(a,/src="clientes-analise\.js\?v=/);
  assert.match(a,/src="clientes\.js\?v=/);
  assert.match(a,/href="clientes\.css\?v=/);
  const i=a.indexOf('src="clientes-analise.js'),j=a.indexOf('src="clientes.js');
  assert.ok(i>=0&&j>i);
});
