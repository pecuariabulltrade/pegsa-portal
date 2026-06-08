"""
Test standalone para fetch_muertes (Tabla 4 — v15.7 fase 1).

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_wincampo_muertes

fetch_muertes = wrapper sobre fetch_egresos filtrando MOTIVO=="M" + remap.
Baseline (captura 06/06): ~392 muertes en 365d, 731 en 730d.
"""

import sys
from pathlib import Path
from collections import Counter
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from wincampo_source import WinCampoAPI

# Detectores del pipeline (procesar_muertes 975-977 + dias_encierre 1048).
CAMPOS = ["MUERTOS", "ABREVIATURA", "FECHA_MUERTE", "DIAS_ENCIERRE"]


def main():
    print("=== Test Muertes (V_MUERTES via egresos MOTIVO=M) — v15.7 fase 1 ===\n")

    api = WinCampoAPI()
    print("Login OK\n")

    hoy = date.today()
    desde = hoy - timedelta(days=365)
    print(f"Periodo: {desde} a {hoy}\n")

    muertes = api.fetch_muertes(fecha_desde=desde.isoformat(), fecha_hasta=hoy.isoformat())
    print(f"Total muertes (365d): {len(muertes)}  (baseline ~392)")
    assert len(muertes) > 50, f"Muertes sospechosamente bajas: {len(muertes)}"
    assert len(muertes) < 2000, f"Muertes sospechosamente altas: {len(muertes)} (¿no filtró M?)"

    # 3 muestras
    print("\n=== 3 muestras (primero, mediana, ultimo) ===")
    for i in [0, len(muertes)//2, len(muertes)-1]:
        print(f"\n--- Muerte #{i+1} ---")
        for k, v in muertes[i].items():
            print(f"  {k}: {v!r}")

    # 1) Campos del pipeline presentes en TODOS los registros
    for c in CAMPOS:
        faltan = sum(1 for m in muertes if c not in m)
        assert faltan == 0, f"Campo {c} falta en {faltan} registros"
    print(f"\n[OK] Campos del pipeline presentes en todos: {CAMPOS}")

    # 2) MUERTOS == 1 entero positivo en cada fila (1 animal individual)
    assert all(m["MUERTOS"] == 1 for m in muertes), "MUERTOS != 1 en alguna fila"
    print(f"[OK] MUERTOS == 1 en las {len(muertes)} filas")

    # 3) MotivoSalida es M en todas (sanity del filtro)
    assert all((m.get("MotivoSalida") or "").upper() == "M" for m in muertes), "Coló un no-M"
    print("[OK] Todas las filas son MOTIVO=M")

    # 4) DIAS_ENCIERRE — distribución y simulación del filtro >30d del pipeline
    dias = [m["DIAS_ENCIERRE"] for m in muertes if m["DIAS_ENCIERRE"] is not None]
    sin_dias = len(muertes) - len(dias)
    mas30 = sum(1 for d in dias if d > 30)
    print(f"\nDIAS_ENCIERRE:")
    print(f"  Con valor: {len(dias)}  |  None: {sin_dias}")
    if dias:
        print(f"  Min {min(dias)}  Max {max(dias)}  Prom {sum(dias)/len(dias):.1f}")
    print(f"  >30d (entran a la tasa anual del pipeline): {mas30}")
    print(f"  <=30d (excluidos de la tasa anual):          {len(dias)-mas30}")

    # 5) Categorías (ABREVIATURA)
    cats = Counter(m["ABREVIATURA"] for m in muertes if m["ABREVIATURA"])
    print(f"\nMuertes por ABREVIATURA (categoria):")
    for c, n in cats.most_common():
        print(f"  {c}: {n}")

    # 6) Por hotelero
    by_hot = Counter(m["HOTELERO"] for m in muertes if m["HOTELERO"])
    print(f"\nMuertes por hotelero:")
    for h, n in by_hot.most_common():
        print(f"  {h}: {n}")

    print(f"\n[OK] Test OK. {len(muertes)} muertes remapeadas, listas para el pipeline.")


if __name__ == "__main__":
    main()
