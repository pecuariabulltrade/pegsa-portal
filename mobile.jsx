/* mobile.jsx — Panel ejecutivo PEGSA & Bulltrade — vista mobile
   React 18 UMD + Babel standalone.
   Datos: window.MOBILE_DATA (mobile-data.js, adaptador de window.PEGSA_DATA)
   --------------------------------------------------------------- */

const { useState, useRef, useEffect, useMemo } = React;

// Referencia que se actualiza al recibir 'mobile:data-ready'. <App/> incrementa
// un tick para forzar re-render cuando los datos reales llegan.
let D = window.MOBILE_DATA;

/* ============================================================
   Iconos SVG inline
   ============================================================ */
const Icon = {
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  Grid: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
};

const TabIcon = ({ name }) => {
  if (name === "home")  return <Icon.Home />;
  if (name === "chart") return <Icon.Chart />;
  if (name === "bell")  return <Icon.Bell />;
  if (name === "grid")  return <Icon.Grid />;
  return null;
};

/* ============================================================
   Header
   ============================================================ */
function Header() {
  const { brand, sub, notifications } = D.HEADER;
  return (
    <header className="hdr">
      <div className="hdr-row">
        <div className="hdr-logo">PB</div>
        <div className="hdr-brand">
          <div className="hdr-brand-name">{brand}</div>
          <div className="hdr-brand-sub">{sub}</div>
        </div>
        <button className="hdr-btn" aria-label="Menu"><Icon.Menu /></button>
        <button className="hdr-btn" aria-label="Notificaciones">
          <Icon.Bell />
          {notifications > 0 && (
            <span className="hdr-badge">{notifications}</span>
          )}
        </button>
      </div>
    </header>
  );
}

/* ============================================================
   Tabs (top)
   ============================================================ */
