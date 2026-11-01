const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('<head>','<head><base href="../../">');
const config=read('script.js').slice(read('script.js').lastIndexOf('(function () {'));
const mocks=`
window.usuarioPmobileAtual={usuario:'teste',nivel:'ADMIN'};
window.credencialPmobileAtual='simulada';
let atual='configuracoes';
function mostrarTelaSistema(id){atual=id;document.querySelectorAll('.tela-sistema').forEach(x=>x.style.display=x.id===id?'block':'none');}
function obterTelaSistemaAtual(){return atual;}
function escapeHtmlPmobile(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function obterSessaoRastreioImportacao(){return {usuario:'teste',credencial:'simulada'};}
const linhas=[{ano:2026,mes:1,transportadora:'Alfa',quantidade:2,valor_notas:1000,total_fretes:50,fretes_embutidos:0,custo_nunes:0,custo_final:50},{ano:2026,mes:2,transportadora:'Beta',quantidade:1,valor_notas:2000,total_fretes:60,fretes_embutidos:0,custo_nunes:0,custo_final:60}];
window.clienteSupabase={rpc:async name=>({data:name==='pmobile_valores_total_analitico_obter'?linhas:{valor_notas:3000,total_fretes:110,custo_final:110,percentual_final:110/3000,origem:'fixture',atualizado_em:'2026-11-01'},error:null})};
function obterClienteSupabase(){return window.clienteSupabase;}
`;
const checks=`
document.addEventListener('DOMContentLoaded',async()=>{
const log=[];const check=(v,n)=>{if(!v)throw Error(n);log.push('OK '+n);};
const output=document.createElement('pre');output.id='qa-unificacao';output.style.cssText='position:relative;z-index:99999;background:#fff;color:#000;padding:20px';document.body.prepend(output);
try{
mostrarTelaSistema('configuracoes');mostrarInicioConfiguracoes();
check(!document.getElementById('configuracoesHub').hidden,'hub Configurações');
abrirAreaConfiguracoes('admin');check(document.getElementById('configuracoesTitulo').textContent==='Administração','área administrativa');
abrirSubareaConfiguracoes('locais');check(atual==='locais','abertura Locais');
check(voltarUmNivelConfiguracoes('locais')&&atual==='configuracoes','Voltar de Locais para Administração');
voltarConfiguracoes();check(!document.getElementById('configuracoesHub').hidden,'Voltar ao hub');
window.usuarioPmobileAtual.nivel='NIVEL2';let denied=0;window.alert=()=>denied++;abrirAreaConfiguracoes('admin');abrirValoresTotal();check(denied===2,'permissões administrativas preservadas');window.usuarioPmobileAtual.nivel='ADMIN';
mostrarTelaSistema('valoresTotal');await carregarValoresTotal();
check(document.querySelectorAll('#valoresTotalCards .valores-kpi').length===6,'seis indicadores financeiros');
check(document.querySelectorAll('.frete-lista details').length===2,'duas transportadoras');
const busca=document.querySelector('.frete-analise input');busca.value='Alfa';busca.dispatchEvent(new Event('input',{bubbles:true}));
check(document.querySelectorAll('.frete-lista details').length===1&&document.querySelector('.frete-lista').textContent.includes('Alfa'),'filtro por transportadora');
const botoes=[...document.querySelectorAll('#valoresTotalMensais > div > button')];
for(const nome of ['Ano','Mês','Transportadora']){const b=botoes.find(x=>x.textContent===nome);check(!!b,'aba '+nome);b.click();}
check(document.querySelectorAll('[id="valoresTotal"]').length===1,'rota financeira única');
output.dataset.qaFail='0';
}catch(e){log.push('FALHOU '+e.message);output.dataset.qaFail='1';}
output.textContent=log.join('\\n');});`;
html=html.replace('</body>','<script>'+mocks+'</script><script src="locais.js"></script><script src="valorestotal.js"></script><script>'+config+'</script><script>'+checks+'</script></body>');
fs.writeFileSync(path.join(root,'tests/fixtures/unificacao.html'),html);console.log('Fixture de navegação e financeiro gerada');
