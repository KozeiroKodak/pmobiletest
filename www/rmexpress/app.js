import { iniciarNotificacoes } from './src/notificacoes.js';
import { estaIntegradoPmobile, iniciarIntegracaoPmobile } from './src/integracao.js';
import { iniciarAcesso } from "./src/acesso.js";
import { STATUS_ENTREGA, filtrarEntregas, resumirEntregas } from "./src/domain.js";
import { iniciarGerencia } from "./src/gerencia.js";
import { iniciarMotorista } from "./src/motorista.js";
import { iniciarCentral } from "./src/central.js";
import {
  criarDemo, lerDemo, salvarDemo, limparDemo,
  entregasDemo, alterarEntregaDemo, moverEntregaDemo
} from "./src/demo-store.js";

const $ = id => document.getElementById(id);
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
let demo = lerDemo(storage);
let sessaoPmobile = null;
const ROTULOS = Object.freeze({
  pendente: "Pendente",
  em_rota: "Em rota",
  entregue: "Concluída",
  ocorrencia: "Ocorrência"
});

function html(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, ch =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])
  );
}

function abrirAba(nome) {
  if (!["inicio","painel","entregas","roteiros","gerencia","central"].includes(nome)) return;
  if (["gerencia","central"].includes(nome) && !["ADMIN","RMADMIN"].includes(sessaoPmobile?.nivel)) return;
  document.querySelectorAll(".view").forEach(view => { view.hidden = view.id !== "view-" + nome; });
  document.querySelectorAll("[data-view]").forEach(botao => {
    const ativo = botao.dataset.view === nome;
    botao.classList.toggle("active", ativo);
    if (ativo) botao.setAttribute("aria-current","page");
    else botao.removeAttribute("aria-current");
  });
  $("voltarMenu").hidden = nome === "inicio";
  window.scrollTo(0,0);
}

// Called by the Android back dispatcher; false preserves the system exit at Home.
window.voltarAndroidPmentregas = function() {
  if (!$('painelNotificacoes').hidden) { notificacoes.fechar(); return true; }
  if (!$('loginPmobile').hidden) { $('voltarInicioAcesso').click(); return true; }
  if (!$('aplicacao').hidden && $('view-inicio').hidden) { abrirAba('inicio'); return true; }
  return false;
};

function mensagem(texto) {
  const aviso = $("aviso");
  aviso.hidden = !texto;
  aviso.textContent = texto || "";
}

function persistir() {
  if (!demo) return;
  if (!salvarDemo(storage,demo)) {
    mensagem("O navegador bloqueou o armazenamento local. Os exemplos desta sessão poderão desaparecer ao atualizar a página.");
  }
}

function atualizarConexao() {
  const online = navigator.onLine;
  $("connection").textContent = online ? (sessaoPmobile ? "Online · Sessão PMobile" : "Online · Sem sessão") : "Offline · Servidor indisponível";
  $("connection").classList.toggle("offline",!online);
}

function montarAcoes(item) {
  const id = html(item.id);
  if (item.status === STATUS_ENTREGA.PENDENTE)
    return `<button type="button" class="btn btn-primary" data-action="iniciar" data-id="${id}">Iniciar parada</button>`;
  if (item.status === STATUS_ENTREGA.EM_ROTA)
    return `<button type="button" class="btn btn-primary" data-action="entregar" data-id="${id}">Simular entrega</button>
      <button type="button" class="btn btn-secondary" data-action="ocorrencia" data-id="${id}">Registrar ocorrência</button>`;
  if (item.status === STATUS_ENTREGA.OCORRENCIA)
    return `<button type="button" class="btn btn-secondary" data-action="retomar" data-id="${id}">Retomar rota</button>`;
  return '<span class="muted">Simulação concluída</span>';
}

function cartaoEntrega(item) {
  return `<article class="delivery-card">
    <div class="delivery-head">
      <div><small>PARADA ${item.ordem} · ${html(item.nf)}</small><h3>${html(item.cliente)}</h3></div>
      <span class="status-chip status-${html(item.status)}">${ROTULOS[item.status]}</span>
    </div>
    <p class="destination">⌖ ${html(item.destino)} · ${html(item.regiao)}</p>
    <div class="delivery-meta"><span>${item.volumes} volumes</span><span>${item.pesoKg.toLocaleString("pt-BR")} kg</span><span>Dados fictícios</span></div>
    <div class="delivery-actions">${montarAcoes(item)}</div>
  </article>`;
}

