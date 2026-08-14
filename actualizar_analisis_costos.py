# -*- coding: utf-8 -*-
"""Genera analisis_costos_datos.json para el modulo "Analisis de Costos"
del portal PEGSA (GitHub Pages).

Corre en la MISMA PC donde esta el portal de costos Physis (el que exporta
datos_depurados\\). No usa red ni tokens: lee los CSV locales y escribe el
JSON agregado en la carpeta del repo pegsa-portal. Despues lo publica el
mismo flujo de siempre (5_ACTUALIZAR_Y_PUBLICAR_GITHUB.bat / git push).

IMPORTANTE - PRIVACIDAD: el repo pegsa-portal es PUBLICO. Por eso este
script NO publica movimientos: agrega por mes + cuenta + centro, sin
comprobantes, sin terceros y sin detalle. Aun asi son importes contables
reales: decidir conscientemente si se publica o si el repo pasa a privado.

Uso:  python actualizar_analisis_costos.py
"""
import csv
import glob
import gzip
import io
import json
import os
from collections import defaultdict
from datetime import datetime

# ----------------------------- CONFIG ---------------------------------
# Carpeta datos_depurados del portal de costos (origen)
CARPETA_DEPURADOS = r"C:\Users\USER\OneDrive - pecuaria el garabi sa\contabilidad de physis\portal-costos-physis\datos_depurados"
# Carpeta local del repo pegsa-portal (destino, donde vive index.html)
CARPETA_PEGSA = r"C:\Users\USER\Documents\GitHub\pegsa-portal"   # v15.61: corregido contra repo_github_path.txt
# Empresas a publicar (por nombre de archivo). Vacio = todas las que haya.
EMPRESAS = ["movimientos_BULLTRADE_S_R_L", "movimientos_PECUARIA_EL_GARABI_S_A"]
# -----------------------------------------------------------------------


def _abrir(ruta):
    if ruta.endswith(".gz"):
        return io.TextIOWrapper(gzip.open(ruta, "rb"), encoding="utf-8-sig")
    return open(ruta, encoding="utf-8-sig")


def generar():
    patrones = ([os.path.join(CARPETA_DEPURADOS, e + ".csv*") for e in EMPRESAS]
                or [os.path.join(CARPETA_DEPURADOS, "movimientos_*.csv*")])
    rutas = sorted({r for p in patrones for r in glob.glob(p)})
    # si existe .csv y .csv.gz de la misma empresa, preferir el mas nuevo
    vistos = {}
    for r in rutas:
        base = os.path.basename(r).replace(".gz", "")
        if base not in vistos or os.path.getmtime(r) > os.path.getmtime(vistos[base]):
            vistos[base] = r
    rutas = sorted(vistos.values())
    if not rutas:
        raise SystemExit(f"No encontre CSVs en {CARPETA_DEPURADOS}")

    acum = defaultdict(lambda: [0.0, 0.0, 0, False])  # imp, kg, n, hay_kg
    for ruta in rutas:
        with _abrir(ruta) as fh:
            for f in csv.DictReader(fh):
                if f.get("excluido"):
                    continue
                if not (f.get("rubro_n2") or "").startswith("0402"):
                    continue
                clave = (f["empresa"], f["fecha"][:7], f["cuenta"],
                         f.get("cuenta_nombre") or "", f.get("centro") or "",
                         f.get("centro_nombre") or "", f.get("ramal_n1") or "",
                         f.get("ramal_n1_nombre") or "", f.get("centro_madre") or "",
                         f.get("centro_madre_nombre") or "")
                a = acum[clave]
                a[0] += float(f["importe"] or 0)
                kg = f.get("importe_kg_novillo")
                if kg not in (None, ""):
                    a[1] += float(kg)
                    a[3] = True
                a[2] += 1

    filas = []
    for (e, m, cta, ctan, ccod, cc, rcod, ramal, mcod, madre), (imp, kg, n, hay) in acum.items():
        filas.append({"e": e, "m": m, "cta": cta, "ctan": ctan,
                      "ccod": ccod, "cc": cc, "rcod": rcod, "ramal": ramal,
                      "mcod": mcod, "madre": madre,
                      "imp": round(imp, 2),
                      "kg": round(kg, 1) if hay else None, "n": n})
    filas.sort(key=lambda r: (r["e"], r["m"], r["ccod"], r["cta"]))

    salida = {"generado": datetime.now().isoformat(timespec="seconds"),
              "filas": filas}
    destino = os.path.join(CARPETA_PEGSA, "analisis_costos_datos.json")
    with open(destino, "w", encoding="utf-8") as fh:
        json.dump(salida, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"OK: {len(filas)} filas agregadas -> {destino}")

    generar_operativos()


def generar_operativos():
    """Denominadores de los ratios: kg de alimento y cabezas promedio por mes.

    TODO (integrador PEGSA): completar leyendo los JSON que ya genera
    actualizar_datos.py (p. ej. consumo_*.json para kg de alimento dado y
    stock_kpis_*.json / productivo_*.json para cabezas promedio del feedlot).
    Formato de salida: {"2025-01": {"alim": 428000, "cab": 3840}, ...}
    Mientras no exista el archivo, el modulo permite tipearlos a mano.
    """
    destino = os.path.join(CARPETA_PEGSA, "analisis_costos_operativos.json")
    if os.path.exists(destino):
        print(f"(operativos: ya existe {destino}, no lo piso)")
        return
    # Ejemplo de esqueleto vacio para completar a mano si se quiere:
    # json.dump({}, open(destino, "w"))
    print("(operativos: pendiente de mapear desde consumo_*.json / stock_kpis_*.json)")


if __name__ == "__main__":
    generar()
