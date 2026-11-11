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

  const esDiesel = (n) => /diesel|gasoil|combustible/i.test(n || "");
  const DIESEL_UMBRAL = 1000;

  // Crítico:
  //   1) Si hay Diesel con stock < umbral, gana siempre (operativamente crítico).
  //   2) Sino, el insumo con MENOR días positivos (ignora stock negativo y consumo 0).
  const dieselCritico = insumos.find(i => esDiesel(i.nombre) && i.stock_kg > 0 && i.stock_kg < DIESEL_UMBRAL);
  const conDias = insumos.filter(i => i.dias_restantes != null && i.dias_restantes > 0 && i.stock_kg > 0);
  const criticoDias = conDias.length
    ? conDias.reduce((a, b) => a.dias_restantes < b.dias_restantes ? a : b)
    : null;
  const critico = dieselCritico || criticoDias;
  const criticoEsDiesel = !!dieselCritico;
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
          <div className="v">
            {criticoEsDiesel ? "< 1.000 lt" : (critico && critico.dias_restantes ? fmtD1(critico.dias_restantes) : "—")}
          </div>
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
            const dieselBajo = esDiesel(ins.nombre) && ins.stock_kg > 0 && ins.stock_kg < DIESEL_UMBRAL;
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

            const filaStyle = dieselBajo ? { background: "rgba(192,57,43,.06)" } : {};
            const stockColor = stockNeg || dieselBajo ? "#c0392b" : undefined;

            return (
              <tr key={i} style={filaStyle}>
                <td className="name">
                  {ins.nombre}
                  {stockNeg && (
                    <span title="Stock inconsistente · revisar contabilidad"
                          style={{ marginLeft: 6, color: "#c0392b", cursor: "help" }}>⚠</span>
                  )}
                  {dieselBajo && (
                    <span title="Stock crítico · reabastecer"
                          style={{ marginLeft: 6, color: "#c0392b", cursor: "help" }}>⚠</span>
                  )}
                </td>
                <td className="num" style={stockColor ? { color: stockColor, fontWeight: dieselBajo ? 700 : "inherit" } : {}}>
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

function Sidebar({ active, onSelect, modulos }) {
  // v15.96: el usuario es el logueado (currentUser de core-home.js), no uno fijo.
  const cu = (typeof currentUser !== "undefined" && currentUser) ? currentUser : null;
  // Helper inline: un ítem de navegación de módulo
  const renderNavItem = (m) => (
    <div
      key={m.id}
      className={`nav-item ${active === m.id ? "active" : ""}`}
      onClick={() => onSelect(m.id)}
    >
      <span className="nav-num">{m.n}</span>
      <span style={{ flex: 1 }}>{m.titulo.replace("Estado de Resultados", "Estado Resultados")}</span>
    </div>
  );

  // Particionar módulos por grupo. `config` se omite del sidebar
  // (parametros-base se accede vía el Simulador, no es módulo de uso diario).
  const operativos = modulos.filter(m => m.grupo === "operativo");
  const economicos = modulos.filter(m => m.grupo === "economico");

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

        <div className="sidebar-section-label">Módulos Operativos</div>
        {operativos.map(renderNavItem)}

        {/* v15.94: sin Estado de Resultados ni Flujo el grupo puede quedar vacío */}
        {economicos.length > 0 && <div className="sidebar-section-label sidebar-section-divider">Análisis Económico</div>}
        {economicos.map(renderNavItem)}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-avatar">{cu ? cu.initials : "—"}</div>
        <div className="sidebar-foot-info">
          <b>{cu ? cu.name : "—"}</b>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {   // v15.96: sin período ni rango de fechas fijos
  return (
    <header className="topbar">
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, gap: 2 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>Panel Principal</span>
      </div>
      <div className="topbar-spacer" />
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
    // v15.94: sin drill de estado-resultados, flujo-fondos ni simulador (retirados).
    switch (modulo.id) {
      case "stock-masa": {
        const pegCab = data.hero?.stock?.pegsa?.cabezas || 0;
        const pegKg  = data.hero?.stock?.pegsa?.kg     || 0;
        const totCab = data.hero?.stock?.total?.cabezas || 0;
        const totKg  = data.hero?.stock?.total?.kg     || 0;
        const totEst = data.hero?.stock?.total?.establecimientos || 0;
        const totPro = data.hero?.stock?.total?.propietarios || 0;
        const hoteleros = Math.max(0, totPro - 1);
        const pctPegsa = totCab > 0 ? (pegCab / totCab * 100) : 0;

        // v15.96: sin dato → "—"
        const fmtCab = (n) => n ? n.toLocaleString("es-AR") : "—";
        const fmtT   = (kg) => kg ? (kg / 1000).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : "—";
        const fmtPct = (n) => n.toFixed(1).replace('.', ',') + '%';

        return (
          <div className="drill-stock-grid">

            {/* ============= CARD PEGSA ============= */}
            <div className="drill-stock-card drill-stock-card--pegsa">
              <div className="drill-stock-card-header">
                <div className="drill-stock-card-eyebrow">Hacienda PEGSA</div>
                <div className="drill-stock-card-kpi">{fmtCab(pegCab)}<span className="u">cab</span></div>
                <div className="drill-stock-card-sub">
                  {fmtT(pegKg)} t · {fmtPct(pctPegsa)} del grupo
                </div>
              </div>

              <div className="drill-section-title">Stock por categoría · PEGSA</div>
              <StockBars items={data.stockCategoriasPegsa || []} variant="pegsa" hideTotal />

              <div className="drill-section-title" style={{ marginTop: 18 }}>Hacienda PEGSA por establecimiento</div>
              <EstablecimientoDonut items={data.haciendaPegsaPorEstab || []} size={140} />

              <div className="drill-stock-card-foot">
                Total: <b className="mono tnum">{fmtCab(pegCab)} cab · {fmtT(pegKg)} t</b>
              </div>
            </div>

            {/* ============= CARD GRUPO ============= */}
            <div className="drill-stock-card drill-stock-card--grupo">
              <div className="drill-stock-card-header">
                <div className="drill-stock-card-eyebrow">Grupo completo</div>
                <div className="drill-stock-card-kpi">{fmtCab(totCab)}<span className="u">cab</span></div>
                <div className="drill-stock-card-sub">
                  {fmtT(totKg)} t · PEGSA + {hoteleros} hotelero{hoteleros === 1 ? '' : 's'}
                </div>
              </div>

              <div className="drill-section-title">Stock por categoría · Grupo</div>
              <StockBars items={data.stockCategorias || []} variant="grupo" hideTotal />

              <div className="drill-stock-card-foot">
                Total: <b className="mono tnum">{fmtCab(totCab)} cab · {fmtT(totKg)} t · {totEst} establecimientos</b>
              </div>
            </div>

          </div>
        );
      }
      case "stock-insumos":
        return <StockInsumosDrill />;
      case "mercado": {
        // v15.96: valores de D.mercado (mercado_precios.json); sin dato → "—".
        // Las dos Sparkline de ejemplo (novillo / maíz) se sacaron: no hay serie real.
        const M = data.mercado || {};
        const pr = (k) => (M[k] && M[k].precio) ? "$" + Math.round(M[k].precio).toLocaleString("es-AR") : "—";
        const f = M.fecha ? M.fecha.split("-").reverse().join("/") : null;
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Novillo 461/490</div><div className="v">{pr("novillo")}</div></div>
              <div className="drill-stat"><div className="l">Vaca buena</div><div className="v">{pr("vaca")}</div></div>
              <div className="drill-stat"><div className="l">Maíz BCR</div><div className="v">{pr("maiz")}</div></div>
              <div className="drill-stat"><div className="l">Soja BCR</div><div className="v">{pr("soja")}</div></div>
            </div>
            <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>{f ? "Precios al " + f + "." : "Sin datos de mercado."}</p>
          </>
        );
      }
      case "tesoreria": {
        // v15.96: valores de tesoreria_ultimo.json (data.js → D.tesoreria / D.hero.patrimonio).
        const T = data.tesoreria || {};
        const m = (n) => n ? "$" + Math.round(n).toLocaleString("es-AR") : "—";
        const f = T.fecha_corte ? T.fecha_corte.split("-").reverse().join("/") : null;
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Disponibilidades</div><div className="v">{m(T.posicion)}</div></div>
              <div className="drill-stat"><div className="l">Cheques en cartera</div><div className="v">{m(T.cartera)}</div></div>
              <div className="drill-stat"><div className="l">Bancos</div><div className="v">{m(T.bancos)}</div></div>
              <div className="drill-stat"><div className="l">USD en pesos</div><div className="v">{m(T.usd_pos)}</div></div>
            </div>
            <div className="drill-section-title">{f ? "Corte " + f : "Sin datos de tesorería"}</div>
          </>
        );
      }
      case "historico": {
        // v15.96: de valuacion_historica.json. Fuera "Resultado YTD" (era del Estado de Resultados).
        const pm = Array.isArray(data.patrimonioMensual) ? data.patrimonioMensual : [];
        const first = pm[0], last = pm[pm.length - 1];
        const varUsd = (first && last && first.usd > 0) ? (last.usd - first.usd) / first.usd * 100 : null;
        const u = (data.valuacionUltimo || "").split("-");
        return (
          <>
            <div className="drill-stats">
              <div className="drill-stat"><div className="l">Patrimonio U$S</div><div className="v">{last ? "U$S " + (last.usd / 1000).toFixed(2).replace(".", ",") + " M" : "—"}</div></div>
              <div className="drill-stat"><div className="l">{first ? "Var. vs " + first.mes : "Variación"}</div><div className={"v " + (varUsd == null ? "" : varUsd >= 0 ? "pos" : "neg")}>{varUsd == null ? "—" : (varUsd >= 0 ? "+" : "") + varUsd.toFixed(1).replace(".", ",") + "%"}</div></div>
              <div className="drill-stat"><div className="l">Meses cargados</div><div className="v">{data.valuacionMeses || "—"}</div></div>
              <div className="drill-stat"><div className="l">Último cierre</div><div className="v">{u.length === 2 ? u[1] + "/" + u[0] : "—"}</div></div>
            </div>
            {pm.length > 0 ? (
              <>
                <div className="drill-section-title">Patrimonio U$S — últimos 12 meses</div>
                <PatrimonioChart data={pm.slice(-12)} currency="usd" />
              </>
            ) : <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Sin datos de valuación.</p>}
          </>
        );
      }
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
