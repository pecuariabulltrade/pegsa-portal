@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ========================================
echo Rescate v14.1 + sync a OneDrive
echo ========================================

set "ONE=C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal"

echo.
echo [1/6] Reparando index de Git corrupto...
if exist ".git\index.lock" del /F /Q ".git\index.lock"
if exist ".git\index" del /F /Q ".git\index"
git reset HEAD >nul 2>&1
git checkout HEAD -- js/modulo-05-mercado.js js/modulo-07-simulador.js index.html
if errorlevel 1 (
  echo ERROR: no pude restaurar archivos desde HEAD
  pause
  exit /b 1
)

echo.
echo [2/6] Verificando que v14.1 esta en working tree...
findstr /C:"_indiferenciaCostoCardsHTML" js\modulo-05-mercado.js >nul
if errorlevel 1 (
  echo ERROR: v14.1 NO esta en modulo-05. Algo salio mal.
  pause
  exit /b 1
)
echo OK: v14.1 presente en modulo-05-mercado.js
findstr /C:"SIM_LAST_RESULTS" js\modulo-07-simulador.js >nul
if errorlevel 1 (
  echo ERROR: v14.1 NO esta en modulo-07.
  pause
  exit /b 1
)
echo OK: v14.1 presente en modulo-07-simulador.js

echo.
echo [3/6] Copiando los 3 archivos a OneDrive para que el bot no los pise...
if not exist "%ONE%" (
  echo ERROR: no encuentro carpeta OneDrive en "%ONE%"
  echo No copio archivos. Hacelo a mano si la ruta es otra.
) else (
  if not exist "%ONE%\js" mkdir "%ONE%\js"
  copy /Y "js\modulo-05-mercado.js" "%ONE%\js\modulo-05-mercado.js" >nul
  copy /Y "js\modulo-07-simulador.js" "%ONE%\js\modulo-07-simulador.js" >nul
  copy /Y "index.html" "%ONE%\index.html" >nul
  echo OK: copiado a OneDrive
)

echo.
echo [4/6] Sincronizando con remoto (rebase)...
git fetch origin
git rebase origin/main
if errorlevel 1 (
  echo ATENCION: hubo conflicto en rebase. Resolvelo a mano y volve a correr push.
  pause
  exit /b 1
)

echo.
echo [5/6] Push a GitHub...
git push
if errorlevel 1 (
  echo ERROR: no se pudo hacer push
  pause
  exit /b 1
)

echo.
echo [6/6] Mostrando ultimos 5 commits...
git log --oneline -5

echo.
echo ========================================
echo LISTO. v14.1 publicado + OneDrive en sync
echo Hard refresh en el navegador (Ctrl+Shift+R)
echo ========================================
pause
