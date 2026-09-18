$ErrorActionPreference = 'Stop'
foreach ($browser in @('Google/Chrome', 'Microsoft/Edge')) {
    $registryPath = "HKCU:\Software\$browser\NativeMessagingHosts\br.com.registromanacapuru.oficios"
    if (Test-Path -LiteralPath $registryPath) { Remove-Item -LiteralPath $registryPath }
}
# Remove only the three files installed by this package; never recurse over a computed directory.
$installDir = Join-Path $env:LOCALAPPDATA 'SistemaOficios/Assinador'
foreach ($name in @('OficiosSigner.exe', 'allowed-origins.txt', 'native-host.json')) {
    $file = Join-Path $installDir $name
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
}
Write-Output 'Registro e componente removidos. Remova a extensao nas configuracoes do navegador.'
