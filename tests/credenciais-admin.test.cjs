const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const codigo=read("script.js");
const html=read("index.html");
const sql=read("sql/pmobile_credenciais_provisorias_admin.sql");

test("frontend Android espelha cadastro e recuperação do PMobile",()=>{
  assert.equal(read("www/script.js"),codigo);
  assert.equal(read("www/index.html"),html);
  assert.equal(read("www/style.css"),read("style.css"));
  assert.doesNotThrow(()=>new vm.Script(codigo));
});

test("navegação abre painel de credenciais reais, não mostra aviso fictício",()=>{
  for(const id of ["painelRecuperacaoCredenciais","listaCredenciaisAdmin",
  "credenciaisGeradasAdmin","credenciaisTokenAdmin","credenciaisSenhaAdmin"])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(codigo,/tokens:\s*\{ titulo: "Recuperação de tokens e senhas"/);
  assert.match(codigo,/if \(nome === "tokens"\).*abrirSolicitacoesResetToken/s);
  assert.doesNotMatch(codigo,/Solicitações de recuperação de token serão exibidas nesta área na próxima etapa/);
  assert.match(html,/onclick="abrirSubareaConfiguracoes\('tokens'\)"/);
  assert.match(read("style.css"),/credenciais-admin-revelados\[hidden\]/);
});

test("criação da senha definitiva exige token ou senha provisória",()=>{
  assert.match(codigo,/p_credencial: tokenPmobileCadastroSenha/);
  assert.match(codigo,/if \(usuarioAutenticado\.precisa_criar_senha\)/);
  assert.match(codigo,/Informe senha, senha provisória ou token de ativação/);
  assert.match(sql,/senha_provisoria\s*=\s*true/);
  assert.match(sql,/senha_provisoria\s*=\s*false/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.criar_senha_usuario\(text,text\)/);
  assert.match(sql,/extensions\.crypt\(p_senha,extensions\.gen_salt\('bf'\)\)/);
  assert.match(sql,/extensions\.digest\(v_token,'sha256'\)/);
  assert.match(sql,/a\.nivel='ADMIN'/);
  assert.match(sql,/u\.nivel <> 'ADMIN'/);
});

test("lista e emissão mostram os segredos apenas para ADMIN e os limpam ao sair",async()=>{
  const start=codigo.indexOf("function limparCredenciaisAdminVisiveis() {");
  const end=codigo.indexOf("// ============================================================\n// VOLTAR DAS CONFIGURAÇÕES",start);
  assert.ok(start>0&&end>start);
  const script=codigo.slice(start,end);
  const el=()=>({children:[],value:"",hidden:true,disabled:false,style:{},textContent:"",
    append(...a){this.children.push(...a)},replaceChildren(...a){this.children=[...a]},
    addEventListener(type,fn){this["on"+type]=fn},querySelectorAll(){return []},
    focus(){},select(){}});
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)};
  const calls=[];
  const ctx={credencialPmobileAtual:"admin-test-password",
    window:{usuarioPmobileAtual:{id:6,usuario:"pmadmin",nivel:"ADMIN"},
      clienteSupabase:{rpc:async(name,args)=>{
        calls.push({name,args});
        if(name==="pmobile_admin_listar_credenciais")return {data:[
          {id:6,nome:"ADMIN",usuario:"pmadmin",nivel:"ADMIN",ativo:true,senha_definida:true},
          {id:27,nome:"OPERADOR",usuario:"operador",nivel:"NIVEL2",ativo:true,senha_definida:false}
        ]};
        if(name==="pmobile_admin_gerar_credenciais")return {data:[{
          nome:"OPERADOR",usuario:"operador",token:"token-exemplo-unico",
          primeira_senha:"primeira-senha-exemplo"
        }]};
        throw Error("RPC inesperado");
      }}},
    document:{getElementById:get,createElement:el,querySelectorAll(sel){
      if(sel==="#listaCredenciaisAdmin button")
        return get("listaCredenciaisAdmin").children.flatMap(c=>c.children.filter(n=>n.textContent==="Gerar token e primeira senha"));
      return [];
    }},
    navigator:{clipboard:{writeText:async()=>{}}},
    confirm:()=>true,alert:()=>{}};
  vm.createContext(ctx);
  vm.runInContext(script,ctx);
  await ctx.carregarListaCredenciaisAdmin();
  assert.equal(get("listaCredenciaisAdmin").children.length,2);
  assert.equal(get("listaCredenciaisAdmin").children[0].children.length,1,"admin sem botão reset");
  assert.equal(get("listaCredenciaisAdmin").children[1].children.length,2,"operador com botão");
  assert.equal(calls[0].args.p_admin_usuario,"pmadmin");
  await ctx.gerarCredenciaisProvisoriasAdmin(27,"operador");
  assert.equal(get("credenciaisTokenAdmin").value,"token-exemplo-unico");
  assert.equal(get("credenciaisSenhaAdmin").value,"primeira-senha-exemplo");
  assert.equal(get("credenciaisGeradasAdmin").hidden,false);
  ctx.limparCredenciaisAdminVisiveis();
  assert.equal(get("credenciaisTokenAdmin").value,"");
  assert.equal(get("credenciaisSenhaAdmin").value,"");
  ctx.window.usuarioPmobileAtual.nivel="NIVEL2";
  const before=calls.length;
  await ctx.carregarListaCredenciaisAdmin();
  await ctx.gerarCredenciaisProvisoriasAdmin(27,"operador");
  assert.equal(calls.length,before,"NIVEL2 não deve chamar RPCs");
});
