# PMobile — OTA único para Web e APK Android

## Objetivo
Todas as atualizações chegam pela Central de Atualizações do PMobile. Dois
artefatos são mantidos separadamente para evitar corromper uma instalação:

- Web OTA existente: ota/manifest.json, pacote ZIP ota-web-*, rollback da WebView.
- Android OTA: ota/native-manifest.json, APK principal assinado em GitHub Release
  pmobile-native-VERSIONCODE. Nunca distribui APK de teste (com.pmobile.preview).

## Canal APK, segurança e implantação
1. O workflow android-main-build.yml compila com.pmobile.app SEM assinatura.
2. O responsável assina o APK no próprio Termux com a chave original, sem colocá-la
   em Secrets, GitHub, Actions ou ZIP de OTA:
   bash scripts/publicar-ota-apk-termux.sh ID_DO_WORKFLOW
3. O script verifica SHA-256 do certificado, versão e packageId dos metadados
   aprovados pelo workflow e publica PMOBILE-PRINCIPAL.apk em um GitHub Release.
4. O script atualiza ota/native-manifest.json com versão, URL, tamanho,
   checksum e fingerprint, apenas APOS o release assinado existir.
5. A Central detecta versão superior à instalada. O novo APK busca o arquivo,
   confere tamanho, SHA-256, packageId, versionCode e certificado, inclusive
   comparando ao certificado efetivamente instalado.
6. Ao tocar em Instalar atualização Android, o PMobile entrega o arquivo ao
   instalador Android através do FileProvider. O USUÁRIO CONFIRMA no sistema.
   Não é instalação silenciosa; nenhuma etapa desinstala o PMobile ou apaga dados.

## Primeira migração (bootstrap)
APKs antigos, por definição, ainda não possuem o código Java do instalador nativo.
A camada Web, distribuída pelo OTA já existente, mostra a nova versão Android
e um link para obter o APK assinado assim que existir um release publicado.
É necessário abrir o pacote e confirmar a atualização do sistema nesta primeira
migração. Depois disso o APK atualizado passa a ter download integrado e botão
para instalação na própria Central.

Se o Android bloquear fontes desconhecidas, o usuário poderá autorizar a instalação
a partir do PMobile na tela de configurações do sistema. Não remover o aplicativo
anterior e não criar outra chave de assinatura para contornar erros.

## Estado de publicação
Enquanto ota/native-manifest.json tiver release: null, NÃO HÁ versão
nativa publicada no OTA. Um build pmobile-principal-unsigned no Actions é apenas
um insumo para assinatura, não um APK OTA disponível. Não atualizar a versão nativa
no manifesto sem primeiro publicar e validar o APK assinado.

## Cuidados
- A chave existente no Termux é indispensável para continuidade dos dados.
- O instalador Android exige confirmação; o app não tem instalação silenciosa.
  A permissão REQUEST_INSTALL_PACKAGES tem restrições no Google Play; este fluxo
  pressupõe distribuição privada fora da Play Store.
- O pipeline OTA web existente e seus dados/rollback não são modificados.
- Uma atualização APK só pode ser validada por completo no dispositivo Android
  com a assinatura que estiver de fato instalada; CI verde não substitui esse teste.
