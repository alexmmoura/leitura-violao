# Gera o pacote portátil do app (para usar em outro PC sem instalar nada):
#   Documentos\LeituraNoViolao-portatil.zip
# Contém o app pronto (dist), o servidor local, o iniciador e o Node.js embutido.
# Rode depois de "npm run build" sempre que o app mudar:
#   powershell -ExecutionPolicy Bypass -File .\Gerar-pacote-portatil.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$nodeDir = Join-Path $env:LOCALAPPDATA 'Programs\node-v26.13.1-win-x64'
$out = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'LeituraNoViolao-portatil.zip'
$stage = Join-Path $env:TEMP 'LeituraNoViolao-pacote'
$app = Join-Path $stage 'LeituraNoViolao'

if (-not (Test-Path (Join-Path $root 'dist\index.html'))) { throw 'Falta a pasta dist. Rode "npm run build" antes.' }
if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) { throw "Node.js não encontrado em $nodeDir." }

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force (Join-Path $app 'node') | Out-Null
Copy-Item (Join-Path $root 'dist') (Join-Path $app 'dist') -Recurse
Copy-Item (Join-Path $root 'serve.mjs'), (Join-Path $root 'Iniciar.cmd'), (Join-Path $root 'Iniciar-para-celular.cmd') $app
Copy-Item (Join-Path $root 'LEIA-ME (pacote portatil).txt') (Join-Path $app 'LEIA-ME.txt')
Copy-Item (Join-Path $nodeDir 'node.exe'), (Join-Path $nodeDir 'LICENSE') (Join-Path $app 'node')

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path $app -DestinationPath $out -CompressionLevel Optimal
Remove-Item $stage -Recurse -Force
$mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Output "Pacote gerado: $out ($mb MB)"

# Pasta do app para hospedar (uso no celular): só o conteúdo de dist
$zipCel = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'LeituraNoViolao-para-celular.zip'
if (Test-Path $zipCel) { Remove-Item $zipCel -Force }
Compress-Archive -Path (Join-Path $root 'dist\*') -DestinationPath $zipCel
Write-Output "Pacote para celular: $zipCel"
