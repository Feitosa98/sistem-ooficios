param(
    [ValidatePattern('^[a-p]{32}$')][string[]]$ExtensionId = @('nfhjmjmoniplgdemofngjapmnlkfpcge')
)
$ErrorActionPreference = 'Stop'

$installDir = Join-Path $env:LOCALAPPDATA 'SistemaOficios/Assinador'
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'OficiosSigner.exe'))) { throw 'Execute este instalador a partir do pacote compilado, junto de OficiosSigner.exe.' }
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'OficiosSigner.exe') -Destination $installDir -Force
$origins = @($ExtensionId | Select-Object -Unique | ForEach-Object { "chrome-extension://$_/" })
$encoding = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllLines((Join-Path $installDir 'allowed-origins.txt'), $origins, $encoding)
$manifest = @{
    name = 'br.com.registromanacapuru.oficios'
    description = 'Assinador local do Sistema de Oficios'
    path = (Join-Path $installDir 'OficiosSigner.exe')
    type = 'stdio'
    allowed_origins = $origins
} | ConvertTo-Json -Depth 4
$manifestPath = Join-Path $installDir 'native-host.json'
[IO.File]::WriteAllText($manifestPath, $manifest, $encoding)
foreach ($browser in @('Google/Chrome', 'Microsoft/Edge')) {
    $registryPath = "HKCU:\Software\$browser\NativeMessagingHosts\br.com.registromanacapuru.oficios"
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -LiteralPath $registryPath -Value $manifestPath
}
Write-Output 'Assinador registrado no Chrome e Edge para este usuario. Recarregue o sistema.'
