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

    def _get(self, path, params=None, retry_on_401=True):
        time.sleep(RATE_LIMIT_SLEEP)
        url = API_BASE + path.lstrip("/")
        r = self.session.get(url, params=params, timeout=TIMEOUT_DEFAULT)
        if r.status_code == 401 and retry_on_401:
            log.info("Token expirado, re-login")
            self._login()
            return self._get(path, params=params, retry_on_401=False)
        r.raise_for_status()
        return r.json()

    # ════════════════════════════════════════════════════════════════
    #  TABLA 1 — Stock Hacienda (detalle individual por cabeza)
    # ════════════════════════════════════════════════════════════════
    def fetch_stock_hacienda(self, fecha=None):
        """
        Reemplazo de SELECT * FROM V_STOCK_HACIENDA.

        Devuelve detalle individual: una fila por cada cabeza (RFID único).
        El endpoint trae ~9974 cabezas con caravana asignada al día de hoy.

        Args:
            fecha: ISO date string. Por default hoy.

        Returns:
            list[dict] con keys que necesita el pipeline:
                NRO_CORRAL    (str)
                HOTELERO      (str)
                CATEGORIA     (str)
                KG_INGRESO    (float)
                FECHA_INGRESO (str ISO date) — directo del endpoint
                RFID          (str) — único por animal
                NRO_CARAVANA  (str)
                NRO_TROPA     (str)
                SEXO          (str, "M" o "H")
                RAZA          (str/None)
        """
        fecha_iso = fecha or date.today().isoformat()
        params = {
            "fecha_desde": fecha_iso,
            "fecha_hasta": fecha_iso,
            "descripcion_corral_sino": "N",
            "descripcion_categoria_sino": "N",
            "tropa_trazada": "N",
            "tropa_no_trazada": "N",
            "agrupado": "N",                      # DETALLE INDIVIDUAL (no agregado)
            "desbastado_sino": "N",
            "cabezas_sino": "N",
            "reporte_elegido": "detallado_caravana",
        }
        data = self._get("lst_stock_de_hacienda", params=params)

        # Shape verificado: { "lst_stock_hacienda": { "cabecera": [...], "detalle": [...] } }
        root = data.get("lst_stock_hacienda") if isinstance(data, dict) else None
        if not isinstance(root, dict):
            raise RuntimeError(f"Response sin lst_stock_hacienda. Keys top: {list(data.keys()) if isinstance(data, dict) else type(data)}")
        arr = root.get("detalle", [])
        if not isinstance(arr, list):
            raise RuntimeError(f"detalle no es lista. Keys de root: {list(root.keys())}")

        if not arr:
            log.warning("WinCampo devolvió 0 cabezas en stock_hacienda")
            return []

        log.info(f"Stock hacienda: {len(arr)} cabezas individuales")

        salida = [self._normalizar_row(x) for x in arr]
        return salida

    def _normalizar_row(self, x):
        """
        Normaliza una fila al shape esperado por el pipeline.
        Verificado con response real al 2026-06-06.
        """
        kg_ing = x.get("KG_INGRESO")
        try:
            kg_ing = float(kg_ing) if kg_ing not in (None, "") else None
        except (TypeError, ValueError):
            kg_ing = None

        fecha = x.get("FECHA_INGRESO")
        if hasattr(fecha, "isoformat"):
            fecha = fecha.isoformat()
        elif fecha is not None:
            fecha = str(fecha)

        return {
            # 5 críticos del pipeline (mismas keys que V_STOCK_HACIENDA del SQL viejo)
            "NRO_CORRAL":    str(x.get("NRO_CORRAL") or "").strip() or None,
            "HOTELERO":      x.get("HOTELERO"),
            "CATEGORIA":     x.get("CATEGORIA"),
            "KG_INGRESO":    kg_ing,
            "FECHA_INGRESO": fecha,
            # v15.4.1 HOTFIX: el SQL viejo traía CANTIDAD por cabeza, el adapter no
            # la incluía y eso rompía calcular_kpis() (línea 407) que multiplica por
            # cantidad → total_cabezas, total_kg_estimado_hoy quedaban en 0.
            # Cada cabeza individual del adapter = 1 cabeza.
            "CANTIDAD":      1,
            # Extras útiles que ahora podemos preservar (el SQL viejo no los traía o no los exponía)
            "RFID":          str(x.get("RFID") or "").strip() or None,
            "NRO_CARAVANA":  x.get("NRO_CARAVANA"),
            "NRO_TROPA":     x.get("NRO_TROPA"),
            "SEXO":          x.get("SEXO"),
            "RAZA":          x.get("DESC_RAZA"),
            "ORIGEN":        x.get("ORIGEN"),
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
            "HOTELERO":       s("HOTELERO"),
            "NRO_CORRAL":     s("NRO_CORRAL"),
            "NRO_TROPA":      s("NRO_TROPA"),
            "NRO_CARAVANA":   s("NRO_CARAVANA"),
            "Diagnostico":    s("DIAGNOSTICO"),
            "Destino":        s("DESTINO"),
            "Consignatario":  s("CONSIGNATARIO"),
            "Origen":         s("ORIGEN"),
            "FechaIngreso":   s("FECHA_INGRESO"),
        }