function Tabs({ active, onChange }) {
  return (
    <nav className="tabs">
      <div className="tabs-row">
        {D.TABS.map((t, i) => (
          <button
            key={t}
            className={"tab-pill " + (active === i ? "on" : "")}
            onClick={() => onChange(i)}
          >
            {t}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ============================================================
   Saludo
   ============================================================ */
function Saludo() {
  const s = D.SALUDO;
  return (
    <section className="saludo">
      <span className="eyebrow">{s.eyebrow}</span>
      <h1>{s.h1Pre}<em>{s.h1Em}</em>{s.h1Post}</h1>
      <div className="saludo-sub">{s.sub}</div>
    </section>
  );
}

/* ============================================================
   Alertas (chips)
   ============================================================ */
function Alertas() {
  const [items, setItems] = useState(D.ALERTAS);
  const [dismissing, setDismissing] = useState(null);
  const dismiss = (id) => {
    setDismissing(id);
    setTimeout(() => {
      setItems((xs) => xs.filter((x) => x.id !== id));
      setDismissing(null);
    }, 200);
  };
  if (!items.length) return null;
  return (
    <div className="alerts" role="list">
      {items.map((a) => (
        <button
          key={a.id}
          role="listitem"
          className={"chip " + a.sev + (dismissing === a.id ? " dismissed" : "")}
          onClick={() => dismiss(a.id)}
        >
          <span className="chip-led" />
          <span>{a.text}</span>
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   Stock hero card
   ============================================================ */
function StockHero() {
  const h = D.STOCK_HERO;
  const { fmt, fmtPct } = D;
  return (
    <article className="stock-hero">
      <div className="sh-head">
        <div>
          <h3>{h.title}</h3>
          <div className="sh-head-sub">{h.sub}</div>
        </div>
        <button className="sh-btn">módulo <Icon.ArrowRight /></button>
      </div>

      <div className="sh-cols">
        <div className="sh-col">
          <div className="sh-col-label">
            PEGSA <span className="sh-tag">{h.pegsa.tag}</span>
          </div>
          <div className="sh-big">
            <span className="sh-big-num">{fmt(h.pegsa.cab)}</span>
            <span className="sh-big-unit">cab</span>
          </div>
          <div className="sh-meta">
            <b>{fmt(h.pegsa.t)}</b> t · <b>{h.pegsa.kgCab}</b> kg/cab{h.pegsa.est != null ? <> · <b>{h.pegsa.est}</b> est.</> : null}
          </div>
        </div>

        <div className="sh-divider" />

        <div className="sh-col">
          <div className="sh-col-label">
            GRUPO <span className="sh-tag">{h.grupo.tag}</span>
          </div>
          <div className="sh-big">
            <span className="sh-big-num">{fmt(h.grupo.cab)}</span>
            <span className="sh-big-unit">cab</span>
          </div>
          <div className="sh-meta">
            <b>{fmt(h.grupo.t)}</b> t · <b>{h.grupo.kgCab}</b> kg/cab · <b>{h.grupo.est}</b> est.
          </div>
        </div>
      </div>

      <div className="sh-foot">
        <div className="sh-foot-row">
          <span>Variación cabezas 12m</span>
          <span className={"sh-foot-val " + (h.var12m >= 0 ? "pos" : "")}>{h.var12m != null ? fmtPct(h.var12m) : "—"}</span>
        </div>
        <div className="sh-foot-row">
          <span>Hoteleros · terceros</span>
          <span className="sh-foot-val">{fmt(h.hoteleros)} cab</span>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   Mercado · cotizaciones
   ============================================================ */
function Cotizaciones() {
  const c = D.COTIZACIONES;
  return (
    <article className="card cot-card">
      <div className="card-head">
        <div>
          <h3>{c.title}</h3>
          <div className="card-head-sub">{c.sub}</div>
        </div>
      </div>
      <div className="cot-grid">
        {c.items.map((it, i) => (
          <div key={i} className="cot-cell">
            <div className="cot-top">
              <span className="cot-label">{it.label}</span>
              {it.delta !== null && (
                <span className={"cot-delta " + (it.delta >= 0 ? "pos" : "neg")}>
                  {D.fmtPct(it.delta)}
                </span>
              )}
            </div>
            <div className="cot-val">{it.value}</div>
            <div className="cot-unit">{it.unit}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

/* ============================================================
   Insumos críticos
   ============================================================ */
function InsumoCard({ insumo }) {
  return (
    <article className="card insumo">
      <div className="card-head">
        <div>
          <h3>{insumo.title}</h3>
          <div className="card-head-sub">{insumo.sub}</div>
        </div>
        <span className={"state-chip " + insumo.state}>
          <span className="led" />
          {insumo.stateLabel}
        </span>
      </div>
      <div className="insumo-body">
        <div className={"insumo-days " + insumo.state}>
          <div className="insumo-days-num">{insumo.dias}</div>
          <div className="insumo-days-label">días</div>
        </div>
        <div className="insumo-rows">
          {insumo.rows.map((r, i) => (
            <div key={i} className="insumo-row">
              <span className="insumo-row-k">{r.k}</span>
              <span className="insumo-row-v">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function Insumos() {
  return (
    <>
      {D.INSUMOS.map((i) => <InsumoCard key={i.id} insumo={i} />)}
    </>
  );
}

/* ============================================================
   Financiero · flujo semanal
   ============================================================ */
function FlujoSemanal() {
  const f = D.FLUJO_SEMANAL;
  const { fmtMoney } = D;
  const maxAbs = Math.max(1, ...f.bars.map((b) => Math.abs(b.v)));
  return (
    <article className="card flujo">
      <div className="card-head">
        <div>
          <h3>{f.title}</h3>
          <div className="card-head-sub">{f.sub}</div>
        </div>
      </div>

      <div className="flujo-panel pos">
        <div>
          <div className="flujo-panel-label">{f.cerrada.label}</div>
          <div className="flujo-panel-sub">{f.cerrada.range}</div>
        </div>
        <div className="flujo-panel-val">{fmtMoney(f.cerrada.value, "M")}</div>
      </div>

      <div className="flujo-arrow">↓</div>

      <div className="flujo-panel neg">
        <div>
          <div className="flujo-panel-label">{f.proxima.label}</div>
          <div className="flujo-panel-sub">{f.proxima.range}</div>
        </div>
        <div className="flujo-panel-val">{fmtMoney(f.proxima.value, "M")}</div>
      </div>

      {f.bars.length > 0 && (
        <div className="flujo-bars">
          {f.bars.map((b, i) => {
            const h = (Math.abs(b.v) / maxAbs) * 30;
            const pct = h.toFixed(1) + "%";
            const fillStyle = b.v >= 0
              ? { bottom: "50%", height: pct }
              : { top: "50%", height: pct };
            return (
              <div key={i} className={"flujo-bar-cell " + b.kind}>
                <div className="flujo-bar-track">
                  <div className="flujo-bar-axis" />
                  <div
                    className={"flujo-bar-fill " + (b.v >= 0 ? "pos" : "neg")}
                    style={fillStyle}
                  />
                </div>
                <div className="flujo-bar-label">{b.label}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flujo-acum">
        <div>
          <div className="flujo-acum-label">{f.acumulado.label}</div>
          <div className="flujo-acum-sub">{f.acumulado.sub}</div>
        </div>
        <div className="flujo-acum-val">{fmtMoney(f.acumulado.value, "M")}</div>
      </div>
    </article>
  );
}

/* ============================================================
   Line chart SVG (Patrimonio + Stock kilos)
   ============================================================ */
function LineChart({ data }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);

  const W = 320, H = 120;
  const padL = 28, padR = 8, padT = 8, padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const ys = data.points.map((p) => p.v);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const yMin = minY - range * 0.12;
  const yMax = maxY + range * 0.12;

  const xScale = (i) => padL + (i / Math.max(1, data.points.length - 1)) * innerW;
  const yScale = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const pathD = data.points
    .map((p, i) => (i === 0 ? "M" : "L") + xScale(i).toFixed(2) + "," + yScale(p.v).toFixed(2))
    .join(" ");

  const areaD =
    pathD +
    " L" + xScale(data.points.length - 1).toFixed(2) + "," + (padT + innerH).toFixed(2) +
    " L" + padL.toFixed(2) + "," + (padT + innerH).toFixed(2) +
    " Z";

  // Gridlines y labels (yLabels puede ser array de strings o numbers)
  const gridLines = data.yLabels.map((yl) => {
    let v;
    if (typeof yl === "string") {
      const m = yl.match(/([\d,\.]+)/);
      v = m ? parseFloat(m[1].replace(",", ".")) : 0;
    } else {
      v = yl;
    }
    return { v, label: String(yl) };
  });

  const stroke = data.color === "pos" ? "var(--pos)" : "var(--primary)";
  const fillId = "fill-" + (data.color || "primary");

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const xPx = clientX - rect.left;
    const xPct = xPx / rect.width;
    const xView = xPct * W;
    if (xView < padL || xView > W - padR) { setHover(null); return; }
    const t = (xView - padL) / innerW;
    const idx = Math.max(0, Math.min(data.points.length - 1, Math.round(t * (data.points.length - 1))));
    const p = data.points[idx];
    setHover({
      idx,
      xPct: ((xScale(idx) / W) * 100),
      yPct: ((yScale(p.v) / H) * 100),
      label: p.x || ("p " + (idx + 1)),
      v: p.v,
    });
  };
  const onLeave = () => setHover(null);

  return (
    <>
      <div
        ref={wrapRef}
        className="chart-wrap"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onTouchStart={onMove}
        onTouchMove={onMove}
        onTouchEnd={onLeave}
      >
        <svg viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none">
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((gl, i) => {
            const y = yScale(gl.v);
            if (isNaN(y) || y < padT - 1 || y > padT + innerH + 1) return null;
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y}
                      stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" />
                <text x={padL - 6} y={y + 3.5} fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fill="var(--ink-faint)" textAnchor="end">
                  {gl.label}
                </text>
              </g>
            );
          })}

          <path d={areaD} fill={"url(#" + fillId + ")"} />

          <path d={pathD} fill="none" stroke={stroke} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />

          {hover && (
            <g>
              <line x1={xScale(hover.idx)} x2={xScale(hover.idx)}
                    y1={padT} y2={padT + innerH}
                    stroke="var(--ink)" strokeWidth="1"
                    strokeDasharray="2 3" opacity="0.4" />
              <circle cx={xScale(hover.idx)} cy={yScale(data.points[hover.idx].v)}
                      r="4.5" fill={stroke} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {hover && (
          <div className="chart-tip on"
               style={{ left: hover.xPct + "%", top: hover.yPct + "%" }}>
            <div>
              {data.unit} {Number(hover.v).toLocaleString("es-AR", { maximumFractionDigits: 2 }).replace(".", ",")}
            </div>
            <span className="chart-tip-sub">{hover.label}</span>
          </div>
        )}
      </div>

      <div className="chart-xlabels">
        {data.xLabels.map((xl, i) => <span key={i}>{xl}</span>)}
      </div>
    </>
  );
}

function ChartCard({ data }) {
  const isPos = data.delta != null && data.delta >= 0;
  const sufijo = data.title.toLowerCase().includes("usd") ? "YoY" : "12 m";
  return (
    <article className="card chart-card">
      <div className="card-head">
        <div>
          <h3>{data.title}</h3>
          <div className="chart-head-kpi">
            <span className="chart-head-val">{data.sub}</span>
            {data.delta != null && (
              <span className={"chart-head-delta " + (isPos ? "pos" : "neg")}>
                {D.fmtPct(data.delta)} {sufijo}
              </span>
            )}
          </div>
        </div>
      </div>
      <LineChart data={data} />
    </article>
  );
}

/* ============================================================
   Módulos grid
   ============================================================ */
function Modulos() {
  return (
    <div className="modulos">
      {D.MODULOS.map((m) => (
        <button key={m.n} className="mod"
                onClick={() => alert("Abrir módulo: " + m.title)}>
          <div className="mod-top">
            <span>{m.n}</span>
            <span className={"mod-led " + m.state} />
          </div>
          <div className="mod-title">{m.title}</div>
          <div className={"mod-kpi " + m.kind}>
            <span className="mod-kpi-num">{m.kpi}</span>
            {m.unit && <span className="mod-kpi-unit">{m.unit}</span>}
          </div>
          <div className="mod-sub">{m.sub}</div>
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   Footer
   ============================================================ */
function Footer() {
  return (
    <div className="foot">PEGSA & BULLTRADE · Uso interno · {new Date().toLocaleDateString("es-AR", { month: "short", year: "numeric" })}</div>
  );
}

/* ============================================================
   Bottom tab bar
   ============================================================ */
function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar">
      {D.BOTTOM_TABS.map((t) => (
        <button key={t.id}
                className={"tabbar-item " + (active === t.id ? "on" : "")}
                onClick={() => onChange(t.id)}>
          <TabIcon name={t.icon} />
          <span className="tabbar-item-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ============================================================
   App raíz
   ============================================================ */
function App() {
  const [tab, setTab] = useState(0);
  const [bottomTab, setBottomTab] = useState("panel");
  const [, setTick] = useState(0);

  useEffect(() => {
    const onReady = () => {
      D = window.MOBILE_DATA;
      setTick((t) => t + 1);
    };
    window.addEventListener("mobile:data-ready", onReady);
    return () => window.removeEventListener("mobile:data-ready", onReady);
  }, []);

  return (
    <div className="app">
      <Header />
      <Tabs active={tab} onChange={setTab} />

      <main className="main">
        <Saludo />
        <Alertas />

        <div className="sec-head">
          <h2><span className="ico">🔔</span>Lo más importante</h2>
        </div>
        <StockHero />
        <Cotizaciones />

        <hr className="sec-div" />

        <div className="sec-head">
          <h2><span className="ico">🌾</span>Insumos críticos</h2>
        </div>
        <Insumos />

        <hr className="sec-div" />

        <div className="sec-head">
          <h2><span className="ico">📋</span>Sub-datos</h2>
        </div>
        <FlujoSemanal />
        <ChartCard data={D.PATRIMONIO_USD} />
        <ChartCard data={D.STOCK_KILOS} />

        <hr className="sec-div" />

        <div className="sec-head">
          <h2><span className="ico">📂</span>Módulos</h2>
          <span className="sec-head-sub">{D.MODULOS.length} módulos · tocar para abrir</span>
        </div>
        <Modulos />

        <Footer />
      </main>

      <TabBar active={bottomTab} onChange={setBottomTab} />
    </div>
  );
}

/* Mount */
const root = ReactDOM.createRoot(document.getElementById("mobileRoot"));
root.render(<App />);
