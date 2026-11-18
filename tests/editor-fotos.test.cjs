const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const html=get("index.html");
const editor=get("perfil-editor.js");
const profile=get("perfil-fotos.js");
const css=get("perfil-editor.css");
test("duas imagens diferentes, com editor em abas e pre-visualizacao",()=>{
 for(const tag of ["pmEditorAbaPerfil","pmEditorAbaFundo","pmEditorPreview","pmEditorArquivo","pmEditorSalvar","pmEditorRemover","pmEditorCampoX","pmEditorCampoY","pmEditorCampoZoom","pmEditorCampoDegrade","pmEditorPreviewImagem"]){
  assert.ok(html.includes('id="'+tag+'"'),tag);
 }
 assert.ok(html.includes('id="inicioFotoTelaCheia" data-pm-background-photo'));
 assert.match(html,/id="inicioFotoCompletaMobile"[\s\S]*data-pm-background-photo/);
 const avatarTags=[...html.matchAll(/data-pm-profile-photo/g)].length;
 assert.ok(avatarTags>=3,"avatar continua em Home, Conta e modal");
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,new Set(ids).size,"IDs não podem duplicar");
});
test("editor sincroniza fundo em RPC privado, nunca envia avatar junto",()=>{
 assert.match(editor,/pmobile_fundo_perfil_ler/);
 assert.match(editor,/pmobile_fundo_perfil_salvar/);
 assert.match(editor,/p_usuario:user\.user,p_credencial:user\.credential/);
 assert.match(editor,/const existing=background\?\.blob\|\|null/);
 assert.match(editor,/blob=remove\?null:\(newImage\?await optimizeBackground\(workingBlob\):existing\)/);
 assert.match(editor,/await local\("readwrite",store=>store\.put\(rec,key\("wallpaper",user\)\)\)/);
 assert.match(editor,/key\("wallpaper-pending",user\)/);
 assert.match(editor,/if\(profileKey!==user\.key\)\{\s*\/\/ Nenhuma foto de fundo da conta anterior pode ser exibida\./);
 assert.doesNotMatch(editor,/service_role|supabase\.storage/);
});
test("avatar e recortado a 384 com limites e continua usando RPC existente",()=>{
 assert.match(editor,/canvas\.width=384;canvas\.height=384/);
 assert.match(editor,/cropAvatar\(workingBlob,working\)/);
 assert.match(editor,/PMobilePerfilFotos\?\.salvarEditada\?\.\(cropped\)/);
 assert.match(profile,/pmobile_foto_perfil_salvar/);
 assert.match(profile,/obterFotoAtual:\(\)=>imageBlob/);
 assert.match(profile,/file\?\.__pmobileEditada===true \? file : await optimize\(file\)/);
});
test("modelo 9 preserva trava do Manter login e foto original de perfil quando sem fundo",()=>{
 const modello=get("inicio-modelo9.js");
 assert.match(modello,/keep\.checked/);
 assert.match(modello,/saved\.senha !== latest\.credential/);
 assert.match(editor,/background\?\.blob\|\|avatarBlob/);
 assert.match(editor,/if\(!user\)\{clear\(\);return;\}/);
 assert.match(css,/#inicio\.inicio-modelo9 \.inicio-fundo-foto img\.inicio-foto-mobile-integral:not\(\[hidden\]\)/);
 assert.match(css,/object-position:var\(--pm-fundo-x\) var\(--pm-fundo-y\)/);
 assert.match(css,/mask-image:none/);
});
test("esquema separado, RLS e validação individual de credenciais",()=>{
 const sql=get("supabase/pmobile_fundos_perfil.sql");
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.pmobile_fundos_perfil/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.pmobile_fundos_perfil FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/private\.pmobile_foto_credencial_id/);
 assert.match(sql,/octet_length\(imagem_jpeg\) BETWEEN 100 AND 1250000/);
 assert.match(sql,/p_remover boolean DEFAULT false/);
 assert.doesNotMatch(sql,/ALTER TABLE\s+public\.usuarios|UPDATE\s+public\.usuarios|DROP TABLE\s+public\.pmobile_fotos_perfil/i);
});
test("publicação OTA inclui interface e scripts atuais e não exige novo APK",()=>{
 for(const file of ["index.html","script.js","perfil-fotos.js","perfil-editor.js","perfil-editor.css"]){
  assert.equal(get(file),get("www/"+file),file);
 }
 assert.match(html,/src="perfil-editor\.js\?v=1\.1-eixos"/);
 assert.match(html,/href="perfil-editor\.css\?v=1\.1-eixos"/);
 const styles=[...html.matchAll(/href="([^"]+\.css)(?:\?[^"]*)?"/g)].map(m=>m[1]);
 assert.equal(styles.at(-1),"cba-theme.css");
 new vm.Script(editor);
 new vm.Script(profile);
});
