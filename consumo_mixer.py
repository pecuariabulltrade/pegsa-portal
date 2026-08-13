"""
consumo_mixer.py
================
Lee el consumo de alimento DIRECTO de la base Access del Mixer
en lugar de la vista SQL v_PB_ConsumoDetallado.

REGLAS DE NEGOCIO:
1. "Hoy" se considera parcial.
2. Ventana 3-dias: los 3 dias COMPLETOS mas recientes con datos validos.
3. Anti-anomalia: hay 2 mixers; si uno no subio datos un dia, ese dia
   parece "caido" >15% vs el promedio anterior (v15.36 — antes era >30%).
   Esos dias se descartan
   y se busca uno mas atras (hasta 5 saltos maximo).
"""
from __future__ import annotations
import os
from datetime import date, datetime, timedelta
from collections import defaultdict
from pathlib import Path

DEFAULT_MIXER_DB = os.path.expandvars(
    r"%USERPROFILE%\Dropbox\Base Nutrir FL\Base FL Mobilia.mdb"
)

NORMALIZAR_INSUMO = {
    "GLUTEN FEED":        "GLUTEN DE MAIZ",
    "MAIZ EN GRANO":      "MAIZ GRANO",
    "SILO DE MAIZ":       "SILO DE MAIZ",
    "HARINA DE GERMEN":   "HARINA GERMEN",
    "NUCLEO":             "NUCLEO CONC 5% LDB",
    "HOMINY FEED":        "HOMINY FEED",
    "ROLLO":              "ROLLO",
    "SOJA":               "SOJA",
    "AGUA":               "AGUA",
}

# % MS por insumo canonico (valores actualizados por Nicolas - 2026-05)
MS_PCT = {
    "GLUTEN DE MAIZ":      53.0,   # 45 -> 53 (Dir 2026-05)
    "MAIZ GRANO":          89.0,
    "SILO DE MAIZ":        58.0,   # 47 -> 58 (Dir 2026-05)
    "HARINA GERMEN":       99.0,   # 98 -> 99 (Dir 2026-05)
    "NUCLEO CONC 5% LDB":  98.0,   # 97.5 -> 98 (Dir 2026-05)
    "HOMINY FEED":         88.0,
    "ROLLO":               87.0,
    "SOJA":                90.0,
    "AGUA":                 0.0,
}


def _norm(desc):
    if not desc: return ""
    k = str(desc).strip().upper()
    return NORMALIZAR_INSUMO.get(k, k)


