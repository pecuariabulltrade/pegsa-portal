# AUDIT — Panel Principal (`app.jsx`)

**Fecha**: 2026-05-13
**Branch**: main · HEAD `5ed7d3f` (auto-commit sobre `66b8cee` "Sidebar 2 grupos")
**Archivo auditado**: `app.jsx` (435 líneas)
**Fuente de verdad**: JSONs del repo + shape de `D = window.PEGSA_DATA` definido en `data.js`

---

## Resumen ejecutivo

El Panel Principal muestra al menos **15 valores hardcoded** en `app.jsx`. De ellos:

- **4 son críticos (P0)** y corresponden exactamente al bug reportado por el usuario: los KPIs de Stock PEGSA y Stock Total Grupo (cabezas + toneladas) están escritos como string literal en JSX, sin leer `D.hero.stock.*`. Por eso el Panel quedó anclado a los valores demo aunque `data.js` cargue los JSONs reales.
- **3 son medios (P1)**: tarjetas de Tesorería, Rentabilidad y los 2 chips de Mercado fuera del map (Ternero E&C, MEP). Tienen el dato en `D.*` pero el JSX usa literales.
- **5 son cosméticos / de período (P2)**: período del header, "Actualizado · 25/04/2025 07:00 AM", deltas "+5,1%" hardcoded en las 2 cards de Stock, fecha "Cierre 25/04" en MEP.
- **3 son "huérfanos" (P3)**: no existe campo en ningún JSON del repo para alimentarlos. Hay que decidir si calcularlos en `data.js` o sacarlos del UI.

> **Nota sobre HEAD**: el commit `66b8cee` que mencionaba la consigna sigue en la historia (HEAD~1). El bot de auto-commits horarios siguió corriendo (`5890c97`…`5ed7d3f`) pero solo modifica JSONs/timestamps, no `app.jsx`.

---

## 🔴 P0 · Crítico — Los 4 valores inconsistentes que detectaste

Todos están en el bloque "TIER 1 · STOCK (XL)" del subkpi-row (app.jsx:181-192).

| # | Línea | Valor hardcoded | Valor REAL hoy | Campo D.* | JSON origen |
|---|---|---|---|---|---|
| **P0-1** | `app.jsx:185` | `8.651` cab | **8.963** cab | `D.hero.stock.pegsa.cabezas` | `stock_kpis_2025.json` → `kpis.por_propietario.PEGSA.cabezas` |
| **P0-2** | `app.jsx:186` | `3.626 t proyectadas` | **4.044 t** estimadas hoy | `D.hero.stock.pegsa.kg` (÷1000) | `stock_kpis_2025.json` → `kpis.por_propietario.PEGSA.kg_estimado` |
| **P0-3** | `app.jsx:190` | `9.861` cab | **10.035** cab | `D.hero.stock.total.cabezas` | `stock_kpis_2025.json` → `kpis.total_cabezas` |
| **P0-4** | `app.jsx:191` | `4.324 t · 3 establecimientos` | **4.463 t · 4 establecimientos** | `D.hero.stock.total.kg` (÷1000) + `D.hero.stock.total.establecimientos` | `stock_kpis_2025.json` → `kpis.total_kg_estimado_hoy` + `kpis.total_establecimientos` |

**Bug doble en P0-4**: además de los kilos, el "3 establecimientos" es incorrecto para el Grupo — el JSON reporta 4 (El Haras, El Descanso, La Panchita, La Cucuca). El "3" solo es correcto para PEGSA propio (El Haras, El Descanso, La Cucuca — coincide con `stock_prop_PEGSA_2025.json.kpis.total_establecimientos`). Confusión PEGSA vs Grupo en el subtítulo.

**Diagnóstico raíz**: `data.js` líneas 121-128 SÍ actualiza `D.hero.stock.*` con datos reales del JSON. El problema es que `app.jsx` NUNCA lee `D.hero.stock.*` en las cards XL — usa literales `8.651`, `9.861`, etc. directamente en el JSX. El componente `<Panel>` ya tiene `const D = window.PEGSA_DATA` (línea 118), o sea que el fix es de 4 líneas.

**Fix propuesto** (P0-1 a P0-4 de una vez):