function renderizarEntregas(itens) {
  const filtrados = filtrarEntregas(itens, $("buscaEntregas").value, $("filtroStatus").value);
  $("quantidadeEntregas").textContent = demo ? `${filtrados.length} de ${itens.length} entregas fictícias` : "Sem atribuições reais";
  $("listaEntregas").innerHTML = !demo
    ? '<div class="empty"><strong>Nenhuma entrega conectada</strong><p>Ative a demonstração para experimentar esta tela com quatro NFs fictícias.</p></div>'
    : filtrados.length ? filtrados.map(cartaoEntrega).join("")
    : '<div class="empty"><strong>Nenhum resultado</strong><p>Experimente outro termo ou filtro de situação.</p></div>';
}

function renderizarRoteiros(itens) {
  const abertas = itens.filter(item=>item.status!==STATUS_ENTREGA.ENTREGUE);
  $("quantidadeRoteiros").textContent = demo ? `${abertas.length} paradas em aberto · Exemplo` : "Sem paradas";
  if (!demo) {
    $("listaRoteiros").innerHTML = '<li class="empty">Ative a demonstração para montar uma sequência manual.</li>';
    return;
  }
  $("listaRoteiros").innerHTML = abertas.length ? abertas.map((item,i)=>`
    <li class="route-card">
      <div class="route-number">${i+1}</div>
      <div class="route-details"><strong>${html(item.cliente)}</strong>
        <span>${html(item.nf)} · ${html(item.regiao)}</span>
        <small class="status-small">${ROTULOS[item.status]}</small>
      </div>
      <div class="route-controls">
        <button type="button" aria-label="Subir ${html(item.nf)}" title="Subir parada" data-action="subir" data-id="${html(item.id)}" ${i===0?"disabled":""}>↑</button>
        <button type="button" aria-label="Descer ${html(item.nf)}" title="Descer parada" data-action="descer" data-id="${html(item.id)}" ${i===abertas.length-1?"disabled":""}>↓</button>
      </div>
    </li>`).join("")
    : '<li class="empty">Todas as entregas fictícias foram concluídas.</li>';
}

function renderizarPainel(itens) {
  for(const id of ["proximaAcoes","proximaDestino","proximaSituacao","proximaCarga","motoristaSincronizacao"])$(id).hidden=true;
  const resumo = resumirEntregas(itens);
  const vazio = !demo;
  $("metricaTotal").textContent = vazio ? "—" : resumo.total;
  $("metricaAbertas").textContent = vazio ? "—" : resumo.total-resumo.entregues;
  $("metricaConcluidas").textContent = vazio ? "—" : resumo.entregues;
  $("legendaJornada").textContent = vazio ? "Aguardando integração" : "Exemplo local · Sem dados reais";
  const percentual = resumo.total ? Math.round(resumo.entregues / resumo.total * 100) : 0;
  $("progressoTexto").textContent = vazio ? "Sem dados" : `${percentual}% concluído`;
  $("progressoPreenchimento").style.width = percentual + "%";
  $("progressoBarra").setAttribute("aria-valuenow",String(percentual));
  const proxima = itens.find(item=>item.status!==STATUS_ENTREGA.ENTREGUE);
  $("proximaDescricao").textContent = vazio
    ? (sessaoPmobile ? "A jornada real do motorista ainda não está conectada nesta versão." : "As próximas entregas aparecerão aqui quando o servidor estiver conectado.")
    : proxima ? `${proxima.cliente} · ${proxima.nf} · ${proxima.regiao} (exemplo fictício)`
    : "Todas as paradas fictícias foram concluídas!";
  $("resumoOcorrencias").textContent = vazio
    ? (sessaoPmobile ? "A Gerência pode atribuir NFs reais; esta jornada de motorista continua sem integração." : "Sem login ou comunicação com o banco de dados. Nenhuma operação real pode ser confirmada.")
    : `Simulação local: ${resumo.pendentes} pendente(s), ${resumo.emRota} em rota e ${resumo.ocorrencias} ocorrência(s). Nada foi enviado ao servidor.`;

}

