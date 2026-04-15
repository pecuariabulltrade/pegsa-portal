@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ORIGEN_ONEDRIVE=%USERPROFILE%\OneDrive - pecuaria el garabi sa\PEGSA_Portal\datos"
set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

if not exist "%ORIGEN_ONEDRIVE%\actualizar_datos.py" exit /b 1

python "%ORIGEN_ONEDRIVE%\actualizar_datos.py"
if errorlevel 1 exit /b 1

copy /Y "%ORIGEN_ONEDRIVE%\*.json" "%REPO%\" >nul
if errorlevel 1 exit /b 1

cd /d "%REPO%"
git add *.json index.html .nojekyll .gitignore >nul 2>&1

git diff --cached --quiet
if not errorlevel 1 goto :commit_changes

git diff --quiet -- *.json index.html .nojekyll .gitignore
if errorlevel 1 (
  git add -A >nul 2>&1
  goto :commit_changes
)

exit /b 0

:commit_changes
git commit -m "Actualizacion automatica %date% %time%"
if errorlevel 1 exit /b 1

git push
exit /b %errorlevel%
