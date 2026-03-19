@echo off
setlocal EnableExtensions EnableDelayedExpansion
title PEGSA - Actualizacion manual GitHub Pages

set "SITE_URL=https://pecuariabulltrade.github.io/pegsa-portal/"
set "ORIGEN_ONEDRIVE=%USERPROFILE%\OneDrive - pecuaria el garabi sa\PEGSA_Portal\datos"
set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

echo ==========================================
echo   PEGSA - Actualizacion manual del portal
echo ==========================================
echo.

if not exist "%ORIGEN_ONEDRIVE%\actualizar_datos.py" (
  echo ERROR: no encontre actualizar_datos.py en:
  echo %ORIGEN_ONEDRIVE%
  echo.
  pause
  exit /b 1
)

echo [1/5] Actualizando JSON en OneDrive...
python "%ORIGEN_ONEDRIVE%\actualizar_datos.py"
if errorlevel 1 (
  echo.
  echo ERROR en actualizar_datos.py
  pause
  exit /b 1
)

echo.
echo [2/5] Copiando JSON desde OneDrive al repo...
copy /Y "%ORIGEN_ONEDRIVE%\*.json" "%REPO%\" >nul
if errorlevel 1 (
  echo ERROR copiando JSON al repo.
  pause
  exit /b 1
)

echo.
echo [3/5] Preparando commit...
cd /d "%REPO%"
git add *.json index.html .nojekyll .gitignore >nul 2>&1

git diff --cached --quiet
if not errorlevel 1 goto :commit_changes

git diff --quiet -- *.json index.html .nojekyll .gitignore
if errorlevel 1 (
  git add -A >nul 2>&1
  goto :commit_changes
)

echo No hay cambios para publicar.
echo.
start "" "%SITE_URL%"
pause
exit /b 0

:commit_changes
echo [4/5] Commit...
git commit -m "Actualizacion portal %date% %time%"
if errorlevel 1 (
  echo ERROR creando commit.
  pause
  exit /b 1
)

echo.
echo [5/5] Push a GitHub...
git push
if errorlevel 1 (
  echo ERROR haciendo push.
  pause
  exit /b 1
)

echo.
echo Portal publicado. Abriendo sitio...
start "" "%SITE_URL%"
echo.
pause
exit /b 0