```jsx
// app.jsx:183-192 — reemplazar bloque completo
<div className="subkpi size-xl" data-group="stock" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "stock-masa"))}>
  <div className="subkpi-label"><span>Stock PEGSA</span><span className="delta">+5,1%</span></div>
  <div className="subkpi-value" style={{ color: "var(--primary-deep)" }}>
    {(D.hero?.stock?.pegsa?.cabezas || 0).toLocaleString("es-AR")}<span className="u">cab</span>
  </div>
  <div className="subkpi-meta">
    <span>{((D.hero?.stock?.pegsa?.kg || 0) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} t estimadas</span>
    <span style={{ width: 100, height: 28, flexShrink: 0 }}><Sparkline data={D.sparks.stockKg} color="var(--primary)" height={28} fill={true} strokeWidth={1.6} /></span>
  </div>
</div>
<div className="subkpi size-xl" data-group="stock" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "stock-masa"))}>
  <div className="subkpi-label"><span>Stock Total · Grupo</span><span className="delta">+5,1%</span></div>
  <div className="subkpi-value" style={{ color: "var(--primary-deep)" }}>
    {(D.hero?.stock?.total?.cabezas || 0).toLocaleString("es-AR")}<span className="u">cab</span>
  </div>
  <div className="subkpi-meta">
    <span>
      {((D.hero?.stock?.total?.kg || 0) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} t · {D.hero?.stock?.total?.establecimientos || 0} establecimientos
    </span>
    <span style={{ width: 100, height: 28, flexShrink: 0 }}><Sparkline data={D.sparks.stockKg} color="var(--primary)" height={28} fill={true} strokeWidth={1.6} /></span>
  </div>
</div>
```

Nota terminológica: cambié "proyectadas" → "estimadas" porque el campo del JSON es `kg_estimado_hoy`, no proyección al cierre. Si querés mantener "proyectadas" decime y dejo el copy igual aunque el dato sea estimado-hoy.

---

## 🟡 P1 · Medio — Hardcodes con dato disponible en D.*

| # | Línea | Hardcoded | Campo D.* | JSON origen | Nota |
|---|---|---|---|---|---|
| **P1-1** | `app.jsx:244` | `25 abr '25` (fecha tesorería) | `D.tesoreria.semana` ("25/04") | `tesoreria_ultimo.json` → `fecha_corte` | `data.js:187` ya lo parsea. Formato "DD MMM 'YY" hay que armar a mano. |
| **P1-2** | `app.jsx:245` | `Cartera cheques $1.130 M` | `D.tesoreria.cartera` | `tesoreria_ultimo.json` → `cheques.total_cartera` | Formatear como $X.XXX M |
| **P1-3** | `app.jsx:278` | `$ 5.097` (Ternero E&C) | `D.mercado.ternero.precio` | `mercado_precios.json` → `terneros_esyc[330-370]` | El campo existe (`data.js:166,172`) pero la card está fuera del `.map()` de mercado. Mover al map o usar `D.mercado.ternero.precio`. |
| **P1-4** | `app.jsx:283` | `$ 1.430` (MEP) | `D.mercado.mep.precio` | `mercado_precios.json` → `insumos.dolar` o `insumos.mep` | `data.js:173-174` lo carga. |

---

## 🟠 P2 · Cosmético / período / deltas

| # | Línea | Hardcoded | Campo D.* | JSON origen |
|---|---|---|---|---|
| **P2-1** | `app.jsx:132` | `PERÍODO ENERO – DICIEMBRE 2025` | `D.periodo` ("Enero – Diciembre 2025") | hardcoded en `data.js:7` |
| **P2-2** | `app.jsx:133` | `PECUARIA EL GARABÍ SA & BULLTRADE SRL` | `D.empresa` | `data.js:8` |
| **P2-3** | `app.jsx:161` | `Actualizado · 25/04/2025 07:00 AM` | (no existe) | **FALTANTE** — ver P3 |
| **P2-4** | `app.jsx:184` | `+5,1%` (delta Stock PEGSA) | (no existe) | **FALTANTE** — ver P3 |
| **P2-5** | `app.jsx:189` | `+5,1%` (delta Stock Grupo) | (no existe) | **FALTANTE** — ver P3 |
| **P2-6** | `app.jsx:284` | `Cierre 25/04` (MEP) | (no existe directo) | `mercado_precios.json` → `fecha` ("2026-05-13"). Hay que derivarlo. |

---

## 🔵 P3 · Hardcodes "huérfanos" (no hay fuente en JSON)

Estos requieren decidir: o se calculan dentro de `data.js` desde otro dataset, o se sacan del UI hasta tener fuente.

