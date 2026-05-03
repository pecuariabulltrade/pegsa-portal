/* Sidebar.jsx, Topbar.jsx, ModuleDrill.jsx — auxiliares */

function IconHome() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>; }
function IconBell() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>; }
function IconSearch() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>; }
function IconCalendar() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>; }
function IconClose() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 6-12 12M6 6l12 12" /></svg>; }
function IconExport() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" /></svg>; }

// Componente: vista rápida del Stock de Insumos (lee del JSON real, no mock)
function StockInsumosDrill() {
  const [data, setData]   = React.useState(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    fetch("./stock_insumos_2025.json")
      .then(r => r.ok ? r.json() : Promise.reject("HTTP " + r.status))
      .then(d => setData(d))
      .catch(() => setError(true));
  }, []);

  if (error) return <p style={{ color: "var(--neg, #c0392b)" }}>No se pudo cargar stock_insumos_2025.json</p>;
  if (!data) return <p style={{ color: "var(--ink-mute)" }}>Cargando datos…</p>;

  const insumos = data.insumos || [];
  const totalKg = data.total_kg || 0;
  const meta    = data.meta    || {};

  // Crítico: insumo con MENOR días positivos (ignora stock negativo y consumo 0)
  const conDias = insumos.filter(i => i.dias_restantes != null && i.dias_restantes > 0 && i.stock_kg > 0);
  const critico = conDias.length
    ? conDias.reduce((a, b) => a.dias_restantes < b.dias_restantes ? a : b)
    : null;

  const esDiesel = (n) => /diesel|gasoil|combustible/i.test(n || "");
  const fmt      = (n) => Number(Math.round(n)).toLocaleString("es-AR");
  const fmtD1    = (n) => Number(n).toFixed(1).replace(".", ",");
  const fechaUpd = meta.generado
    ? new Date(meta.generado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
    : "—";
  const hayNegativos = insumos.some(i => i.stock_kg < 0);

  return (
    <>
      <div className="drill-stats">
        <div className="drill-stat">
          <div className="l">Stock total</div>
          <div className="v">{fmtD1(totalKg/1000)} t</div>
        </div>
        <div className="drill-stat">
          <div className="l">Insumos</div>
          <div className="v">{insumos.length} ítems</div>
        </div>
        <div className="drill-stat">
          <div className="l">Crítico</div>
          <div className={`v ${critico ? "neg" : ""}`}>
            {critico ? critico.nombre : "—"}
          </div>
        </div>
        <div className="drill-stat">
          <div className="l">Días restantes</div>
          <div className="v">{critico ? fmtD1(critico.dias_restantes) : "—"}</div>
        </div>
      </div>
      <div className="drill-section-title">Detalle por insumo</div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Insumo</th>
            <th className="num">Stock (kg)</th>
            <th className="num">Consumo/día</th>
            <th className="num">Días rest.</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((ins, i) => {
            const stockNeg  = ins.stock_kg < 0;
            const cons      = ins.consumo_diario_tc;
            const sinCons   = !cons || cons <= 0;
            const dias      = ins.dias_restantes;
            const tooltipCons = sinCons
              ? (esDiesel(ins.nombre)
                  ? "Consumo no automatizado · cargar desde surtidor"
                  : "Sin consumo registrado en el Mixer")
              : null;

            // Días: si stock negativo o sin consumo → "—"
            let diasCell;
            if (stockNeg || sinCons || dias == null) {
              diasCell = <span style={{ color: "var(--ink-mute)" }}>—</span>;
            } else {
              const chip = dias < 7 ? "neg" : dias < 15 ? "neutral" : "pos";
              diasCell = <span className={`chip ${chip}`}>{fmtD1(dias)}</span>;
            }

            return (
              <tr key={i}>
                <td className="name">
                  {ins.nombre}
                  {stockNeg && (
                    <span title="Stock inconsistente · revisar contabilidad"
                          style={{ marginLeft: 6, color: "#c0392b", cursor: "help" }}>⚠</span>
                  )}
                </td>
                <td className="num" style={stockNeg ? { color: "#c0392b" } : {}}>
                  {fmt(ins.stock_kg)}
                </td>
                <td className="num"
                    title={tooltipCons || undefined}
                    style={sinCons ? { color: "var(--ink-mute)", cursor: tooltipCons ? "help" : "default" } : {}}>
                  {sinCons ? "—" : fmt(cons)}
                </td>
                <td className="num">{diasCell}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hayNegativos && (
        <p style={{ fontSize: 12, color: "#c0392b", marginTop: 10, fontStyle: "italic" }}>
          ⚠ Stock inconsistente · revisar contabilidad. Algún insumo registró más consumo que ingresos en WinCampo.
        </p>
      )}
      <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 14, textAlign: "right", fontStyle: "italic" }}>
        Datos al {fechaUpd} · Origen WinCampo + Mixer
      </p>
    </>
  );
}

