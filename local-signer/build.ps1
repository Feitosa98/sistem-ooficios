$ErrorActionPreference = 'Stop'
$outputDir = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'Instale o .NET Framework 4.8 para compilar o assinador.' }
& $compiler /nologo /target:exe /platform:anycpu /optimize+ "/out:$outputDir/OficiosSigner.exe" /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'native/Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o assinador.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'extension') -Destination $outputDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install.ps1'), (Join-Path $PSScriptRoot 'uninstall.ps1'), (Join-Path $PSScriptRoot 'instalar.bat'), (Join-Path $PSScriptRoot 'desinstalar.bat'), (Join-Path $PSScriptRoot 'LEIA-ME.md') -Destination $outputDir -Force
$packageFiles = @('OficiosSigner.exe', 'extension', 'install.ps1', 'uninstall.ps1', 'instalar.bat', 'desinstalar.bat', 'LEIA-ME.md') | ForEach-Object { Join-Path $outputDir $_ }
$projectDir = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $projectDir 'public/assinador-local.zip'
Compress-Archive -LiteralPath $packageFiles -DestinationPath $archive -Force
Copy-Item -LiteralPath $archive -Destination (Join-Path $projectDir 'hostinger/public/assinador-local.zip') -Force
Write-Output "Pacote compilado em $outputDir"
Write-Output "Download atualizado em $archive"
