@echo off
title PEGSA - Portal Local
color 0B
cd /d "%~dp0"
echo.
echo  ═══════════════════════════════════════════════
echo   PEGSA ^& BULLTRADE — Iniciando Portal
echo  ═══════════════════════════════════════════════
echo.
echo  El portal se va a abrir en tu navegador.
echo  Otros usuarios pueden acceder desde sus PCs.
echo.
echo  IMPORTANTE: No cierres esta ventana.
echo.
python servidor.py
pause
