@echo off
rem ============================================================
rem  Claves - iniciar o app (duplo clique)
rem  Abre o app no navegador em http://localhost:4173
rem ============================================================
setlocal
cd /d "%~dp0"
title Claves

rem --- encontrar o Node: embutido (pacote portatil), no PATH ou na instalacao local ---
set "NODE=node"
if exist "%~dp0node\node.exe" (
  set "NODE=%~dp0node\node.exe"
  goto :temnode
)
where node >nul 2>nul
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Programs\node-v26.13.1-win-x64\node.exe" (
    set "NODE=%LOCALAPPDATA%\Programs\node-v26.13.1-win-x64\node.exe"
    set "PATH=%LOCALAPPDATA%\Programs\node-v26.13.1-win-x64;%PATH%"
  ) else (
    echo.
    echo  O Node.js nao foi encontrado neste computador.
    echo  Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
  )
)
:temnode

rem --- se o app pronto (pasta dist) nao existir, monta-o a partir do codigo ---
if not exist "dist\index.html" (
  echo  Preparando o app pela primeira vez neste computador. Isso leva 1 a 2 minutos...
  if not exist "node_modules" (
    call npm install --no-audit --no-fund
    if errorlevel 1 goto :falhou
  )
  call npm run build
  if errorlevel 1 goto :falhou
)

echo.
echo  Abrindo o app no navegador...
echo  Pode minimizar esta janela. Para ENCERRAR o app, feche-a.
echo.
"%NODE%" serve.mjs %*
exit /b 0

:falhou
echo.
echo  Nao foi possivel preparar o app (veja a mensagem acima).
echo  Na primeira vez em um computador novo e preciso internet para baixar as dependencias.
echo.
pause
exit /b 1