| # | Línea | Hardcoded | Qué representa | Acción sugerida |
|---|---|---|---|---|
| **P3-1** | `app.jsx:161` | `Actualizado · 25/04/2025 07:00 AM` | Última actualización del portal | Usar `stock_kpis_2025.json.meta.generado` (`"2026-05-13T17:01:22"`). Ya disponible, solo falta exponerlo en `D.lastUpdate` desde `data.js`. Existe además `ultima_actualizacion.json` en el repo (no leído todavía). |
| **P3-2** | `app.jsx:184, 189` | `+5,1%` (delta Stock) | Variación de stock vs período anterior | Calculable desde `stock_diario.snapshots` comparando primer vs último snapshot. Hay que sumarlo a `data.js` (al lado del bloque que arma `sparks.stockKg`). |
| **P3-3** | `app.jsx:247-250` | Card "Rentabilidad acum. s/Vta · +7,3%" | Rentabilidad acumulada sobre ventas | `D.hero.resultado.rentabilidadAcum` existe en `data.js:12` pero nadie lo refresca desde JSON. `financiero_historico.json` y `negocios_resumen.json` podrían tenerlo — hay que inspeccionar. Mientras tanto, en `app.jsx:249` lee literal "+7,3" en vez de `D.hero.resultado.rentabilidadAcum`. |

---

## Hardcodes "de segundo nivel" (en `data.js`, no en app.jsx)

Lo siguiente NO está hardcoded en JSX (el JSX sí lee `D.*`), pero el VALOR de `D.*` es un demo en `data.js` que el fetch loop nunca actualiza. Out-of-scope de P1 pero conviene anotarlo:

- `D.usuario` (`data.js:9`) — "Miguel Acosta · Gerencia · 2025"
- `D.hero.resultado.*` (`data.js:12`) — operativo, tenencia, márgenes, rentabilidadAcum
- `D.centros[]` (`data.js:24-34`) — 9 centros de negocio con ingresos/egresos/operativo
- `D.heatmap.centros[]` (`data.js:65-74`) — 12 meses × 8 centros, todo demo
- `D.modulos[]` (`data.js:77-86`) — los KPIs/descripciones; algunos sí se actualizan (`m3`, `m5`, `m6`) en `data.js:257-268`, pero `m1` (estado-resultados kpi="+$9.191.348.874"), `m2`, `m7`, `m8` quedan demo.

---

## Plan sugerido de aplicación

1. **Sprint 1 — P0** (4 hardcodes, 1 bloque de JSX): elimina inmediatamente el bug visible al usuario. ~10 min, riesgo bajo (los campos D.* ya están poblados por data.js). Verificación: abrir Panel y comparar contra Módulo Stock.
2. **Sprint 2 — P1** (4 hardcodes): tesorería 25 abr, $1.130 M cartera, Ternero E&C $5.097, MEP $1.430. ~15 min.
3. **Sprint 3 — P2** (6 hardcodes cosméticos): período, empresa, "Actualizado", "Cierre 25/04" — bajo impacto pero quita 6 fechas obsoletas.
4. **Sprint 4 — P3 (huérfanos)**: agregar `D.lastUpdate`, calcular deltas de stock desde `stock_diario.snapshots`, decidir qué hacer con la card de rentabilidad. ~30 min + decisiones.
5. **Sprint 5 — segundo nivel**: refrescar `D.hero.resultado`, `D.centros`, `D.heatmap` desde `financiero_historico.json`/`negocios_resumen.json`. Trabajo grande, separar como tarea aparte.

---

## Apéndice — Datos reales del Grupo hoy (`stock_kpis_2025.json`, generado 2026-05-13T17:01:22)

```
Total Grupo:    10.035 cab · 4.462.566 kg · 4 establecimientos
  ├─ PEGSA:      8.963 cab · 4.043.973 kg (3 estab: El Haras, El Descanso, La Cucuca)
  ├─ Ricardo Bailo:  258 cab ·   143.112 kg
  ├─ Las Taperas:    293 cab ·   132.217 kg
  ├─ Darwash SA:      72 cab ·    46.526 kg
  └─ Tercio Bravo:   449 cab ·    96.738 kg (La Panchita)

Establecimientos del Grupo:
  ├─ El Haras:    8.197 cab · 4.033.413 kg
  ├─ El Descanso:   570 cab ·   161.304 kg
  ├─ La Panchita:   449 cab ·    96.738 kg
  └─ La Cucuca:     819 cab ·   171.111 kg
```
