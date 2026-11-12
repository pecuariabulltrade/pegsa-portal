"""v15.99 · TC histórico con memoria de intentos.

Carga SOLO los helpers _tc_* y TC_REINTENTO_DIAS de actualizar_datos.py (vía
ast, sin importar el pipeline entero) y prueba:
  - mes cerrado con un intento fallido hace < 7 días → no llama a las fuentes
  - hace > 7 días → llama (una vez por fuente) y actualiza la fecha
  - fuente que devuelve valor → sale de la memoria y se usa ese valor
  - mes en curso (o futuro) → no llama a nadie ni toca la memoria
  - lectura/escritura de datos\\cache\\tc_intentos.json y próximo reintento
  - el bloque 1b de actualizar_valuacion usa el helper y no llama directo a
    las fuentes

Uso: python tests/test_v1599_tc_intentos.py
"""
import ast
import json
import logging
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "actualizar_datos.py"
TXT = SRC.read_text(encoding="utf-8")


def _cargar():
    tree = ast.parse(TXT)
    keep = []
    for n in tree.body:
        if isinstance(n, ast.FunctionDef) and n.name.startswith("_tc_"):
            keep.append(n)
        elif isinstance(n, ast.Assign) and any(getattr(t, "id", "") == "TC_REINTENTO_DIAS" for t in n.targets):
            keep.append(n)
    ns = {"json": json, "Path": Path, "datetime": datetime, "_td": timedelta,
          "log": logging.getLogger("test")}
    exec(compile(ast.Module(body=keep, type_ignores=[]), str(SRC), "exec"), ns)
    return ns


NS = _cargar()
ext = NS["_tc_hist_externo"]
DIAS = NS["TC_REINTENTO_DIAS"]

OK = FAIL = 0


def check(nombre, cond):
    global OK, FAIL
    if cond:
        OK += 1
        print(f"[ok] {nombre}")
    else:
        FAIL += 1
        print(f"[FALLA] {nombre}")


class Fuente:
    def __init__(self, valor):
        self.valor, self.llamadas = valor, []
        self.__name__ = f"fuente_{valor}"

    def __call__(self, periodo):
        self.llamadas.append(periodo)
        return self.valor


AHORA = datetime(2026, 11, 12, 18, 15, 0)
HOY = "2026-11"

check("TC_REINTENTO_DIAS = 7", DIAS == 7)

# 1 · fallo hace 2 días → no llama
a, b = Fuente(None), Fuente(None)
mem = {"2025-06": {"ultimo_intento": (AHORA - timedelta(days=2)).isoformat(timespec="seconds")}}
antes = json.dumps(mem, sort_keys=True)
v, c = ext("2025-06", mem, AHORA, HOY, (a, b))
check("fallo reciente: no llama a las fuentes", not a.llamadas and not b.llamadas)
check("fallo reciente: devuelve None (va a la tabla) y consulto=False", v is None and c is False)
check("fallo reciente: la memoria no cambia", json.dumps(mem, sort_keys=True) == antes)

# 1b · justo en el borde (6 días 23 h) → todavía no
a = Fuente(None)
mem = {"2025-06": {"ultimo_intento": (AHORA - timedelta(days=7) + timedelta(hours=1)).isoformat(timespec="seconds")}}
ext("2025-06", mem, AHORA, HOY, (a,))
check("6 d 23 h: todavía no llama", not a.llamadas)

# 2 · fallo hace 8 días → llama una vez cada fuente y actualiza la fecha
a, b = Fuente(None), Fuente(None)
mem = {"2025-06": {"ultimo_intento": (AHORA - timedelta(days=8)).isoformat(timespec="seconds")}}
v, c = ext("2025-06", mem, AHORA, HOY, (a, b))
check("fallo viejo: llama una vez a cada fuente", a.llamadas == ["2025-06"] and b.llamadas == ["2025-06"])
check("fallo viejo: consulto=True y None", c is True and v is None)
check("fallo viejo: actualiza la fecha del intento", mem["2025-06"]["ultimo_intento"] == AHORA.isoformat(timespec="seconds"))
# y el tick siguiente ya no llama
a2 = Fuente(None)
ext("2025-06", mem, AHORA + timedelta(hours=1), HOY, (a2,))
check("tick siguiente: no vuelve a llamar", not a2.llamadas)

