const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const source=read("perfil-editor.js");
const windowMock={};
const documentMock={readyState:"loading",addEventListener(){},getElementById:()=>null};
vm.runInNewContext(source,{window:windowMock,document:documentMock,navigator:{onLine:false},console});
const crop=windowMock.PMobileEditorFotos.calcularEnquadramento;
const fmt=(x,y,zoom)=>({x,y,zoom,degrade:55});

test("BugHunter: Y de 100% para 53% move uma foto quadrada com zoom 165%",()=>{
 const y100=crop(384,384,225,425,fmt(50,100,165));
 const y53=crop(384,384,225,425,fmt(50,53,165));
 assert.ok(y100.excessY>200,"o zoom cria margem real na vertical");
 assert.ok(y53.top-y100.top>100,"a imagem deve deslocar mais de 100 px");
 assert.equal(y100.left,y53.left,"o ajuste Y não deve deslocar X");
 assert.equal(y100.top,-y100.excessY);
 assert.ok(y53.top<0&&y53.top>y100.top);
});
test("BugHunter: Y=0, Y=50 e Y=100 cobrem toda a faixa possível",()=>{
 const first=crop(1200,1600,225,425,fmt(50,0,200));
 const middle=crop(1200,1600,225,425,fmt(50,50,200));
 const last=crop(1200,1600,225,425,fmt(50,100,200));
 assert.equal(first.top,0);
 assert.ok(Math.abs(middle.top+last.excessY/2)<.001);
 assert.equal(last.top,-last.excessY);
});
test("sem sobra de pixels no eixo vertical, não exibe área vazia",()=>{
 const z100=crop(384,384,225,425,fmt(50,100,100));
 const z100mid=crop(384,384,225,425,fmt(50,50,100));
 assert.equal(z100.excessY,0);
 assert.equal(z100.top,z100mid.top);
 assert.equal(z100.top,0);
 assert.match(source,/Para deslocar a foto na vertical, aumente o zoom/);
});
test("eixo X funciona independentemente do Y e valores são arredondados",()=>{
 const left=crop(1280,720,225,425,fmt(0,50,165));
 const right=crop(1280,720,225,425,fmt(100,50,165));
 assert.equal(left.left,0);
 assert.ok(right.left<left.left);
 assert.equal(left.top,right.top);
 const decimal=crop(384,384,225,425,fmt(2.9411792755126953,53.47,165));
 assert.ok(Math.abs(decimal.left-crop(384,384,225,425,fmt(3,53,165)).left)<.001);
 assert.ok(Math.abs(decimal.top-crop(384,384,225,425,fmt(3,53,165)).top)<.001);
});
test("preview e tela inicial usam a mesma geometria, sem object-position como único movimento",()=>{
 assert.match(source,/aplicarEnquadramentoImagem\(img,preview,o\)/);
 assert.match(source,/aplicarEnquadramentoImagem\(img,frame,settings\)/);
 assert.match(source,/img\.style\.top=geo\.top\+"px"/);
 assert.match(source,/img\.style\.left=geo\.left\+"px"/);
 assert.match(source,/img\.style\.transform="none"/);
 assert.match(source,/window\.addEventListener\("resize"/);
 assert.match(source,/attributeFilter:\["class"\]/);
 const css=read("perfil-editor.css");
 assert.match(css,/aspect-ratio:9 \/ 17/);
 const html=read("index.html");
 assert.match(html,/href="perfil-editor\.css\?v=1\.1-eixos"/);
 assert.match(html,/src="perfil-editor\.js\?v=1\.1-eixos"/);
});
test("OTA www atualizado sem alterações em login ou imagens de perfil armazenadas",()=>{
 for(const p of ["index.html","perfil-editor.css","perfil-editor.js"]){
  assert.equal(read(p),read("www/"+p),p);
 }
 assert.match(read("inicio-modelo9.js"),/keep\.checked/);
 assert.match(read("perfil-fotos.js"),/pmobile_foto_perfil_salvar/);
});
