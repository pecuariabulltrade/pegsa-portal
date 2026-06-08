"""
Test standalone para fetch_ingresos (Tabla 3 — v15.6).

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_wincampo_ingresos

Valida contra el descubrimiento del 2026-06-08 (endpoint lst_movimiento_hacienda):
    365d → 233 tropas, 381 sub-grupos, ~23.004 cabezas
    730d → 540 tropas, ~49.965 cabezas (sin cap de rango)
"""

import sys
from pathlib import Path
from collections import Counter
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from wincampo_source import WinCampoAPI

# Detectores del pipeline (procesar_movimientos, líneas 673-689). El adapter
# debe devolver EXACTAMENTE estas keys para que los _find del pipeline matcheen.
CAMPOS_PIPELINE = ["FechaIngreso", "hotelero", "categoria", "Cantidad",
                   "KgIngreso", "Consignatario", "Proveedor"]
EXCLUIR = {"destete", "traslado"}  # CONSIGNATARIA_EXCLUIR del pipeline


def main():
    print("=== Test Ingresos de Hacienda WinCampo Web (Tabla 3 / v15.6) ===\n")

    api = WinCampoAPI()
    print("Login OK\n")

    hoy = date.today()
    desde = hoy - timedelta(days=365)
    print(f"Periodo: {desde} a {hoy}\n")

    ingresos = api.fetch_ingresos(fecha_desde=desde.isoformat(), fecha_hasta=hoy.isoformat())
    print(f"Total sub-grupos (camion x categoria, 1 año): {len(ingresos)}")
    assert len(ingresos) > 100, f"Sub-grupos muy bajos: {len(ingresos)} — posible problema"

    # 3 muestras
    print("\n=== 3 muestras (primero, mediana, ultimo) ===")
    for i in [0, len(ingresos)//2, len(ingresos)-1]:
        print(f"\n--- Sub-grupo #{i+1} ---")
        for k, v in ingresos[i].items():
            print(f"  {k}: {v!r}")

    # 1) Las keys del pipeline tienen que estar TODAS presentes
    faltantes = [c for c in CAMPOS_PIPELINE if c not in ingresos[0]]
    assert not faltantes, f"Faltan campos que el pipeline detecta: {faltantes}"
    print(f"\n[OK] Campos del pipeline presentes: {CAMPOS_PIPELINE}")

    # 2) Cantidad debe ser entero real (NO siempre 1, a diferencia de Stock/Egresos)
    cants = [r["Cantidad"] for r in ingresos if r["Cantidad"] is not None]
    total_cabezas = sum(cants)
    n_mayor_1 = sum(1 for c in cants if c > 1)
    print(f"\nCantidad (sub-grupo):")
    print(f"  Total cabezas ingresadas (suma): {total_cabezas:,}  (esperado ~23.004 en 365d)")
    print(f"  Sub-grupos con Cantidad > 1:     {n_mayor_1} de {len(cants)}")
    assert n_mayor_1 > 0, "Cantidad siempre 1 — el sub-grupo no se está leyendo bien"
    assert total_cabezas > 10_000, f"Total cabezas sospechosamente bajo: {total_cabezas}"

    # 3) KgIngreso (total del sub-grupo) — sanity
    kgs = [r["KgIngreso"] for r in ingresos if r["KgIngreso"] is not None]
    total_kg = sum(kgs)
    print(f"\nKgIngreso (total por sub-grupo):")
    print(f"  Total kg ingresados (suma): {total_kg:,.0f} kg")
    print(f"  Sin KgIngreso:              {len(ingresos) - len(kgs)}")

    # 4) Categorías por sub-grupo (esperado en 365d: TM 83, NT 20, NV 48, TH 59, VQ 29, VA 127, TO 15)
    cats = Counter(r["categoria"] for r in ingresos if r["categoria"])
    print(f"\nCategorias (conteo de sub-grupos):")
    for c, n in cats.most_common():
        print(f"  {c}: {n}")

    # 5) Hoteleros
    by_hot = Counter(r["hotelero"] for r in ingresos if r["hotelero"])
    print(f"\nHoteleros (conteo de sub-grupos):")
    for h, n in by_hot.most_common():
        print(f"  {h}: {n}")

    # 6) Simulación del filtro CONSIGNATARIA_EXCLUIR del pipeline
    def es_excluido(cons):
        return bool(cons) and cons.strip().lower() in EXCLUIR
    tropas_set = set()
    excluidas = set()
    vacias = 0
    for r in ingresos:
        t = r["NRO_TROPA"]
        tropas_set.add(t)
        if es_excluido(r["Consignatario"]):
            excluidas.add(t)
        if not r["Consignatario"]:
            vacias += 1
    print(f"\nConsignatarios:")
    cons = Counter(r["Consignatario"] for r in ingresos if r["Consignatario"])
    for c, n in cons.most_common(10):
        print(f"  {c}: {n}")
    print(f"\nFiltro CONSIGNATARIA_EXCLUIR {EXCLUIR} (simulado):")
    print(f"  Tropas distintas:               {len(tropas_set)}  (esperado ~233 en 365d)")
    print(f"  Tropas que se EXCLUIRIAN:        {len(excluidas)}  (TRASLADO ~33)")
    print(f"  Sub-grupos con Consignatario vacio: {vacias}  (NO matchean el filtro actual)")

    print(f"\n[OK] Test OK. {len(ingresos)} sub-grupos / {total_cabezas:,} cabezas, listos para integrar al pipeline.")


if __name__ == "__main__":
    main()
