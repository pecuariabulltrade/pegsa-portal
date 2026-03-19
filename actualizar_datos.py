"""
PEGSA & BULLTRADE - Actualizador de Datos v6
Columnas calculadas:
  DIAS_EN_FEEDLOT    : dias desde FECHA_INGRESO (techo 365 dias)
  CLASIFICACION      : Macho / Hembra / Vaca / Toro segun CATEGORIA
  ENGORDE_DIARIO_KG  : kg/dia segun clasificacion y KG_INGRESO
  KG_ESTIMADO_HOY    : KG_INGRESO + dias*engorde (techo 650 kg)
  CATEGORIA_FINAL    : categoria segun KG_ESTIMADO_HOY
  NOMBRE_CORRAL      : nombre de establecimiento segun NRO_CORRAL

KPIs agrupados por:
  - Propietario       (HOTELERO)
  - Establecimiento   (NOMBRE_CORRAL)
  - Clasificacion     (Macho/Hembra/Vaca/Toro)
  - Categoria final
"""
import sys, json, logging, configparser, warnings, re
import pandas as pd
from datetime import datetime
from pathlib import Path

# ── Logging ───────────────────────────────────────────────
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger(__name__)

def separador(titulo=""):
    log.info("-" * 55)
    if titulo:
        log.info(f"  {titulo}")
        log.info("-" * 55)

def to_num(v):
    """Convierte string numérico argentino a float.
    Soporta: 334 / 293,74 / 1.234,56 / 1234.56
    """
    try:
        s = str(v or 0).strip().replace(" ", "")
        if not s or s in ("-", "None", "nan"):
            return 0.0
        # Si tiene coma: es separador decimal argentino (ej: 293,74 o 1.234,56)
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        # Si no tiene coma pero sí tiene punto: puede ser decimal anglosajón (334.5)
        # o separador de miles (1.234) — si hay exactamente 3 dígitos tras el punto es miles
        elif "." in s:
            parts = s.split(".")
            if len(parts) == 2 and len(parts[1]) == 3:
                s = s.replace(".", "")  # era separador de miles: 1.234 → 1234
            # si len(parts[1]) != 3, es decimal: 334.5 → 334.5 (no tocar)
        return float(s)
    except:
        return 0.0

def find_col(columnas, keywords):
    cn = [c.lower() for c in columnas]
    for kw in keywords:
        for i, c in enumerate(cn):
            if kw in c:
                return columnas[i]
    return None

# ═══════════════════════════════════════════════════════════
#  TABLAS DE NEGOCIO
# ═══════════════════════════════════════════════════════════

CLASIFICACION_MAP = {
    "TM": "Macho",  "NT": "Macho",  "NV": "Macho",
    "TH": "Hembra", "VQ": "Hembra",
    "VA": "Vaca",
    "TO": "Toro",
}

# Tabla 1: engorde diario en kg/dia segun clasificacion y peso de ingreso
ENGORDE_DIARIO = [
    ("Hembra", 0,    250,  1.21),
    ("Hembra", 250,  1000, 1.31),
    ("Macho",  0,    250,  1.23),
    ("Macho",  250,  350,  1.35),
    ("Macho",  350,  550,  1.57),
    ("Macho",  550,  1000, 1.10),
    ("Toro",   0,    1000, 1.60),
    ("Vaca",   0,    650,  1.72),
    ("Vaca",   650,  1000, 1.00),
]

# Tabla 2: categoria final segun clasificacion y kg estimado
CATEGORIA_FINAL_MAP = [
    ("Hembra", 0,    250,  "ternera"),
    ("Hembra", 250,  1000, "vaquillona"),
    ("Macho",  0,    250,  "ternero"),
    ("Macho",  250,  350,  "novillito"),
    ("Macho",  350,  550,  "novillo"),
    ("Macho",  550,  1000, "novillo mayor a 550 kg"),
    ("Toro",   0,    1000, "toro"),
    ("Vaca",   0,    650,  "vaca"),
    ("Vaca",   650,  1000, "vaca mayor a 650 kg"),
]

# Tabla 3: nombre de establecimiento segun NRO_CORRAL
CORRALES = [
    (1,   199, "El Haras"),
    (200, 299, "El Coloradito"),
    (300, 399, "Don Pedro"),
    (400, 499, "El Descanso"),
    (500, 599, "Medel"),
    (600, 699, "Santa Clara"),
    (700, 799, "La Panchita"),
]

TECHO_KG   = 350   # kg maximo estimado (todos excepto El Haras)
TECHO_KG_DESCANSO = 650  # techo solo para El Haras
TECHO_DIAS = 365   # dias maximos en feedlot

# ── Funciones de lookup ───────────────────────────────────
def get_clasificacion(cat):
    if not cat or str(cat).strip() == "":
        return "Sin clasificar"
    return CLASIFICACION_MAP.get(str(cat).strip().upper(), "Sin clasificar")

def get_engorde(clasificacion, kg_ingreso):
    for clas, desde, hasta, kg_dia in ENGORDE_DIARIO:
        if clas.lower() == clasificacion.lower() and desde <= kg_ingreso < hasta:
            return kg_dia
    return 0.0

def get_categoria_final(clasificacion, kg_estimado):
    for clas, desde, hasta, cat_final in CATEGORIA_FINAL_MAP:
        if clas.lower() == clasificacion.lower() and desde <= kg_estimado < hasta:
            return cat_final
    return "Sin clasificar"

def get_nombre_corral(nro):
    try:
        n = int(float(nro or 0))
    except:
        return "Sin asignar"
    for desde, hasta, nombre in CORRALES:
        if desde <= n <= hasta:
            return nombre
    return "Sin asignar"

