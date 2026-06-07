"""
v15.4.2: verifica que el pipeline tolera SQL down.
- conectar(cfg con credenciales falsas) -> None (no sys.exit)
- extraer(conn=None, "v_PB_StockInsumo") -> ([], []) con warning
- extraer(conn=None, "V_STOCK_HACIENDA", df_override=df) -> procesa normalmente

Nota: Test 1 puede tardar ~40s (timeout 20s x 2 connection strings). Es esperado.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import configparser
from actualizar_datos import conectar, extraer


def main():
    # Test 1: conectar con SQL inexistente NO debe sys.exit
    cfg = configparser.ConfigParser()
    cfg['SQL'] = {
        'servidor': 'SERVIDOR_INEXISTENTE_TEST',
        'base_datos': 'NADA',
        'autenticacion': 'sql',
        'usuario': 'x', 'contrasena': 'x'
    }
    conn = conectar(cfg)
    assert conn is None, "conectar deberia devolver None si SQL no responde"
    print("OK Test 1: conectar() devuelve None sin sys.exit")

    # Test 2: extraer con conn=None y sin df_override devuelve ([], [])
    regs, cols = extraer(None, "v_PB_StockInsumo")
    assert regs == [] and cols == [], f"Expected ([], []), got ({regs}, {cols})"
    print("OK Test 2: extraer(None, tabla) skipea limpio")

    # Test 3: extraer con conn=None pero df_override SI procesa
    import pandas as pd
    df_fake = pd.DataFrame([
        {"NRO_CORRAL": "1", "HOTELERO": "PEGSA", "CATEGORIA": "TM",
         "KG_INGRESO": 132.0, "FECHA_INGRESO": "2025-08-06", "CANTIDAD": 1}
    ])
    regs, cols = extraer(None, "V_STOCK_HACIENDA", df_override=df_fake)
    assert len(regs) == 1, f"Expected 1 fila, got {len(regs)}"
    print(f"OK Test 3: extraer(None, ..., df_override=df) sigue funcionando - {len(regs)} fila")

    print("\nv15.4.2 OK: pipeline tolera SQL down")


if __name__ == "__main__":
    main()
