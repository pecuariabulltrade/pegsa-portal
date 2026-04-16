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
from datetime import datetime
from pathlib import Path

# ── Verificar dependencias antes de importar ──────────────
_missing = []
try:
    import pandas as pd
except ImportError:
    _missing.append("pandas")
try:
    import pyodbc as _pyodbc_check
except ImportError:
    _missing.append("pyodbc")

if _missing:
    # Escribir error en log aunque el logger no este listo aun
    _log_dir = Path(__file__).parent / "logs"
    _log_dir.mkdir(exist_ok=True)
    _err_file = _log_dir / f"log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    _msg = (f"ERROR CRITICO: faltan dependencias: {', '.join(_missing)}\n"
            f"Python: {sys.executable} (v{sys.version})\n"
            f"Solución: correr  1_INSTALAR.bat  o ejecutar:\n"
            f"  {sys.executable} -m pip install pandas pyodbc\n")
    _err_file.write_text(_msg, encoding="utf-8")
    print(_msg)
    sys.exit(1)

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
# Fuente: "Aumento Proyectado dieta a fecha (analisis anual).xlsx" — muestra anual real
#   Filtros por categoría: días en feedlot + rango peso de entrada (igual que Excel)
#   Hembra  0-250  → ternero hembra: ADP obs=1.32  (días 100-450, pesoE 0-200,   N=19)
#   Hembra 250+    → vaquillona:      ADP obs=1.35  (días 30-350,  pesoE 200-400, N=685)
#   Macho   0-250  → ternero macho:   ADP obs=1.37  (días 100-450, pesoE 0-200,   N=87)
#   Macho  250-350 → novillito:       ADP obs=1.49  (días 30-350,  pesoE 200-400, N=691)
#   Macho  350-550 → novillo pesado:  ADP obs=1.23  (días 30-350,  pesoE 350-750, N=188)
#   Vaca    0-650  → vacas engorde:   ADP obs=1.40  (días 30-350,  pesoE 0-750,   N=1727)
ENGORDE_DIARIO = [
    ("Hembra", 0,    250,  1.32),
    ("Hembra", 250,  1000, 1.35),
    ("Macho",  0,    250,  1.37),
    ("Macho",  250,  350,  1.49),
    ("Macho",  350,  550,  1.23),
    ("Macho",  550,  1000, 1.10),
    ("Toro",   0,    1000, 1.60),
    ("Vaca",   0,    650,  1.40),
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

def esperar_si_interactivo(mensaje="\nPresiona Enter para cerrar..."):
    try:
        if sys.stdin and sys.stdin.isatty():
            input(mensaje)
    except Exception:
        pass

def resolver_carpeta_salida(ruta_cfg):
    script_dir = Path(__file__).resolve().parent
    ruta = str(ruta_cfg or "").strip()
    if (not ruta or ruta.lower() in {"auto", ".", ".\\", "./"} or
        "C:\\Users\\USER\\" in ruta or "C:/Users/USER/" in ruta):
        return str(script_dir)
    p = Path(ruta).expanduser()
    if not p.is_absolute():
        p = (script_dir / p).resolve()
    return str(p)

# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════
def cargar_config():
    path = Path(__file__).parent / "config.ini"
    if not path.exists():
        log.error(f"No encontre config.ini en: {path}")
        esperar_si_interactivo("\nPresiona Enter para cerrar...")
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
        esperar_si_interactivo("\nPresiona Enter para cerrar...")
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

    # Intentar con cifrado primero, luego sin cifrado si falla SSL
    connection_strings = [cs, cs + "Encrypt=no;"]

    log.info(f"Conectando a  {srv}  /  {db}  ...")
    last_error = None
    for cs_try in connection_strings:
        try:
            conn = pyodbc.connect(cs_try, timeout=20)
            log.info("Conexion SQL OK")
            return conn
        except Exception as e:
            last_error = e
            if "Encrypt" not in cs_try:
                log.warning(f"Conexion cifrada fallo, reintentando sin cifrado...")
                continue
    log.error(f"No se pudo conectar: {last_error}")
    log.error("  Verifica: 1. VPN conectada  2. WinCampo corriendo  3. Usuario/contrasena")
    esperar_si_interactivo("\nPresiona Enter para cerrar...")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════
#  EXTRACCION Y ENRIQUECIMIENTO
# ═══════════════════════════════════════════════════════════
def extraer(conn, tabla, fecha_col=None, dias=730):
    """
    Lee una tabla SQL.
    Si se indica fecha_col, filtra en SQL a los últimos `dias` días
    para evitar traer millones de registros innecesarios.
    """
    try:
        import pandas as pd
    except ImportError:
        log.error("Falta pandas. Ejecuta: pip install pandas")
        sys.exit(1)

    log.info(f"  Leyendo {tabla} ...")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            if fecha_col:
                sql = (f"SELECT * FROM {tabla} WITH (NOLOCK) "
                       f"WHERE {fecha_col} >= DATEADD(day, -{dias}, GETDATE())")
                log.info(f"    (filtro SQL: {fecha_col} últimos {dias} días)")
            else:
                sql = f"SELECT * FROM {tabla} WITH (NOLOCK)"
            df = pd.read_sql(sql, conn)

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

    por_prop      = {}
    por_cat       = {}
    por_mes       = {}
    por_mes_det   = {}   # {mes: {cabezas, kg, por_categoria:{}, por_propietario:{}}}
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

        # Detalle por mes: desglose por categoría y propietario dentro de cada mes
        if mes not in por_mes_det:
            por_mes_det[mes] = {"cabezas": 0, "kg": 0, "por_categoria": {}, "por_propietario": {}}
        por_mes_det[mes]["cabezas"] += cab
        por_mes_det[mes]["kg"]      += kg
        for grp, slot in [(cat, "por_categoria"), (prop, "por_propietario")]:
            if grp not in por_mes_det[mes][slot]:
                por_mes_det[mes][slot][grp] = {"cabezas": 0, "kg": 0}
            por_mes_det[mes][slot][grp]["cabezas"] += cab
            por_mes_det[mes][slot][grp]["kg"]      += kg

    # Redondear y calcular kg_promedio
    for d in [por_prop, por_cat, por_mes]:
        for k in d:
            d[k]["cabezas"]    = round(d[k]["cabezas"])
            d[k]["kg"]         = round(d[k]["kg"], 1)
            d[k]["kg_promedio"] = round(d[k]["kg"] / d[k]["cabezas"], 1) if d[k]["cabezas"] > 0 else 0

    for mes_k, mv in por_mes_det.items():
        mv["cabezas"] = round(mv["cabezas"])
        mv["kg"]      = round(mv["kg"], 1)
        mv["kg_promedio"] = round(mv["kg"] / mv["cabezas"], 1) if mv["cabezas"] > 0 else 0
        for slot in ("por_categoria", "por_propietario"):
            for grp in mv[slot]:
                g = mv[slot][grp]
                g["cabezas"]    = round(g["cabezas"])
                g["kg"]         = round(g["kg"], 1)
                g["kg_promedio"] = round(g["kg"] / g["cabezas"], 1) if g["cabezas"] > 0 else 0

    return {
        "total_cabezas":    round(total_cab),
        "total_kg":         round(total_kg, 1),
        "kg_promedio":      round(total_kg / total_cab, 1) if total_cab > 0 else 0,
        "por_propietario":  por_prop,
        "por_categoria":    por_cat,
        "por_mes":          por_mes,
        "por_mes_detalle":  dict(sorted(por_mes_det.items())),  # ordenado cronológico
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
    """Guarda JSON de forma atómica (escribe en temp y renombra) para
    evitar que interrupciones del proceso produzcan archivos truncados."""
    import tempfile, os
    dest = Path(carpeta)
    dest.mkdir(parents=True, exist_ok=True)
    ruta = dest / nombre
    # Escribir en archivo temporal dentro del mismo directorio (mismo filesystem)
    fd, tmp_path = tempfile.mkstemp(dir=dest, suffix='.tmp', prefix=nombre+'_')
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(limpiar_nan(datos), f, ensure_ascii=False, indent=2, default=str)
        # Rename atómico: reemplaza el destino de forma segura
        os.replace(tmp_path, ruta)
    except Exception:
        # Si algo falla, eliminar el temp para no dejar basura
        try: os.unlink(tmp_path)
        except Exception: pass
        raise
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
    hace_90d   = hoy - timedelta(days=90)

    # ADP teórico por categoría — con filtros por estadía Y peso de entrada (igual que Excel)
    # Fuente: "Aumento Proyectado dieta a fecha (analisis anual).xlsx" — hoja resumen
    #   feedlot entero (días 30-400, pesoE 50-500): ADP=1.376
    _ADP_TEO = {
        'TERNERO':    1.371,  # ternero macho:   días 100-450, pesoE 0-200,   N=87
        'TERNERA':    1.324,  # ternero hembra:  días 100-450, pesoE 0-200,   N=19
        'NOVILLITO':  1.489,  # novillito:       días 30-350,  pesoE 200-400, N=691
        'NOVILLO':    1.231,  # novillos pesado: días 30-350,  pesoE 350-750, N=188
        'VAQUILLONA': 1.346,  # vaquillona:      días 30-350,  pesoE 200-400, N=685
        'VACA':       1.399,  # vacas engorde:   días 30-350,  pesoE 0-750,   N=1727
        'TORO':       1.60,   # toro (sin datos propios, referencia anterior)
    }

    # Filtros per-categoría: estadía (días) y peso de entrada (kg)
    # Replica exactamente los rangos de la hoja "resumen" del Excel
    _CAT_FILTROS = {
        'TERNERO':    {'est_min': 100, 'est_max': 450, 'pe_min':   0, 'pe_max': 200},
        'TERNERA':    {'est_min': 100, 'est_max': 450, 'pe_min':   0, 'pe_max': 200},
        'NOVILLITO':  {'est_min':  30, 'est_max': 350, 'pe_min': 200, 'pe_max': 400},
        'NOVILLO':    {'est_min':  30, 'est_max': 350, 'pe_min': 350, 'pe_max': 750},
        'VAQUILLONA': {'est_min':  30, 'est_max': 350, 'pe_min': 200, 'pe_max': 400},
        'VACA':       {'est_min':  30, 'est_max': 350, 'pe_min':   0, 'pe_max': 750},
        'TORO':       {'est_min':  30, 'est_max': 400, 'pe_min':   0, 'pe_max': 1000},
    }

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
    col_pesoe   = fc(["KgIngreso","kgingreso","PesoEntrada","pesoentrada","peso_entrada","kg_entrada","KgEntrada"])

    log.info(f"  Productivo | fecha={col_fecha} motivo={col_motivo} adp={col_adp} estadia={col_estadia} cat={col_cat} cab={col_cab} rfid={col_rfid} pesoe={col_pesoe}")
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

        # 4) Estadia: rango amplio 0-450 días (el filtro fino se aplica por categoría)
        est = to_num(r.get(col_estadia)) if col_estadia else None
        if est is None or not (0 < est <= 450): excl["estadia"] += 1; continue

        # 5) AdpSinDebaste entre 0 y 5
        adp = to_num(r.get(col_adp)) if col_adp else None
        if adp is None or not (0 < adp <= 5): excl["adp"] += 1; continue

        # Marcar si cae en los últimos 90 días
        r = dict(r)
        # Guardar peso de entrada para filtros per-categoría
        if col_pesoe:
            r['_pesoe'] = to_num(r.get(col_pesoe))
        try:
            r['_en_90d'] = (f.date() >= hace_90d)
        except:
            r['_en_90d'] = False
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
                     "filtros": "MotivoSalida=VENTA | RFID numérico | Estadía 0-450d | ADP 0-5 | filtros per-cat (est+pesoE)",
                     "registros_filtrados": 0},
            "general": {}, "por_categoria": {}, "por_mes": {}
        }

    # Función para calcular promedios ponderados por cabezas
    # cat: si se provee, aplica los filtros de estadía y peso de entrada de _CAT_FILTROS
    def calc_stats(rows, cat=None):
        filt = _CAT_FILTROS.get(cat.upper() if cat else '', {}) if cat else {}
        est_min = filt.get('est_min', 0)
        est_max = filt.get('est_max', 9999)
        pe_min  = filt.get('pe_min',  0)
        pe_max  = filt.get('pe_max',  9999)
        adp_vals, est_vals = [], []
        cab_ok = 0
        for r in rows:
            cab  = to_num(r.get(col_cab, 1) if col_cab else 1) or 1
            est  = to_num(r.get(col_estadia) if col_estadia else None)
            adp  = to_num(r.get(col_adp) if col_adp else None)
            peso = r.get('_pesoe') if cat else None
            # Filtro per-categoría: estadía
            if cat and est is not None:
                if not (est_min <= est <= est_max):
                    continue
            # Filtro per-categoría: peso de entrada (solo si columna disponible)
            if cat and col_pesoe and peso is not None:
                if not (pe_min <= peso <= pe_max):
                    continue
            cab_ok += int(round(cab))
            if adp is not None and adp > 0:
                adp_vals.extend([adp] * int(round(cab)))
            if est is not None and est > 0:
                est_vals.extend([est] * int(round(cab)))
        return {
            "cabezas":       cab_ok or len(rows),
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
            por_cat[cat] = calc_stats(rows, cat=cat)

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

    # Por categoría — últimos 90 días con comparación vs ADP teórico
    regs_90d    = [r for r in regs if r.get('_en_90d')]
    por_cat_90d = {}
    if col_cat and regs_90d:
        cat_regs_90 = {}
        for r in regs_90d:
            cat = str(r.get(col_cat) or "Sin datos").strip().upper()
            cat_regs_90.setdefault(cat, []).append(r)
        for cat, rows in sorted(cat_regs_90.items()):
            st = calc_stats(rows, cat=cat)
            obs = st.get('adp_promedio')
            teo = _ADP_TEO.get(cat)
            # Variación % entre observado y teórico
            var_pct = round((obs - teo) / teo * 100, 2) if (obs is not None and teo) else None
            # Calibrado: clampear obs a ±15% del teórico
            if obs is not None and teo:
                lo, hi = teo * 0.85, teo * 1.15
                cal     = round(max(lo, min(hi, obs)), 4)
                ajust   = (obs < lo or obs > hi)
            else:
                cal   = obs
                ajust = False
            por_cat_90d[cat] = {
                **st,
                "adp_teorico":   round(teo, 4) if teo else None,
                "adp_calibrado": cal,
                "variacion_pct": var_pct,
                "ajustado":      ajust,
                "adp_min_range": round(teo * 0.85, 4) if teo else None,
                "adp_max_range": round(teo * 1.15, 4) if teo else None,
            }
    log.info(f"  por_categoria_90d: {len(por_cat_90d)} categorías ({len(regs_90d)} registros en 90d)")

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
        "general":          general,
        "por_categoria":    por_cat,
        "por_categoria_90d": por_cat_90d,
        "por_mes":          por_mes,
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
    hace_30d  = hoy - timedelta(days=30)   # ventana amplia para detectar días con registros

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
            "semanal": {"desde": str(hoy), "hasta": str(hoy), "total_kg_3d": 0,
                        "promedio_diario_kg": 0, "promedio_diario_kg_ms": 0, "por_insumo": []},
        }

    # Parsear fechas y filtrar último año + últimos 30 días
    regs_anio      = []
    regs_recientes = []   # últimos 30 días (ventana para encontrar los 3 días con datos)
    for r in regs:
        try:
            f = pd.to_datetime(r.get(col_fecha), errors="coerce")
            if f is None or pd.isnull(f): continue
            fd = f.date()
            if fd < hace_anio: continue
            regs_anio.append(r)
            if fd >= hace_30d:
                regs_recientes.append(r)
        except:
            continue

    # ── Detectar los últimos 3 días únicos con registros ──
    dias_recientes_set = set()
    for r in regs_recientes:
        try:
            f = pd.to_datetime(r.get(col_fecha), errors="coerce")
            if f and not pd.isnull(f):
                dias_recientes_set.add(f.date().strftime("%Y-%m-%d"))
        except: pass
    ultimos_3_dias = set(sorted(dias_recientes_set, reverse=True)[:3])
    regs_3d = [r for r in regs_recientes
               if not pd.isnull(pd.to_datetime(r.get(col_fecha), errors="coerce"))
               and pd.to_datetime(r.get(col_fecha), errors="coerce").date().strftime("%Y-%m-%d") in ultimos_3_dias]
    desde_3d = min(ultimos_3_dias) if ultimos_3_dias else str(hoy)
    hasta_3d = max(ultimos_3_dias) if ultimos_3_dias else str(hoy)

    log.info(f"  Registros último año: {len(regs_anio):,}  |  Últimos 3 días registrados: {sorted(ultimos_3_dias)}")

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

    # ── Promedio diario últimos 3 días registrados ──
    semanal_por_ins = {}
    dias_con_datos  = set()
    total_3d = 0.0
    for r in regs_3d:
        desc = str(r.get(col_desc) or "Sin descripción").strip() if col_desc else "Sin descripción"
        cod  = str(r.get(col_cod)  or "").strip()               if col_cod  else ""
        kg   = to_num(r.get(col_kg, 0))
        total_3d += kg
        if desc not in semanal_por_ins:
            semanal_por_ins[desc] = {"cod": cod, "kg": 0.0, "dias": set()}
        semanal_por_ins[desc]["kg"] += kg
        try:
            fd = pd.to_datetime(r.get(col_fecha), errors="coerce")
            if fd and not pd.isnull(fd):
                dia_str = fd.strftime("%Y-%m-%d")
                dias_con_datos.add(dia_str)
                semanal_por_ins[desc]["dias"].add(dia_str)
        except: pass

    # Divisor = días únicos con registros en los últimos 3 (mínimo 1)
    n_dias = max(len(dias_con_datos), 1)
    log.info(f"  Últimos 3 días con registros: {n_dias} ({sorted(dias_con_datos)})")

    por_insumo_3d = sorted(
        [{"desc": d, "cod": v["cod"],
          "kg_3d": round(v["kg"], 1),
          "dias_registrados": len(v["dias"]),
          "promedio_diario":    round(v["kg"] / max(len(v["dias"]), 1), 1),
          "ms_pct":             get_ms(d),
          "promedio_diario_ms": round(v["kg"] / max(len(v["dias"]), 1) * get_ms(d) / 100, 1)
                                if get_ms(d) is not None else None}
         for d, v in semanal_por_ins.items()],
        key=lambda x: -x["kg_3d"]
    )
    prom_diario_total    = round(total_3d / n_dias, 1)
    prom_diario_total_ms = round(sum(
        r["promedio_diario_ms"] for r in por_insumo_3d if r["promedio_diario_ms"] is not None
    ), 1)
    # % MS global = kg MS / kg TC × 100
    pct_ms_global = round(prom_diario_total_ms / prom_diario_total * 100, 1) if prom_diario_total > 0 else 0.0
    log.info(f"  Total 3d: {total_3d:,.0f} kg  |  Días: {n_dias}  |  Prom diario TC: {prom_diario_total:,.1f} kg/día  |  MS: {prom_diario_total_ms:,.1f} kg/día  |  %MS: {pct_ms_global:.1f}%")

    return {
        "meta": {
            "generado":    datetime.now().isoformat(),
            "periodo":     periodo,
            "tabla":       "v_PB_ConsumoDetallado",
            "col_kg":      col_kg,
            "desde_anual": str(hace_anio),
            "hasta":       str(hoy),
            "registros_anio": len(regs_anio),
            "registros_3d":   len(regs_3d),
        },
        "anual": {
            "total_kg":    round(total_anual, 1),
            "total_kg_ms": total_anual_ms,
            "por_insumo":  por_insumo_anual,
        },
        "semanal": {
            "desde":                 desde_3d,
            "hasta":                 hasta_3d,
            "dias_registrados":      n_dias,
            "dias_detalle":          sorted(dias_con_datos),
            "total_kg_3d":           round(total_3d, 1),
            "promedio_diario_kg":    prom_diario_total,
            "promedio_diario_kg_ms": prom_diario_total_ms,
            "pct_ms_global":         pct_ms_global,
            "por_insumo":            por_insumo_3d,
        },
    }

