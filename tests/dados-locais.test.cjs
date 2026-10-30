const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const ler=(f)=>fs.readFileSync(path.join(root,f),"utf8");
const entry=ler("index.html");
const original=ler("script.js");
const local=ler("dados-locais.js");
const mover=ler("reorganizacao-pmobile.js");
const sql=ler("sql/pmobile_dados_locais_isolados.sql");

test("módulos novos e scripts alterados têm sintaxe válida",()=>{
 for(const source of [original,local,mover]) assert.doesNotThrow(()=>new Function(source));
});
test("menu Dados locais e hub Transportes integrados somente por novos módulos",()=>{
 assert.match(entry,/dados-locais\.js\?v=/);
 assert.match(entry,/reorganizacao-pmobile\.js\?v=/);
 assert.match(entry,/implementacoes\/dados-locais\.css\?v=/);
 assert.match(original,/voltarUmNivelDadosLocais/);
 assert.match(original,/voltarUmNivelTransportesPmobile/);
 assert.match(mover,/configuracoesV3Hub/);
 for(const fn of ["abrirValoresTotal","abrirValoresTotal2","abrirImportacao",
                  "abrirConferencias","abrirRastreio","abrirOpcoesCotacoes"])
   assert.ok(mover.includes(fn),fn);
});
test("módulos locais inteiramente separados",()=>{
 for(const fn of ["listar","salvar_estoque","registrar_conferencia",
                   "listar_conferencias","comparar","importar_catalogo"])
   assert.ok(local.includes('rpc("'+fn+'"'),fn);
 for(const aba of ["pesquisa","estoque","reservas","conferencias",
                   "comparar","divergencias","locais","importar"])
   assert.ok(local.includes(aba),aba);
 assert.doesNotMatch(local,/\.from\(["']materiais["']\)/);
});
test("banco original preservado pela migration isolada",()=>{
 assert.match(sql,/create table if not exists public\.pmobile_local_materiais/);
 assert.match(sql,/create table if not exists public\.pmobile_local_conferencias/);
 assert.match(sql,/on conflict \(codigo\) do update/);
 assert.match(sql,/alter table public\.pmobile_local_materiais enable row level security/);
 assert.doesNotMatch(sql,/(?:delete from|truncate|drop table|update)\s+public\.materiais\b/i);
 assert.match(sql,/p_somente_reservas boolean default false/);
 assert.match(sql,/p_modo text default 'todos'/);
});
test("APK fallback espelha os arquivos da versão web",()=>{
 for(const file of ["index.html","script.js","dados-locais.js","reorganizacao-pmobile.js","implementacoes/dados-locais.css"])
   assert.equal(ler(file),ler("www/"+file),file);
});
