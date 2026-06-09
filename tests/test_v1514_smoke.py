import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from actualizar_datos import smoke_test

# Apuntar al repo donde están los JSONs reales actualizados
carpeta = "C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal"
result = smoke_test(carpeta, "2025")

print(f"OK: {result['ok']}")
print(f"Passed: {result['checks_passed']}")
print(f"Failed: {result['checks_failed']}")
if result['errors']:
    print("Errores:")
    for e in result['errors']:
        print(f"  - {e}")

# Hoy todo debería pasar
assert result['ok'], f"smoke test falló en los JSONs reales: {result['errors']}"
print(f"\nOK v15.14: smoke test funciona — {result['checks_passed']} checks OK")
