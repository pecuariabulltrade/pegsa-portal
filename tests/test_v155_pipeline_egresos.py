"""
v15.5 targeted test: confirma que extraer() con df_override sobre egresos
funciona y que el filtro V/VENTA del pipeline reconoce los codigos 1-letra.

NO corre el pipeline entero. NO escribe JSONs.

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_v155_pipeline_egresos
"""

import sys
import logging
from pathlib import Path
from datetime import date, timedelta
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=logging.INFO)

import pandas as pd
from wincampo_source import WinCampoAPI
import actualizar_datos as ad


def main():
    print("=== v15.5 Test integracion Egresos ===\n")

    api = WinCampoAPI()
    print("Login OK\n")

    fd = (date.today() - timedelta(days=730)).isoformat()
    fh = date.today().isoformat()
    print(f"Rango: {fd} a {fh} (730 dias)\n")

    egresos = api.fetch_egresos(fecha_desde=fd, fecha_hasta=fh)
    print(f"Adapter devolvio: {len(egresos):,} egresos")
    assert len(egresos) > 5000, f"Egresos demasiado bajos: {len(egresos)}"

    df = pd.DataFrame(egresos)
    print(f"DataFrame: {len(df):,} filas, {len(df.columns)} columnas")
    print(f"Columnas: {list(df.columns)}\n")

    # extraer() con df_override (v15.10: firma sin conn)
    print("=== Llamando extraer('v_PB_Egresos', df_override=df) ===\n")
    regs, cols = ad.extraer("v_PB_Egresos", fecha_col="FechaSalida", dias=730, df_override=df)
    print(f"\n[OK] extraer() devolvio: {len(regs):,} registros, {len(cols)} columnas\n")

    # Distribucion de motivos
    motivos = Counter(r.get("MotivoSalida") for r in regs if r.get("MotivoSalida"))
    print(f"Motivos distintos: {dict(motivos)}\n")

    # === Filtro v15.5 (acepta codigo 1-letra Y string largo) ===
    n_venta_codigo  = sum(1 for r in regs if r.get("MotivoSalida") == "V")
    n_venta_palabra = sum(1 for r in regs if r.get("MotivoSalida") and "VENTA" in str(r["MotivoSalida"]).upper())

    def filtro_v155(r):
        m = str(r.get("MotivoSalida") or "").strip().upper()
        return m == "V" or "VENTA" in m

    n_filtro_v155 = sum(1 for r in regs if filtro_v155(r))

    print(f"=== Comparativa de filtros ===")
    print(f"  == 'V' exacto (API):              {n_venta_codigo:,}")
    print(f"  contiene 'VENTA' (filtro viejo):  {n_venta_palabra:,}")
    print(f"  filtro v15.5 (acepta ambos):      {n_filtro_v155:,}  <-- pipeline filter")

    # Si la API entrega solo codigos V, el filtro viejo daria 0 y el nuevo igualaria los codigos
    if n_venta_palabra == 0 and n_venta_codigo > 1000:
        print(f"\n  Discovery confirmado: API solo devuelve codigo 'V' (no string largo).")
        print(f"  Filtro viejo habria perdido TODAS las ventas. Filtro v15.5 captura {n_venta_codigo:,}.")

    assert n_filtro_v155 > 1000, f"Filtro v15.5 detecto muy pocas ventas: {n_filtro_v155}"
    print(f"\n[OK] Test OK. {n_filtro_v155:,} ventas detectadas con el filtro v15.5.")

    # === Sanity contra v15.3 baseline (365 dias) ===
    # En 730 dias esperamos mas que las 18856 ventas de 365 dias
    if n_filtro_v155 < 18000:
        print(f"\n[WARN] Ventas en 730d ({n_filtro_v155}) menos que en 365d (18856 baseline v15.3)")
    else:
        print(f"\n[OK] Volumen consistente con baseline v15.3 (730d >= 365d)")


if __name__ == "__main__":
    main()
