const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const js = fs.readFileSync(path.join(__dirname, "..", "contagemmanual.js"), "utf8");
const mirror = fs.readFileSync(path.join(__dirname, "..", "www", "contagemmanual.js"), "utf8");
const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "pmobile_contagem_manual_atualizar.sql"), "utf8");

function ambiente(registro, respostaRpc) {
    let itens = registro ? [{...registro}] : [];
    const chamadas = [];
    const campos = {
        localContagemManual: {value: "L03A02", focus() {}},
        quantidadeContagemManual: {value: "7", focus() {}},
        statusContagemManual: {textContent: ""},
        botaoSalvarContagemManual: {disabled: false}
    };
    const ctx = vm.createContext({
        console: {warn() {}, error() {}},
        document: {
            addEventListener() {},
            getElementById(id) {return campos[id] || null;},
            querySelector() {return null;}
        },
        window: {
            addEventListener() {},
            usuarioPmobileAtual: {id: 4, usuario: "teste", nivel: "NIVEL2"},
            credencialPmobileAtual: "credencial-ficticia"
        },
        navigator: {onLine: true},
        crypto: {randomUUID() {return "00000000-0000-4000-8000-000000000002";}},
        obterClienteSupabase() {
            return {rpc: async (nome, args) => {
                chamadas.push({nome, args});
                return respostaRpc || {data: {
                    local_alterado: true, zerado: false, alteracao_status: "PENDENTE"
                },error: null};
            }};
        },
        setInterval() {},
        clearInterval() {}
    });
    vm.runInContext(js, ctx);
    ctx.lerContagensManuais = async () => itens.map(x => ({...x}));
    ctx.gravarContagensManuais = async (lista) => {itens = lista.map(x => ({...x}));};
    ctx.exibirContagensManuais = async () => {};
    ctx.atualizarContagensManuais = async () => {};
    vm.runInContext(`materialContagemManualSelecionado = {codigo:"40219", local:"L02A03", quantidade:10};`, ctx);
    if (registro) vm.runInContext(`idContagemManualEmEdicao = ${JSON.stringify(registro.id)};`, ctx);
    return {ctx, campos, chamadas, getItens: () => itens};
}
const inicial = {
    id: "00000000-0000-4000-8000-000000000001",
    codigo:"40219", localOriginal:"L02A03", localEncontrado:"L02A03",
    quantidadeEsperada:10, quantidadeFisica:10, localAlterado:false, zerado:false,
    dataHora:"2026-11-04T12:00:00Z", usuarioId:4, usuarioNome:"Teste",
    sincronizado:true, alteracaoStatus:"PENDENTE"
};

test("a cópia www permanece idêntica à origem", () => {
    assert.equal(mirror, js);
    new vm.Script(js);
});
test("editar registro sincronizado altera o mesmo UUID e chama RPC de UPDATE", async () => {
    const env = ambiente(inicial);
    await vm.runInContext("salvarContagemManual()", env.ctx);
    assert.equal(env.getItens().length, 1);
    const atualizado = env.getItens()[0];
    assert.equal(atualizado.id, inicial.id);
    assert.equal(atualizado.dataHora, inicial.dataHora);
    assert.equal(atualizado.usuarioNome, inicial.usuarioNome);
    assert.equal(atualizado.localEncontrado, "L03A02");
    assert.equal(atualizado.quantidadeFisica, 7);
    assert.equal(env.chamadas.length, 1);
    assert.equal(env.chamadas[0].nome, "pmobile_contagem_manual_atualizar");
    assert.equal(env.chamadas[0].args.p_id, inicial.id);
});
test("editar uma contagem ainda offline apenas corrige o item pendente", async () => {
    const env = ambiente({...inicial,sincronizado:false});
    await vm.runInContext("salvarContagemManual()", env.ctx);
    assert.equal(env.getItens().length, 1);
    assert.equal(env.getItens()[0].id, inicial.id);
    assert.equal(env.getItens()[0].quantidadeFisica, 7);
    assert.equal(env.chamadas.length, 0);
});
test("edição de contagem confirmada não grava dados", async () => {
    const env = ambiente({...inicial,alteracaoStatus:"CONFIRMADO"});
    await vm.runInContext("salvarContagemManual()", env.ctx);
    assert.equal(env.getItens()[0].quantidadeFisica, 10);
    assert.equal(env.chamadas.length, 0);
    assert.match(env.campos.statusContagemManual.textContent, /confirmada/i);
});
test("cadastro novo continua criando um registro", async () => {
    const env = ambiente(null);
    await vm.runInContext("salvarContagemManual()", env.ctx);
    assert.equal(env.getItens().length, 1);
    assert.equal(env.getItens()[0].sincronizado, false);
    assert.equal(env.chamadas.length, 0);
});
test("duplo clique em salvar não duplica a contagem nova", async () => {
    const env = ambiente(null);
    const a = vm.runInContext("salvarContagemManual()", env.ctx);
    const b = vm.runInContext("salvarContagemManual()", env.ctx);
    await Promise.all([a, b]);
    assert.equal(env.getItens().length, 1);
});

test("RPC restringe edição por autor, status ERP e não insere novas linhas", () => {
    assert.match(sql,/v_registro\.usuario_id is distinct from v_usuario_id/i);
    assert.match(sql,/v_registro\.alteracao_status = 'CONFIRMADO'/i);
    assert.match(sql,/update public\.contagens_manuais c/i);
    assert.doesNotMatch(sql,/insert into public\.contagens_manuais/i);
    assert.match(sql,/set search_path = ''/i);
});
