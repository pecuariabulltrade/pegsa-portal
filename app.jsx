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
  "historico": "historico"
};
function goToPortalModule(panelId) {
  var portalId = _PANEL_TO_PORTAL_ID[panelId] || panelId;
  if (typeof window.openModule === "function") {
    window.openModule(portalId);
  } else if (typeof window.showScreen === "function") {
    window.showScreen("screen" + portalId.charAt(0).toUpperCase() + portalId.slice(1));
  }
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
            <div key={i} className={`alert-chip ${a.tipo}`}>
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

        {/* === RESUMEN OPERATIVO · 12 TARJETAS EN ORDEN PRIORITARIO === */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 4px 12px" }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink)", fontWeight: 700 }}>
            Resumen Operativo
          </div>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 14, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-mute)", fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 2, background: "oklch(0.65 0.16 240)" }} />Stock</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 2, background: "oklch(0.55 0.18 230)" }} />Activo</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 2, background: "oklch(0.65 0.18 155)" }} />Tesorería</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 2, background: "oklch(0.78 0.10 80)" }} />Mercado</span>
          </div>
        </div>
        <div className="subkpi-row" style={{ marginBottom: 24 }}>
          {/* === TIER 1 · STOCK (XL) === */}
          <div className="subkpi size-xl" data-group="stock" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "stock-masa"))}>
            <div className="subkpi-label"><span>Stock PEGSA</span><span className="delta">+5,1%</span></div>
            <div className="subkpi-value" style={{ color: "var(--primary-deep)" }}>8.651<span className="u">cab</span></div>
            <div className="subkpi-meta"><span>3.626 t proyectadas</span><span style={{ width: 100, height: 28, flexShrink: 0 }}><Sparkline data={D.sparks.stockKg} color="var(--primary)" height={28} fill={true} strokeWidth={1.6} /></span></div>
          </div>
          <div className="subkpi size-xl" data-group="stock" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "stock-masa"))}>
            <div className="subkpi-label"><span>Stock Total · Grupo</span><span className="delta">+5,1%</span></div>
            <div className="subkpi-value" style={{ color: "var(--primary-deep)" }}>9.861<span className="u">cab</span></div>
            <div className="subkpi-meta"><span>4.324 t · 3 establecimientos</span><span style={{ width: 100, height: 28, flexShrink: 0 }}><Sparkline data={D.sparks.stockKg} color="var(--primary)" height={28} fill={true} strokeWidth={1.6} /></span></div>
          </div>

          {/* === TIER 2 · ACTIVO + TESORERÍA + RENTABILIDAD (LG) === */}
          <div className="subkpi size-lg" data-group="activo" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "historico"))}>
            <div className="subkpi-label"><span>Activo Corriente · ARS</span><span className="delta">+22,8%</span></div>
            <div className="subkpi-value">$ 16,43<span className="u">B</span></div>
            <div className="subkpi-meta"><span>Período 2025-12</span><span style={{ width: 50, height: 18, flexShrink: 0 }}><Sparkline data={D.sparks.patrimonioArs} color="oklch(0.55 0.15 230)" height={18} fill={false} strokeWidth={1.4} /></span></div>
          </div>
          <div className="subkpi size-lg" data-group="activo" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "historico"))}>
            <div className="subkpi-label"><span>Activo Corriente · USD</span><span className="delta">MEP</span></div>
            <div className="subkpi-value">U$S 11,49<span className="u">M</span></div>
            <div className="subkpi-meta"><span>MEP $1.430/USD</span><span style={{ width: 50, height: 18, flexShrink: 0 }}><Sparkline data={D.sparks.patrimonioUsd} color="oklch(0.55 0.15 230)" height={18} fill={false} strokeWidth={1.4} /></span></div>
          </div>
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

          {/* === TIER 3 · MERCADO (SM, 6 cards en una fila) === */}
          {[
            { ...D.mercado.novillo, spark: D.sparks.novillo, fmtVal: v => `$${v.toLocaleString("es-AR")}` },
            { ...D.mercado.vaca, spark: D.sparks.vaca, fmtVal: v => `$${v.toLocaleString("es-AR")}` },
            { ...D.mercado.maiz, spark: D.sparks.maiz, fmtVal: v => `$${v.toLocaleString("es-AR")}` },
            { ...D.mercado.soja, spark: D.sparks.soja, fmtVal: v => `$${v.toLocaleString("es-AR")}` },
          ].map((m, i) => (
            <div key={"mkt"+i} className="subkpi size-sm" data-group="mercado" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "mercado"))}>
              <div className="subkpi-label">
                <span>{m.label}</span>
                <span className={`delta ${m.delta < 0 ? "neg" : ""}`}>
                  {m.delta >= 0 ? "+" : ""}{Math.abs(m.delta) >= 1000 ? (m.delta/1000).toFixed(1)+"k" : m.delta}
                </span>
              </div>
              <div className="subkpi-value" style={{ color: "var(--primary-deep)" }}>{m.fmtVal(m.precio)}</div>
              <div className="subkpi-meta">
                <span>{m.fuente}</span>
                <span style={{ width: 36, height: 16, flexShrink: 0 }}>
                  <Sparkline data={m.spark} color="var(--ink-faint)" height={16} fill={false} strokeWidth={1.2} />
                </span>
              </div>
            </div>
          ))}
          <div className="subkpi size-sm" data-group="mercado" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "mercado"))}>
            <div className="subkpi-label"><span>Ternero E&C</span></div>
            <div className="subkpi-value" style={{ color: "var(--primary-deep)" }}>$ 5.097</div>
            <div className="subkpi-meta"><span>330–370 kg · $/kg vivo</span></div>
          </div>
          <div className="subkpi size-sm" data-group="fx" onClick={() => setDrillModulo(D.modulos.find(x => x.id === "mercado"))}>
            <div className="subkpi-label"><span>Tipo cambio MEP</span></div>
            <div className="subkpi-value">$ 1.430<span className="u">/USD</span></div>
            <div className="subkpi-meta"><span>Cierre 25/04</span></div>
          </div>
        </div>

        {/* === HERO KPIs === */}
        <div className="hero-row" style={{ display: "none" }}>
          {/* Patrimonio */}
          <div className="hero-card featured" onClick={() => setDrillModulo(D.modulos.find(m => m.id === "historico"))}>
            <div className="hero-label">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.85 0.15 155)" }} />
              ACTIVO CORRIENTE · CONSOLIDADO
            </div>
            <div className="hero-value" style={{ fontSize: heroCurrency === "ars" ? 40 : 56 }}>
              <span className="currency">{heroCurrency === "ars" ? "$" : "U$S"}</span>
              {heroCurrency === "ars" ? "20.640.000.000" : "14.430"}
              {heroCurrency === "usd" && <span className="unit">K</span>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <div className="seg" style={{ background: "oklch(1 0 0 / 0.1)" }}>
                <button className={heroCurrency === "ars" ? "on" : ""} onClick={(e) => { e.stopPropagation(); setHeroCurrency("ars"); }} style={heroCurrency === "ars" ? {} : { color: "oklch(0.92 0.04 230 / 0.7)" }}>ARS</button>
                <button className={heroCurrency === "usd" ? "on" : ""} onClick={(e) => { e.stopPropagation(); setHeroCurrency("usd"); }} style={heroCurrency === "usd" ? {} : { color: "oklch(0.92 0.04 230 / 0.7)" }}>USD MEP</button>
              </div>
            </div>
            <div className="hero-spark">
              <Sparkline data={heroCurrency === "ars" ? D.sparks.patrimonioArs : D.sparks.patrimonioUsd} color="oklch(0.85 0.15 230)" />
            </div>
            <div className="hero-foot">
              <span className="hero-foot-meta">12 meses · MEP $1.430/USD</span>
              <span className="hero-delta">▲ +22,8% YTD</span>
            </div>
          </div>

          {/* Resultado neto */}
          <div className="hero-card" onClick={() => setDrillModulo(D.modulos.find(m => m.id === "estado-resultados"))}>
            <div className="hero-label">RESULTADO NETO DEL PERÍODO</div>
            <div className="hero-value" style={{ color: "var(--pos)", fontSize: 44 }}>
              <span className="currency" style={{ color: "var(--pos)", opacity: 0.7, fontSize: 24 }}>+$</span>
              9.191.348.874
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12.5, marginTop: 6, flexWrap: "wrap" }}>
              <span><span style={{ color: "var(--ink-mute)" }}>Operativo</span> <b className="mono tnum">+$2.948.959.025</b></span>
              <span><span style={{ color: "var(--ink-mute)" }}>Tenencia</span> <b className="mono tnum">+$6.242.389.849</b></span>
            </div>
            <div className="hero-spark">
              <Sparkline data={D.sparks.rentabilidad} color="var(--pos)" />
            </div>
            <div className="hero-foot">
              <span className="hero-foot-meta">18,97% s/ingresos · 7 de 9 centros positivos</span>
              <span className="hero-delta">▲ +7,3% s/Vta</span>
            </div>
          </div>

          {/* Stock hacienda */}
          <div className="hero-card" onClick={() => setDrillModulo(D.modulos.find(m => m.id === "stock-masa"))}>
            <div className="hero-label">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", animation: "pulse 1.6s ease infinite" }} />
              STOCK GANADERO · EN VIVO
            </div>
            <div className="hero-value">
              9.861
              <span className="unit">cab</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6 }}>
              <b className="mono tnum" style={{ color: "var(--ink)", fontSize: 16 }}>4.324 t</b> kilos estimados · 3 establecimientos
            </div>
            <div className="hero-spark">
              <Sparkline data={D.sparks.stockKg} color="var(--primary)" />
            </div>
            <div className="hero-foot">
              <span className="hero-foot-meta">PEGSA: 8.651 cab · Hotelería: 1.210 cab</span>
              <span className="hero-delta">▲ +5,1%</span>
            </div>
          </div>
        </div>

        {/* === SUB-KPIs MERCADO (legacy, replaced by ticker arriba) === */}
        <div style={{ display: "none" }}>
          <div className="subkpi-row">
            {[
              { ...D.mercado.novillo, spark: D.sparks.novillo, fmtVal: v => `$${v.toLocaleString("es-AR")}` },
            ].map((m, i) => (
              <div key={i} className="subkpi">
                <div className="subkpi-value">{m.fmtVal(m.precio)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* === ROW: PATRIMONIO + COMPOSICIÓN === */}
        <div className="panel-row split-2">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Evolución patrimonial · 2025</h3>
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

        {/* === ROW: STOCK POR CATEGORÍA === */}
        <div className="panel-row">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Stock por categoría</h3>
                <p>Total grupo · 9.861 cabezas · click para ver el módulo de Stock de Masa</p>
              </div>
            </div>
            <StockBars items={D.stockCategorias} />
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
