"""
v15.4.1 hotfix test: confirma que el adapter devuelve CANTIDAD/Cantidad = 1
en cada registro de Stock y Egresos.

Sin estos campos, calcular_kpis() (col_cab=None) y procesar_productivo()
(col_cab=None) dejan total_cabezas, total_kg_estimado_hoy, % peso vivo,
consumo/cab, conversion y producción diaria en 0/None.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from wincampo_source import WinCampoAPI


def main():
    api = WinCampoAPI()

    cabezas = api.fetch_stock_hacienda()
    assert cabezas, "Stock vacío — no se puede validar CANTIDAD"
    assert all(c.get("CANTIDAD") == 1 for c in cabezas), "CANTIDAD missing/wrong en Stock"
    print(f"OK Stock: {len(cabezas)} cabezas, todas con CANTIDAD=1")

    from datetime import date, timedelta
    fd = (date.today() - timedelta(days=30)).isoformat()
    fh = date.today().isoformat()
    egresos = api.fetch_egresos(fecha_desde=fd, fecha_hasta=fh)
    assert egresos, "Egresos vacío — no se puede validar Cantidad"
    assert all(e.get("Cantidad") == 1 for e in egresos), "Cantidad missing/wrong en Egresos"
    print(f"OK Egresos: {len(egresos)} en 30d, todos con Cantidad=1")

    print("\nv15.4.1 hotfix OK — ambos adapters devuelven cantidad=1 por cabeza")


if __name__ == "__main__":
    main()
