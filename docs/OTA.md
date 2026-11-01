# Central de atualizações PMobile

A interface fica nos arquivos principais `index.html`, `script.js` e `implementacoes/configuracoes.css`, espelhados em `www/`. O mecanismo Android permanece nos arquivos `MainActivity`, `OtaManager`, `OtaManifest` e `OtaPackageDownloader` existentes.

## Fluxo

1. Verificar a versão compatível com o APK instalado.
2. Baixar sem bloquear a navegação do aplicativo.
3. Conferir SHA-256 e estrutura do pacote em staging.
4. Manter a atualização pronta, inclusive após fechar e reabrir o aplicativo.
5. Reiniciar somente pela ação **Reiniciar e aplicar**.
6. Carregar a versão candidata e aguardar a confirmação do JavaScript após a primeira pintura e a presença dos módulos essenciais.
7. Aprovar a candidata, preservando a versão anterior. Se a confirmação não chegar em 60 segundos, ou o processo encerrar antes dela, recuperar a anterior ou o conteúdo embutido no APK.

O mecanismo não limpa IndexedDB, sessão, inventário, filas ou registros Supabase. A limpeza é restrita às pastas de versões OTA e staging do próprio aplicativo.

## Compatibilidade

O painel completo exige APK 1.03. APKs anteriores continuam conseguindo procurar atualizações pela ponte antiga, mas suas capacidades nativas não mudam por OTA. O painel informa essa diferença.

O manifesto mantém os campos antigos e admite `sizeBytes`, `publishedAt` e `releaseNotes`. O conteúdo de `ota/release-notes.md` acompanha o manifesto e o release. Atualize as notas a cada publicação significativa.

A publicação executa a regressão JavaScript antes de empacotar e exclui arquivos de testes e documentação do ZIP OTA. O checksum é calculado sobre o ZIP final.

## Testes e compilação

```powershell
node --test tests/*.test.cjs
npx cap sync android
cd android
.\gradlew.bat testDebugUnitTest assembleDebug
```

Para validar no celular sem substituir o PMobile instalado:

```powershell
.\gradlew.bat -PotaPreview :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest
```

Esse modo usa `com.pmobile.preview`, com nome **PMobile · Teste OTA**. A compilação normal continua usando `com.pmobile.app`. Os testes instrumentados usam diretórios e preferências isolados no cache da aplicação de teste.

Nunca desinstale o aplicativo em uso para contornar uma divergência de assinatura. Uma atualização por APK deve usar a mesma chave de assinatura da instalação anterior. A cópia de teste não migra dados locais nem copia credenciais da instalação original.

A prévia local de estados é gerada por `node tests/build-ota.cjs`; ela usa dados simulados e não instala atualizações.
