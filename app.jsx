/* App.jsx — Panel Principal PEGSA & BULLTRADE rediseñado */

const { useState, useMemo } = React;

function fmtNum(n, opts = {}) {
  return n.toLocaleString("es-AR", opts);
}

function HeroValue({ currency, value, unit, featured }) {
  return (
    <div className="hero-value">
      {currency && <span className="currency">{currency}</span>}
      {value}
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}

// Mapeo: id del Panel React → id que entiende openModule del portal viejo
const _PANEL_TO_PORTAL_ID = {
  "estado-resultados": "resultados",
  "flujo-fondos": "flujo",
  "stock-masa": "stock",
  "stock-insumos": "insumos",
  "mercado": "mercado",
  "tesoreria": "tesoreria",
  "simulador": "simulador",
  "historico": "historico",
  "parametros-base": "baseparams"
};
function goToPortalModule(panelId, tab) {
  var portalId = _PANEL_TO_PORTAL_ID[panelId] || panelId;
  if (typeof window.openModule === "function") {
    window.openModule(portalId);
  } else if (typeof window.showScreen === "function") {
    window.showScreen("screen" + portalId.charAt(0).toUpperCase() + portalId.slice(1));
  }
  // v9: activar tab interna opcional (ej. mercado → "inferencia").
  if (tab) {
    setTimeout(function () {
      try {
        var tabFn = window[portalId + "Tab"];
        var tabEl = document.getElementById(portalId + "Tab" +
          tab.charAt(0).toUpperCase() + tab.slice(1));
        if (typeof tabFn === "function") tabFn(tab, tabEl);
      } catch (e) { console.warn("[panel] tab switch falló", e); }
    }, 200);
  }
}

// Widget Precios de Indiferencia para el panel principal
function IndiferenciaWidget() {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    fetch("./precios_indiferencia_historico.json")
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data || !data.dias || !Object.keys(data.dias).length) return null;
  const fechas = Object.keys(data.dias).sort();
  const hoy    = data.dias[fechas[fechas.length - 1]] || {};
  const prev   = fechas.length > 1 ? data.dias[fechas[fechas.length - 2]] : null;
  const cats   = data.categorias || [];

  const fmt = (n) => n != null ? "$ " + Math.round(n).toLocaleString("es-AR") : "—";

  const goToIndiferencia = () => {
    if (typeof window.openModule === "function") {
      window.openModule("mercado");
      setTimeout(() => {
        const tab = document.getElementById("mercadoTabIndiferencia");
        if (tab && typeof window.mercadoTab === "function") {
          window.mercadoTab("indiferencia", tab);
        }
      }, 200);
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 4px 12px" }}>
        <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink)", fontWeight: 700 }}>
          Precios de Indiferencia · Objetivo $100k/cab
        </div>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-mute)", fontWeight: 600 }}>
          Click → Mercado · Indiferencia
        </span>
      </div>
      <div className="subkpi-row">
        {cats.map(c => {
          const d = hoy[c.label] || {};
          const dPrev = prev ? (prev[c.label] || {}) : {};
          const pi = d.pi_kg;
          const delta = (pi && dPrev.pi_kg) ? (pi - dPrev.pi_kg) : null;
          const pct = (pi && dPrev.pi_kg) ? (delta / dPrev.pi_kg * 100) : null;
          return (
            <div
              key={c.label}
              className="subkpi size-sm"
              data-group="mercado"
              onClick={goToIndiferencia}
              style={{ cursor: "pointer" }}
            >
              <div className="subkpi-label">
                <span>{c.nombre_corto}</span>
                {pct != null && (
                  <span className={`delta ${delta < 0 ? "neg" : ""}`}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="subkpi-value" style={{ color: "var(--primary-deep)" }}>{fmt(pi)}</div>
              <div className="subkpi-meta">
                <span>{c.pesoE}→{d.pesoS || "—"} kg · {d.dias != null ? d.dias + "d" : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === Helpers Sprint 5 ===

// Saludo dinámico según hora del día
function getSaludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buen día";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

// Fecha completa en es-AR, mayúsculas
function fechaLargaUpper() {
  const f = new Date();
  const dias  = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
  const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  return `${dias[f.getDay()]} ${f.getDate()} DE ${meses[f.getMonth()]} DE ${f.getFullYear()}`;
}

// Hash estable de alerta (tipo + texto) para localStorage descartadas
function hashAlerta(a) {
  const s = (a.tipo || '') + '|' + (a.texto || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return 'a_' + Math.abs(h).toString(36);
}

// LocalStorage key + helpers para alertas descartadas
const ALERTAS_LS_KEY = 'pegsa_alertas_descartadas';
const SIETE_DIAS_MS = 7 * 86400000;

// Carga el set de hashes descartados podando entradas > 7 días
function cargarDescartadas() {
  try {
    const raw = JSON.parse(localStorage.getItem(ALERTAS_LS_KEY) || '{}');
    const ahora = Date.now();
    const limpio = {};
    Object.entries(raw).forEach(([k, ts]) => {
      if (typeof ts === 'number' && ahora - ts < SIETE_DIAS_MS) limpio[k] = ts;
    });
    if (Object.keys(limpio).length !== Object.keys(raw).length) {
      localStorage.setItem(ALERTAS_LS_KEY, JSON.stringify(limpio));
    }
    return new Set(Object.keys(limpio));
  } catch (e) { return new Set(); }
}

// Persiste una alerta descartada con timestamp
function descartarAlertaLS(hash) {
  try {
    const raw = JSON.parse(localStorage.getItem(ALERTAS_LS_KEY) || '{}');
    raw[hash] = Date.now();
    localStorage.setItem(ALERTAS_LS_KEY, JSON.stringify(raw));
  } catch (e) { /* localStorage no disponible */ }
}

// Sub-componente "Actualizado · hace X min" con auto-refresh cada 60s
function LastUpdate({ iso }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, [iso]);

  const style = { fontSize: 12, color: "var(--ink-mute)" };
  if (!iso) return <span style={style}>Actualizado recientemente</span>;

  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return <span style={style}>Actualizado recientemente</span>;

  const diffMin = Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000));
  let label;
  if (diffMin < 60) label = `hace ${diffMin} min`;
  else if (diffMin < 1440) label = `hace ${Math.floor(diffMin / 60)} h`;
  else label = `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')} ${String(fecha.getHours()).padStart(2,'0')}:${String(fecha.getMinutes()).padStart(2,'0')}`;

  return <span style={style}>Actualizado · {label}</span>;
}

/* ============================================================
   v9 · ProductivosSection — espejo del mobile.
   Card minimal → tap toggle → expand inline con CTA al módulo
   Stock de Masa (donde vive la tab "📈 Productivo").
   ============================================================ */
const _PROD_BETTER_WHEN = {
  engordeDiario:    "up",
  estadia:          "down",
  pctPV:            "up",
  consumoPorCabeza: "flat",
  conversion:       "down",
  kgRepartidos:     "flat"
};
function _classifyProd(id, p, delta) {
  var bw = _PROD_BETTER_WHEN[id] || (p && p.mejorEs === "menor" ? "down" : p && p.mejorEs === "rango" ? "flat" : "up");
  var intent = "neutral";
  if (bw === "flat" || delta == null || delta === 0) intent = "neutral";
  else if (bw === "down") intent = delta < 0 ? "good" : "bad";
  else intent = delta > 0 ? "good" : "bad";
  var abs = delta == null ? 0 : Math.abs(delta);
  var severity = abs > 20 ? "severo" : (abs >= 10 ? "moderado" : "neutro");
  var chipTone = (severity === "neutro" || intent === "neutral") ? "neutral" : intent;
  var cardTone = (severity === "severo" && intent !== "neutral") ? intent : "neutral";
  return { intent: intent, severity: severity, chipTone: chipTone, cardTone: cardTone };
}
function _fmtV(v, dec) {
  if (v == null || isNaN(v)) return "—";
  if (dec != null) return Number(v).toFixed(dec).replace(".", ",");
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("es-AR");
  if (Math.abs(v) >= 100)  return Math.round(v).toString();
  if (Math.abs(v) >= 10)   return Number(v).toFixed(1).replace(".", ",");
  return Number(v).toFixed(2).replace(".", ",");
}
function ProductivosSection({ D }) {
  const [openK, setOpenK] = useState(null);
  const prod = D.productivos || {};
  const CARDS = [
    { id: "engordeDiario",    title: "Engorde diario" },
    { id: "estadia",          title: "Estadía" },
    { id: "pctPV",            title: "Eficiencia (% PV)" },
    { id: "consumoPorCabeza", title: "Consumo / cabeza" },
    { id: "conversion",       title: "Conversión" },
    { id: "kgRepartidos",     title: "Kg repartidos · últ. día" },
  ];
  const cards = CARDS.map(c => {
    const p = prod[c.id];
    if (!p) return { ...c, missing: true };
    const a = p.actual || {}, h = p.historico || {};
    const aN = _fmtV(a.v, a.decimals);
    const hN = _fmtV(h.v, h.decimals);
    let delta = null;
    if (a.v != null && h.v != null && h.v !== 0) {
      delta = ((a.v - h.v) / Math.abs(h.v)) * 100;
    }
    const klass = _classifyProd(c.id, p, delta);
    const deltaFmt = delta != null
      ? (delta >= 0 ? "+" : "−") + Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0).replace(".", ",") + "%"
      : null;
    const arrow = delta == null ? "·" : (delta > 0 ? "↑" : (delta < 0 ? "↓" : "·"));
    return { ...c, p, a, h, aN, hN, delta, deltaFmt, arrow, ...klass };
  });
  return (
    <div className="prod-section">
      <div className="prod-section-head">
        <h2>Productivos</h2>
        <span className="prod-section-sub">
          Último mes · variación vs histórico · semáforo &gt;20% / 10–20% / &lt;10%
        </span>
      </div>
      <div className="prod-grid prod-grid-desktop">
        {cards.map(c => {
          const isOpen = openK === c.id;
          return (
            <div
              key={c.id}
              className={
                "prod-card" +
                (c.missing ? " is-missing" : "") +
                " lvl-" + (c.severity || "neutro") +
                " card-tone-" + (c.cardTone || "neutral") +
                (isOpen ? " is-open" : "")
              }
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => !c.missing && setOpenK(isOpen ? null : c.id)}
              onKeyDown={(e) => {
                if (!c.missing && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault(); setOpenK(isOpen ? null : c.id);
                }
              }}
              title={c.p && c.p.descripcion ? c.p.descripcion : c.title}
            >
              <div className="prod-eyebrow">{c.title}</div>
              {c.missing ? (
                <>
                  <div className="prod-big"><span className="prod-big-num">—</span></div>
                  <div className="prod-divider" />
                  <div className="prod-foot">
                    <span className="prod-foot-lab">sin datos</span>
                    <span className="prod-foot-val">N/D</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="prod-big">
                    <span className="prod-big-num">{c.aN}</span>
                    {c.a.unit ? <span className="prod-big-unit">{c.a.unit}</span> : null}
                  </div>
                  <div className="prod-divider" />
                  <div className="prod-foot">
                    <span className="prod-foot-lab">vs {c.h.label || "histórico"}</span>
                    <span className="prod-foot-val">{c.hN}{c.h.unit ? " " + c.h.unit : ""}</span>
                  </div>
                  {c.deltaFmt && (
                    <span className={"prod-chip chip-tone-" + (c.chipTone || "neutral")}>
                      <span className="prod-chip-arr">{c.arrow}</span>
                      {c.deltaFmt}
                    </span>
                  )}
                  {isOpen && (
                    <div className="prod-expand">
                      <button
                        className="btn-pill-outline"
                        onClick={(e) => { e.stopPropagation(); goToPortalModule("stock-masa"); }}
                      >
                        Ver módulo Producción →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   v9 · PreciosInferenciaSection — espejo del mobile.
   Card minimal → tap toggle → expand con grid de params,
   caja MARGEN ESTIMADO/CAB con chip semaforizada y botón solid
   "Ver en Mercado →" (módulo "mercado", tab interna "inferencia"
   agregada en v8).
   ============================================================ */
function PreciosInferenciaSection({ D }) {
  // v12.3: multi-open en lugar de acordeón exclusivo. Cada card abre/cierra
  // independiente y el usuario puede dejar las 4 expandidas a la vez.
  const [openMap, setOpenMap] = useState({});
  const toggleOpen = (id) => setOpenMap(m => ({ ...m, [id]: !m[id] }));
  const items = Array.isArray(D.preciosInferencia) ? D.preciosInferencia : [];
  const meta  = D.preciosInferenciaMeta || {};
  if (!items.length) return null;

  const fechaLabel = meta.fecha ? meta.fecha.split("-").reverse().join("/") : "—";
  const fmtMoney = (n) => n != null ? "$ " + Math.round(n).toLocaleString("es-AR") : "—";
  const fmtCompact = (n) => {
    if (n == null || isNaN(n)) return "—";
    const a = Math.abs(n); const s = n < 0 ? "−" : "";
    if (a >= 1e6) return s + "$ " + (a / 1e6).toFixed(1).replace(".", ",") + " M";
    if (a >= 1e4) return s + "$ " + Math.round(a / 1e3) + "k";
    if (a >= 1e3) return s + "$ " + (a / 1e3).toFixed(1).replace(".", ",") + "k";
    return s + "$ " + Math.round(a);
  };
  const fmtPct = (n) => n != null ? Math.round(n * 100) + " %" : "—";
  const splitNombre = (n) => {
    if (!n) return { base: "—", sub: "" };
    const m = String(n).match(/^(.*?)\s+(\d+\s*d[ií]as?)$/i);
    if (m) return { base: m[1], sub: "· " + m[2].toLowerCase() };
    return { base: n, sub: "" };
  };

  return (
    <div className="prinf-section">
      <div className="prinf-section-head">
        <h2>Precios de inferencia</h2>
        <span className="prinf-section-sub">
          Precio compra calculado · simulador semanal · {fechaLabel}
        </span>
      </div>
      <div className="prinf-grid prinf-grid-desktop">
        {items.map(it => {
          const nom = splitNombre(it.nombre);
          const isOpen = !!openMap[it.id];
          // v12.3: el cálculo de margen se eliminó del panel — el bloque
          // .prinf-margen se borró del expand. El margen sigue calculado
          // en mobile-data.js porque el PDF v12.2+ lo muestra como chip.
          return (
            <div
              key={it.id}
              className={"prinf-card" + (isOpen ? " is-open" : "")}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => toggleOpen(it.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault(); toggleOpen(it.id);
                }
              }}
              title={"Calculado el " + fechaLabel}
            >
              <div className="prinf-head">
                <div className="prinf-titles">
                  <div className="prinf-cat">{nom.base}</div>
                  {nom.sub ? <div className="prinf-sub-cat">{nom.sub}</div> : null}
                </div>
                <span className="prinf-chev" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
              </div>
              <div className="prinf-big">
                <span className="prinf-big-sym">$</span>
                <span className="prinf-big-num">{it.precio_comp != null ? Math.round(it.precio_comp).toLocaleString("es-AR") : "—"}</span>
                <span className="prinf-big-unit">/kg</span>
              </div>
              {isOpen && (
                <div className="prinf-expand">
                  <div className="prinf-divider" />
                  <div className="prinf-params-grid">
                    <div><span>Compra</span><strong>{it.kg_compra != null ? Math.round(it.kg_compra) + " kg" : "—"}</strong></div>
                    <div><span>Días feedlot</span><strong>{it.dias_feed != null ? Math.round(it.dias_feed) + " d" : "—"}</strong></div>
                    <div><span>Venta</span><strong>{it.kg_venta != null ? Math.round(it.kg_venta) + " kg" : "—"}</strong></div>
                    <div><span>Rinde</span><strong>{fmtPct(it.rinde)}</strong></div>
                    <div><span>Precio venta</span><strong>{fmtCompact(it.precio_venta)}/kg</strong></div>
                    <div><span>Costo prod</span><strong>{fmtCompact(it.cost_kg_prod)}</strong></div>
                  </div>
                  {/* v12.3: bloque .prinf-margen eliminado del panel. */}
                  <button
                    className="btn-solid-primary"
                    onClick={(e) => { e.stopPropagation(); goToPortalModule("mercado", "inferencia"); }}
                  >
                    Ver en Mercado →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   v11 · FinancieroCard — espejo desktop de la card "Financiero ·
   saldo proyectado". Acepta `flujo` (D.flujoSemanal o D.flujoSemanalDW),
   `title`, `sub` y `onClick` para reusarse en PEG-BULL y DW. Early
   return cuando no hay datos.
   ============================================================ */
function FinancieroCard({ flujo, title, sub, onClick, onKeyDown }) {
  if (!flujo) return null;
  const fmtMontoM = (n) => {
    if (n == null) return "—";
    const abs = Math.abs(n); const sign = n < 0 ? "−" : "";
    return sign + "$" + Math.round(abs / 1e6).toLocaleString("es-AR") + " M";
  };
  return (
    <div className="flujo-semanal-card" role="button" tabIndex={0}
         onClick={onClick} onKeyDown={onKeyDown}>
      <div className="chart-card-head">
        <div>
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        <span className="chart-card-chip">Sem {flujo.semanaNumActual} · {flujo.anioActual}</span>
      </div>
      {flujo.cierrePrimera && (
        <div className={`saldo-cierre-box ${flujo.cierrePrimera.signo}`}>
          <div className="saldo-cierre-label">Cierre · {flujo.cierrePrimera.rangoLabel}</div>
          <div className="saldo-cierre-val">{fmtMontoM(flujo.cierrePrimera.valor)}</div>
        </div>
      )}
      <div className="saldo-bars">
        {(() => {
          const maxAbs = Math.max(1, ...flujo.semanas.map(s => Math.abs(s.saldoAcumulado)));
          // v11.1: eje cero al 50%, label numérico flotante, pos/neg con color.
          return flujo.semanas.map((s, i) => {
            const v = s.saldoAcumulado;
            const isPos = v >= 0;
            const heightPct = (Math.abs(v) / maxAbs) * 48;  // 48% del track → bandas claras
            const fillStyle = isPos
              ? { bottom: "50%", height: `${heightPct}%` }
              : { top:    "50%", height: `${heightPct}%` };
            const numStyle = isPos
              ? { bottom: `calc(50% + ${heightPct}% + 2px)` }
              : { top:    `calc(50% + ${heightPct}% + 2px)` };
            return (
              <div key={i} className={`saldo-bar-cell ${s.estado}`}
                   title={`${s.label}: ${fmtMontoM(v)}`}>
                <div className="saldo-bar-track">
                  <div className="saldo-bar-axis" />
                  <div className={`saldo-bar-fill ${isPos ? "pos" : "neg"}`}
                       style={fillStyle} />
                  <div className={`saldo-bar-num ${isPos ? "pos" : "neg"}`}
                       style={numStyle}>
                    {fmtMontoM(v)}
                  </div>
                </div>
                <div className="saldo-bar-label">{s.label}</div>
              </div>
            );
          });
        })()}
      </div>
      {flujo.saldoInicial != null && (
        <div className="saldo-partida-row">
          <span className="saldo-partida-label">Saldo de partida</span>
          <span className={`saldo-partida-val ${flujo.saldoInicial < 0 ? "neg" : "pos"}`}>
            {fmtMontoM(flujo.saldoInicial)}
          </span>
        </div>
      )}
      {flujo.cierreFinal && (
        <div className={`cover-row ${flujo.cierreFinal.signo}`}>
          <div>
            <div className="cover-label">Saldo proyectado</div>
            <div className="cover-sub">Cierre semana {flujo.cierreFinal.label}</div>
          </div>
          <div className={`cover-val ${flujo.cierreFinal.signo}`}>
            {fmtMontoM(flujo.cierreFinal.valor)}
          </div>
        </div>
      )}
    </div>
  );
}

function Panel() {
  const D = window.PEGSA_DATA;
  const [drillModulo, setDrillModulo] = useState(null);
  const [heatPeriod, setHeatPeriod] = useState("12m");
  const [alertasDescartadas, setAlertasDescartadas] = useState(() => cargarDescartadas());

  const sortedCentros = useMemo(() => D.centros.slice().sort((a, b) => b.total - a.total), [D.centros]);

  return (
    <>
      <Topbar periodo={D.periodo} />

      <div className="content">
        {/* Page header (Sprint 5 — B.1: saludo dinámico "Buen día, dirección") */}
        {(() => {
          const alertasVisibles = (D.alertas || []).filter(a => !alertasDescartadas.has(hashAlerta(a)));
          const nAlertas = alertasVisibles.length;
          const subTexto = nAlertas > 0
            ? `${nAlertas} alerta${nAlertas === 1 ? '' : 's'} ${nAlertas === 1 ? 'requiere' : 'requieren'} atención · resumen ejecutivo del portal`
            : "Sin alertas activas · resumen ejecutivo del portal";
          return (
            <div className="page-head">
              <div className="page-eyebrow">{fechaLargaUpper()}</div>
              <h1 className="page-title">{getSaludo()}, <em>dirección</em></h1>
              <p className="page-sub">{subTexto}</p>
            </div>
          );
        })()}

        {/* Alerts (Sprint 5 — B.3: dismiss + localStorage) */}
        {(() => {
          const alertasVisibles = (D.alertas || []).filter(a => !alertasDescartadas.has(hashAlerta(a)));
          if (alertasVisibles.length === 0) {
            // Sin alertas: solo mostrar el bloque derecho (Actualizado + Exportar)
            return (
              <div className="alerts-row alerts-row--empty">
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <LastUpdate iso={D.lastUpdate} />
                  <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
                    <IconExport /> Exportar
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div className="alerts-row">
              {alertasVisibles.map((a, i) => {
                const h = hashAlerta(a);
                const navigable = a.action === 'open-stock-materiaseca';
                const onClick = navigable ? () => {
                  if (typeof window.openModule === 'function') {
                    window.openModule('stock');
                    setTimeout(() => {
                      if (typeof window.stockTab === 'function') {
                        const tab = document.getElementById('stockTabMateriaSeca') || document.querySelector('[onclick*="materiaseca"]');
                        window.stockTab('materiaseca', tab);
                      }
                    }, 200);
                  }
                } : undefined;
                return (
                  <div
                    key={h}
                    className={`alert-chip ${a.tipo}`}
                    onClick={onClick}
                    style={a.action ? { cursor: 'pointer' } : undefined}
                  >
                    <span className="led" />
                    <span className="alert-chip-text">{a.texto}</span>
                    <button
                      className="alert-dismiss"
                      onClick={(e) => {
                        e.stopPropagation();
                        descartarAlertaLS(h);
                        setAlertasDescartadas(prev => new Set([...prev, h]));
                      }}
                      title="Descartar alerta"
                      aria-label="Descartar alerta"
                    >×</button>
                  </div>
                );
              })}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <LastUpdate iso={D.lastUpdate} />
                <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
                  <IconExport /> Exportar
                </button>
              </div>
            </div>
          );
        })()}

        {/* === SECCIÓN 1 · Lo más importante (Sprint 1) === */}
        <div className="section-1-grid">
          {(() => {
            const pegCab = D.hero?.stock?.pegsa?.cabezas || 0;
            const pegKg  = D.hero?.stock?.pegsa?.kg     || 0;
            const totCab = D.hero?.stock?.total?.cabezas || 0;
            const totKg  = D.hero?.stock?.total?.kg     || 0;
            const totEst = D.hero?.stock?.total?.establecimientos || 0;
            const pegEst = D.haciendaPegsaPorEstab?.length || 0;
            const hotCab = D.hoteleros?.cabezas != null ? D.hoteleros.cabezas : Math.max(0, totCab - pegCab);
            const var12m = D.stockVar12m;
            const fmtCab = (n) => n.toLocaleString("es-AR");
            const fmtKg  = (n) => n.toLocaleString("es-AR");
            const fmtPerCab = (kg, cab) => cab > 0 ? Math.round(kg / cab).toLocaleString("es-AR") : "—";
            const fmtVar = (v) => v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1).replace('.', ',') + "%";

            const openStockDrill = () => setDrillModulo(D.modulos.find(x => x.id === "stock-masa"));
            const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStockDrill(); } };

            return (
              <div className="stock-hero">
                <div className="stock-hero-head">
                  <div>
                    <h3>Stock de hacienda</h3>
                    <p>Cabezas y kilogramos · grupo completo</p>
                  </div>
                  <button
                    className="stock-hero-btn"
                    onClick={(e) => { e.stopPropagation(); openStockDrill(); }}
                  >módulo →</button>
                </div>
                <div className="stock-hero-body">
                  <div className="stock-hero-cell" role="button" tabIndex={0} onClick={openStockDrill} onKeyDown={onKey}>
                    <div className="stock-hero-cell-head">
                      <span className="stock-hero-label">PEGSA</span>
                      <span className="stock-hero-pill">propio</span>
                    </div>
                    <div className="stock-hero-big">{fmtCab(pegCab)}<span className="u">cab</span></div>
                    <div className="stock-hero-meta">
                      <span>{fmtKg(pegKg)} kg total</span>
                      <span>{fmtPerCab(pegKg, pegCab)} kg/cab</span>
                      <span>{pegEst} establecimientos</span>
                    </div>
                  </div>
                  <div className="stock-hero-cell" role="button" tabIndex={0} onClick={openStockDrill} onKeyDown={onKey}>
                    <div className="stock-hero-cell-head">
                      <span className="stock-hero-label">GRUPO</span>
                      <span className="stock-hero-pill">total</span>
                    </div>
                    <div className="stock-hero-big">{fmtCab(totCab)}<span className="u">cab</span></div>
                    <div className="stock-hero-meta">
                      <span>{fmtKg(totKg)} kg total</span>
                      <span>{fmtPerCab(totKg, totCab)} kg/cab</span>
                      <span>{totEst} establecimientos</span>
                    </div>
                  </div>
                </div>
                <div className="stock-hero-foot">
                  <div>
                    <span className="stock-hero-foot-label">Variación cabezas 12m</span>
                    <span className={`stock-hero-foot-val ${var12m != null && var12m < 0 ? "neg" : (var12m != null ? "pos" : "")}`}>
                      {fmtVar(var12m)}
                    </span>
                  </div>
                  <div>
                    <span className="stock-hero-foot-label">Hoteleros · cabezas de terceros</span>
                    <span className="stock-hero-foot-val">{fmtCab(hotCab)}<span className="stock-hero-foot-u"> cab</span></span>
                  </div>
                </div>
              </div>
            );
          })()}

          {(() => {
            const openMercado = () => setDrillModulo(D.modulos.find(x => x.id === "mercado"));
            const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMercado(); } };
            const fechaMep = D.mercado.fecha ? D.mercado.fecha.split('-').reverse().slice(0, 2).join('/') : null;

            const cots = [
              { id: 'novillo', label: 'Novillo MAG',  ctx: '$/kg pie · 461/490 kg' },
              { id: 'vaca',    label: 'Vaca MAG',     ctx: '$/kg pie · Vaca buena' },
              { id: 'ternero', label: 'Ternero E&C',  ctx: '$/kg pie · 330–370 kg' },
              { id: 'maiz',    label: 'Maíz BCR',     ctx: '$/tn · Pizarra' },
              { id: 'soja',    label: 'Soja BCR',     ctx: '$/tn · Pizarra' },
              { id: 'mep',     label: 'Dólar MEP',    ctx: fechaMep ? `$/USD · cierre ${fechaMep}` : '$/USD' },
            ];

            return (
              <div className="cot-grid">
                {cots.map(c => {
                  const m = D.mercado[c.id] || {};
                  const precio = m.precio || 0;
                  const delta = m.delta;
                  const prev = (delta != null && delta !== 0) ? precio - delta : null;
                  const pct = (prev && prev > 0) ? (delta / prev * 100) : (delta === 0 ? 0 : null);
                  return (
                    <div key={c.id} className="cot-cell" role="button" tabIndex={0} onClick={openMercado} onKeyDown={onKey}>
                      <div className="cot-line1">
                        <span className="cot-label">{c.label}</span>
                        {pct != null && (
                          <span className={`cot-delta ${pct < 0 ? "neg" : ""}`}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%
                          </span>
                        )}
                      </div>
                      <div className="cot-value">${precio.toLocaleString("es-AR")}</div>
                      <div className="cot-ctx">{c.ctx}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* === SECCIÓN 2 · Insumos críticos === */}
        {Array.isArray(D.insumosCriticos) && D.insumosCriticos.length > 0 && (
          <>
            <div className="section-2-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle" }}>
                <path d="M12 2L13.09 8.26L19 9L14.5 13.5L15.82 19.5L12 16.5L8.18 19.5L9.5 13.5L5 9L10.91 8.26L12 2Z" />
              </svg>
              <span>Insumos críticos</span>
            </div>
            <div className="section-2-grid">
              {D.insumosCriticos.map((it, i) => {
                const stockNeg = it.stock_kg != null && it.stock_kg < 0;
                const stockT = it.stock_kg != null ? (Math.abs(it.stock_kg) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : null;
                const consumoT = it.consumo_kg_dia != null && it.consumo_kg_dia > 0 ? (it.consumo_kg_dia / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 }) + " t/día" : "—";
                const ultCompra = it.fecha_ult_compra || "—";
                const chipLabel = it.estado === 'bad' ? 'CRÍTICO'
                                : it.estado === 'warn' ? 'ATENCIÓN'
                                : it.estado === 'inconsistente' ? 'INCONSISTENTE'
                                : 'OK';
                return (
                  <div
                    key={i}
                    className="insumo-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDrillModulo(D.modulos.find(x => x.id === "stock-insumos"))}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrillModulo(D.modulos.find(x => x.id === "stock-insumos")); } }}
                  >
                    <div className="insumo-card-head">
                      <div className="insumo-card-head-text">
                        <h3>{it.nombre}</h3>
                        {it.descripcion && <p className="insumo-card-desc">{it.descripcion}</p>}
                      </div>
                      <span className={`state-chip ${it.estado}`}>
                        <span className="led" />
                        {chipLabel}
                      </span>
                    </div>
                    <div className="insumo-hero">
                      <div className={`days-big ${it.estado}`}>
                        {it.estado === 'inconsistente' ? (
                          <>
                            <div className="days-big-num">—</div>
                            <div className="days-big-label">stock</div>
                          </>
                        ) : (
                          <>
                            <div className="days-big-num">{it.dias != null ? it.dias.toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "—"}</div>
                            <div className="days-big-label">días</div>
                          </>
                        )}
                      </div>
                      <div className="insumo-meta">
                        <div className="insumo-meta-row">
                          <span className="k">Stock actual</span>
                          <span className={`v${stockNeg ? " neg-stock" : ""}`}>
                            {stockT != null ? (stockNeg ? "−" : "") + stockT + " t" : "—"}
                          </span>
                        </div>
                        <div className="insumo-meta-row">
                          <span className="k">Consumo / día</span>
                          <span className="v">{consumoT}</span>
                        </div>
                        <div className="insumo-meta-row">
                          <span className="k">Última compra</span>
                          <span className="v">{ultCompra}</span>
                        </div>
                      </div>
                    </div>
                    {it.inconsistente && (
                      <div className="insumo-card-warning">
                        ⚠ Stock contable inconsistente — revisar en módulo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* === SECCIÓN 3 · Sub-datos de referencia === */}
        {(() => {
          const fmtMonto = (n) => {
            if (n == null) return '—';
            const abs = Math.abs(n);
            const sign = n < 0 ? '−' : '';
            if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2).replace('.', ',') + ' B';
            if (abs >= 1e6) return sign + '$' + Math.round(abs / 1e6).toLocaleString("es-AR") + ' M';
            return sign + '$' + Math.round(abs).toLocaleString("es-AR");
          };

          const openDrill = (id) => () => setDrillModulo(D.modulos.find(x => x.id === id));
          const onKey = (id) => (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrillModulo(D.modulos.find(x => x.id === id)); }
          };

          // Card 2: Patrimonio USD
          const pUsd = D.patrimonioUsdSerie || [];
          const pUsdLast = pUsd[pUsd.length - 1];
          const pUsdFirst = pUsd[0];
          const pUsdYoy = (pUsdFirst && pUsdFirst.usd > 0 && pUsdLast)
            ? (pUsdLast.usd - pUsdFirst.usd) / pUsdFirst.usd * 100 : null;
          const pUsdLastM = pUsdLast ? (pUsdLast.usd / 1000).toFixed(2).replace('.', ',') : '—';

          // Card 3: Stock kilos diario
          const sKd = D.stockKilosDiarioSerie || [];
          const sKdLast = sKd[sKd.length - 1];
          const sKdFirst = sKd[0];
          const sKdDelta = (sKdFirst && sKdFirst.kg > 0 && sKdLast)
            ? (sKdLast.kg - sKdFirst.kg) / sKdFirst.kg * 100 : null;
          const sKdLastT = sKdLast ? Math.round(sKdLast.kg / 1000).toLocaleString("es-AR") : '—';

          return (
            <div className="section-3-grid">
              {/* v11: Financiero PEG-BULL (existente) + Financiero DW
                  (Darwash, análisis independiente). Misma card reusable
                  componente <FinancieroCard />. Si DW no tiene datos
                  cargados, su card hace early return. */}
              <FinancieroCard
                flujo={D.flujoSemanal}
                title="Financiero · saldo proyectado"
                sub="Saldo bancario proyectado al cierre de cada semana"
                onClick={openDrill("tesoreria")}
                onKeyDown={onKey("tesoreria")}
              />
              <FinancieroCard
                flujo={D.flujoSemanalDW}
                title="Financiero DW · saldo proyectado"
                sub="Análisis financiero independiente · Darwash"
                onClick={openDrill("tesoreria")}
                onKeyDown={onKey("tesoreria")}
              />

              {/* --- Card 2: Patrimonio USD --- */}
              {pUsd.length > 0 && (
                <div className="chart-card" role="button" tabIndex={0}
                     onClick={openDrill("historico")} onKeyDown={onKey("historico")}>
                  <div className="chart-card-head">
                    <div>
                      <h3>Patrimonio · USD</h3>
                      <p>U$S {pUsdLastM} M{pUsdYoy != null ? ' · ' + (pUsdYoy >= 0 ? '+' : '') + pUsdYoy.toFixed(1).replace('.', ',') + '% YoY' : ''}</p>
                    </div>
                    <span className="chart-card-chip">12 meses</span>
                  </div>
                  <div className="chart-card-body">
                    <PatrimonioChart data={pUsd} currency="usd" />
                  </div>
                </div>
              )}

              {/* --- Card 3: Stock kilos diario --- */}
              {sKd.length > 0 && (
                <div className="chart-card" role="button" tabIndex={0}
                     onClick={openDrill("historico")} onKeyDown={onKey("historico")}>
                  <div className="chart-card-head">
                    <div>
                      <h3>Stock kilos · diario</h3>
                      <p>{sKdLastT} t{sKdDelta != null ? ' · ' + (sKdDelta >= 0 ? '+' : '') + sKdDelta.toFixed(1).replace('.', ',') + '% en 90 d' : ''}</p>
                    </div>
                    <span className="chart-card-chip">90 días</span>
                  </div>
                  <div className="chart-card-body">
                    <StockKilosChart data={sKd} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* === PRODUCTIVOS (v9) === Espejo del mobile. Toggle inline:
            tap → expand con CTA "Ver módulo Producción →" que navega
            a Stock de Masa (módulo "stock", tab interna "Productivo").
            KPI_BETTER_WHEN reemplaza el legacy mejorEs en el clasificador. */}
        <ProductivosSection D={D} />

        {/* === PRECIOS DE INFERENCIA (v9) === Espejo del mobile.
            Toggle inline + caja MARGEN ESTIMADO + CTA "Ver en Mercado →"
            que navega a Mercado activando la tab "Inferencia" (v8). */}
        <PreciosInferenciaSection D={D} />

        {/* === MÓDULOS === */}
        <div className="modules-section">
          <div className="modules-head">
            <h2>Módulos del Portal</h2>
            <span className="hint">Click para vista rápida · doble click para abrir módulo</span>
          </div>
          <div className="modules-grid">
            {D.modulos.map(m => (
              <div
                key={m.id}
                className="module-card"
                onClick={() => setDrillModulo(m)}
                onDoubleClick={() => goToPortalModule(m.id)}
                style={{cursor: "pointer"}}
                title={"Vista rápida " + m.titulo + " (doble click para abrir módulo)"}
              >
                <div className="module-head">
                  <span className="module-num">MÓDULO {m.n}</span>
                  <span className={`module-status ${m.estado}`}>
                    <span className="led" />
                    {m.estado === "vivo" ? "En vivo" : m.estado === "acumulando" ? "Acumulando" : "Disponible"}
                  </span>
                </div>
                <div className="module-title">{m.titulo}</div>
                <div className="module-desc">{m.desc}</div>
                <div className="module-kpi">
                  <div>
                    <div className="module-kpi-value">{m.kpi}</div>
                    <div className="module-kpi-label">{m.kpiLabel}</div>
                  </div>
                  <span className="module-kpi-arrow">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 40, fontSize: 11, color: "var(--ink-faint)", textAlign: "center", letterSpacing: ".06em" }}>
          PEGSA & BULLTRADE · Uso interno · Cierre Diciembre 2025 · Confeccionado Feb 2026
        </div>
      </div>

      {drillModulo && (
        <ModuleDrill
          modulo={drillModulo}
          data={D}
          onClose={() => setDrillModulo(null)}
          onOpen={(modulo) => { setDrillModulo(null); if (modulo && modulo.id) goToPortalModule(modulo.id); }}
        />
      )}
    </>
  );
}

function App() {
  const D = window.PEGSA_DATA;
  const [active, setActive] = useState("panel");

  return (
    <div className="app" data-screen-label="01 Panel Principal">
      <Sidebar active={active} onSelect={setActive} modulos={D.modulos} usuario={D.usuario} />
      <main className="main">
        <Panel />
      </main>
    </div>
  );
}

// El auto-mount original sobre #root se eliminó — el boot del index.html
// se encarga de montar <Panel /> sobre #panelRoot.
// Exponemos Panel y App globalmente para que el boot las encuentre:
window.Panel = Panel;
window.App = App;
