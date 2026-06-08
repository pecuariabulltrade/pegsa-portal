"""
v15.4 targeted test: confirma que extraer() con df_override aplica las 6
transformaciones del pipeline (DIAS_EN_FEEDLOT, CLASIFICACION,
NOMBRE_CORRAL, ENGORDE_DIARIO_KG, KG_ESTIMADO_HOY, CATEGORIA_FINAL) sobre
el DataFrame que viene de wincampo_source.WinCampoAPI.fetch_stock_hacienda().

NO corre el pipeline entero. NO toca SQL. NO escribe JSONs.
Solo prueba la ruta nueva.

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_v154_pipeline_stock
"""

import sys
import logging
from pathlib import Path
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Configurar el log igual que actualizar_datos para ver los mensajes de extraer()
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
)

import pandas as pd
from wincampo_source import WinCampoAPI

# Importar extraer() del modulo del pipeline.
# El modulo importa configparser y otros things en top-level pero no ejecuta main().
import actualizar_datos as ad


def main():
    print("=== v15.4 Test: extraer() + df_override desde WinCampoAPI ===\n")

    # 1. Fetch desde el adapter (mismo que harà el pipeline)
    api = WinCampoAPI()
    print("Login OK")

    stock = api.fetch_stock_hacienda()
    print(f"Adapter devolvio: {len(stock)} cabezas\n")
    assert len(stock) > 5000, "Volumen sospechosamente bajo"

    df = pd.DataFrame(stock)
    print(f"Columnas del adapter: {list(df.columns)}\n")

    # 2. Verificar que las 5 columnas criticas existen con los nombres que espera extraer()
    requeridas = ["NRO_CORRAL", "HOTELERO", "CATEGORIA", "KG_INGRESO", "FECHA_INGRESO"]
    faltantes = [c for c in requeridas if c not in df.columns]
    assert not faltantes, f"Faltan columnas criticas: {faltantes}"
    print(f"[OK] Las 5 columnas requeridas estan presentes\n")

    # 3. Llamar a extraer() con df_override (v15.10: firma sin conn)
    print("=== Llamando extraer('V_STOCK_HACIENDA', df_override=df) ===\n")
    regs, cols = ad.extraer("V_STOCK_HACIENDA", df_override=df)

    # 4. Verificar que las 6 transformaciones aplicaron
    assert len(regs) > 5000, f"extraer() devolvio {len(regs)} registros — algo se perdio"
    print(f"\n[OK] extraer() devolvio {len(regs)} registros + {len(cols)} columnas\n")

    transformaciones = [
        "DIAS_EN_FEEDLOT",
        "CLASIFICACION",
        "NOMBRE_CORRAL",
        "ENGORDE_DIARIO_KG",
        "KG_ESTIMADO_HOY",
        "CATEGORIA_FINAL",
    ]
    print("=== Columnas calculadas por extraer() ===")
    for t in transformaciones:
        ok = t in cols
        print(f"  [{('OK' if ok else 'FAIL'):>4}] {t}")
        assert ok, f"Transformacion {t} no aplico"

    # 5. Sanity: distribuciones del DataFrame enriquecido
    print(f"\n=== Sanity de los registros enriquecidos ===")

    by_cls = Counter(r.get("CLASIFICACION") for r in regs)
    print(f"\nCLASIFICACION: {dict(by_cls)}")
    assert sum(by_cls.values()) == len(regs), "Cuentas no cuadran"

    by_corral = Counter(r.get("NOMBRE_CORRAL") for r in regs)
    print(f"\nNOMBRE_CORRAL: {dict(by_corral)}")

    by_catfinal = Counter(r.get("CATEGORIA_FINAL") for r in regs)
    print(f"\nCATEGORIA_FINAL: {dict(by_catfinal)}")

    # Stats KG_ESTIMADO_HOY
    kgs = [r.get("KG_ESTIMADO_HOY") for r in regs if isinstance(r.get("KG_ESTIMADO_HOY"), (int, float))]
    if kgs:
        print(f"\nKG_ESTIMADO_HOY: min={min(kgs):.0f}  max={max(kgs):.0f}  prom={sum(kgs)/len(kgs):.1f}  sum={sum(kgs):,.0f}")

    # Stats DIAS_EN_FEEDLOT
    dias = [r.get("DIAS_EN_FEEDLOT") for r in regs if isinstance(r.get("DIAS_EN_FEEDLOT"), int)]
    if dias:
        print(f"DIAS_EN_FEEDLOT: min={min(dias)}  max={max(dias)}  prom={sum(dias)/len(dias):.0f}")

    # 6. Sanity contra baseline conocido (de v15.2 standalone)
    n_pegsa  = sum(1 for r in regs if r.get("HOTELERO") == "PEGSA")
    n_haras  = sum(1 for r in regs if r.get("NOMBRE_CORRAL") == "El Haras")
    print(f"\n=== Sanity vs baseline v15.2 ===")
    print(f"  PEGSA: {n_pegsa} (baseline ~8973)")
    print(f"  El Haras: {n_haras} (baseline ~7963)")

    assert 8500 < n_pegsa  < 9500,  f"PEGSA fuera de rango esperado: {n_pegsa}"
    assert 7500 < n_haras < 8500,  f"El Haras fuera de rango: {n_haras}"

    print(f"\n[OK] v15.4 listo. extraer(df_override) integra el adapter al pipeline preservando las 6 transformaciones.")


if __name__ == "__main__":
    main()
