@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo PEGSA - Actualizar datos y publicar
echo ========================================

echo.
echo [1/4] Ejecutando actualizacion de datos...
python actualizar_datos.py
if errorlevel 1 (
  echo.
  echo ERROR: fallo la actualizacion de datos.
  pause
  exit /b 1
)

echo.
echo [2/4] Agregando cambios a Git...
git add index.html *.json .nojekyll README.md requirements.txt .gitignore 2>nul
git add *.json 2>nul

echo.
echo [3/4] Commit...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Actualizacion automatica %date% %time:~0,8%"
) else (
  echo No hay cambios para publicar.
)

echo.
echo [4/4] Push a GitHub...
git push
if errorlevel 1 (
  echo.
  echo ERROR: no se pudo hacer push.
  pause
  exit /b 1
)

echo.
echo Listo. GitHub Pages publicara los cambios en unos minutos.
pause
