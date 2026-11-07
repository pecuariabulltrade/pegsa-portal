"""
v15.92 · test de WinCampoDiario (standalone, sin API real: nunca toca WinCampo).

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_v1592_wincampo_diario
"""
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import wincampo_source as ws


def egr(rfid, fecha, motivo="V", trans="T1", tropa="TR1"):
    return {"RFID": rfid, "NRO_CARAVANA": None, "NRO_TROPA": tropa, "FechaSalida": f"{fecha} 00:00:00.000",
            "NRO_TRANSACCION": trans, "MotivoSalida": motivo, "Categoria": "NT", "Estadia": 90,
            "KgIngreso": 200.0, "KgEgreso": 300.0, "HOTELERO": "PEGSA", "NRO_CORRAL": "5",
            "Diagnostico": None, "FechaIngreso": "2026-01-01"}


def ing(tropa, fecha, cant=30, kg=6000.0, cat="NT", hot="PEGSA"):
    return {"FechaIngreso": fecha, "hotelero": hot, "categoria": cat, "Cantidad": cant, "KgIngreso": kg,
            "NRO_TROPA": tropa, "Consignatario": "X"}


def gas(fecha, litros="10.0"):
    return {"INSUMO": "DIESEL", "FECHA": f"{fecha} 00:00:00.000", "CANTIDAD": litros, "DESC_VEHICULO": "M1"}


class FakeAPI:
    """Lo que devolvería WinCampo. Cuenta logins y requests; filtra por rango como el server."""
    def __init__(self):
        self.egresos, self.ingresos, self.gasoil = [], [], []
        self.stock = [{"RFID": "1", "CATEGORIA": "NT"}]
        self.insumos = [{"COD_INSUMO": "2", "STOCK": 1.0}]
        self.calls, self.logins = [], 0
        self.falla, self.falla_login = set(), False
        self.canario_pct = 100.0
        self.email = "api-elgarabi@wincampo.com"

    def __call__(self):             # hace de api_factory
        self.logins += 1
        if self.falla_login:
            raise RuntimeError("401")
        return self

    def _hit(self, n):
        self.calls.append(n)
        if n in self.falla:
            raise RuntimeError(f"{n} caído")

    def fetch_stock_hacienda(self):
        self._hit("stock"); return list(self.stock)

    def fetch_stock_insumos(self):
        self._hit("insumos"); return list(self.insumos)

    def fetch_egresos(self, fecha_desde, fecha_hasta):
        self._hit("egresos")
        return [r for r in self.egresos if fecha_desde <= r["FechaSalida"][:10] <= fecha_hasta]

    def fetch_ingresos(self, fecha_desde, fecha_hasta):
        self._hit("ingresos")
        self.ingresos_fechas = {"subgrupos": 10, "con_fecha": 10, "pct": self.canario_pct}
        return [r for r in self.ingresos if fecha_desde <= r["FechaIngreso"] <= fecha_hasta]

    def fetch_insumo_repartido(self, fd, fh):
        self._hit("gasoil")
        self.ult_gasoil = (fd, fh)
        return [r for r in self.gasoil if fd <= r["FECHA"][:10] <= fh]


def nuevo(tmp, api, cuando, forzar=False):
    api.calls = []
    api.logins = 0
    return ws.WinCampoDiario(tmp, forzar=forzar, ahora=cuando, api_factory=api)


def base_api():
    api = FakeAPI()
    api.egresos = [egr("A", "2024-03-01"), egr("B", "2026-11-01"), egr("C", "2026-11-05", motivo="M")]
    api.ingresos = [ing("TR1", "2024-02-01"), ing("TR2", "2026-10-20")]
    api.gasoil = [gas("2025-06-01"), gas("2026-10-31"), gas("2026-11-03")]
    return api


def t_primera_corrida_y_mismo_dia(tmp):
    api = base_api()
    w = nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    assert api.logins == 1
    assert api.calls.count("egresos") == 1 and api.calls.count("ingresos") == 1
    assert len(w.fetch_egresos("2024-01-01", "2026-11-06")) == 3
    assert len(w.fetch_muertes("2024-11-06", "2026-11-06")) == 1      # sin llamada
    assert api.calls.count("egresos") == 1
    u = json.loads((Path(tmp) / "wincampo_cache" / "ultima_consulta.json").read_text(encoding="utf-8"))
    assert u["fecha"] == "2026-11-06" and u["usuario"] == api.email and u["pendientes"] == []
    r = w.resumen()
    assert r["modo"] == "diario" and r["consultado"] == "06/11/2026 21:10"
    assert "wincampo.com" not in json.dumps(r), r      # el JSON es público

    w = nuevo(tmp, api, datetime(2026, 11, 6, 22, 0))
    assert api.logins == 0 and api.calls == [] and w.modo == "cache"
    assert len(w.fetch_stock_hacienda()) == 1 and len(w.gasoil_filas("2025-01-01")) == 3


