@echo off
chcp 65001 >nul
title Instalar o Claves
echo.
echo  Instalando o Claves neste computador...
echo  (cria o atalho "Claves" no menu Iniciar e na Area de Trabalho)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = 'https://alexmmoura.github.io/leitura-violao/';" ^
  "$cands = @(\"$env:ProgramFiles\Google\Chrome\Application\chrome.exe\", \"${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe\", \"$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe\", \"${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe\", \"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe\");" ^
  "$exe = $cands | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "if (-not $exe) { Write-Host ' Nao achei o Chrome nem o Edge neste PC.'; exit 1 }" ^
  "$sh = New-Object -ComObject WScript.Shell;" ^
  "$desk = [Environment]::GetFolderPath('Desktop');" ^
  "$menu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs';" ^
  "foreach ($dir in @($desk, $menu)) { $l = $sh.CreateShortcut((Join-Path $dir 'Claves.lnk')); $l.TargetPath = $exe; $l.Arguments = \"--app=$url\"; $l.Description = 'Claves - leitura de partitura no violao'; $l.IconLocation = \"$exe,0\"; $l.Save() }" ^
  "Write-Host ' Pronto! Abrindo o Claves...';" ^
  "Start-Process $exe \"--app=$url\""
echo.
echo  Dica: com o Claves aberto, clique com o botao direito no icone dele na
echo  barra de tarefas e escolha "Fixar na barra de tarefas".
echo.
pause
