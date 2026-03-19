@echo off
title PEGSA - Actualizando datos...
color 0B
cd /d "%~dp0"
echo.
echo  ============================================================
echo   PEGSA ^& BULLTRADE — Actualizacion Manual
echo  ============================================================
echo.
echo  Verificando VPN... asegurate de estar conectado antes
echo  de continuar.
echo.
pause

echo.
echo  Iniciando actualizacion...
echo.
python actualizar_datos.py

echo.
if %errorlevel% equ 0 (
    color 0A
    echo  ============================================================
    echo   EXITO: Datos actualizados correctamente
    echo   Revisa la carpeta de OneDrive para ver los archivos JSON
    echo  ============================================================
) else (
    color 0C
    echo  ============================================================
    echo   ERROR: Revisa el archivo de log en la carpeta /logs
    echo  ============================================================
)
echo.
pause
