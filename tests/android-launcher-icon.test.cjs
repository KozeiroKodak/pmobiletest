const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const rawLogo = path.join(res, 'drawable-nodpi/pmobile_identity.webp');

test('PMobile principal referencia iconografia adaptativa em ambas as formas', () => {
  assert.match(manifest, /android:icon="@mipmap\/pmobile_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/pmobile_launcher_round"/);
  assert.match(gradle, /applicationId otaPreview \? "com\.pmobile\.preview" : "com\.pmobile\.app"/);
});

test('Android 8+ usa a arte original como fundo cheio e nao adiciona quadro', () => {
  assert.ok(fs.statSync(rawLogo).size > 0);
  for (const name of ['pmobile_launcher.xml', 'pmobile_launcher_round.xml']) {
    const xml = fs.readFileSync(path.join(res, 'mipmap-anydpi-v26', name), 'utf8');
    assert.match(xml, /<adaptive-icon/);
    assert.match(xml, /<background android:drawable="@drawable\/pmobile_identity"/);
    assert.match(xml, /<foreground android:drawable="@android:color\/transparent"/);
    assert.doesNotMatch(xml, /ic_launcher_background|ic_launcher_foreground/);
  }
});

test('Android legado nao reaproveita antigo icone azul', () => {
  for (const name of ['pmobile_launcher.xml', 'pmobile_launcher_round.xml']) {
    const xml = fs.readFileSync(path.join(res, 'mipmap-anydpi', name), 'utf8');
    assert.match(xml, /<bitmap/);
    assert.match(xml, /android:src="@drawable\/pmobile_identity"/);
  }
});