function renderizar() {
  const autenticada = Boolean(sessaoPmobile);
  const ativa = Boolean(demo) && !autenticada;
  $("iniciarDemo").hidden = ativa || autenticada;
  $("reiniciarDemo").hidden = !ativa;
  $("sairDemo").hidden = !ativa;
  $("environmentTitle").textContent = autenticada ? "SESSÃO PMOBILE ATIVA" : ativa ? "DEMONSTRAÇÃO ATIVA · DADOS FICTÍCIOS" : "Ambiente de desenvolvimento";
  $("environmentText").textContent = autenticada
    ? "Gerência e operações do motorista consultam dados reais do Supabase, conforme o perfil autorizado."
    : ativa
    ? "Todas as NFs, clientes e destinos são exemplos. As ações são gravadas apenas neste navegador; não existe integração de produção."
    : "Nenhuma fonte de dados conectada. Você pode experimentar uma jornada fictícia, sem alterar NFs reais.";
  document.body.classList.toggle("demo-active",ativa);
  if (sessaoPmobile?.nivel === "RMMOTORISTAS") {
    $("environmentTitle").textContent="MOTORISTA · DADOS REAIS";
    $("environmentText").textContent="As suas notas atribuídas são consultadas no Supabase. Confirmações de roteiro e entregas alteram dados oficiais.";
    atualizarConexao();
    return;
  }
  const itens = entregasDemo(demo);
  renderizarPainel(itens);
  renderizarEntregas(itens);
  renderizarRoteiros(itens);
  atualizarConexao();
}

function ativarDemo() {
  if (sessaoPmobile) return;
  demo = criarDemo();
  mensagem("");
  persistir();
  renderizar();
}
function sairDemo() {
  if (!window.confirm("Encerrar a demonstração e apagar o progresso fictício salvo neste navegador?")) return;
  const limpa=limparDemo(storage);
  demo=null;
  mensagem(limpa ? "Demonstração encerrada. Nenhum dado real foi alterado." : "Demonstração encerrada nesta sessão; o navegador não permitiu limpar o armazenamento.");
  renderizar();
  acesso.definirSessao(null);
}
function reiniciarDemo() {
  if (!window.confirm("Reiniciar todas as quatro entregas fictícias?"))return;
  ativarDemo();
  mensagem("Exemplo reiniciado do começo.");
}

function acaoEntrega(acao,id) {
  if (!demo) return;
  try {
    const destino={
      iniciar:STATUS_ENTREGA.EM_ROTA,
      entregar:STATUS_ENTREGA.ENTREGUE,
      ocorrencia:STATUS_ENTREGA.OCORRENCIA,
      retomar:STATUS_ENTREGA.EM_ROTA
    }[acao];
    if (destino) {
      if (acao==="entregar" && !window.confirm("Confirmar APENAS a entrega fictícia? Nenhuma NF real será alterada."))return;
      demo=alterarEntregaDemo(demo,id,destino);
      mensagem("Operação simulada registrada apenas no dispositivo.");
    } else if (acao==="subir" || acao==="descer") {
      demo=moverEntregaDemo(demo,id,acao);
      mensagem("Sequência de exemplo ajustada localmente, sem cálculo automático.");
    } else return;
    persistir();
    renderizar();
  } catch(erro) {
    mensagem(erro.message || "Não foi possível executar a simulação.");
  }
}

document.querySelectorAll("[data-view]").forEach(botao =>
  botao.addEventListener("click",()=>abrirAba(botao.dataset.view))
);
$("voltarMenu").addEventListener("click",()=>abrirAba("inicio"));
$("verEntregas").addEventListener("click",()=>abrirAba("entregas"));
$("verRoteiroProxima").addEventListener("click",()=>abrirAba("roteiros"));
$("iniciarDemo").addEventListener("click",ativarDemo);
$("reiniciarDemo").addEventListener("click",reiniciarDemo);
$("sairDemo").addEventListener("click",sairDemo);
$("buscaEntregas").addEventListener("input",()=>renderizarEntregas(entregasDemo(demo)));
$("filtroStatus").addEventListener("change",()=>renderizarEntregas(entregasDemo(demo)));
document.addEventListener("click",event=>{
  const botao=event.target.closest("button[data-action][data-id]");
  if (botao && !botao.disabled) acaoEntrega(botao.dataset.action,botao.dataset.id);
});
window.addEventListener("online",atualizarConexao);
window.addEventListener("offline",atualizarConexao);

