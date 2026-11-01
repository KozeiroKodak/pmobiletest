const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('entradas unificadas existem, sem assets ausentes ou identificadores duplicados',()=>{
 const html=read('index.html'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);
 for(const [,url]of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^https?:|^\/\//.test(url))assert.ok(fs.existsSync(path.join(root,url.split('?')[0])),url);
 const scripts=[...html.matchAll(/<script src="([^"?]+)/g)].map(x=>x[1]).filter(x=>!x.startsWith('http'));
 assert.equal(scripts.length,new Set(scripts).size);new vm.Script(scripts.map(read).join('\n;\n'));
 for(const p of ['locais-v3.js','configuracoes-v3.js','valorestotal2.js','implementacoes/locais-v3.css','implementacoes/configuracoes-v3.css','implementacoes/valorestotal2.css'])for(const prefix of ['', 'www/'])assert.equal(fs.existsSync(path.join(root,prefix+p)),false,prefix+p);
});
test('fontes de apresentação e espelho não mantêm namespaces de versões',()=>{
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
 for(const full of walk(root)){
  const p=path.relative(root,full).replaceAll('\\','/');if(!/\.(js|html|css)$/.test(p)||/^(android|tests)\//.test(p)||p.endsWith('xlsx.full.min.js'))continue;
  assert.doesNotMatch(read(p),/configuracoes-v3|config-v3|ConfiguracoesV3|configuracoesV3|locais-v3|LocaisV3|locaisV3|valoresTotal2|ValoresTotal2|ValoresMensais2|frete2-|pesquisa-v2|pesquisaV2|contagem-v2/,p);
  if(!p.startsWith('www/'))assert.equal(read(p),read('www/'+p),p);
 }
});
test('Locais exporta cartões atuais no principal e financeiro preserva acesso administrativo',()=>{
 const sandbox={window:{usuarioPmobileAtual:{nivel:'ADMIN'}},document:{addEventListener(){}},escapeHtmlPmobile:s=>String(s),console};
 vm.runInNewContext(read('locais.js'),sandbox);
 assert.match(sandbox.window.renderizarLocalAlterado({id:'00000000-0000-0000-0000-000000000001',local_original:'A01',local_encontrado:'B01'}),/Local anterior[\s\S]*A01[\s\S]*Novo local[\s\S]*B01/);
 assert.match(sandbox.window.renderizarLocalDerivado({codigo:'1'}),/locais-cartao/);
 let nav=0,alertas=0;const finance={window:{usuarioPmobileAtual:{nivel:'NIVEL2'}},alert(){alertas++},mostrarTelaSistema(){nav++},document:{getElementById(){return null}}};
 vm.runInNewContext(read('valorestotal.js'),finance);finance.abrirValoresTotal();assert.equal(nav,0);assert.equal(alertas,1);
 finance.window.usuarioPmobileAtual.nivel='ADMIN';finance.abrirValoresTotal();assert.equal(nav,1);
 assert.equal(typeof finance.salvarValoresTotalPlanilha,'function');assert.equal(typeof finance.renderAnaliseTransportadoras,'function');
});
