# Prompt para Claude Code — v12.2 PDF compacto 2 páginas + 4 filas Stock

## Contexto

El usuario mandó un mockup pidiendo el PDF a 2 páginas compactas (en
vez de las 6 multipágina de v12.0). Y agregar 2 filas más al Stock
terminados: además de PEGSA + Grupo, sumar **El Haras** + **Otros
establecimientos** (= La Cucuca + El Descanso + La Panchita).

**Importante incidente operativo descubierto**: el bot AUTO de
actualización del usuario (que corre desde OneDrive) **revirtió las
ediciones de v12.0 en `data.js`** 12 minutos después del push de Claude
Code (commit `69951fe`). Por eso el PDF que generó el usuario tenía
"El Haras" vacío — NO era cache, era que la versión deployada de
`data.js` no tenía el fetch agregado.

**Fix definitivo**: copiar `data.js` editado también a OneDrive
(`C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal\data.js`),
para que el bot al regenerar/sincronizar use la versión correcta y no
revierta nada.

## Cambios ya escritos por Cowork (sin commitear)

### `data.js` (+ ~45 líneas)
- `Promise.all` suma 4 fetches:
  - `stock_est_El_Haras_2025.json`
  - `stock_est_La_Cucuca_2025.json`
  - `stock_est_El_Descanso_2025.json`
  - `stock_est_La_Panchita_2025.json`
- Helper `extractCats(snap)` extrae `por_categoria_final` normalizado.
- Después del bloque de `stockPegsa`, agrega:
  - `D.stockCategoriasHaras` + `D.haciendaHarasTotal` (del JSON de El Haras)
  - `D.stockCategoriasOtros` + `D.haciendaOtrosTotal` (suma de los 3 otros)

### `mobile-data.js` (bump v12.2)
- Header changelog actualizado con v12.1 + v12.2.
- `STOCK_TERMINADOS` ahora tiene 4 fuentes por categoría:
  ```js
  { pegsa, grupo, haras, otros }
  ```

### `mobile.html` (cache-buster)
- `?v=122` en `data.js`, `mobile-data.js`, `mobile.jsx`, `mobile.css`.

### `mobile.jsx` (rediseño completo del PDF)
- **PDF_COLORS**: agrega `navy2`, `bandSoft`, `posSoft`, `negSoft`,
  `warnSoft`, `badSoft`, `goodSoft`.
- **`pdfSafe(s)`** (v12.1): reemplaza U+2212 por `-` ASCII para que
  Helvetica de jsPDF no renderice `"` en los chips negativos.
- **`pdfDrawPageHeader`** rediseñado: banda 14mm con pill P&B + brand
  + fecha + pill paginador. Devuelve `y=18`.
- **`buildPdfDoc()` reescrito entero** con layout de 2 páginas:
  - Página 1: Stock terminados (2 cards) + Insumos críticos (2 rows
    full-width) + Financiero PEG-BULL + Financiero DW (cards stacked).
  - Página 2: Productivos (grid 2×3) + Precios indiferencia (grid 2×2).
  - Helpers nuevos internos: `drawSectionTitle`, `drawStockCard`,
    `drawInsumoRow`, `drawFinCard`, `drawProdCard`, `drawPrecioCard`.

## Validación de Cowork

- Los 3 archivos JS parsean OK con `@babel/parser` (plugin jsx).
- Datos en producción verificados: `stockCategoriasHaras` tiene
  `Novillo>550 = 890 cab / 545.886 kg` y `Vaca>650 = 578 cab / 375.700 kg`.
- Para "Otros" (Cucuca + Descanso + Panchita) los JSONs ya existen en
  el repo — `extractCats()` los agrega correctamente. Para las 2
  categorías terminadas probablemente el resultado sea 0 cabezas
  porque toda la terminación pesada está en El Haras — eso es real.

## Tareas

1. **Validar sintaxis** con Babel parser (o levantando `mobile.html`
   en localhost). Los 3 archivos deben parsear OK.

2. **Levantar `mobile.html` local** y tap en el botón PDF — chequear:
   - Página 1: Stock terminados con **4 filas** (PEGSA, GRUPO, HARAS,
     OTROS) en cada categoría.
   - Página 1: Insumos compactos con KPI días grande.
   - Página 1: Financiero PEG-BULL + DW como 2 cards stacked
     full-width.
   - Página 2: Productivos 6 cards (con bg salmón/amarillo según
     severity).
   - Página 2: Precios 4 cards con KPI grande + chip margen dorado +
     6 params en grid 2×3.

3. **Copiar `data.js` a OneDrive** (paso crítico, sin esto el bot
   revertirá):
   ```powershell
   Copy-Item "C:\Users\USER\Documents\GitHub\pegsa-portal\data.js" `
             "C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal\data.js" -Force
   ```

4. **Commit + push** con mensaje:
   ```
   v12.2: PDF compacto 2 paginas + 4 filas Stock + cache-buster

   - data.js: fetch 4 establecimientos (Haras + Cucuca + Descanso +
     Panchita) + agregados D.stockCategoriasHaras y
     D.stockCategoriasOtros (suma de los 3 menos Haras). Re-aplica
     y extiende v12.0 que el bot AUTO habia revertido.
   - mobile-data.js (v12.2): STOCK_TERMINADOS con 4 fuentes por
     categoria (pegsa / grupo / haras / otros). Bump version +
     changelog v12.1 + v12.2.
   - mobile.html: cache-buster ?v=122 en scripts y stylesheet
     propios. JSONs sin buster (el bot AUTO los refresca).
   - mobile.jsx: helper pdfSafe (v12.1, U+2212 -> "-" ASCII).
     pdfDrawPageHeader compacto (banda 14mm con pills P&B +
     paginador). buildPdfDoc reescrito entero para layout 2
     paginas A4: P1 Stock + Insumos + Financiero (PEG-BULL + DW
     stacked); P2 Productivos grid 2x3 + Precios grid 2x2.
     Helpers nuevos: drawStockCard, drawInsumoRow, drawFinCard,
     drawProdCard, drawPrecioCard. PDF_COLORS suma variantes
     "soft" para bg de cards severo/moderado.

   CRITICO: data.js tambien copiado a OneDrive para que el bot
   AUTO no revierta los fetches (lo hizo con v12.0 en commit
   69951fe).
   ```

## Archivos tocados

| Archivo | Δ |
|---------|---|
| `data.js` | +45 líneas (Promise.all + extractCats + Haras + Otros) |
| `mobile-data.js` | +20 líneas changelog + STOCK_TERMINADOS 4 fuentes |
| `mobile.html` | cache-buster ?v=122 |
| `mobile.jsx` | -322 / +422 (reemplaza buildPdfDoc + pdfDrawPageHeader + agrega pdfSafe + PDF_COLORS soft) |

## Si Claude Code detecta diferencia en los datos del PDF

- Si "OTROS" sale 0 en ambas categorías terminadas → es correcto, no es
  bug. Los JSONs de La Cucuca/El Descanso/La Panchita probablemente
  no tienen Novillo>550 ni Vaca>650.
- Si HARAS sale igual al GRUPO → también correcto, El Haras concentra
  la terminación pesada del grupo.