# 3 · sin memoria → llama; primera fuente con valor corta la cadena
a, b = Fuente(1187.88), Fuente(None)
mem = {}
v, c = ext("2025-06", mem, AHORA, HOY, (a, b))
check("sin memoria: llama y devuelve el valor real", v == 1187.88 and c is True)
check("valor de la 1ª fuente: no llama a la 2ª", a.llamadas == ["2025-06"] and not b.llamadas)
check("valor real: el período no queda en la memoria", "2025-06" not in mem)

# 3b · la 1ª falla y la 2ª da valor → sale de la memoria aunque estuviera
a, b = Fuente(None), Fuente(1201.5)
mem = {"2025-06": {"ultimo_intento": (AHORA - timedelta(days=30)).isoformat(timespec="seconds")}}
v, c = ext("2025-06", mem, AHORA, HOY, (a, b))
check("2ª fuente con valor: lo devuelve y borra el intento", v == 1201.5 and "2025-06" not in mem)

# 3c · una fuente que tira excepción cuenta como fallo
def rompe(p):
    raise RuntimeError("boom")
mem = {}
v, c = ext("2025-06", mem, AHORA, HOY, (rompe,))
check("fuente con excepción: None y anotado", v is None and "2025-06" in mem)

# 4 · mes en curso y futuro → nada
a = Fuente(1500.0)
mem = {}
v, c = ext(HOY, mem, AHORA, HOY, (a,))
check("mes en curso: no llama ni anota", not a.llamadas and v is None and c is False and mem == {})
ext("2026-12", mem, AHORA, HOY, (a,))
check("mes futuro: no llama", not a.llamadas)

# 5 · fecha corrupta en la memoria → se reintenta (no se traba)
a = Fuente(None)
mem = {"2025-06": {"ultimo_intento": "basura"}}
ext("2025-06", mem, AHORA, HOY, (a,))
check("fecha corrupta: reintenta y la corrige", a.llamadas == ["2025-06"] and mem["2025-06"]["ultimo_intento"].startswith("2026-11-12"))

# 6 · archivo en datos\cache\ y próximo reintento
with tempfile.TemporaryDirectory() as td:
    check("sin archivo: memoria vacía", NS["_tc_intentos_leer"](td) == {})
    m = {"2025-06": {"ultimo_intento": "2026-11-10T03:00:00"},
         "2025-07": {"ultimo_intento": "2026-11-12T18:00:00"}}
    NS["_tc_intentos_guardar"](td, m)
    p = Path(td) / "cache" / "tc_intentos.json"
    check("se guarda en <carpeta>/cache/tc_intentos.json", p.exists())
    check("se relee igual", NS["_tc_intentos_leer"](td) == m)
    p.write_text("{no json", encoding="utf-8")
    check("archivo corrupto: memoria vacía (sin romper)", NS["_tc_intentos_leer"](td) == {})
    prox = NS["_tc_hist_proximo"](m)
    check("próximo reintento = el intento más viejo + 7 d", prox == datetime(2026, 11, 17, 3, 0, 0))
    check("sin intentos: próximo = None", NS["_tc_hist_proximo"]({}) is None)

# 7 · el bloque 1b usa el helper (ya no llama directo a las fuentes)
cuerpo = TXT[TXT.index("def actualizar_valuacion("):]
cuerpo = cuerpo[:cuerpo.index("\ndef ", 10)]
check("actualizar_valuacion llama a _tc_hist_externo", "_tc_hist_externo(" in cuerpo)
check("actualizar_valuacion no llama directo a _scrap_mep_tc_ambito(periodo)", "_scrap_mep_tc_ambito(periodo)" not in cuerpo)
check("actualizar_valuacion no llama directo a _scrap_bna_tc_historico(periodo)", "_scrap_bna_tc_historico(periodo)" not in cuerpo)
check("el mes en curso sigue usando el TC del día", "bna_tc = _bna_tc_hoy" in cuerpo)

print(f"\n{OK} ok · {FAIL} fallas")
sys.exit(1 if FAIL else 0)