def _to_date(v):
    if v is None: return None
    s = str(v)[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def leer_mixer_db(path=None, log=None):
    from access_parser import AccessParser
    p = path or DEFAULT_MIXER_DB
    if not Path(p).exists():
        raise FileNotFoundError(f"No existe la base del Mixer: {p}")
    if log: log.info(f"  Mixer DB: {p}")
    parser = AccessParser(p)
    lv_raw = parser.parse_table("Lectura_Viajes")
    lc_raw = parser.parse_table("Lectura_Carga")
    n_lv = len(lv_raw["Id"]) if lv_raw and "Id" in lv_raw else 0
    n_lc = len(lc_raw["ID_Viaje"]) if lc_raw and "ID_Viaje" in lc_raw else 0
    if log: log.info(f"  Mixer | Lectura_Viajes: {n_lv:,} filas  |  Lectura_Carga: {n_lc:,} filas")
    viajes = []
    for i in range(n_lv):
        viajes.append({
            "Id":         lv_raw["Id"][i],
            "Fecha":      _to_date(lv_raw["Fecha"][i]),
            "Cab_Tot":    lv_raw["Cab_Tot"][i] or 0,
            "Des_Receta": lv_raw["Des_Receta"][i] or "",
            "Mixer":      lv_raw["Mixer"][i] or "",
        })
    cargas = []
    for i in range(n_lc):
        try:
            kg_real = float(lc_raw["Kg_Real"][i] or 0)
        except (TypeError, ValueError):
            kg_real = 0.0
        cargas.append({
            "ID_Viaje":    lc_raw["ID_Viaje"][i],
            "Id_Alim":     lc_raw["Id_Alim"][i],
            "Descripcion": lc_raw["Descripcion"][i] or "",
            "Kg_Real":     kg_real,
        })
    return viajes, cargas


def procesar_consumo_mixer(mixer_path=None, periodo=None, dias_diario=30, log=None):
    if log is None:
        import logging
        log = logging.getLogger(__name__)
    if periodo is None:
        periodo = str(date.today().year)

    viajes, cargas = leer_mixer_db(mixer_path, log=log)
    fecha_de_viaje = {v["Id"]: v["Fecha"] for v in viajes if v["Fecha"]}
    hoy        = date.today()
    hace_anio  = hoy - timedelta(days=365)

    cargas_con_fecha = []
    for c in cargas:
        f = fecha_de_viaje.get(c["ID_Viaje"])
        if f is None: continue
        cargas_con_fecha.append({
            "fecha": f,
            "desc":  _norm(c["Descripcion"]),
            "kg":    c["Kg_Real"],
        })

    fechas_con_datos = sorted({c["fecha"] for c in cargas_con_fecha})
    kg_por_dia = defaultdict(float)
    for c in cargas_con_fecha:
        if c["desc"] != "AGUA":
            kg_por_dia[c["fecha"]] += c["kg"]

    # v15.36: bajado de 0.70 (descartaba caídas >30%) a 0.85 (descarta >15%).
    # El umbral de 30% era demasiado laxo — el 23/06/2026 cayó 24% (67k vs
    # promedio 89k de los 3 días previos) y no se detectaba.
    UMBRAL_CAIDA = 0.85
    PRIORES      = 3
    MAX_SKIP     = 5
    fechas_completas = [f for f in fechas_con_datos if f < hoy]

    incluidos = []
    descartados = []
    i = len(fechas_completas) - 1
    while i >= 0 and len(incluidos) < 3 and len(descartados) < MAX_SKIP:
        fecha = fechas_completas[i]
        kg    = kg_por_dia[fecha]
        previos = []
        j = i - 1
        while j >= 0 and len(previos) < PRIORES:
            previos.append(kg_por_dia[fechas_completas[j]])
            j -= 1
        if previos:
            avg_prev = sum(previos) / len(previos)
            if avg_prev > 0 and kg < UMBRAL_CAIDA * avg_prev:
                pct_caida = (1 - kg / avg_prev) * 100
                descartados.append({
                    "fecha":    fecha.isoformat(),
                    "kg":       round(kg, 1),
                    "avg_prev": round(avg_prev, 1),
                    "ratio":    round(kg / avg_prev, 3),
                    "razon":    f"caida {pct_caida:.0f}% vs prom 3 dias previos",
                })
                i -= 1
                continue
        incluidos.append(fecha)
        i -= 1
    incluidos.reverse()

    if not incluidos:
        log.warning("  Mixer | No hay dias completos validos")
        ultimo_completo = fechas_completas[-1] if fechas_completas else hoy
        ventana_3d = []
    else:
        ultimo_completo = incluidos[-1]
        ventana_3d      = incluidos

    desde_3d = ventana_3d[0]  if ventana_3d else ultimo_completo
    hasta_3d = ventana_3d[-1] if ventana_3d else ultimo_completo

    log.info(f"  Mixer | Hoy = {hoy} (parcial)")
    if descartados:
        log.warning(f"  Mixer | {len(descartados)} dia(s) descartado(s) por caida >15%:")
        for d in descartados:
            log.warning(f"    - {d['fecha']}: {d['kg']:,.0f} kg ({d['razon']})")
    log.info(f"  Mixer | Ventana 3d valida = {[d.isoformat() for d in ventana_3d]}")

    anual_por_ins = defaultdict(float)
    total_anual = 0.0
    for c in cargas_con_fecha:
        if c["fecha"] >= hace_anio and c["fecha"] < hoy and c["desc"] != "AGUA":
            anual_por_ins[c["desc"]] += c["kg"]
            total_anual += c["kg"]

    por_insumo_anual = []
    for d, kg in sorted(anual_por_ins.items(), key=lambda x: -x[1]):
        ms_pct = MS_PCT.get(d)
        kg_ms  = round(kg * ms_pct / 100, 1) if ms_pct is not None else None
        por_insumo_anual.append({"desc": d, "kg": round(kg, 1), "ms_pct": ms_pct, "kg_ms": kg_ms})
    total_anual_ms = round(sum(r["kg_ms"] or 0 for r in por_insumo_anual), 1)

    set_3d = set(ventana_3d)
    sem_por_ins = defaultdict(lambda: {"kg":0.0, "dias":set()})
    total_3d = 0.0
    for c in cargas_con_fecha:
        if c["fecha"] in set_3d and c["desc"] != "AGUA":
            sem_por_ins[c["desc"]]["kg"] += c["kg"]
            sem_por_ins[c["desc"]]["dias"].add(c["fecha"].isoformat())
            total_3d += c["kg"]

    n_dias = max(len(set_3d), 1)
    por_insumo_3d = []
    for d, v in sorted(sem_por_ins.items(), key=lambda x: -x[1]["kg"]):
        ms_pct    = MS_PCT.get(d)
        prom_d    = round(v["kg"] / max(len(v["dias"]), 1), 1)
        prom_d_ms = round(prom_d * ms_pct / 100, 1) if ms_pct is not None else None
        por_insumo_3d.append({
            "desc": d, "kg_3d": round(v["kg"], 1),
            "dias_registrados": len(v["dias"]),
            "promedio_diario": prom_d, "ms_pct": ms_pct,
            "promedio_diario_ms": prom_d_ms,
        })
    prom_diario_total    = round(total_3d / n_dias, 1)
    prom_diario_total_ms = round(sum(r["promedio_diario_ms"] or 0 for r in por_insumo_3d), 1)
    pct_ms_global = round(prom_diario_total_ms / prom_diario_total * 100, 1) if prom_diario_total > 0 else 0.0

    desde_diario = ultimo_completo - timedelta(days=dias_diario - 1)
    diario_data  = defaultdict(lambda: defaultdict(float))
    for c in cargas_con_fecha:
        if c["fecha"] >= desde_diario and c["fecha"] <= ultimo_completo and c["desc"] != "AGUA":
            diario_data[c["fecha"]][c["desc"]] += c["kg"]
    set_descartados = {d["fecha"] for d in descartados}

    dias_lista = []
    f = desde_diario
    while f <= ultimo_completo:
        ins = diario_data.get(f, {})
        kg_total    = sum(ins.values())
        kg_ms_total = sum(kg * (MS_PCT.get(desc, 0) or 0) / 100 for desc, kg in ins.items())
        pct_ms      = round(kg_ms_total / kg_total * 100, 1) if kg_total > 0 else None
        dias_lista.append({
            "fecha":      f.isoformat(),
            "kg_total":   round(kg_total, 1),
            "kg_ms_total":round(kg_ms_total, 1),
            "pct_ms":     pct_ms,
            "descartado": f.isoformat() in set_descartados,
            "por_insumo": {d: round(kg, 1) for d, kg in ins.items()},
        })
        f += timedelta(days=1)

    log.info(f"  Mixer | Total 3d: {total_3d:,.0f} kg  |  Prom diario TC: {prom_diario_total:,.1f}  |  MS: {prom_diario_total_ms:,.1f}  |  %MS: {pct_ms_global}%")
    log.info(f"  Mixer | Diario: {len(dias_lista)} dias desde {desde_diario} hasta {ultimo_completo}")

    # ═══════════════════════════════════════════════════════════
    #  v15.58 · POR_MES — historia completa del .mdb
    # ═══════════════════════════════════════════════════════════
    # La serie diaria de %PV (eficiencia_historico) solo arranca en 2026-04-30,
    # pero el modulo Resultado por Remito costea animales con hasta 360 dias de
    # estadia. Esto expone el consumo mes a mes de TODA la historia de la base
    # para poder reconstruir el %PV hacia atras.
    import calendar as _calendar
    import statistics as _statistics

    kg_ms_por_dia = defaultdict(float)
    sin_ms_pct    = defaultdict(float)   # insumos historicos fuera de MS_PCT
    kg_total_hist = 0.0
    for c in cargas_con_fecha:
        if c["desc"] == "AGUA":
            continue
        ms_pct = MS_PCT.get(c["desc"])
        if ms_pct is None:
            sin_ms_pct[c["desc"]] += c["kg"]
            ms_pct = 0.0
        kg_ms_por_dia[c["fecha"]] += c["kg"] * ms_pct / 100
        kg_total_hist += c["kg"]

    # Hoy es parcial: fuera de la agregacion mensual.
    dias_por_mes = defaultdict(list)
    for f in fechas_con_datos:
        if f >= hoy:
            continue
        dias_por_mes[f"{f.year:04d}-{f.month:02d}"].append(f)

    mes_actual   = f"{hoy.year:04d}-{hoy.month:02d}"
    primer_mes   = min(dias_por_mes) if dias_por_mes else None
    meses_out    = {}
    for mes in sorted(dias_por_mes):
        dias_mes = sorted(dias_por_mes[mes])
        # v15.58: un dia es VALIDO si kg_dia >= 0.85 * mediana(kg_dia del mes).
        # Mismo espiritu que UMBRAL_CAIDA de la ventana 3d (v15.36), pero contra
        # la mediana del mes — es robusta a los propios dias caidos, cosa que un
        # promedio no seria (los dias malos arrastrarian el umbral hacia abajo).
        # Hay 2 mixers: cuando uno no sube datos el dia queda con la mitad de
        # los kilos y contamina el promedio del mes.
        mediana = _statistics.median([kg_por_dia[f] for f in dias_mes])
        piso    = UMBRAL_CAIDA * mediana
        validos, descartados_mes = [], []
        for f in dias_mes:
            if mediana > 0 and kg_por_dia[f] < piso:
                descartados_mes.append(f)
            else:
                validos.append(f)

        kg_mes    = sum(kg_por_dia[f]    for f in validos)
        kg_ms_mes = sum(kg_ms_por_dia[f] for f in validos)
        n_validos = len(validos)

        # parcial = mes en curso, o primer mes de la historia si la base arranca
        # pasado el dia 3 (el mes esta incompleto por donde empieza el .mdb).
        parcial = (mes == mes_actual)
        if mes == primer_mes and dias_mes[0].day > 3:
            parcial = True

        meses_out[mes] = {
            "kg_total":          round(kg_mes, 1),
            "kg_ms_total":       round(kg_ms_mes, 1),
            "kg_ms_dia":         round(kg_ms_mes / n_validos, 1) if n_validos else None,
            "dias_calendario":   _calendar.monthrange(int(mes[:4]), int(mes[5:7]))[1],
            "dias_con_registro": n_validos,
            "dias_descartados":  [f.isoformat() for f in descartados_mes],
            "parcial":           parcial,
        }

    # Insumos sin % MS: NO se inventan valores, solo se loguean. Si son
    # materiales, el kg_ms_mes esta subestimado y es una pregunta para Nicolas.
    if sin_ms_pct:
        _tot_sin = sum(sin_ms_pct.values())
        _pct_sin = _tot_sin / kg_total_hist * 100 if kg_total_hist > 0 else 0.0
        _msg = (f"  Mixer | {len(sin_ms_pct)} insumo(s) SIN MS_PCT "
                f"({_tot_sin:,.0f} kg = {_pct_sin:.2f}% del total historico):")
        if _pct_sin > 1.0:
            log.warning(_msg + "  <-- >1% del total, kg_ms_mes SUBESTIMADO")
            for d, kg in sorted(sin_ms_pct.items(), key=lambda x: -x[1]):
                log.warning(f"    - {d}: {kg:,.0f} kg")
        else:
            log.info(_msg)
            for d, kg in sorted(sin_ms_pct.items(), key=lambda x: -x[1]):
                log.info(f"    - {d}: {kg:,.0f} kg")

    _n_desc_mes = sum(len(m["dias_descartados"]) for m in meses_out.values())
    log.info(f"  Mixer | por_mes: {len(meses_out)} meses "
             f"({min(meses_out) if meses_out else '—'} -> {max(meses_out) if meses_out else '—'}) "
             f"· {_n_desc_mes} dia(s) descartado(s) por caida vs mediana del mes")

    return {
        "meta": {
            "generado":         datetime.now().isoformat(),
            "periodo":          periodo,
            "fuente":           "mixer_dropbox",
            "mixer_db":         str(mixer_path or DEFAULT_MIXER_DB),
            "tabla":            "Lectura_Viajes + Lectura_Carga",
            "hoy_parcial":      hoy.isoformat(),
            "ultimo_completo":  ultimo_completo.isoformat(),
            "ventana_3d":       [d.isoformat() for d in ventana_3d],
            "dias_descartados": descartados,
            "umbral_caida":     UMBRAL_CAIDA,
        },
        "anual": {
            "total_kg":     round(total_anual, 1),
            "total_kg_ms":  total_anual_ms,
            "por_insumo":   por_insumo_anual,
        },
        "semanal": {
            "desde":                  desde_3d.isoformat(),
            "hasta":                  hasta_3d.isoformat(),
            "dias_registrados":       n_dias,
            "dias_detalle":           [d.isoformat() for d in ventana_3d],
            "total_kg_3d":            round(total_3d, 1),
            "promedio_diario_kg":     prom_diario_total,
            "promedio_diario_kg_ms":  prom_diario_total_ms,
            "pct_ms_global":          pct_ms_global,
            "por_insumo":             por_insumo_3d,
        },
        "diario": {
            "desde":      desde_diario.isoformat(),
            "hasta":      ultimo_completo.isoformat(),
            "dias_count": len(dias_lista),
            "dias":       dias_lista,
        },
        # v15.58: corte mensual de toda la historia, insumo de pct_pv_mensual.json.
        "por_mes": {
            "nota": ("MS_PCT vigente (2026-05) aplicado retroactivamente a toda la "
                     "historia. Dia valido si kg >= 0.85 * mediana del mes. "
                     "Hoy (parcial) excluido. kg_ms_dia divide por dias CON REGISTRO."),
            "umbral_caida": UMBRAL_CAIDA,
            "meses": meses_out,
        },
    }
