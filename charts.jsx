/* Charts.jsx — sparklines, donut, area chart, bars, heatmap */

const { useMemo, useState, useRef, useEffect } = React;

// === Spark line ===
function Sparkline({ data, color = "currentColor", height = 36, fill = true, strokeWidth = 1.6 }) {
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - pad * 2) + pad;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const linePath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, overflow: "visible" }}>
      {fill && (
        <path d={areaPath} fill={color} opacity="0.12" />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}

// === Patrimonio area chart (interactive) ===
function PatrimonioChart({ data, currency = "ars" }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const W = 720, H = 220, padL = 50, padR = 16, padT = 10, padB = 28;

  const values = data.map(d => currency === "ars" ? d.ars : d.usd);
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.04;
  const range = max - min;

  const xAt = i => padL + (i / (data.length - 1)) * (W - padL - padR);
  const yAt = v => padT + (1 - (v - min) / range) * (H - padT - padB);

  const linePath = data.map((d, i) => {
    const x = xAt(i), y = yAt(currency === "ars" ? d.ars : d.usd);
    return (i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }).join(" ");

  const areaPath = `${linePath} L${xAt(data.length - 1)},${H - padB} L${xAt(0)},${H - padB} Z`;

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks);

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(xRatio * (data.length - 1))));
    setHover({ idx, clientX: e.clientX, clientY: e.clientY, rect });
  };

  const fmt = (v) => currency === "ars"
    ? `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} M`
    : `U$S ${v.toLocaleString("es-AR")}`;

  const tipPos = hover ? (() => {
    const rect = ref.current.getBoundingClientRect();
    const x = (xAt(hover.idx) / W) * rect.width;
    const v = currency === "ars" ? data[hover.idx].ars : data[hover.idx].usd;
    const y = (yAt(v) / H) * rect.height;
    return { x, y };
  })() : null;

  return (
    <div className="chart-wrap" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 220 }}>
        <defs>
          <linearGradient id="patriGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.42 0.13 256)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="oklch(0.42 0.13 256)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {tickVals.map((tv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yAt(tv)} y2={yAt(tv)} stroke="oklch(0.91 0.008 256)" strokeWidth="1" />
            <text x={padL - 8} y={yAt(tv) + 3} textAnchor="end" fontSize="10" fill="oklch(0.58 0.02 256)" fontFamily="JetBrains Mono">
              {currency === "ars" ? tv.toFixed(0) : tv.toFixed(1) + "k"}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="oklch(0.58 0.02 256)" fontWeight="500">
            {d.mes}
          </text>
        ))}
        <path d={areaPath} fill="url(#patriGrad)" />
        <path d={linePath} fill="none" stroke="oklch(0.42 0.13 256)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => {
          const v = currency === "ars" ? d.ars : d.usd;
          const isHover = hover && hover.idx === i;
          return <circle key={i} cx={xAt(i)} cy={yAt(v)} r={isHover ? 5 : 3} fill="white" stroke="oklch(0.42 0.13 256)" strokeWidth={isHover ? 2.5 : 1.8} />;
        })}
        {hover && (
          <line
            x1={xAt(hover.idx)} x2={xAt(hover.idx)}
            y1={padT} y2={H - padB}
            stroke="oklch(0.42 0.13 256)" strokeDasharray="3,3" strokeWidth="1" opacity="0.5"
          />
        )}
      </svg>
      {hover && tipPos && (
        <div className="chart-tip show" style={{ left: tipPos.x, top: tipPos.y - 10 }}>
          <small>{data[hover.idx].mes} 2025</small>
          <b>{fmt(currency === "ars" ? data[hover.idx].ars : data[hover.idx].usd)}</b>
        </div>
      )}
    </div>
  );
}

