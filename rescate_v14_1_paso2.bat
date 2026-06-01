@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Rescate v14.1 - Paso 2 (push)
echo ========================================

echo.
echo [1/4] Stash de cambios sin commitear (JSONs del bot)...
git stash push -u -m "rescate-v14.1-tmp-stash"
if errorlevel 1 (
  echo No habia nada para stashear. Sigo.
)

echo.
echo [2/4] Fetch + rebase contra origin/main...
git fetch origin
git rebase origin/main
if errorlevel 1 (
  echo ERROR: hubo conflicto en rebase. Abriendo git status para inspeccionar.
  git status
  echo.
  echo Para abortar el rebase: git rebase --abort
  pause
  exit /b 1
)

echo.
echo [3/4] Push a GitHub...
git push
if errorlevel 1 (
  echo ERROR: no se pudo hacer push.
  pause
  exit /b 1
)

echo.
echo [4/4] Restaurando los cambios stasheados (JSONs del bot)...
git stash pop
if errorlevel 1 (
  echo ATENCION: el stash pop dio conflicto. Reviza con: git status
  pause
  exit /b 1
)

echo.
echo Ultimos 5 commits:
git log --oneline -5

echo.
echo ========================================
echo LISTO. v14.1 deberia estar en GitHub.
echo Hard refresh en el portal (Ctrl+Shift+R)
echo ========================================
pause
