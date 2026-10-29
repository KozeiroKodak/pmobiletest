const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql=fs.readFileSync(path.join(__dirname,"..","sql","fix_confirmar_alteracao_local_id_ambiguo.sql"),"utf8");

test("função mantém a assinatura atual usada pelo botão do PMobile",()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.confirmar_alteracao_local\(/i);
  assert.match(sql,/p_admin_usuario text, p_admin_credencial text, p_contagem_id uuid/i);
  assert.match(sql,/RETURNS TABLE\(id uuid, alteracao_status text/i);
});

test("metadados usam alias explícito, sem id ambíguo em PLpgSQL",()=>{
  assert.match(sql,/update public\.materiais_sync_meta as meta\s+set versao=clock_timestamp\(\),atualizado_em=clock_timestamp\(\)\s+where meta\.id=true;/i);
  assert.doesNotMatch(sql,/where\s+id\s*=\s*true/i);
});

test("preserva validação de administrador e gravação de confirmação",()=>{
  assert.match(sql,/u\.ativo=true and u\.nivel='ADMIN'/);
  assert.match(sql,/extensions\.crypt\(p_admin_credencial,u\.senha_hash\)/);
  assert.match(sql,/where c\.id=p_contagem_id and c\.local_alterado=true/);
  assert.match(sql,/update public\.materiais m set local=v_contagem\.local_encontrado where m\.id=v_contagem\.material_id/);
  assert.match(sql,/update public\.contagens_manuais c set alteracao_status='CONFIRMADO'/);
  assert.match(sql,/where c\.id=v_contagem\.id/);
});
