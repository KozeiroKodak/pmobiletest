#!/data/data/com.termux/files/usr/bin/bash
# Publica APK principal no canal OTA, assinado pela chave original do Termux.
set -Eeuo pipefail
repo="KozeiroKodak/pmobiletest"
expected="d73f1b234895f85b8e96321b95000cb18947b7c335e1b949b148e77a095c4a98"
keystore="$HOME/.android/debug.keystore"
workspace="$(mktemp -d "$PREFIX/tmp/pmobile-native-ota.XXXXXX")"
trap 'rm -rf "$workspace"' EXIT
fail() { echo "ERRO: $*" >&2; exit 1; }
for command_name in gh java keytool python sha256sum base64; do
  command -v "$command_name" >/dev/null || fail "Ferramenta $command_name ausente."
done
gh auth status >/dev/null 2>&1 || fail "Autentique GitHub: gh auth login"
[ -f "$keystore" ] || fail "Chave original ausente: recupere o backup; NAO crie outra."
key_sha="$(keytool -list -v -keystore "$keystore" -storepass android -alias androiddebugkey 2>/dev/null \
  | sed -nE 's/^[[:space:]]*SHA256:[[:space:]]*//p' | head -n1 | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
[ "$key_sha" = "$expected" ] || fail "Certificado local divergente. Publicacao cancelada."
if [ "$#" -ge 1 ]; then
  run="$1"
else
  run="$(gh run list --repo "$repo" --workflow android-main-build.yml --status success --limit 10 \
    --json databaseId --jq '.[0].databaseId // empty')"
fi
[[ "$run" =~ ^[0-9]+$ ]] || fail "Nenhum build principal aprovado."
info="$(gh run view "$run" --repo "$repo" --json status,conclusion,headSha)"
sha="$(printf %s "$info" | python -c 'import sys,json;x=json.load(sys.stdin);assert x["status"]=="completed" and x["conclusion"]=="success";print(x["headSha"])')" \
  || fail "Build ainda nao aprovado."
head="$(gh api "repos/$repo/git/ref/heads/main" --jq .object.sha)"
if [ "$sha" != "$head" ]; then
  # O OTA web pode gerar um commit apenas no seu manifesto depois do build nativo.
  # Permitir somente este avanco; nenhuma outra mudanca de codigo e aceita.
  changed="$(gh api "repos/$repo/compare/$sha...$head" --jq '.files[].filename')" \
    || fail "Nao foi possivel verificar a distancia entre o build e main."
  # Alteracoes somente no manifesto web e neste script de assinatura nao mudam o APK.
  # Aceitar somente arquivos sem efeito no binario do build validado.
  other_changes="$(printf '%s\n' "$changed" | grep -Ev '^(ota/manifest[.]json|scripts/publicar-ota-apk-termux[.]sh|tests/native-ota-publish[.]test[.]cjs|[.]github/workflows/validate-native-ota[.]yml)$' || true)"
  [ -z "$other_changes" ] || fail "Build anterior a main atual com alteracoes de codigo: $other_changes. Recompile."
fi
gh run download "$run" --repo "$repo" --name pmobile-principal-unsigned --dir "$workspace"
unsigned="$workspace/app-release-unsigned.apk"
metadata="$workspace/output-metadata.json"
[ -s "$unsigned" ] && [ -s "$metadata" ] || fail "APK ou metadados nao encontrados no artefato."
read -r code version < <(python - "$metadata" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]))
assert x['applicationId']=='com.pmobile.app', 'Artefato nao e PMobile principal'
y=x['elements'][0]
assert y['versionCode']>0 and y['versionName']
print(y['versionCode'],y['versionName'])
PY
)
[[ "$code" =~ ^[0-9]+$ ]] || fail "VersionCode invalido."
[[ "$version" =~ ^[0-9]+(\.[0-9]+){1,3}$ ]] || fail "VersionName invalida."
signed="$workspace/PMOBILE-PRINCIPAL.apk"
if command -v apksigner >/dev/null 2>&1; then
  apksigner sign --v4-signing-enabled false \
    --ks "$keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android \
    --out "$signed" "$unsigned"
  apksigner verify --print-certs "$signed" > "$workspace/verification.txt" 2>&1
