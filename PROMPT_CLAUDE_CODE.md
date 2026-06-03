# Diagnóstico: cierre de mayo 2026 falta en `valuacion_historica.json` y `comportamiento_historico.json`

## Estado actual

El pipeline corrió hoy (3/6/2026 16:00) — `ultima_actualizacion.json` lo confirma. Pero los snapshots mensuales de cierre solo llegan hasta **abril 2026 (2026-04-30)**. **Falta el snapshot de mayo 2026 (2026-05-31)** en ambos:

- `valuacion_historica.json` — último period: `2026-04`
- `comportamiento_historico.json` — último period: `2026-04`, archivo `Listado_Caravanas30-04-2026.XLS`

`ultima_actualizacion.json` dice `historico: rango "2025-06 → 2026-05"` pero ese es **otro archivo** (probablemente `eficiencia_historico` que guarda snapshots diarios, no el cierre mensual).

## Hipótesis ordenadas por probabilidad

### Hipótesis 1 — Falta el archivo de mayo en OneDrive
Cada snapshot mensual en `comportamiento_historico.json` está atado a `Listado_Caravanas<DDMM>-<AAAA>.XLS`. Si `Listado_Caravanas31-05-2026.XLS` no está en la carpeta de entradas (sea OneDrive del usuario, una subcarpeta de `PEGSA_Portal/datos/` o similar), el pipeline no puede generar el cierre.

### Hipótesis 2 — Scraping de cierre BCR/MAG/BNA mayo falló silenciosamente
Similar al bug del precio del maíz que arreglamos en v14.2. La función podría tener un `try/except` que swallow errors. Si las páginas de origen no dieron datos del mes cerrado todavía, el snapshot queda sin generar.

### Hipótesis 3 — Guard de "ya procesado" que no detecta mayo
La función podría tener una lógica del estilo "si ya existe el último periodo, no hacer nada más" y no se está dando cuenta que abril ya pasó y mayo cerró.

## Pasos diagnósticos (correrlos en orden, parar al primer culpable)

### Paso 1 — Verificar si el archivo de mayo existe
```powershell
$od = "C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal"
Get-ChildItem -Path $od -Filter "Listado_Caravanas31-05-2026.XLS" -Recurse | Select-Object FullName, Length, LastWriteTime
# Tambien buscar variantes con barra al separador
Get-ChildItem -Path $od -Filter "Listado_Caravanas*05*2026*.XLS" -Recurse | Select-Object FullName, Length, LastWriteTime
```

Si **no aparece**, esa es la causa. El usuario tiene que subir el archivo del 31/05/2026 a la misma carpeta donde están los meses anteriores. Decime qué ruta (`FullName`) tienen los archivos de meses previos para que yo le indique exactamente dónde subirlo.

Si **sí aparece**, pasar al paso 2.

### Paso 2 — Identificar la función generadora en `actualizar_datos.py`
```powershell
cd "$od"
Select-String -Path "actualizar_datos.py" -Pattern "comportamiento_historico|valuacion_historica" -SimpleMatch | Select-Object LineNumber, Line | Format-Table -Wrap
```

Reportame nombres de funciones y números de línea.

### Paso 3 — Correr la función manualmente y capturar salida
Una vez identificada la función (probable `actualizar_comportamiento_historico()` o `actualizar_valuacion_historica()`), correrla en aislado con print de diagnóstico:

```powershell
python3 -c "
import sys; sys.path.insert(0, '.')
import logging; logging.basicConfig(level=logging.DEBUG)
from actualizar_datos import <NOMBRE_FUNCION>
<NOMBRE_FUNCION>()
"
```

Reportame todo el output. Si dice "skipping" o "ya existe" o falla con excepción silenciosa, ahí está la causa.

### Paso 4 — Si el bug es en una función, NO la arregles todavía
Esperá mi siguiente prompt con el fix concreto. Solo reportá:
1. Resultado del paso 1 (archivo existe sí/no, ruta completa)
2. Resultado del paso 2 (nombre de función + línea)
3. Resultado del paso 3 (output completo)

## NO hacer

- No tocar `actualizar_datos.py` ni `valuacion_historica.json` ni `comportamiento_historico.json` todavía. Solo diagnóstico.
- No hacer git commits.
- No copiar nada a OneDrive ni al repo.

Reportame los 3 outputs y de ahí armo el fix.
