@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "ORIGEN=%SCRIPT_DIR%"
set "CONFIG_REPO=%SCRIPT_DIR%\repo_github_path.txt"
set "LOG_DIR=%SCRIPT_DIR%\logs"
set "STATUS_FILE=%SCRIPT_DIR%\ultimo_auto_estado.txt"
set "LOCK_FILE=%SCRIPT_DIR%\actualizacion_auto.lock"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "TS=%%i"
set "LOG_FILE=%LOG_DIR%\auto_%TS%.log"

if exist "%LOCK_FILE%" (
    rem Calcular edad en minutos como entero (floor) para evitar el bug con decimales de PowerShell
    for /f %%i in ('powershell -NoProfile -Command "[int]([Math]::Floor((Get-Date) - (Get-Item '%LOCK_FILE%').LastWriteTime).TotalMinutes)"') do set /a AGE=%%i
    if !AGE! GTR 120 (
        del "%LOCK_FILE%" >nul 2>&1
    ) else (
        >"%STATUS_FILE%" echo ERROR: lock activo %date% %time%
        exit /b 1
    )
)

echo iniciado %date% %time% > "%LOCK_FILE%"

set "REPO="
if exist "%CONFIG_REPO%" set /p REPO=<"%CONFIG_REPO%"

if not exist "%REPO%" (
    >"%STATUS_FILE%" echo ERROR: repo no encontrado %date% %time%
    if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
    exit /b 1
)

if not exist "%REPO%\.git" (
    >"%STATUS_FILE%" echo ERROR: repo sin .git %date% %time%
    if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
    exit /b 1
)

rem Buscar Python 3.11 especificamente
set PYTHON=
if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" (
    set PYTHON=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe
)
if "%PYTHON%"=="" if exist "C:\Python311\python.exe" set PYTHON=C:\Python311\python.exe
if "%PYTHON%"=="" (
    python --version >nul 2>&1
    if not errorlevel 1 set PYTHON=python
)
if "%PYTHON%"=="" (
    py --version >nul 2>&1
    if not errorlevel 1 set PYTHON=py
)
if "%PYTHON%"=="" (
    >"%STATUS_FILE%" echo ERROR: Python no encontrado %date% %time%
    if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
    exit /b 1
)

rem Ejecutar pipeline de datos â capturar stderr para diagnostico
set "ERR_LOG=%LOG_DIR%\python_error_%TS%.log"
echo Python: %PYTHON% > "%ERR_LOG%"
echo Script: %ORIGEN%\actualizar_datos.py >> "%ERR_LOG%"
echo. >> "%ERR_LOG%"
cmd /c echo.| "%PYTHON%" "%ORIGEN%\actualizar_datos.py" 2>>"%ERR_LOG%"
if errorlevel 1 (
    >"%STATUS_FILE%" echo ERROR: python fallo â ver %ERR_LOG% â %date% %time%
    if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
    exit /b 1
)

rem Copiar JSONs al repo
for %%F in ("%ORIGEN%\*.json") do (
    copy /Y "%%~fF" "%REPO%\%%~nxF" >nul
)

rem Copiar index.html si existe version actualizada en ORIGEN
if exist "%ORIGEN%\index.html" (
    copy /Y "%ORIGEN%\index.html" "%REPO%\index.html" >nul
)

rem Git: commit si hay cambios, y SIEMPRE hacer push (puede haber commits pendientes)
cd /d "%REPO%"
git add .

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Actualizacion automatica %date% %time%"
    if errorlevel 1 (
        >"%STATUS_FILE%" echo ERROR: git commit fallo %date% %time%
        if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
        exit /b 1
    )
)

rem Sincronizar con remoto antes de pushear (maneja commits que se hayan hecho en GitHub directamente)
git fetch origin >nul 2>&1
git rebase origin/main >nul 2>&1

rem SIEMPRE pushear â puede haber commits previos pendientes
git push
if errorlevel 1 (
    >"%STATUS_FILE%" echo ERROR: git push fallo %date% %time%
    if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
    exit /b 1
)

>"%STATUS_FILE%" echo OK: publicado %date% %time%
if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
exit /b 0
