"""
v15.6 fase 2 · test end-to-end de Ingresos integrados al pipeline (sin SQL).

Corre el path real:
    fetch_ingresos(730d) + fetch_egresos(730d)
      -> extraer(df_override)  (sin tocar SQL, conn=None)
      -> procesar_movimientos
y verifica que el bucket "anio" (rolling últimos 365 días, con el filtro
CONSIGNATARIA_EXCLUIR aplicado) da números razonables.

Baseline post-fase-1 (365d brutos): 381 sub-grupos / 23.004 cab / 7.74M kg.
El "anio" del pipeline excluye las ~33 tropas TRASLADO -> esperado 15k-22k cab.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from datetime import date, timedelta
from wincampo_source import WinCampoAPI
from actualizar_datos import extraer, procesar_movimientos


def main():
    api = WinCampoAPI()

    fd = (date.today() - timedelta(days=730)).isoformat()
    fh = date.today().isoformat()

    df_ing = pd.DataFrame(api.fetch_ingresos(fecha_desde=fd, fecha_hasta=fh))
    df_egr = pd.DataFrame(api.fetch_egresos(fecha_desde=fd, fecha_hasta=fh))
    print(f"fetch: {len(df_ing)} sub-grupos ingresos, {len(df_egr)} egresos (730d)")
    assert "Consignatario" in df_ing.columns, "Falta Consignatario en el df de ingresos"

    # conn=None garantiza que NO se toca SQL — solo el path df_override.
    regs_ing, cols_ing = extraer(None, "v_PB_Ingresos", fecha_col="FechaIngreso", dias=730, df_override=df_ing)
    regs_egr, cols_egr = extraer(None, "v_PB_Egresos",  fecha_col="FechaSalida",  dias=730, df_override=df_egr)
    assert regs_ing, "extraer() devolvió 0 registros de ingresos"

    prod = procesar_movimientos(regs_ing, cols_ing, regs_egr, cols_egr, 2026)
    ing = prod["anio"]["ingresos"]

    total_cab = ing["total_cabezas"]
    total_kg  = ing["total_kg"]
    hoteleros = ing.get("por_propietario", {})

    print(f"\n--- bucket anio (rolling 365d, filtrado CONSIGNATARIA_EXCLUIR) ---")
    print(f"  total_cabezas: {total_cab:,}")
    print(f"  total_kg:      {total_kg:,.0f}")
    print(f"  hoteleros:     {list(hoteleros.keys())}")
    print(f"  resumen:       {prod['anio']['resumen']}")

    assert 15_000 <= total_cab <= 22_000, \
        f"total_cab_ingresos_anio fuera de rango [15k,22k]: {total_cab} — NO commitear, diagnosticar"
    assert total_kg > 5_000_000, \
        f"kg ingresados año demasiado bajo: {total_kg:,.0f} (real esperado ~7.7M en 365d)"
    assert len(hoteleros) >= 5, \
        f"hoteleros distintos < 5: {len(hoteleros)} ({list(hoteleros.keys())})"

    print(f"\nv15.6 fase 2 OK — Ingresos integrados: {total_cab:,} cab / {total_kg:,.0f} kg / {len(hoteleros)} hoteleros")


if __name__ == "__main__":
    main()
