$ErrorActionPreference = 'Stop'
$outputDir = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe /main:Tests "/out:$outputDir/NativeTests.exe" /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'native/Program.cs') (Join-Path $PSScriptRoot 'native/Tests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar os testes.' }
& (Join-Path $outputDir 'NativeTests.exe')
if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes do assinador.' }
