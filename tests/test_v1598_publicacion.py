"""v15.98 · Publicar sólo lo que cambia.

Carga SOLO los helpers _pub_* y las constantes PUB_* de actualizar_datos.py
(vía ast, sin importar el pipeline entero) y prueba la decisión de copia:
  - difieren sólo en generado / meta.generado / meta.tc.capturado → no se copia
  - difieren en un dato → se copia
  - destino inexistente o corrupto → se copia
  - lista "no publicar" y credenciales → nunca
  - ultima_actualizacion.json → siempre
  - resultado_remitos/*.json → por bytes

Uso: python tests/test_v1598_publicacion.py
"""
import ast
import json
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "actualizar_datos.py"


def _cargar():
    tree = ast.parse(SRC.read_text(encoding="utf-8"))
    keep = []
    for n in tree.body:
        if isinstance(n, ast.FunctionDef) and n.name.startswith("_pub_"):
            keep.append(n)
        elif isinstance(n, ast.Assign) and any(getattr(t, "id", "").startswith("PUB_") for t in n.targets):
            keep.append(n)
    ns = {"json": json, "Path": Path}
    exec(compile(ast.Module(body=keep, type_ignores=[]), str(SRC), "exec"), ns)
    return ns


NS = _cargar()
hay = NS["_pub_hay_que_copiar"]
bytes_dist = NS["_pub_bytes_distintos"]
excl = NS["_pub_excluido"]

BASE = {
    "generado": "2026-11-11T18:04:00",
    "meta": {"generado": "2026-11-11T18:04:00", "tc": {"valor": 1544, "capturado": "2026-11-11T18:03:10"}, "fuente": "x"},
    "datos": [1, 2, {"a": float("nan")}],
}

_ok = _fail = 0


def check(nombre, cond):
    global _ok, _fail
    if cond:
        _ok += 1
        print(f"  ✓ {nombre}")
    else:
        _fail += 1
        print(f"  ✗ {nombre}")


def escribir(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")


def main():
    with tempfile.TemporaryDirectory() as td:
        src_dir, dst_dir = Path(td, "datos"), Path(td, "repo")
        src_dir.mkdir()
        dst_dir.mkdir()

        def par(nombre, a, b):
            s, d = src_dir / nombre, dst_dir / nombre
            escribir(s, a)
            if b is None:
                if d.exists():
                    d.unlink()
            elif isinstance(b, str):
                d.write_text(b, encoding="utf-8")
            else:
                escribir(d, b)
            return s, d

        nuevo = json.loads(json.dumps(BASE))
        nuevo["generado"] = "2026-11-11T19:03:00"
        nuevo["meta"]["generado"] = "2026-11-11T19:03:00"
        nuevo["meta"]["tc"]["capturado"] = "2026-11-11T19:02:00"
        check("sólo marcas de hora (y NaN igual) → no se copia", not hay(*par("stock_kpis_2025.json", nuevo, BASE)))

        dato = json.loads(json.dumps(nuevo))
        dato["datos"][0] = 99
        check("cambia un dato → se copia", hay(*par("stock_kpis_2025.json", dato, BASE)))

        tc = json.loads(json.dumps(BASE))
        tc["meta"]["tc"]["valor"] = 1550
        check("cambia meta.tc.valor → se copia", hay(*par("mercado_precios.json", tc, BASE)))

        check("destino inexistente → se copia", hay(*par("consumo_2025.json", BASE, None)))
        check("destino corrupto → se copia", hay(*par("consumo_2025.json", BASE, "{no es json")))

        for n in ("negocios_resumen.json", "negocios_snapshots.json", "precios_indiferencia_historico.json",
                  "resultado_remitos.json", "consumo_2025.backup_test.json",
                  "negocios_snapshots.backup_20260501_123018.json", "lector-robot-credentials.json"):
            check(f"no publicar: {n}", (not hay(*par(n, dato, None))) and excl(n) is not None)

        check("config/key ya no excluyen por subcadena", excl("origenes_alias.json") is None and excl("monkey_config.json") is None)
        check("ultima_actualizacion.json → siempre", hay(*par("ultima_actualizacion.json", BASE, BASE)))

        r1, r2 = src_dir / "2213.json", dst_dir / "2213.json"
        r1.write_text('{"filas":[1]}', encoding="utf-8")
        r2.write_text('{"filas":[1]}', encoding="utf-8")
        check("remito igual en bytes → no se copia", not bytes_dist(r1, r2))
        r2.write_text('{"filas":[2]}', encoding="utf-8")
        check("remito distinto → se copia", bytes_dist(r1, r2))
        r2.unlink()
        check("remito sin destino → se copia", bytes_dist(r1, r2))

    print(f"\nPassed: {_ok}\nFailed: {_fail}")
    return 0 if _fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
