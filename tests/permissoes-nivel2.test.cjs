const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const source = read("script.js");
const fragment = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, "Trecho ausente: " + start);
  return source.slice(from, to);
};

function ambiente(nivel) {
  const telas = [
    "homeSistema", "pesquisa", "contagemManual", "transportes", "rastreio",
    "opcoesCotacoes", "cotacoesRegiao", "cotacoesDetalhe", "reservas",
    "configuracoes", "dadosLocais", "divergencias", "locais", "importacao",
    "conferencias", "valoresTotal", "rmexpress"
  ];
  const menus = [
    "menuPesquisa", "menuContagemManual", "menuTransportes", "menuReservas",
    "menuSair", "menuConfiguracoes", "menuDadosLocais", "menuRMExpress",
    "menuDivergencias", "menuNovo"
  ];
  const elementos = new Map([...telas, ...menus].map(id => [
    id, { id, style: { display: id === "homeSistema" ? "block" : "none" },
      classList: { add() {} } }
  ]));
  const document = {
    getElementById: id => elementos.get(id) || null,
    querySelectorAll: seletor =>
      seletor === "#homeSistema .home-app-card"
        ? menus.map(id => elementos.get(id))
        : []
  };
  const window = { usuarioPmobileAtual: { nivel }, dispatchEvent() {} };
  const historicoTelasSistema = [];
  const sandbox = {
    document, window, Event: class Event {},
    historicoTelasSistema,
    obterTelaSistemaAtual() {
      return telas.find(id => elementos.get(id).style.display === "block") || null;
    },
    esconderTelasSistema() {
      telas.forEach(id => { elementos.get(id).style.display = "none"; });
    },
    limparMenuAtivo() {}
  };
  const code = [
    fragment("const TELAS_NIVEL2_PMOBILE", "function obterTelaSistemaAtual()"),
    fragment("function mostrarTelaSistema(", "// TELA INICIAL"),
    fragment("function atualizarVisibilidadeConfiguracoes()", "function abrirConfiguracoes()")
  ].join("\n");
  vm.runInNewContext(code, sandbox);
  return { ...sandbox, elementos, telas, menus };
}

test("Nível 2 vê apenas os quatro cartões e Sair, inclusive menu criado dinamicamente", () => {
  const app = ambiente("NIVEL2");
  app.atualizarVisibilidadeConfiguracoes();
  const visiveis = app.menus.filter(id => app.elementos.get(id).style.display !== "none");
  assert.deepEqual(visiveis, [
    "menuPesquisa", "menuContagemManual", "menuTransportes", "menuReservas", "menuSair"
  ]);
});

test("Nível 2 pode navegar pelas abas e subtelas de Transportes", () => {
  const app = ambiente("NIVEL2");
  const permitidas = [
    "homeSistema", "pesquisa", "contagemManual", "transportes", "rastreio",
    "opcoesCotacoes", "cotacoesRegiao", "cotacoesDetalhe", "reservas"
  ];
  permitidas.forEach(id => {
    app.mostrarTelaSistema(id);
    assert.equal(app.elementos.get(id).style.display, "block", id);
  });
});

test("Nível 2 não abre áreas restritas nem pelo histórico", () => {
  const app = ambiente("NIVEL2");
  app.mostrarTelaSistema("pesquisa");
  const antes = app.historicoTelasSistema.length;
  for (const id of [
    "configuracoes", "dadosLocais", "locais", "divergencias",
    "importacao", "conferencias", "valoresTotal", "rmexpress"
  ]) {
    assert.equal(app.mostrarTelaSistema(id), false, id);
    assert.notEqual(app.elementos.get(id).style.display, "block", id);
    assert.equal(app.historicoTelasSistema.length, antes, "histórico: " + id);
  }
});

test("Admin preserva acesso completo e o espelho Android permanece atualizado", () => {
  const app = ambiente("ADMIN");
  app.atualizarVisibilidadeConfiguracoes();
  assert.notEqual(app.elementos.get("menuDadosLocais").style.display, "none");
  app.mostrarTelaSistema("dadosLocais");
  assert.equal(app.elementos.get("dadosLocais").style.display, "block");
  assert.equal(read("script.js"), read("www/script.js"));
  assert.equal(read("dados-locais.js"), read("www/dados-locais.js"));
  assert.equal(read("index.html"), read("www/index.html"));
});

test("Aprovação apresenta as permissões corretas e migração protege Dados Locais", () => {
  assert.match(source, /Nível 2 — Pesquisa, Contagem manual, Transportes e Reservas/);
  const sql = read("sql/pmobile_nivel2_restricoes.sql");
  assert.match(sql, /private\.pmobile_local_autorizar/);
  assert.match(sql, /u\.nivel = 'ADMIN'/);
  assert.doesNotMatch(sql, /u\.nivel in \('ADMIN','NIVEL2'\)/i);
  assert.match(read("dados-locais.js"), /menu\.style\.display=window\.usuarioPmobileAtual\?\.nivel==="ADMIN"/);
});
