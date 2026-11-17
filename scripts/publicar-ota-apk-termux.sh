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
[ "$sha" = "$head" ] || fail "Build anterior a main atual; compile a versao mais nova."
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
  apksigner verify --print-certs "$signed" > "$workspace/verification.txt"
elif [ -f "$PREFIX/share/java/apksigner.jar" ]; then
  java -jar "$PREFIX/share/java/apksigner.jar" sign --v4-signing-enabled false \
    --ks "$keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android \
    --out "$signed" "$unsigned"
  java -jar "$PREFIX/share/java/apksigner.jar" verify --print-certs "$signed" > "$workspace/verification.txt"
else
  fail "apksigner nao encontrado. Nao envie APK sem assinatura."
fi
signed_cert="$(sed -nE 's/^Signer #1 certificate SHA-256 digest:[[:space:]]*//p' \
  "$workspace/verification.txt" | head -n1 | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
[ "$signed_cert" = "$expected" ] || fail "O APK nao foi assinado pela chave aprovada."
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
