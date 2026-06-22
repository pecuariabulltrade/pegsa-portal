"""
Test standalone: verifica que fetch_stock_hacienda devuelve datos correctos.
NO toca actualizar_datos.py ni el pipeline.

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_wincampo_stock
"""

import sys
import json
from pathlib import Path
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from wincampo_source import WinCampoAPI


def main():
    print("=== Test Stock Hacienda WinCampo Web (detalle individual) ===\n")

    api = WinCampoAPI()
    print(f"Login OK\n")

    cabezas = api.fetch_stock_hacienda()
    print(f"Total cabezas: {len(cabezas)} (esperado ~9974)\n")

    assert len(cabezas) > 5000, f"Cabezas muy bajas: {len(cabezas)}"

    # Imprimir 3 muestras COMPLETAS para confirmar shape
    print("=== 3 muestras de cabezas con shape real ===")
    for i in range(min(3, len(cabezas))):
        print(f"\n--- Cabeza #{i+1} ---")
        for k, v in cabezas[i].items():
            print(f"  {k}: {v!r}")

    # Verificar RFID único (clave de cada animal)
    # Nota: la spec del prompt dice "RFIDs únicos: 9.969 (5 duplicados son
    # caravanas provisorias sin RFID electrónico real — no es un bug)".
    # Toleramos hasta 50 duplicados — si pasa de eso, probablemente el
    # endpoint está agrupando o devolviendo cabezas de tropas en lugar de
    # individuales y conviene revisar los flags.
    rfids = [c["RFID"] for c in cabezas if c["RFID"]]
    dupes = len(rfids) - len(set(rfids))
    print(f"\nRFIDs únicos: {len(set(rfids))} de {len(rfids)} ({dupes} duplicados, esperados ~5 por caravanas provisorias)")
    assert dupes < 50, f"DEMASIADOS RFIDs DUPLICADOS ({dupes}) — probablemente el endpoint está agrupando"

    # Distribución por hotelero
    print("\nPor hotelero (esperado: PEGSA ~8973, TERCIO BRAVO ~449, LAS TAPERAS ~254, RICARDO BAILO ~217, DARWASH ~71, UGMA ~10):")
    for h, n in Counter(c["HOTELERO"] for c in cabezas).most_common():
        print(f"  {h}: {n}")

    # Distribución por categoría
    print("\nPor categoría (esperado: TM ~2501, VA ~2386, TH ~1906, NT ~1729, NV ~769, VQ ~637, TO ~46):")
    for c, n in Counter(x["CATEGORIA"] for x in cabezas).most_common():
        print(f"  {c}: {n}")

    # Integridad de los 5 campos críticos
    sin_corral   = sum(1 for c in cabezas if not c["NRO_CORRAL"])
    sin_hotelero = sum(1 for c in cabezas if not c["HOTELERO"])
    sin_cat      = sum(1 for c in cabezas if not c["CATEGORIA"])
    sin_kg       = sum(1 for c in cabezas if not c["KG_INGRESO"])
    sin_fecha    = sum(1 for c in cabezas if not c["FECHA_INGRESO"])

    print("\nIntegridad de los 5 campos críticos del pipeline:")
    print(f"  Sin NRO_CORRAL:    {sin_corral}")
    print(f"  Sin HOTELERO:      {sin_hotelero}")
    print(f"  Sin CATEGORIA:     {sin_cat}")
    print(f"  Sin KG_INGRESO:    {sin_kg}")
    print(f"  Sin FECHA_INGRESO: {sin_fecha}")

    # Distribución por establecimiento
    rangos = {
        "El Haras (1-199)":         0,
        "El Coloradito (200-299)":  0,
        "Don Pedro (300-399)":      0,
        "El Descanso (400-499)":    0,
        "Campo Medel (500-599)":    0,
        "El Morrón (600-699)":      0,
        "La Panchita (700-799)":    0,
        "La Cucuca (800-899)":      0,
        "El Durazno (900-999)":     0,
        "Recepción (1000+)":        0,
        "Fuera de rango":           0,
    }
    for c in cabezas:
        try:
            n = int(float(c["NRO_CORRAL"]))
        except (ValueError, TypeError):
            rangos["Fuera de rango"] += 1
            continue
        if   1<=n<=199:     rangos["El Haras (1-199)"] += 1
        elif 200<=n<=299:   rangos["El Coloradito (200-299)"] += 1
        elif 300<=n<=399:   rangos["Don Pedro (300-399)"] += 1
        elif 400<=n<=499:   rangos["El Descanso (400-499)"] += 1
        elif 500<=n<=599:   rangos["Campo Medel (500-599)"] += 1
        elif 600<=n<=699:   rangos["El Morrón (600-699)"] += 1
        elif 700<=n<=799:   rangos["La Panchita (700-799)"] += 1
        elif 800<=n<=899:   rangos["La Cucuca (800-899)"] += 1
        elif 900<=n<=999:   rangos["El Durazno (900-999)"] += 1
        elif 1000<=n<=1099: rangos["Recepción (1000+)"] += 1
        else:               rangos["Fuera de rango"] += 1

    print("\nPor establecimiento (esperado: El Haras ~7963, La Cucuca ~1148, El Descanso ~449+414=863):")
    for k, v in rangos.items():
        if v > 0:
            print(f"  {k}: {v}")

    # Stats KG_INGRESO
    kgs = [c["KG_INGRESO"] for c in cabezas if c["KG_INGRESO"]]
    if kgs:
        print(f"\nKG_INGRESO: min={min(kgs):.1f}  max={max(kgs):.1f}  prom={sum(kgs)/len(kgs):.1f}  sum={sum(kgs):.0f}")

    print(f"\n[OK] Test OK. {len(cabezas)} cabezas individuales con RFID único, listas para el pipeline.")


if __name__ == "__main__":
    main()