def limpiar_nan(obj):
    """Elimina NaN/inf recursivamente antes de guardar JSON."""
    if isinstance(obj, dict):
        return {k: limpiar_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [limpiar_nan(v) for v in obj]
    if isinstance(obj, float):
        if obj != obj or obj == float("inf") or obj == float("-inf"):
            return None
    return obj

# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════
def cargar_config():
    path = Path(__file__).parent / "config.ini"
    if not path.exists():
        log.error(f"No encontre config.ini en: {path}")
        input("\nPresiona Enter para cerrar...")
        sys.exit(1)
    cfg = configparser.ConfigParser()
    cfg.read(path, encoding="utf-8")
    return cfg

# ═══════════════════════════════════════════════════════════
#  CONEXION SQL
# ═══════════════════════════════════════════════════════════
def conectar(cfg):
    try:
        import pyodbc
    except ImportError:
        log.error("Falta pyodbc. Ejecuta: pip install pyodbc pandas")
        input("\nPresiona Enter para cerrar...")
        sys.exit(1)

    srv  = cfg["SQL"]["servidor"]
    db   = cfg["SQL"]["base_datos"]
    auth = cfg["SQL"]["autenticacion"].lower()

    if auth == "windows":
        cs = (f"DRIVER={{ODBC Driver 18 for SQL Server}};"
              f"SERVER={srv};DATABASE={db};"
              f"Trusted_Connection=yes;TrustServerCertificate=yes;")
    else:
        u = cfg["SQL"]["usuario"]
        p = cfg["SQL"]["contrasena"]
        cs = (f"DRIVER={{ODBC Driver 18 for SQL Server}};"
              f"SERVER={srv};DATABASE={db};"
              f"UID={u};PWD={p};TrustServerCertificate=yes;")

    log.info(f"Conectando a  {srv}  /  {db}  ...")
    try:
        conn = pyodbc.connect(cs, timeout=20)
        log.info("Conexion SQL OK")
        return conn
    except Exception as e:
        log.error(f"No se pudo conectar: {e}")
        log.error("  Verifica: 1. VPN conectada  2. WinCampo corriendo  3. Usuario/contrasena")
        input("\nPresiona Enter para cerrar...")
        sys.exit(1)

# ═══════════════════════════════════════════════════════════
#  EXTRACCION Y ENRIQUECIMIENTO
# ═══════════════════════════════════════════════════════════
def extraer(conn, tabla):
    try:
        import pandas as pd
    except ImportError:
        log.error("Falta pandas. Ejecuta: pip install pandas")
        sys.exit(1)

    log.info(f"  Leyendo {tabla} ...")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            df = pd.read_sql(f"SELECT * FROM {tabla} WITH (NOLOCK)", conn)

        # Limpiar NaN/inf
        df = df.where(pd.notnull(df), None)
        for col in df.columns:
            df[col] = df[col].apply(
                lambda x: None if isinstance(x, float) and (x != x or x in (float("inf"), float("-inf"))) else x
            )
        log.info(f"  {len(df):,} registros  |  {len(df.columns)} columnas originales")

        # 1. Dias en feedlot con techo de TECHO_DIAS
        if "FECHA_INGRESO" in df.columns:
            hoy    = pd.Timestamp.now().normalize()
            fechas = pd.to_datetime(df["FECHA_INGRESO"], errors="coerce")
            df["DIAS_EN_FEEDLOT"] = (hoy - fechas).dt.days.fillna(0).astype(int).clip(upper=TECHO_DIAS)
            log.info(f"  + DIAS_EN_FEEDLOT  (techo {TECHO_DIAS} dias, prom: {df['DIAS_EN_FEEDLOT'].mean():.0f})")

        # 2. Clasificacion Macho / Hembra / Vaca / Toro
        if "CATEGORIA" in df.columns:
            df["CLASIFICACION"] = df["CATEGORIA"].apply(get_clasificacion)
            log.info(f"  + CLASIFICACION    {df['CLASIFICACION'].value_counts().to_dict()}")

        # 2b. Nombre de establecimiento (necesario antes del techo por campo)
        if "NRO_CORRAL" in df.columns:
            df["NOMBRE_CORRAL"] = df["NRO_CORRAL"].apply(get_nombre_corral)

        # 3. Engorde diario y Kg estimado con techo por establecimiento
        if all(c in df.columns for c in ["CLASIFICACION", "KG_INGRESO", "DIAS_EN_FEEDLOT"]):
            def calc_engorde(row):
                return get_engorde(
                    str(row["CLASIFICACION"] or ""),
                    float(row["KG_INGRESO"] or 0)
                )
            def calc_kg_est(row):
                kg_ing  = float(row["KG_INGRESO"] or 0)
                dias    = int(row["DIAS_EN_FEEDLOT"] or 0)
                engorde = float(row["ENGORDE_DIARIO_KG"] or 0)
                nombre  = str(row.get("NOMBRE_CORRAL") or "").strip().lower()
                techo   = TECHO_KG_DESCANSO if "haras" in nombre else TECHO_KG
                return round(min(kg_ing + dias * engorde, techo), 1)

            df["ENGORDE_DIARIO_KG"] = df.apply(calc_engorde, axis=1)
            df["KG_ESTIMADO_HOY"]   = df.apply(calc_kg_est,  axis=1)
            log.info(f"  + KG_ESTIMADO_HOY  (techo {TECHO_KG} kg, prom: {df['KG_ESTIMADO_HOY'].mean():.1f})")

        # 4. Categoria final segun KG_ESTIMADO_HOY
        if all(c in df.columns for c in ["CLASIFICACION", "KG_ESTIMADO_HOY"]):
            df["CATEGORIA_FINAL"] = df.apply(
                lambda r: get_categoria_final(
                    str(r["CLASIFICACION"] or ""),
                    float(r["KG_ESTIMADO_HOY"] or 0)
                ), axis=1
            )
            log.info(f"  + CATEGORIA_FINAL  {df['CATEGORIA_FINAL'].value_counts().to_dict()}")

        # 5. Log NOMBRE_CORRAL
        if "NOMBRE_CORRAL" in df.columns:
            log.info(f"  + NOMBRE_CORRAL    {df['NOMBRE_CORRAL'].value_counts().to_dict()}")

        registros = df.to_dict(orient="records")
        columnas  = list(df.columns)
        return registros, columnas

    except Exception as e:
        log.error(f"  Error leyendo {tabla}: {e}")
        import traceback; traceback.print_exc()
        return [], []

# ═══════════════════════════════════════════════════════════
#  KPIs
# ═══════════════════════════════════════════════════════════
def calcular_kpis(registros, columnas):
    if not registros:
        return {}

    col_cab  = "CANTIDAD"  if "CANTIDAD"  in columnas else find_col(columnas, ["cabez","nro_cab"])
    col_cat  = "CATEGORIA" if "CATEGORIA" in columnas else None
    col_prop = "HOTELERO"  if "HOTELERO"  in columnas else find_col(columnas, ["hotel","propiet"])

    # Totales generales
    total_cab    = sum(to_num(r.get(col_cab, 0)) for r in registros) if col_cab else 0
    col_kg = "KG_ESTIMADO_HOY" if "KG_ESTIMADO_HOY" in registros[0] else ("KG_ESTIMADO" if "KG_ESTIMADO" in registros[0] else None)
    total_kg_est = sum(
        float(r.get(col_kg) or 0) * to_num(r.get(col_cab, 0))
        for r in registros
    ) if col_kg else 0
    prom_kg   = round(total_kg_est / total_cab, 1) if total_cab > 0 else 0
    dias_vals = [float(r.get("DIAS_EN_FEEDLOT") or 0) for r in registros if r.get("DIAS_EN_FEEDLOT")]
    dias_prom = round(sum(dias_vals) / len(dias_vals), 1) if dias_vals else 0

    # Funcion generica de agrupacion por cualquier columna
    def agrupar(col_grupo):
        grupos = {}
        for r in registros:
            g  = str(r.get(col_grupo) or "Sin datos").strip()
            c  = to_num(r.get(col_cab, 0)) if col_cab else 0
            ke = float(r.get(col_kg) or 0) * c if col_kg else 0
            if g not in grupos:
                grupos[g] = {"cabezas": 0, "kg_estimado": 0}
            grupos[g]["cabezas"]     += c
            grupos[g]["kg_estimado"] += ke
        for g in grupos:
            d = grupos[g]
            d["ton_estimado"] = round(d["kg_estimado"] / 1000, 2)
            d["kg_promedio"]  = round(d["kg_estimado"] / d["cabezas"], 1) if d["cabezas"] > 0 else 0
            d["kg_estimado"]  = round(d["kg_estimado"])
        return grupos

    # Agrupacion cruzada: establecimiento -> categoria_final
    def agrupar_est_cat():
        result = {}
        for r in registros:
            est = str(r.get("NOMBRE_CORRAL") or "Sin datos").strip()
            cat = str(r.get("CATEGORIA_FINAL") or r.get("CATEGORIA") or "Sin datos").strip()
            c   = to_num(r.get(col_cab, 0)) if col_cab else 0
            ke  = float(r.get(col_kg) or 0) * c if col_kg else 0
            if est not in result:
                result[est] = {}
            if cat not in result[est]:
                result[est][cat] = {"cabezas": 0, "kg_estimado": 0}
            result[est][cat]["cabezas"]     += c
            result[est][cat]["kg_estimado"] += ke
        for est in result:
            for cat in result[est]:
                d = result[est][cat]
                d["ton_estimado"] = round(d["kg_estimado"] / 1000, 2)
                d["kg_promedio"]  = round(d["kg_estimado"] / d["cabezas"], 1) if d["cabezas"] > 0 else 0
        return result

    # Agrupacion cruzada: categoria_final -> establecimiento + propietario
    def agrupar_cat_desglose():
        result = {}
        for r in registros:
            cat  = str(r.get("CATEGORIA_FINAL") or r.get("CATEGORIA") or "Sin datos").strip()
            est  = str(r.get("NOMBRE_CORRAL") or "Sin datos").strip()
            prop = str(r.get(col_prop) or "Sin datos").strip() if col_prop else "Sin datos"
            c    = to_num(r.get(col_cab, 0)) if col_cab else 0
            ke   = float(r.get(col_kg) or 0) * c if col_kg else 0
            if cat not in result:
                result[cat] = {"por_establecimiento": {}, "por_propietario": {}}
            for grupo, key in [(est, "por_establecimiento"), (prop, "por_propietario")]:
                if grupo not in result[cat][key]:
                    result[cat][key][grupo] = {"cabezas": 0, "kg_estimado": 0}
                result[cat][key][grupo]["cabezas"]     += c
                result[cat][key][grupo]["kg_estimado"] += ke
        for cat in result:
            for key in ["por_establecimiento", "por_propietario"]:
                for g in result[cat][key]:
                    d = result[cat][key][g]
                    d["ton_estimado"] = round(d["kg_estimado"] / 1000, 2)
                    d["kg_promedio"]  = round(d["kg_estimado"] / d["cabezas"], 1) if d["cabezas"] > 0 else 0
        return result

    por_cat             = agrupar(col_cat)            if col_cat  else {}
    por_propietario     = agrupar(col_prop)            if col_prop else {}
    por_establecimiento = agrupar("NOMBRE_CORRAL")    if "NOMBRE_CORRAL"   in registros[0] else {}
    por_clas            = agrupar("CLASIFICACION")    if "CLASIFICACION"   in registros[0] else {}
    por_cat_final       = agrupar("CATEGORIA_FINAL")  if "CATEGORIA_FINAL" in registros[0] else {}
    por_cat_desglose    = agrupar_cat_desglose()      if "CATEGORIA_FINAL" in registros[0] else {}

    return {
        "total_cabezas":          int(total_cab),
        "total_kg_estimado_hoy":  round(total_kg_est),
        "total_ton_estimado_hoy": round(total_kg_est / 1000, 2),
        "kg_promedio_estimado":   prom_kg,
        "dias_promedio_feedlot":  dias_prom,
        "total_establecimientos": len(por_establecimiento),
        "total_propietarios":     len(por_propietario),
        "por_categoria":          por_cat,
        "por_propietario":        por_propietario,
        "por_establecimiento":    por_establecimiento,
        "por_clasificacion":      por_clas,
        "por_categoria_final":    por_cat_final,
        "por_establecimiento_categoria": agrupar_est_cat() if "NOMBRE_CORRAL" in registros[0] else {},
        "por_categoria_desglose":        por_cat_desglose,
    }

# ═══════════════════════════════════════════════════════════
#  MOVIMIENTOS PRODUCTIVOS (v_PB_Ingresos + v_PB_Egresos)
# ═══════════════════════════════════════════════════════════
# Columnas esperadas (se buscan por keyword si el nombre exacto no existe):
#   Ingresos: FECHA, HOTELERO/PROPIETARIO, ESTABLECIMIENTO/CORRAL/NRO_CORRAL,
#             CATEGORIA, CANTIDAD/CABEZAS, KG_TOTAL/KG/PESO_TOTAL
#   Egresos:  FECHA, HOTELERO/PROPIETARIO, ESTABLECIMIENTO/CORRAL/NRO_CORRAL,
#             CATEGORIA, CANTIDAD/CABEZAS, KG_TOTAL/KG/PESO_TOTAL,
#             TIPO_EGRESO/MOTIVO/DESTINO (opcional)
# Si alguna columna no existe el campo queda en 0 / "Sin datos".
# ────────────────────────────────────────────────────────────

def _find(cols, *keywords):
    """Retorna el nombre de columna que matchea algún keyword (case-insensitive)."""
    cl = [c.lower() for c in cols]
    for kw in keywords:
        kw = kw.lower()
        for i, c in enumerate(cl):
            if kw in c:
                return cols[i]
    return None

# Valores de consignataria a EXCLUIR de ingresos (case-insensitive)
CONSIGNATARIA_EXCLUIR = {"destete", "traslado"}

def _es_excluido_consignataria(r, col_cons):
    """True si el registro debe excluirse por tipo de consignataria."""
    if not col_cons:
        return False
    val = str(r.get(col_cons) or "").strip().lower()
    return val in CONSIGNATARIA_EXCLUIR

def _kpis_bloque(regs, col_cab, col_kg):
    """Calcula totales de un conjunto de registros."""
    total_cab = sum(to_num(r.get(col_cab, 0)) for r in regs) if col_cab else 0
    total_kg  = sum(to_num(r.get(col_kg,  0)) for r in regs) if col_kg  else 0
    kg_prom   = round(total_kg / total_cab, 1) if total_cab > 0 else 0
    return {
        "cabezas":    round(total_cab),
        "kg":         round(total_kg, 1),
        "kg_promedio": kg_prom,
    }

def _agrupar_movimientos(regs, col_fecha, col_prop, col_cat, col_cab, col_kg,
                          filtro_mes=None):
    """
    Agrupa registros por propietario, categoría y mes.
    filtro_mes: si se pasa (str "YYYY-MM"), solo acumula ese mes.
    """
    import pandas as pd

    por_prop  = {}
    por_cat   = {}
    por_mes   = {}
    total_cab = 0
    total_kg  = 0

    for r in regs:
        cab  = to_num(r.get(col_cab, 0)) if col_cab else 0
        kg   = to_num(r.get(col_kg,  0)) if col_kg  else 0
        prop = str(r.get(col_prop, "Sin datos") or "Sin datos").strip() if col_prop else "Sin datos"
        cat  = str(r.get(col_cat,  "Sin datos") or "Sin datos").strip() if col_cat  else "Sin datos"

        mes = "Sin fecha"
        if col_fecha:
            try:
                f = pd.to_datetime(r.get(col_fecha), errors="coerce")
                if f is not None and not pd.isnull(f):
                    mes = f.strftime("%Y-%m")
            except:
                pass

        # Si filtramos por mes específico, saltear los que no corresponden
        if filtro_mes and mes != filtro_mes:
            continue

        total_cab += cab
        total_kg  += kg

        for grupo, key in [(prop, por_prop), (cat, por_cat), (mes, por_mes)]:
            if grupo not in key:
                key[grupo] = {"cabezas": 0, "kg": 0}
            key[grupo]["cabezas"] += cab
            key[grupo]["kg"]      += kg

    # Redondear y calcular kg_promedio
    for d in [por_prop, por_cat, por_mes]:
        for k in d:
            d[k]["cabezas"]    = round(d[k]["cabezas"])
            d[k]["kg"]         = round(d[k]["kg"], 1)
            d[k]["kg_promedio"] = round(d[k]["kg"] / d[k]["cabezas"], 1) if d[k]["cabezas"] > 0 else 0

    return {
        "total_cabezas":   round(total_cab),
        "total_kg":        round(total_kg, 1),
        "kg_promedio":     round(total_kg / total_cab, 1) if total_cab > 0 else 0,
        "por_propietario": por_prop,
        "por_categoria":   por_cat,
        "por_mes":         por_mes,
    }


def procesar_movimientos(regs_ing, cols_ing, regs_egr, cols_egr, periodo):
    """
    Procesa ingresos y egresos.
    Genera dos cortes:
      - anio: últimos 365 días desde hoy
      - ultimo_mes: mes calendario actual
    Ingresos filtrados: excluye registros con consignataria DESTETE o TRASLADO.
    """
    import pandas as pd
    from datetime import timedelta

    hoy          = datetime.now()
    hace_un_anio = hoy - timedelta(days=365)
    mes_actual   = hoy.strftime("%Y-%m")

    # Mes anterior (completo, no el mes en curso)
    primer_dia_mes_actual = hoy.replace(day=1)
    ultimo_mes_dt  = primer_dia_mes_actual - timedelta(days=1)
    mes_anterior   = ultimo_mes_dt.strftime("%Y-%m")

    MESES_ES = {
        "January":"Enero","February":"Febrero","March":"Marzo","April":"Abril",
        "May":"Mayo","June":"Junio","July":"Julio","August":"Agosto",
        "September":"Septiembre","October":"Octubre","November":"Noviembre","December":"Diciembre"
    }
    nombre_mes_en  = hoy.strftime("%B %Y")
    nombre_mes     = MESES_ES.get(hoy.strftime("%B"), hoy.strftime("%B")) + " " + hoy.strftime("%Y")
    nombre_mes_ant = MESES_ES.get(ultimo_mes_dt.strftime("%B"), ultimo_mes_dt.strftime("%B")) + " " + ultimo_mes_dt.strftime("%Y")

    # ── Detectar columnas — primero intenta nombres exactos de WinCampo, luego keywords ──
    def cols_ing_det(cols, tipo):
        col_fecha = _find(cols, "FechaIngreso", "fechaingreso", "fecha_ingreso", "fecha")
        col_prop  = _find(cols, "hotelero", "propietario", "hotel")
        col_cat   = _find(cols, "categoria", "category", "cat")
        col_cab   = _find(cols, "Cantidad",   "cantidad", "cabezas", "nro_cab", "cant")
        # Hardcodear KgIngreso exacto — evitar KgEgreso u otras columnas similares
        col_kg = "KgIngreso" if regs_ing and "KgIngreso" in regs_ing[0] else                  "kgingreso" if regs_ing and "kgingreso" in regs_ing[0] else                  next((c for c in cols if c.lower() == "kgingreso"), None)
        col_cons   = _find(cols, "Consignatario", "consignatario", "consignataria", "consignat")
        col_origen = "Proveedor" if regs_ing and "Proveedor" in regs_ing[0] else                      next((c for c in cols if c.lower() == "proveedor"), None)
        log.info(f"  {tipo}: {len(regs_ing):,} regs | fecha={col_fecha} prop={col_prop} "
                 f"cat={col_cat} cab={col_cab} kg={col_kg} cons={col_cons} origen={col_origen}")
        log.info(f"  Todas las columnas de INGRESOS: {cols}")
        if col_kg and regs_ing:
            sample_kg = [r.get(col_kg) for r in regs_ing[:5]]
            log.info(f"  Primeros 5 valores KgIngreso ({col_kg}): {sample_kg}")
        if col_origen and regs_ing:
            vals_orig = sorted(set(str(r.get(col_origen) or "").strip() for r in regs_ing[:500] if r.get(col_origen)))
            log.info(f"  Valores únicos origen ({col_origen}) muestra: {vals_orig[:15]}")
        return col_fecha, col_prop, col_cat, col_cab, col_kg, col_cons, col_origen

    def cols_egr_det(cols, tipo):
        col_fecha   = _find(cols, "FechaSalida",  "fechasalida",  "fecha_salida",  "fecha_egreso", "fecha")
        col_prop    = _find(cols, "hotelero", "propietario", "hotel")
        col_cat     = _find(cols, "categoria", "category", "cat")
        col_cab     = _find(cols, "Cantidad",  "cantidad", "cabezas", "nro_cab", "cant")
        # Hardcodear KgEgreso exacto — la vista tiene KgIngreso, KgEgreso y KgGanado
        col_kg = "KgEgreso" if regs_egr and "KgEgreso" in regs_egr[0] else                  "kgegreso" if regs_egr and "kgegreso" in regs_egr[0] else                  next((c for c in cols if c.lower() == "kgegreso"), None)
        col_motivo  = _find(cols, "MotivoSalida", "motivosalida", "motivo_salida", "motivo", "tipo_egreso", "tipo")
        col_destino = "DestinoVenta" if regs_egr and "DestinoVenta" in regs_egr[0] else                       next((c for c in cols if c.lower() == "destinoventa"), None)
        log.info(f"  {tipo}: {len(regs_egr):,} regs | fecha={col_fecha} prop={col_prop} "
                 f"cat={col_cat} cab={col_cab} kg={col_kg} motivo={col_motivo} destino={col_destino}")
        log.info(f"  Todas las columnas de EGRESOS: {cols}")
        if col_kg and regs_egr:
            sample_kg_e = [r.get(col_kg) for r in regs_egr[:5]]
            log.info(f"  Primeros 5 valores KgEgreso ({col_kg}): {sample_kg_e}")
        if col_destino and regs_egr:
            vals_dest = sorted(set(str(r.get(col_destino) or "").strip() for r in regs_egr[:500] if r.get(col_destino)))
            log.info(f"  Valores únicos destino ({col_destino}) muestra: {vals_dest[:15]}")
        if col_motivo and regs_egr:
            vals_unicos = list({str(r.get(col_motivo) or "").strip() for r in regs_egr[:500]})
            vals_unicos.sort()
            log.info(f"  Valores únicos en '{col_motivo}' (muestra 500 regs): {vals_unicos}")
        return col_fecha, col_prop, col_cat, col_cab, col_kg, col_motivo, col_destino

    # ── Filtrar por fecha (último año) ──
    def filtrar_anio(regs, col_fecha):
        if not col_fecha:
            return regs
        filtrados = []
        for r in regs:
            try:
                f = pd.to_datetime(r.get(col_fecha), errors="coerce")
                if f is not None and not pd.isnull(f) and f >= pd.Timestamp(hace_un_anio):
                    filtrados.append(r)
            except:
                pass
        log.info(f"    Filtro último año: {len(regs):,} → {len(filtrados):,} registros")
        return filtrados

    # ── Filtrar consignataria (solo ingresos) ──
    def filtrar_consignataria(regs, col_cons):
        if not col_cons:
            return regs
        filtrados = [r for r in regs if not _es_excluido_consignataria(r, col_cons)]
        excluidos = len(regs) - len(filtrados)
        if excluidos:
            log.info(f"    Excluidos por consignataria (DESTETE/TRASLADO): {excluidos:,}")
        return filtrados

    # ── Filtrar solo VENTA en egresos ──
    def filtrar_solo_venta(regs, col_motivo):
        if not col_motivo:
            log.warning("    ⚠ No se encontró columna MotivoSalida — se usan todos los egresos")
            return regs
        filtrados = [r for r in regs
                     if str(r.get(col_motivo) or "").strip().upper() == "VENTA"]
        log.info(f"    Filtro MotivoSalida=VENTA: {len(regs):,} → {len(filtrados):,} registros")
        return filtrados

    # ── Agregar por_tipo_egreso (sobre todos los egresos del año, sin filtro VENTA) ──
    def calc_por_tipo(regs, col_motivo, col_cab, col_kg):
        if not col_motivo:
            return {}
        d = {}
        for r in regs:
            t   = str(r.get(col_motivo) or "Sin datos").strip()
            cab = to_num(r.get(col_cab, 0)) if col_cab else 0
            kg  = to_num(r.get(col_kg,  0)) if col_kg  else 0
            if t not in d:
                d[t] = {"cabezas": 0, "kg": 0}
            d[t]["cabezas"] += cab
            d[t]["kg"]      += kg
        for t in d:
            d[t]["cabezas"]    = round(d[t]["cabezas"])
            d[t]["kg"]         = round(d[t]["kg"], 1)
            d[t]["kg_promedio"] = round(d[t]["kg"] / d[t]["cabezas"], 1) if d[t]["cabezas"] > 0 else 0
        return d

    # ────────────────────────────────────────────────────────
    # INGRESOS
    # ────────────────────────────────────────────────────────
    EMPTY_ING = {"total_cabezas": 0, "total_kg": 0, "kg_promedio": 0,
                 "por_propietario": {}, "por_categoria": {}, "por_mes": {}}

    if regs_ing:
        ci = cols_ing_det(cols_ing, "INGRESOS")
        col_fecha_i, col_prop_i, col_cat_i, col_cab_i, col_kg_i, col_cons_i, col_origen_i = ci

        # Filtrar: último año + consignataria
        ing_anio = filtrar_anio(regs_ing, col_fecha_i)
        ing_anio = filtrar_consignataria(ing_anio, col_cons_i)

        # Último mes → mes anterior (completo)
        ing_mes_regs = [r for r in ing_anio if _get_mes(r, col_fecha_i) == mes_anterior]
        log.info(f"    Ingresos mes anterior ({mes_anterior}): {len(ing_mes_regs):,} registros")

        ing_anio_data = _agrupar_movimientos(ing_anio,     col_fecha_i, col_prop_i, col_cat_i, col_cab_i, col_kg_i)
        ing_mes_data  = _agrupar_movimientos(ing_mes_regs, col_fecha_i, col_prop_i, col_cat_i, col_cab_i, col_kg_i)

        # Top 10 orígenes por cabezas (Proveedor)
        if col_origen_i:
            orig_cnt  = {}
            orig_cats = {}  # origen -> {categoria: cabezas}
            for r in ing_anio:
                o   = str(r.get(col_origen_i) or "Sin datos").strip()
                cat = str(r.get(col_cat_i)    or "Sin datos").strip() if col_cat_i else "Sin datos"
                cab = round(to_num(r.get(col_cab_i, 1) if col_cab_i else 1))
                orig_cnt[o] = orig_cnt.get(o, 0) + cab
                if o not in orig_cats:
                    orig_cats[o] = {}
                orig_cats[o][cat] = orig_cats[o].get(cat, 0) + cab
            top10_origen = sorted(orig_cnt.items(), key=lambda x: -x[1])[:10]
            ing_anio_data["top10_origen"] = [
                {"nombre": k, "cabezas": v,
                 "por_categoria": dict(sorted(orig_cats[k].items(), key=lambda x: -x[1]))}
                for k, v in top10_origen
            ]
            log.info(f"    Top 3 orígenes: {top10_origen[:3]}")
        else:
            ing_anio_data["top10_origen"] = []
    else:
        log.warning("  ⚠ Sin datos de Ingresos")
        ing_anio_data = EMPTY_ING.copy()
        ing_mes_data  = EMPTY_ING.copy()

    # ────────────────────────────────────────────────────────
    # EGRESOS  (KgEgreso, FechaSalida, solo MotivoSalida=VENTA para KPIs/tablas)
    # ────────────────────────────────────────────────────────
    EMPTY_EGR = {"total_cabezas": 0, "total_kg": 0, "kg_promedio": 0,
                 "por_propietario": {}, "por_categoria": {}, "por_mes": {}, "por_tipo_egreso": {}}

    if regs_egr:
        ce = cols_egr_det(cols_egr, "EGRESOS")
        col_fecha_e, col_prop_e, col_cat_e, col_cab_e, col_kg_e, col_motivo_e, col_destino_e = ce

        # Filtrar: último año (por FechaSalida)
        egr_anio_todos = filtrar_anio(regs_egr, col_fecha_e)

        # Para KPIs y tablas: solo VENTA
        egr_anio_venta = filtrar_solo_venta(egr_anio_todos, col_motivo_e)

        # Mes anterior (sobre ventas)
        egr_mes_regs = [r for r in egr_anio_venta if _get_mes(r, col_fecha_e) == mes_anterior]
        log.info(f"    Egresos (VENTA) mes anterior ({mes_anterior}): {len(egr_mes_regs):,} registros")

        egr_anio_data = _agrupar_movimientos(egr_anio_venta, col_fecha_e, col_prop_e, col_cat_e, col_cab_e, col_kg_e)
        egr_anio_data["por_tipo_egreso"] = calc_por_tipo(egr_anio_todos, col_motivo_e, col_cab_e, col_kg_e)

        egr_mes_data = _agrupar_movimientos(egr_mes_regs, col_fecha_e, col_prop_e, col_cat_e, col_cab_e, col_kg_e)
        egr_mes_data["por_tipo_egreso"] = calc_por_tipo(egr_mes_regs, col_motivo_e, col_cab_e, col_kg_e)

        # Top 10 destinos (frigoríficos) por cabezas — solo ventas
        if col_destino_e:
            dest_cnt  = {}
            dest_cats = {}  # destino -> {categoria: cabezas}
            for r in egr_anio_venta:
                d   = str(r.get(col_destino_e) or "Sin datos").strip()
                cat = str(r.get(col_cat_e)     or "Sin datos").strip() if col_cat_e else "Sin datos"
                cab = round(to_num(r.get(col_cab_e, 1) if col_cab_e else 1))
                dest_cnt[d] = dest_cnt.get(d, 0) + cab
                if d not in dest_cats:
                    dest_cats[d] = {}
                dest_cats[d][cat] = dest_cats[d].get(cat, 0) + cab
            top10_destino = sorted(dest_cnt.items(), key=lambda x: -x[1])[:10]
            egr_anio_data["top10_destino"] = [
                {"nombre": k, "cabezas": v,
                 "por_categoria": dict(sorted(dest_cats[k].items(), key=lambda x: -x[1]))}
                for k, v in top10_destino
            ]
            log.info(f"    Top 3 destinos: {top10_destino[:3]}")
        else:
            egr_anio_data["top10_destino"] = []
    else:
        log.warning("  ⚠ Sin datos de Egresos")
        egr_anio_data = EMPTY_EGR.copy()
        egr_mes_data  = EMPTY_EGR.copy()

    # ────────────────────────────────────────────────────────
    # RESÚMENES
    # ────────────────────────────────────────────────────────
    def make_resumen(ing, egr):
        saldo_cab = ing["total_cabezas"] - egr["total_cabezas"]
        saldo_kg  = round(ing["total_kg"] - egr["total_kg"], 1)
        return {
            "cabezas_ingresadas":  ing["total_cabezas"],
            "kg_ingresado":        ing["total_kg"],
            "kg_promedio_ingreso": ing["kg_promedio"],
            "cabezas_egresadas":   egr["total_cabezas"],
            "kg_egresado":         egr["total_kg"],
            "kg_promedio_egreso":  egr["kg_promedio"],
            "saldo_cabezas":       saldo_cab,
            "saldo_kg":            saldo_kg,
        }

    log.info(f"  Último año    → Ing: {ing_anio_data['total_cabezas']:,} cab / {ing_anio_data['total_kg']:,.0f} kg"
             f"  |  Egr: {egr_anio_data['total_cabezas']:,} cab / {egr_anio_data['total_kg']:,.0f} kg")
    log.info(f"  Mes anterior  → Ing: {ing_mes_data['total_cabezas']:,} cab"
             f"  |  Egr: {egr_mes_data['total_cabezas']:,} cab")

    return {
        "meta": {
            "generado":      datetime.now().isoformat(),
            "periodo":       periodo,
            "mes_actual":    mes_actual,
            "nombre_mes":    nombre_mes,
            "mes_anterior":  mes_anterior,
            "nombre_mes_ant": nombre_mes_ant,
            "desde_anio":    hace_un_anio.strftime("%Y-%m-%d"),
            "hasta":         hoy.strftime("%Y-%m-%d"),
            "filtros":       "Ingresos: excluye CONSIGNATARIO en [DESTETE, TRASLADO]. Egresos: solo MotivoSalida=VENTA para KPIs. Por Tipo incluye todos los motivos.",
        },
        "anio": {
            "resumen":  make_resumen(ing_anio_data, egr_anio_data),
            "ingresos": ing_anio_data,
            "egresos":  egr_anio_data,
        },
        "ultimo_mes": {
            "nombre":   nombre_mes_ant,
            "resumen":  make_resumen(ing_mes_data, egr_mes_data),
            "ingresos": ing_mes_data,
            "egresos":  egr_mes_data,
        },
    }


def _get_mes(r, col_fecha):
    """Retorna 'YYYY-MM' del registro, o '' si no hay fecha."""
    if not col_fecha:
        return ""
    try:
        import pandas as pd
        f = pd.to_datetime(r.get(col_fecha), errors="coerce")
        if f is not None and not pd.isnull(f):
            return f.strftime("%Y-%m")
    except:
        pass
    return ""


# ═══════════════════════════════════════════════════════════
#  MUERTES (V_MUERTES)
# ═══════════════════════════════════════════════════════════
# Columnas conocidas:
#   MUERTOS     : cantidad de cabezas muertas
#   ABREVIATURA : categoría del animal
# Columnas buscadas automáticamente:
#   fecha       : para filtro último año y evolución mensual
#   establecimiento: para desglose por campo (si existe)
# ─────────────────────────────────────────────────────────

def procesar_muertes(regs_m, cols_m, regs_ing, cols_ing, regs_stock, cols_stock, periodo):
    """
    Procesa V_MUERTES y calcula tasa de mortandad anual compuesta.

    Tasa mensual = muertes_anio / (ingresos_anio_filtrados + stock_haras_hoy)
    Tasa anual   = (1 + tasa_mensual)^12 - 1

    El Haras = corrales NRO_CORRAL 1–199 en stock.
    Ingresos = todos excepto CONSIGNATARIO en [DESTETE, TRASLADO].
    """
    import pandas as pd
    from datetime import timedelta

    hoy          = datetime.now()
    hace_un_anio = hoy - timedelta(days=365)
    mes_actual   = hoy.strftime("%Y-%m")
    MESES_ES     = {"January":"Enero","February":"Febrero","March":"Marzo","April":"Abril",
                    "May":"Mayo","June":"Junio","July":"Julio","August":"Agosto",
                    "September":"Septiembre","October":"Octubre","November":"Noviembre","December":"Diciembre"}
    nombre_mes   = MESES_ES.get(hoy.strftime("%B"), hoy.strftime("%B")) + " " + hoy.strftime("%Y")

    # ══════════════════════════════════════════════
    # A) COLUMNAS V_MUERTES
    # ══════════════════════════════════════════════
    # FECHA_MUERTE es la columna correcta — buscarla EXACTA primero
    col_muertes = _find(cols_m, "MUERTOS", "muertos", "muertes", "bajas", "baja")
    col_cat     = _find(cols_m, "ABREVIATURA", "abreviatura", "categoria", "cat", "especie")
    col_fecha_m = "FECHA_MUERTE" if regs_m and "FECHA_MUERTE" in regs_m[0] else                   _find(cols_m, "FECHA_MUERTE", "fecha_muerte", "FECHA", "fecha")

    # helpers — definidos ANTES de cualquier uso
    def en_anio(r, col_f):
        try:
            f = pd.to_datetime(r.get(col_f), errors="coerce")
            return f is not None and not pd.isnull(f) and f >= pd.Timestamp(hace_un_anio)
        except:
            return False

    def get_mes(r, col_f):
        try:
            f = pd.to_datetime(r.get(col_f), errors="coerce")
            if f is not None and not pd.isnull(f):
                return f.strftime("%Y-%m")
        except:
            pass
        return "Sin fecha"

    def sumar_col(registros, col):
        return sum(to_num(r.get(col, 0)) for r in registros) if col else 0

    def to_int_directo(v):
        """Convierte valor a entero sin tocar separadores — para columna MUERTOS."""
        try:
            return int(float(str(v or 0)))
        except:
            return 0

    def sumar_muertes(registros):
        """Suma columna MUERTOS usando conversión directa float→int."""
        return sum(to_int_directo(r.get(col_muertes, 0)) for r in registros) if col_muertes else 0

    log.info(f"  V_MUERTES: {len(regs_m):,} regs | muertes={col_muertes} cat={col_cat} fecha={col_fecha_m}")
    log.info(f"  TODAS las columnas: {cols_m}")
    if regs_m and col_muertes:
        vals = [to_int_directo(r.get(col_muertes, 0)) for r in regs_m[:5]]
        log.info(f"  Primeros 5 valores MUERTOS: {vals}")
    if not col_muertes:
        log.error("  ✗ No se encontró columna MUERTOS")

    # ── Grupos de categorías ──────────────────────────────────────────────────
    # Vacas: VA | Machos: TM, NT, NV, TO | Hembras: TH, VQ
    GRUPOS = {
        "Vacas":   {"VA"},
        "Machos":  {"TM", "NT", "NV", "TO"},
        "Hembras": {"TH", "VQ"},
    }
    # Nombres largos tal como vienen en v_PB_Ingresos columna Categoria
    GRUPOS_NOMBRE = {
        "VACA":       "Vacas",
        "TERNERO":    "Machos",
        "NOVILLITO":  "Machos",
        "NOVILLO":    "Machos",
        "TORO":       "Machos",
        "TERNERA":    "Hembras",
        "VAQUILLONA": "Hembras",
    }
    GRUPOS_ORDEN = ["Vacas", "Machos", "Hembras"]

    def get_grupo(abrev):
        """Retorna el grupo según código corto (VA/TM/etc.) o nombre largo (VACA/NOVILLO/etc.)."""
        a = str(abrev or "").strip().upper()
        for g, cats in GRUPOS.items():
            if a in cats:
                return g
        return GRUPOS_NOMBRE.get(a, "Otros")

    def dias_encierre(r):
        """Días de encierre usando columna DIAS_ENCIERRE (ya calculada en V_MUERTES)."""
        try:
            return int(float(r.get("DIAS_ENCIERRE") or 0))
        except:
            return 0

    def agrupar(registros, col_grupo, col_val, label="Sin datos"):
        d = {}
        for r in registros:
            g = str(r.get(col_grupo) or label).strip() if col_grupo else label
            val = to_int_directo(r.get(col_val, 0)) if col_val == col_muertes else                   (to_num(r.get(col_val, 0)) if col_val else 0)
            d[g] = d.get(g, 0) + val
        return {k: round(v) for k, v in sorted(d.items(), key=lambda x: -x[1])}

    def agrupar_mes(registros, col_f, col_val):
        d = {}
        for r in registros:
            mes = get_mes(r, col_f) if col_f else "Sin fecha"
            val = to_int_directo(r.get(col_val, 0)) if col_val == col_muertes else                   (to_num(r.get(col_val, 0)) if col_val else 0)
            d[mes] = d.get(mes, 0) + val
        return {k: round(v) for k, v in sorted(d.items())}

    def sumar_por_grupo_m(registros):
        """Suma muertes agrupadas por Vacas/Machos/Hembras."""
        d = {g: 0 for g in GRUPOS_ORDEN}
        d["Otros"] = 0
        for r in registros:
            g = get_grupo(r.get(col_cat))
            d[g] = d.get(g, 0) + to_int_directo(r.get(col_muertes, 0))
        return {k: round(v) for k, v in d.items() if v > 0}

    # ── Filtrar muertes último año ──────────────────────────────────────────
    if col_fecha_m:
        regs_anio_m = [r for r in regs_m if en_anio(r, col_fecha_m)]
        log.info(f"    Muertes filtro último año: {len(regs_m):,} → {len(regs_anio_m):,}")
        log.info(f"    Suma MUERTOS sin filtro días: {round(sumar_muertes(regs_anio_m)):,}")
    else:
        regs_anio_m = regs_m
        log.warning(f"    ⚠ col_fecha_m=None — sin filtro de fecha")

    # ── Filtro >30 días de encierre (columna DIAS_ENCIERRE) ────────────────
    regs_anio_m30 = [r for r in regs_anio_m if dias_encierre(r) > 30]
    excluidos_30  = len(regs_anio_m) - len(regs_anio_m30)
    log.info(f"    Filtro >30d encierre: {len(regs_anio_m):,} → {len(regs_anio_m30):,} ({excluidos_30} excluidos)")
    log.info(f"    Suma MUERTOS último año (>30d): {round(sumar_muertes(regs_anio_m30)):,}")

    total_anio_m    = round(sumar_muertes(regs_anio_m30))
    por_cat_anio    = agrupar(regs_anio_m30, col_cat, col_muertes)
    por_grupo_anio  = sumar_por_grupo_m(regs_anio_m30)
    por_mes_anio    = agrupar_mes(regs_anio_m30, col_fecha_m, col_muertes)

    regs_mes_m      = [r for r in regs_anio_m30 if get_mes(r, col_fecha_m) == mes_actual] if col_fecha_m else []
    total_mes_m     = round(sumar_muertes(regs_mes_m))
    por_cat_mes     = agrupar(regs_mes_m, col_cat, col_muertes)
    por_grupo_mes   = sumar_por_grupo_m(regs_mes_m)
    por_mes_mes     = agrupar_mes(regs_mes_m, col_fecha_m, col_muertes)

    log.info(f"  Muertes último año (>30d) → {total_anio_m:,}")
    log.info(f"  Muertes mes actual        → {total_mes_m:,}")
    log.info(f"  Por grupo año: {por_grupo_anio}")

    # ══════════════════════════════════════════════
    # B) INGRESOS ÚLTIMO AÑO — total y por grupo
    # ══════════════════════════════════════════════
    col_fecha_i = _find(cols_ing, "FechaIngreso", "fechaingreso", "fecha_ingreso", "fecha")
    col_cab_i   = _find(cols_ing, "CantidadIngreso", "Cantidad", "cantidad", "cabezas", "nro_cab", "cant")
    col_cons_i  = _find(cols_ing, "Consignatario", "consignatario", "consignataria", "consignat")
    col_cat_i   = _find(cols_ing, "Categoria", "categoria", "category", "cat")

    # Diagnóstico: ver valores únicos de categoría en ingresos
    if col_cat_i and regs_ing:
        cats_ing = sorted(set(str(r.get(col_cat_i) or "").strip() for r in regs_ing[:500] if r.get(col_cat_i)))
        log.info(f"  Valores únicos Categoria en ingresos (muestra): {cats_ing[:20]}")

    def es_excluido_cons(r):
        if not col_cons_i:
            return False
        return str(r.get(col_cons_i) or "").strip().upper() in {"DESTETE", "TRASLADO"}

    if col_fecha_i:
        ing_anio = [r for r in regs_ing if en_anio(r, col_fecha_i) and not es_excluido_cons(r)]
    else:
        ing_anio = [r for r in regs_ing if not es_excluido_cons(r)]

    total_cab_ing_anio = round(sumar_col(ing_anio, col_cab_i))

    # Ingresos por grupo (Vacas/Machos/Hembras)
    ing_por_grupo = {g: 0 for g in GRUPOS_ORDEN}
    ing_por_grupo["Otros"] = 0
    for r in ing_anio:
        g   = get_grupo(r.get(col_cat_i) if col_cat_i else "")
        cab = to_num(r.get(col_cab_i, 0)) if col_cab_i else 0
        ing_por_grupo[g] = ing_por_grupo.get(g, 0) + cab
    ing_por_grupo = {k: round(v) for k, v in ing_por_grupo.items() if v > 0}

    log.info(f"  Ingresos último año → {total_cab_ing_anio:,} cab | por grupo: {ing_por_grupo}")

    # ══════════════════════════════════════════════
    # C) STOCK HOY — EL HARAS — total y por grupo
    # ══════════════════════════════════════════════
    col_cab_s    = "CANTIDAD"    if (regs_stock and "CANTIDAD"    in regs_stock[0]) else _find(cols_stock, "cabezas", "cantidad", "cant")
    col_nombre_s = "NOMBRE_CORRAL" if (regs_stock and "NOMBRE_CORRAL" in regs_stock[0]) else _find(cols_stock, "nombre_corral", "establecimiento")
    col_corral_s = "NRO_CORRAL"  if (regs_stock and "NRO_CORRAL"  in regs_stock[0]) else _find(cols_stock, "nro_corral", "corral")
    col_cat_s    = "CATEGORIA_FINAL" if (regs_stock and "CATEGORIA_FINAL" in regs_stock[0]) else                    _find(cols_stock, "ABREVIATURA", "abreviatura", "categoria", "cat")

    def es_haras(r):
        if col_nombre_s:
            nombre = str(r.get(col_nombre_s) or "").strip().lower()
            if nombre == "el haras":
                return True
        if col_corral_s:
            try:
                nro = int(float(r.get(col_corral_s) or 0))
                return 1 <= nro <= 199
            except:
                pass
        return False

    # Mapeo de CATEGORIA_FINAL a grupos
    CAT_FINAL_GRUPO = {
        "vaca":                 "Vacas",
        "vaca mayor a 650 kg":  "Vacas",
        "novillo":              "Machos",
        "novillo mayor a 550 kg": "Machos",
        "novillito":            "Machos",
        "ternero":              "Machos",
        "toro":                 "Machos",
        "vaquillona":           "Hembras",
        "ternera":              "Hembras",
    }

    def get_grupo_stock(r):
        cat = str(r.get(col_cat_s) or "").strip().lower() if col_cat_s else ""
        return CAT_FINAL_GRUPO.get(cat, "Otros")

    stock_haras = [r for r in regs_stock if es_haras(r)]
    total_stock_haras = round(sumar_col(stock_haras, col_cab_s))

    stock_por_grupo = {g: 0 for g in GRUPOS_ORDEN}
    stock_por_grupo["Otros"] = 0
    for r in stock_haras:
        g   = get_grupo_stock(r)
        cab = to_num(r.get(col_cab_s, 0)) if col_cab_s else 0
        stock_por_grupo[g] = stock_por_grupo.get(g, 0) + cab
    stock_por_grupo = {k: round(v) for k, v in stock_por_grupo.items() if v > 0}

    log.info(f"  Stock El Haras → {total_stock_haras:,} cab | por grupo: {stock_por_grupo}")

    # ══════════════════════════════════════════════
    # D) ÚLTIMOS 30 DÍAS
    # ══════════════════════════════════════════════
    hace_30        = hoy - timedelta(days=30)
    nombre_mes_ant = f"Últimos 30 días ({hace_30.strftime('%d/%m/%Y')} – {hoy.strftime('%d/%m/%Y')})"
    mes_anterior   = hace_30.strftime("%Y-%m-%d")

    def en_ultimos_30(r):
        if not col_fecha_m:
            return False
        try:
            import pandas as pd
            f = pd.to_datetime(r.get(col_fecha_m), errors="coerce")
            if f is not None and not pd.isnull(f):
                return f.date() >= hace_30.date()
        except:
            pass
        return False

    regs_mes_ant_m    = [r for r in regs_anio_m30 if en_ultimos_30(r)]
    total_mes_ant_m   = round(sumar_muertes(regs_mes_ant_m))
    por_cat_mes_ant   = agrupar(regs_mes_ant_m, col_cat, col_muertes)
    por_grupo_mes_ant = sumar_por_grupo_m(regs_mes_ant_m)
    log.info(f"  Muertes últimos 30 días → {total_mes_ant_m:,}")

    # ══════════════════════════════════════════════
    # E) TASA DE MORTANDAD — global y por grupo
    # ══════════════════════════════════════════════
    denominador  = total_cab_ing_anio + total_stock_haras
    tasa_mensual = (total_anio_m / denominador) if denominador > 0 else None
    tasa_mens_p  = round(tasa_mensual * 100, 3) if tasa_mensual is not None else None

    # Tasa por grupo: solo mensual
    tasas_grupo = {}
    for g in GRUPOS_ORDEN:
        m_g   = por_grupo_anio.get(g, 0)
        i_g   = ing_por_grupo.get(g, 0)
        s_g   = stock_por_grupo.get(g, 0)
        den_g = i_g + s_g
        if den_g > 0:
            tm_g = m_g / den_g
            tasas_grupo[g] = {
                "muertes":          m_g,
                "ingresos":         i_g,
                "stock":            s_g,
                "denominador":      den_g,
                "tasa_mensual_pct": round(tm_g * 100, 3),
            }
        else:
            tasas_grupo[g] = {"muertes": m_g, "ingresos": i_g, "stock": s_g,
                               "denominador": 0, "tasa_mensual_pct": None}

    log.info(f"  ── Tasa de mortandad ──")
    log.info(f"    Muertes año (>30d) : {total_anio_m:,}")
    log.info(f"    Ingresos año       : {total_cab_ing_anio:,}")
    log.info(f"    Stock El Haras     : {total_stock_haras:,}")
    log.info(f"    Denominador        : {denominador:,}")
    log.info(f"    Tasa mensual       : {tasa_mens_p}%")
    for g, t in tasas_grupo.items():
        log.info(f"    {g:<10} → {t.get('muertes'):>4} muertes / {t.get('denominador'):>6,} den → {t.get('tasa_mensual_pct')}% mensual")

    # ══════════════════════════════════════════════
    # RESULTADO
    # ══════════════════════════════════════════════
    return {
        "meta": {
            "generado":      datetime.now().isoformat(),
            "periodo":       periodo,
            "tabla":         "V_MUERTES",
            "mes_actual":    mes_actual,
            "nombre_mes":    nombre_mes,
            "mes_anterior":  mes_anterior,
            "nombre_mes_ant": nombre_mes_ant,
            "desde_anio":    hace_un_anio.strftime("%Y-%m-%d"),
            "hasta":         hoy.strftime("%Y-%m-%d"),
            "filtro_dias":   ">30 días de encierre",
        },
        "mortandad": {
            "muertes_anio":     total_anio_m,
            "ingresos_anio":    total_cab_ing_anio,
            "stock_haras_hoy":  total_stock_haras,
            "denominador":      denominador,
            "tasa_mensual_pct": tasa_mens_p,
            "formula":          "tasa_mensual = muertes_año / (ingresos_año + stock_hoy)",
            "por_grupo":        tasas_grupo,
        },
        "anio": {
            "total_muertes": total_anio_m,
            "por_categoria": por_cat_anio,
            "por_grupo":     por_grupo_anio,
            "por_mes":       por_mes_anio,
        },
        "mes_anterior": {
            "nombre":        nombre_mes_ant,
            "mes":           mes_anterior,
            "total_muertes": total_mes_ant_m,
            "por_categoria": por_cat_mes_ant,
            "por_grupo":     por_grupo_mes_ant,
        },
    }




# ═══════════════════════════════════════════════════════════
#  MUERTES ÚLTIMOS 30 DÍAS — módulo independiente
#  Mismo análisis que el anual pero ventana = 30 días:
#  muertes (>30d encierre), ingresos y stock por grupo
#  → genera muertes_30d_YYYY.json
# ═══════════════════════════════════════════════════════════
def procesar_muertes_30d(regs_m, cols_m, regs_ing, cols_ing, regs_stock, cols_stock, periodo):
    import pandas as pd
    from datetime import timedelta

    hoy     = datetime.now()
    hace_30 = hoy - timedelta(days=30)
    desde_str = hace_30.strftime("%d/%m/%Y")
    hasta_str = hoy.strftime("%d/%m/%Y")
    label_periodo = f"Últimos 30 días ({desde_str} – {hasta_str})"

    # ── Columnas V_MUERTES ──────────────────────────────────
    col_muertes = _find(cols_m, "MUERTOS", "muertos", "muertes", "bajas", "baja")
    col_cat     = _find(cols_m, "ABREVIATURA", "abreviatura", "categoria", "cat", "especie")
    col_fecha_m = "FECHA_MUERTE" if regs_m and "FECHA_MUERTE" in regs_m[0] else \
                  _find(cols_m, "FECHA_MUERTE", "fecha_muerte", "FECHA", "fecha")

    def to_int_directo(v):
        try: return int(float(str(v or 0)))
        except: return 0

    def to_num_local(v):
        try:
            s = str(v or "0").strip().replace(",", ".")
            return float(s)
        except: return 0.0

    def en_30d(r, col_f):
        try:
            f = pd.to_datetime(r.get(col_f), errors="coerce")
            return f is not None and not pd.isnull(f) and f.date() >= hace_30.date()
        except: return False

    def dias_encierre(r):
        try: return int(float(r.get("DIAS_ENCIERRE") or 0))
        except: return 0

    # Grupos
    GRUPOS = {"Vacas": {"VA"}, "Machos": {"TM","NT","NV","TO"}, "Hembras": {"TH","VQ"}}
    GRUPOS_NOMBRE = {"VACA":"Vacas","TERNERO":"Machos","NOVILLITO":"Machos",
                     "NOVILLO":"Machos","TORO":"Machos","TERNERA":"Hembras","VAQUILLONA":"Hembras"}
    GRUPOS_ORDEN = ["Vacas","Machos","Hembras"]
    CAT_FINAL_GRUPO = {
        "vaca":"Vacas","vaca mayor a 650 kg":"Vacas",
        "novillo":"Machos","novillo mayor a 550 kg":"Machos",
        "novillito":"Machos","ternero":"Machos","toro":"Machos",
        "vaquillona":"Hembras","ternera":"Hembras",
    }

    def get_grupo(abrev):
        a = str(abrev or "").strip().upper()
        for g, cats in GRUPOS.items():
            if a in cats: return g
        return GRUPOS_NOMBRE.get(a, "Otros")

    def get_grupo_stock(r):
        cat = str(r.get(col_cat_s) or "").strip().lower() if col_cat_s else ""
        return CAT_FINAL_GRUPO.get(cat, "Otros")

    # ── A) MUERTES últimos 30d con >30d encierre ────────────
    if col_fecha_m:
        regs_30d = [r for r in regs_m if en_30d(r, col_fecha_m) and dias_encierre(r) > 30]
    else:
        regs_30d = []

    total_m = round(sum(to_int_directo(r.get(col_muertes, 0)) for r in regs_30d))

    # Por categoría
    por_cat = {}
    for r in regs_30d:
        c = str(r.get(col_cat) or "Sin datos").strip() if col_cat else "Sin datos"
        por_cat[c] = por_cat.get(c, 0) + to_int_directo(r.get(col_muertes, 0))
    por_cat = {k: round(v) for k, v in sorted(por_cat.items(), key=lambda x: -x[1])}

    # Por grupo
    por_grupo_m = {g: 0 for g in GRUPOS_ORDEN}
    for r in regs_30d:
        g = get_grupo(r.get(col_cat))
        por_grupo_m[g] = por_grupo_m.get(g, 0) + to_int_directo(r.get(col_muertes, 0))
    por_grupo_m = {k: round(v) for k, v in por_grupo_m.items()}

    log.info(f"  [30d] Muertes (>30d encierre): {total_m:,} | por grupo: {por_grupo_m}")

    # ── B) INGRESOS últimos 30d ─────────────────────────────
    col_fecha_i = _find(cols_ing, "FechaIngreso","fechaingreso","fecha_ingreso","fecha")
    col_cab_i   = _find(cols_ing, "CantidadIngreso","Cantidad","cantidad","cabezas","nro_cab","cant")
    col_cons_i  = _find(cols_ing, "Consignatario","consignatario","consignataria","consignat")
    col_cat_i   = _find(cols_ing, "Categoria","categoria","category","cat")

    def es_excluido(r):
        if not col_cons_i: return False
        return str(r.get(col_cons_i) or "").strip().upper() in {"DESTETE","TRASLADO"}

    if col_fecha_i:
        ing_30d = [r for r in regs_ing if en_30d(r, col_fecha_i) and not es_excluido(r)]
    else:
        ing_30d = [r for r in regs_ing if not es_excluido(r)]

    total_ing = round(sum(to_num_local(r.get(col_cab_i, 0)) for r in ing_30d) if col_cab_i else 0)

    ing_por_grupo = {g: 0 for g in GRUPOS_ORDEN}
    for r in ing_30d:
        g   = get_grupo(r.get(col_cat_i) if col_cat_i else "")
        cab = to_num_local(r.get(col_cab_i, 0)) if col_cab_i else 0
        ing_por_grupo[g] = ing_por_grupo.get(g, 0) + cab
    ing_por_grupo = {k: round(v) for k, v in ing_por_grupo.items()}

    log.info(f"  [30d] Ingresos: {total_ing:,} cab | por grupo: {ing_por_grupo}")

    # ── C) STOCK hoy El Haras (igual que el anual — es snapshot) ──
    col_cab_s    = "CANTIDAD"       if (regs_stock and "CANTIDAD"       in regs_stock[0]) else _find(cols_stock, "cabezas","cantidad","cant")
    col_nombre_s = "NOMBRE_CORRAL"  if (regs_stock and "NOMBRE_CORRAL"  in regs_stock[0]) else _find(cols_stock, "nombre_corral","establecimiento")
    col_corral_s = "NRO_CORRAL"     if (regs_stock and "NRO_CORRAL"     in regs_stock[0]) else _find(cols_stock, "nro_corral","corral")
    col_cat_s    = "CATEGORIA_FINAL" if (regs_stock and "CATEGORIA_FINAL" in regs_stock[0]) else \
                   _find(cols_stock, "ABREVIATURA","abreviatura","categoria","cat")

    def es_haras(r):
        if col_nombre_s:
            if str(r.get(col_nombre_s) or "").strip().lower() == "el haras": return True
        if col_corral_s:
            try:
                nro = int(float(r.get(col_corral_s) or 0))
                return 1 <= nro <= 199
            except: pass
        return False

    stock_haras = [r for r in regs_stock if es_haras(r)]
    total_stock = round(sum(to_num_local(r.get(col_cab_s, 0)) for r in stock_haras) if col_cab_s else 0)

    stock_por_grupo = {g: 0 for g in GRUPOS_ORDEN}
    for r in stock_haras:
        g   = get_grupo_stock(r)
        cab = to_num_local(r.get(col_cab_s, 0)) if col_cab_s else 0
        stock_por_grupo[g] = stock_por_grupo.get(g, 0) + cab
    stock_por_grupo = {k: round(v) for k, v in stock_por_grupo.items()}

    log.info(f"  [30d] Stock El Haras: {total_stock:,} cab | por grupo: {stock_por_grupo}")

    # ── D) TASA DE MORTANDAD 30 días ────────────────────────
    denominador  = total_ing + total_stock
    tasa_mens_p  = round(total_m / denominador * 100, 3) if denominador > 0 else None

    tasas_grupo = {}
    for g in GRUPOS_ORDEN:
        m_g   = por_grupo_m.get(g, 0)
        i_g   = ing_por_grupo.get(g, 0)
        s_g   = stock_por_grupo.get(g, 0)
        den_g = i_g + s_g
        tasas_grupo[g] = {
            "muertes":          m_g,
            "ingresos":         i_g,
            "stock":            s_g,
            "denominador":      den_g,
            "tasa_mensual_pct": round(m_g / den_g * 100, 3) if den_g > 0 else None,
        }

    log.info(f"  [30d] Tasa: {tasa_mens_p}% | denom: {denominador:,}")
    for g, t in tasas_grupo.items():
        log.info(f"    {g:<10} → {t['muertes']:>4} muertes / {t['denominador']:>6,} den → {t['tasa_mensual_pct']}%")

    return {
        "meta": {
            "generado":       datetime.now().isoformat(),
            "periodo":        periodo,
            "tabla":          "V_MUERTES",
            "ventana":        "30 días",
            "desde":          hace_30.strftime("%Y-%m-%d"),
            "hasta":          hoy.strftime("%Y-%m-%d"),
            "label_periodo":  label_periodo,
            "filtro_dias":    ">30 días de encierre",
        },
        "mortandad": {
            "muertes_30d":      total_m,
            "ingresos_30d":     total_ing,
            "stock_haras_hoy":  total_stock,
            "denominador":      denominador,
            "tasa_mensual_pct": tasa_mens_p,
            "formula":          "tasa = muertes_30d / (ingresos_30d + stock_hoy)",
            "por_grupo":        tasas_grupo,
        },
        "detalle": {
            "total_muertes": total_m,
            "por_categoria": por_cat,
            "por_grupo":     por_grupo_m,
        },
    }

# ═══════════════════════════════════════════════════════════
#  GUARDAR JSON
# ═══════════════════════════════════════════════════════════
def guardar(datos, carpeta, nombre):
    dest = Path(carpeta)
    dest.mkdir(parents=True, exist_ok=True)
    ruta = dest / nombre
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(limpiar_nan(datos), f, ensure_ascii=False, indent=2, default=str)
    log.info(f"  Guardado: {ruta.name}  ({ruta.stat().st_size // 1024} KB)")
    return str(ruta)

# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════

def procesar_productivo(regs_egr, cols_egr, periodo):
    """
    Parámetros productivos desde v_PB_Egresos.
    Métricas: AdpSinDebaste (engorde diario) y Estadia (días en feedlot).
    Filtra MotivoSalida = VENTA. Últimos 365 días por FechaSalida.
    """
    from datetime import date, timedelta
    import pandas as pd

    hoy        = date.today()
    hace_anio  = hoy - timedelta(days=365)

    # Detectar columnas
    def fc(nombres):
        cl = {c.lower(): c for c in cols_egr}
        for n in nombres:
            if n.lower() in cl:
                return cl[n.lower()]
        return None

    col_fecha   = fc(["FechaSalida","fechasalida","fecha_salida","fecha"])
    col_motivo  = fc(["MotivoSalida","motivosalida","motivo_salida","motivo"])
    col_adp     = fc(["AdpSinDebaste","adpsindebaste","adp_sin_debaste","adp"])
    col_estadia = fc(["Estadia","estadia","estadía","dias_estadia","dias_encierre"])
    col_cat     = fc(["Categoria","categoria","category","cat"])
    col_cab     = fc(["Cantidad","cantidad","cabezas"])
    col_rfid    = fc(["RFID","rfid"])

    log.info(f"  Productivo | fecha={col_fecha} motivo={col_motivo} adp={col_adp} estadia={col_estadia} cat={col_cat} cab={col_cab} rfid={col_rfid}")
    log.info(f"  Todas las columnas de v_PB_Egresos: {cols_egr}")

    # Filtrar con todos los criterios de calidad
    regs = []
    excl = {"motivo": 0, "rfid": 0, "estadia": 0, "adp": 0, "fecha": 0}
    for r in regs_egr:
        # 1) Filtro fecha (último año)
        try:
            f = pd.to_datetime(r.get(col_fecha), errors="coerce") if col_fecha else None
            if f is None or pd.isnull(f): excl["fecha"] += 1; continue
            if f.date() < hace_anio:      excl["fecha"] += 1; continue
        except: excl["fecha"] += 1; continue

        # 2) MotivoSalida = VENTA
        if col_motivo:
            mot = str(r.get(col_motivo) or "").strip().upper()
            if "VENTA" not in mot: excl["motivo"] += 1; continue

        # 3) RFID solo numérico (si tiene alguna letra, se descarta)
        if col_rfid:
            rfid = str(r.get(col_rfid) or "").strip()
            if rfid and not rfid.isdigit(): excl["rfid"] += 1; continue

        # 4) Estadia > 30 y < 365
        est = to_num(r.get(col_estadia)) if col_estadia else None
        if est is None or not (30 < est < 365): excl["estadia"] += 1; continue

        # 5) AdpSinDebaste entre 0 y 5
        adp = to_num(r.get(col_adp)) if col_adp else None
        if adp is None or not (0 < adp <= 5): excl["adp"] += 1; continue

        regs.append(r)

    log.info(f"  Registros totales: {len(regs_egr):,}")
    log.info(f"  Excluidos por fecha:   {excl['fecha']:,}")
    log.info(f"  Excluidos por motivo:  {excl['motivo']:,}")
    log.info(f"  Excluidos por RFID:    {excl['rfid']:,}")
    log.info(f"  Excluidos por estadía: {excl['estadia']:,}")
    log.info(f"  Excluidos por ADP:     {excl['adp']:,}")
    log.info(f"  Registros válidos:     {len(regs):,}")

    if not regs:
        return {
            "meta": {"generado": datetime.now().isoformat(), "periodo": periodo, "tabla": "v_PB_Egresos",
                     "ventana": "365 días",
                     "filtros": "MotivoSalida=VENTA | RFID numérico | Estadía 30-365d | ADP 0-5",
                     "registros_filtrados": 0},
            "general": {}, "por_categoria": {}, "por_mes": {}
        }

    # Función para calcular promedios ponderados por cabezas
    def calc_stats(rows):
        adp_vals, est_vals = [], []
        for r in rows:
            cab = to_num(r.get(col_cab, 1) if col_cab else 1) or 1
            adp = to_num(r.get(col_adp) if col_adp else None)
            est = to_num(r.get(col_estadia) if col_estadia else None)
            if adp > 0:
                adp_vals.extend([adp] * int(round(cab)))
            if est > 0:
                est_vals.extend([est] * int(round(cab)))
        total_cab = len(adp_vals) or len(est_vals) or len(rows)
        return {
            "cabezas":       len(rows),
            "adp_promedio":  round(sum(adp_vals)/len(adp_vals), 3) if adp_vals else None,
            "adp_min":       round(min(adp_vals), 3) if adp_vals else None,
            "adp_max":       round(max(adp_vals), 3) if adp_vals else None,
            "estadia_promedio": round(sum(est_vals)/len(est_vals), 1) if est_vals else None,
            "estadia_min":      int(min(est_vals)) if est_vals else None,
            "estadia_max":      int(max(est_vals)) if est_vals else None,
        }

    # General
    general = calc_stats(regs)
    log.info(f"  ADP prom: {general.get('adp_promedio')} kg/día | Estadía prom: {general.get('estadia_promedio')} días")

    # Por categoría
    por_cat = {}
    if col_cat:
        cat_regs = {}
        for r in regs:
            cat = str(r.get(col_cat) or "Sin datos").strip()
            cat_regs.setdefault(cat, []).append(r)
        for cat, rows in sorted(cat_regs.items()):
            por_cat[cat] = calc_stats(rows)

    # Por mes
    por_mes = {}
    if col_fecha:
        mes_regs = {}
        for r in regs:
            try:
                f = pd.to_datetime(r.get(col_fecha), errors="coerce")
                mes = f.strftime("%Y-%m") if f and not pd.isnull(f) else "Sin fecha"
            except: mes = "Sin fecha"
            mes_regs.setdefault(mes, []).append(r)
        for mes in sorted(mes_regs.keys()):
            if mes != "Sin fecha":
                por_mes[mes] = calc_stats(mes_regs[mes])

    return {
        "meta": {
            "generado":            datetime.now().isoformat(),
            "periodo":             periodo,
            "tabla":               "v_PB_Egresos",
            "ventana":             "365 días",
            "filtros":             "MotivoSalida=VENTA | RFID numérico | Estadía 30-365d | ADP 0-5",
            "registros_totales":   len(regs_egr),
            "registros_filtrados": len(regs),
            "excluidos":           excl,
            "col_adp":             col_adp,
            "col_estadia":         col_estadia,
            "col_rfid":            col_rfid,
        },
        "general":       general,
        "por_categoria": por_cat,
        "por_mes":       por_mes,
    }


def procesar_consumo(regs, cols, periodo):
    """
    Consumo de alimento desde v_PB_ConsumoDetallado.
    - Total anual por insumo (últimos 365 días): suma KILOS_TC_INSUMO agrupado por DESC_INSUMO
    - Promedio diario últimos 7 días: suma KILOS_TC_INSUMO de los últimos 7 días / 7
    """
    from datetime import date, timedelta
    import pandas as pd

    hoy       = date.today()
    hace_anio = hoy - timedelta(days=365)
    hace_7d   = hoy - timedelta(days=7)

    # Columnas exactas confirmadas por screenshot
    col_fecha   = "FECHA"      if "FECHA"      in (regs[0] if regs else {}) else next((c for c in cols if c.upper()=="FECHA"), None)
    col_kg      = "KILOS_TC_INSUMO" if "KILOS_TC_INSUMO" in (regs[0] if regs else {}) else next((c for c in cols if c.upper()=="KILOS_TC_INSUMO"), None)
    col_desc    = "DESC_INSUMO" if "DESC_INSUMO" in (regs[0] if regs else {}) else next((c for c in cols if c.upper()=="DESC_INSUMO"), None)
    col_cod     = "COD_INSUMO"  if "COD_INSUMO"  in (regs[0] if regs else {}) else next((c for c in cols if c.upper()=="COD_INSUMO"), None)

    log.info(f"  Consumo | fecha={col_fecha} kg={col_kg} desc={col_desc} cod={col_cod}")
    log.info(f"  Columnas v_PB_ConsumoDetallado: {cols}")

    if not regs or not col_fecha or not col_kg:
        log.warning("  ⚠ Sin datos de consumo o columnas no encontradas")
        return {
            "meta": {"generado": datetime.now().isoformat(), "periodo": periodo,
                     "tabla": "v_PB_ConsumoDetallado", "registros": 0},
            "anual": {"total_kg": 0, "por_insumo": []},
            "semanal": {"desde": str(hace_7d), "hasta": str(hoy), "total_kg_7d": 0,
                        "promedio_diario_kg": 0, "por_insumo": []},
        }

    # Parsear fechas y filtrar último año
    regs_anio = []
    regs_7d   = []
    for r in regs:
        try:
            f = pd.to_datetime(r.get(col_fecha), errors="coerce")
            if f is None or pd.isnull(f): continue
            fd = f.date()
            if fd < hace_anio: continue
            regs_anio.append(r)
            if fd >= hace_7d:
                regs_7d.append(r)
        except:
            continue

    log.info(f"  Registros último año: {len(regs_anio):,}  |  Últimos 7 días: {len(regs_7d):,}")

    # Tabla de materia seca por insumo (nombre exacto → % MS)
    MS_PCT = {
        "GLUTEN DE MAIZ":       41.0,
        "MAIZ GRANO":           87.0,
        "SILO DE MAIZ":         47.0,
        "HARINA GERMEN":        98.0,
        "NUCLEO CONC 5% LDB":   97.5,
    }
    def get_ms(desc):
        return MS_PCT.get(desc.strip().upper(), None)

    # ── Totales anuales por insumo ──
    anual_por_ins = {}   # desc -> {cod, kg}
    total_anual   = 0.0
    for r in regs_anio:
        desc = str(r.get(col_desc) or "Sin descripción").strip() if col_desc else "Sin descripción"
        cod  = str(r.get(col_cod)  or "").strip()               if col_cod  else ""
        kg   = to_num(r.get(col_kg, 0))
        total_anual += kg
        if desc not in anual_por_ins:
            anual_por_ins[desc] = {"cod": cod, "kg": 0.0}
        anual_por_ins[desc]["kg"] += kg

    # Redondear y ordenar por kg desc
    por_insumo_anual = sorted(
        [{"desc": d, "cod": v["cod"], "kg": round(v["kg"], 1),
          "ms_pct": get_ms(d),
          "kg_ms":  round(v["kg"] * get_ms(d) / 100, 1) if get_ms(d) is not None else None}
         for d, v in anual_por_ins.items()],
        key=lambda x: -x["kg"]
    )
    total_anual_ms = round(sum(r["kg_ms"] for r in por_insumo_anual if r["kg_ms"] is not None), 1)
    log.info(f"  Total anual: {total_anual:,.0f} kg  |  Insumos distintos: {len(por_insumo_anual)}")
    for ins in por_insumo_anual[:5]:
        log.info(f"    {ins['desc']:<30} {ins['kg']:>12,.1f} kg")

    # ── Promedio diario últimos 7 días registrados ──
    # Contar días únicos con registros (no asumir 7 días con datos)
    semanal_por_ins = {}
    dias_con_datos  = set()
    total_7d = 0.0
    for r in regs_7d:
        desc = str(r.get(col_desc) or "Sin descripción").strip() if col_desc else "Sin descripción"
        cod  = str(r.get(col_cod)  or "").strip()               if col_cod  else ""
        kg   = to_num(r.get(col_kg, 0))
        total_7d += kg
        if desc not in semanal_por_ins:
            semanal_por_ins[desc] = {"cod": cod, "kg": 0.0, "dias": set()}
        semanal_por_ins[desc]["kg"] += kg
        # Registrar día único
        try:
            fd = pd.to_datetime(r.get(col_fecha), errors="coerce")
            if fd and not pd.isnull(fd):
                dia_str = fd.strftime("%Y-%m-%d")
                dias_con_datos.add(dia_str)
                semanal_por_ins[desc]["dias"].add(dia_str)
        except: pass

    # Divisor = días únicos con registros (mínimo 1)
    n_dias = max(len(dias_con_datos), 1)
    log.info(f"  Días únicos con registros en ventana 7d: {n_dias} ({sorted(dias_con_datos)})")

    por_insumo_7d = sorted(
        [{"desc": d, "cod": v["cod"],
          "kg_7d": round(v["kg"], 1),
          "dias_registrados": len(v["dias"]),
          "promedio_diario":    round(v["kg"] / max(len(v["dias"]), 1), 1),
          "ms_pct":             get_ms(d),
          "promedio_diario_ms": round(v["kg"] / max(len(v["dias"]), 1) * get_ms(d) / 100, 1)
                                if get_ms(d) is not None else None}
         for d, v in semanal_por_ins.items()],
        key=lambda x: -x["kg_7d"]
    )
    prom_diario_total    = round(total_7d / n_dias, 1)
    prom_diario_total_ms = round(sum(
        r["promedio_diario_ms"] for r in por_insumo_7d if r["promedio_diario_ms"] is not None
    ), 1)
    log.info(f"  Total 7d: {total_7d:,.0f} kg  |  Días registrados: {n_dias}  |  Promedio diario: {prom_diario_total:,.1f} kg/día  |  MS: {prom_diario_total_ms:,.1f} kg MS/día")

    return {
        "meta": {
            "generado":    datetime.now().isoformat(),
            "periodo":     periodo,
            "tabla":       "v_PB_ConsumoDetallado",
            "col_kg":      col_kg,
            "desde_anual": str(hace_anio),
            "hasta":       str(hoy),
            "registros_anio": len(regs_anio),
            "registros_7d":   len(regs_7d),
        },
        "anual": {
            "total_kg":    round(total_anual, 1),
            "total_kg_ms": total_anual_ms,
            "por_insumo":  por_insumo_anual,
        },
        "semanal": {
            "desde":                 str(hace_7d),
            "hasta":                 str(hoy),
            "dias_registrados":      n_dias,
            "dias_detalle":          sorted(dias_con_datos),
            "total_kg_7d":           round(total_7d, 1),
            "promedio_diario_kg":    prom_diario_total,
            "promedio_diario_kg_ms": prom_diario_total_ms,
            "por_insumo":            por_insumo_7d,
        },
    }

def main():
    separador("PEGSA & BULLTRADE - Actualizador de Datos")
    log.info(f"  Inicio: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    separador()

    cfg     = cargar_config()
    periodo = cfg["OPCIONES"]["periodo"]
    carpeta = cfg["ONEDRIVE"]["carpeta"]
    log.info(f"  Periodo : {periodo}")
    log.info(f"  Destino : {carpeta}")
    log.info("")

    conn    = conectar(cfg)
    resumen = {"generado": datetime.now().isoformat(), "periodo": periodo, "modulos": {}}

    separador("Stock de Hacienda")
    tabla      = cfg["TABLAS"].get("stock_hacienda", "V_STOCK_HACIENDA")
    regs, cols = extraer(conn, tabla)

    if regs:
        kpis = calcular_kpis(regs, cols)
        meta = {
            "generado":  datetime.now().isoformat(),
            "periodo":   periodo,
            "tabla":     tabla,
            "registros": len(regs),
            "columnas":  cols,
        }

        # ── 1. JSON liviano: solo KPIs (carga inicial del portal) ──
        guardar({"meta": meta, "kpis": kpis}, carpeta, f"stock_kpis_{periodo}.json")
        log.info(f"  ✓ stock_kpis_{periodo}.json")

        # ── 2. JSON detalle completo (pestaña Detalle Completo) ──
        guardar({"meta": meta, "detalle": regs}, carpeta, f"stock_detalle_{periodo}.json")
        log.info(f"  ✓ stock_detalle_{periodo}.json")

        # ── 3. JSON por propietario (HOTELERO) ──
        col_prop = "HOTELERO"
        if col_prop in (regs[0] if regs else {}):
            propietarios = {}
            for r in regs:
                p = str(r.get(col_prop) or "Sin datos").strip()
                if p not in propietarios:
                    propietarios[p] = []
                propietarios[p].append(r)
            for prop, rows_prop in propietarios.items():
                nombre_archivo = re.sub(r'[^a-zA-Z0-9_]', '_', prop)
                kpis_prop = calcular_kpis(rows_prop, cols)
                guardar({"propietario": prop, "kpis": kpis_prop},
                        carpeta, f"stock_prop_{nombre_archivo}_{periodo}.json")
            log.info(f"  ✓ {len(propietarios)} archivos stock_prop_*_{periodo}.json")

        # ── 4. JSON por establecimiento (NOMBRE_CORRAL) ──
        col_est   = "NOMBRE_CORRAL"
        kpis_haras = {}   # se llena si existe "El Haras"
        if col_est in (regs[0] if regs else {}):
            establecimientos = {}
            for r in regs:
                e = str(r.get(col_est) or "Sin asignar").strip()
                if e not in establecimientos:
                    establecimientos[e] = []
                establecimientos[e].append(r)
            for est, rows_est in establecimientos.items():
                nombre_archivo = re.sub(r'[^a-zA-Z0-9_]', '_', est)
                kpis_est = calcular_kpis(rows_est, cols)
                guardar({"establecimiento": est, "kpis": kpis_est},
                        carpeta, f"stock_est_{nombre_archivo}_{periodo}.json")
                if est.strip().upper() == "EL HARAS":
                    kpis_haras = kpis_est
                    log.info(f"  ↳ El Haras → {kpis_haras.get('total_cabezas',0):,} cab · {kpis_haras.get('total_kg_estimado_hoy',0):,.0f} kg")
            log.info(f"  ✓ {len(establecimientos)} archivos stock_est_*_{periodo}.json")

        resumen["modulos"]["stock_hacienda"] = {
            "ok": True, "registros": len(regs), "cabezas": kpis.get("total_cabezas")
        }

        log.info("")
        log.info("  RESUMEN GENERAL:")
        log.info(f"  Cabezas totales       : {kpis.get('total_cabezas', 0):,}")
        log.info(f"  Kg totales estimado   : {kpis.get('total_kg_estimado_hoy', 0):,} kg")
        log.info(f"  Ton. estimado hoy     : {kpis.get('total_ton_estimado_hoy', 0):,} t")
        log.info(f"  Kg promedio estimado  : {kpis.get('kg_promedio_estimado', 0)} kg")
        log.info(f"  Dias prom. feedlot    : {kpis.get('dias_promedio_feedlot', 0)}")

        if kpis.get("por_propietario"):
            log.info("")
            log.info("  Por propietario (HOTELERO):")
            for g, d in sorted(kpis["por_propietario"].items(), key=lambda x: -x[1]["cabezas"]):
                log.info(f"    {g:<22} {int(d['cabezas']):>7,} cab  /  {d['ton_estimado']:>7,.1f} t  /  {d['kg_promedio']} kg prom.")

        if kpis.get("por_establecimiento"):
            log.info("")
            log.info("  Por establecimiento (NOMBRE_CORRAL):")
            for g, d in sorted(kpis["por_establecimiento"].items(), key=lambda x: -x[1]["cabezas"]):
                log.info(f"    {g:<22} {int(d['cabezas']):>7,} cab  /  {d['ton_estimado']:>7,.1f} t  /  {d['kg_promedio']} kg prom.")

        if kpis.get("por_clasificacion"):
            log.info("")
            log.info("  Por clasificacion:")
            for g, d in sorted(kpis["por_clasificacion"].items(), key=lambda x: -x[1]["cabezas"]):
                log.info(f"    {g:<12} {int(d['cabezas']):>7,} cab  /  {d['ton_estimado']:>7,.1f} t")

        if kpis.get("por_categoria_final"):
            log.info("")
            log.info("  Por categoria final:")
            for g, d in sorted(kpis["por_categoria_final"].items(), key=lambda x: -x[1]["cabezas"]):
                log.info(f"    {g:<25} {int(d['cabezas']):>7,} cab  /  {d['kg_promedio']} kg prom.")

    # ── 5. JSON Stock de Insumos ──
    separador("Stock de Insumos")
    tabla_ins = cfg["TABLAS"].get("stock_insumos", "v_PB_StockInsumos")
    regs_ins, cols_ins = extraer(conn, tabla_ins)

    INSUMOS_INCLUIDOS = {
        2: "MAIZ GRANO",
        9: "SOJA",
        8: "NUCLEO CONC 5% LDB",
        99: "DIESEL",
        6: "HARINA GERMEN",
        7: "GLUTEN DE MAIZ",
        3: "SILO DE MAIZ",
    }

    col_nombre = "DESC_INSUMO"
    col_stock  = "STOCK"
    col_cod    = "COD_INSUMO"

    insumos = []
    total_kg = 0
    for r in regs_ins:
        try:
            cod = int(float(r.get(col_cod) or -1))
        except:
            cod = -1
        if cod not in INSUMOS_INCLUIDOS:
            continue
        nombre_raw = str(r.get(col_nombre) or "").strip()
        raw_stock  = r.get(col_stock) if col_stock else 0
        stock_kg   = round(float(raw_stock or 0), 2)
        insumos.append({
            "nombre":   nombre_raw,
            "stock_kg": stock_kg,
        })
        total_kg += stock_kg

    insumos.sort(key=lambda x: -x["stock_kg"])

    # ── Cruzar con consumo diario para calcular días restantes ──
    # Nota: consumo_data aún no está disponible acá (se procesa en módulo 9)
    # Se calcula al final en módulo 10 y se enriquece el JSON
    meta_ins = {
        "generado": datetime.now().isoformat(),
        "periodo":  periodo,
        "tabla":    tabla_ins,
        "registros": len(insumos),
    }
    guardar({
        "meta": meta_ins,
        "insumos": insumos,
        "total_kg": round(total_kg, 2),
    }, carpeta, f"stock_insumos_{periodo}.json")
    log.info(f"  ✓ stock_insumos_{periodo}.json  ({len(insumos)} insumos)")
    for ins in insumos:
        log.info(f"    {ins['nombre']:<28} {ins['stock_kg']:>12,.1f} kg")
        resumen["modulos"]["stock_insumos"] = {"ok": True, "registros": len(insumos), "total_kg": round(total_kg,2)}
    else:
        log.warning("  ⚠ Sin datos de insumos")

    # ── 6. JSON Movimientos Productivos (Ingresos + Egresos) ──
    separador("Movimientos Productivos")
    tabla_ing = cfg["TABLAS"].get("movimientos_ingresos", "v_PB_Ingresos")
    tabla_egr = cfg["TABLAS"].get("movimientos_egresos",  "v_PB_Egresos")

    regs_ing, cols_ing = extraer(conn, tabla_ing)
    regs_egr, cols_egr = extraer(conn, tabla_egr)

    prod_data = procesar_movimientos(regs_ing, cols_ing, regs_egr, cols_egr, periodo)

    guardar(prod_data, carpeta, f"movimientos_{periodo}.json")
    log.info(f"  ✓ movimientos_{periodo}.json")
    m = prod_data.get("resumen", {})
    log.info(f"  Ingresos  :  {m.get('total_cabezas_ingresadas',0):>8,} cab  /  {m.get('total_kg_ingresado',0):>12,.0f} kg")
    log.info(f"  Egresos   :  {m.get('total_cabezas_egresadas',0):>8,} cab  /  {m.get('total_kg_egresado',0):>12,.0f} kg")
    log.info(f"  Saldo neto:  {m.get('saldo_cabezas',0):>+8,} cab  /  {m.get('saldo_kg',0):>+12,.0f} kg")
    resumen["modulos"]["movimientos"] = {"ok": True, **m}

    # ── 7. JSON Muertes + Tasa de Mortandad ──
    separador("Muertes & Tasa de Mortandad")
    tabla_muertes = cfg["TABLAS"].get("muertes", "V_MUERTES")
    regs_m, cols_m = extraer(conn, tabla_muertes)

    # Reusar regs_ing/cols_ing (ya cargados en módulo 6) y regs/cols de stock hacienda
    # regs_ing ya fue cargado arriba; regs (stock) también — los pasamos directamente
    muertes_data = procesar_muertes(
        regs_m,   cols_m,
        regs_ing, cols_ing,
        regs,     cols,      # V_STOCK_HACIENDA cargado en módulo 1
        periodo
    )
    guardar(muertes_data, carpeta, f"muertes_{periodo}.json")
    log.info(f"  ✓ muertes_{periodo}.json")
    mort = muertes_data.get("mortandad", {})
    resumen["modulos"]["muertes"] = {
        "ok":               True,
        "total_anio":       muertes_data["anio"].get("total_muertes", 0),
        "total_mes_ant":    muertes_data["mes_anterior"].get("total_muertes", 0),
        "tasa_mensual_pct": mort.get("tasa_mensual_pct"),
    }

    # ── 7b. JSON Muertes 30 días ──
    separador("Muertes & Tasa — Últimos 30 días")
    muertes_30d_data = procesar_muertes_30d(
        regs_m,   cols_m,
        regs_ing, cols_ing,
        regs,     cols,
        periodo
    )
    guardar(muertes_30d_data, carpeta, f"muertes_30d_{periodo}.json")
    log.info(f"  ✓ muertes_30d_{periodo}.json")
    m30 = muertes_30d_data.get("mortandad", {})
    log.info(f"    Muertes 30d: {m30.get('muertes_30d',0)} | Tasa: {m30.get('tasa_mensual_pct')}%")
    resumen["modulos"]["muertes_30d"] = {
        "ok":               True,
        "total_30d":        muertes_30d_data["detalle"].get("total_muertes", 0),
        "tasa_mensual_pct": m30.get("tasa_mensual_pct"),
    }

    # ── 8. JSON Parámetros Productivos (ADP + Estadía) ──
    separador("Parámetros Productivos")
    prod_data = procesar_productivo(regs_egr, cols_egr, periodo)
    guardar(prod_data, carpeta, f"productivo_{periodo}.json")
    log.info(f"  ✓ productivo_{periodo}.json")
    g = prod_data.get("general", {})
    log.info(f"  ADP promedio  : {g.get('adp_promedio')} kg/día")
    log.info(f"  Estadía prom  : {g.get('estadia_promedio')} días")
    log.info(f"  Cabezas       : {g.get('cabezas',0):,}")
    resumen["modulos"]["productivo"] = {
        "ok":               True,
        "adp_promedio":     g.get("adp_promedio"),
        "estadia_promedio": g.get("estadia_promedio"),
        "cabezas":          g.get("cabezas", 0),
    }

    # ── 9. JSON Consumo de Alimento (anual + promedio diario 7d) ──
    separador("Consumo de Alimento")
    tabla_consumo = cfg["TABLAS"].get("consumo_detallado", "v_PB_ConsumoDetallado")
    regs_cons, cols_cons = extraer(conn, tabla_consumo)
    consumo_data = procesar_consumo(regs_cons, cols_cons, periodo)
    guardar(consumo_data, carpeta, f"consumo_{periodo}.json")
    log.info(f"  ✓ consumo_{periodo}.json")
    ca = consumo_data.get("anual",   {})
    cs = consumo_data.get("semanal", {})
    log.info(f"  Total anual     : {ca.get('total_kg',0):,.0f} kg")
    log.info(f"  Prom. diario 7d : {cs.get('promedio_diario_kg',0):,.1f} kg/día")
    resumen["modulos"]["consumo"] = {
        "ok":                True,
        "total_anual_kg":    ca.get("total_kg", 0),
        "promedio_diario_kg": cs.get("promedio_diario_kg", 0),
    }

    # ── 10. Indicadores cruzados (consumo × stock El Haras × ADP) ──
    separador("Indicadores Productivos")
    try:
        # Denominadores: siempre El Haras (donde se da el alimento)
        kg_stock_haras = kpis_haras.get("total_kg_estimado_hoy", 0) if kpis_haras else kpis.get("total_kg_estimado_hoy", 0)
        cab_haras      = kpis_haras.get("total_cabezas", 0)         if kpis_haras else kpis.get("total_cabezas", 0)
        usando_haras   = bool(kpis_haras)

        prom_diario_ms = cs.get("promedio_diario_kg_ms", 0)
        prom_diario_tc = cs.get("promedio_diario_kg", 0)
        adp_prom       = g.get("adp_promedio", 0) or 0

        log.info(f"  Denominador: {'El Haras' if usando_haras else 'PEGSA total (Haras no encontrado)'}")
        log.info(f"  Cabezas     : {cab_haras:,}")
        log.info(f"  Kg PV       : {kg_stock_haras:,.0f}")

        # ── 1. % Consumo de Peso Vivo ──
        pct_pv = round(prom_diario_ms / kg_stock_haras * 100, 2) if kg_stock_haras > 0 else None

        # ── 2. Consumo por cabeza (TC y MS) ──
        consumo_cab_tc = round(prom_diario_tc / cab_haras, 2) if cab_haras > 0 else None
        consumo_cab_ms = round(prom_diario_ms / cab_haras, 2) if cab_haras > 0 else None

        # ── 3. Conversión alimenticia ──
        prod_diaria_kg = adp_prom * cab_haras if adp_prom and cab_haras else 0
        conversion     = round(prom_diario_ms / prod_diaria_kg, 2) if prod_diaria_kg > 0 else None

        indicadores = {
            "generado":      datetime.now().isoformat(),
            "denominador":   "El Haras" if usando_haras else "PEGSA total",
            "fuentes": {
                "kg_stock_haras":  kg_stock_haras,
                "kg_stock_total":  kpis.get("total_kg_estimado_hoy", 0),
                "cab_haras":       cab_haras,
                "cab_total":       kpis.get("total_cabezas", 0),
                "prom_diario_ms":  prom_diario_ms,
                "prom_diario_tc":  prom_diario_tc,
                "adp_promedio":    adp_prom,
                "prod_diaria_kg":  round(prod_diaria_kg, 1),
                "dias_consumo":    cs.get("dias_registrados", 0),
            },
            "indicadores": {
                "pct_peso_vivo": {
                    "valor":       pct_pv,
                    "unidad":      "% PV",
                    "descripcion": "Consumo MS como % del peso vivo — El Haras",
                    "ref_min":     2.0,
                    "ref_opt":     2.5,
                    "ref_max":     3.0,
                    "formula":     "kg MS/día ÷ kg PV El Haras × 100",
                },
                "consumo_por_cabeza": {
                    "valor_tc":    consumo_cab_tc,
                    "valor_ms":    consumo_cab_ms,
                    "unidad":      "kg/cab/día",
                    "descripcion": "Alimento por animal por día — El Haras",
                    "ref_min":     8.0,
                    "ref_opt_min": 12.5,
                    "ref_opt_max": 15.5,
                    "ref_max":     19.0,
                    "formula":     "kg TC/día ÷ cabezas El Haras",
                },
                "conversion_alimenticia": {
                    "valor":       conversion,
                    "unidad":      "kg MS : kg carne",
                    "descripcion": "Kg MS por cab por día dividido ADP — El Haras",
                    "ref_min":     5.0,
                    "ref_max":     8.0,
                    "formula":     "(kg MS/día ÷ cabezas El Haras) ÷ ADP",
                },
            },
        }
        guardar(indicadores, carpeta, f"indicadores_{periodo}.json")
        log.info(f"  ✓ indicadores_{periodo}.json")
        log.info(f"  % Peso Vivo        : {pct_pv}%   (ref: 2.0–3.0%)")
        log.info(f"  Consumo/cab (TC)   : {consumo_cab_tc} kg/cab/día")
        log.info(f"  Consumo/cab (MS)   : {consumo_cab_ms} kg MS/cab/día")
        log.info(f"  Conversión alim.   : {conversion}:1   (ref: 5–8)")
        log.info(f"  Producción diaria  : {prod_diaria_kg:,.0f} kg (ADP {adp_prom} × {cab_haras:,} cab Haras)")
        resumen["modulos"]["indicadores"] = {
            "ok":             True,
            "denominador":    "El Haras" if usando_haras else "PEGSA total",
            "pct_peso_vivo":  pct_pv,
            "consumo_cab_tc": consumo_cab_tc,
            "consumo_cab_ms": consumo_cab_ms,
            "conversion":     conversion,
        }
    except Exception as e:
        log.warning(f"  ⚠ No se pudieron calcular indicadores cruzados: {e}")
        resumen["modulos"]["indicadores"] = {"ok": False, "error": str(e)}

    # ── 11. Enriquecer stock_insumos con días de consumo restantes ──
    separador("Días de Stock Restantes")
    try:
        # Mapa nombre → promedio_diario TC desde consumo semanal
        consumo_por_nombre = {}
        for ins_c in cs.get("por_insumo", []):
            nombre = ins_c.get("desc", "").strip().upper()
            consumo_por_nombre[nombre] = ins_c.get("promedio_diario", 0)

        # Enriquecer cada insumo del stock
        insumos_enriquecidos = []
        for ins in insumos:
            nombre_up = ins["nombre"].strip().upper()
            prom_tc   = consumo_por_nombre.get(nombre_up, None)
            if prom_tc and prom_tc > 0:
                dias = round(ins["stock_kg"] / prom_tc, 1)
            else:
                dias = None
            ins_enr = dict(ins)
            ins_enr["consumo_diario_tc"] = prom_tc
            ins_enr["dias_restantes"]    = dias
            insumos_enriquecidos.append(ins_enr)
            if dias is not None:
                log.info(f"  {ins['nombre']:<28} stock {ins['stock_kg']:>12,.0f} kg ÷ {prom_tc:>8,.1f} kg/día = {dias:>6.1f} días")
            else:
                log.info(f"  {ins['nombre']:<28} stock {ins['stock_kg']:>12,.0f} kg  (sin consumo registrado)")

        # Reescribir stock_insumos con dias_restantes incluido
        guardar({
            "meta":     meta_ins,
            "insumos":  insumos_enriquecidos,
            "total_kg": round(total_kg, 2),
        }, carpeta, f"stock_insumos_{periodo}.json")
        log.info(f"  ✓ stock_insumos_{periodo}.json actualizado con días restantes")
    except Exception as e:
        log.warning(f"  ⚠ No se pudieron calcular días restantes: {e}")

    conn.close()

    # ── 12. JSON Tesorería (Excel YYYY-MM-DD_financiero.xlsx en OneDrive) ──
    separador("Tesorería Financiera")
    try:
        import glob, os as _os

        # Buscar todos los YYYY-MM-DD_financiero.xlsx en subcarpeta financiero/
        subcarpeta_fin = _os.path.join(carpeta, "financiero")
        if not _os.path.exists(subcarpeta_fin):
            _os.makedirs(subcarpeta_fin)
            log.info(f"  ✓ Carpeta creada: {subcarpeta_fin}")
        patron  = _os.path.join(subcarpeta_fin, "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_financiero.xlsx")
        archivos = sorted(glob.glob(patron))
        log.info(f"  Archivos financiero encontrados: {len(archivos)}")

        def safe_float(v):
            if v is None: return None
            try:
                f = float(v)
                return f if pd.notna(f) else None
            except: return None

        def proc_financiero(ruta):
            """Procesa un Excel financiero con hoja 'resumen' y retorna dict con todos los datos."""
            nombre    = _os.path.basename(ruta)
            fecha_str = nombre[:10]

            sheets = pd.read_excel(ruta, sheet_name=None, header=None)

            # ── Hoja: resumen ──
            res = sheets.get('resumen')
            if res is None:
                log.warning(f"  ⚠ {nombre}: sin hoja 'resumen'")
                return None

            # Semanas: 17 columnas desde col 3
            N_COLS = 17
            from datetime import date as _date, timedelta
            try:
                base_date = _date.fromisoformat(fecha_str)
            except:
                base_date = _date.today()
            sem_labels = [(base_date + timedelta(weeks=i)).strftime('%d/%m') for i in range(N_COLS)]

            def gres(row, col):
                return safe_float(res.iloc[row, col]) or 0.0

            # Filas clave en hoja 'resumen' (confirmadas con Excel 2026-03-20)
            FILAS_RES = {
                'cheques_cobro':      30,
                'saldo_acum_bancos':  33,
                'venta_hacienda':     46,  # Total ingresos (incluye hacienda)
                'hoteleria':          43,  # Hotelería y alimentación Feed
                'total_ingresos':     46,
                'pagos_feedlot':      53,
                'pagos_admin':        54,
                'pago_impuestos':     55,
                'pago_flete':         56,
                'pago_agricultura':   57,
                'total_egresos':      65,
                'darwash':            67,
                'saldo_semanal':      69,
                'saldo_acumulado':    70,
            }
            series_flujo = {k: [gres(row, c) for c in range(3, 3+N_COLS)]
                            for k, row in FILAS_RES.items()}

            # ── Hoja: posicion hoy ──
            ph = sheets.get('posicion hoy', pd.DataFrame())
            def gph(r, c): return safe_float(ph.iloc[r, c]) if len(ph) > r else None

            bancos_peg  = [{'nombre': n, 'saldo': gph(i,4) or 0}
                           for i,n in [(2,'PECUARIA BNA'),(3,'PECUARIA BANCOR'),
                                       (4,'PECUARIA LA PAMPA'),(5,'PECUARIA GALICIA'),
                                       (6,'PECUARIA SANTANDER')] if gph(i,4)]
            bancos_bull = [{'nombre': n, 'saldo': gph(i,4) or 0}
                           for i,n in [(7,'BULLTRADE BNA'),(8,'BULLTRADE BANCOR'),
                                       (9,'BULLTRADE LA PAMPA'),(10,'BULLTRADE GALICIA'),
                                       (11,'BULLTRADE SANTANDER')] if gph(i,4)]
            efectivo     = gph(13,4) or 0
            becerra      = gph(16,4) or 0
            fima_bull    = gph(17,4) or 0
            fima_peg     = gph(18,4) or 0
            fci          = becerra + fima_bull + fima_peg
            echeq        = gph(21,4) or 0
            saldo_disp   = gph(22,4) or 0
            usd_ars      = gph(25,3) or 0
            usd_cant     = gph(25,1) or 0

            # ── Hoja: cheques pendiente ──
            cheq_raw = sheets.get('cheques pendiente', pd.DataFrame())
            from datetime import date as _date2
            hoy_c = _date2.fromisoformat(fecha_str)
            cheq_por_bucket = []
            total_cartera   = 0.0
            if len(cheq_raw) > 4:
                cheq_df = cheq_raw.iloc[4:].copy()
                cheq_df['fecha']   = pd.to_datetime(cheq_df[1], errors='coerce')
                cheq_df['importe'] = pd.to_numeric(cheq_df[5], errors='coerce').fillna(0)
                cheq_df = cheq_df[cheq_df['fecha'].notna() & (cheq_df['importe'] > 0)]
                def buck(f):
                    d = (f.date() - hoy_c).days
                    if d <= 7:   return '0-7 días'
                    if d <= 14:  return '8-14 días'
                    if d <= 30:  return '15-30 días'
                    if d <= 60:  return '31-60 días'
                    return '+60 días'
                cheq_df['bucket'] = cheq_df['fecha'].apply(buck)
                pb = cheq_df.groupby('bucket')['importe'].agg(['sum','count']).reindex(
                    ['0-7 días','8-14 días','15-30 días','31-60 días','+60 días'], fill_value=0).reset_index()
                pb.columns = ['bucket','monto','cantidad']
                cheq_por_bucket = pb.to_dict('records')
                total_cartera   = float(cheq_df['importe'].sum())

            # ── Hoja: vencimientos de hacienda ──
            hac      = sheets.get('vencimientos de hacienda', pd.DataFrame())
            hac_comp, hac_vent = [], []
            if len(hac) > 2:
                # Proveedores compras: fila 1, cols 1..N
                provs_comp = []
                for c in range(1, hac.shape[1]):
                    v = str(hac.iloc[1, c]).strip()
                    if v not in ['nan','NaT','']: provs_comp.append((c, v))
                # Proveedores ventas: fila 21, cols 1..N
                provs_vent = []
                for c in range(1, hac.shape[1]):
                    v = str(hac.iloc[21, c]).strip() if len(hac) > 21 else ''
                    if v not in ['nan','NaT','']: provs_vent.append((c, v))

                for i in range(2, min(19, len(hac))):
                    r = hac.iloc[i]; f = pd.to_datetime(r[0], errors='coerce')
                    if pd.isna(f): continue
                    detalle = []
                    for col, nombre in provs_comp:
                        v = safe_float(r[col]) or 0
                        if v: detalle.append({'empresa': nombre, 'monto': round(v, 2)})
                    total = sum(d['monto'] for d in detalle)
                    if total: hac_comp.append({'fecha': str(f.date()), 'monto': round(total, 2), 'detalle': detalle})

                for i in range(22, min(39, len(hac))):
                    r = hac.iloc[i]; f = pd.to_datetime(r[0], errors='coerce')
                    if pd.isna(f): continue
                    detalle = []
                    for col, nombre in provs_vent:
                        v = safe_float(r[col]) or 0
                        if v: detalle.append({'empresa': nombre, 'monto': round(v, 2)})
                    total = sum(d['monto'] for d in detalle)
                    if total: hac_vent.append({'fecha': str(f.date()), 'monto': round(total, 2), 'detalle': detalle})

            # ── Hoja: gastos varios ──
            gv_sheet = sheets.get('gastos varios', pd.DataFrame())
            gastos, cat = [], ''
            for i in range(1, len(gv_sheet)):
                r = gv_sheet.iloc[i]; concepto = str(r[0]).strip()
                if not concepto or concepto == 'nan': continue
                if concepto.endswith(':'): cat = concepto.rstrip(':'); continue
                mt = safe_float(r[2]) or 0
                mb = safe_float(r[1]) or 0
                freq = str(r[3]).strip() if len(r) > 3 and pd.notna(r[3]) else ''
                if mt or mb:
                    gastos.append({'categoria': cat, 'concepto': concepto,
                                   'monto_bruto': mb, 'monto_total': mt, 'frecuencia': freq})

            # ── Hoja: cuenta corriente con darwash ──
            # La col 2 tiene el tipo ('ingreso'/'egreso') explícito — usarla directamente
            cc_sheet = sheets.get('cuenta  corriente con darwash', pd.DataFrame())
            darwash_secs, s_nom, s_items = [], '', []
            for i in range(len(cc_sheet)):
                r = cc_sheet.iloc[i]; nom = str(r[0]).strip()
                if nom.endswith(':') and nom not in ['nan','']:
                    if s_items: darwash_secs.append({'nombre': s_nom, 'items': s_items})
                    s_nom = nom.rstrip(':'); s_items = []; continue
                f = pd.to_datetime(r[0], errors='coerce')
                m = safe_float(r[1])
                tipo_col = str(r[2]).strip().lower() if len(r) > 2 and pd.notna(r[2]) else ''
                if pd.notna(f) and m is not None and m != 0:
                    # Usar tipo del Excel si está disponible, sino inferir por signo
                    if tipo_col in ('ingreso', 'egreso'):
                        tipo = tipo_col
                        monto_real = abs(m) if tipo == 'ingreso' else -abs(m)
                    else:
                        # fallback: negativo en Excel = ingreso para PEGSA
                        monto_real = -m
                        tipo = 'ingreso' if monto_real > 0 else 'egreso'
                    s_items.append({'fecha': str(f.date()), 'monto': monto_real, 'tipo': tipo})
            if s_items: darwash_secs.append({'nombre': s_nom, 'items': s_items})

            return {
                'archivo':    nombre,
                'fecha_corte': fecha_str,
                'posicion': {
                    'bancos_peg':            bancos_peg,
                    'bancos_bull':           bancos_bull,
                    'efectivo':              efectivo,
                    'becerra':               becerra,
                    'fima_bull':             fima_bull,
                    'fima_peg':              fima_peg,
                    'fci':                   fci,
                    'echeq':                 echeq,
                    'saldo_disponibilidades': saldo_disp,
                    'usd_ars':               usd_ars,
                    'usd_cant':              usd_cant,
                },
                'cheques': {
                    'total_cartera':    total_cartera,
                    'por_vencimiento':  cheq_por_bucket,
                },
                'hacienda':  {'compras': hac_comp, 'ventas': hac_vent},
                'gastos':    gastos,
                'darwash':   darwash_secs,
                'flujo': {
                    'semanas': sem_labels,
                    'saldo_inicial': saldo_disp,
                    'series':  {k: [round(v, 2) for v in vals]
                                for k, vals in series_flujo.items()},
                },
            }

        # Procesar todos los archivos
        cortes_proc = []
        ultimo_corte = None
        for ruta in archivos:
            nombre = _os.path.basename(ruta)
            fecha_str = nombre[:10]
            try: datetime.strptime(fecha_str, "%Y-%m-%d")
            except:
                log.warning(f"  ⚠ Ignorando: {nombre}"); continue
            log.info(f"  Procesando: {nombre}")
            resultado = proc_financiero(ruta)
            if resultado:
                cortes_proc.append(resultado)
                ultimo_corte = resultado
                sd = resultado['posicion']['saldo_disponibilidades']
                log.info(f"  ✓ {nombre} · saldo: ${sd:,.0f}")

        if cortes_proc:
            # JSON con todos los cortes (para histórico)
            guardar({'generado': datetime.now().isoformat(), 'cortes': cortes_proc},
                    carpeta, "financiero_historico.json")
            log.info(f"  ✓ financiero_historico.json — {len(cortes_proc)} cortes")

            # JSON del último corte (para módulo 6 del portal)
            guardar(ultimo_corte, carpeta, "tesoreria_ultimo.json")
            log.info(f"  ✓ tesoreria_ultimo.json — corte {ultimo_corte['fecha_corte']}")

            resumen["modulos"]["tesoreria"] = {
                "ok":          True,
                "cortes":      len(cortes_proc),
                "ultimo_corte": ultimo_corte['fecha_corte'],
                "saldo_disp":  ultimo_corte['posicion']['saldo_disponibilidades'],
            }
        else:
            log.info("  ℹ Sin archivos YYYY-MM-DD_financiero.xlsx en la carpeta")
            resumen["modulos"]["tesoreria"] = {"ok": True, "cortes": 0}

    except Exception as e:
        log.warning(f"  ⚠ Módulo tesorería falló: {e}")
        import traceback; log.warning(traceback.format_exc())
        resumen["modulos"]["tesoreria"] = {"ok": False, "error": str(e)}

    separador()
    guardar(resumen, carpeta, "ultima_actualizacion.json")
    separador("FINALIZADO")
    log.info(f"  Archivos guardados en: {carpeta}")
    log.info("  OneDrive sincronizara automaticamente")
    separador()
    print()
    input("  Presiona Enter para cerrar...")

if __name__ == "__main__":
    main()
