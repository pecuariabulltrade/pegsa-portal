import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd
from wincampo_source import WinCampoAPI
from actualizar_datos import extraer, ADP_CAL_POR_CAT, TECHO_KG_POR_CAT

api = WinCampoAPI()
df_stock = pd.DataFrame(api.fetch_stock_hacienda())
regs, cols = extraer("V_STOCK_HACIENDA", df_override=df_stock)

def es_haras(r):
    try: n = int(float(r.get("NRO_CORRAL") or 0)); return 1 <= n <= 199
    except: return False

haras = [r for r in regs if es_haras(r)]
total_kg = sum((r.get("KG_ESTIMADO_HOY") or 0) for r in haras)
total_cab = len(haras)
print(f"El Haras: {total_cab} cab / {total_kg:,.0f} kg / {total_kg/total_cab:.0f} kg/cab")
# Esperado: ~7900-8050 cab / ~3,78-3,80M kg / ~473-476 kg/cab
# (la cuenta de cabezas de El Haras deriva día a día con ingresos/egresos;
#  lo que valida v15.13 es la MASA, no el conteo exacto)
assert 3_650_000 < total_kg < 3_900_000, f"Total {total_kg} fuera de rango esperado [3.65M, 3.9M]"
assert 7800 < total_cab < 8200, f"Cab {total_cab} fuera de [7800, 8200]"
# Por categoría no debe haber ninguno por encima del techo correspondiente
from collections import defaultdict
por_cat_max = defaultdict(float)
for r in haras:
    cat = str(r.get("CATEGORIA") or "").strip().upper()
    kg = r.get("KG_ESTIMADO_HOY") or 0
    if kg > por_cat_max[cat]: por_cat_max[cat] = kg
for cat, max_kg in por_cat_max.items():
    techo = TECHO_KG_POR_CAT.get(cat, 999)
    assert max_kg <= techo + 0.01, f"Cat {cat} máximo {max_kg} > techo {techo}"
print("OK v15.13: todos respetan los techos por categoría")
