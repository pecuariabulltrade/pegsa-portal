"""
v15.7 fase 2 · test end-to-end de Muertes integradas al pipeline (sin SQL).

Corre el path real:
    fetch_stock + fetch_ingresos(730d) + fetch_muertes(730d)
      -> extraer(df_override)  (conn=None, no toca SQL)
      -> procesar_muertes
y verifica que la tasa de mortandad es calculable y el total de muertes
coincide con el baseline SQL viejo.

OJO con el baseline: fetch_muertes trae 392 muertes CRUDAS en 365d. El
pipeline aplica >30d de encierre Y (desde v15.7.1) filtro El Haras (1-199):
  392 crudas -> 289 (>30d, todos los corrales) -> 279 (>30d + solo Haras).

v15.7.1 corrige un bug latente del SQL viejo: contaba 10 muertes de recría
(corrales 200/300/400) en el numerador de la tasa de feedlot. El SQL viejo
reportaba 287 (= 289 - 2 fantasma, sin filtro de establecimiento). Tras el
fix damos 279 — diverge -2,9% del SQL INTENCIONALMENTE (corrección, no bug).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from datetime import date, timedelta
from wincampo_source import WinCampoAPI
from actualizar_datos import extraer, procesar_muertes

# Baseline POST-FIX v15.7.1 (>30d + solo El Haras 1-199). Diverge del SQL
# viejo (287) intencionalmente: el SQL contaba 10 muertes de recría de más.
BASELINE_POST_FIX = 279


def main():
    api = WinCampoAPI()
    fd = (date.today() - timedelta(days=730)).isoformat()
    fh = date.today().isoformat()

    df_stock = pd.DataFrame(api.fetch_stock_hacienda())
    df_ing   = pd.DataFrame(api.fetch_ingresos(fecha_desde=fd, fecha_hasta=fh))
    df_m     = pd.DataFrame(api.fetch_muertes(fecha_desde=fd, fecha_hasta=fh))
    print(f"fetch: {len(df_stock)} stock, {len(df_ing)} ingresos, {len(df_m)} muertes crudas (730d)")
    assert "DIAS_ENCIERRE" in df_m.columns, "Falta DIAS_ENCIERRE en el df de muertes"

    regs_st, cols_st = extraer(None, "V_STOCK_HACIENDA", df_override=df_stock)
    regs_ing, cols_ing = extraer(None, "v_PB_Ingresos", fecha_col="FechaIngreso", dias=730, df_override=df_ing)
    regs_m, cols_m = extraer(None, "V_MUERTES", fecha_col="FECHA_MUERTE", dias=730, df_override=df_m)
    assert regs_m, "extraer() devolvió 0 muertes"

    # Corre sin errores
    res = procesar_muertes(regs_m, cols_m, regs_ing, cols_ing, regs_st, cols_st, 2026)

    total = res["anio"]["total_muertes"]
    mort = res.get("mortandad", {})
    tasa = mort.get("tasa_mensual_pct")

    print(f"\n--- procesar_muertes (Web, post v15.7.1 filtro El Haras) ---")
    print(f"  anio.total_muertes (>30d, Haras): {total}   (baseline post-fix: {BASELINE_POST_FIX})")
    print(f"  por_categoria:                    {res['anio'].get('por_categoria')}")
    print(f"  mortandad.tasa_mensual_pct:       {tasa}")
    print(f"  mortandad.tasa_anual_pct:         {mort.get('tasa_anual_pct')}")
    print(f"  mes_anterior.total_muertes:       {res['mes_anterior'].get('total_muertes')}")

    # Tasa calculable (número positivo)
    assert isinstance(tasa, (int, float)) and tasa > 0, f"tasa_mensual_pct no calculable: {tasa!r}"

    # Total post-fix (>30d + solo El Haras). Diverge -2,9% del SQL viejo (287)
    # a propósito: v15.7.1 corrige las 10 muertes de recría que el SQL contaba.
    assert 270 < total < 290, \
        f"total_muertes {total} fuera de (270,290) vs baseline post-fix {BASELINE_POST_FIX} — NO commitear, diagnosticar"

    delta_pct = 100 * (total - BASELINE_POST_FIX) / BASELINE_POST_FIX
    print(f"\nv15.7.1 OK — muertes {total} (Haras >30d) vs {BASELINE_POST_FIX} esperado, delta {delta_pct:+.1f}%, tasa {tasa}%")


if __name__ == "__main__":
    main()
