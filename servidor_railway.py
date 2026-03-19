#!/usr/bin/env python3
"""
PEGSA Portal — Servidor Railway
Sirve el portal HTML. Los JSON los pide el browser directamente
al servidor local via la URL de ngrok configurada en el portal.
"""
import http.server, os, threading
from pathlib import Path

PORT = int(os.environ.get("PORT", 8080))
HOST = "0.0.0.0"
BASE_DIR = Path(__file__).parent

class RailwayHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"  {args[0]} → {args[1]}")

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].lstrip("/")

        # Servir el portal HTML
        if path in ("", "index.html", "portal"):
            html_file = BASE_DIR / "pegsa_bull_portal.html"
            if html_file.exists():
                data = html_file.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", len(data))
                self.send_cors()
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Portal no encontrado")
            return

        # Health check para Railway
        if path == "health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","service":"PEGSA Portal"}')
            return

        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    print(f"  PEGSA Portal Railway — Puerto {PORT}")
    server = http.server.HTTPServer((HOST, PORT), RailwayHandler)
    server.serve_forever()