# ═══════════════════════════════════════════════════════════
#  MÓDULO 10 · VALUACIÓN EN PESOS
#  Scraping de precios externos:
#   · MAG  → Índice Arrendamiento ($/kg hacienda) por mes
#   · BCR  → Precio pizarra promedio Maíz y Soja ($/ton) por mes
#  Calcula valuación total mensual: Hacienda + Insumos + Financiero + USD
# ═══════════════════════════════════════════════════════════

def _ar_num(s):
    """Convierte número formato argentino '1.234.567,89' a float."""
    if s is None:
        return None
    s = str(s).strip().replace('\xa0', '').replace(' ', '')
    if not s or s == '-' or s == '—':
        return None
    try:
        return float(s.replace('.', '').replace(',', '.'))
    except ValueError:
        return None


def _mes_rango(periodo_str):
    """
    Dado 'YYYY-MM' devuelve (primer_dia, ultimo_dia) como datetime.date.
    """
    import calendar
    from datetime import date as _date
    year, month = int(periodo_str[:4]), int(periodo_str[5:7])
    ultimo = calendar.monthrange(year, month)[1]
    return _date(year, month, 1), _date(year, month, ultimo)


def _html_tabla(html_bytes, encoding='latin-1'):
    """
    Extrae filas de la primera tabla HTML encontrada.
    Devuelve lista de listas de strings (texto de cada celda).
    """
    from html.parser import HTMLParser

    class _TP(HTMLParser):
        def __init__(self):
            super().__init__()
            self.rows, self._row, self._cell, self._in = [], [], [], False
        def handle_starttag(self, tag, attrs):
            if tag in ('td', 'th'):
                self._in = True; self._cell = []
            elif tag == 'tr':
                self._row = []
        def handle_endtag(self, tag):
            if tag in ('td', 'th'):
                self._row.append(''.join(self._cell).strip()); self._in = False
            elif tag == 'tr':
                if self._row:
                    self.rows.append(self._row)
        def handle_data(self, data):
            if self._in:
                self._cell.append(data)

    for enc in (encoding, 'utf-8', 'latin-1', 'cp1252'):
        try:
            txt = html_bytes.decode(enc, errors='replace')
            break
        except Exception:
            continue

    p = _TP()
    p.feed(txt)
    return p.rows


def _scrap_mag_indice(periodo_str):
    """
    Scraping MAG: devuelve Índice Arrendamiento promedio del mes ($/kg hacienda)
    para el período 'YYYY-MM'.  Retorna float o None si no hay datos.
    """
    import urllib.request, urllib.parse

    primer, ultimo = _mes_rango(periodo_str)
    fi = primer.strftime('%d/%m/%Y')
    ff = ultimo.strftime('%d/%m/%Y')

    payload = urllib.parse.urlencode({
        'ID': '', 'CP': '', 'FLASH': '',
        'USUARIO': 'SIN IDENTIFICAR',
        'OPCIONMENU': '', 'OPCIONSUBMENU': '',
        'txtFechaIni': fi,
        'txtFechaFin': ff,
    }).encode('utf-8')

    url = 'https://www.mercadoagroganadero.com.ar/dll/hacienda2.dll/haciinfo000013'
    try:
        req = urllib.request.Request(url, data=payload, method='POST')
        req.add_header('User-Agent', 'Mozilla/5.0 (compatible; PEGSA-Bot/1.0)')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
    except Exception as e:
        log.warning(f'    MAG request error ({periodo_str}): {e}')
        return None

    filas = _html_tabla(raw, encoding='latin-1')
    # Buscar fila "Totales" → columna 3 = Índice Arrendamiento
    # Encabezado: Fecha | Cab. ingresadas | Importe | Índice Arrendamiento | Variación
    for fila in filas:
        if fila and 'total' in fila[0].lower():
            if len(fila) >= 4:
                val = _ar_num(fila[3])
                if val:
                    log.info(f'    MAG {periodo_str}: índice={val:,.3f} $/kg')
                    return val
    log.warning(f'    MAG {periodo_str}: sin datos en la tabla')
    return None


def _scrap_bcr_precio(product_id, nombre, periodo_str):
    """
    Scraping BCR Cámara Arbitral: precio pizarra promedio mensual ($/ton).
    product_id: 3=Maíz, 13=Soja
    Retorna float ($/ton) o None.
    """
    import urllib.request

    primer, ultimo = _mes_rango(periodo_str)
    ds = primer.strftime('%Y-%m-%d')
    de = ultimo.strftime('%Y-%m-%d')

    url = (f'https://www.cac.bcr.com.ar/es/precios-de-pizarra/consultas'
           f'?product={product_id}&type=average&date_start={ds}&date_end={de}')
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (compatible; PEGSA-Bot/1.0)')
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
    except Exception as e:
        log.warning(f'    BCR {nombre} request error ({periodo_str}): {e}')
        return None

    filas = _html_tabla(raw, encoding='utf-8')
    # Estructura: [nombre], [Fecha Desde, Fecha Hasta, Promedio], [val, val, PRECIO]
    for fila in filas:
        if len(fila) >= 3 and fila[0].startswith('0') and '/' in fila[0]:
            # Fila de datos: primera celda es una fecha
            val = _ar_num(fila[2])
            if val:
                log.info(f'    BCR {nombre} {periodo_str}: {val:,.2f} $/ton')
                return val
    log.warning(f'    BCR {nombre} {periodo_str}: sin datos')
    return None


def _scrap_bna_tc():
    """
    Scraping BNA: devuelve el tipo de cambio dólar Billete Venta del día actual.
    Fuente: https://www.bna.com.ar/Personas
    Tabla 0 = Billete: fila "Dolar U.S.A" → celda[2] = Venta
    Retorna float (ARS por USD) o None si falla.
    """
    import urllib.request

    url = 'https://www.bna.com.ar/Personas'
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (compatible; PEGSA-Bot/1.0)')
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
    except Exception as e:
        log.warning(f'    BNA TC request error: {e}')
        return None

    # Parsear todas las tablas; tabla[0] = Billete, tabla[1] = Divisa
    from html.parser import HTMLParser

    class _AllTables(HTMLParser):
        def __init__(self):
            super().__init__()
            self.tables = []
            self._cur_table = None
            self._cur_row   = None
            self._cur_cell  = None
            self._depth     = 0

        def handle_starttag(self, tag, attrs):
            tag = tag.lower()
            if tag == 'table':
                self._cur_table = []
                self._depth += 1
            elif tag in ('tr',):
                if self._cur_table is not None and self._depth == 1:
                    self._cur_row = []
            elif tag in ('td', 'th'):
                if self._cur_row is not None:
                    self._cur_cell = []

        def handle_endtag(self, tag):
            tag = tag.lower()
            if tag == 'table':
                if self._cur_table is not None:
                    self.tables.append(self._cur_table)
                self._cur_table = None
                self._depth -= 1
            elif tag == 'tr':
                if self._cur_row is not None and self._cur_table is not None:
                    self._cur_table.append(self._cur_row)
                self._cur_row = None
            elif tag in ('td', 'th'):
                if self._cur_cell is not None and self._cur_row is not None:
                    self._cur_row.append(' '.join(self._cur_cell).strip())
                self._cur_cell = None

        def handle_data(self, data):
            if self._cur_cell is not None:
                self._cur_cell.append(data)

    try:
        txt = raw.decode('utf-8', errors='replace')
    except Exception:
        txt = raw.decode('latin-1', errors='replace')

    parser = _AllTables()
    parser.feed(txt)

    if not parser.tables:
        log.warning('    BNA TC: no se encontraron tablas en la página')
        return None

    # Tabla 0 = Billete
    tabla_billete = parser.tables[0]
    for fila in tabla_billete:
        if fila and 'dolar' in fila[0].lower():
            # celda[2] = Venta
            if len(fila) >= 3:
                val = _ar_num(fila[2])
                if val:
                    log.info(f'    BNA TC Billete Venta: ${val:,.2f}/USD')
                    return val
    log.warning('    BNA TC: no se encontró fila "Dolar U.S.A" en tabla Billete')
    return None