// === Donut composición por centro ===
function CompositionDonut({ centros }) {
  const [hover, setHover] = useState(null);

  // Solo positivos para el donut
  const positivos = centros.filter(c => c.total > 0);
  const total = positivos.reduce((a, b) => a + b.total, 0);

  const colors = [
    "oklch(0.42 0.13 256)",
    "oklch(0.55 0.13 230)",
    "oklch(0.62 0.14 200)",
    "oklch(0.68 0.13 175)",
    "oklch(0.55 0.13 155)",
    "oklch(0.65 0.14 130)",
    "oklch(0.7 0.14 90)",
  ];

  const cx = 90, cy = 90, r = 72, rIn = 50;
  let acc = 0;
  const segs = positivos.map((c, i) => {
    const frac = c.total / total;
    const start = acc;
    const end = acc + frac;
    acc = end;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = end * 2 * Math.PI - Math.PI / 2;
    const lg = frac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const xi0 = cx + rIn * Math.cos(a0), yi0 = cy + rIn * Math.sin(a0);
    const xi1 = cx + rIn * Math.cos(a1), yi1 = cy + rIn * Math.sin(a1);
    const d = `M${x0},${y0} A${r},${r} 0 ${lg} 1 ${x1},${y1} L${xi1},${yi1} A${rIn},${rIn} 0 ${lg} 0 ${xi0},${yi0} Z`;
    return { d, color: colors[i % colors.length], frac, centro: c };
  });

  const center = hover != null
    ? { val: positivos[hover].total, lbl: positivos[hover].nombre, frac: positivos[hover].total / total }
    : { val: total, lbl: "TOTAL POSITIVO", frac: 1 };

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" className="donut-svg">
        {segs.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={s.color}
            opacity={hover == null || hover === i ? 1 : 0.3}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer", transition: "opacity 0.15s" }}
          />
        ))}
        <text x="90" y="86" textAnchor="middle" className="donut-center">
          ${(center.val).toLocaleString("es-AR", { maximumFractionDigits: 0 })} M
        </text>
        <text x="90" y="103" textAnchor="middle" className="donut-center-label">
          {hover != null ? `${(center.frac * 100).toFixed(1)}%` : center.lbl}
        </text>
      </svg>
      <div className="donut-legend">
        {segs.map((s, i) => (
          <div
            key={i}
            className={`donut-legend-row ${hover != null && hover !== i ? "dim" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="legend-name">{s.centro.nombre}</span>
            <span className="legend-pct">{(s.frac * 100).toFixed(1)}%</span>
            <span className="legend-val">${s.centro.total.toLocaleString("es-AR")}M</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Donut: hacienda por establecimiento (cabezas + kg + %) ===
function EstablecimientoDonut({ items, size = 180 }) {
  const [hover, setHover] = useState(null);

  if (!items || !items.length) return null;
  const total = items.reduce((a, b) => a + b.cabezas, 0);
  const totalKg = items.reduce((a, b) => a + b.kg, 0);

  const colors = [
    "oklch(0.42 0.13 256)",
    "oklch(0.62 0.14 200)",
    "oklch(0.55 0.13 155)",
    "oklch(0.7 0.14 90)",
    "oklch(0.55 0.13 230)",
  ];

  const cx = size / 2, cy = size / 2;
  const r = size * 0.4;     // antes 72 cuando size=180
  const rIn = size * 0.278; // antes 50 cuando size=180
  let acc = 0;
  const segs = items.map((it, i) => {
    const frac = it.cabezas / total;
    const start = acc;
    const end = acc + frac;
    acc = end;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = end * 2 * Math.PI - Math.PI / 2;
    const lg = frac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const xi0 = cx + rIn * Math.cos(a0), yi0 = cy + rIn * Math.sin(a0);
    const xi1 = cx + rIn * Math.cos(a1), yi1 = cy + rIn * Math.sin(a1);
    const d = `M${x0},${y0} A${r},${r} 0 ${lg} 1 ${x1},${y1} L${xi1},${yi1} A${rIn},${rIn} 0 ${lg} 0 ${xi0},${yi0} Z`;
    return { d, color: colors[i % colors.length], frac, item: it };
  });

  const center = hover != null
    ? { val: items[hover].cabezas, lbl: items[hover].nombre, frac: items[hover].cabezas / total }
    : { val: total, lbl: "PEGSA total", frac: 1 };

  return (
    <div className="donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" style={{ width: size, height: size }}>
        {segs.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={s.color}
            opacity={hover == null || hover === i ? 1 : 0.3}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default", transition: "opacity 0.15s" }}
          >
            <title>{`${s.item.nombre} · ${s.item.cabezas.toLocaleString("es-AR")} cab · ${(s.item.kg/1000).toFixed(1).replace('.',',')} t · ${(s.frac*100).toFixed(1)}%`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="donut-center">
          {center.val.toLocaleString("es-AR")}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" className="donut-center-label">
          {hover != null ? `${(center.frac * 100).toFixed(1)}%` : center.lbl}
        </text>
      </svg>
      <div className="donut-legend">
        {segs.map((s, i) => (
          <div
            key={i}
            className={`donut-legend-row ${hover != null && hover !== i ? "dim" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default" }}
          >
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="legend-name">{s.item.nombre}</span>
            <span className="legend-pct">{(s.frac * 100).toFixed(1)}%</span>
            <span className="legend-val">{s.item.cabezas.toLocaleString("es-AR")} cab</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Bars horizontal ===
function StockBars({ items, variant, hideTotal = false }) {
  if (!items || items.length === 0) return null;
  const max = Math.max(...items.map(i => i.kg));
  const totalKg = items.reduce((a, b) => a + b.kg, 0);
  const totalCab = items.reduce((a, b) => a + b.cabezas, 0);

  const cls = variant ? `bars bars--${variant}` : 'bars';
  return (
    <div className={cls}>
      {items.map((it, i) => {
        const pct = (it.kg / max) * 100;
        const outside = pct < 40;
        const label = `${(it.kg / 1000).toFixed(0)} t`;
        return (
          <div key={i} className="bar-row" title={`${it.cabezas.toLocaleString("es-AR")} cabezas`}>
            <span className="bar-name">{it.categoria}</span>
            <div className={`bar-track${outside ? ' bar-track--has-outside' : ''}`}>
              <div className="bar-fill" style={{ width: `${pct}%` }}>
                {!outside && <span className="bar-fill-label">{label}</span>}
              </div>
              {outside && (
                <span
                  className="bar-fill-label bar-fill-label--outside"
                  style={{ left: `calc(${pct}% + 6px)` }}
                >
                  {label}
                </span>
              )}
            </div>
            <span className="bar-meta">
              {it.cabezas.toLocaleString("es-AR")}
              <small>cabezas</small>
            </span>
          </div>
        );
      })}
      {!hideTotal && (
        <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "var(--ink-mute)" }}>Total</span>
          <span className="mono tnum" style={{ fontWeight: 700, fontSize: 14 }}>
            {totalCab.toLocaleString("es-AR")} cab · {(totalKg / 1000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} t
          </span>
        </div>
      )}
    </div>
  );
}

// === Heatmap ===
function Heatmap({ data, meses }) {
  const [hover, setHover] = useState(null);
  const all = data.flatMap(c => c.data);
  const maxAbs = Math.max(...all.map(Math.abs));

  const colorFor = (v) => {
    const intensity = Math.min(1, Math.abs(v) / maxAbs);
    if (v >= 0) {
      const lightness = 0.97 - intensity * 0.42;
      return `oklch(${lightness} ${0.04 + intensity * 0.1} 155)`;
    }
    const lightness = 0.97 - intensity * 0.42;
    return `oklch(${lightness} ${0.04 + intensity * 0.12} 25)`;
  };

  const textColor = (v) => {
    const intensity = Math.min(1, Math.abs(v) / maxAbs);
    return intensity > 0.5 ? "white" : "var(--ink)";
  };

  return (
    <div>
      <div className="heatmap">
        <div className="hm-row head">
          <div></div>
          {meses.map(m => <div key={m} className="hm-cell">{m}</div>)}
          <div className="hm-cell" style={{ textAlign: "right" }}>Total</div>
        </div>
        {data.map((row, ri) => {
          const total = row.data.reduce((a, b) => a + b, 0);
          return (
            <div key={ri} className="hm-row">
              <div className="hm-name">{row.nombre}</div>
              {row.data.map((v, ci) => (
                <div
                  key={ci}
                  className="hm-cell"
                  style={{ background: colorFor(v), color: textColor(v) }}
                  onMouseEnter={() => setHover({ row: ri, col: ci, value: v, mes: meses[ci], centro: row.nombre })}
                  onMouseLeave={() => setHover(null)}
                  title={`${row.nombre} · ${meses[ci]} · ${v >= 0 ? "+" : ""}$${v}M`}
                >
                  {Math.abs(v) >= 1 ? (v >= 0 ? "" : "−") + Math.abs(Math.round(v)) : ""}
                </div>
              ))}
              <div className={`hm-total ${total >= 0 ? "pos" : "neg"}`}>
                {total >= 0 ? "+" : "−"}${Math.abs(total).toLocaleString("es-AR")}M
              </div>
            </div>
          );
        })}
      </div>
      <div className="hm-legend">
        <span style={{ marginRight: 4 }}>Pérdida</span>
        <div className="hm-scale">
          <span style={{ background: "oklch(0.55 0.16 25)" }} />
          <span style={{ background: "oklch(0.78 0.1 25)" }} />
          <span style={{ background: "oklch(0.96 0.04 25)" }} />
          <span style={{ background: "oklch(0.97 0.005 256)" }} />
          <span style={{ background: "oklch(0.95 0.04 155)" }} />
          <span style={{ background: "oklch(0.78 0.1 155)" }} />
          <span style={{ background: "oklch(0.55 0.13 155)" }} />
        </div>
        <span style={{ marginLeft: 4 }}>Ganancia · M$/mes</span>
      </div>
    </div>
  );
}

Object.assign(window, { Sparkline, PatrimonioChart, CompositionDonut, EstablecimientoDonut, StockBars, Heatmap });
