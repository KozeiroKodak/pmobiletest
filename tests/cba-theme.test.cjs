const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const css = fs.readFileSync(path.join(root,'cba-theme.css'),'utf8');
test('tema CBA e o ultimo stylesheet, inclusive depois das abas',()=>{
  const head = html.split('</head>')[0];
  const paths=[...head.matchAll(/href="([^"]+\.css)(?:\?[^"]*)?"/g)].map(x=>x[1]);
  assert.equal(paths.at(-1),'cba-theme.css');
  for(const name of ['cyan-theme.css','implementacoes/configuracoes.css','implementacoes/dados-locais.css','rmexpress.css'])
    assert.ok(paths.indexOf(name)>=0&&paths.indexOf(name)<paths.length-1,name);
});
test('paleta aprovada presente e tema aplicado ao menu mobile e OTA',()=>{
  for(const token of ['#140e1f','#241531','#281d37','#342442','#e8c47c','#f9dfa5','#d0c6d8','#f8f1fc','#b8abc7','#59466b'])
    assert.ok(css.includes(token),token);
  assert.match(css,/#homeSistema \.home-apps-grade\s*\{/);
  assert.match(css,/#homeSistema \.home-app-card\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/);
  assert.match(css,/#configuracoes \.ota-acoes \.ota-primario/);
  assert.match(css,/#pesquisa \.pesquisa-buscar/);
  assert.match(css,/#contagemManual \.contagem-salvar/);
});
test('sem trocar logos, funcoes nem estados operacionais',()=>{
  assert.doesNotMatch(css,/\.erp-ok\s*\{|\.erp-analise\s*\{|\.rastreio-card\s*\{[^}]*--rastreio-coletado/);
  assert.doesNotMatch(css,/\.botao-perigo\s*\{[^}]*background/);
  assert.ok(fs.statSync(path.join(root,'android/app/src/main/res/drawable-nodpi/pmobile_identity.webp')).size>0);
});
test('CSS do tema nao possui chaves desbalanceadas',()=>{
  const stripped=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"[^"]*"|'[^']*'/g,'');
  let balance=0;
  for(const ch of stripped) {if(ch==='{')balance++;if(ch==='}')balance--;assert.ok(balance>=0);}
  assert.equal(balance,0);
});
