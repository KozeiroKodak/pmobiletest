const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=get('script.js');
test('seta Voltar do login restaura o flex da tela inicial',()=>{
  const html=get('index.html');
  const css=get('implementacoes/inicio.css');
  assert.ok(html.includes('onclick="voltarInicio()"'));
  assert.match(css,/#inicio\s*\{[^}]*display:\s*flex\s*;/);
  const begin=js.indexOf('function voltarInicio() {');
  const end=js.indexOf('\nfunction sairPmobile()',begin);
  assert.ok(begin>=0 && end>begin,'rotina de retorno foi encontrada');
  const functionCode=js.slice(begin,end);
  const inicio={style:{display:'none'}};
  const login={style:{display:'block'}};
  const document={getElementById:id=>id==='inicio'?inicio:id==='loginPmobile'?login:null};
  vm.runInNewContext(functionCode+'\nvoltarInicio();',{document});
  assert.equal(login.style.display,'none');
  assert.equal(inicio.style.display,'','inline removido: CSS volta a controlar display:flex');
});
test('correção acompanha cópia web que entra no OTA',()=>{
  assert.equal(js,get('www/script.js'));
  assert.equal(get('index.html'),get('www/index.html'));
});
