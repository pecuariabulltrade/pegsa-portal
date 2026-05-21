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
              {/* --- Card 1: Financiero · saldo proyectado (Sprint 2C-fix-2: cambio de delta semanal a saldo acumulado) --- */}
              {D.flujoSemanal && (() => {
                // Formateador local: SIEMPRE en M (no abreviar a B). Coherente con módulo Tesorería.
                const fmtMontoM = (n) => {
                  if (n == null) return '—';
                  const abs = Math.abs(n);
                  const sign = n < 0 ? '−' : '';
                  return sign + '$' + Math.round(abs / 1e6).toLocaleString("es-AR") + ' M';
                };
                return (
                  <div className="flujo-semanal-card" role="button" tabIndex={0}
                       onClick={openDrill("tesoreria")} onKeyDown={onKey("tesoreria")}>
                    <div className="chart-card-head">
                      <div>
                        <h3>Financiero · saldo proyectado</h3>
                        <p>Saldo bancario proyectado al cierre de cada semana</p>
                      </div>
                      <span className="chart-card-chip">Sem {D.flujoSemanal.semanaNumActual} · {D.flujoSemanal.anioActual}</span>
                    </div>

                    {/* Caja arriba: cierre primera semana */}
                    {D.flujoSemanal.cierrePrimera && (
                      <div className={`saldo-cierre-box ${D.flujoSemanal.cierrePrimera.signo}`}>
                        <div className="saldo-cierre-label">Cierre · {D.flujoSemanal.cierrePrimera.rangoLabel}</div>
                        <div className="saldo-cierre-val">{fmtMontoM(D.flujoSemanal.cierrePrimera.valor)}</div>
                      </div>
                    )}

                    {/* Mini-chart sparkline con saldo acumulado de las 6 semanas */}
                    <div className="saldo-mini-chart">
                      <Sparkline
                        data={D.flujoSemanal.semanas.map(s => s.saldoAcumulado / 1e6)}
                        color="oklch(0.55 0.15 230)"
                        height={56}
                        fill={true}
                        strokeWidth={1.8}
                      />
                      <div className="saldo-mini-labels">
                        {D.flujoSemanal.semanas.map((s, i) => (
                          <span key={i} className={s.estado === 'next' ? 'next' : ''}>{s.label}</span>
                        ))}
                      </div>
                    </div>

                    {/* Línea saldo de partida (arranque de la curva = "Hoy") */}
                    {D.flujoSemanal.saldoInicial != null && (
                      <div className="saldo-partida-row">
                        <span className="saldo-partida-label">Saldo de partida</span>
                        <span className={`saldo-partida-val ${D.flujoSemanal.saldoInicial < 0 ? 'neg' : 'pos'}`}>
                          {fmtMontoM(D.flujoSemanal.saldoInicial)}
                        </span>
                      </div>
                    )}

                    {/* Caja abajo: saldo proyectado al cierre del horizonte (última semana visible) */}
                    {D.flujoSemanal.cierreFinal && (
                      <div className={`cover-row ${D.flujoSemanal.cierreFinal.signo}`}>
                        <div>
                          <div className="cover-label">Saldo proyectado</div>
                          <div className="cover-sub">Cierre semana {D.flujoSemanal.cierreFinal.label}</div>
                        </div>
                        <div className={`cover-val ${D.flujoSemanal.cierreFinal.signo}`}>
                          {fmtMontoM(D.flujoSemanal.cierreFinal.valor)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

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
