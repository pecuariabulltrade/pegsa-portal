import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Importar valores ANTES de correr main
from actualizar_datos import ADP_CAL_FALLBACK, _ADP_CAL_RUNTIME

# Antes del pipeline, _ADP_CAL_RUNTIME == ADP_CAL_FALLBACK
assert _ADP_CAL_RUNTIME == ADP_CAL_FALLBACK
print(f"OK pre-pipeline: _ADP_CAL_RUNTIME inicia como ADP_CAL_FALLBACK = {ADP_CAL_FALLBACK}")

# Simular el pre-step: cargar egresos y procesar_productivo
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

# Verificar que pc90 tiene adp_calibrado per cat
pc90 = prod.get('por_categoria_90d', {})
print(f"\nADP calibrado dinámico per cat:")
for cat in ['VA', 'TM', 'TH', 'NV', 'NT', 'VQ', 'TO']:
    cal = pc90.get(cat, {}).get('adp_calibrado')
    fb = ADP_CAL_FALLBACK.get(cat)
    print(f"  {cat}: dinámico={cal} fallback={fb}")
    assert cal is not None, f"{cat} no tiene adp_calibrado dinámico"
    # Debe estar dentro del rango [teo*0.85, teo*1.15]
    # Y dado que observado actual < teo*0.85 en TODAS, debería == teo*0.85 = fallback
    assert abs(cal - fb) < 0.001, f"{cat}: dinámico {cal} != fallback {fb} (HOY deberían coincidir porque observado < límite inferior)"
print("\nOK v15.13.2: dinámico per cat = límite inferior hoy (observado bajo el rango)")
print("Cuando el ADP observado suba por encima del fallback, el dinámico va a usar el observado real (clampeado ±15%)")
