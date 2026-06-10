@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "ORIGEN=%SCRIPT_DIR%"
set "CONFIG_REPO=%SCRIPT_DIR%\repo_github_path.txt"
set "LOG_DIR=%SCRIPT_DIR%\logs"
set "STATUS_FILE=%SCRIPT_DIR%\ultimo_auto_estado.txt"
set "LOCK_FILE=%SCRIPT_DIR%\actualizacion_auto.lock"
set "RC=0"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "TS=%%i"
set "LOG_FILE=%LOG_DIR%\auto_%TS%.log"

rem ============================================================================
rem  Lock check + auto-sanacion agresiva (Sprint 6 — fix del lock huerfano)
rem ============================================================================
rem  Antes: usaba (Get-Item).LastWriteTime; OneDrive sync toca el mtime sin
rem  cambiar contenido → el lock parecia "fresco" indefinidamente. Ahora se
rem  usa timestamp INTERNO (yyyyMMddHHmmss) leido del contenido del lock.
rem
rem  Auto-sanacion: si edad > 30 min Y no hay python.exe corriendo
rem  actualizar_datos, el lock es huerfano y se borra. Si no se puede
rem  chequear el proceso (PYCOUNT vacio), se MANTIENE el lock por seguridad
rem  (fallback conservador para no matar locks en uso).
if exist "%LOCK_FILE%" (
    set "LOCK_TS="
    for /f "usebackq tokens=*" %%i in ("%LOCK_FILE%") do if not defined LOCK_TS set "LOCK_TS=%%i"
    set /a AGE=999
    if defined LOCK_TS (
        for /f %%a in ('powershell -NoProfile -Command "try { $ts=[datetime]::ParseExact('!LOCK_TS!','yyyyMMddHHmmss',[System.Globalization.CultureInfo]::InvariantCulture); [int]([Math]::Floor(((Get-Date) - $ts).TotalMinutes)) } catch { 999 }"') do set /a AGE=%%a
    )
    if !AGE! GTR 30 (
        set "PYCOUNT="
        for /f %%p in ('powershell -NoProfile -Command "@(Get-Process -Name python -ErrorAction SilentlyContinue).Count"') do set "PYCOUNT=%%p"
        if "!PYCOUNT!"=="0" (
            rem Huerfano confirmado: edad > 30 min y sin python activo
            del "%LOCK_FILE%" >nul 2>&1
        ) else (
            rem Hay python.exe corriendo, o no se pudo chequear → no borrar
            >"%STATUS_FILE%" echo ERROR: lock activo [python vivo o check fallo] %date% %time%  age=!AGE!min pycount=!PYCOUNT!
            set "RC=1"
            goto :cleanup_and_exit_no_del
        )
    ) else (
        rem Lock reciente, probablemente del run anterior aun corriendo
        >"%STATUS_FILE%" echo ERROR: lock reciente %date% %time%  age=!AGE!min
        set "RC=1"
        goto :cleanup_and_exit_no_del
    )
)

rem Crear lock nuevo con timestamp interno
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMddHHmmss"') do set "LOCK_NOW=%%t"
> "%LOCK_FILE%" echo %LOCK_NOW%

rem ============================================================================
rem  Validacion de configuracion
rem ============================================================================
set "REPO="
if exist "%CONFIG_REPO%" set /p REPO=<"%CONFIG_REPO%"

if not exist "%REPO%" (
    >"%STATUS_FILE%" echo ERROR: repo no encontrado %date% %time%
    set "RC=1"
    goto :cleanup_and_exit
)

if not exist "%REPO%\.git" (
    >"%STATUS_FILE%" echo ERROR: repo sin .git %date% %time%
    set "RC=1"
    goto :cleanup_and_exit
)

rem ============================================================================
rem  Deteccion de Python (3.14 preferido, luego 3.12, 3.11, fallback)
rem ============================================================================
set PYTHON=
if exist "C:\Users\%USERNAME%\AppData\Local\Python\bin\python.exe" set PYTHON=C:\Users\%USERNAME%\AppData\Local\Python\bin\python.exe
if "%PYTHON%"=="" if exist "C:\Program Files\Python311\python.exe" set PYTHON=C:\Program Files\Python311\python.exe
if "%PYTHON%"=="" if exist "C:\Program Files\Python312\python.exe" set PYTHON=C:\Program Files\Python312\python.exe
if "%PYTHON%"=="" if exist "C:\Python311\python.exe" set PYTHON=C:\Python311\python.exe
if "%PYTHON%"=="" if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" (
    set PYTHON=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe
)
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
    set "RC=1"
    goto :cleanup_and_exit
)

