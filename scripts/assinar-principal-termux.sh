#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

# Assina a atualizacao do PMobile principal com a chave original do Termux.
# Nao instala, desinstala nem altera dados do PMobile.
repo="KozeiroKodak/pmobiletest"
expected="d73f1b234895f85b8e96321b95000cb18947b7c335e1b949b148e77a095c4a98"
keystore="$HOME/.android/debug.keystore"
workspace="$(mktemp -d "$PREFIX/tmp/pmobile-principal.XXXXXX")"
trap 'rm -rf "$workspace"' EXIT

fail() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
command -v gh >/dev/null || fail 'GitHub CLI ausente: pkg install gh'
command -v java >/dev/null || fail 'Java ausente: pkg install openjdk-17'
command -v keytool >/dev/null || fail 'keytool ausente: pkg install openjdk-17'
gh auth status >/dev/null 2>&1 || fail 'GitHub CLI sem autenticacao: gh auth login'
[ -f "$keystore" ] || fail "Chave de assinatura original ausente: $keystore. Recupere o backup; nao gere outra chave."

if command -v apksigner >/dev/null 2>&1; then
  signer=(apksigner)
elif [ -f "$PREFIX/share/java/apksigner.jar" ]; then
  signer=(java -jar "$PREFIX/share/java/apksigner.jar")
else
  fail 'apksigner ausente no Termux. Instale as ferramentas Android de assinatura.'
fi

cert="$(keytool -list -v -keystore "$keystore" -storepass android -alias androiddebugkey 2>/dev/null \
  | sed -nE 's/^[[:space:]]*SHA256:[[:space:]]*//p' | head -n1 | tr -d '[:space:]:' | tr '[:upper:]' '[:lower:]')"
[ "$cert" = "$expected" ] || fail "Chave de assinatura divergente: $cert. Nao e seguro instalar sobre o PMobile."

if [ "$#" -gt 0 ]; then
  run_id="$1"
else
  run_id="$(gh run list --repo "$repo" --workflow android-main-build.yml --status success --limit 10 \
    --json databaseId --jq '.[0].databaseId // empty')"
fi
[[ "$run_id" =~ ^[0-9]+$ ]] || fail 'Nao ha build principal aprovado para download.'

printf 'Baixando build principal %s...\n' "$run_id"
gh run download "$run_id" --repo "$repo" --name pmobile-principal-unsigned --dir "$workspace"
unsigned="$workspace/app-release-unsigned.apk"
[ -s "$unsigned" ] || fail 'Arquivo app-release-unsigned.apk ausente.'

output="$workspace/PMOBILE-PRINCIPAL.apk"
"${signer[@]}" sign --v4-signing-enabled false --ks "$keystore" \
  --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android \
  --out "$output" "$unsigned"

"${signer[@]}" verify --print-certs "$output" > "$workspace/verification.txt" \
  || fail 'APK nao passou na verificacao da assinatura.'
verified="$(sed -nE 's/^Signer #1 certificate SHA-256 digest:[[:space:]]*//p' "$workspace/verification.txt" \
  | head -n1 | tr -d '[:space:]:' | tr '[:upper:]' '[:lower:]')"
[ "$verified" = "$expected" ] || fail 'APK assinado com certificado inesperado; copias bloqueadas.'

destination="$HOME/storage/downloads/Projetos/PMobile"
mkdir -p "$destination" || fail 'Ative o acesso aos Downloads com termux-setup-storage.'
cp "$output" "$destination/PMOBILE-PRINCIPAL.apk"

printf '\nAPK assinado e pronto para atualizar o aplicativo principal:\n%s\n' "$destination/PMOBILE-PRINCIPAL.apk"
printf 'Nao houve instalacao, desinstalacao ou limpeza de dados.\n'