def t_dia_siguiente_seis_llamadas(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    # antes de las 06:00 no consulta
    nuevo(tmp, api, datetime(2026, 11, 7, 5, 0))
    assert api.logins == 0
    api.egresos.append(egr("D", "2026-11-07"))
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0))
    assert api.logins == 1
    assert sorted(api.calls) == ["egresos", "gasoil", "ingresos", "insumos", "stock"], api.calls   # + login = 6
    assert len(w.fetch_egresos("2024-01-01", "2026-11-07")) == 4
    assert w.estado["llamadas"][0]["endpoint"] == "login" and len(w.estado["llamadas"]) == 6
    assert (Path(tmp) / "wincampo_cache" / "stock_2026-11-07.json").exists()
    nuevo(tmp, api, datetime(2026, 11, 7, 7, 0))
    assert api.logins == 0


def t_correcciones_en_la_ventana(tmp):
    """Lo que un merge por clave rompería: corregido, anulado, gemelos."""
    api = base_api()
    api.ingresos += [ing("TR3", "2026-10-25", cant=30), ing("TR3", "2026-10-25", cant=30)]   # 2 camiones iguales
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    w = nuevo(tmp, api, datetime(2026, 11, 6, 21, 20), forzar=True)
    assert w.modo == "forzado"
    assert len(w.fetch_ingresos("2024-01-01", "2026-11-06")) == 4, "los gemelos no se pisan"
    # corrigen la Cantidad de TR2 (parte de la clave) y anulan el egreso B
    api.ingresos = [r for r in api.ingresos if r["NRO_TROPA"] != "TR2"] + [ing("TR2", "2026-10-20", cant=29)]
    api.egresos = [r for r in api.egresos if r["RFID"] != "B"]
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0))
    ings = w.fetch_ingresos("2024-01-01", "2026-11-07")
    assert [r["Cantidad"] for r in ings if r["NRO_TROPA"] == "TR2"] == [29], "corregido no se duplica"
    assert "B" not in {r["RFID"] for r in w.fetch_egresos("2024-01-01", "2026-11-07")}, "anulado se va"
    assert "A" in {r["RFID"] for r in w.fetch_egresos("2024-01-01", "2026-11-07")}, "lo viejo queda"


def t_respuesta_vacia_no_borra(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    guardados, api.egresos = api.egresos, []
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0))
    assert w.estado["pendientes"] == ["egresos"]
    assert len(w.fetch_egresos("2024-01-01", "2026-11-07")) == 3
    api.egresos = guardados


def t_falla_parcial_reintenta_solo_eso_y_hasta_3(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    api.falla = {"stock"}
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0))
    assert w.estado["pendientes"] == ["stock"]
    assert w.resumen()["consultado"] == "06/11/2026 21:10", "no miente: stock es de ayer"
    assert len(w.fetch_stock_hacienda()) == 1, "sirve la foto de ayer"
    w = nuevo(tmp, api, datetime(2026, 11, 7, 7, 0))
    assert api.calls == ["stock"] and api.logins == 1
    nuevo(tmp, api, datetime(2026, 11, 7, 8, 0))
    assert api.calls == ["stock"]
    nuevo(tmp, api, datetime(2026, 11, 7, 9, 0))         # ya van 3 intentos
    assert api.calls == [] and api.logins == 0
    api.falla = set()
    w = nuevo(tmp, api, datetime(2026, 11, 8, 6, 0))     # otro día: todo de nuevo
    assert len(api.calls) == 5 and w.estado["pendientes"] == []
    assert w.resumen()["consultado"] == "08/11/2026 06:00"


def t_login_malo_no_insiste_y_no_tira_el_tick(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    api.falla_login = True
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0))
    assert w.estado["pendientes"] == list(ws.CONSULTAS)
    assert len(w.fetch_egresos("2024-01-01", "2026-11-07")) == 3
    for h in (7, 8, 9, 10):
        nuevo(tmp, api, datetime(2026, 11, 7, h, 0))
    assert api.logins == 0, "tras 3 intentos no pega más hasta el otro día"


