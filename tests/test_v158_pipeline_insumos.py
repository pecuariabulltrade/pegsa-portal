"""
v15.8 fase 2 · test end-to-end de Stock Insumos integrado al pipeline (sin SQL).

Path real: fetch_stock_insumos -> extraer(df_override, conn=None) -> filtro
INSUMOS_INCLUIDOS (replicado del módulo 5 de actualizar_datos.py).

Verifica que extraer preserva COD_INSUMO/DESC_INSUMO/STOCK y que los 7 insumos
filtrados salen con stock > 0 (salvo SOJA ~0/negativa, agotada). Confirma que
el rename STOCK_ACTUAL->STOCK del adapter sobrevive a extraer().
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from wincampo_source import WinCampoAPI
from actualizar_datos import extraer

# Igual que el pipeline (módulo 5).
INSUMOS_INCLUIDOS = {2, 9, 8, 99, 6, 7, 3}


def main():
    api = WinCampoAPI()
    df_ins = pd.DataFrame(api.fetch_stock_insumos())
    assert "STOCK" in df_ins.columns, "Falta STOCK (¿no se renombró STOCK_ACTUAL?)"

    # conn=None garantiza que no se toca SQL.
    regs_ins, cols_ins = extraer(None, "v_PB_StockInsumo", df_override=df_ins)
    assert regs_ins, "extraer() devolvió 0 insumos"
    assert "STOCK" in cols_ins, "STOCK no sobrevivió a extraer()"
    assert "COD_INSUMO" in cols_ins and "DESC_INSUMO" in cols_ins

    # Replica del filtro inline del pipeline (col_cod=COD_INSUMO, col_stock=STOCK).
    insumos, total_kg = [], 0.0
    for r in regs_ins:
        try:
            cod = int(float(r.get("COD_INSUMO") or -1))
        except (TypeError, ValueError):
            cod = -1
        if cod not in INSUMOS_INCLUIDOS:
            continue
        stock = round(float(r.get("STOCK") or 0), 2)
        insumos.append({"cod": cod, "nombre": str(r.get("DESC_INSUMO") or "").strip(), "stock_kg": stock})
        total_kg += stock

    print(f"insumos crudos: {len(regs_ins)}  | filtrados (7 del pipeline): {len(insumos)}")
    for i in sorted(insumos, key=lambda x: -x["stock_kg"]):
        print(f"  cod {i['cod']:>3} | {i['nombre']:<22} | {i['stock_kg']:,.2f} kg")
    print(f"  total_kg: {total_kg:,.2f}")

    assert len(insumos) >= 6, f"Solo {len(insumos)} de 7 insumos filtrados — revisar códigos/STOCK"
    assert total_kg > 1_000_000, f"total_kg sospechosamente bajo: {total_kg:,.2f}"
    # Al menos los pesados (MAIZ, SILO) con stock grande
    con_stock_grande = sum(1 for i in insumos if i["stock_kg"] > 50_000)
    assert con_stock_grande >= 3, f"Pocos insumos con stock grande: {con_stock_grande}"

    print(f"\nv15.8 fase 2 OK — {len(insumos)}/7 insumos, total {total_kg:,.0f} kg, STOCK preservado por extraer")


if __name__ == "__main__":
    main()