def actualizar_valuacion(carpeta, snaps_historico):
    """
    Calcula la valuación mensual en pesos para cada snapshot histórico.
    Componentes:
      · Hacienda PEGSA = kg_pegsa × indice_MAG ($/kg)
      · Insumos        = kg_maiz × precio_maiz/ton + kg_soja × precio_soja/ton
      · Financiero     = disponible + cartera - emitidos + cobrar_hac - pagar_hac + lcg + tercio
      · USD            = usd_ars (ya convertido al TC del mes)
    Cachea precios scrapeados para no re-consultar períodos ya guardados.
    """
    val_path = Path(carpeta) / 'valuacion_historica.json'

    # ── Cargar caché existente ──
    cache = {}   # {periodo_str: {mag, bcr_maiz, bcr_soja}}
    val_snaps_prev = {}   # {periodo_str: snap guardado}
    if val_path.exists():
        try:
            with open(val_path, encoding='utf-8') as _f:
                _old = json.load(_f)
            for _s in _old.get('snapshots', []):
                p = _s.get('periodo', '')
                val_snaps_prev[p] = _s
                pr = _s.get('precios', {})
                if pr.get('mag_indice') or pr.get('bcr_maiz_ton') or pr.get('bcr_soja_ton'):
                    cache[p] = pr
        except Exception:
            pass

    # ── Scraping BNA TC una sola vez (TC actual) ──
    # Solo scrapeamos para el período actual; históricos que ya están cacheados
    # conservan su TC guardado.  Si es None, el total_usd quedará null.
    from datetime import date as _dtoday
    _periodo_hoy = _dtoday.today().strftime('%Y-%m')
    _bna_tc_hoy  = None   # se lazy-inicializa solo si hay al menos un período que lo necesita

    nuevos_snaps = []

    for snap in snaps_historico:
        periodo  = snap.get('periodo', '')
        hm       = snap.get('hacienda_masa', {})
        fin      = snap.get('financiero', {})
        ins      = snap.get('insumos', {})
        pegsa    = hm.get('pegsa', {})

        if not periodo:
            continue

        log.info(f'  · Valuación {periodo}')

        # ── 1. Obtener precios (con caché) ──
        cached = cache.get(periodo, {})

        mag_indice = cached.get('mag_indice')
        if mag_indice is None:
            mag_indice = _scrap_mag_indice(periodo)

        bcr_maiz = cached.get('bcr_maiz_ton')
        if bcr_maiz is None:
            bcr_maiz = _scrap_bcr_precio(3, 'Maíz', periodo)

        bcr_soja = cached.get('bcr_soja_ton')
        if bcr_soja is None:
            bcr_soja = _scrap_bcr_precio(13, 'Soja', periodo)

        # ── 1b. BNA TC: usar caché si existe; para el período actual re-scrapeamos ──
        bna_tc = cached.get('bna_tc_venta')
        if bna_tc is None or periodo == _periodo_hoy:
            # Solo consultamos BNA una vez por ejecución
            if _bna_tc_hoy is None and periodo == _periodo_hoy:
                _bna_tc_hoy = _scrap_bna_tc()
            if periodo == _periodo_hoy:
                bna_tc = _bna_tc_hoy
            # Para períodos históricos sin TC en caché: queda None (histórico no disponible)

        # ── 2. Hacienda PEGSA en pesos ──
        kg_pegsa       = float(pegsa.get('kg_proyectado') or 0)
        hacienda_pesos = round(kg_pegsa * mag_indice) if mag_indice else None

        # ── 3. Insumos en pesos (solo Maíz y Soja) ──
        # items puede ser dict {nombre: kg} o lista [{nombre, stock_kg}]
        kg_maiz = kg_soja = 0.0
        if ins and ins.get('items'):
            _items = ins['items']
            if isinstance(_items, dict):
                # Formato real: {"MAIZ GRANO (KG)": 1575000, ...}
                for _nom, _kg in _items.items():
                    _n = str(_nom or '').upper()
                    _v = float(_kg or 0)
                    if 'MAIZ' in _n or 'MAÍZ' in _n:
                        kg_maiz += _v
                    elif 'SOJA' in _n:
                        kg_soja += _v
            else:
                # Formato alternativo: [{nombre, stock_kg}]
                for it in _items:
                    nom = str(it.get('nombre', '') or '').upper()
                    kg  = float(it.get('stock_kg') or 0)
                    if 'MAIZ' in nom or 'MAÍZ' in nom:
                        kg_maiz += kg
                    elif 'SOJA' in nom:
                        kg_soja += kg

        maiz_pesos = round(kg_maiz * bcr_maiz / 1000) if bcr_maiz else None
        soja_pesos = round(kg_soja * bcr_soja / 1000) if bcr_soja else None
        insumos_pesos = (
            (maiz_pesos or 0) + (soja_pesos or 0)
            if (maiz_pesos is not None or soja_pesos is not None) else None
        )

        # ── 4. Posición financiera en pesos ──
        disp    = float(fin.get('disponible')       or 0)
        cartera = float(fin.get('cheques_cartera')  or 0)
        emit    = float(fin.get('cheques_emitidos') or 0)
        cobrar  = float(fin.get('cobrar_hacienda')  or 0)
        pagar   = float(fin.get('pagar_hacienda')   or 0)
        lcg     = float(fin.get('lcg')              or 0)
        tercio  = float(fin.get('tercio_bravo')     or 0)
        fin_pesos = round(disp + cartera - emit + cobrar - pagar + lcg + tercio) if any([disp, cartera, cobrar]) else None

        # ── 5. Dólares ya convertidos a pesos ──
        usd_pesos = round(float(fin.get('usd_ars') or 0)) or None

        # ── 6. Total pesos ──
        componentes = [hacienda_pesos, insumos_pesos, fin_pesos, usd_pesos]
        total_pesos = round(sum(c for c in componentes if c is not None)) if any(c is not None for c in componentes) else None

        # ── 7. Total USD (usando BNA TC) ──
        total_usd = round(total_pesos / bna_tc, 0) if (total_pesos is not None and bna_tc) else None

        s = {
            'periodo':  periodo,
            'fecha':    snap.get('fecha', ''),
            'precios': {
                'mag_indice':    mag_indice,
                'bcr_maiz_ton':  bcr_maiz,
                'bcr_soja_ton':  bcr_soja,
                'bna_tc_venta':  bna_tc,
            },
            'componentes': {
                'hacienda_kg_pegsa': round(kg_pegsa),
                'hacienda_pesos':    hacienda_pesos,
                'maiz_kg':           round(kg_maiz),
                'maiz_pesos':        maiz_pesos,
                'soja_kg':           round(kg_soja),
                'soja_pesos':        soja_pesos,
                'insumos_pesos':     insumos_pesos,
                'financiero_pesos':  fin_pesos,
                'usd_pesos':         usd_pesos,
                'total_pesos':       total_pesos,
                'total_usd':         total_usd,
            }
        }
        nuevos_snaps.append(s)
        tc_str = f' | TC ${bna_tc:,.0f}' if bna_tc else ''
        usd_str = f' = U$S {total_usd:,.0f}' if total_usd else ''
        log.info(f'    Total {periodo}: {("${:,.0f}".format(total_pesos)) if total_pesos else "—"}{tc_str}{usd_str}')

    nuevos_snaps.sort(key=lambda x: x.get('periodo', ''))

    resultado = {
        'generado':  datetime.now().isoformat(),
        'metodo':    'scraping_mag_bcr_bna',
        'snapshots': nuevos_snaps,
    }
    guardar(resultado, carpeta, 'valuacion_historica.json')
    log.info(f'  ✓ valuacion_historica.json — {len(nuevos_snaps)} períodos')
    return resultado


# ═══════════════════════════════════════════════════════════
#  RUNNING BALANCE · STOCK DIARIO HISTÓRICO
#  Recalcula cada día desde movimientos reales en lugar de
#  acumular snapshots diarios (que quedan desactualizados
#  cuando se cargan compras/ventas con fecha retroactiva).
# ═══════════════════════════════════════════════════════════

def recalcular_stock_diario_desde_movimientos(
        regs_stock, cols_stock,
        regs_ing,   cols_ing,
        regs_egr,   cols_egr,
        carpeta,    periodo,
        dias=90):
    """
    Recalcula el stock diario histórico usando running balance.
    stock(D) = stock(D+1) - ingresos(D+1) + egresos(D+1)
    Baseline = V_STOCK_HACIENDA actual (estado definitivo de hoy).
    Retiene solo los últimos `dias` días (90 por defecto) para controlar
    el tamaño del archivo. Las entradas más antiguas se descartan.
    El resultado reemplaza completamente stock_diario.json en cada ejecución,
    incorporando automáticamente cualquier carga retroactiva de movimientos.
    """
    from datetime import date as _date, timedelta as _td

    hoy = _date.today()

    # ── 1. Baseline: stock de hoy ──────────────────────────────
    kpis_hoy      = calcular_kpis(regs_stock or [], cols_stock or [])
    total_cab_hoy = int(kpis_hoy.get("total_cabezas", 0))
    total_kg_hoy  = kpis_hoy.get("total_kg_estimado_hoy", 0) or 0
    avg_kg_hoy    = total_kg_hoy / max(total_cab_hoy, 1)

    # Snapshots de propietario (Hotelero) para hoy
    prop_hoy = {
        p: {"cabezas": int(v.get("cabezas", 0)),
            "kg_estimado": int(v.get("kg_estimado", 0))}
        for p, v in kpis_hoy.get("por_propietario", {}).items()
    }

    log.info(f"  Baseline hoy ({hoy}): {total_cab_hoy:,} cab · {total_kg_hoy/1000:,.0f} t")
    log.info(f"  Propietarios baseline: {list(prop_hoy.keys())}")

    # ── 2. Resolución de columnas ─────────────────────────────
    def _fc(cols, *keys):
        """Busca la primera columna cuyo nombre exacto (o en minúsculas) coincide."""
        for k in keys:
            for c in (cols or []):
                if c == k or c.lower() == k.lower():
                    return c
        return None

    col_fi = _fc(cols_ing, "FechaIngreso", "fecha_ingreso", "FECHA_INGRESO", "fecha")
    col_ci = _fc(cols_ing, "CantidadIngreso", "cantidadingreso", "CANTIDADINGRESO", "cantidad", "Cantidad", "cabezas")
    col_hi = _fc(cols_ing, "Hotelero", "hotelero", "HOTELERO", "propietario", "Propietario")

    col_fe = _fc(cols_egr, "FechaSalida", "fecha_salida", "FECHA_SALIDA", "fecha")
    col_ce = _fc(cols_egr, "CantidadEgreso", "cantidadegreso", "CANTIDADEGRESO", "cantidad", "Cantidad", "cabezas")
    col_he = _fc(cols_egr, "Hotelero", "hotelero", "HOTELERO", "propietario", "Propietario")

    log.info(f"  Ingresos cols → fecha={col_fi} cant={col_ci} hotelero={col_hi}")
    log.info(f"  Egresos cols  → fecha={col_fe} cant={col_ce} hotelero={col_he}")

    # ── 3. Función fecha → YYYY-MM-DD ─────────────────────────
    def _fs(val):
        if val is None:
            return None
        if isinstance(val, _date):
            return val.strftime("%Y-%m-%d")
        if hasattr(val, "strftime"):
            return val.strftime("%Y-%m-%d")
        try:
            from datetime import datetime as _dt
            return _dt.fromisoformat(str(val)[:10]).strftime("%Y-%m-%d")
        except Exception:
            return None

    # ── 4. Acumular movimientos por fecha ─────────────────────
    ing_total = {}  # {fecha_str: cabezas_int}
    ing_prop  = {}  # {fecha_str: {hotelero: cabezas_int}}
    egr_total = {}
    egr_prop  = {}

    for r in (regs_ing or []):
        fs = _fs(r.get(col_fi)) if col_fi else None
        if not fs:
            continue
        try:
            cant = int(round(float(r.get(col_ci, 0) or 0)))
        except Exception:
            cant = 0
        if cant <= 0:
            continue
        prop = str(r.get(col_hi) or "").strip() if col_hi else ""
        ing_total[fs] = ing_total.get(fs, 0) + cant
        if prop:
            ing_prop.setdefault(fs, {})
            ing_prop[fs][prop] = ing_prop[fs].get(prop, 0) + cant

    for r in (regs_egr or []):
        fs = _fs(r.get(col_fe)) if col_fe else None
        if not fs:
            continue
        try:
            cant = int(round(float(r.get(col_ce, 0) or 0)))
        except Exception:
            cant = 0
        if cant <= 0:
            continue
        prop = str(r.get(col_he) or "").strip() if col_he else ""
        egr_total[fs] = egr_total.get(fs, 0) + cant
        if prop:
            egr_prop.setdefault(fs, {})
            egr_prop[fs][prop] = egr_prop[fs].get(prop, 0) + cant

    # Diagnóstico: primeras fechas con movimientos
    _sample_ing = sorted(ing_total.items())[-5:]
    _sample_egr = sorted(egr_total.items())[-5:]
    log.info(f"  Ingresos últimas 5 fechas: {_sample_ing}")
    log.info(f"  Egresos  últimas 5 fechas: {_sample_egr}")

    # ── 5. Cargar historial acumulado de por_propietario ──────
    # por_propietario se acumula día a día desde ejecuciones anteriores.
    # No se reconstruye hacia atrás (el campo Hotelero en las vistas de
    # movimientos puede no coincidir con los nombres en V_STOCK_HACIENDA).
    # Estrategia: conservar histórico guardado; hoy se sobreescribe con la
    # vista actual (siempre correcta).
    _diario_path = Path(carpeta) / "stock_diario.json"
    _hist_prop   = {}   # {fecha_str: {propietario: {cabezas, kg_estimado}}}
    if _diario_path.exists():
        try:
            with open(_diario_path, encoding="utf-8") as _fh:
                _old = json.load(_fh)
            for _s in _old.get("snapshots", []):
                _fs2 = _s.get("fecha", "")
                _pp  = (_s.get("hacienda") or {}).get("por_propietario")
                if _fs2 and _pp:
                    _hist_prop[_fs2] = _pp
        except Exception:
            pass
    # Hoy siempre desde la vista actual (dato fidedigno)
    _hoy_str = hoy.strftime("%Y-%m-%d")
    _hist_prop[_hoy_str] = prop_hoy
    log.info(f"  por_propietario acumulado: {len(_hist_prop)} fechas con datos")

    # ── 6. Running balance hacia atrás desde hoy ──────────────
    snapshots = []
    cab_d = total_cab_hoy

    for i in range(dias + 1):
        dia = hoy - _td(days=i)
        fs  = dia.strftime("%Y-%m-%d")

        if i > 0:
            # stock(D) = stock(D+1) - ingresos(D+1) + egresos(D+1)
            fs_next = (dia + _td(days=1)).strftime("%Y-%m-%d")
            ing_n   = ing_total.get(fs_next, 0)
            egr_n   = egr_total.get(fs_next, 0)
            cab_d   = max(0, cab_d - ing_n + egr_n)

        kg_d      = int(cab_d * avg_kg_hoy)
        prop_snap = _hist_prop.get(fs, {})   # datos reales si existen

        snapshots.append({
            "fecha": fs,
            "hacienda": {
                "total_cabezas":       int(cab_d),
                "total_kg_estimado":   kg_d,
                "por_propietario":     prop_snap,
                "por_establecimiento": {},
                "por_categoria":       {}
            }
        })

    # Ordenar ascendente (más antiguo primero)
    snapshots.sort(key=lambda s: s["fecha"])

    diario = {
        "generado":  datetime.now().isoformat(),
        "periodo":   periodo,
        "metodo":    "running_balance",
        "dias":      len(snapshots),
        "snapshots": snapshots,
    }
    guardar(diario, carpeta, "stock_diario.json")
    log.info(f"  ✓ stock_diario.json — {len(snapshots)} días · running balance")
    return diario


