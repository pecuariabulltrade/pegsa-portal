"""
wincampo_source.py — Adapter para la API REST de WinCampo Web.

Reemplaza progresivamente las lecturas SQL del pipeline `actualizar_datos.py`.
Cada método público devuelve datos en el MISMO shape que devolvía la vista SQL
correspondiente.

Tabla 1 (v15.2):
  - fetch_stock_hacienda(fecha) → reemplazo de SELECT * FROM V_STOCK_HACIENDA
    Devuelve ~9974 filas individuales con RFID único por cabeza.
"""

import os
import time
import logging
from datetime import date
from pathlib import Path

import requests
from dotenv import load_dotenv

log = logging.getLogger(__name__)

_repo_root = Path(__file__).resolve().parent
load_dotenv(_repo_root / ".env")

API_BASE = "https://elgarabi-api.wincampo.com/api/"
RATE_LIMIT_SLEEP = 0.3
TIMEOUT_DEFAULT = 90  # el endpoint de stock puede tardar — animal por animal

# v15.46: corrales que NO representan stock productivo real y se excluyen de
# todos los KPIs. El corral 10000 es un corral virtual de WinCampo: al
# 2026-07-30 tenía 179 cabezas de la tropa PEG.DES.19/02/26 que el usuario
# decidió NO contabilizar. Si aparece otro corral virtual, agregarlo acá.
CORRALES_EXCLUIDOS = {"10000"}


# v15.16 · Consolidación de hoteleros para reportes de hacienda.
# BULLTRADE SRL forma parte del mismo grupo PEGSA a fines productivos
# (stock, kg, ADP, eficiencia, histórico). Las cuentas bancarias de
# Bulltrade y la consignataria Bulltrade mantienen entidad separada
# en el módulo Tesorería; el alcance acá es solo hacienda.
HOTELEROS_CONSOLIDADOS_A_PEGSA = {"BULLTRADE SRL", "BULLTRADE", "BULL TRADE SRL"}


def consolidar_hotelero(nombre):
    """Mapea hoteleros del set a 'PEGSA'. Idempotente, case-insensitive.
    None → None. Otros valores pasan sin cambio (preservando case original).
    """
    if nombre is None:
        return None
    s = str(nombre).strip()
    if not s:
        return None
    if s.upper() in HOTELEROS_CONSOLIDADOS_A_PEGSA:
        return "PEGSA"
    return s


