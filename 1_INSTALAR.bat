@echo off
title PEGSA - Instalacion
color 0A
cd /d "%~dp0"

echo.
echo  ============================================================
echo   PEGSA ^& BULLTRADE — Instalacion completa
echo  ============================================================
echo.
echo  Este proceso va a:
echo   1. Verificar que Python este instalado
echo   2. Instalar las librerias necesarias (pyodbc, pandas)
echo   3. Programar la actualizacion automatica diaria 07:00 AM
echo.
echo  Necesita ejecutarse como Administrador.
echo  Si algo falla, hacer click derecho - Ejecutar como admin.
echo.
pause

:: ── Verificar Python ─────────────────────────────────────
echo.
echo  [1/3] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  PYTHON NO ESTA INSTALADO                           ║
    echo  ║                                                      ║
    echo  ║  1. Ir a: https://www.python.org/downloads/         ║
    echo  ║  2. Descargar la version mas reciente               ║
    echo  ║  3. Durante la instalacion TILDAR:                  ║
    echo  ║     "Add Python to PATH"  ← MUY IMPORTANTE         ║
    echo  ║  4. Volver a ejecutar este archivo                  ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo  OK: %%v encontrado

:: ── Instalar librerías ────────────────────────────────────
echo.
echo  [2/3] Instalando librerias Python...
echo  (puede tardar 1-2 minutos la primera vez)
echo.
python -m pip install --upgrade pip --quiet
python -m pip install pyodbc pandas --quiet
if %errorlevel% neq 0 (
    echo  ADVERTENCIA: Algunos paquetes no se instalaron correctamente.
    echo  Abre CMD y ejecuta: pip install pyodbc pandas
) else (
    echo  OK: pyodbc y pandas instalados
)

:: ── Crear tarea programada ────────────────────────────────
echo.
echo  [3/3] Programando tarea automatica diaria...

set SCRIPT="%~dp0actualizar_datos.py"
set HORA=07:00

:: Leer hora del config si existe
for /f "tokens=3 delims== " %%h in ('findstr /i "hora_tarea" "%~dp0config.ini" 2^>nul') do set HORA=%%h

:: Borrar tarea anterior
schtasks /delete /tn "PEGSA_Actualizacion" /f >nul 2>&1

:: Crear tarea nueva
schtasks /create /tn "PEGSA_Actualizacion" /tr "python %SCRIPT%" /sc DAILY /st %HORA% /ru "%USERNAME%" /rl HIGHEST /f >nul 2>&1

if %errorlevel% equ 0 (
    echo  OK: Tarea programada para las %HORA% todos los dias
) else (
    echo  ADVERTENCIA: No se pudo crear la tarea automatica.
    echo  Podra ejecutar manualmente con: ejecutar_ahora.bat
)

:: ── Resumen final ─────────────────────────────────────────
echo.
echo  ============================================================
echo   INSTALACION COMPLETADA
echo  ============================================================
echo.
echo   Proximos pasos:
echo.
echo   1. Abrí config.ini y completá la carpeta de OneDrive:
echo      carpeta = C:\Users\TU_NOMBRE\OneDrive\PEGSA_Portal\datos
echo.
echo   2. Conecta la VPN de la empresa
echo.
echo   3. Doble clic en  ejecutar_ahora.bat  para probar
echo.
echo   4. Si funciona, ya queda automatico todos los dias 07:00 AM
echo.
pause
