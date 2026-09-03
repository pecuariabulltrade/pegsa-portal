"""
datamars_source.py — Adapter para la API OData de Datamars Livestock (v15.68).

Gemelo de `wincampo_source.py`: misma ubicación (raíz de PEGSA_Portal), mismo
`.env`, mismo estilo de reintentos. Sirve para UNA cosa: saber qué caravanas
(EID) leyó de verdad el bastón en la sesión de balanza de cada remito de venta.

Por qué existe (bitácora sesion_2026-09-03_datamars_cruce_remitos_cowork.md):
cuando la caravana no lee o no coincide, el cargador de WinCampo le asigna al
egreso un animal cualquiera del stock → el remito hereda kg de ingreso, precio,
fecha y estadía de OTRO animal. Datamars registra esas pesadas SIN EID (15 % de
las pesadas de 2026). Cruzando RFID <-> EID se detectan y se les imputa un
origen razonable.

Contrato con el pipeline (`generar_resultado_remitos`):
  - `sincronizar(carpeta_datos, fechas_objetivo, log=...)` -> (sesiones, meta)
  - `sesiones` = lista de dicts {sesion_id, nombre, fecha (date), pesadas:[...]}
  - Si faltan credenciales o la API falla, devuelve ([], meta con activo=False):
    el pipeline sigue y marca todo `sin_datamars`. NUNCA rompe el tick.

Cache: `datos/datamars_sesiones/index.json` + `ses_<id>.json` por sesión. Esa
carpeta NO se publica (el .bat copia `datos\*.json`, sin recursión) ni entra a
git (el `git add .` corre en el mirror, no en OneDrive).
"""

import json
import os
import re
import time
import logging
from datetime import date, datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

log = logging.getLogger(__name__)

_repo_root = Path(__file__).resolve().parent
load_dotenv(_repo_root / ".env")

BASE = "https://app.livestock.datamars.com"
RATE_LIMIT_SLEEP = 0.3
TIMEOUT_DEFAULT = 60
PAGE_SIZE = 5000             # el server NO pagina: hay que pedir $top/$skip
MAX_SESIONES_POR_TICK = 120  # techo de seguridad: la 1a corrida no debe colgar el tick

CACHE_DIRNAME = "datamars_sesiones"
INDEX_NAME = "index.json"


class DatamarsSinCredenciales(RuntimeError):
    """No hay DATAMARS_EMAIL / DATAMARS_PASSWORD en el .env."""


# ════════════════════════════════════════════════════════════════
#  Normalización
# ════════════════════════════════════════════════════════════════
def normalizar_eid(v):
    """'982 000450858545' -> '982000450858545'. Vacío -> None.

    El EID llega de Datamars con espacios y de WinCampo (RFID) sin ellos; y a
    veces uno de los dos recorta ceros a la izquierda. Se guarda solo dígitos y
    el comparador del pipeline prueba además sin ceros iniciales.
    """
    d = re.sub(r"\D", "", str(v or ""))
    return d or None