class WinCampoAPI:
    def __init__(self, email=None, password=None):
        self.email = email or os.environ["WINCAMPO_EMAIL"]
        self.password = password or os.environ["WINCAMPO_PASSWORD"]
        self.token = None
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json",
        })
        self._login()

    def _login(self):
        r = self.session.post(
            API_BASE + "login",
            json={"email": self.email, "password": self.password, "idioma": "es"},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        # Verificado 2026-06-06: la API devuelve una lista de longitud 1 con un
        # dict {nombre, empresa, establecimiento, token, refresh_token, api, …}
        # (no un dict pelado como típicamente esperaría un cliente JWT).
        if isinstance(data, list):
            if not data:
                raise RuntimeError("Login devolvió lista vacía")
            data = data[0]
        if not isinstance(data, dict):
            raise RuntimeError(f"Login con shape inesperado: {type(data).__name__}")
        self.token = data.get("token") or data.get("access_token") or data.get("jwt")
        if not self.token:
            raise RuntimeError(f"Login devolvió sin token. Keys: {list(data.keys())}")
        self.session.headers["Authorization"] = f"Bearer {self.token}"
        log.info("WinCampo login OK (user=%s)", data.get("nombre") or self.email)

    def _get(self, path, params=None, retry_on_401=True, _retry_left=3):
        # v15.7.3: retry con backoff exponencial (1s/3s/9s) ante hiccups
        # transitorios de la API (ChunkedEncodingError, ConnectionError, Timeout,
        # HTTP 502/503/504). El tick 13:00 del 2026-06-08 abortó por un
        # ChunkedEncodingError en un chunk de egresos. Errores NO transitorios
        # (4xx, JSON malo) propagan inmediato para no enmascarar bugs reales.
        # Los waits del backoff son ADICIONALES al RATE_LIMIT_SLEEP del path normal.
        url = API_BASE + path.lstrip("/")
        try:
            time.sleep(RATE_LIMIT_SLEEP)
            r = self.session.get(url, params=params, timeout=TIMEOUT_DEFAULT)
            if r.status_code == 401 and retry_on_401:
                log.info("Token expirado, re-login")
                self._login()
                return self._get(path, params=params, retry_on_401=False, _retry_left=_retry_left)
            if r.status_code in (502, 503, 504):
                # gateway/unavailable/timeout — transitorio, forzar reintento
                raise requests.exceptions.HTTPError(f"HTTP {r.status_code}", response=r)
            r.raise_for_status()
            return r.json()
        except (requests.exceptions.ChunkedEncodingError,
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.HTTPError) as e:
            # HTTPError no-5xx (p.ej. 4xx) = bug real → propagar sin reintentar
            if isinstance(e, requests.exceptions.HTTPError) and e.response is not None \
                    and not (500 <= e.response.status_code < 600):
                raise
            if _retry_left <= 0:
                log.error(f"  {path}: agotados reintentos tras transitorio ({type(e).__name__})")
                raise
            wait_s = {3: 1, 2: 3, 1: 9}[_retry_left]
            log.warning(f"  {path}: transitorio ({type(e).__name__}), retry en {wait_s}s ({_retry_left} intentos restantes)")
            time.sleep(wait_s)
            return self._get(path, params=params, retry_on_401=retry_on_401, _retry_left=_retry_left - 1)

    # ════════════════════════════════════════════════════════════════
    #  TABLA 1 — Stock Hacienda (detalle individual por cabeza)
    # ════════════════════════════════════════════════════════════════
    def fetch_stock_hacienda(self, fecha=None):
        """
        Reemplazo de SELECT * FROM V_STOCK_HACIENDA.

        v15.46 — Migrado de `lst_stock_de_hacienda` (reporte_elegido=detallado_caravana)
        a `caravanas_stock`.

        MOTIVO: el 2026-07-29 WinCampo movió el reporte "Stock detallado de Caravanas"
        a una cola asincrónica. El camino sincrónico viejo quedó colgado
        indefinidamente (ReadTimeout con 90s y con 300s) y el portal se congeló 24h.
        El submit asincrónico tampoco encola desde un cliente HTTP plano.

        `caravanas_stock` es el endpoint que alimenta la pantalla
        "Explorador de Caravanas en Stock" (#/grafico_stock_caravanas). Devuelve
        EL MISMO dataset caravana por caravana, sincrónico, en ~5-7 segundos,
        sin query params.

        Verificado 2026-07-30: 9491 filas, paridad exacta por propietario y por
        establecimiento contra el último stock_kpis bueno del 2026-07-29.

        Args:
            fecha: ignorado. El endpoint devuelve el stock ACTUAL (no acepta fecha).
                   Se mantiene en la firma por compatibilidad con los llamadores.

        Returns:
            list[dict] — mismo shape que antes (ver _normalizar_row).
        """
        # El endpoint no acepta query params: devuelve el stock vivo completo.
        # _get usa TIMEOUT_DEFAULT (90s); el endpoint responde en 5-7s.
        data = self._get("caravanas_stock", params=None)

        if not isinstance(data, dict):
            raise RuntimeError(f"Response de caravanas_stock no es dict: {type(data)}")

        arr = data.get("data", [])
        if not isinstance(arr, list):
            raise RuntimeError(
                f"caravanas_stock: 'data' no es lista. Keys top: {list(data.keys())}"
            )

        total = data.get("total")
        if total is not None and total != len(arr):
            log.warning(f"caravanas_stock: total={total} pero data trae {len(arr)} filas")

        if not arr:
            log.warning("WinCampo devolvió 0 cabezas en caravanas_stock")
            return []

        # v15.46: excluir corrales que no son stock real (ver CORRALES_EXCLUIDOS)
        antes = len(arr)
        arr = [x for x in arr
               if str(x.get("NRO_CORRAL") or "").strip() not in CORRALES_EXCLUIDOS]
        excluidas = antes - len(arr)
        if excluidas:
            log.info(f"  Excluidas {excluidas} cabezas de corrales no productivos "
                     f"({', '.join(sorted(CORRALES_EXCLUIDOS))})")

        log.info(f"Stock hacienda (caravanas_stock): {len(arr)} cabezas individuales")

        return [self._normalizar_row(x) for x in arr]

    def _normalizar_row(self, x):
        """
        Normaliza una fila de `caravanas_stock` al shape esperado por el pipeline.

        v15.46: los nombres de campo del endpoint nuevo difieren en 3 casos
        respecto de `lst_stock_de_hacienda`:
            CATEGORIA  ← CATEGORIA_ACTUAL   (== CATEGORIA_INGRESO en 9491/9491 filas)
            RAZA       ← RAZA               (antes DESC_RAZA; viene null siempre,
                                             el pipeline no la consume)
            ORIGEN     ← CARAVANA_ORIGEN    (el pipeline no consume ORIGEN en stock;
                                             ORIGEN sí se usa pero en el módulo de
                                             ingresos, que tiene su propio adapter)
        Todo el resto conserva el mismo nombre.
        """
        kg_ing = x.get("KG_INGRESO")
        try:
            kg_ing = float(kg_ing) if kg_ing not in (None, "") else None
        except (TypeError, ValueError):
            kg_ing = None

        # "2026-05-06 00:00:00.000" → "2026-05-06"
        fecha = x.get("FECHA_INGRESO")
        if hasattr(fecha, "isoformat"):
            fecha = fecha.isoformat()
        elif fecha is not None:
            fecha = str(fecha).strip()[:10] or None

        categoria = x.get("CATEGORIA_ACTUAL") or x.get("CATEGORIA_INGRESO")

        return {
            # 5 críticos del pipeline (mismas keys que V_STOCK_HACIENDA del SQL viejo)
            "NRO_CORRAL":    str(x.get("NRO_CORRAL") or "").strip() or None,
            # v15.16: BULLTRADE SRL → PEGSA en hacienda
            "HOTELERO":      consolidar_hotelero(x.get("HOTELERO")),
            "CATEGORIA":     categoria,
            "KG_INGRESO":    kg_ing,
            "FECHA_INGRESO": fecha,
            # v15.4.1: cada cabeza individual = 1 cabeza (calcular_kpis multiplica por esto)
            "CANTIDAD":      1,
            # Extras preservados
            "RFID":          str(x.get("RFID") or "").strip() or None,
            "NRO_CARAVANA":  x.get("NRO_CARAVANA"),
            "NRO_TROPA":     x.get("NRO_TROPA"),
            "SEXO":          x.get("SEXO"),
            "RAZA":          x.get("RAZA"),
            "ORIGEN":        x.get("CARAVANA_ORIGEN"),
        }

    # ════════════════════════════════════════════════════════════════
    #  TABLA 2 — Egresos de Hacienda (ventas + muertes + traslados)
    # ════════════════════════════════════════════════════════════════
    def fetch_egresos(self, fecha_desde=None, fecha_hasta=None):
        """
        Reemplazo de SELECT * FROM v_PB_Egresos.

        Devuelve lista PLANA de animales egresados en el rango de fechas.
        Aplana la jerarquía hotelero → tropa → detalle del response.
        Calcula AdpSinDebaste localmente como (KILOS_EGRESO - KILOS_INGRESO) / DIAS.

        Filtros se aplican en el pipeline (no acá). Esta función trae TODO
        (ventas + muertes + traslados + ajustes) — los consumidores filtran:
          - procesar_productivo: MOTIVO contiene "VENTA"
          - procesar_muertes:    MOTIVO contiene palabras de muerte

        Args:
            fecha_desde: ISO date string (YYYY-MM-DD). Por default hoy - 365 días.
            fecha_hasta: ISO date string. Por default hoy.

        Returns:
            list[dict] con keys que necesita el pipeline:
                FechaSalida    (str ISO date) = FECHA_EGRESO
                MotivoSalida   (str)         = MOTIVO
                Estadia        (int)         = DIAS
                KgIngreso      (float)       = KILOS_INGRESO
                KgEgreso       (float)       = KILOS_EGRESO
                AdpSinDebaste  (float)       = (KgEgreso - KgIngreso) / Estadia
                Categoria      (str)         = CATEGORIA
                RFID           (str)         = RFID
                HOTELERO       (str)
                NRO_CORRAL     (str)
                NRO_TROPA      (str)
                NRO_CARAVANA   (str)
                Diagnostico    (str)         = DIAGNOSTICO
                Destino        (str)         = DESTINO
                Consignatario  (str)         = CONSIGNATARIO
                Origen         (str)         = ORIGEN
        """
        from datetime import date, timedelta, datetime as _dt

        if not fecha_hasta:
            fecha_hasta = date.today().isoformat()
        if not fecha_desde:
            fecha_desde = (date.today() - timedelta(days=365)).isoformat()

        # v15.5: Cap empirico del rango — el endpoint /api/lst_egresos_hacienda
        # devuelve HTTP 500 si pedimos > 500 dias. Verificado 2026-06-06:
        # 500d=32682 egresos OK, 600d=500 Internal Server Error. Si el caller
        # pide mas, chunkeamos automaticamente y concatenamos.
        MAX_RANGE_DAYS = 500
        try:
            fd_d = _dt.strptime(fecha_desde, "%Y-%m-%d").date()
            fh_d = _dt.strptime(fecha_hasta, "%Y-%m-%d").date()
        except ValueError:
            raise RuntimeError(f"fechas en formato YYYY-MM-DD esperadas, recibido: {fecha_desde} / {fecha_hasta}")
        rango_total = (fh_d - fd_d).days
        if rango_total > MAX_RANGE_DAYS:
            log.info(f"Egresos: rango {rango_total}d > {MAX_RANGE_DAYS}d - chunkeando")
            salida = []
            cursor = fd_d
            while cursor <= fh_d:
                chunk_end = min(cursor + timedelta(days=MAX_RANGE_DAYS - 1), fh_d)
                salida.extend(self._fetch_egresos_chunk(cursor.isoformat(), chunk_end.isoformat()))
                cursor = chunk_end + timedelta(days=1)
            log.info(f"Egresos {fecha_desde} a {fecha_hasta}: {len(salida)} animales (chunkeado)")
            return salida

        salida = self._fetch_egresos_chunk(fecha_desde, fecha_hasta)
        log.info(f"Egresos {fecha_desde} a {fecha_hasta}: {len(salida)} animales")
        return salida

    def _fetch_egresos_chunk(self, fecha_desde, fecha_hasta):
        """Una sola request al endpoint con rango <= MAX_RANGE_DAYS dias."""
        # Convertir YYYY-MM-DD → YYYYMMDD (formato del endpoint)
        def _to_compact(s):
            return s.replace("-", "")

        params = {
            "fecha_desde": _to_compact(fecha_desde),
            "fecha_hasta": _to_compact(fecha_hasta),
            "filtro_tropa_caravana": "por_caravana",
        }
        data = self._get("lst_egresos_hacienda", params=params)

        # Shape: { "lst_egresos_hacienda": [ { HOTELERO, tropas: [ { NRO_TROPA, detalle: [...] } ] } ] }
        raiz = data.get("lst_egresos_hacienda") if isinstance(data, dict) else None
        if not isinstance(raiz, list):
            raise RuntimeError(f"Egresos: response sin lst_egresos_hacienda lista. Keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")

        # Aplanar
        salida = []
        for hot_block in raiz:
            tropas = hot_block.get("tropas") or []
            for tropa in tropas:
                detalle = tropa.get("detalle") or []
                for animal in detalle:
                    salida.append(self._normalizar_egreso(animal))

        return salida

    def _normalizar_egreso(self, x):
        """Normaliza una fila del detalle de egreso. Calcula ADP."""
        def f(*keys):
            for k in keys:
                if k in x and x[k] not in (None, ""):
                    try:
                        return float(x[k])
                    except (TypeError, ValueError):
                        return None
            return None

        def s(*keys):
            for k in keys:
                if k in x and x[k] not in (None, ""):
                    return str(x[k])
            return None

        def i(*keys):
            for k in keys:
                if k in x and x[k] not in (None, ""):
                    try:
                        return int(float(x[k]))
                    except (TypeError, ValueError):
                        return None
            return None

        kg_ing = f("KILOS_INGRESO")
        kg_egr = f("KILOS_EGRESO")
        dias = i("DIAS")
        adp = None
        if kg_ing is not None and kg_egr is not None and dias and dias > 0:
            adp = round((kg_egr - kg_ing) / dias, 4)

        return {
            # Compatible con v_PB_Egresos (keys que espera procesar_productivo/procesar_muertes)
            "FechaSalida":    s("FECHA_EGRESO"),
            "MotivoSalida":   s("MOTIVO"),
            "Estadia":        dias,
            "KgIngreso":      kg_ing,
            "KgEgreso":       kg_egr,
            "AdpSinDebaste":  adp,
            "Categoria":      s("CATEGORIA"),
            "RFID":           s("RFID"),
            # v15.4.1 HOTFIX: procesar_productivo (líneas 669, 689) y
            # procesar_movimientos (línea 1562) buscan
            # _find("Cantidad", "cantidad", "cabezas", "nro_cab", "cant"). El SQL
            # viejo traía Cantidad por animal. Cada egreso del adapter = 1 cabeza.
            "Cantidad":       1,
            # Extras útiles para otros consumidores
            # v15.16: BULLTRADE SRL → PEGSA en hacienda
            "HOTELERO":       consolidar_hotelero(s("HOTELERO")),
            "NRO_CORRAL":     s("NRO_CORRAL"),
            "NRO_TROPA":      s("NRO_TROPA"),
            "NRO_CARAVANA":   s("NRO_CARAVANA"),
            "Diagnostico":    s("DIAGNOSTICO"),
            "Destino":        s("DESTINO"),
            "Consignatario":  s("CONSIGNATARIO"),
            "Origen":         s("ORIGEN"),
            "FechaIngreso":   s("FECHA_INGRESO"),
            # v15.37: nro de transacción de venta (≈ remito) para agrupar el
            # detalle de egresos del módulo Movimientos. El endpoint NO expone
            # DTE de egreso; NRO_TRANSACCION es el id de venta real (1 por
            # evento documental, ~27 en 15d vs ~212 agrupando por tropa).
            "NRO_TRANSACCION": s("NRO_TRANSACCION"),
        }

    # ════════════════════════════════════════════════════════════════
    #  TABLA 3 — Ingresos de Hacienda (movimientos de entrada)
    # ════════════════════════════════════════════════════════════════
    def fetch_ingresos(self, fecha_desde=None, fecha_hasta=None):
        """
        Reemplazo de SELECT * FROM v_PB_Ingresos.

        Devuelve lista PLANA de SUB-GRUPOS de ingreso (camión × categoría),
        NO una fila por cabeza individual (a diferencia de fetch_stock_hacienda).
        Cada fila = "N cabezas de categoría X que llegaron en este camión-tropa".
        Por eso Cantidad es el ENTERO REAL del sub-grupo, no 1.

        Aplana la jerarquía tropa → CAMIONES[]. CONSIGNATARIO, PROVEEDOR y
        FECHA_INGRESO viven a nivel tropa y se heredan a cada sub-grupo;
        CATEGORIA, CANTIDAD y KILOS_CAMION_PARCIAL viven a nivel camión.

        El endpoint lst_movimiento_hacienda NO tiene cap de rango (a diferencia
        de lst_egresos_hacienda que corta a 500d). Verificado 2026-06-08:
        730d = 540 tropas / 49.965 cabezas, status 200. Pide 730d directo.

        Filtros se aplican en el pipeline (no acá):
          - procesar_movimientos: CONSIGNATARIA_EXCLUIR = {"destete","traslado"}

        Args:
            fecha_desde: ISO date string (YYYY-MM-DD). Por default hoy - 365 días.
            fecha_hasta: ISO date string. Por default hoy.

        Returns:
            list[dict] con keys que necesita el pipeline (procesar_movimientos,
            líneas 673-689):
                FechaIngreso  (str ISO date) = tropa.FECHA_INGRESO (parseado)
                hotelero      (str)          = tropa.HOTELERO
                categoria     (str)          = camion.CATEGORIA
                Cantidad      (int)          = camion.CANTIDAD (real, NO 1)
                KgIngreso     (float)        = camion.KILOS_CAMION_PARCIAL (total sub-grupo)
                Consignatario (str)          = tropa.CONSIGNATARIO (heredado; campo filtro)
                Proveedor     (str)          = tropa.PROVEEDOR (heredado)
                + extras: NRO_TROPA, NRO_CORRAL, ORIGEN, DESTINO_COMPRA,
                          LOCALIDAD, TRANSPORTISTA, PROMEDIO
        """
        from datetime import date, timedelta

        if not fecha_hasta:
            fecha_hasta = date.today().isoformat()
        if not fecha_desde:
            fecha_desde = (date.today() - timedelta(days=365)).isoformat()

        def _to_compact(s):
            return s.replace("-", "")

        params = {
            "fecha_desde":     _to_compact(fecha_desde),
            "fecha_hasta":     _to_compact(fecha_hasta),
            "reporte_elegido": "ingreso_hacienda",
            "agrupado":        "N",
            "visualiza_dte":   "N",
        }
        data = self._get("lst_movimiento_hacienda", params=params)

        # Shape: { "lst_movimiento_hacienda": [ { ...tropa..., CAMIONES: [ {...sub-grupo...} ] } ] }
        raiz = data.get("lst_movimiento_hacienda") if isinstance(data, dict) else None
        if not isinstance(raiz, list):
            raise RuntimeError(f"Ingresos: response sin lst_movimiento_hacienda lista. Keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")

        salida = []
        for tropa in raiz:
            camiones = tropa.get("CAMIONES") or []
            for camion in camiones:
                salida.append(self._normalizar_ingreso(tropa, camion))

        log.info(f"Ingresos {fecha_desde} a {fecha_hasta}: {len(salida)} sub-grupos (camion x categoria)")
        return salida

    def _normalizar_ingreso(self, tropa, camion):
        """
        Normaliza un sub-grupo de ingreso (camión × categoría) al shape del pipeline.
        Recibe el dict de la tropa (padre) y el del camión (hijo).
        """
        def _f(d, *keys):
            for k in keys:
                if k in d and d[k] not in (None, ""):
                    try:
                        return float(d[k])
                    except (TypeError, ValueError):
                        return None
            return None

        def _s(d, *keys):
            for k in keys:
                if k in d and d[k] not in (None, ""):
                    return str(d[k]).strip() or None
            return None

        def _i(d, *keys):
            for k in keys:
                if k in d and d[k] not in (None, ""):
                    try:
                        return int(float(d[k]))
                    except (TypeError, ValueError):
                        return None
            return None

        # FECHA_INGRESO viene como "2026-05-08 00:00:00.000" → recortar a date ISO
        fecha = _s(tropa, "FECHA_INGRESO")
        if fecha:
            fecha = fecha.split(" ")[0]

        return {
            # keys que matchean los detectores de procesar_movimientos (líneas 673-689)
            "FechaIngreso":   fecha,
            # v15.16: BULLTRADE SRL → PEGSA en hacienda
            "hotelero":       consolidar_hotelero(_s(tropa, "HOTELERO")),
            "categoria":      _s(camion, "CATEGORIA"),
            # Cantidad = entero REAL del sub-grupo (NO 1 como en Stock/Egresos).
            # El SQL viejo v_PB_Ingresos devolvía 1 fila por sub-grupo con N cabezas.
            "Cantidad":       _i(camion, "CANTIDAD"),
            # KILOS_CAMION_PARCIAL = total kg del sub-grupo (no por cabeza).
            "KgIngreso":      _f(camion, "KILOS_CAMION_PARCIAL"),
            # CONSIGNATARIO/PROVEEDOR viven a nivel tropa; se heredan al sub-grupo.
            # Consignatario es el campo del filtro CONSIGNATARIA_EXCLUIR del pipeline.
            "Consignatario":  _s(tropa, "CONSIGNATARIO"),
            "Proveedor":      _s(tropa, "PROVEEDOR"),
            # Extras útiles para drill-down futuro
            "NRO_TROPA":      _s(tropa, "NRO_TROPA"),
            "NRO_CORRAL":     _s(camion, "NRO_CORRAL"),
            "ORIGEN":         _s(tropa, "ORIGEN"),
            "DESTINO_COMPRA": _s(tropa, "DESTINO_COMPRA"),
            "LOCALIDAD":      _s(tropa, "LOCALIDAD"),
            "TRANSPORTISTA":  _s(camion, "TRANSPORTISTA"),
            "PROMEDIO":       _f(camion, "PROMEDIO"),
        }

    # ════════════════════════════════════════════════════════════════
    #  TABLA 4 — Muertes (V_MUERTES) — derivada de egresos MOTIVO=M
    # ════════════════════════════════════════════════════════════════
    def fetch_muertes(self, fecha_desde=None, fecha_hasta=None):
        """
        Reemplazo de SELECT * FROM V_MUERTES.

        En el SQL viejo V_MUERTES era una vista SEPARADA, pero en la API Web
        las muertes son egresos con MOTIVO == "M" (código de 1 letra, discovery
        v15.5: motivos {V, M, T}). Por eso fetch_muertes es un WRAPPER sobre
        fetch_egresos() que filtra M y REMAPEA cada registro a las columnas que
        esperan procesar_muertes() y procesar_muertes_30d().

        Cada muerte = 1 animal individual → MUERTOS = 1. El adapter trae CRUDO
        (todas las muertes, con remap de columnas); el pipeline aplica sus
        filtros (>30d de encierre para la tasa anual, ventana 0-30d para la
        tasa 30d, por categoría, etc.) — NO se duplica esa lógica acá.

        Args:
            fecha_desde: ISO date string (YYYY-MM-DD). Por default hoy - 365 días.
            fecha_hasta: ISO date string. Por default hoy.

        Returns:
            list[dict] con keys que detectan los del pipeline (procesar_muertes
            líneas 975-977 + dias_encierre línea 1048):
                MUERTOS       (int)     = 1 (una cabeza por fila)
                ABREVIATURA   (str)     = Categoria del egreso
                FECHA_MUERTE  (str ISO) = FechaSalida del egreso (= FECHA_EGRESO)
                DIAS_ENCIERRE (int)     = Estadia del egreso (días desde ingreso)
                + extras heredados: RFID, HOTELERO, NRO_CORRAL, NRO_TROPA,
                  Categoria, Diagnostico, KgIngreso, KgEgreso, FechaIngreso
        """
        egresos = self.fetch_egresos(fecha_desde=fecha_desde, fecha_hasta=fecha_hasta)
        muertes = [self._remap_muerte(e) for e in egresos
                   if (e.get("MotivoSalida") or "").strip().upper() == "M"]
        log.info(f"Muertes (MOTIVO=M): {len(muertes)} de {len(egresos)} egresos")
        return muertes

    def _remap_muerte(self, e):
        """Remapea un egreso MOTIVO=M al shape que esperan procesar_muertes/_30d."""
        dias = e.get("Estadia")
        try:
            dias = int(dias) if dias is not None else None
        except (TypeError, ValueError):
            dias = None
        return {
            # keys que detectan procesar_muertes (975-977) y dias_encierre (1048)
            "MUERTOS":       1,
            "ABREVIATURA":   e.get("Categoria"),
            "FECHA_MUERTE":  e.get("FechaSalida"),
            "DIAS_ENCIERRE": dias,
            # extras heredados del egreso para drill-down / otros consumidores
            "RFID":          e.get("RFID"),
            # v15.16: idempotente — el egreso ya viene consolidado, esto es defensa
            "HOTELERO":      consolidar_hotelero(e.get("HOTELERO")),
            "NRO_CORRAL":    e.get("NRO_CORRAL"),
            "NRO_TROPA":     e.get("NRO_TROPA"),
            "Categoria":     e.get("Categoria"),
            "Diagnostico":   e.get("Diagnostico"),
            "KgIngreso":     e.get("KgIngreso"),
            "KgEgreso":      e.get("KgEgreso"),
            "FechaIngreso":  e.get("FechaIngreso"),
            "MotivoSalida":  e.get("MotivoSalida"),
        }

    # ════════════════════════════════════════════════════════════════
    #  TABLA 5 — Stock de Insumos (v_PB_StockInsumos)
    # ════════════════════════════════════════════════════════════════
    def fetch_stock_insumos(self, fecha=None):
        """
        Reemplazo de SELECT * FROM v_PB_StockInsumos.

        Endpoint lst_stock_de_insumo con reporte_elegido=stock_actual (descubierto
        2026-06-08: requiere reporte_elegido + fecha_desde + fecha_hasta). Devuelve
        el stock actual de los ~55 insumos del establecimiento.

        El pipeline (módulo 5, líneas 2928-2930) detecta col_stock="STOCK" EXACTO
        y filtra 7 insumos por COD_INSUMO (INSUMOS_INCLUIDOS: MAIZ GRANO=2, SOJA=9,
        NUCLEO=8, DIESEL=99, HARINA GERMEN=6, GLUTEN=7, SILO=3). Por eso el adapter
        renombra STOCK_ACTUAL -> STOCK (sin esto, todos los kg quedan en 0 — mismo
        bug que CANTIDAD en v15.4.1). Trae los 55 CRUDOS; el pipeline filtra.

        Args:
            fecha: ISO date string. Por default hoy. El endpoint pide fecha_desde
                   y fecha_hasta; usamos la misma fecha (stock actual a la fecha).

        Returns:
            list[dict] con keys que necesita el pipeline:
                COD_INSUMO   (str)   -> filtro INSUMOS_INCLUIDOS
                DESC_INSUMO  (str)   -> nombre
                STOCK        (float) -> renombrado de STOCK_ACTUAL
                + extras: DESC_RUBRO, ID_INSUMO, STOCK_ANTERIOR, COMPRA,
                  CONSUMO_MIXER, CONSUMO_SUB_RACION, EGRESO, PRODUCCION
        """
        fecha_iso = fecha or date.today().isoformat()
        compact = fecha_iso.replace("-", "")
        params = {
            "reporte_elegido": "stock_actual",
            "fecha_desde":     compact,
            "fecha_hasta":     compact,
        }
        data = self._get("lst_stock_de_insumo", params=params)
        raiz = data.get("lst_stock_de_insumo") if isinstance(data, dict) else None
        if not isinstance(raiz, list):
            raise RuntimeError(f"Insumos: response sin lst_stock_de_insumo lista. Keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")
        salida = [self._normalizar_insumo(x) for x in raiz]
        log.info(f"Stock insumos: {len(salida)} insumos (fecha {fecha_iso})")
        return salida

    def _normalizar_insumo(self, x):
        """Normaliza una fila de stock de insumo. Renombra STOCK_ACTUAL -> STOCK."""
        def f(*keys):
            for k in keys:
                if k in x and x[k] not in (None, ""):
                    try:
                        return float(x[k])
                    except (TypeError, ValueError):
                        return None
            return None

        def s(*keys):
            for k in keys:
                if k in x and x[k] not in (None, ""):
                    return str(x[k]).strip() or None
            return None

        return {
            # keys que detecta el pipeline (módulo 5)
            "COD_INSUMO":  s("COD_INSUMO"),
            "DESC_INSUMO": s("DESC_INSUMO"),
            # v15.8: el pipeline busca col_stock="STOCK" EXACTO. La API lo trae
            # como STOCK_ACTUAL -> renombrar (sin esto kg en 0, bug tipo v15.4.1).
            "STOCK":       f("STOCK_ACTUAL"),
            # Extras útiles para drill-down / otros consumidores
            "DESC_RUBRO":         s("DESC_RUBRO"),
            "ID_INSUMO":          s("ID_INSUMO"),
            "STOCK_ANTERIOR":     f("STOCK_ANTERIOR"),
            "COMPRA":             f("COMPRA"),
            "CONSUMO_MIXER":      f("CONSUMO_MIXER"),
            "CONSUMO_SUB_RACION": f("CONSUMO_SUB_RACION"),
            "EGRESO":             f("EGRESO"),
            "PRODUCCION":         f("PRODUCCION"),
        }