const motorista=iniciarMotorista();
const central=iniciarCentral();
$("tabCentral").hidden=true;
const acesso=iniciarAcesso({
  aoCancelar(){gerencia.sair();},
  aoDemonstrar(){if(!demo)ativarDemo();else renderizar();}
});
const notificacoes=iniciarNotificacoes({abrirArea:abrirAba,gerenciarDispositivo:!estaIntegradoPmobile()});
const gerencia=iniciarGerencia({
  aoSessaoNotificacoes:sessao=>notificacoes.definirSessao(sessao),
  aoSessaoAdmin(sessao){
    if(sessao)return central.entrar(sessao);
    central.sair();
  },
  aoSessaoMotorista(sessao){
    if(!sessao) { motorista.sair();return; }
    return motorista.entrar(sessao);
  },
  aoAlterarSessao(perfil){
    sessaoPmobile = perfil;
    acesso.definirSessao(perfil);
    if(perfil){
      demo = null;
      limparDemo(storage);
      mensagem("Sessão PMobile iniciada. A demonstração foi desligada para separar dados reais de exemplos.");
      $("tabCentral").hidden=!["ADMIN","RMADMIN"].includes(perfil.nivel);
      $("grupoGestao").hidden=!["ADMIN","RMADMIN"].includes(perfil.nivel);
      abrirAba("inicio");
    }else{
      $("tabCentral").hidden=true;
      $("grupoGestao").hidden=true;
      mensagem("Sessão PMobile encerrada.");
      abrirAba("inicio");
    }
    renderizar();
  }
});
abrirAba("inicio");
renderizar();

window.PMEntregasInicializado = function() {};
window.PMENTREGAS_OK = true;
iniciarIntegracaoPmobile({gerencia,notificacoes});
window.procurarAtualizacoesOta = () => window.PMobileAtualizacoes?.executar("procurarAtualizacoes");