def main():
    separador("PEGSA & BULLTRADE - Actualizador de Datos")
    log.info(f"  Inicio: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    separador()

    cfg     = cargar_config()
    periodo = cfg["OPCIONES"]["periodo"]
    carpeta = resolver_carpeta_salida(cfg["ONEDRIVE"].get("carpeta", ""))
    log.info(f"  Periodo : {periodo}")
    log.info(f"  Destino : {carpeta}")
    log.info("")

    conn    = conectar(cfg)
    resumen = {"generado": datetime.now().isoformat(), "periodo": periodo, "modulos": {}}

    separador("Stock de Hacienda")
    tabla      = cfg["TABLAS"].get("stock_hacienda", "V_STOCK_HACIENDA")
    regs, cols = extraer(conn, tabla)
    # Guardar referencia al stock actual para el recálculo diario posterior
    _regs_stock_hoy = regs
    _cols_stock_hoy = cols

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

    # ── Actualizar STOCK DE INSUMOS.xlsx en carpeta stock mensuales ──
    if insumos:
        try:
            from pathlib import Path as _Path
            _carpeta_sm = _Path(carpeta).parent / "stock mensuales"
            _today_str  = datetime.now().strftime('%Y-%m-%d')
            log.info(f"  → Actualizando STOCK DE INSUMOS.xlsx ({_today_str})...")
            actualizar_stock_insumos_excel(insumos, str(_carpeta_sm), _today_str)
        except Exception as _e:
            log.warning(f"  ⚠ Error actualizando STOCK DE INSUMOS.xlsx: {_e}")

    # ── 6. JSON Movimientos Productivos (Ingresos + Egresos) ──
    separador("Movimientos Productivos")
    tabla_ing = cfg["TABLAS"].get("movimientos_ingresos", "v_PB_Ingresos")
    tabla_egr = cfg["TABLAS"].get("movimientos_egresos",  "v_PB_Egresos")

    regs_ing, cols_ing = extraer(conn, tabla_ing, fecha_col="FechaIngreso", dias=730)
    regs_egr, cols_egr = extraer(conn, tabla_egr, fecha_col="FechaSalida",  dias=730)

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
    regs_m, cols_m = extraer(conn, tabla_muertes, fecha_col="FECHA_MUERTE", dias=730)

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
    regs_cons, cols_cons = extraer(conn, tabla_consumo, fecha_col="FECHA", dias=730)
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

    # ── MÓDULO MERCADO Y PRECIOS (web scraping) ───────────────
    separador("MÓDULO 7 · MERCADO Y PRECIOS")
    try:
        _repo_txt = Path(__file__).parent / "repo_github_path.txt"
        _repo_path = _repo_txt.read_text(encoding="utf-8").strip() if _repo_txt.exists() else ""
        if not _repo_path:
            _repo_path = cfg.get("GITHUB", {}).get("repo_path", "")
        actualizar_mercado_precios(carpeta, _repo_path)
    except Exception as e:
        log.warning(f"  ⚠ Módulo mercado falló: {e}")
        import traceback; log.warning(traceback.format_exc())

    # ── MÓDULO 8 · HISTÓRICO MENSUAL (reconstrucción completa) ──
    separador("MÓDULO 8 · HISTÓRICO MENSUAL")
    try:
        import calendar as _cal
        _hist_path = Path(carpeta) / "stock_historico.json"
        _kpis_path = Path(carpeta) / f"stock_kpis_{periodo}.json"
        _ins_path  = Path(carpeta) / f"stock_insumos_{periodo}.json"
        _mov_path  = Path(carpeta) / f"movimientos_{periodo}.json"

        if _kpis_path.exists() and _mov_path.exists():
            with open(_kpis_path, encoding="utf-8") as _f: _kpis_raw = json.load(_f)
            with open(_mov_path,  encoding="utf-8") as _f: _mov_raw  = json.load(_f)
            _ins_raw = json.load(open(_ins_path, encoding="utf-8")) if _ins_path.exists() else {}

            _k      = _kpis_raw.get("kpis", {})
            _anio   = _mov_raw.get("anio", {})
            _ing_mes  = _anio.get("ingresos", {}).get("por_mes", {})
            _egr_mes  = _anio.get("egresos",  {}).get("por_mes", {})
            _ing_prop = _anio.get("ingresos", {}).get("por_propietario", {})
            _egr_prop = _anio.get("egresos",  {}).get("por_propietario", {})
            _ing_cat  = _anio.get("ingresos", {}).get("por_categoria", {})
            _egr_cat  = _anio.get("egresos",  {}).get("por_categoria", {})

            # Totales anuales para distribución proporcional
            _tic = sum(v.get("cabezas",0) or 0 for v in _ing_prop.values()) or 1
            _tec = sum(v.get("cabezas",0) or 0 for v in _egr_prop.values()) or 1
            _tic2= sum(v.get("cabezas",0) or 0 for v in _ing_cat.values())  or 1
            _tec2= sum(v.get("cabezas",0) or 0 for v in _egr_cat.values())  or 1

            # Punto de anclaje: hoy
            _stock_a = _k.get("total_cabezas", 0)
            _kg_a    = _k.get("total_kg_estimado_hoy", 0)
            _prop_a  = {p: v["cabezas"] for p,v in _k.get("por_propietario",{}).items()}
            _cat_a   = {c: v.get("cabezas",0) for c,v in _k.get("por_categoria",{}).items()}

            _hoy_str  = datetime.now().strftime("%Y-%m")
            _all_meses= sorted(set(list(_ing_mes)+list(_egr_mes)))
            _meses    = sorted([m for m in _all_meses if m <= _hoy_str], reverse=True)

            _snaps = []
            for _mes in _meses:
                _ic = _ing_mes.get(_mes,{}).get("cabezas",0) or 0
                _ec = _egr_mes.get(_mes,{}).get("cabezas",0) or 0
                _ikg= _ing_mes.get(_mes,{}).get("kg",0)      or 0
                _ekg= _egr_mes.get(_mes,{}).get("kg",0)      or 0

                _y, _m = int(_mes[:4]), int(_mes[5:7])
                _ld   = _cal.monthrange(_y, _m)[1]
                _fecha= f"{_y:04d}-{_m:02d}-{_ld:02d}"

                _pp = {p: {"cabezas": c, "kg_estimado": round(_kg_a * c / max(_stock_a,1))}
                       for p,c in _prop_a.items()}
                _pc = {c: {"cabezas": cab, "kg_estimado": round(_kg_a * cab / max(_stock_a,1))}
                       for c,cab in _cat_a.items()}

                _snaps.append({
                    "fecha": _fecha, "periodo": _mes,
                    "hacienda": {
                        "total_cabezas":     _stock_a,
                        "total_kg_estimado": max(0, round(_kg_a)),
                        "por_propietario":   _pp,
                        "por_categoria":     _pc,
                    },
                    "insumos": {
                        "total_kg": _ins_raw.get("total_kg", 0),
                        "items": [{"nombre": it["nombre"], "stock_kg": it["stock_kg"]}
                                  for it in _ins_raw.get("insumos", [])]
                    } if _mes == _hoy_str else {"total_kg": 0, "items": []}
                })

                # Retroceder al mes anterior
                _stock_a = max(0, _stock_a + _ec - _ic)
                _kg_a    = max(0, _kg_a    + _ekg- _ikg)
                _prop_a  = {p: max(0, round(c + (_egr_prop.get(p,{}).get("cabezas",0) or 0)/_tec*_ec
                                              - (_ing_prop.get(p,{}).get("cabezas",0) or 0)/_tic*_ic))
                            for p,c in _prop_a.items()}
                _cat_a   = {c: max(0, round(cab + (_egr_cat.get(c,{}).get("cabezas",0) or 0)/_tec2*_ec
                                              - (_ing_cat.get(c,{}).get("cabezas",0) or 0)/_tic2*_ic))
                            for c,cab in _cat_a.items()}

            _snaps.reverse()
            _hist_out = {"generado": datetime.now().isoformat(), "fuente": "reconstruccion_sql",
                         "snapshots": _snaps}
            guardar(_hist_out, carpeta, "stock_historico.json")
            log.info(f"  ✓ stock_historico.json — {len(_snaps)} meses reconstruidos "
                     f"({_snaps[0]['periodo']} → {_snaps[-1]['periodo']})")
            resumen["modulos"]["historico"] = {
                "ok": True, "snapshots": len(_snaps),
                "rango": f"{_snaps[0]['periodo']} → {_snaps[-1]['periodo']}"
            }
        else:
            log.info("  ℹ stock_kpis o movimientos no encontrados — histórico omitido")
            resumen["modulos"]["historico"] = {"ok": True, "snapshots": 0}
    except Exception as e:
        log.warning(f"  ⚠ Snapshot histórico falló: {e}")
        resumen["modulos"]["historico"] = {"ok": False, "error": str(e)}

    # ── MÓDULO 9 · COMPORTAMIENTO HISTÓRICO MENSUAL ───────────
    separador("MÓDULO 9 · COMPORTAMIENTO HISTÓRICO MENSUAL")
    try:
        from pathlib import Path as _Path9
        _carpeta_sm9 = _Path9(carpeta).parent / "stock mensuales"
        _hist9 = actualizar_comportamiento_historico(carpeta, str(_carpeta_sm9))
        _n9 = _hist9.get('total', 0) if _hist9 else 0
        resumen["modulos"]["comportamiento_historico"] = {
            "ok": True, "snapshots": _n9,
        }
    except Exception as e:
        log.warning(f"  ⚠ Módulo 9 falló: {e}")
        import traceback; log.warning(traceback.format_exc())
        resumen["modulos"]["comportamiento_historico"] = {"ok": False, "error": str(e)}

    # ── MÓDULO 10 · VALUACIÓN EN PESOS ───────────────────────────
    separador("MÓDULO 10 · VALUACIÓN EN PESOS")
    try:
        _val_path = Path(carpeta) / "comportamiento_historico.json"
        if _val_path.exists():
            with open(_val_path, encoding="utf-8") as _fv:
                _hist9_data = json.load(_fv)
            _snaps_hist9 = _hist9_data.get("snapshots", [])
            if _snaps_hist9:
                _val = actualizar_valuacion(carpeta, _snaps_hist9)
                resumen["modulos"]["valuacion"] = {
                    "ok": True, "periodos": len(_val.get("snapshots", []))
                }
            else:
                log.info("  ℹ comportamiento_historico.json sin snapshots — valuación omitida")
                resumen["modulos"]["valuacion"] = {"ok": True, "periodos": 0}
        else:
            log.info("  ℹ comportamiento_historico.json no encontrado — valuación omitida")
            resumen["modulos"]["valuacion"] = {"ok": True, "periodos": 0}
    except Exception as e:
        log.warning(f"  ⚠ Módulo 10 falló: {e}")
        import traceback; log.warning(traceback.format_exc())
        resumen["modulos"]["valuacion"] = {"ok": False, "error": str(e)}

    # ── STOCK DIARIO · RUNNING BALANCE ──────────────────────────
    # Recalcula el historial completo desde movimientos reales,
    # incorporando automáticamente cargas retroactivas de compras/ventas.
    separador("Stock Diario · Running Balance")
    try:
        _diario = recalcular_stock_diario_desde_movimientos(
            _regs_stock_hoy, _cols_stock_hoy,
            regs_ing,        cols_ing,
            regs_egr,        cols_egr,
            carpeta,         periodo,
            dias=90
        )
        resumen["modulos"]["stock_diario"] = {
            "ok":          True,
            "dias":        _diario["dias"],
            "ultima_fecha": datetime.now().strftime("%Y-%m-%d"),
            "metodo":      "running_balance",
        }
    except Exception as e:
        log.warning(f"  ⚠ Running balance diario falló: {e}")
        import traceback; log.warning(traceback.format_exc())
        resumen["modulos"]["stock_diario"] = {"ok": False, "error": str(e)}

    separador()
    guardar(resumen, carpeta, "ultima_actualizacion.json")

    # ── AUTO GIT PUSH ─────────────────────────────────────────
    separador("GIT · PUBLICAR EN GITHUB PAGES")
    _repo_txt = Path(__file__).parent / "repo_github_path.txt"
    _repo_path = _repo_txt.read_text(encoding="utf-8").strip() if _repo_txt.exists() else ""
    if not _repo_path:
        _repo_path = cfg.get("GITHUB", {}).get("repo_path", "")
    if _repo_path and Path(_repo_path).is_dir():
        import subprocess, datetime as _dt, shutil as _shutil
        try:
            _ts   = _dt.datetime.now().strftime("%a %d/%m/%Y %H:%M:%S")
            _repo = Path(_repo_path)

            # 1) Copiar JSONs de datos de OneDrive → repo
            #    Excluir archivos con credenciales o configuración sensible
            _EXCLUIR = {"lector-robot", "credential", "secret", "config", "key"}
            _copiados = 0
            for _json in Path(carpeta).glob("*.json"):
                _nombre_lower = _json.name.lower()
                if any(excl in _nombre_lower for excl in _EXCLUIR):
                    log.info(f"  ⚠ Omitido (sensible): {_json.name}")
                    continue
                _dst = _repo / _json.name
                _shutil.copy2(str(_json), str(_dst))
                _copiados += 1
            log.info(f"  ✓ {_copiados} JSON copiados a repo")

            # 2) Commit + push
            subprocess.run(["git", "-C", str(_repo), "add", "-A"],
                           check=True, capture_output=True)
            _res = subprocess.run(
                ["git", "-C", str(_repo), "commit", "-m",
                 f"Actualizacion automatica {_ts}"],
                capture_output=True, text=True
            )
            if "nothing to commit" in _res.stdout or "nothing to commit" in _res.stderr:
                log.info("  ℹ Git: sin cambios nuevos para publicar")
            else:
                log.info(f"  ✓ Git commit: Actualizacion automatica {_ts}")
                push = subprocess.run(
                    ["git", "-C", str(_repo), "push"],
                    capture_output=True, text=True, timeout=60
                )
                if push.returncode == 0:
                    log.info("  ✓ Git push OK → GitHub Pages actualizado")
                else:
                    log.warning(f"  ⚠ Git push falló: {push.stderr.strip()[:200]}")
        except Exception as _e:
            log.warning(f"  ⚠ Git error: {_e}")
            import traceback; log.warning(traceback.format_exc())
    else:
        log.info("  ℹ Git: repo_github_path.txt no configurado, se omite push")

    separador("FINALIZADO")
    log.info(f"  Archivos guardados en: {carpeta}")
    log.info("  OneDrive sincronizara automaticamente")
    separador()
    print()
    esperar_si_interactivo("  Presiona Enter para cerrar...")


# ══════════════════════════════════════════════════════════════
# MÓDULO 7 — MERCADO Y PRECIOS
# Fuentes:
#   - Hacienda: Mercado de Cañuelas (decampoacampo.com)
#   - Granos:   BCR Cámara Arbitral (cac.bcr.com.ar/es/precios-de-pizarra)
#   - Negocios: Google Sheets (CARGAS + COMPRAS)
# ══════════════════════════════════════════════════════════════

# ID de la planilla de negocios en Google Sheets
GSHEET_ID = "1_N1k3QkNQ8NMfs-uz_FHmpLd8afR067-EsoThkg0RWk"
# URL base para export CSV público (requiere que la hoja esté "Publicada en web")
GSHEET_CSV_BASE = f"https://docs.google.com/spreadsheets/d/{GSHEET_ID}/export?format=csv&sheet="


def _http_get(url, timeout=20):
    """Descarga URL como texto. Devuelve str o None."""
    import urllib.request
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/json,*/*",
                "Accept-Language": "es-AR,es;q=0.9",
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            # detectar encoding
            ct = resp.headers.get("Content-Type", "")
            enc = "utf-8"
            if "charset=" in ct:
                enc = ct.split("charset=")[-1].split(";")[0].strip()
            return raw.decode(enc, errors="replace")
    except Exception as e:
        log.debug(f"    _http_get({url[:60]}...): {e}")
        return None


def _parse_ar_num(s):
    """Convierte string numérico argentino/internacional a float."""
    s = str(s or "").strip().replace(" ", "").replace("$", "")
    if not s or s in ("-", "—", ""):
        return None
    if "," in s and "." in s:
        # "1.234,56" → 1234.56
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        # puede ser "1234,56" (decimal) o "1.234" (miles)
        partes = s.split(",")
        if len(partes) == 2 and len(partes[1]) <= 2:
            s = s.replace(",", ".")  # decimal: 1234,56
        else:
            s = s.replace(",", "")   # miles: 1,234
    elif "." in s:
        partes = s.split(".")
        if len(partes) == 2 and len(partes[1]) == 3:
            s = s.replace(".", "")  # miles: 1.234
    try:
        return float(s)
    except Exception:
        return None


# ──────────────────────────────────────────────────────────────
# 7_HIST. Histórico de precios — Excel en OneDrive
# ──────────────────────────────────────────────────────────────
def actualizar_historico_excel(hacienda, commodities, carpeta, today):
    """
    Agrega/actualiza una fila en historico_precios.xlsx con los precios del día.
    Si no llegaron precios de alguna columna, replica el último valor conocido (carry-forward).
    Requiere: pandas + openpyxl
    """
    try:
        import pandas as pd
        from pathlib import Path
    except ImportError:
        log.warning("  ⚠ pandas no disponible; se omite historico_precios.xlsx")
        return

    ARCHIVO = Path(carpeta) / "historico_precios.xlsx"

    # Mapeo: clave interna → nombre de columna Excel
    # IMPORTANTE: Las claves deben ser substrings exactos de los nombres de categoría
    # devueltos por la API de Cañuelas (plural: "Novillitos", "Novillos", "Vacas", etc.)
    # Ejemplo de respuesta API: "Novillitos hasta 390 Kg.", "Novillitos 391/430 Kg.", etc.
    COLS_HAC = [
        ("novillitos hasta",    "Novillito <390kg $/kg"),
        ("novillitos 391",      "Novillito 391/430kg $/kg"),
        ("novillos 431",        "Novillo 431/460kg $/kg"),
        ("novillos 461",        "Novillo 461/490kg $/kg"),
        ("vaquillona",          "Vaquillona <390kg $/kg"),
        ("vacas buenas",        "Vaca Buena $/kg"),
        ("vacas regulares",     "Vaca Regular $/kg"),
        ("vacas conserva",      "Vaca Conserva $/kg"),
        ("ternero",             "Ternero $/kg"),
        ("ternera",             "Ternera $/kg"),
    ]
    COLS_COM = [
        ("maíz",   "Maíz $/tn"),   # usar tilde para que coincida con nombre="Maíz"
        ("soja",   "Soja $/tn"),
        ("trigo",  "Trigo $/tn"),
        ("sorgo",  "Sorgo $/tn"),
    ]

    # Construir dict de precios de hacienda de hoy
    def _hac_precio(key_lower):
        for h in hacienda:
            if key_lower in h.get("categoria", "").lower():
                p = h.get("precio", 0)
                if p and p > 500:
                    return p
        return None

    def _com_precio(key_lower):
        for c in commodities:
            if key_lower in c.get("nombre", "").lower():
                p = c.get("precio", 0)
                if p and p > 1000:
                    return p
        return None

    # Leer Excel existente o crear DataFrame vacío
    todas_cols = ["Fecha"] + [c for _, c in COLS_HAC] + [c for _, c in COLS_COM]
    if ARCHIVO.exists():
        try:
            df = pd.read_excel(ARCHIVO, sheet_name="Historico", dtype={"Fecha": str})
            # Asegurar que todas las columnas existen
            for col in todas_cols:
                if col not in df.columns:
                    df[col] = None
        except Exception as e:
            log.warning(f"  ⚠ No se pudo leer {ARCHIVO.name}: {e}. Se crea nuevo.")
            df = pd.DataFrame(columns=todas_cols)
    else:
        df = pd.DataFrame(columns=todas_cols)

    # Obtener última fila como valores de carry-forward
    if len(df) > 0:
        last = df.iloc[-1].to_dict()
    else:
        last = {}

    # Armar la fila de hoy
    fila = {"Fecha": today}
    for key, col in COLS_HAC:
        p = _hac_precio(key)
        if p:
            fila[col] = p
        else:
            # Carry-forward: usar el último valor conocido
            fila[col] = last.get(col, None)

    for key, col in COLS_COM:
        p = _com_precio(key)
        if p:
            fila[col] = p
        else:
            fila[col] = last.get(col, None)

    # Si hoy ya existe, reemplazar; si no, agregar
    if "Fecha" in df.columns and today in df["Fecha"].values:
        df.loc[df["Fecha"] == today, list(fila.keys())] = list(fila.values())
        log.info(f"  ✓ historico_precios.xlsx — fila {today} actualizada")
    else:
        df = pd.concat([df, pd.DataFrame([fila])], ignore_index=True)
        log.info(f"  ✓ historico_precios.xlsx — fila {today} agregada ({len(df)} días totales)")

    # Guardar con formato
    try:
        import openpyxl
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        with pd.ExcelWriter(ARCHIVO, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Historico", index=False)
            ws = writer.sheets["Historico"]

            # Estilo encabezado
            fill_hdr = PatternFill("solid", fgColor="1F4E79")
            font_hdr = Font(bold=True, color="FFFFFF", size=10)
            for cell in ws[1]:
                cell.fill = fill_hdr
                cell.font = font_hdr
                cell.alignment = Alignment(horizontal="center", wrap_text=True)

            # Freeze primera fila
            ws.freeze_panes = "A2"

            # Ancho automático
            for col_idx, col_name in enumerate(todas_cols, start=1):
                max_len = max(len(str(col_name)), 10)
                ws.column_dimensions[get_column_letter(col_idx)].width = max_len * 1.2

            # Filas alternadas
            fill_par  = PatternFill("solid", fgColor="EBF3FB")
            fill_impar = PatternFill("solid", fgColor="FFFFFF")
            for row_idx in range(2, ws.max_row + 1):
                fill = fill_par if row_idx % 2 == 0 else fill_impar
                for cell in ws[row_idx]:
                    cell.fill = fill
                    cell.alignment = Alignment(horizontal="center")

        log.info(f"  ✓ historico_precios.xlsx guardado en {ARCHIVO.parent}")
    except ImportError:
        # openpyxl no disponible, guardar sin formato
        df.to_excel(ARCHIVO, sheet_name="Historico", index=False)
        log.info(f"  ✓ historico_precios.xlsx guardado (sin formato — instalar openpyxl)")
    except Exception as e:
        log.warning(f"  ⚠ Error guardando historico_precios.xlsx: {e}")


# ──────────────────────────────────────────────────────────────
# 7a. Hacienda — Mercado de Cañuelas via deCampoaCampo
# ──────────────────────────────────────────────────────────────
def scrape_canuelas():
    """Devuelve lista de {categoria, precio, variacion, unidad} o [].
    Usa la API JSON interna de deCampoaCampo:
      GET /gh_funciones.php?function=getListadoPreciosGordo
    Respuesta: {"hoy":"25/03/2026", "data":[
      {"categoria":"Novillitos hasta 390 Kg.",
       "precio_semana_1": 5204,
       "variacion_precio_semana_1": -113, ...}, ...]}
    """
    # ── 1) API JSON (fuente primaria) ────────────────────────────
    url_api = "https://www.decampoacampo.com/gh_funciones.php?function=getListadoPreciosGordo"
    text = _http_get(url_api)
    if text:
        try:
            data = json.loads(text)
            items = data.get("data", [])
            hacienda = []
            for item in items:
                cat = str(item.get("categoria", "")).strip()
                precio = item.get("precio_semana_1") or item.get("precio_semana_2") or 0
                var    = item.get("variacion_precio_semana_1") or 0
                if cat and precio and 500 < float(precio) < 30000:
                    hacienda.append({
                        "categoria": cat,
                        "precio":    round(float(precio), 2),
                        "variacion": round(float(var or 0), 2),
                        "unidad":    "$/kg + IVA"
                    })
            if hacienda:
                log.info(f"  ✓ Cañuelas API: {len(hacienda)} categorías — "
                         + " | ".join(f"{h['categoria']} ${h['precio']:,.0f}" for h in hacienda))
                return hacienda
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            log.debug(f"    Cañuelas API JSON error: {e}")

    # ── 2) Fallback: HTML renderizado de la página outside ───────
    import re
    url_html = "https://www.decampoacampo.com/__dcac/outside/canuelas/precios"
    text = _http_get(url_html)
    if not text:
        log.info("  ℹ Cañuelas: sin respuesta de red")
        return []

    hacienda = []
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', text, re.DOTALL | re.IGNORECASE)
    for row in rows:
        cat_m = re.search(
            r'class=["\']td_precios["\'][^>]*>.*?<h3[^>]*>(.*?)</h3>',
            row, re.DOTALL | re.IGNORECASE
        )
        if not cat_m:
            continue
        categoria = re.sub(r'<[^>]+>', '', cat_m.group(1)).strip()
        if not categoria:
            continue
        precio_m = re.search(
            r'<span[^>]*class=["\']h4["\'][^>]*>([\d.,]+)</span>',
            row, re.IGNORECASE
        )
        if not precio_m:
            continue
        precio = _parse_ar_num(precio_m.group(1))
        if not precio or not (500 < precio < 30000):
            continue
        var_m = re.search(
            r'<span[^>]*class=["\']h4["\'][^>]*>[\d.,]+</span>.*?\(([+-]?[\d.,]+)\)',
            row, re.DOTALL | re.IGNORECASE
        )
        variacion = _parse_ar_num(var_m.group(1)) if var_m else 0
        hacienda.append({
            "categoria": categoria,
            "precio":    round(precio, 2),
            "variacion": round(variacion or 0, 2),
            "unidad":    "$/kg + IVA"
        })

    if hacienda:
        log.info(f"  ✓ Cañuelas HTML: {len(hacienda)} categorías extraídas")
    else:
        log.info("  ℹ Cañuelas: sin precios en respuesta")
    return hacienda


# ──────────────────────────────────────────────────────────────
# 7b. Granos — BCR Cámara Arbitral Precios de Pizarra
# ──────────────────────────────────────────────────────────────
def scrape_bcr_pizarra():
    """Devuelve {maiz, soja, trigo, sorgo} en $/tn o {} si falla."""
    import re
    url = "https://www.cac.bcr.com.ar/es/precios-de-pizarra"
    text = _http_get(url)
    if not text:
        return {}

    granos = {}
    GRANOS_BUSCAR = {
        "maiz":  ["maíz", "maiz", "corn"],
        "soja":  ["soja", "soybean"],
        "trigo": ["trigo", "wheat"],
        "sorgo": ["sorgo", "sorghum"],
    }

    # Intentar parsear tablas HTML
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', text, re.DOTALL | re.IGNORECASE)
    for row in rows:
        cells_raw = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL | re.IGNORECASE)
        cells = [re.sub(r'<[^>]+>', '', c).strip().lower() for c in cells_raw]
        if not cells:
            continue
        row_text = " ".join(cells)
        for grano_key, aliases in GRANOS_BUSCAR.items():
            if grano_key in granos:
                continue
            if any(alias in row_text for alias in aliases):
                # Buscar precio en celdas (número mayor a 10000 = $/tn en pesos)
                for cell in cells[1:]:
                    p = _parse_ar_num(cell)
                    if p and 10000 < p < 2000000:
                        granos[grano_key] = round(p)
                        break

    # Fallback: búsqueda libre en texto
    text_lower = text.lower()
    for grano_key, aliases in GRANOS_BUSCAR.items():
        if grano_key in granos:
            continue
        for alias in aliases:
            pattern = re.compile(
                re.escape(alias) + r'[^0-9<]{0,60}?(\d[\d.,]{4,10})',
                re.IGNORECASE
            )
            m = pattern.search(text_lower)
            if m:
                p = _parse_ar_num(m.group(1))
                if p and 10000 < p < 2000000:
                    granos[grano_key] = round(p)
                    break

    if granos:
        for g, p in granos.items():
            log.info(f"  ✓ BCR {g}: ${p:,}/tn")
    else:
        log.info("  ℹ BCR: sin precios extraídos")
    return granos


# ──────────────────────────────────────────────────────────────
# 7c. Negocios — Google Sheets con Service Account
# ──────────────────────────────────────────────────────────────

# Ruta al archivo de credenciales de la Service Account
# (relativa al script; también puede ser ruta absoluta)
GSHEET_CREDENTIALS_FILE = Path(__file__).parent / "lector-robot-credentials.json"


def _leer_hoja_api(sheet_id, nombre_hoja, creds_file):
    """Lee una hoja usando Google Sheets API con Service Account.
    Devuelve lista de dicts (una fila = un dict) o None si falla."""
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build

        scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
        creds  = Credentials.from_service_account_file(str(creds_file), scopes=scopes)
        service = build("sheets", "v4", credentials=creds, cache_discovery=False)
        result  = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=nombre_hoja
        ).execute()
        values = result.get("values", [])
        if not values or len(values) < 2:
            return []
        headers = [str(h).strip().lower().replace(" ", "_") for h in values[0]]
        rows = []
        for row in values[1:]:
            # Rellenar celdas vacías al final de la fila
            row_padded = row + [""] * (len(headers) - len(row))
            reg = {headers[i]: str(row_padded[i]).strip() for i in range(len(headers))
                   if str(row_padded[i]).strip()}
            if reg:
                rows.append(reg)
        return rows
    except ImportError:
        return None  # Librería no instalada
    except Exception as e:
        log.debug(f"    Google API error ({nombre_hoja}): {e}")
        return None


def leer_negocios_gsheet():
    """Lee hojas CARGAS y COMPRAS usando Service Account.
    Devuelve dict con listas de registros."""
    import csv, io

    resultado = {"ventas": [], "compras": [], "error": None}

    # ── Intentar con Service Account (API) ─────────────────────
    if GSHEET_CREDENTIALS_FILE.exists():
        log.info(f"  → Usando credenciales: {GSHEET_CREDENTIALS_FILE.name}")
        for hoja, clave in [("CARGAS", "ventas"), ("COMPRAS", "compras")]:
            rows = _leer_hoja_api(GSHEET_ID, hoja, GSHEET_CREDENTIALS_FILE)
            if rows is None:
                # Librería no instalada
                resultado["error"] = (
                    "Instalar librerías: pip install google-auth google-api-python-client"
                )
                log.warning("  ⚠ Librerías de Google no instaladas. Ejecutar: "
                            "pip install google-auth google-api-python-client")
                break
            resultado[clave] = rows
            log.info(f"  ✓ Google Sheets API '{hoja}': {len(rows)} registros")
        return resultado

    # ── Fallback: CSV público (si la hoja fue publicada) ────────
    log.info("  ℹ Credenciales no encontradas, intentando CSV público...")
    for hoja, clave in [("CARGAS", "ventas"), ("COMPRAS", "compras")]:
        url = GSHEET_CSV_BASE + hoja
        text = _http_get(url, timeout=25)
        if not text:
            log.info(f"  ℹ Google Sheets hoja '{hoja}': no accesible")
            resultado["error"] = (
                "Colocar lector-robot-credentials.json en la carpeta de datos, "
                "o publicar la hoja en web como CSV"
            )
            continue

        try:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            if not rows:
                log.info(f"  ℹ Google Sheets hoja '{hoja}': vacía")
                continue
            registros = []
            for row in rows:
                reg = {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items() if v.strip()}
                if reg:
                    registros.append(reg)
            resultado[clave] = registros
            log.info(f"  ✓ Google Sheets CSV '{hoja}': {len(registros)} registros")
        except Exception as e:
            log.warning(f"  ⚠ Error procesando '{hoja}': {e}")

    return resultado


def procesar_negocios(negocios_raw):
    """Procesa los registros crudos de CARGAS y COMPRAS.
    Busca columnas estándar: fecha, categoria, kg_cab, precio_kg,
    precio_carne, kg_total, frigorífico, etc.
    Devuelve resumen agrupado por categoría y frigorífico."""
    import re

    def buscar_col(row, *candidatos):
        """Busca la primera columna que coincida con algún candidato."""
        for cand in candidatos:
            for k, v in row.items():
                if cand in k.lower() and v:
                    return v
        return ""

    ventas_proc  = []
    compras_proc = []

    for r in negocios_raw.get("ventas", []):
        try:
            fecha    = buscar_col(r, "fecha")
            cat      = buscar_col(r, "categ", "categoria", "tipo")
            kg_cab   = _parse_ar_num(buscar_col(r, "kg_cab", "kg/cab", "peso", "kg_prom")) or 0
            # Fallback: columna con nombre exactamente "kg" (no capturada por buscar_col)
            if not kg_cab:
                for _k, _v in r.items():
                    if _k.strip().lower() == 'kg' and _v:
                        kg_cab = _parse_ar_num(_v) or 0
                        break
            precio   = _parse_ar_num(buscar_col(r, "precio_kg", "precio/kg", "precio_c",
                                                "precio_carne", "precio")) or 0
            precio_p = _parse_ar_num(buscar_col(r, "precio_pie", "precio_vivo", "$/pie")) or 0
            rinde    = _parse_ar_num(buscar_col(r, "rinde", "rendimiento", "rto")) or 0
            frigo    = buscar_col(r, "frigorifico", "frigorífico", "destino", "comprador")
            cabezas  = _parse_ar_num(buscar_col(r, "cabezas", "cantidad", "cab")) or 1

            if fecha or precio or kg_cab:
                ventas_proc.append({
                    "fecha":     fecha,
                    "categoria": cat,
                    "kg_cab":    round(kg_cab, 1) if kg_cab else 0,
                    "precio_carne": round(precio, 2) if precio else 0,
                    "precio_pie":   round(precio_p, 2) if precio_p else 0,
                    "rinde":     round(rinde, 3) if rinde else 0,
                    "frigorífico": frigo,
                    "cabezas":   int(cabezas),
                })
        except Exception:
            pass

    for r in negocios_raw.get("compras", []):
        try:
            fecha    = buscar_col(r, "fecha")
            cat      = buscar_col(r, "categ", "categoria", "tipo")
            kg_cab   = _parse_ar_num(buscar_col(r, "kg_cab", "kg/cab", "peso", "kg_prom")) or 0
            # Fallback: columna con nombre exactamente "kg" (no capturada por buscar_col)
            if not kg_cab:
                for _k, _v in r.items():
                    if _k.strip().lower() == 'kg' and _v:
                        kg_cab = _parse_ar_num(_v) or 0
                        break
            precio   = _parse_ar_num(buscar_col(r, "precio_kg", "precio/kg", "precio_c", "precio")) or 0
            cabezas  = _parse_ar_num(buscar_col(r, "cabezas", "cantidad", "cab")) or 1
            origen   = buscar_col(r, "origen", "vendedor", "proveedor", "campo")

            if fecha or precio or kg_cab:
                compras_proc.append({
                    "fecha":     fecha,
                    "categoria": cat,
                    "kg_cab":    round(kg_cab, 1) if kg_cab else 0,
                    "precio_kg": round(precio, 2) if precio else 0,
                    "cabezas":   int(cabezas),
                    "origen":    origen,
                })
        except Exception:
            pass

    # Resumen por categoría
    resumen_cat = {}
    for v in ventas_proc:
        cat = v["categoria"] or "Sin categoría"
        if cat not in resumen_cat:
            resumen_cat[cat] = {"ventas": 0, "cabezas": 0, "precio_prom": [], "rinde_prom": []}
        resumen_cat[cat]["ventas"]  += 1
        resumen_cat[cat]["cabezas"] += v["cabezas"]
        if v["precio_carne"]: resumen_cat[cat]["precio_prom"].append(v["precio_carne"])
        if v["rinde"]:        resumen_cat[cat]["rinde_prom"].append(v["rinde"])

    for k, v in resumen_cat.items():
        pp = v["precio_prom"]
        rp = v["rinde_prom"]
        v["precio_promedio"] = round(sum(pp)/len(pp), 2) if pp else 0
        v["rinde_promedio"]  = round(sum(rp)/len(rp), 4) if rp else 0
        del v["precio_prom"], v["rinde_prom"]

    # Resumen por frigorífico
    resumen_frigo = {}
    for v in ventas_proc:
        frig = v["frigorífico"] or "Desconocido"
        if frig not in resumen_frigo:
            resumen_frigo[frig] = {"ventas": 0, "cabezas": 0, "precio_prom": []}
        resumen_frigo[frig]["ventas"]  += 1
        resumen_frigo[frig]["cabezas"] += v["cabezas"]
        if v["precio_carne"]: resumen_frigo[frig]["precio_prom"].append(v["precio_carne"])

    for k, v in resumen_frigo.items():
        pp = v["precio_prom"]
        v["precio_promedio"] = round(sum(pp)/len(pp), 2) if pp else 0
        del v["precio_prom"]

    return {
        "ventas":        ventas_proc,
        "compras":       compras_proc,
        "resumen_cat":   resumen_cat,
        "resumen_frigo": resumen_frigo,
        "total_ventas":  len(ventas_proc),
        "total_compras": len(compras_proc),
    }


# ──────────────────────────────────────────────────────────────
# Función principal del módulo
# ──────────────────────────────────────────────────────────────
def actualizar_mercado_precios(carpeta, repo):
    """Actualiza mercado_precios.json y negocios_resumen.json."""
    from datetime import date
    today = date.today().isoformat()
    log.info(f"  Fecha: {today}")

    # ── 1. Cargar JSON existente ────────────────────────────────
    repo_json = Path(repo) / "mercado_precios.json" if repo else None
    existing = {}
    if repo_json and repo_json.exists():
        try:
            with open(repo_json, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass
    elif (Path(carpeta) / "mercado_precios.json").exists():
        try:
            with open(Path(carpeta) / "mercado_precios.json", "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass

    historico      = existing.get("historico", [])
    insumos_ant    = existing.get("insumos", {})
    comt_ant       = existing.get("commodities", [])

    def _prev_com(nombre, default):
        for c in comt_ant:
            if c.get("nombre","").lower() == nombre.lower():
                return c.get("precio", default)
        return default

    # ── 2. Hacienda — Cañuelas ──────────────────────────────────
    log.info("  → Scraping Mercado de Cañuelas...")
    hacienda = scrape_canuelas()
    if not hacienda:
        hacienda = existing.get("hacienda", [
            {"categoria": "Novillo especial", "precio": 0, "variacion": 0, "unidad": "$/kg en pie"},
            {"categoria": "Novillo",          "precio": 0, "variacion": 0, "unidad": "$/kg en pie"},
            {"categoria": "Vaca",             "precio": 0, "variacion": 0, "unidad": "$/kg en pie"},
            {"categoria": "Vaquillona",       "precio": 0, "variacion": 0, "unidad": "$/kg en pie"},
            {"categoria": "Ternero",          "precio": 0, "variacion": 0, "unidad": "$/kg en pie"},
            {"categoria": "Ternera",          "precio": 0, "variacion": 0, "unidad": "$/kg en pie"},
            {"categoria": "Novillito",        "precio": 0, "variacion": 0, "unidad": "$/kg en pie"},
        ])
        log.info("  ℹ Usando precios anteriores de hacienda")

    # ── 3. Granos — BCR Pizarra ─────────────────────────────────
    log.info("  → Scraping BCR Precios de Pizarra...")
    granos = scrape_bcr_pizarra()
    precio_maiz  = granos.get("maiz",  insumos_ant.get("maiz",  243150))
    precio_soja  = granos.get("soja",  _prev_com("Soja",  390000))
    precio_trigo = granos.get("trigo", _prev_com("Trigo", 230000))
    precio_sorgo = granos.get("sorgo", _prev_com("Sorgo", 180000))

    if not granos:
        log.info("  ℹ Usando precios anteriores de granos")

    # ── 4. Insumos (maíz como ancla, resto relaciones del Excel) ─
    REL = {"gluten": 0.5385, "germen": 1.2227, "nucleo": 1.9342, "hominy": 0.8413}
    insumos = {
        "maiz":       precio_maiz,
        "gluten":     round(precio_maiz * REL["gluten"]),
        "nucleo":     round(precio_maiz * REL["nucleo"]),
        "germen":     round(precio_maiz * REL["germen"]),
        "hominy":     round(precio_maiz * REL["hominy"]),
        "silo":       insumos_ant.get("silo",       155482),
        "rollo":      insumos_ant.get("rollo",      25000),
        "hoteleria":  insumos_ant.get("hoteleria",  310),
        "sanidad":    insumos_ant.get("sanidad",    7500),
        "flete_12tn": insumos_ant.get("flete_12tn", 2750),
        "guias":      insumos_ant.get("guias",      1725),
        "dolar":      insumos_ant.get("dolar",      1400),
    }

    commodities = [
        {"nombre": "Maíz",  "precio": precio_maiz,  "unidad": "$/tn", "fuente": "BCR Pizarra"},
        {"nombre": "Soja",  "precio": precio_soja,  "unidad": "$/tn", "fuente": "BCR Pizarra"},
        {"nombre": "Trigo", "precio": precio_trigo, "unidad": "$/tn", "fuente": "BCR Pizarra"},
        {"nombre": "Sorgo", "precio": precio_sorgo, "unidad": "$/tn", "fuente": "BCR Pizarra"},
    ]

    # ── 5. Negocios — Google Sheets ─────────────────────────────
    log.info("  → Leyendo Google Sheets (negocios)...")
    negocios_raw = leer_negocios_gsheet()
    negocios     = procesar_negocios(negocios_raw)
    log.info(f"  ✓ Negocios: {negocios['total_ventas']} ventas · {negocios['total_compras']} compras procesadas")

    # ── 6. Histórico diario ─────────────────────────────────────
    nov_precio = next((h["precio"] for h in hacienda
                       if "novillo" in h["categoria"].lower()
                       and "especial" not in h["categoria"].lower()), 0)
    ter_precio = next((h["precio"] for h in hacienda
                       if "ternero" in h["categoria"].lower()), 0)

    def _hprice(*substrings):
        """Primer precio de hacienda cuya categoría contiene todos los substrings (case-insensitive)."""
        for h in hacienda:
            cat = h.get("categoria", "").lower()
            if all(s in cat for s in substrings):
                return h.get("precio", 0) or 0
        return 0

    hoy = {
        "fecha":        today,
        "nov_390":      _hprice("novillito", "390"),
        "nov_430":      _hprice("novillito", "430"),
        "nov_460":      _hprice("460"),
        "nov_490":      _hprice("490"),
        "vaq_390":      _hprice("vaquillon"),
        "vac_buena":    _hprice("buena"),
        "vac_regular":  _hprice("regular"),
        "vac_conserva": _hprice("conserva"),
        "ternero":      ter_precio,
        "maiz":         precio_maiz,
        "soja":         precio_soja,
        "novillo":      nov_precio,
    }
    historico = [h for h in historico if h.get("fecha") != today]
    historico.append(hoy)
    historico = sorted(historico, key=lambda x: x.get("fecha", ""))[-365:]

    # ── 7. Histórico Excel en OneDrive ──────────────────────────
    log.info("  → Actualizando historico_precios.xlsx...")
    actualizar_historico_excel(hacienda, commodities, carpeta, today)

    # ── 8. Armar y guardar JSONs ────────────────────────────────
    mercado_json = {
        "fecha":       today,
        "fuente":      "Cañuelas · BCR Cámara Arbitral",
        "hacienda":    hacienda,
        "commodities": commodities,
        "insumos":     insumos,
        "historico":   historico,
    }

    negocios_json = {
        "fecha":          today,
        "sheet_id":       GSHEET_ID,
        "total_ventas":   negocios["total_ventas"],
        "total_compras":  negocios["total_compras"],
        "resumen_cat":    negocios["resumen_cat"],
        "resumen_frigo":  negocios["resumen_frigo"],
        "ventas":         negocios["ventas"],
        "compras":        negocios["compras"],
        "error":          negocios_raw.get("error"),
    }

    # Guardar en repo GitHub Pages
    for fname, data in [("mercado_precios.json", mercado_json),
                        ("negocios_resumen.json", negocios_json)]:
        if repo_json:
            dest = Path(repo) / fname
            try:
                with open(dest, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                log.info(f"  ✓ {fname} → repo ({dest})")
            except Exception as e:
                log.warning(f"  ⚠ No se pudo guardar {fname} en repo: {e}")

        guardar(data, carpeta, fname)
        log.info(f"  ✓ {fname} → OneDrive")


# ══════════════════════════════════════════════════════════════
#  MÓDULO 9 — COMPORTAMIENTO HISTÓRICO MENSUAL
#  Combina: Masa de kg (Listado Caravanas XLS), Stock Insumos,
#           y Financiero mensual (formato viejo + nuevo)
# ══════════════════════════════════════════════════════════════

def actualizar_stock_insumos_excel(insumos_list, carpeta_stock_mensuales, today_str):
    """
    Añade columna de hoy al archivo STOCK DE INSUMOS.xlsx.
    Inserta la nueva columna en la posición 5 (después de 'Descripción Insumo').
    Si la columna de hoy ya existe, sobreescribe los valores.
    insumos_list: lista de {"nombre": str, "stock_kg": float}
    """
    try:
        import openpyxl
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from pathlib import Path
        from datetime import datetime as _dt

        ruta = Path(carpeta_stock_mensuales) / "STOCK DE INSUMOS.xlsx"
        if not ruta.exists():
            log.warning(f"  ⚠ No existe {ruta}")
            return

        wb = openpyxl.load_workbook(str(ruta))
        ws = wb.active

        # Construir dict {nombre_lower → stock_kg} desde insumos_list
        stock_dict = {i['nombre'].lower().strip(): i['stock_kg'] for i in insumos_list}

        # Función de coincidencia: substring bidireccional
        def match_stock(desc_excel):
            desc_lower = str(desc_excel or '').lower().strip()
            for k, v in stock_dict.items():
                if k in desc_lower or desc_lower in k:
                    return v
            return None

        INSERT_COL = 5  # columna E (después de A=Depos, B=Rubro, C=Cod, D=Descripción)

        # Verificar si la columna de hoy ya existe
        today_col_idx = None
        for c in range(INSERT_COL, ws.max_column + 1):
            h = ws.cell(1, c).value
            if h is None:
                continue
            if hasattr(h, 'strftime'):
                h_str = h.strftime('%Y-%m-%d')
            else:
                h_str = str(h)[:10]
            if h_str == today_str:
                today_col_idx = c
                break

        if today_col_idx is None:
            # Insertar nueva columna en posición 5
            ws.insert_cols(INSERT_COL)
            today_col_idx = INSERT_COL
            # Header: fecha como datetime para que Excel la reconozca
            try:
                hdr_date = _dt.strptime(today_str, '%Y-%m-%d')
            except Exception:
                hdr_date = today_str
            hdr_cell = ws.cell(1, today_col_idx)
            hdr_cell.value = hdr_date
            hdr_cell.number_format = 'DD/MM/YYYY'
            hdr_cell.fill = PatternFill("solid", fgColor="1F4E79")
            hdr_cell.font = Font(bold=True, color="FFFFFF", size=9)
            hdr_cell.alignment = Alignment(horizontal="center")
            log.info(f"  ✓ STOCK DE INSUMOS.xlsx — insertada columna {today_str} (col {today_col_idx})")
        else:
            log.info(f"  ℹ STOCK DE INSUMOS.xlsx — columna {today_str} ya existe, actualizando valores")

        # Rellenar valores para cada fila de insumo
        filled = 0
        for row in range(2, ws.max_row + 1):
            desc = ws.cell(row, 4).value  # columna D = Descripción Insumo
            if desc is None:
                continue
            valor = match_stock(str(desc))
            if valor is not None:
                cell = ws.cell(row, today_col_idx)
                cell.value = round(valor, 2)
                cell.number_format = '#,##0.00'
                cell.alignment = Alignment(horizontal="center")
                filled += 1

        wb.save(str(ruta))
        log.info(f"  ✓ STOCK DE INSUMOS.xlsx — {filled} insumos actualizados para {today_str}")
    except ImportError:
        log.warning("  ⚠ openpyxl no disponible; se omite actualización de STOCK DE INSUMOS.xlsx")
    except Exception as e:
        log.warning(f"  ⚠ Error actualizando STOCK DE INSUMOS.xlsx: {e}")
        import traceback; log.warning(traceback.format_exc())


def _parse_listado_caravanas_html(ruta):
    """
    Parsea un Listado_Caravanas*.XLS (archivo HTML disfrazado de XLS).
    Extrae fecha del nombre del archivo, mapea Corral → Campo,
    usa 'Peso Proyectado' directamente para la masa de kg.
    Returns: dict {fecha, total_cabezas, total_kg, pegsa, por_hotelero}
    o None si falla.
    """
    import re as _re
    from pathlib import Path

    ruta = Path(ruta)
    nombre = ruta.name  # Listado_Caravanas28-02-2026.XLS

    # Extraer fecha del nombre (DD-MM-YYYY)
    m = _re.search(r'(\d{2})-(\d{2})-(\d{4})', nombre)
    if m:
        d, mo, y = m.groups()
        fecha_str = f"{y}-{mo}-{d}"
    else:
        log.warning(f"  ⚠ No se pudo extraer fecha de {nombre}")
        return None

    try:
        # Leer como HTML — parser nativo de Python, sin dependencias externas
        from html.parser import HTMLParser as _HTMLParser

        class _TblParser(_HTMLParser):
            def __init__(self):
                super().__init__()
                self.rows, self._row, self._cell, self._in = [], [], [], False
            def handle_starttag(self, tag, attrs):
                if tag in ('td','th'): self._in=True; self._cell=[]
                elif tag=='tr': self._row=[]
            def handle_endtag(self, tag):
                if tag in ('td','th'):
                    self._row.append(''.join(self._cell).strip()); self._in=False
                elif tag=='tr':
                    if self._row: self.rows.append(self._row)
            def handle_data(self, data):
                if self._in: self._cell.append(data)

        # detectar encoding
        raw = ruta.read_bytes()
        for _enc in ('utf-8','latin-1','cp1252'):
            try: html_txt = raw.decode(_enc); break
            except: pass
        else: html_txt = raw.decode('utf-8', errors='replace')

        p = _TblParser(); p.feed(html_txt)
        if not p.rows or len(p.rows) < 2:
            log.warning(f"  ⚠ {nombre}: sin tablas HTML"); return None

        # primera fila = encabezados
        headers = p.rows[0]
        data_rows = p.rows[1:]
        # asegurar longitud uniforme
        ncols = len(headers)
        data_rows = [r + ['']*(ncols-len(r)) if len(r)<ncols else r[:ncols] for r in data_rows]
        df = pd.DataFrame(data_rows, columns=headers)

        # convertir números (formato argentino: punto=miles, coma=decimal)
        def _to_num(v):
            try:
                v2 = str(v).replace('.','').replace(',','.')
                return float(v2)
            except: return v
        for col in df.columns:
            df[col] = df[col].apply(lambda v: _to_num(v) if str(v).replace('.','').replace(',','').replace('-','').strip().isdigit() or (str(v).count(',')<=1 and str(v).replace('.','').replace(',','').replace('-','').strip().replace(' ','').isdigit()) else v)

    except Exception as e:
        log.warning(f"  ⚠ {nombre}: error leyendo HTML: {e}")
        return None

    # Normalizar columnas
    df.columns = [str(c).strip() for c in df.columns]

    # Buscar columnas relevantes (tolerante a variaciones)
    def _find(keywords):
        kw_lower = [k.lower() for k in keywords]
        for col in df.columns:
            cl = col.lower()
            if any(k in cl for k in kw_lower):
                return col
        return None

    col_corral   = _find(['corral'])
    col_hotelero = _find(['hotelero'])
    col_peso_p   = _find(['peso proyectado', 'proyectado'])
    col_categoria= _find(['categor'])

    if col_corral is None or col_hotelero is None or col_peso_p is None:
        log.warning(f"  ⚠ {nombre}: columnas requeridas no encontradas. Cols: {list(df.columns)}")
        return None

    # Normalizar datos
    df['_corral_n'] = pd.to_numeric(df[col_corral], errors='coerce')
    df['_peso']     = pd.to_numeric(df[col_peso_p],  errors='coerce').fillna(0)
    df['_hotelero'] = df[col_hotelero].astype(str).str.strip().str.upper()

    # Mapear corral → campo usando tabla CORRALES global
    def _get_campo(nro):
        try:
            n = int(nro)
        except (TypeError, ValueError):
            return "Desconocido"
        for lo, hi, nom in CORRALES:
            if lo <= n <= hi:
                return nom
        return "Otro"

    df['_campo'] = df['_corral_n'].apply(_get_campo)

    # Total general
    total_cab = len(df)
    total_kg  = round(df['_peso'].sum(), 0)

    # Por hotelero
    por_hotelero = {}
    for hot, grp in df.groupby('_hotelero'):
        if not hot or hot in ('NAN', 'NONE', ''):
            continue
        por_hotelero[hot] = {
            'cabezas':       int(len(grp)),
            'kg_proyectado': round(float(grp['_peso'].sum()), 0),
        }

    # PEGSA solamente
    df_peg = df[df['_hotelero'] == 'PEGSA']
    peg_cab = int(len(df_peg))
    peg_kg  = round(float(df_peg['_peso'].sum()), 0)

    por_campo_pegsa = {}
    for campo, grp in df_peg.groupby('_campo'):
        por_campo_pegsa[campo] = {
            'cabezas':       int(len(grp)),
            'kg_proyectado': round(float(grp['_peso'].sum()), 0),
        }

    log.info(f"  ✓ {nombre} — total {total_cab:,} cab / {total_kg:,.0f} kg | "
             f"PEGSA {peg_cab:,} cab / {peg_kg:,.0f} kg")

    return {
        'fecha':          fecha_str,
        'archivo':        nombre,
        'total_cabezas':  total_cab,
        'total_kg':       float(total_kg),
        'por_hotelero':   por_hotelero,
        'pegsa': {
            'cabezas':       peg_cab,
            'kg_proyectado': float(peg_kg),
            'por_campo':     por_campo_pegsa,
        },
    }


def _parse_financiero_viejo(df, fecha_str):
    """
    Parsea financiero en FORMATO VIEJO (hoja única, layout semanal).
    Columnas: col0=Label, col1=Referencia/Monto, col2=Sub-label, col3=Semana0, col4=Semana1...
    Returns dict estandarizado con los campos financieros clave.
    """
    def _sf(v):
        try:
            f = float(v)
            import math
            return f if not math.isnan(f) else None
        except Exception:
            return None

    # ── disponible: "saldo disponibilidades" → col3 ──
    disponible = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if 'saldo disponibilidades' in label:
            disponible = _sf(row.iloc[3]) or 0.0
            break

    # ── cheques en cartera corrientes: rows entre "cheq cartera ctes" y "compra dolares" → col1 ──
    cheq_ctes = 0.0
    in_ctes = False
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if 'cheq cartera ctes' in label:
            in_ctes = True
            continue
        if in_ctes:
            if 'compra dolares' in label or 'saldo disponibilidades' in label:
                break
            v = _sf(row.iloc[1]) if len(row) > 1 else None
            if v and v > 0:
                cheq_ctes += v

    # ── cheques en cartera diferidos: "total disponib+chdif" → sum cols4+ positivos ──
    cheq_dif = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if 'total disponib' in label and 'chdif' in label:
            for c in range(4, len(row)):
                v = _sf(row.iloc[c])
                if v and v > 0:
                    cheq_dif += v
            break

    cheques_cartera = cheq_ctes + cheq_dif

    # ── cheques diferidos emitidos: "total cheques emitidos" → abs(sum cols4+) ──
    cheques_emitidos = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if 'total cheques emitidos' in label:
            for c in range(3, len(row)):
                v = _sf(row.iloc[c])
                if v and v < 0:
                    cheques_emitidos += abs(v)
            break

    # ── cobrar hacienda: "total vtos x ventas" o "vencimientos a cobrar" → sum cols3+ positivos ──
    cobrar_hacienda = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if 'total vtos x ventas' in label or 'vencimientos a cobrar' in label:
            for c in range(3, len(row)):
                v = _sf(row.iloc[c])
                if v and v > 0:
                    cobrar_hacienda += v
            break

    # ── pagar hacienda: "total vtos x compras" o "vencimientos a pagar" → abs(sum cols3+) ──
    pagar_hacienda = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if 'total vtos x compras' in label or 'vencimientos a pagar' in label:
            for c in range(3, len(row)):
                v = _sf(row.iloc[c])
                if v and v != 0:
                    pagar_hacienda += abs(v)
            break

    # ── dólares: primera "compra dolares" en sección disponibilidades → col1=qty, col3=ARS ──
    usd_cant = 0.0; usd_ars = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if 'compra dolares' in label:
            usd_cant = _sf(row.iloc[1]) or 0.0
            # ARS puede estar en col3 o ser 0 en archivos viejos
            usd_ars = _sf(row.iloc[3]) or 0.0
            break

    # ── LCG: fila con "lcg" en label → col2 (valor de referencia/activo) ──
    lcg = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if label.startswith('lcg') or ' lcg' in label:
            # El valor está en col2 (col0=label, col1=vacío, col2=monto)
            v = _sf(row.iloc[2]) if len(row) > 2 else None
            if v is None:
                v = _sf(row.iloc[1]) if len(row) > 1 else None
            lcg = abs(v or 0.0)
            if lcg > 0:
                break

    # ── Tercio Bravo: "terciobravo", "tercio bravo", "aporte tercio" → col2 ──
    tercio_bravo = 0.0
    for _, row in df.iterrows():
        label = str(row.iloc[0] if row.iloc[0] is not None else '').lower()
        if any(k in label for k in ['terciobravo', 'tercio bravo', 'aporte tercio', 'terciob']):
            v = _sf(row.iloc[2]) if len(row) > 2 else None
            if v is None:
                v = _sf(row.iloc[1]) if len(row) > 1 else None
            tercio_bravo = abs(v or 0.0)
            if tercio_bravo > 0:
                break

    return {
        'fecha':            fecha_str,
        'formato':          'viejo',
        'disponible':       round(disponible, 2),
        'cheques_cartera':  round(cheques_cartera, 2),
        'cheques_emitidos': round(cheques_emitidos, 2),
        'cobrar_hacienda':  round(cobrar_hacienda, 2),
        'pagar_hacienda':   round(pagar_hacienda, 2),
        'usd_cant':         round(usd_cant, 0),
        'usd_ars':          round(usd_ars, 2),
        'lcg':              round(lcg, 2),
        'tercio_bravo':     round(tercio_bravo, 2),
    }


def _parse_financiero_nuevo(sheets, fecha_str):
    """
    Parsea financiero en FORMATO NUEVO (multi-hoja: resumen, posicion hoy, etc.).
    Returns dict estandarizado con los campos financieros clave.
    """
    def _sf(v):
        try:
            f = float(v)
            import math
            return f if not math.isnan(f) else None
        except Exception:
            return None

    # ── posicion hoy ──
    ph = sheets.get('posicion hoy', pd.DataFrame())

    def gph(r, c):
        try:
            return _sf(ph.iloc[r, c])
        except Exception:
            return None

    # Row 22 = "saldo Disponibilidades" → col4 = SALDO FINAL
    saldo_disp = gph(22, 4) or 0.0
    # Row 25 = "COMPRA DOLARES" → col1=qty, col3=ARS
    usd_cant = gph(25, 1) or 0.0
    usd_ars  = gph(25, 3) or 0.0

    # ── resumen (LCG y Tercio Bravo) ──
    res = sheets.get('resumen', pd.DataFrame())

    def gres(r, c):
        try:
            return _sf(res.iloc[r, c])
        except Exception:
            return None

    # Row 1 = "LCG - aportes..." → col1; Row 2 = "aporte terciobravo" → col1
    lcg          = abs(gres(1, 1) or 0.0)
    tercio_bravo = abs(gres(2, 1) or 0.0)

    # ── cheques pendiente → cartera (checks to receive) ──
    cheq_raw      = sheets.get('cheques pendiente', pd.DataFrame())
    total_cartera = 0.0
    if len(cheq_raw) > 4:
        importe_col = pd.to_numeric(cheq_raw.iloc[4:, 5], errors='coerce').fillna(0)
        total_cartera = float(importe_col[importe_col > 0].sum())

    # ── cheques emitidos: resumen row 30 "cheques pendientes" → sum cols1+ ──
    # (organizados por semana, representan cheques diferidos emitidos pendientes)
    cheques_emitidos = 0.0
    if len(res) > 30:
        for c in range(1, res.shape[1]):
            v = gres(30, c)
            if v and v > 0:
                cheques_emitidos += v

    # ── vencimientos de hacienda ──
    hac = sheets.get('vencimientos de hacienda', pd.DataFrame())
    cobrar_hacienda = 0.0
    pagar_hacienda  = 0.0
    if len(hac) > 22:
        # Compras hacienda (pagar): filas 2-18
        for i in range(2, min(19, len(hac))):
            r = hac.iloc[i]
            f = pd.to_datetime(r.iloc[0], errors='coerce')
            if pd.isna(f):
                continue
            for c in range(1, hac.shape[1]):
                v = _sf(r.iloc[c])
                if v and v > 0:
                    pagar_hacienda += v
        # Ventas hacienda (cobrar): filas 22-38
        for i in range(22, min(39, len(hac))):
            r = hac.iloc[i]
            f = pd.to_datetime(r.iloc[0], errors='coerce')
            if pd.isna(f):
                continue
            for c in range(1, hac.shape[1]):
                v = _sf(r.iloc[c])
                if v and v > 0:
                    cobrar_hacienda += v

    return {
        'fecha':            fecha_str,
        'formato':          'nuevo',
        'disponible':       round(saldo_disp, 2),
        'cheques_cartera':  round(total_cartera, 2),
        'cheques_emitidos': round(cheques_emitidos, 2),
        'cobrar_hacienda':  round(cobrar_hacienda, 2),
        'pagar_hacienda':   round(pagar_hacienda, 2),
        'usd_cant':         round(usd_cant, 0),
        'usd_ars':          round(usd_ars, 2),
        'lcg':              round(lcg, 2),
        'tercio_bravo':     round(tercio_bravo, 2),
    }


def parse_financiero_historico(ruta):
    """
    Detecta el formato (viejo=hoja única / nuevo=multi-hoja) y parsea el
    archivo YYYY-MM-DD_financiero.xlsx, retornando un dict estandarizado.
    """
    import os as _os
    nombre    = _os.path.basename(ruta)
    fecha_str = nombre[:10]

    try:
        sheets = pd.read_excel(ruta, sheet_name=None, header=None, engine='openpyxl')
    except Exception as e:
        log.warning(f"  ⚠ {nombre}: error abriendo: {e}")
        return None

    if 'resumen' in sheets:
        # FORMATO NUEVO (2026-03-20 en adelante)
        return _parse_financiero_nuevo(sheets, fecha_str)
    else:
        # FORMATO VIEJO (hasta 2026-02-28)
        # Buscar hoja principal (Hoja1 o la primera disponible)
        hoja = sheets.get('Hoja1')
        if hoja is None:
            hoja = sheets.get('Sheet1')
        if hoja is None:
            hoja = list(sheets.values())[0] if sheets else None
        if hoja is None:
            log.warning(f"  ⚠ {nombre}: no se encontró hoja de datos")
            return None
        return _parse_financiero_viejo(hoja, fecha_str)


def actualizar_comportamiento_historico(carpeta, carpeta_stock_mensuales):
    """
    MÓDULO 9: construye/actualiza comportamiento_historico.json.

    Para cada mes con Listado_Caravanas disponible:
      - hacienda_masa: del XLS del mes
      - insumos:       columna de esa fecha en STOCK DE INSUMOS.xlsx
      - financiero:    del financiero más próximo a esa fecha

    Salida: comportamiento_historico.json en carpeta datos.
    """
    import glob as _glob
    import os as _os
    from pathlib import Path

    log.info("  Escaneando Listado_Caravanas...")
    # 1. Listar archivos Listado_Caravanas
    patron_xls = _os.path.join(carpeta_stock_mensuales, "Listado_Caravanas*.XLS")
    archivos_cara = sorted(_glob.glob(patron_xls))
    log.info(f"  Archivos Listado_Caravanas: {len(archivos_cara)}")

    # 2. Listar archivos financieros y parsearlos todos
    log.info("  Escaneando archivos financieros...")
    patron_fin = _os.path.join(carpeta, "financiero",
                               "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_financiero.xlsx")
    archivos_fin = sorted(_glob.glob(patron_fin))
    log.info(f"  Archivos financieros: {len(archivos_fin)}")

    financieros = {}  # fecha_str → dict
    for ruta_f in archivos_fin:
        nombre_f = _os.path.basename(ruta_f)
        fecha_f  = nombre_f[:10]
        # Validar fecha antes de procesar
        try:
            datetime.strptime(fecha_f, '%Y-%m-%d')
        except ValueError:
            log.warning(f"  ⚠ Fecha inválida en nombre '{nombre_f}' — se omite")
            continue
        res = parse_financiero_historico(ruta_f)
        if res:
            financieros[fecha_f] = res
            log.info(f"    ✓ {nombre_f} — disp: ${res['disponible']:,.0f} "
                     f"| cartera: ${res['cheques_cartera']:,.0f} "
                     f"| lcg: ${res['lcg']:,.0f}")
    log.info(f"  Financieros parseados: {len(financieros)}")

    # 3. Leer STOCK DE INSUMOS.xlsx (mapa fecha → col de insumos)
    log.info("  Leyendo STOCK DE INSUMOS.xlsx...")
    insumos_por_fecha = {}  # 'YYYY-MM-DD' → {nombre: kg}
    ruta_ins = Path(carpeta_stock_mensuales) / "STOCK DE INSUMOS.xlsx"
    if ruta_ins.exists():
        try:
            import openpyxl as _oxl
            wb_ins = _oxl.load_workbook(str(ruta_ins), read_only=True, data_only=True)
            ws_ins = wb_ins.active

            # Leer encabezados (fila 1): cols 5+ son fechas
            headers = {}
            for c in range(5, ws_ins.max_column + 1):
                h = ws_ins.cell(1, c).value
                if h is None:
                    continue
                if hasattr(h, 'strftime'):
                    h_str = h.strftime('%Y-%m-%d')
                else:
                    try:
                        h_str = str(h)[:10]
                    except Exception:
                        continue
                if len(h_str) == 10 and h_str[4] == '-':
                    headers[c] = h_str

            # Leer nombres de insumos (columna D = col4)
            nombres_insumos = {}
            for r in range(2, ws_ins.max_row + 1):
                desc = ws_ins.cell(r, 4).value
                if desc:
                    nombres_insumos[r] = str(desc).strip()

            # Para cada columna-fecha, leer los valores
            for col_idx, fecha_col in headers.items():
                items = {}
                total = 0.0
                for r, nombre_ins in nombres_insumos.items():
                    v = ws_ins.cell(r, col_idx).value
                    try:
                        kg = float(v) if v is not None else 0.0
                    except Exception:
                        kg = 0.0
                    items[nombre_ins] = round(kg, 2)
                    total += kg
                insumos_por_fecha[fecha_col] = {
                    'items': items,
                    'total_kg': round(total, 2)
                }
            wb_ins.close()
            log.info(f"  ✓ STOCK DE INSUMOS.xlsx — {len(headers)} fechas leídas")
        except Exception as e:
            log.warning(f"  ⚠ Error leyendo STOCK DE INSUMOS.xlsx: {e}")
    else:
        log.warning(f"  ⚠ No existe {ruta_ins}")

    def _try_parse_date(s):
        """Intenta parsear una fecha YYYY-MM-DD; retorna None si es inválida."""
        try:
            return datetime.strptime(s, '%Y-%m-%d')
        except ValueError:
            return None

    # 4. Función para encontrar el financiero más próximo a una fecha (sin exceder)
    def _financiero_mas_proximo(fecha_target_str):
        """Retorna el dict financiero cuya fecha es la más cercana a fecha_target (≤ fecha_target)."""
        dt_target = _try_parse_date(fecha_target_str)
        if dt_target is None:
            return None
        candidatos = [(f, d) for f, d in financieros.items()
                      if _try_parse_date(f) is not None and f <= fecha_target_str]
        if not candidatos:
            candidatos = [(f, d) for f, d in financieros.items()
                          if _try_parse_date(f) is not None]
        if not candidatos:
            return None
        candidatos.sort(key=lambda x: abs((_try_parse_date(x[0]) - dt_target).days))
        return candidatos[0][1]

    # 5. Función para encontrar los insumos más próximos a una fecha
    def _insumos_mas_proximos(fecha_target_str):
        """Retorna insumos de la fecha más cercana a fecha_target."""
        dt_target = _try_parse_date(fecha_target_str)
        if dt_target is None:
            return None, None
        candidatos = [(f, d) for f, d in insumos_por_fecha.items()
                      if _try_parse_date(f) is not None and f <= fecha_target_str]
        if not candidatos:
            candidatos = [(f, d) for f, d in insumos_por_fecha.items()
                          if _try_parse_date(f) is not None]
        if not candidatos:
            return None, None
        candidatos.sort(key=lambda x: abs((_try_parse_date(x[0]) - dt_target).days))
        return candidatos[0][0], candidatos[0][1]

    # 6. Construir snapshots
    log.info("  Construyendo snapshots mensuales...")
    snapshots = []

    for ruta_c in archivos_cara:
        nombre_c = _os.path.basename(ruta_c)
        log.info(f"  → Procesando {nombre_c}")

        # Parsear Listado Caravanas
        masa = _parse_listado_caravanas_html(ruta_c)
        if masa is None:
            log.warning(f"    ⚠ Skipping {nombre_c} — error en parseo")
            continue

        fecha_snap = masa['fecha']

        # Buscar financiero más próximo
        fin = _financiero_mas_proximo(fecha_snap)
        if fin:
            fin_log = f"financiero: {fin['fecha']} (${fin['disponible']:,.0f})"
        else:
            fin_log = "financiero: no disponible"

        # Buscar insumos más próximos
        fecha_ins, ins_data = _insumos_mas_proximos(fecha_snap)
        if ins_data:
            ins_log = f"insumos: {fecha_ins} ({ins_data['total_kg']:,.0f} kg)"
        else:
            ins_log = "insumos: no disponibles"

        log.info(f"    {fin_log} | {ins_log}")

        # Extraer período (YYYY-MM) del nombre del archivo
        m2 = re.search(r'(\d{2})-(\d{2})-(\d{4})', nombre_c)
        if m2:
            d2, mo2, y2 = m2.groups()
            periodo = f"{y2}-{mo2}"
        else:
            periodo = fecha_snap[:7]

        snap = {
            'fecha':   fecha_snap,
            'periodo': periodo,
            'hacienda_masa': masa,
            'insumos': {
                'fecha_col':   fecha_ins,
                'items':       ins_data['items']       if ins_data else {},
                'total_kg':    ins_data['total_kg']    if ins_data else 0.0,
            },
            'financiero': fin if fin else {
                'fecha': None, 'disponible': 0, 'cheques_cartera': 0,
                'cheques_emitidos': 0, 'cobrar_hacienda': 0, 'pagar_hacienda': 0,
                'usd_cant': 0, 'usd_ars': 0, 'lcg': 0, 'tercio_bravo': 0,
            },
        }
        snapshots.append(snap)

    # Ordenar por fecha
    snapshots.sort(key=lambda s: s['fecha'])

    output = {
        'generado':  datetime.now().isoformat(),
        'snapshots': snapshots,
        'total':     len(snapshots),
    }

    guardar(output, carpeta, "comportamiento_historico.json")
    n = len(snapshots)
    if snapshots:
        log.info(f"  ✓ comportamiento_historico.json — {n} meses "
                 f"({snapshots[0]['fecha']} → {snapshots[-1]['fecha']})")
    else:
        log.info(f"  ✓ comportamiento_historico.json — 0 meses (sin Listado_Caravanas)")
    return output


if __name__ == "__main__":
    main()