function Sidebar({ active, onSelect, modulos, usuario }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-logo">PB</div>
        <div className="sidebar-brand" style={{ minWidth: 0, lineHeight: 1.2 }}>
          <b style={{ whiteSpace: "nowrap", display: "block", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>PEGSA & BULL</b>
          <small style={{ whiteSpace: "nowrap", display: "block", fontSize: 10.5, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>Corporate Data</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Vista</div>
        <div
          className={`nav-item ${active === "panel" ? "active" : ""}`}
          onClick={() => onSelect("panel")}
        >
          <IconHome />
          Panel Principal
        </div>

        <div className="sidebar-section-label">Módulos</div>
        {modulos.map(m => (
          <div
            key={m.id}
            className={`nav-item ${active === m.id ? "active" : ""}`}
            onClick={() => onSelect(m.id)}
          >
            <span className="nav-num">{m.n}</span>
            <span style={{ flex: 1 }}>{m.titulo.replace("Estado de Resultados", "Estado Resultados")}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-avatar">{usuario.iniciales}</div>
        <div className="sidebar-foot-info">
          <b>{usuario.nombre}</b>
          <small>{usuario.rol}</small>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ periodo }) {
  return (
    <header className="topbar">
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, gap: 2 }}>
        <span style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Período {periodo}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Panel Principal</span>
      </div>
      <div className="topbar-spacer" />
      <div className="period-chip" title="Cambiar período">
        <IconCalendar />
        Ene – Dic 2025
      </div>
      <div className="search">
        <IconSearch />
        <input placeholder="Buscar centro, módulo, concepto…" />
        <span className="kbd">⌘ K</span>
      </div>
      <button className="icon-btn" aria-label="Notificaciones">
        <IconBell />
        <span className="dot" />
      </button>
    </header>
  );
}

function ModuleDrill({ modulo, data, onClose, onOpen }) {
  if (!modulo) return null;

  // Drill-down content por módulo
  const renderBody = () => {
    switch (modulo.id) {
      case "estado-resultados":
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Ingresos brutos</div><div className="v">$42.615.291.858</div></div>
              <div className="drill-stat"><div className="l">Resultado operativo</div><div className="v pos">+$2.948.959.025</div></div>
              <div className="drill-stat"><div className="l">Tenencia</div><div className="v pos">+$6.242.389.849</div></div>
              <div className="drill-stat"><div className="l">Resultado neto</div><div className="v pos">+$9.191.348.874</div></div>
            </div>
            <div className="drill-section-title">Resultado mensual por centro · M$</div>
            <Heatmap data={data.heatmap.centros} meses={data.heatmap.meses} />
            <div className="drill-section-title">Ranking por resultado total</div>
            <table className="tbl">
              <thead><tr><th>Centro</th><th className="num">Ingresos</th><th className="num">Operativo</th><th className="num">Tenencia</th><th className="num">Total</th><th className="num">Margen</th></tr></thead>
              <tbody>
                {data.centros.slice().sort((a,b) => b.total - a.total).map(c => {
                  const fullPes = (n) => (n * 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 0 });
                  return (
                    <tr key={c.id}>
                      <td className="name">{c.nombre}</td>
                      <td className="num">{c.ingresos > 0 ? `$${fullPes(c.ingresos)}` : "—"}</td>
                      <td className="num"><span className={`chip ${c.operativo >= 0 ? "pos" : "neg"}`}>{c.operativo >= 0 ? "+" : "−"}${fullPes(Math.abs(c.operativo))}</span></td>
                      <td className="num">{c.tenencia > 0 ? `+$${fullPes(c.tenencia)}` : "—"}</td>
                      <td className="num"><span className={`chip ${c.total >= 0 ? "pos" : "neg"}`}>{c.total >= 0 ? "+" : "−"}${fullPes(Math.abs(c.total))}</span></td>
                      <td className="num">{c.marginTot.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="foot">
                  <td className="name">CONSOLIDADO</td>
                  <td className="num">$42.615.291.858</td>
                  <td className="num"><span className="chip pos">+$2.948.959.025</span></td>
                  <td className="num">+$6.242.389.849</td>
                  <td className="num"><span className="chip pos">+$9.191.348.874</span></td>
                  <td className="num">18,97%</td>
                </tr>
              </tbody>
            </table>
          </>
        );
      case "flujo-fondos":
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Ingresos cobrados</div><div className="v">$30.846.826.913</div></div>
              <div className="drill-stat"><div className="l">Egresos corrientes</div><div className="v neg">−$27.043.395.456</div></div>
              <div className="drill-stat"><div className="l">Superávit operativo</div><div className="v pos">+$3.803.431.457</div></div>
              <div className="drill-stat"><div className="l">Aplicaciones netas</div><div className="v neg">−$3.845.595.521</div></div>
            </div>
            <div className="drill-section-title">Top conceptos cobrados</div>
            <table className="tbl">
              <tbody>
                <tr><td className="name">Venta de Hacienda</td><td className="num">$27.022.178.029</td><td className="num">87,6%</td></tr>
                <tr><td className="name">Facturación Feedlot a Terceros</td><td className="num">$2.350.414.723</td><td className="num">7,5%</td></tr>
                <tr><td className="name">Venta de Soja</td><td className="num">$1.205.945.602</td><td className="num">3,8%</td></tr>
                <tr><td className="name">Comisiones BULL + Servicios</td><td className="num">$84.666.513</td><td className="num">0,3%</td></tr>
                <tr><td className="name">Intereses FIMA + Otros</td><td className="num">$171.963.052</td><td className="num">0,6%</td></tr>
              </tbody>
            </table>
          </>
        );
      case "stock-masa":
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">PEGSA</div><div className="v">8.651 cab</div></div>
              <div className="drill-stat"><div className="l">Total grupo</div><div className="v">9.861 cab</div></div>
              <div className="drill-stat"><div className="l">Kilos PEGSA</div><div className="v">3.626 t</div></div>
              <div className="drill-stat"><div className="l">Establecimientos</div><div className="v">3</div></div>
            </div>
            <div className="drill-section-title">Stock por categoría</div>
            <StockBars items={data.stockCategorias} />
          </>
        );
      case "stock-insumos":
        return <StockInsumosDrill />;
      case "mercado":
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Novillo 461/490</div><div className="v">$4.557</div></div>
              <div className="drill-stat"><div className="l">Vaca buena</div><div className="v">$3.428</div></div>
              <div className="drill-stat"><div className="l">Maíz BCR</div><div className="v">$243.150</div></div>
              <div className="drill-stat"><div className="l">Soja BCR</div><div className="v">$898.987</div></div>
            </div>
            <div className="drill-section-title">Tendencia 12 meses</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "var(--surface-alt)", padding: 16, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>Hacienda — $/kg vivo</div>
                <div style={{ height: 80, marginTop: 10 }}>
                  <Sparkline data={data.sparks.novillo} color="var(--primary)" height={80} />
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 6 }}>Novillo · +9% YTD</div>
              </div>
              <div style={{ background: "var(--surface-alt)", padding: 16, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>Granos — $/tn</div>
                <div style={{ height: 80, marginTop: 10 }}>
                  <Sparkline data={data.sparks.maiz} color="var(--pos)" height={80} />
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 6 }}>Maíz · +21% YTD</div>
              </div>
            </div>
          </>
        );
      case "tesoreria":
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Cartera positiva</div><div className="v pos">$1.138.000.000</div></div>
              <div className="drill-stat"><div className="l">Bancos + FCI</div><div className="v">$463.131.340</div></div>
              <div className="drill-stat"><div className="l">Posición USD</div><div className="v">U$S 1.350 K</div></div>
              <div className="drill-stat"><div className="l">Cheques diferidos</div><div className="v neg">−$685.000.000</div></div>
            </div>
            <div className="drill-section-title">Última semana · 25/04</div>
            <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
              Cartera total positiva por sexta semana consecutiva. La posición en USD aumentó +$1.907.628.109 en pesos equivalentes durante el período. No hay vencimientos críticos en los próximos 30 días.
            </p>
          </>
        );
      case "simulador":
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Días engorde</div><div className="v">112</div></div>
              <div className="drill-stat"><div className="l">Costo prod.</div><div className="v">$3.840/kg</div></div>
              <div className="drill-stat"><div className="l">Resultado/cabeza</div><div className="v pos">+$182.500</div></div>
              <div className="drill-stat"><div className="l">TIR anual equiv.</div><div className="v pos">+38,2%</div></div>
            </div>
            <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
              Simulación con precios de mercado del día. Abrí el módulo para ajustar parámetros (raciones, fletes, plazos, etc.) y exportar resultados.
            </p>
          </>
        );
      case "historico":
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Patrimonio</div><div className="v pos">+22,8% USD</div></div>
              <div className="drill-stat"><div className="l">Stock kg</div><div className="v pos">+5,1%</div></div>
              <div className="drill-stat"><div className="l">Resultado YTD</div><div className="v pos">+$9.191.348.874</div></div>
              <div className="drill-stat"><div className="l">Meses cargados</div><div className="v">14</div></div>
            </div>
            <div className="drill-section-title">Patrimonio U$S — últimos 12 meses</div>
            <PatrimonioChart data={data.patrimonioMensual} currency="usd" />
          </>
        );
      default:
        return <p>Próximamente.</p>;
    }
  };

  return (
    <div className="drill-backdrop" onClick={onClose}>
      <div className="drill-modal" onClick={e => e.stopPropagation()}>
        <div className="drill-head">
          <div>
            <div className="module-num">MÓDULO {modulo.n} · vista rápida</div>
            <h2>{modulo.titulo}</h2>
            <p>{modulo.desc}</p>
          </div>
          <button className="drill-close" onClick={onClose}><IconClose /></button>
        </div>
        <div className="drill-body">
          {renderBody()}
          <div className="drill-cta">
            <button className="btn ghost" onClick={onClose}>Cerrar</button>
            <button className="btn primary" onClick={() => onOpen && onOpen(modulo)}>
              Abrir módulo completo →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, ModuleDrill, IconExport, IconCalendar, IconBell, IconSearch });
