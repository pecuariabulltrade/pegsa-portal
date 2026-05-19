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
function goToPortalModule(panelId) {
  var portalId = _PANEL_TO_PORTAL_ID[panelId] || panelId;
  if (typeof window.openModule === "function") {
    window.openModule(portalId);
  } else if (typeof window.showScreen === "function") {
    window.showScreen("screen" + portalId.charAt(0).toUpperCase() + portalId.slice(1));
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

function Panel() {
  const D = window.PEGSA_DATA;
  const [drillModulo, setDrillModulo] = useState(null);
  const [heroCurrency, setHeroCurrency] = useState("ars");
  const [heatPeriod, setHeatPeriod] = useState("12m");

  const sortedCentros = useMemo(() => D.centros.slice().sort((a, b) => b.total - a.total), [D.centros]);

  return (
    <>
      <Topbar periodo={D.periodo} />

      <div className="content">
        {/* Page header */}
        <div className="page-head">
          <div className="page-eyebrow">PERÍODO ENERO – DICIEMBRE 2025</div>
          <h1 className="page-title">PECUARIA EL GARABÍ SA <em>& BULLTRADE SRL</em></h1>
          <p className="page-sub">Sistema integrado de gestión · Resumen ejecutivo y acceso a los 8 módulos del portal</p>
        </div>

        {/* Alerts */}
        <div className="alerts-row">
          {D.alertas.map((a, i) => (
            <div
              key={i}
              className={`alert-chip ${a.tipo}`}
              onClick={a.action === 'open-stock-materiaseca' ? () => {
                if (typeof window.openModule === 'function') {
                  window.openModule('stock');
                  setTimeout(() => {
                    if (typeof window.stockTab === 'function') {
                      const tab = document.getElementById('stockTabMateriaSeca') || document.querySelector('[onclick*="materiaseca"]');
                      window.stockTab('materiaseca', tab);
                    }
                  }, 200);
                }
              } : undefined}
              style={a.action ? { cursor: 'pointer' } : undefined}
            >
              <span className="led" />
              {a.texto}
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>Actualizado · 25/04/2025 07:00 AM</span>
            <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
              <IconExport /> Exportar
            </button>
          </div>
        </div>

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

        {/* === TIER 2 (transitorio · se reemplaza en Sprint 4) === */}
        <div className="subkpi-row" style={{ marginBottom: 24 }}>
          {/* === TIER 2 · PATRIMONIO + TESORERÍA + RENTABILIDAD (LG) === */}
          {(() => {
            const pm = D.patrimonioMensual || [];
            const last = pm[pm.length - 1] || {};
            const prev12 = pm.length >= 13 ? pm[pm.length - 13] : null;
            const deltaArs = (last.ars && prev12?.ars) ? ((last.ars - prev12.ars) / prev12.ars * 100) : null;
            const deltaUsd = (last.usd && prev12?.usd) ? ((last.usd - prev12.usd) / prev12.usd * 100) : null;
            // Formato ARS: si está en miles de M (B), usa B; sino M
            const arsB = last.ars >= 1000 ? (last.ars / 1000).toFixed(2).replace('.', ',') : null;
            const usdM = last.usd >= 1000 ? (last.usd / 1000).toFixed(2).replace('.', ',') : null;
            const fmtPct = (v) => v == null ? '' : (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + '%';
            return (
              <>
                <div className="subkpi size-lg" data-group="activo" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "historico"))}>
                  <div className="subkpi-label">
                    <span>Patrimonio Total · ARS</span>
                    {deltaArs != null && <span className={`delta ${deltaArs < 0 ? "neg" : ""}`}>{fmtPct(deltaArs)}</span>}
                  </div>
                  <div className="subkpi-value">
                    {arsB != null
                      ? <>$ {arsB}<span className="u">B</span></>
                      : <>$ {Math.round(last.ars || 0).toLocaleString("es-AR")}<span className="u">M</span></>}
                  </div>
                  <div className="subkpi-meta">
                    <span>{last.mes || '—'}{prev12 ? ' · YoY' : ''}</span>
                    <span style={{ width: 50, height: 18, flexShrink: 0 }}><Sparkline data={D.sparks.patrimonioArs} color="oklch(0.55 0.15 230)" height={18} fill={false} strokeWidth={1.4} /></span>
                  </div>
                </div>
                <div className="subkpi size-lg" data-group="activo" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "historico"))}>
                  <div className="subkpi-label">
                    <span>Patrimonio Total · USD</span>
                    {deltaUsd != null
                      ? <span className={`delta ${deltaUsd < 0 ? "neg" : ""}`}>{fmtPct(deltaUsd)}</span>
                      : <span className="delta">MEP</span>}
                  </div>
                  <div className="subkpi-value">
                    {usdM != null
                      ? <>U$S {usdM}<span className="u">M</span></>
                      : <>U$S {Math.round(last.usd || 0).toLocaleString("es-AR")}<span className="u">K</span></>}
                  </div>
                  <div className="subkpi-meta">
                    <span>MEP cotización mensual</span>
                    <span style={{ width: 50, height: 18, flexShrink: 0 }}><Sparkline data={D.sparks.patrimonioUsd} color="oklch(0.55 0.15 230)" height={18} fill={false} strokeWidth={1.4} /></span>
                  </div>
                </div>
              </>
            );
          })()}
          <div className="subkpi size-lg" data-group="tesoreria" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "tesoreria"))}>
            <div className="subkpi-label"><span>Tesorería · Último positivo</span></div>
            <div className="subkpi-value" style={{ color: "var(--pos)" }}>25 abr<span className="u">'25</span></div>
            <div className="subkpi-meta"><span>Cartera cheques $1.130 M</span></div>
          </div>
          <div className="subkpi size-lg" data-group="rentabilidad" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "estado-resultados"))}>
            <div className="subkpi-label"><span>Rentabilidad acum. s/Vta</span></div>
            <div className="subkpi-value" style={{ color: "var(--pos)" }}>+7,3<span className="u">%</span></div>
            <div className="subkpi-meta"><span>Análisis compras · desde Mar 2025</span></div>
          </div>

        </div>

        {/* === ROW: PATRIMONIO + COMPOSICIÓN === */}
        <div className="panel-row split-2">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Patrimonio Total · Evolución Mensual</h3>
                <p>Activo corriente consolidado · cierre mensual</p>
              </div>
              <div className="panel-tabs">
                <button className={`panel-tab ${heroCurrency === "ars" ? "active" : ""}`} onClick={() => setHeroCurrency("ars")}>ARS (M)</button>
                <button className={`panel-tab ${heroCurrency === "usd" ? "active" : ""}`} onClick={() => setHeroCurrency("usd")}>USD MEP (K)</button>
              </div>
            </div>
            <PatrimonioChart data={D.patrimonioMensual} currency={heroCurrency} />
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Composición del resultado</h3>
                <p>Por centro de negocio · positivos</p>
              </div>
            </div>
            <CompositionDonut centros={D.centros} />
          </div>
        </div>

        {/* === ROW: STOCK POR CATEGORÍA + HACIENDA PEGSA POR ESTABLECIMIENTO === */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
          {/* Izquierda: bloque grupo completo (70%) */}
          <div className="panel" style={{ flex: "7 1 480px", margin: 0 }}>
            <div className="panel-head">
              <div>
                <h3>
                  Stock por categoría · Grupo completo (PEGSA + hoteleros)
                  {D.mixerStatus && D.mixerStatus.nivel !== 'verde' && (
                    <span style={{
                      marginLeft: 10,
                      padding: '2px 8px',
                      borderRadius: 3,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      background: D.mixerStatus.nivel === 'rojo' ? 'rgba(192,57,43,.12)' : 'rgba(184,146,42,.15)',
                      color: D.mixerStatus.nivel === 'rojo' ? '#c0392b' : '#b8922a',
                    }}>
                      ⚠ Mixer hace {D.mixerStatus.dias_retraso} días
                    </span>
                  )}
                </h3>
                <p>
                  {(D.hero?.stock?.total?.cabezas || 0).toLocaleString("es-AR")} cabezas · todas las haciendas en el sistema · click para ver el módulo de Stock de Masa
                </p>
              </div>
            </div>
            <StockBars items={D.stockCategorias} />
          </div>
          {/* Derecha: torta solo PEGSA (30%) */}
          <div className="panel" style={{ flex: "3 1 280px", margin: 0 }}>
            <div className="panel-head">
              <div>
                <h3>Hacienda PEGSA por establecimiento</h3>
                <p>
                  {((D.haciendaPegsaTotal?.cabezas) || 0).toLocaleString("es-AR")} cabezas · solo hacienda propia · {(D.haciendaPegsaPorEstab?.length || 0)} establecimientos
                </p>
              </div>
            </div>
            <EstablecimientoDonut items={D.haciendaPegsaPorEstab || []} />
          </div>
        </div>

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
