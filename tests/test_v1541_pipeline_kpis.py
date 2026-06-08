"""
v15.4.1 hotfix · test de pipeline end-to-end (sin SQL, sin escribir JSONs).

Reproduce el bug que dejaba los KPIs en 0: corre el path real
fetch_stock_hacienda → extraer(df_override) → calcular_kpis y verifica que
con CANTIDAD=1 presente los totales vuelven a ser > 0.

Antes del hotfix: total_cabezas=0, total_kg_estimado_hoy=0 (col_cab=None).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from wincampo_source import WinCampoAPI
from actualizar_datos import extraer, calcular_kpis


def main():
    api = WinCampoAPI()
    df = pd.DataFrame(api.fetch_stock_hacienda())
    assert "CANTIDAD" in df.columns, "El adapter no devolvió la columna CANTIDAD"

    registros, columnas = extraer("V_STOCK_HACIENDA", df_override=df)
    assert registros, "extraer() devolvió 0 registros"
    assert registros[0]["CANTIDAD"] == 1, "CANTIDAD no persistió tras extraer()"
    assert "CANTIDAD" in columnas, "CANTIDAD ausente en columnas tras extraer()"
    print(f"OK extraer: {len(registros)} registros, CANTIDAD presente y == 1")

    kpis = calcular_kpis(registros, columnas)
    tc = kpis["total_cabezas"]
    tk = kpis["total_kg_estimado_hoy"]
    print(f"   total_cabezas         = {tc:,}")
    print(f"   total_kg_estimado_hoy = {tk:,.0f}")

    assert tc > 9000, f"total_cabezas demasiado bajo (bug presente?): {tc}"
    assert tk > 1_000_000, f"total_kg_estimado_hoy demasiado bajo (bug presente?): {tk}"

    pegsa = kpis["por_propietario"].get("PEGSA", {})
    print(f"   PEGSA: {pegsa.get('cabezas'):,} cab / {pegsa.get('kg_estimado'):,.0f} kg")
    assert pegsa.get("cabezas", 0) > 0, "PEGSA en 0 — bug presente"

    print("\nv15.4.1 pipeline OK — KPIs computan > 0 con CANTIDAD presente")


if __name__ == "__main__":
    main()
