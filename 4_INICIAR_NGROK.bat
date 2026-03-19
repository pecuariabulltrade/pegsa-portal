@echo off
title PEGSA - ngrok
color 0B
cd /d "%~dp0"

echo.
echo  ============================================================
echo   PEGSA ^& BULLTRADE — Iniciar ngrok
echo  ============================================================
echo.
echo  Esto expone el servidor local a internet de forma segura.
echo  Mantene esta ventana abierta mientras uses el portal.
echo.

:: Verificar que servidor esté corriendo
curl -s http://localhost:8765 >nul 2>&1
if %errorlevel% neq 0 (
    echo  ADVERTENCIA: El servidor local no parece estar corriendo.
    echo  Abrí primero 3_ABRIR_PORTAL.bat en otra ventana.
    echo.
    pause
)

:: Iniciar ngrok en background
echo  Iniciando ngrok...
start "" ngrok http 8765

:: Esperar que ngrok levante
timeout /t 3 /nobreak >nul

:: Detectar y mostrar la URL
echo.
python actualizar_ngrok.py

echo.
pause