rem ============================================================================
rem  Pre-check de sintaxis (v15.17): abortar si actualizar_datos.py esta
rem  truncado/roto ANTES de correr el pipeline. El 2026-06-07 el archivo quedo
rem  truncado en disco y el bot solo seguia por un .pyc cacheado; este check
rem  detecta el problema temprano con un estado claro en vez de caos silencioso.
rem ============================================================================
"%PYTHON%" -c "import ast; ast.parse(open(r'%ORIGEN%\actualizar_datos.py', encoding='utf-8').read())" >nul 2>&1
if errorlevel 1 (
    >"%STATUS_FILE%" echo ERROR: actualizar_datos.py NO parsea [truncado/roto] %date% %time%
    set "RC=1"
    goto :cleanup_and_exit
)

rem ============================================================================
rem  Pipeline de datos (Python hace su propio commit+push internamente)
rem ============================================================================
set "ERR_LOG=%LOG_DIR%\python_error_%TS%.log"
echo Python: %PYTHON% > "%ERR_LOG%"
echo Script: %ORIGEN%\actualizar_datos.py >> "%ERR_LOG%"
echo. >> "%ERR_LOG%"
cmd /c echo.| "%PYTHON%" "%ORIGEN%\actualizar_datos.py" 2>>"%ERR_LOG%"
if errorlevel 1 (
    >"%STATUS_FILE%" echo ERROR: python fallo — ver %ERR_LOG% — %date% %time%
    set "RC=1"
    goto :cleanup_and_exit
)

rem ============================================================================
rem  Copy JSONs (Python ya los genero en ORIGEN)
rem ============================================================================
for %%F in ("%ORIGEN%\*.json") do (
    copy /Y "%%~fF" "%REPO%\%%~nxF" >nul
)

rem ============================================================================
rem  Copy archivos del frontend desde PORTAL_ROOT al mirror
rem ============================================================================
set "PORTAL_ROOT=%ORIGEN%\.."

if exist "%PORTAL_ROOT%\index.html" (
    copy /Y "%PORTAL_ROOT%\index.html" "%REPO%\index.html" >nul
)

for %%F in ("%PORTAL_ROOT%\app.jsx" "%PORTAL_ROOT%\shell.jsx" "%PORTAL_ROOT%\charts.jsx" "%PORTAL_ROOT%\panel.css" "%PORTAL_ROOT%\data.js") do (
    if exist "%%~fF" copy /Y "%%~fF" "%REPO%\" >nul
)

if exist "%PORTAL_ROOT%\css" (
    xcopy "%PORTAL_ROOT%\css" "%REPO%\css\" /E /Y /I /Q >nul
)
if exist "%PORTAL_ROOT%\js" (
    xcopy "%PORTAL_ROOT%\js" "%REPO%\js\" /E /Y /I /Q >nul
)
if exist "%PORTAL_ROOT%\partials" (
    xcopy "%PORTAL_ROOT%\partials" "%REPO%\partials\" /E /Y /I /Q >nul
)

rem ============================================================================
rem  Git: commit + push (captura cambios que Python no haya commiteado, ej.
rem  archivos del frontend copiados despues del git add interno de Python)
rem ============================================================================
cd /d "%REPO%"
git add .

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Actualizacion automatica %date% %time%"
    if errorlevel 1 (
        >"%STATUS_FILE%" echo ERROR: git commit fallo %date% %time%
        set "RC=1"
        goto :cleanup_and_exit
    )
)

git fetch origin >nul 2>&1
git rebase origin/main >nul 2>&1

git push
if errorlevel 1 (
    >"%STATUS_FILE%" echo ERROR: git push fallo %date% %time%
    set "RC=1"
    goto :cleanup_and_exit
)

rem ============================================================================
rem  Camino exitoso
rem ============================================================================
>"%STATUS_FILE%" echo OK: publicado %date% %time%
set "RC=0"
goto :cleanup_and_exit

rem ============================================================================
rem  Cleanup garantizado (try/finally style via goto)
rem  TODOS los paths (exito y error) llegan aqui via "goto :cleanup_and_exit"
rem ============================================================================
:cleanup_and_exit
if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>&1
:cleanup_and_exit_no_del
endlocal & exit /b %RC%
