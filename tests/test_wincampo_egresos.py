"""
Test standalone para fetch_egresos.

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_wincampo_egresos
"""

import sys
from pathlib import Path
from collections import Counter
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from wincampo_source import WinCampoAPI


def main():
    print("=== Test Egresos de Hacienda WinCampo Web ===\n")

    api = WinCampoAPI()
    print("Login OK\n")

    # Últimos 365 días (mismo periodo que usa procesar_productivo en el pipeline)
    hoy = date.today()
    desde = hoy - timedelta(days=365)
    print(f"Periodo: {desde} a {hoy}\n")

    egresos = api.fetch_egresos(fecha_desde=desde.isoformat(), fecha_hasta=hoy.isoformat())
    print(f"Total animales egresados (1 año): {len(egresos)}")
    assert len(egresos) > 100, f"Egresos muy bajos: {len(egresos)} — puede haber problema"

    # 3 muestras completas
    print("\n=== 3 muestras (primero, mediana, ultimo) ===")
    indices = [0, len(egresos)//2, len(egresos)-1]
    for i in indices:
        print(f"\n--- Animal egresado #{i+1} ---")
        for k, v in egresos[i].items():
            print(f"  {k}: {v!r}")

    # Motivos distintos
    motivos = Counter(e["MotivoSalida"] for e in egresos if e["MotivoSalida"])
    print(f"\n=== MotivoSalida distintos ({len(motivos)}) ===")
    for m, n in motivos.most_common():
        print(f"  {n:>6} - {m}")

    # Filtros de simulación del pipeline.
    # Discovery v15.3: la API entrega MOTIVO como CODIGO de 1 letra (V/T/M),
    # no como string largo "VENTA con destino frigorifico" como esperaba el
    # SQL viejo. El filtro debe ser exacto contra el código. Probamos las
    # dos formas — la "larga" debería dar 0 (confirma el discovery), la "corta"
    # las cuenta de verdad.
    def es_venta(m):
        if not m: return False
        u = m.upper().strip()
        return u == "V" or "VENTA" in u
    def es_muerte(m):
        if not m: return False
        u = m.upper().strip()
        return u == "M" or "MUERTE" in u or "DECESO" in u or "MUERTO" in u
    def es_traslado(m):
        if not m: return False
        u = m.upper().strip()
        return u == "T" or "TRASLADO" in u

    n_venta_largo = sum(1 for e in egresos if e["MotivoSalida"] and "VENTA" in e["MotivoSalida"].upper())
    n_venta = sum(1 for e in egresos if es_venta(e["MotivoSalida"]))
    n_muerte = sum(1 for e in egresos if es_muerte(e["MotivoSalida"]))
    n_traslado = sum(1 for e in egresos if es_traslado(e["MotivoSalida"]))
    print(f"\nSimulacion de filtros del pipeline:")
    print(f"  MOTIVO contiene 'VENTA' (filtro SQL viejo): {n_venta_largo}  <-- seguramente 0 en API Web")
    print(f"  MOTIVO codigo V o palabra VENTA:            {n_venta}   <-- procesar_productivo necesita esto")
    print(f"  MOTIVO codigo M o palabra MUERTE/DECESO:    {n_muerte}  <-- procesar_muertes necesita esto")
    print(f"  MOTIVO codigo T o palabra TRASLADO:         {n_traslado}")

    # Categorías de los VENTA (usando filtro corto)
    ventas = [e for e in egresos if es_venta(e["MotivoSalida"])]
    cats_venta = Counter(e["Categoria"] for e in ventas if e["Categoria"])
    print(f"\nVentas por categoria:")
    for c, n in cats_venta.most_common():
        print(f"  {c}: {n}")

    # ADP calculado — sanity check
    adps_venta = [e["AdpSinDebaste"] for e in ventas if e["AdpSinDebaste"] is not None]
    if adps_venta:
        prom = sum(adps_venta) / len(adps_venta)
        bajo = sum(1 for a in adps_venta if a <= 0)
        alto = sum(1 for a in adps_venta if a > 5)
        print(f"\nADP calculado (ventas unicamente, N={len(adps_venta)}):")
        print(f"  Promedio simple: {prom:.3f} kg/dia (esperado en rango razonable 1.0-1.6)")
        print(f"  Min: {min(adps_venta):.3f}  Max: {max(adps_venta):.3f}")
        print(f"  ADP <=0 (sospechoso): {bajo}")
        print(f"  ADP > 5 (atipico):    {alto}")

    # Integridad campos críticos para el pipeline
    sin_fecha    = sum(1 for e in egresos if not e["FechaSalida"])
    sin_motivo   = sum(1 for e in egresos if not e["MotivoSalida"])
    sin_estadia  = sum(1 for e in egresos if not e["Estadia"])
    sin_kgi      = sum(1 for e in egresos if e["KgIngreso"] is None)
    sin_kge      = sum(1 for e in egresos if e["KgEgreso"] is None)
    sin_rfid     = sum(1 for e in egresos if not e["RFID"])
    sin_cat      = sum(1 for e in egresos if not e["Categoria"])
    print(f"\nIntegridad:")
    print(f"  Sin FechaSalida:   {sin_fecha}")
    print(f"  Sin MotivoSalida:  {sin_motivo}")
    print(f"  Sin Estadia:       {sin_estadia}")
    print(f"  Sin KgIngreso:     {sin_kgi}")
    print(f"  Sin KgEgreso:      {sin_kge}")
    print(f"  Sin RFID:          {sin_rfid}")
    print(f"  Sin Categoria:     {sin_cat}")

    # Por hotelero
    by_hot = Counter(e["HOTELERO"] for e in egresos if e["HOTELERO"])
    print(f"\nEgresos por hotelero:")
    for h, n in by_hot.most_common():
        print(f"  {h}: {n}")

    print(f"\n[OK] Test OK. {len(egresos)} animales egresados ultimo ano, listos para el pipeline.")


if __name__ == "__main__":
    main()
