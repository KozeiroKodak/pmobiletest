param(
    [Parameter(Mandatory=$true)][string]$Dispositivo,
    [string]$AndroidSdk=$env:ANDROID_HOME
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$appId=(Get-Content (Join-Path $root 'capacitor.config.json') -Raw | ConvertFrom-Json).appId
if($appId -notmatch '^com\.(pmobile|pmromaneios|pmentregas)\.app$'){throw 'Identidade do aplicativo invalida'}
$metadataPath=Join-Path $root 'android\app\build\outputs\apk\debug\output-metadata.json'
$metadata=Get-Content $metadataPath -Raw | ConvertFrom-Json
if($metadata.applicationId -ne $appId){throw 'Compile o APK principal, sem -PotaPreview, antes de assinar'}
$apk=Join-Path (Split-Path $metadataPath) $metadata.elements[0].outputFile
$adb=Join-Path $AndroidSdk 'platform-tools\adb.exe'
$buildTools=Get-ChildItem (Join-Path $AndroidSdk 'build-tools') -Directory | Sort-Object Name -Descending | Where-Object {Test-Path (Join-Path $_.FullName 'apksigner.bat')} | Select-Object -First 1
if(!$buildTools){throw 'Android Build Tools indisponiveis'}
$apksigner=Join-Path $buildTools.FullName 'apksigner.bat'
$expected='d73f1b234895f85b8e96321b95000cb18947b7c335e1b949b148e77a095c4a98'
$remoteInput='/data/local/tmp/'+$appId+'-unsigned.apk'
$remoteOutput='/data/data/com.termux/cache/pmobile-signing/'+$appId+'.apk'
& $adb -s $Dispositivo push $apk $remoteInput
if($LASTEXITCODE -ne 0){throw 'Falha ao enviar APK'}
& $adb -s $Dispositivo shell 'run-as com.termux mkdir -p /data/data/com.termux/cache/pmobile-signing'
if($LASTEXITCODE -ne 0){throw 'Termux indisponivel'}
# Standard Android debug key: the private key remains in Termux.
$command='run-as com.termux /data/data/com.termux/files/usr/bin/java -jar /data/data/com.termux/files/usr/share/java/apksigner.jar sign --v4-signing-enabled false --ks /data/data/com.termux/files/home/.android/debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out '+$remoteOutput+' '+$remoteInput
& $adb -s $Dispositivo shell $command
if($LASTEXITCODE -ne 0){throw 'Falha na assinatura'}
$destinationDir=Join-Path $root 'build\signed'
New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
$destination=Join-Path $destinationDir ($appId+'.apk')
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName=$adb
$info.Arguments='-s '+$Dispositivo+' exec-out run-as com.termux cat '+$remoteOutput
$info.UseShellExecute=$false
$info.RedirectStandardOutput=$true
$info.CreateNoWindow=$true
$transfer=[Diagnostics.Process]::Start($info)
$stream=[IO.File]::Create($destination+'.tmp')
try{$transfer.StandardOutput.BaseStream.CopyTo($stream)}finally{$stream.Dispose()}
$transfer.WaitForExit()
if($transfer.ExitCode -ne 0){throw 'Falha ao receber APK'}
$verification=& $apksigner verify --print-certs ($destination+'.tmp')
if($LASTEXITCODE -ne 0 -or ($verification -join "`n") -notmatch $expected){throw 'Certificado divergente: arquivo nao aprovado'}
Move-Item -LiteralPath ($destination+'.tmp') -Destination $destination -Force
Write-Output ('APK com assinatura padrao validada: '+$destination)
