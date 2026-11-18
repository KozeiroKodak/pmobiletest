const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const source=get("inicio-modelo9.js");

function harness(opts={}) {
  const classes=new Set();
  const rootEl={classList:{
    add(...items){items.forEach(item=>classes.add(item));},
    remove(...items){items.forEach(item=>classes.delete(item));},
    toggle(item,on){if(on)classes.add(item);else classes.delete(item);},
    contains(item){return classes.has(item);}
  }};
  const photo={hidden:opts.photo===false,complete:true,naturalWidth:384,hasAttribute:k=>k==="src"};
  const nodes={
    inicio:rootEl,
    loginManterLogin:{checked:opts.checked!==false},
    inicioMarcaModelo9:{hidden:true},
    inicioBoasVindas:{hidden:true},
    inicioSessaoMantida:{hidden:true},
    inicioFotoTelaCheia:photo
  };
  const user=opts.user===null?null:{id:12,usuario:opts.user||"teste",nome:"Usuário Teste"};
  const window={usuarioPmobileAtual:user,credencialPmobileAtual:opts.credential===null?null:"segredo"};
  const saved=opts.saved===null?null:opts.saved||{usuario:"teste",senha:"segredo",dadosUsuario:{id:12,usuario:"teste"}};
  const ctx={window,document:{readyState:"loading",getElementById:id=>nodes[id]||null,addEventListener(){}},
    obterLoginPmobileSalvo:opts.loader || (async()=>saved),console};
  vm.runInNewContext(source,ctx);
  return {window,nodes,rootEl,classes,check:window.PMobileInicioModelo9.verificar};
}

test("modelo 9 só usa a foto com sessão e login mantido na mesma conta",async()=>{
  const h=harness();
  await h.check();
  assert.equal(h.rootEl.classList.contains("inicio-modelo9"),true);
  assert.equal(h.rootEl.classList.contains("inicio-com-foto"),true);
  assert.equal(h.nodes.inicioMarcaModelo9.hidden,false);
  assert.equal(h.nodes.inicioSessaoMantida.hidden,false);
});

test("Manter login desativado nunca permite fundo do usuário",async()=>{
  const h=harness({checked:false});
  await h.check();
  assert.equal(h.rootEl.classList.contains("inicio-modelo9"),false);
  assert.equal(h.rootEl.classList.contains("inicio-com-foto"),false);
  assert.equal(h.nodes.inicioSessaoMantida.hidden,true);
});

test("sem sessão, mesmo com checkbox marcado e foto cacheada, fundo permanece oculto",async()=>{
  const h=harness({user:null});
  await h.check();
  assert.equal(h.rootEl.classList.contains("inicio-com-foto"),false);
  assert.equal(h.nodes.inicioMarcaModelo9.hidden,true);
});

test("outra conta salva e senha divergente não liberam foto do perfil",async()=>{
  const other=harness({saved:{usuario:"outro",senha:"segredo",dadosUsuario:{id:19}}});
  await other.check();
  assert.equal(other.rootEl.classList.contains("inicio-com-foto"),false);
  const wrong=harness({saved:{usuario:"teste",senha:"antiga",dadosUsuario:{id:12}}});
  await wrong.check();
  assert.equal(wrong.rootEl.classList.contains("inicio-com-foto"),false);
});

test("fundo só aparece se a foto real estiver disponível",async()=>{
  const h=harness({photo:false});
  await h.check();
  assert.equal(h.rootEl.classList.contains("inicio-modelo9"),true);
  assert.equal(h.rootEl.classList.contains("inicio-com-foto"),false);
});

test("troca de usuário oculta imediatamente a foto anterior",async()=>{
  const h=harness();
  await h.check();
  assert.equal(h.rootEl.classList.contains("inicio-com-foto"),true);
  h.window.usuarioPmobileAtual={id:13,usuario:"outro",nome:"Outra conta"};
  h.window.credencialPmobileAtual=null;
  await h.check();
  assert.equal(h.rootEl.classList.contains("inicio-com-foto"),false);
  assert.equal(h.nodes.inicioMarcaModelo9.hidden,true);
});

test("o novo tema não adiciona navegação automática nem altera permissões",()=>{
  assert.doesNotMatch(source,/mostrarTelaSistema|abrirAplicacaoAutenticadaPmobile|salvarLoginPmobile|supabase\.storage/);
  const html=get("index.html");
  assert.match(html,/id="inicioBotaoIniciar" onclick="abrirSistema\(\)"/);
  assert.match(html,/id="loginManterLogin"/);
  assert.match(html,/id="inicioFotoTelaCheia" data-pm-background-photo/);
  assert.match(html,/id="inicioMarcaModelo9"/);
  assert.match(html,/href="inicio-modelo9.css\?v=1.1-mobile"/);
  assert.match(html,/src="inicio-modelo9.js\?v=1.0"/);
});

test("foto/logo originais inalterados e arquivos OTA www em paridade",()=>{
  for (const file of ["index.html","inicio-modelo9.js","inicio-modelo9.css","cba-identidade.webp"]){
    assert.ok(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(path.join(root,"www",file))),file);
  }
  assert.ok(fs.readFileSync(path.join(root,"cba-identidade.webp")).equals(
    fs.readFileSync(path.join(root,"android/app/src/main/res/drawable-nodpi/pmobile_identity.webp"))
  ),"a identidade CBA deve permanecer byte a byte");
});
