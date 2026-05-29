# Prompt para Claude Code — v12.1 fixes del PDF v12.0

Cowork validó visualmente el PDF que generó el usuario después de v12.0 y
encontró 3 bugs (1 cosmético de cache + 2 reales de código). Las
ediciones ya están escritas — necesitamos commit + push.

## Bugs encontrados en el PDF que envió el usuario

1. **Pág 1 (Stock terminados):** la columna **El Haras** salió toda `—`.
   Cause: el celu del usuario tenía `data.js` viejo cacheado (GitHub
   Pages devuelve max-age=600). El push de v12.0 fue ~36min antes pero
   el browser no se rompió el cache. Verificado en producción ahora:
   `D.stockCategoriasHaras` SÍ tiene los datos (Novillo>550=890cab,
   Vaca>650=578cab). No es bug de código, es bug de cache.

2. **Pág 3 (Financiero PEG-BULL):** las barras más largas (−$3,24 MM y
   −$3,48 MM) se montaban encima de los labels "27/05", "03/06"...,
   cortándolos. La 6ta barra (01/07) ni siquiera mostraba el label.
   En la pág 4 (DW) no se ve porque los valores son menores.

3. **Pág 5 (Productivos):** los chips de delta mostraban `"31%`, `"11%`,
   `"13%` en vez de `-31%`, `-11%`, `-13%`. Cause: `mobile-data.js`
   construye `deltaFmt` con `"−"` (U+2212, signo menos verdadero) que
   jsPDF Helvetica Type-1 no soporta (Win-1252 lo renderiza como `"`).

## Cambios que ya hizo Cowork

### `mobile.jsx`
- Nueva helper `pdfSafe(s)` que reemplaza `−` (U+2212) por `-` ASCII.
- Aplicada en:
  - `pdfDrawPageHeader` (title + subtitle de cada página)
  - `pdfDrawTable` (header columnas + cell values)
  - `pdfDrawKpiCard` (title, kpi, unit, sub, chip)
  - `pdfDrawFlujoBars` (label + value)
  - Bloque manual de página Precios (header card + KPI + chip + params)
- `pdfDrawFlujoBars` reescrita con carriles fijos:
  ```
  labelW = 18mm
  gapL   = 3mm
  barAreaW = w - labelW - gapL - 4 - valueW(30)
  zeroX = barAreaX + barAreaW/2
  ```
  Antes la barra ocupaba 62% del ancho y el label estaba en `x` —
  cuando la barra era full-length empezaba EXACTAMENTE en x=15 (el
  label), pisándolo.

### `mobile.html`
- Cache-buster `?v=121` en `data.js`, `mobile-data.js`, `mobile.jsx`,
  `mobile.css`. JSONs sin versionar (el bot AUTO los regenera).

### `mobile-data.js`
- Bump v12.1 en header con changelog de los 3 fixes.
- NO se cambió lógica de datos — el `deltaFmt` sigue construyéndose con
  `"−"` U+2212 (no quise tocar mobile-data.js porque el desktop también
  lo usa y ahí Inter sí soporta U+2212). El fix vive solo en el lado
  PDF via `pdfSafe()`.

## Tareas para vos

1. **Validar sintaxis** con el mismo script Python de braces que usaste
   en v12.0. Las ediciones de Cowork son pequeñas y bien acotadas.

2. **Levantar `mobile.html` localmente** (file:// o servidor estático)
   y generar el PDF para confirmar visualmente:
   - Pág 3: labels "27/05", "03/06", ... "01/07" se ven sin cortes
   - Pág 5: chips muestran `-31%`, `+23%`, `-11%`, `-13%`, `+54%`, `+1,5%`

3. **Commit + push** con:
   ```
   v12.1: 3 fixes del PDF post-validacion v12.0

   - mobile.jsx: helper pdfSafe() que normaliza U+2212 (signo menos
     verdadero) a "-" ASCII. Helvetica Type-1 de jsPDF usa
     WinAnsiEncoding que no incluye U+2212; el chip "-31%" del
     delta de Productivos salia '"31%'. Aplicada en todos los
     doc.text() del PDF (pdfDrawPageHeader, pdfDrawTable,
     pdfDrawKpiCard, pdfDrawFlujoBars y los draws manuales de
     pagina Precios).
   - mobile.jsx: pdfDrawFlujoBars rediseñada con carriles fijos
     (label 18mm | bar area | valor 30mm). Antes las barras
     largas tipo -$3,48 MM se montaban encima del label "27/05".
   - mobile.html: cache-buster ?v=121 en data.js, mobile-data.js,
     mobile.jsx, mobile.css. Evita que GitHub Pages (max-age=600)
     sirva versiones viejas tras pushes consecutivos. JSON sin
     versionar para que el bot AUTO los siga refrescando.
   - mobile-data.js: bump v12.1 + changelog. Sin cambios de logica.

   El bug "El Haras vacío" en Pág 1 era cache del lado del usuario
   (data.js viejo), no bug de codigo — el cache-buster lo previene
   a futuro.
   ```

## Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `mobile.jsx` | Helper pdfSafe + pdfDrawFlujoBars + pdfSafe en draws |
| `mobile.html` | `?v=121` en 4 scripts/styles |
| `mobile-data.js` | Header changelog v12.1 |
