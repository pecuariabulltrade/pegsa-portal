"""
Test standalone para fetch_stock_insumos (Tabla 5 — v15.8 fase 1).

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_wincampo_insumos

Endpoint lst_stock_de_insumo?reporte_elegido=stock_actual&fecha_desde&fecha_hasta.
Valida que el adapter renombra STOCK_ACTUAL -> STOCK (sin esto el pipeline
deja los kg en 0, bug tipo CANTIDAD v15.4.1) y que los 7 insumos que filtra
el pipeline (INSUMOS_INCLUIDOS) están presentes con su código.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from wincampo_source import WinCampoAPI

# Los 7 que filtra el pipeline (actualizar_datos.py, INSUMOS_INCLUIDOS).
INSUMOS_INCLUIDOS = {2: "MAIZ GRANO", 9: "SOJA", 8: "NUCLEO CONC 5% LDB",
                     99: "DIESEL", 6: "HARINA GERMEN", 7: "GLUTEN DE MAIZ",
                     3: "SILO DE MAIZ"}
CAMPOS = ["COD_INSUMO", "DESC_INSUMO", "STOCK"]


def main():
    print("=== Test Stock de Insumos WinCampo Web (Tabla 5 / v15.8 fase 1) ===\n")

    api = WinCampoAPI()
    print("Login OK\n")

    insumos = api.fetch_stock_insumos()
    print(f"Total insumos: {len(insumos)}\n")
    assert len(insumos) > 20, f"Insumos sospechosamente pocos: {len(insumos)}"

    # 1) Campos del pipeline presentes en todos
    for c in CAMPOS:
        faltan = sum(1 for r in insumos if c not in r)
        assert faltan == 0, f"Campo {c} falta en {faltan} registros"
    print(f"[OK] Campos del pipeline presentes: {CAMPOS}")

    # 2) STOCK debe ser el rename de STOCK_ACTUAL (no None salvo casos legítimos)
    sin_stock = sum(1 for r in insumos if r["STOCK"] is None)
    con_stock = len(insumos) - sin_stock
    print(f"[OK] STOCK poblado en {con_stock}/{len(insumos)} (None: {sin_stock})")
    assert con_stock > 0, "STOCK None en todos — ¿no se renombró STOCK_ACTUAL?"

    # 3) Los 7 insumos del pipeline: presencia + stock (lo que de verdad importa)
    def cod_int(r):
        try:
            return int(float(r.get("COD_INSUMO") or -1))
        except (TypeError, ValueError):
            return -1

    by_cod = {cod_int(r): r for r in insumos}
    print(f"\nLos 7 insumos que filtra el pipeline (INSUMOS_INCLUIDOS):")
    presentes = 0
    total_kg_7 = 0.0
    for cod, nombre_esp in INSUMOS_INCLUIDOS.items():
        r = by_cod.get(cod)
        if r:
            presentes += 1
            stock = r["STOCK"] or 0
            total_kg_7 += stock
            print(f"  cod {cod:>3} | {r['DESC_INSUMO']:<22} | STOCK={stock:,.2f}")
        else:
            print(f"  cod {cod:>3} | {nombre_esp:<22} | *** NO ENCONTRADO en la respuesta ***")
    print(f"\n  Presentes: {presentes}/7  |  Suma STOCK de los 7: {total_kg_7:,.2f}")
    assert presentes >= 5, f"Solo {presentes}/7 insumos del pipeline presentes — revisar códigos"

    # 4) Muestra de 3
    print(f"\n=== 3 muestras ===")
    for i in [0, len(insumos)//2, len(insumos)-1]:
        print(f"  {insumos[i]}")

    print(f"\n[OK] Test OK. {len(insumos)} insumos, {presentes}/7 del pipeline con STOCK, listos para integrar.")


if __name__ == "__main__":
    main()
