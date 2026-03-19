#!/usr/bin/env python3
"""
PEGSA Portal — Servidor local
Sirve el portal HTML y los JSON desde OneDrive
Acceso: http://localhost:8765
"""
import http.server, json, os, sys, webbrowser, threading, configparser
from pathlib import Path

PORT = 8765
HOST = "0.0.0.0"   # escucha en toda la red, no solo localhost
BASE_DIR  = Path(__file__).parent
CFG_PATH  = BASE_DIR / "config.ini"

# Leer carpeta de datos desde config.ini
def get_data_dir():
    cfg = configparser.ConfigParser()
    cfg.read(CFG_PATH, encoding="utf-8")
    try:
        return Path(cfg["ONEDRIVE"]["carpeta"])
    except:
        return BASE_DIR / "datos"

DATA_DIR  = get_data_dir()
PORTAL_PATH = None

# Buscar portal HTML en ubicaciones comunes
def find_portal():
    candidates = [
        BASE_DIR / "pegsa_bull_portal.html",
        BASE_DIR.parent / "pegsa_bull_portal.html",
        Path.home() / "Desktop" / "pegsa_bull_portal.html",
        Path.home() / "Downloads" / "pegsa_bull_portal.html",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None

class PEGSAHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # Solo loguear errores
        if args and str(args[1]) not in ('200','304'):
            print(f"  {args[0]} → {args[1]}")

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Cache-Control", "no-cache, no-store")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].lstrip("/")

        # ── JSON desde OneDrive ──────────────────────────────
        if path.endswith(".json"):
            json_file = DATA_DIR / path
            if json_file.exists():
                data = json_file.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", len(data))
                self.send_cors()
                self.end_headers()
                self.wfile.write(data)
                print(f"  ✓ JSON servido: {path}  ({len(data)//1024} KB)")
            else:
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.send_cors()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": f"Archivo no encontrado: {json_file}",
                    "tip": "Ejecutá 2_EJECUTAR_AHORA.bat primero para generar los JSON"
                }).encode())
            return

        # ── Portal HTML ──────────────────────────────────────
        portal = find_portal()
        if portal and portal.exists():
            data = portal.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", len(data))
            self.send_cors()
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Portal HTML no encontrado. Copiar pegsa_bull_portal.html a la misma carpeta.")

def abrir_browser():
    import time; time.sleep(1.2)
    webbrowser.open(f"http://localhost:{PORT}")

if __name__ == "__main__":
    print()
    print("  ═══════════════════════════════════════════════")
    print("   PEGSA & BULLTRADE — Servidor Local")
    print("  ═══════════════════════════════════════════════")
    print()
    print(f"  Carpeta de datos : {DATA_DIR}")

    portal = find_portal()
    if portal:
        print(f"  Portal encontrado: {portal.name}")
    else:
        print("  ⚠ Portal HTML no encontrado.")
        print("    Copiá pegsa_bull_portal.html a esta carpeta.")

    if not DATA_DIR.exists():
        print(f"  ⚠ Carpeta de datos no existe aún.")
        print(f"    Ejecutá 2_EJECUTAR_AHORA.bat primero.")

    # Obtener IP local
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "TU_IP"

    print()
    print(f"  ✓ Servidor iniciado")
    print()
    print(f"  En esta PC:            http://localhost:{PORT}")
    print(f"  Desde otras PCs/VPN:   http://{local_ip}:{PORT}")
    print()
    print(f"  Compartí esta dirección con los demás usuarios:")
    print(f"  ► http://{local_ip}:{PORT}")
    print()
    print("  IMPORTANTE: Esta ventana debe quedar abierta.")
    print("  Para cerrar el servidor: presioná Ctrl+C")
    print()

    threading.Thread(target=abrir_browser, daemon=True).start()

    server = http.server.HTTPServer((HOST, PORT), PEGSAHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor cerrado.")