(function configurarAtualizacoes() {
    "use strict";
    if(estaIntegradoPmobile())return; // The containing PMobile owns its OTA lifecycle.
    let ultimo = "", estado = {}, ciclos = 0, bootConfirmado = false, primeiraPintura = false;
    const $ = id => document.getElementById(id);
    const ocupados = ["checking", "downloading", "verifying", "preparing", "applying"];
    const titulos = {idle:"Pronto para verificar",checking:"Procurando novidades",available:"Tem novidade para você",updated:"Você está em dia",downloading:"Atualização a caminho",verifying:"Conferindo os arquivos",preparing:"Quase pronto",ready:"Pronto para aplicar",applying:"Até já!",error:"Vamos tentar novamente?",incompatible:"Atualize o aplicativo",legacy:"Seu aplicativo usa o atualizador anterior",unsupported:"Disponível no aplicativo Android"};
    const formatarBytes = n => Number.isFinite(Number(n)) && Number(n) >= 0 ? (n / 1048576).toLocaleString("pt-BR", {maximumFractionDigits:1}) + " MB" : "";
    function renderizar(dados) {
        if (!$('otaPainel')) return;
        estado = dados || {};
        const status = estado.state || "idle", ocupado = ocupados.includes(status);
        $('otaPainel').dataset.estado = status;
        $('otaEstadoTitulo').textContent = titulos[status] || titulos.idle;
        $('otaMensagem').textContent = estado.message || "Consulte as atualizações disponíveis para seu PMEntregas.";
        $('otaAtual').textContent = estado.currentVersion || "—";
        $('otaDisponivel').textContent = estado.availableVersion || (status === "updated" ? estado.currentVersion : "—") || "—";
        $('otaNativa').textContent = estado.nativeVersion || "—";
        $('otaSelo').textContent = status === "ready" ? "Download concluído" : status === "updated" ? "Tudo atualizado" : status === "available" ? "Nova versão disponível" : "PMEntregas sempre em dia";
        $('otaVerificar').hidden = ["available", "ready"].includes(status);
        $('otaVerificar').disabled = ocupado || status === "unsupported";
        $('otaVerificar').textContent = ocupado ? "Aguarde…" : status === "error" ? "Tentar novamente" : "Verificar atualizações";
        $('otaBaixar').hidden = status !== "available";
        $('otaAplicar').hidden = status !== "ready";
        $('otaProgresso').hidden = !ocupado && status !== "ready";
        $('otaEtapa').textContent = ({checking:"Verificando",downloading:"Baixando",verifying:"Conferindo integridade",preparing:"Preparando arquivos",ready:"Download concluído",applying:"Aplicando"})[status] || "Preparando";
        const percentual = Number(estado.percent);
        if (Number.isFinite(percentual) && percentual >= 0) {
            $('otaBarra').value = Math.min(100, percentual);
            $('otaPorcentagem').textContent = Math.min(100, percentual) + "%";
        } else { $('otaBarra').removeAttribute("value"); $('otaPorcentagem').textContent = ""; }
        $('otaBytes').textContent = estado.downloadedBytes > 0 || status === "downloading" ? formatarBytes(estado.downloadedBytes || 0) + (estado.totalBytes > 0 ? " de " + formatarBytes(estado.totalBytes) : "") : "";
        const notas = String(estado.releaseNotes || "").trim();
        $('otaNovidades').hidden = !notas;
        $('otaNotas').textContent = notas;
        $('otaRecuperacao').hidden = !estado.recovery;
        $('otaRecuperacao').textContent = estado.recovery || "";
        $('otaUltima').textContent = estado.checkedAt ? "Última verificação: " + new Date(estado.checkedAt).toLocaleString("pt-BR") : "";
        $('otaRodape').textContent = status === "legacy" ? "Instale o APK atualizado para acompanhar o progresso neste painel. A verificação atual continua disponível." : status === "unsupported" ? "No computador você pode desenvolver e testar as telas. A atualização instalada é gerenciada pelo aplicativo Android." : "O download acontece em segundo plano. Salve suas operações antes de reiniciar e aplicar.";
        const indice = ({checking:0,available:0,downloading:1,verifying:2,preparing:2,ready:3,applying:3,updated:4})[status];
        document.querySelectorAll('[data-ota-etapa]').forEach((el,i) => {
            el.dataset.situacao = indice === i ? "atual" : indice > i ? "concluida" : "pendente";
        });
    }
    function atualizar() {
        const ponte = window.PMENTREGAS_OTA;
        let dados;
        try {
            dados = ponte && typeof ponte.obterEstado === "function" ? JSON.parse(ponte.obterEstado()) : ponte ? {state:"legacy",message:"Você pode procurar atualizações usando o mecanismo já instalado."} : {state:"unsupported",message:"Abra este painel no PMEntregas do seu celular para atualizar."};
        } catch(e) { dados = {state:"error",message:"Não foi possível consultar o atualizador. Tente novamente."}; }
        const atual = JSON.stringify(dados);
        if (atual !== ultimo) { ultimo = atual; renderizar(dados); }
        confirmarBoot();
    }
    function executar(metodo) {
        const ponte = window.PMENTREGAS_OTA;
        if (ponte && typeof ponte[metodo] === "function") { ponte[metodo](); atualizar(); }
    }
    window.baixarAtualizacaoOta = () => executar("baixarAtualizacao");
    window.aplicarAtualizacaoOta = () => executar("aplicarAtualizacao");
    window.PMobileAtualizacoes = {renderizar, atualizar, executar};
    function confirmarBoot() {
        const ponte = window.PMENTREGAS_OTA;
        const requisitos = [window.PMEntregasInicializado];
        if (primeiraPintura && !bootConfirmado && window.PMENTREGAS_OK && requisitos.every(fn=>typeof fn === "function")
                && $('metricaTotal') && ponte && typeof ponte.confirmarInicializacao === "function" && estado.currentVersion) {
            ponte.confirmarInicializacao(estado.currentVersion); bootConfirmado = true;
        }
    }
    function iniciar() {
        atualizar();
        // Confirmar somente depois dos listeners de inicialização e da primeira pintura.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            primeiraPintura = true; confirmarBoot();
        }));
        setInterval(() => {
            if (document.hidden) return;
            ciclos++;
            if (ocupados.includes(estado.state) || $('otaPainel')?.getClientRects().length || ciclos % 10 === 0) atualizar();
        }, 1000);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();