elif [ -f "$PREFIX/share/java/apksigner.jar" ]; then
  java -jar "$PREFIX/share/java/apksigner.jar" sign --v4-signing-enabled false \
    --ks "$keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android \
    --out "$signed" "$unsigned"
  java -jar "$PREFIX/share/java/apksigner.jar" verify --print-certs "$signed" > "$workspace/verification.txt" 2>&1
else
  fail "apksigner nao encontrado. Nao envie APK sem assinatura."
fi
# Alguns builds do apksigner variam o formato e a capitalizacao do relatorio.
# Use o certificado extraido do APK verificado; nunca desative a comparacao.
signed_cert="$(python - "$workspace/verification.txt" <<'PY'
import re, sys
with open(sys.argv[1], encoding='utf-8', errors='replace') as f:
    report = f.read()
# Extract ONLY the digest following 'certificate SHA-256 digest:'.
# 'V3.0 Signer:' contains another colon; splitting on the first ':' is invalid.
digests = set()
for candidate in re.findall(r'certificate\s+SHA[\s-]*256\s+digest\s*:\s*([0-9a-fA-F:]+)', report, flags=re.I):
    digest = candidate.replace(':', '').lower()
    if re.fullmatch(r'[0-9a-f]{64}', digest):
        digests.add(digest)
# Multiple APK signature schemes may legitimately repeat the SAME certificate.
# Different certificates are rejected: never guess which signer to trust.
print(next(iter(digests)) if len(digests) == 1 else '')
PY
)"
printf 'Certificado esperado: %s\n' "$expected"
printf 'Certificado encontrado no APK: %s\n' "${signed_cert:-NAO IDENTIFICADO}"
if [ "$signed_cert" != "$expected" ]; then
  echo 'Linhas de certificado retornadas pelo apksigner:'
  grep -iE 'certificate.*(sha.?256|digest)' "$workspace/verification.txt" | head -n 5 || true
  fail 'Assinatura nao comprovada. Nenhum APK foi publicado. Envie o diagnostico acima.'
fi
hash="$(sha256sum "$signed" | cut -d' ' -f1)"
size="$(wc -c < "$signed" | tr -d '[:space:]')"
tag="pmobile-native-$code"
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  fail "A versao ja foi publicada. Nao sobrescreva um APK OTA assinado."
fi
manifest_sha="$(gh api "repos/$repo/contents/ota/native-manifest.json" --jq .sha)"
gh api "repos/$repo/contents/ota/native-manifest.json" --jq .content | base64 -d \
  > "$workspace/old-manifest.json"
python - "$workspace/old-manifest.json" "$workspace/new-manifest.json" \
  "$repo" "$code" "$version" "$hash" "$size" "$expected" <<'PY'
import json,sys,datetime
old,out,repo,code,version,hashval,size,cert=sys.argv[1:]
data=json.load(open(old))
assert data['schemaVersion']==1 and data['packageName']=='com.pmobile.app'
last=data.get('release')
assert not last or int(last['versionCode'])<int(code), 'OTA nao aceita downgrade nem duplicata'
data['release']={
 'versionCode':int(code), 'versionName':version,
 'url':f'https://github.com/{repo}/releases/download/pmobile-native-{code}/PMOBILE-PRINCIPAL.apk',
 'sha256':hashval, 'signingCertSha256':cert, 'sizeBytes':int(size),
 'publishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'releaseNotes':'Nova versao Android do PMobile pelo OTA.'
}
with open(out,'w') as f:
 json.dump(data,f,indent=2,ensure_ascii=False);f.write('\n')
PY
gh release create "$tag" "$signed#PMOBILE-PRINCIPAL.apk" \
  --repo "$repo" --target "$sha" --title "PMobile Android $version" \
  --notes "APK principal, assinado pela chave original. Instale por cima; nao desinstale o app."
content="$(base64 < "$workspace/new-manifest.json" | tr -d '\n')"
python - "$workspace/update.json" "$manifest_sha" "$content" <<'PY'
import json,sys
with open(sys.argv[1],'w') as f:
 json.dump({'message':'ota: publica APK Android principal assinado',
            'sha':sys.argv[2],'content':sys.argv[3],'branch':'main'},f)
PY
gh api "repos/$repo/contents/ota/native-manifest.json" -X PUT \
  -H 'Accept: application/vnd.github+json' --input "$workspace/update.json" > /dev/null \
  || fail "Release criada, mas atualizacao do manifesto falhou. Corrija o manifesto, sem substituir o APK."
echo "OTA nativo publicado em $tag. A chave privada permaneceu no Termux."
