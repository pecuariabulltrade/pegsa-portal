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
        self.token = data.get("token") or data.get("access_token") or data.get("jwt")
        if not self.token:
            raise RuntimeError(f"Login devolvió sin token: {data}")
        self.session.headers["Authorization"] = f"Bearer {self.token}"
        log.info("WinCampo login OK")

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
            # Extras útiles que ahora podemos preservar (el SQL viejo no los traía o no los exponía)
            "RFID":          str(x.get("RFID") or "").strip() or None,
            "NRO_CARAVANA":  x.get("NRO_CARAVANA"),
            "NRO_TROPA":     x.get("NRO_TROPA"),
            "SEXO":          x.get("SEXO"),
            "RAZA":          x.get("DESC_RAZA"),
            "ORIGEN":        x.get("ORIGEN"),
        }
