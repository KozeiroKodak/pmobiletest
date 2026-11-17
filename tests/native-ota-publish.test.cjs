const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const file = path.join(__dirname, '../scripts/publicar-ota-apk-termux.sh');
const script = fs.readFileSync(file, 'utf8');

test('OTA APK: script Termux tem sintaxe Bash valida', () => {
  execFileSync('bash', ['-n', file], { stdio: 'pipe' });
});

test('OTA APK: script assina e publica somente uma vez', () => {
  const count = re => (script.match(re) || []).length;
  assert.equal(count(/^gh run download /gm), 1, 'download unico');
  assert.equal(count(/^gh release create /gm), 1, 'release unico');
  assert.equal(count(/^signed_cert=/gm), 1, 'certificado verificado uma vez');
  assert.equal(count(/^gh api "repos\/\$repo\/contents\/ota\/native-manifest\.json" -X PUT /gm), 1);
});

test('OTA APK: so reutiliza build com alteracoes fora do codigo Android', () => {
  assert.match(script, /compare\/\$sha\.\.\.\$head/);
  assert.match(script, /ota\/manifest\[\.\]json\|scripts\/publicar-ota-apk-termux\[\.\]sh/);
  assert.match(script, /tests\/native-ota-publish\[\.\]test\[\.\]cjs/);
  assert.match(script, /workflows\/validate-native-ota\[\.\]yml/);
  assert.match(script, /other_changes[\s\S]*fail "Build anterior a main atual com alteracoes de codigo/);
});

test('OTA APK: sem chave no GitHub; assina e verifica antes de liberar', () => {
  assert.match(script, /keystore="\$HOME\/\.android\/debug\.keystore"/);
  const signature = script.indexOf('signed_cert="$(python');
  const verify = script.indexOf('verify --print-certs');
  const hash = script.indexOf('hash="$(sha256sum');
  const release = script.indexOf('gh release create');
  const manifest = script.indexOf('manifest_sha="$(gh api');
  assert.ok(verify >= 0 && signature > verify && hash > signature &&
    release > hash && manifest > hash);
  assert.match(script, /if \[ "\$signed_cert" != "\$expected" \]; then/);
  assert.match(script, /get.*metadata|metadata="\$workspace\/output-metadata.json"/);
});
