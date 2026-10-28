const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const normal=x=>String(x??"").trim().toUpperCase();
const key=x=>[normal(x.nf),normal(x.cliente),normal(x.trans).replace(/\s+/g," ")].join("\u001f");

function reconciliar(antigos,novos){
 const oldGroups=new Map(),newGroups=new Map();
 for(const item of antigos){const k=key(item);oldGroups.set(k,[...(oldGroups.get(k)||[]),item]);}
 for(const item of novos){const k=key(item);newGroups.set(k,[...(newGroups.get(k)||[]),item]);}
 const mapeados=[],inseridos=[],removidos=[];
 for(const [k,origem] of oldGroups){
  const destino=newGroups.get(k)||[];
  const o=[...origem].sort((a,b)=>a.linha-b.linha);
  const n=[...destino].sort((a,b)=>a.linha-b.linha);
  if(origem.some(x=>x.protegido) && (o.length!==1||n.length!==1))
   throw Error("NF movimentada sem correspondência única");
  if(o.length!==n.length){if(o.some(x=>x.protegido))throw Error("NF movimentada removida");
    removidos.push(...o);inseridos.push(...n);continue;}
  o.forEach((x,i)=>mapeados.push({id:x.id,linha:n[i].linha,protegido:!!x.protegido}));
 }
 for(const [k,n] of newGroups)if(!oldGroups.has(k))inseridos.push(...n);
 return {mapeados,inseridos,removidos};
}
const linha=(id,nf,numero,protegido=false)=>({id,nf,cliente:"CLIENTE",trans:"RM EXPRESS",linha:numero,protegido});
test("nova NF desloca linhas sem alterar os IDs ou estados",()=>{
 const antes=[linha("a","20054E",15,true),linha("b","20042",17,true),linha("c","20050",18)];
 const depois=[linha("nova","20055P",15),...antes.map(x=>({...x,linha:x.linha+1}))];
 const r=reconciliar(antes,depois);
 assert.deepEqual(r.mapeados.map(x=>[x.id,x.linha]),[["a",16],["b",18],["c",19]]);
 assert.equal(r.inseridos.length,1);assert.equal(r.removidos.length,0);
});
test("nota enviada repetida sem identidade única nunca é reatribuída automaticamente",()=>{
 assert.throws(()=>reconciliar([linha("a","20042",15,true)],[linha("x","20042",16),linha("y","20042",17)]),/única/);
});
test("duplicatas não movimentadas mantêm ocorrência quando a quantidade não muda",()=>{
 const r=reconciliar([linha("a","888",10),linha("b","888",15)],
                     [linha("n","888",11),linha("m","888",16)]);
 assert.deepEqual(r.mapeados.map(x=>[x.id,x.linha]),[["a",11],["b",16]]);
});
test("exclusão de NF protegida bloqueia",()=>{
 assert.throws(()=>reconciliar([linha("a","20054E",15,true)],[]),/correspondência única/);
});
test("SQL do Supabase não utiliza a posição para definir identidade",()=>{
 const sql=fs.readFileSync(path.join(__dirname,"..","sql","rastreio_linhas_moveis.sql"),"utf8");
 assert.match(sql,/tmp_pm_sync_map/);
 assert.match(sql,/row_number\(\) over\(partition by nfkey,clientkey,transkey order by/);
 assert.match(sql,/set linha_origem=null/);
 assert.match(sql,/when m.protegido then r.notas_fiscais/);
 assert.match(sql,/v_removed>greatest\(25,ceil\(v_old\*0\.03\)/);
});