def t_pausa_manda_sobre_todo(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    (Path(tmp) / "WINCAMPO_PAUSA.txt").write_text("x")
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0), forzar=True)
    assert api.logins == 0 and api.calls == [] and w.modo == "cache"
    assert len(w.fetch_egresos("2024-01-01", "2026-11-07")) == 3


def t_sin_cache_antes_de_hora_avisa(tmp):
    api = base_api()
    w = nuevo(tmp, api, datetime(2026, 11, 6, 3, 0))
    assert api.logins == 0
    try:
        w.fetch_egresos("2024-01-01", "2026-11-06")
    except RuntimeError as e:
        assert "no hay caché" in str(e)
    else:
        raise AssertionError("debía levantar")


def t_canario_fechas_no_envenena(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    api.canario_pct = 10.0
    api.ingresos.append(ing("TR9", "2026-11-06"))
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0))
    assert "ingresos" in w.estado["pendientes"] and w.ingresos_fechas["pct"] == 10.0
    assert "TR9" not in {r["NRO_TROPA"] for r in w.fetch_ingresos("2024-01-01", "2026-11-07")}


def t_gasoil_cruce_de_mes(tmp):
    """Lo cargado el 31 después de la consulta de las 06:00 entra el 1º."""
    api = base_api()
    nuevo(tmp, api, datetime(2026, 10, 31, 6, 0))
    api.gasoil.append(gas("2026-10-31", "99.0"))           # cargado a la tarde del 31
    w = nuevo(tmp, api, datetime(2026, 11, 1, 6, 0))
    assert api.ult_gasoil[0] <= "2026-10-31", api.ult_gasoil
    assert "99.0" in {r["CANTIDAD"] for r in w.gasoil_filas("2025-01-01")}
    # mes avanzado: pide el mes en curso, una llamada
    api.gasoil.append(gas("2026-11-19"))
    nuevo(tmp, api, datetime(2026, 11, 19, 6, 0))
    w = nuevo(tmp, api, datetime(2026, 11, 20, 6, 0))
    assert api.ult_gasoil[0] == "2026-11-01" and api.calls.count("gasoil") == 1


def t_gasoil_cruce_de_anio(tmp):
    api = FakeAPI()
    api.egresos, api.ingresos = [egr("A", "2026-12-20")], [ing("T", "2026-12-20")]
    api.gasoil = [gas("2025-06-01"), gas("2026-12-30")]
    nuevo(tmp, api, datetime(2026, 12, 31, 6, 0))
    api.gasoil += [gas("2026-12-31", "77.0"), gas("2027-01-01", "88.0")]
    w = nuevo(tmp, api, datetime(2027, 1, 1, 6, 0))
    assert api.calls.count("gasoil") == 1, "el 1/1 no hace falta bajar 2027 aparte"
    cant = {r["CANTIDAD"] for r in w.gasoil_filas("2025-01-01")}
    assert {"77.0", "88.0"} <= cant, cant
    n = [r["FECHA"][:10] for r in json.loads((Path(tmp) / "wincampo_cache" / "insumo_repartido_2027.json").read_text(encoding="utf-8"))]
    assert all(x.startswith("2027") for x in n), n


def t_gasoil_vacio_no_borra(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 21, 10))
    api.gasoil = []
    w = nuevo(tmp, api, datetime(2026, 11, 7, 6, 0))
    assert w.estado["pendientes"] == ["gasoil"]
    assert len(w.gasoil_filas("2025-01-01")) == 3


def t_fotos_viejas_se_podan(tmp):
    api = base_api()
    d = datetime(2026, 11, 1, 6, 0)
    for i in range(10):
        nuevo(tmp, api, d + timedelta(days=i))
    assert len(list((Path(tmp) / "wincampo_cache").glob("stock_*.json"))) == ws.FOTOS_A_CONSERVAR


def t_edad_cache(tmp):
    api = base_api()
    nuevo(tmp, api, datetime(2026, 11, 6, 6, 0))
    assert ws.cache_edad_horas(tmp, ahora=datetime(2026, 11, 7, 18, 0)) == 36.0
    assert ws.cache_edad_horas(tmp + "_no_existe") is None


def main():
    pruebas = [v for k, v in globals().items() if k.startswith("t_")]
    fallas = 0
    for t in pruebas:
        tmp = tempfile.mkdtemp(prefix="wc1592_")
        try:
            t(tmp)
            print(f"  ok   {t.__name__}")
        except Exception as e:
            fallas += 1
            print(f"  FALLA {t.__name__}: {type(e).__name__}: {e}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    print(f"{len(pruebas) - fallas}/{len(pruebas)} OK")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
