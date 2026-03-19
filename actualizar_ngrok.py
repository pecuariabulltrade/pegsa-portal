#!/usr/bin/env python3
"""
actualizar_ngrok.py
Cuando ngrok inicia, este script:
1. Detecta la URL pública actual de ngrok
2. La guarda en un archivo para que el portal la use
3. Opcionalmente actualiza Railway via API

Ejecutar después de iniciar ngrok.
"""
import urllib.request, json, sys, configparser
from pathlib import Path

def get_ngrok_url():
    """Obtiene la URL pública de ngrok desde su API local."""
    try:
        with urllib.request.urlopen('http://localhost:4040/api/tunnels', timeout=3) as r:
            data = json.loads(r.read())
        tunnels = data.get('tunnels', [])
        for t in tunnels:
            if t.get('proto') == 'https':
                return t['public_url']
        if tunnels:
            return tunnels[0]['public_url']
    except Exception as e:
        print(f"  ✗ No se pudo conectar a ngrok: {e}")
        print("    Asegurate de que ngrok esté corriendo: ngrok http 8765")
        return None

def main():
    print()
    print("  PEGSA — Actualizador de URL ngrok")
    print("  ══════════════════════════════════")
    print()

    url = get_ngrok_url()
    if not url:
        sys.exit(1)

    print(f"  ✓ URL ngrok detectada: {url}")

    # Guardar en archivo local para referencia
    base = Path(__file__).parent
    (base / "ngrok_url.txt").write_text(url)
    print(f"  ✓ URL guardada en ngrok_url.txt")

    # Mostrar instrucción para configurar en el portal
    print()
    print("  Para que los usuarios de Railway usen esta URL:")
    print(f"  Entrá al portal → abrí la consola del browser (F12)")
    print(f"  y ejecutá:")
    print()
    print(f"    localStorage.setItem('pegsa_data_url', '{url}')")
    print()
    print("  O configurá la variable NGROK_URL en Railway:")
    print(f"    NGROK_URL={url}")
    print()

if __name__ == "__main__":
    main()