def _fecha(v):
    """'2026-08-03T09:12:00Z' o date -> date. None si no se puede."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v)[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _json_field(raw, *nombres):
    """Lee un campo de los JSON embebidos (userDefinedFieldsJson y amigos).

    Vienen como string con JSON adentro; las claves son las etiquetas que el
    usuario configuró en la balanza ("Total de días", "GPV total", "Categoria"),
    así que se comparan sin acentos ni mayúsculas.
    """
    if not raw:
        return None
    d = raw
    if isinstance(d, str):
        try:
            d = json.loads(d)
        except (ValueError, TypeError):
            return None
    if not isinstance(d, dict):
        return None

    def _k(s):
        s = str(s).lower()
        for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u")):
            s = s.replace(a, b)
        return re.sub(r"[^a-z0-9]", "", s)

    idx = {_k(k): v for k, v in d.items()}
    for n in nombres:
        v = idx.get(_k(n))
        if v not in (None, ""):
            return v
    return None


# ════════════════════════════════════════════════════════════════
#  API
# ════════════════════════════════════════════════════════════════
class DatamarsAPI:
    def __init__(self, email=None, password=None):
        self.email = email or os.environ.get("DATAMARS_EMAIL")
        self.password = password or os.environ.get("DATAMARS_PASSWORD")
        if not self.email or not self.password:
            raise DatamarsSinCredenciales(
                "Faltan DATAMARS_EMAIL / DATAMARS_PASSWORD en el .env")
        self.token = None
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json",
        })
        self._login()

    # ── login ──────────────────────────────────────────────────
    @staticmethod
    def _buscar_token(data):
        """Busca la clave del access token sin asumir el shape exacto.

        La app web guarda `access-token`, `refresh-token` y
        `access-token-expiry` en localStorage, pero no está verificado si el
        POST devuelve el dict pelado, una lista de 1 (como WinCampo) o algo
        anidado. Se busca en profundidad la primera clave que parezca el access
        token y NO sea el refresh.
        """
        objetivo = ("accesstoken", "token", "jwt", "idtoken")
        pila = [data]
        while pila:
            cur = pila.pop(0)
            if isinstance(cur, list):
                pila.extend(cur)
                continue
            if not isinstance(cur, dict):
                continue
            for k, v in cur.items():
                kk = re.sub(r"[^a-z]", "", str(k).lower())
                if isinstance(v, str) and v and "refresh" not in kk and kk in objetivo:
                    return v
            pila.extend([v for v in cur.values() if isinstance(v, (dict, list))])
        return None

    def _login(self):
        r = self.session.post(
            BASE + "/jwt/login",
            json={"email": self.email, "password": self.password},
            timeout=30,
        )
        r.raise_for_status()
        try:
            data = r.json()
        except ValueError:
            # algunos backends devuelven el JWT como texto pelado
            data = r.text.strip().strip('"')
        if isinstance(data, str) and data.count(".") == 2:
            self.token = data
        else:
            self.token = self._buscar_token(data)
        if not self.token:
            _shape = list(data.keys()) if isinstance(data, dict) else type(data).__name__
            raise RuntimeError(f"Login Datamars sin token. Shape: {_shape}")
        self.session.headers["Authorization"] = f"Bearer {self.token}"
        log.info("Datamars login OK (user=%s)", self.email)

    # ── GET con reintentos (mismo criterio que wincampo_source) ─
    def _get(self, path, params=None, retry_on_401=True, _retry_left=3):
        url = BASE + "/" + path.lstrip("/")
        try:
            time.sleep(RATE_LIMIT_SLEEP)
            r = self.session.get(url, params=params, timeout=TIMEOUT_DEFAULT)
            if r.status_code == 401 and retry_on_401:
                log.info("Datamars: token expirado, re-login")
                self._login()
                return self._get(path, params=params, retry_on_401=False,
                                 _retry_left=_retry_left)
            if r.status_code in (502, 503, 504):
                raise requests.exceptions.HTTPError(f"HTTP {r.status_code}", response=r)
            r.raise_for_status()
            return r.json()
        except (requests.exceptions.ChunkedEncodingError,
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.HTTPError) as e:
            if isinstance(e, requests.exceptions.HTTPError) and e.response is not None \
                    and not (500 <= e.response.status_code < 600):
                raise
            if _retry_left <= 0:
                log.error(f"  datamars {path}: agotados reintentos ({type(e).__name__})")
                raise
            wait_s = {3: 1, 2: 3, 1: 9}[_retry_left]
            log.warning(f"  datamars {path}: transitorio ({type(e).__name__}), "
                        f"retry en {wait_s}s ({_retry_left} restantes)")
            time.sleep(wait_s)
            return self._get(path, params=params, retry_on_401=retry_on_401,
                             _retry_left=_retry_left - 1)

    @staticmethod
    def _value(resp):
        """OData devuelve {'value': [...]}; se tolera la lista pelada."""
        if isinstance(resp, dict):
            return resp.get("value") or []
        if isinstance(resp, list):
            return resp
        return []

    def _get_paginado(self, path, params):
        """$top/$skip hasta que el server devuelva menos de PAGE_SIZE.

        El server NO manda @odata.nextLink (verificado en el piloto), así que la
        paginación la maneja el cliente.
        """
        out, skip = [], 0
        while True:
            p = dict(params)
            p["$top"] = PAGE_SIZE
            p["$skip"] = skip
            filas = self._value(self._get(path, params=p))
            out.extend(filas)
            if len(filas) < PAGE_SIZE:
                return out
            skip += PAGE_SIZE

    # ── sesiones ───────────────────────────────────────────────
    def fetch_sessions(self, desde):
        """Sesiones de balanza con fecha >= desde (date o 'YYYY-MM-DD')."""
        d = _fecha(desde) or date(2026, 1, 1)
        filas = self._get_paginado("odata/Sessions", {
            "$filter": f"sessionStartDate ge {d.isoformat()}T00:00:00Z",
            "$orderby": "sessionStartDate desc",
            "$select": ("sessionId,sessionName,sessionStartDate,"
                        "actualRecordCount,successfulRecordCount"),
        })
        out = []
        for x in filas:
            sid = x.get("sessionId")
            f = _fecha(x.get("sessionStartDate"))
            if sid is None or f is None:
                continue
            out.append({
                "sesion_id": int(sid),
                "nombre": x.get("sessionName") or "",
                "fecha": f.isoformat(),
                "registros": x.get("actualRecordCount"),
                "registros_ok": x.get("successfulRecordCount"),
            })
        return out

    # ── pesadas de una sesión ──────────────────────────────────
    def fetch_session_records(self, session_id):
        """Pesadas normalizadas de una sesión.

        `eid` vacío NO es un error: es el dato que buscamos — el animal pasó por
        la balanza y el bastón no leyó la caravana.
        """
        filas = self._get_paginado("odata/WeightRecords", {
            "$filter": f"session_SessionId eq {int(session_id)}",
            "$select": ("weightRecordId,weight,timeStamp,animal_AnimalId,"
                        "userDefinedFieldsJson,lifeDataUserDefinedFieldJson"),
            "$expand": ("animal($select=animalId;$expand=customAnimalIdentifiers"
                        "($select=internalName,value))"),
        })
        return [self._normalizar_pesada(x) for x in filas]

    @staticmethod
    def _normalizar_pesada(x):
        eid = vid = None
        animal = x.get("animal") or {}
        for ident in (animal.get("customAnimalIdentifiers") or []):
            nombre = str(ident.get("internalName") or "").strip().upper()
            valor = ident.get("value")
            if nombre == "EID":
                eid = normalizar_eid(valor)
            elif nombre == "VID":
                vid = str(valor or "").strip() or None
        udf = x.get("userDefinedFieldsJson")
        life = x.get("lifeDataUserDefinedFieldJson")
        f = _fecha(x.get("timeStamp"))
        return {
            "peso": _num(x.get("weight")),
            "fecha": f.isoformat() if f else None,
            "eid": eid,
            "vid": vid,
            "categoria": _json_field(life, "Categoria", "Categoría"),
            "dias_datamars": _num(_json_field(udf, "Total de días", "Total de dias")),
            "gpv_datamars": _num(_json_field(udf, "GPV total")),
        }


# ════════════════════════════════════════════════════════════════
#  Cache incremental
# ════════════════════════════════════════════════════════════════
def cache_dir(carpeta_datos):
    return Path(carpeta_datos) / CACHE_DIRNAME


def _leer_json(p, default=None):
    try:
        with Path(p).open(encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _escribir_json(p, obj):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def cargar_index(carpeta_datos):
    d = _leer_json(cache_dir(carpeta_datos) / INDEX_NAME, {}) or {}
    return {str(k): v for k, v in (d.get("sesiones") or {}).items()}


def cargar_sesion(carpeta_datos, sesion_id):
    return _leer_json(cache_dir(carpeta_datos) / f"ses_{int(sesion_id)}.json")


def sincronizar(carpeta_datos, fechas_objetivo, desde=None, log=None,
                dias_atras=3, dias_adelante=1):
    """Refresca la cache y devuelve las sesiones útiles para el cruce.

    `fechas_objetivo` = fechas de egreso de los remitos a verificar (date o ISO).
    Solo se bajan pesadas de sesiones NUEVAS cuya fecha caiga en la ventana
    [fecha_remito − dias_atras, fecha_remito + dias_adelante] — la misma que usa
    el matcher, así el bot hace 1-3 llamadas chicas por hora.

    Devuelve (sesiones, meta). Nunca levanta: ante cualquier problema devuelve
    lo que haya en cache (o nada) con `activo=False` y el motivo.
    """
    if log is None:
        log = logging.getLogger("datamars")
    cdir = cache_dir(carpeta_datos)
    meta = {"activo": False, "motivo": None, "credenciales": False,
            "sesiones_cache": 0, "ultima_sesion": None, "sesiones_nuevas": 0}

    objetivo = set()
    for f in (fechas_objetivo or []):
        d = _fecha(f)
        if d:
            objetivo.add(d)
    if not objetivo:
        meta["motivo"] = "sin remitos que verificar"
        return [], meta

    def _en_ventana(f):
        return any(-dias_atras <= (f - o).days <= dias_adelante for o in objetivo)

    # 1 · refrescar el índice contra la API (si hay credenciales)
    index = cargar_index(carpeta_datos)
    api = None
    try:
        api = DatamarsAPI()
        meta["credenciales"] = True
    except DatamarsSinCredenciales as e:
        meta["motivo"] = "sin credenciales"
        log.info(f"  Datamars: {e} — el cruce de caravanas queda sin verificar")
    except Exception as e:
        meta["motivo"] = f"login falló: {type(e).__name__}"
        log.warning(f"  ⚠ Datamars: login falló ({e}) — se sigue sin verificar")

    if api is not None:
        try:
            desde_d = _fecha(desde) or (min(objetivo) - timedelta(days=dias_atras))
            for s in api.fetch_sessions(desde_d):
                index[str(s["sesion_id"])] = s
            _escribir_json(cdir / INDEX_NAME, {
                "actualizado": datetime.now().isoformat(),
                "desde": desde_d.isoformat(),
                "sesiones": index,
            })
        except Exception as e:
            meta["motivo"] = f"Sessions falló: {type(e).__name__}"
            log.warning(f"  ⚠ Datamars: no pude refrescar el índice ({e}); "
                        f"sigo con la cache ({len(index)} sesiones)")

    # 2 · bajar las pesadas de las sesiones nuevas que caen en ventana
    utiles, faltantes = [], []
    for sid, s in index.items():
        f = _fecha(s.get("fecha"))
        if not f or not _en_ventana(f):
            continue
        pesadas = cargar_sesion(carpeta_datos, sid)
        if pesadas is None:
            faltantes.append((sid, s))
        else:
            utiles.append(dict(s, fecha=f, pesadas=pesadas))

    if faltantes and api is not None:
        if len(faltantes) > MAX_SESIONES_POR_TICK:
            log.warning(f"  ⚠ Datamars: {len(faltantes)} sesiones por bajar, "
                        f"tomo las {MAX_SESIONES_POR_TICK} más recientes; "
                        f"el resto entra en los próximos ticks")
            faltantes.sort(key=lambda x: x[1].get("fecha") or "", reverse=True)
            faltantes = faltantes[:MAX_SESIONES_POR_TICK]
        for sid, s in faltantes:
            try:
                pesadas = api.fetch_session_records(sid)
            except Exception as e:
                log.warning(f"  ⚠ Datamars: sesión {sid} no bajó ({type(e).__name__})")
                continue
            _escribir_json(cdir / f"ses_{int(sid)}.json", pesadas)
            meta["sesiones_nuevas"] += 1
            utiles.append(dict(s, fecha=_fecha(s.get("fecha")), pesadas=pesadas))

    meta["sesiones_cache"] = len(index)
    if index:
        meta["ultima_sesion"] = max((s.get("fecha") or "") for s in index.values()) or None
    # `activo` = hubo lectura real del bastón para cruzar. Sin sesiones útiles el
    # pipeline marca todo `sin_datamars` y los números quedan como WinCampo.
    if not utiles:
        meta["activo"] = False
        meta["motivo"] = meta["motivo"] or "sin sesiones en la ventana de los remitos"
    else:
        meta["activo"] = True
        log.info(f"  Datamars: {len(utiles)} sesiones en ventana "
                 f"({meta['sesiones_nuevas']} bajadas este tick, "
                 f"{meta['sesiones_cache']} en cache)")
    return utiles, meta
