"""
v15.5.1 HOTFIX test: confirma que adp_teorico se recupera para las 7 categorías
tras el mapeo código->largo (TM->TERNERO, etc.) en los lookups de _ADP_TEO/_CAT_FILTROS.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from datetime import date, timedelta
import pandas as pd
from wincampo_source import WinCampoAPI
from actualizar_datos import extraer, procesar_productivo

api = WinCampoAPI()
fd = (date.today() - timedelta(days=730)).isoformat()
fh = date.today().isoformat()
df_egr = pd.DataFrame(api.fetch_egresos(fecha_desde=fd, fecha_hasta=fh))
regs_egr, cols_egr = extraer("v_PB_Egresos", fecha_col="FechaSalida", dias=730, df_override=df_egr)
prod = procesar_productivo(regs_egr, cols_egr, "2025")

pc90 = prod.get('por_categoria_90d', {})
print(f"Categorías: {sorted(pc90.keys())}")
ESPERADO = {'TM': 1.371, 'TH': 1.324, 'NT': 1.489, 'NV': 1.231,
            'VQ': 1.346, 'VA': 1.399, 'TO': 1.60}
for cat, esperado in ESPERADO.items():
    v = pc90.get(cat, {})
    teo = v.get('adp_teorico')
    cal = v.get('adp_calibrado')
    obs = v.get('adp_promedio')
    aj = v.get('ajustado')
    print(f"  {cat}: teo={teo} (esperado {esperado}), obs={obs}, calibrado={cal}, ajustado={aj}")
    assert teo == esperado, f"BUG {cat}: teo={teo} != esperado {esperado}"
    assert cal is not None and cal > 0

print("\nOK v15.5.1: todos los adp_teorico recuperados, filtros per-cat aplicados")
