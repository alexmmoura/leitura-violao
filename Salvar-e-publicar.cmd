@echo off
rem ============================================================
rem  Salva uma nova versao do app e envia ao GitHub (duplo clique).
rem  1. roda os testes  2. monta o app  3. registra a versao  4. envia
rem  Se os testes falharem, nada e salvo nem enviado.
rem ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Leitura no Violao - salvar e publicar

set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%ProgramFiles%\Git\cmd;%LOCALAPPDATA%\Programs\node-v26.13.1-win-x64;%PATH%"
where git >nul 2>nul || (echo Git nao encontrado. Instale em https://git-scm.com & pause & exit /b 1)
where node >nul 2>nul || (echo Node.js nao encontrado. & pause & exit /b 1)

if not exist "node_modules" (
  echo Baixando dependencias...
  call npm install --no-audit --no-fund || goto :falhou
)

echo.
echo [1/4] Rodando os testes...
call npm test
if errorlevel 1 (
  echo.
  echo  OS TESTES FALHARAM. Nada foi salvo nem enviado.
  pause
  exit /b 1
)

echo.
echo [2/4] Montando o app...
call npm run build || goto :falhou

echo.
echo [3/4] Registrando a versao...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  set "MSG="
  set /p "MSG=Descreva em poucas palavras o que mudou (Enter = so a data): "
  if not defined MSG set "MSG=Atualizacao de !DATE!"
  git commit -q -m "!MSG!" || goto :falhou
  echo  Versao registrada.
) else (
  echo  Nada mudou desde a ultima versao.
)

echo.
echo [4/4] Enviando ao GitHub...
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo  Este projeto ainda nao esta ligado a um repositorio do GitHub.
  echo  Crie um repositorio VAZIO em https://github.com/new e cole aqui o endereco
  echo  ^(ex.: https://github.com/seu-usuario/leitura-violao.git^).
  set "URL="
  set /p "URL=Endereco do repositorio: "
  if not defined URL (echo  Sem endereco: a versao ficou salva so neste computador. & pause & exit /b 0)
  git remote add origin "!URL!" || goto :falhou
)
git push -u origin main
if errorlevel 1 goto :falhou

echo.
echo  Pronto. Em 1 a 2 minutos o GitHub testa e publica o app.
echo  Na primeira vez: no repositorio, Settings - Pages - Source = "GitHub Actions".
pause
exit /b 0

:falhou
echo.
echo  Algo falhou (veja a mensagem acima). Nada foi perdido: os arquivos continuam aqui.
pause
exit /b 1
