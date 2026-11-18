const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const script=read("script.js"), html=read("index.html"), profile=read("perfil-fotos.js");
function section(from,to) {
  const start=script.indexOf(from);
  const end=script.indexOf(to,start+from.length);
  assert.ok(start>=0&&end>start,"Secao encontrada: "+from);
  return script.slice(start,end);
}
test("tela de boas-vindas e a primeira; possui avatar, nome, iniciar e troca de usuario",()=>{
  assert.match(html,/<div id="inicio">[\s\S]*id="inicioPerfilAvatar"[\s\S]*id="inicioUsuarioNome"[\s\S]*id="inicioBotaoIniciar"[\s\S]*id="inicioTrocarUsuario"/);
  assert.match(html,/id="inicioBotaoIniciar" onclick="abrirSistema\(\)"/);
  assert.match(html,/data-pm-profile-photo/);
  assert.match(read("cba-theme.css"),/#inicio #inicioPerfilAvatar/);
  assert.match(read("implementacoes/inicio.css"),/#inicio\s*\{[\s\S]*?display:\s*flex;/);
});
test("restauracao de sessao so identifica usuario; nunca abre a Home",()=>{
  const code=section("function restaurarSessaoPmobile(","\nasync function tentarRestaurarLoginPmobile()");
  const call=[];
  const env={window:{},navigator:{onLine:true},atualizarVisibilidadeConfiguracoes:()=>call.push("permissoes"),mostrarBoasVindasPmobile:()=>call.push("inicio"),mostrarTelaSistema:()=>call.push("home")};
  vm.runInNewContext(code+';\nrestaurarSessaoPmobile({id:7,usuario:"teste",nivel:"NIVEL2"},"credencial")',env);
  assert.deepEqual(call,["permissoes","inicio"]);
  assert.equal(env.window.usuarioPmobileAtual.usuario,"teste");
  assert.equal(env.window.credencialPmobileAtual,"credencial");
});
test("botao Iniciar e o unico caminho para a Home apos autenticar",()=>{
  const code=section("async function abrirSistema() {","\nfunction trocarUsuarioPmobile()");
  const calls=[];
  const env={pmobileInicioEmAndamento:false,abrirAplicacaoAutenticadaPmobile:()=>{calls.push("home");return true;},obterLoginPmobileSalvo:async()=>null,tentarRestaurarLoginPmobile:async()=>{},abrirLoginPmobile:()=>calls.push("login")};
  return vm.runInNewContext(code+";\nabrirSistema()",env).then(()=>{
    assert.deepEqual(calls,["home"]);
  });
});
test("sem sessao Iniciar leva para login e nunca mostra as abas",async()=>{
  const code=section("async function abrirSistema() {","\nfunction trocarUsuarioPmobile()");
  const calls=[];
  const env={pmobileInicioEmAndamento:false,abrirAplicacaoAutenticadaPmobile:()=>{calls.push("check");return false;},obterLoginPmobileSalvo:async()=>null,tentarRestaurarLoginPmobile:async()=>{},abrirLoginPmobile:()=>calls.push("login")};
  await vm.runInNewContext(code+";\nabrirSistema()",env);
  assert.deepEqual(calls,["check","login"]);
});
test("login normal e primeiro acesso nao pulam as boas-vindas",()=>{
  const login=section("async function entrarInterface(event) {","\nfunction avisoLoginTeste()");
  const restore=section("function restaurarSessaoPmobile(","\nasync function tentarRestaurarLoginPmobile()");
  assert.match(login,/mostrarBoasVindasPmobile\(\)/);
  assert.doesNotMatch(login,/mostrarTelaSistema\(\s*"homeSistema"/);
  assert.match(restore,/mostrarBoasVindasPmobile\(\)/);
  assert.doesNotMatch(restore,/mostrarTelaSistema\(/);
  assert.match(script,/window\.PMOBILE_OK = true;[\s\S]*tentarRestaurarLoginPmobile\(\)/);
  assert.match(script,/menuConfiguracoes: isAdmin/);
});
test("foto individual sincronizada por RPC credenciado, com cache local offline",()=>{
  assert.match(profile,/pmobile_foto_perfil_ler/);
  assert.match(profile,/pmobile_foto_perfil_salvar/);
  assert.match(profile,/p_credencial:credential/);
  assert.match(profile,/indexedDB\.open\(DB_NAME,1\)/);
  assert.match(profile,/pending:/);
  assert.match(profile,/new Blob\(\[bytes\],\{type:"image\/jpeg"\}\)/);
  assert.doesNotMatch(profile,/service_role|supabase\.storage/);
});
test("migration nao altera contas, credenciais ou hierarquias",()=>{
  const sql=read("supabase/pmobile_fotos_perfil.sql");
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.pmobile_fotos_perfil/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.pmobile_fotos_perfil FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/FROM public\.autenticar_usuario\(p_usuario,p_credencial\)/);
  assert.doesNotMatch(sql,/(ALTER\s+TABLE\s+public\.usuarios|UPDATE\s+public\.usuarios|TRUNCATE\s+public\.usuarios)/i);
});
test("copias www de OTA mantidas identicas",()=>{
  for(const file of ["index.html","script.js","perfil-fotos.js","cba-theme.css"]){
    assert.equal(read(file),read("www/"+file),"Copia WWW: "+file);
  }
});
