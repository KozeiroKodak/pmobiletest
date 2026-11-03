const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const ler=(f)=>fs.readFileSync(path.join(root,f),"utf8");
const entry=ler("index.html");
const original=ler("script.js");
const MODULOS=["dados-locais/pesquisa-local.js","dados-locais/estoque-local.js","dados-locais/reservas-local.js","dados-locais/conferencias-local.js","dados-locais/comparar-verificar.js","dados-locais/divergencias-local.js","dados-locais/locais-local.js","dados-locais/importacao-local.js"];
const local=[...MODULOS,"dados-locais.js"].map(ler).join("\n");
const mover=ler("reorganizacao-pmobile.js");
const sql=ler("sql/pmobile_dados_locais_isolados.sql");

test("clique em Editar abre o material da origem sem consultar ou gravar no banco",()=>{
 const vm=require("node:vm");
 for(const origem of ["pesquisa","estoque"]){
  const els=new Map();
  for(const id of ["dlEditorTitulo","dlQtdItem","dlQtdTotal","dlQtdReservada","dlLocal","dlFormEstoque"])
   els.set(id,{hidden:true,scrollIntoView(){}});
  const sandbox={window:{mostrarTelaSistema(){}},document:{readyState:"loading",addEventListener(){},
   getElementById:id=>els.get(id)||null,querySelectorAll:()=>[]},console};
  const code=local.replace("  window.abrirDadosLocaisPmobile=abrir;",
   "  window.__clickTeste={onClick,estado};\n  window.abrirDadosLocaisPmobile=abrir;");
  vm.runInNewContext(code,sandbox);
  const {onClick,estado}=sandbox.window.__clickTeste;
  const material={codigo:"001",descricao:"Teste",quantidade_item:0,quantidade_total:12,
   quantidade_reservada:null,local:"A-01"};
  estado.resultados[origem]=[material];
  const botao={dataset:{dlEdit:"001",dlSource:origem}};
  onClick({target:{closest:selector=>selector==="[data-dl-edit]"?botao:null}});
  assert.equal(estado.material,material);
  assert.equal(estado.tela,"estoque");
  assert.equal(els.get("dlFormEstoque").hidden,false);
  assert.equal(els.get("dlQtdItem").value,0);
  assert.equal(els.get("dlQtdTotal").value,12);
  assert.equal(els.get("dlQtdReservada").value,"");
  assert.equal(els.get("dlLocal").value,"A-01");
 }
});

test("módulos novos e scripts alterados têm sintaxe válida",()=>{
 for(const source of [original,local,mover]) assert.doesNotThrow(()=>new Function(source));
});
test("menu Dados locais e hub Transportes integrados somente por novos módulos",()=>{
 assert.match(entry,/dados-locais\.js\?v=/);
 assert.match(entry,/reorganizacao-pmobile\.js\?v=/);
 assert.match(entry,/implementacoes\/dados-locais\.css\?v=/);
 assert.match(original,/PMobileModulos\?\.consumirRetorno/);
 assert.doesNotMatch(original,/window\.voltarUmNivel(?:DadosLocais|TransportesPmobile)/);
 assert.match(mover,/configuracoesHub/);
 assert.match(mover,/PMobileModulos\?\.executarAcao/);
 for(const action of ["valores-total","importar-estoque",
                       "conferencias","rastreio","cotacoes"])
   assert.ok(mover.includes(action),action);
 for(const [file,action] of [["valorestotal.js","valores-total"],["rastreio.js","rastreio"],
                            ["cotacoes.js","cotacoes"],["script.js","conferencias"]])
   assert.ok(ler(file).includes('registrarAcao("'+action+'"'),file);
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
 for(const file of ["index.html","script.js","dados-locais.js","reorganizacao-pmobile.js","implementacoes/dados-locais.css",...MODULOS])
   assert.equal(ler(file),ler("www/"+file),file);
});

test("módulos independentes carregam antes do hub",()=>{
 const scripts=[...entry.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
 const hub=scripts.findIndex(s=>s.startsWith("dados-locais.js?"));
 assert.ok(hub>0);
 for(const f of MODULOS)assert.ok(scripts.some((s,i)=>s.startsWith(f+"?")&&i<hub),f);
});

test("migração bidirecional preserva API, autorização e não altera as tabelas",()=>{
 const novo=ler("sql/pmobile_local_comparar_bidirecional_bkp.sql");
 assert.match(novo,/create or replace function public\.pmobile_local_comparar/i);
 assert.match(novo,/private\.pmobile_local_autorizar\(p_usuario,p_credencial\)/i);
 assert.match(novo,/full outer join public\.materiais d on d\.codigo=l\.codigo/i);
 assert.match(novo,/coalesce\(l\.codigo,d\.codigo\)/i);
 assert.match(novo,/l\.codigo is null or d\.id is null/i);
 assert.match(novo,/set search_path to ''/i);
 assert.doesNotMatch(novo,/\b(?:update|insert into|delete from|truncate|drop table)\b/i);
});

test("versão web e Android invalidam cache dos módulos corrigidos",()=>{
 const html=ler("index.html"),mobile=ler("www/index.html");
 assert.equal(html,mobile);
 assert.ok(html.includes('src="dados-locais.js?v=9.1-nivel2"'));
 assert.ok(html.includes('src="dados-locais/divergencias-local.js?v=8.0"'));
});
