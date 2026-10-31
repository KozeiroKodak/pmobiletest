const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const injected=fs.readFileSync(path.join(root,"dados-locais.js"),"utf8").replace(
 "  window.abrirDadosLocaisPmobile=abrir;",
 "  window.__bugHunterHtml=htmlPrincipal();\n  window.abrirDadosLocaisPmobile=abrir;");
const sandbox={window:{},document:{readyState:"loading",addEventListener(){}},
 navigator:{onLine:false},console,setTimeout};
vm.runInNewContext(injected,sandbox,{timeout:2000});
const original=html.match(/<section id="contagemManual"[\s\S]*?<\/section>/);
if(!original||!sandbox.window.__bugHunterHtml)throw Error("HTML nativo/local não encontrado");
const links=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(x=>
 x[0].replace(/href="(?!https?:|\/\/)([^"]+)"/g,'href="../../$1"')).join("\n");
const orig=original[0].replace('style="display: none;"','style="display: block;"');
const local=sandbox.window.__bugHunterHtml;
const checks=[
 ["Painel",".contagem-v2",["borderRadius","borderTopColor"]],
 ["Cabeçalho",".contagem-v2-topo",["display","alignItems","borderBottomColor"]],
 ["Ícone",".contagem-v2-icone",["width","height","borderRadius","backgroundColor"]],
 ["Selo",".contagem-v2-selo",["borderRadius","backgroundColor","color"]],
 ["Busca",".contagem-v2-campo",["display","borderRadius","backgroundColor"]],
 ["Tipo",".contagem-v2-tipos button.ativo",["borderRadius","backgroundColor","color"]],
 ["Buscar",".botao-buscar-contagem-manual",["backgroundColor","color","borderRadius","minHeight"]],
 ["Engrenagem",".botao-config-contagem-manual",["backgroundColor","borderRadius"]],
 ["Histórico",".contagem-v2-lista",["borderRadius","borderTopColor"]]
];
const evaluation=[
 "document.querySelector('#dadosLocais [data-dl-panel=conferencias]').hidden=false;",
 "document.querySelector('#dadosLocais #dlFormConferencia').hidden=false;",
 "const specs="+JSON.stringify(checks)+";",
 "const diffs=specs.map(function(c){",
 " const x=document.querySelector('#contagemManual '+c[1]);",
 " const y=document.querySelector('#dadosLocais [data-dl-panel=conferencias] '+c[1]);",
 " if(!x||!y)return {nome:c[0],erro:'Seletor não encontrado'};",
 " const a=getComputedStyle(x),b=getComputedStyle(y);",
 " return {nome:c[0],erros:c[2].filter(k=>a[k]!==b[k]).map(k=>k+': '+a[k]+' vs '+b[k])};",
 "});",
 "document.querySelector('#qa-status').dataset.qaFail=String(diffs.filter(x=>x.erro||x.erros.length).length);",
 "document.querySelector('#qa-status').textContent=JSON.stringify(diffs,null,2);"
].join("\n");
const out=[
 '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1">',
 links,'<style>body{margin:0!important}#contagemManual,#dadosLocais{display:block!important}',
 '#dadosLocais [data-dl-panel="inicio"]{display:none!important}</style></head><body>',
 '<main id="conteudoPrincipal">',orig,'<hr><h2>Conferências locais</h2>',
 '<section id="dadosLocais" class="tela-sistema" style="display:block">',
 local,'</section></main><pre id="qa-status" data-qa-fail="pending"></pre>',
 '<script>',evaluation,'</script></body></html>'
].join("\n");
const dest=path.join(__dirname,"fixtures","bughunter-conferencias.html");
fs.writeFileSync(dest,out);console.log("Render fixture:",dest,out.length);
