/* mobile-stock.jsx — v15.75 · Módulo 01 · Stock de Masa como pantalla propia
   ---------------------------------------------------------------
   Segundo <script type="text/babel"> de mobile.html, cargado DESPUÉS de
   mobile.jsx. Los dos scripts comparten el scope global (son scripts
   clásicos, no módulos), así que acá NO se redeclara nada de mobile.jsx:
   ni los hooks (se usan como React.useState), ni D, ni Icon, ni Modal.
   Todo lo nuevo lleva prefijo Sk / sk- para no chocar.

   Reproduce la maqueta aprobada por Nicolás
   (Claude_Outputs\Mapeos_y_Descubrimientos\maqueta_movil_stock_2026-09-16.html):
   cabecera navy con 4 sub-pestañas — Stock · Productivo · Movimientos ·
   Muertes — y hojas inferiores por establecimiento / categoría que leen el
   JSON compacto stock_movil_<per>.json (v15.75, pipeline).

   Datos: fetch directo de los JSON publicados (igual que data.js: sin
   cache-buster, GitHub Pages los refresca con el tick). Se cargan en
   paralelo y cada pestaña se dibuja en cuanto tiene lo suyo; si un JSON
   falla, esa card dice "sin datos" y el resto sigue.
   --------------------------------------------------------------- */

var SK_PER = "2025";
var SK_FILES = {
  kpis:  "stock_kpis_" + SK_PER + ".json",
  pegsa: "stock_prop_PEGSA_" + SK_PER + ".json",
  movil: "stock_movil_" + SK_PER + ".json",
  prod:  "productivo_" + SK_PER + ".json",
  ind:   "indicadores_" + SK_PER + ".json",
  cons:  "consumo_" + SK_PER + ".json",
  mov:   "movimientos_" + SK_PER + ".json",
  mue:   "muertes_" + SK_PER + ".json",
  mue30: "muertes_30d_" + SK_PER + ".json"
};
var SK_CACHE = {};   // key → promesa; se cachea por sesión (la página vive todo el día)

function skFetch(key) {
  if (!SK_CACHE[key]) {
    SK_CACHE[key] = fetch(SK_FILES[key])
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  return SK_CACHE[key];
}

/* key → json (cargado) | null (falló) | undefined (todavía no llegó) */
function useSkData() {
  var st = React.useState({});
  var data = st[0], setData = st[1];
  React.useEffect(function () {
    var alive = true;
    Object.keys(SK_FILES).forEach(function (k) {
      skFetch(k).then(function (j) {
        if (!alive) return;
        setData(function (d) { var n = Object.assign({}, d); n[k] = j; return n; });
      });
    });
    return function () { alive = false; };
  }, []);
  return data;
}

/* ── helpers de formato (es-AR) ── */
function skN(n, d) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  d = d || 0;
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function skT(kg) { return skN((kg || 0) / 1000, 0); }
var SK_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
var SK_ANIO_HOY = String(new Date().getFullYear()).slice(2);
/* "2025-10" → "Oct '25" (el año corto sólo cuando no es el año en curso) */
function skMesL(m) {
  if (!m) return "";
  var mm = SK_MES[parseInt(m.slice(5, 7), 10) - 1] || m;
  var yy = m.slice(2, 4);
  return mm + (yy !== SK_ANIO_HOY ? " '" + yy : "");
}
function skDM(f) { return f ? f.slice(8, 10) + "/" + f.slice(5, 7) : ""; }
var SK_CATN = { VA: "Vaca", TM: "Ternero", NT: "Novillito", TH: "Ternera", NV: "Novillo", VQ: "Vaquillona", TO: "Toro" };
var SK_CAT_ORDEN = ["VA", "TM", "NT", "TH", "NV", "VQ", "TO"];
/* semáforo del Δ de ADP: la misma regla del Panel (ProductivosGrid):
   |Δ| > 20 % severo (rojo) · 10–20 % moderado (ámbar) · < 10 % verde */
function skSem(v) { var a = Math.abs(v || 0); return a > 20 ? "neg" : (a >= 10 ? "warn" : "pos"); }
/* {clave: {cabezas,...}} → [{c, n, ...}] ordenado por cabezas desc */
function skObjToArr(obj, key) {
  key = key || "cabezas";
  return Object.keys(obj || {}).map(function (k) {
    var o = Object.assign({ c: k, n: SK_CATN[k] || k }, obj[k]);
    return o;
  }).sort(function (a, b) { return (b[key] || 0) - (a[key] || 0); });
}
function skMesesArr(obj) {
  return Object.keys(obj || {}).sort().map(function (m) { return Object.assign({ m: m }, obj[m]); });
}

/* ════════════════════════════════════════════════════════════
   Piezas de UI (todas con clases sk-* de mobile.css)
   ════════════════════════════════════════════════════════════ */
function SkSkel(props) {
  return <div className="sk-skel" style={{ height: (props.h || 120) + "px" }} />;
}
function SkSinDatos(props) {
  return <div className="sk-card"><div className="sk-ch"><div><h3>{props.title}</h3></div></div>
    <div className="sk-hint">sin datos — el JSON no está publicado todavía o no se pudo leer.</div></div>;
}
function SkCard(props) {
  return (
    <div className="sk-card">
      {(props.title || props.sub) && (
        <div className="sk-ch">
          <div>{props.title && <h3>{props.title}</h3>}{props.sub && <div className="sk-sub">{props.sub}</div>}</div>
          {props.more && <span className="sk-more">{props.more}</span>}
        </div>
      )}
      {props.children}
    </div>
  );
}
function SkHero(props) {
  return (
    <div className="sk-hero">
      <div className="sk-lbl">{props.lbl}</div>
      <div className="sk-big">{props.big}{props.unit && <small>{props.unit}</small>}</div>
      {props.grid && (
        <div className="sk-hero-grid">
          {props.grid.map(function (g, i) {
            return <div key={i}><div className={"sk-v " + (g.cls || "")}>{g.v}</div><div className="sk-k">{g.k}</div></div>;
          })}
        </div>
      )}
    </div>
  );
}
/* filas con barra, % y valor (la `bars()` de la maqueta) */
function SkBars(props) {
  var items = props.items || [], key = props.valueKey || "cab";
  if (!items.length) return <div className="sk-hint">sin datos.</div>;
  var mx = Math.max.apply(null, items.map(function (i) { return i[key] || 0; })) || 1;
  return (
    <div className="sk-rows">
      {items.map(function (it, ix) {
        var click = props.onRow ? function () { props.onRow(it); } : null;
        return (
          <div key={ix} className={"sk-row" + (click ? " is-click" : "")} onClick={click}
               role={click ? "button" : undefined} tabIndex={click ? 0 : undefined}
               onKeyDown={click ? function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(); } } : undefined}>
            <div className="sk-n">{it.n}{click && <span className="sk-chev">›</span>}<small>{it.small || ""}</small></div>
            <div className="sk-bar"><i className={props.gold ? "g" : ""} style={{ width: Math.max(3, (it[key] || 0) / mx * 100) + "%" }} /></div>
            <div className="sk-val">{props.label(it)}</div>
          </div>
        );
      })}
    </div>
  );
}
function SkKpi(props) {
  return (
    <div className="sk-kpi">
      <div className="sk-k">{props.k}</div>
      <div className="sk-v">{props.v}{props.unit && <small>{props.unit}</small>}</div>
      {props.d && <div className="sk-d">{props.d}</div>}
      {props.children}
    </div>
  );
}
/* tabla cab · % · kg/cab · días de las hojas */
function SkTabla(props) {
  var tot = props.tot || 1;
  return (
    <table className="sk-tbl">
      <thead><tr><th>&nbsp;</th><th>Cab</th><th>%</th><th>kg/cab</th><th>Días</th></tr></thead>
      <tbody>
        {(props.rows || []).map(function (r, i) {
          return <tr key={i}><td>{r.n}</td><td>{skN(r.cab)}</td><td>{skN(r.cab / tot * 100, 0)} %</td>
            <td>{skN(r.kgcab, 0)}</td><td>{skN(r.dias)}</td></tr>;
        })}
      </tbody>
    </table>
  );
}
/* barras SVG simples o dobles con grilla y eje (sin librería) */
function SkSvgBars(props) {
  var series = props.series || [], labels = props.labels || [];
  if (!series.length || !series[0].vals.length) return <div className="sk-hint">sin datos.</div>;
  var W = 360, H = props.h || 120, pl = 30, pb = 18, pt = 8;
  var n = series[0].vals.length, gw = (W - pl - 6) / n;
  var all = []; series.forEach(function (s) { s.vals.forEach(function (v) { all.push(v || 0); }); });
  var mx = Math.max.apply(null, all) * 1.08 || 1;
  var y = function (v) { return pt + (H - pt - pb) * (1 - (v || 0) / mx); };
  var fmt = props.fmt || function (v) { return skN(v); };
  var grid = [], ny = 3;
  for (var i = 0; i <= ny; i++) {
    var v = mx / ny * i;
    grid.push(<g key={"g" + i}>
      <line x1={pl} x2={W} y1={y(v)} y2={y(v)} className="sk-grid" />
      <text x={pl - 4} y={y(v) + 3} fontSize="9" textAnchor="end" className="sk-ax">{fmt(v)}</text>
    </g>);
  }
  var bars = [], k = series.length;
  series.forEach(function (s, si) {
    s.vals.forEach(function (v, i2) {
      var bw = (gw - 6) / k, x = pl + i2 * gw + 3 + si * bw;
      bars.push(<rect key={si + "-" + i2} x={x} y={y(v)} width={bw} height={Math.max(0, H - pb - y(v))} rx="2" fill={s.color} />);
    });
  });
  var lx = labels.map(function (l, i3) {
    if (n > 8 && i3 % 2) return null;
    return <text key={"l" + i3} x={pl + i3 * gw + gw / 2} y={H - 4} fontSize="9" textAnchor="middle" className="sk-ax sk-ax-x">{l}</text>;
  });
  return <svg className="sk-chart" viewBox={"0 0 " + W + " " + H}>{grid}{bars}{lx}</svg>;
}
function SkSparkline(props) {
  var vals = (props.vals || []).map(function (v) { return v || 0; });
  if (vals.length < 2) return <div className="sk-hint">sin datos.</div>;
  var W = 360, H = 70, p = 6;
  var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
  var x = function (i) { return p + i * (W - 2 * p) / (vals.length - 1); };
  var y = function (v) { return p + (H - 2 * p) * (1 - (v - mn) / ((mx - mn) || 1)); };
  var d = vals.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
  var last = vals.length - 1;
  return (
    <svg className="sk-chart" viewBox={"0 0 " + W + " " + H}>
      <path d={d + " L" + x(last) + " " + (H - p) + " L" + x(0) + " " + (H - p) + "Z"} fill={props.color} opacity=".12" />
      <path d={d} fill="none" stroke={props.color} strokeWidth="2" />
      <circle cx={x(last)} cy={y(vals[last])} r="3.5" fill={props.color} />
    </svg>
  );
}
/* rango óptimo del indicador (esc_min/esc_max/ref_opt_min/ref_opt_max) */
function SkGauge(props) {
  var ind = props.ind || {}, val = props.val;
  if (val == null || ind.esc_min == null || ind.esc_max == null) return null;
  var p = function (x) { return Math.max(0, Math.min(100, (x - ind.esc_min) / (ind.esc_max - ind.esc_min) * 100)); };
  var o1 = ind.ref_opt_min != null ? ind.ref_opt_min : ind.ref_min;
  var o2 = ind.ref_opt_max != null ? ind.ref_opt_max : ind.ref_max;
  return (
    <div className="sk-gauge">
      <div className="sk-track">
        <div className="sk-opt" style={{ left: p(o1) + "%", width: (p(o2) - p(o1)) + "%" }} />
        <div className="sk-pin" style={{ left: p(val) + "%" }} />
      </div>
      <div className="sk-ticks"><span>{skN(ind.esc_min, 1)}</span><span>óptimo {skN(o1, 1)}–{skN(o2, 1)}</span><span>{skN(ind.esc_max, 1)}</span></div>
    </div>
  );
}
/* los 4 mini-KPIs de las hojas */
function SkShGrid(props) {
  var r = props.r || {};
  return (
    <div className="sk-shgrid">
      <div><div className="sk-v">{skN(r.cab)}</div><div className="sk-k">cab</div></div>
      <div><div className="sk-v">{skT(r.kg)} t</div><div className="sk-k">kg hoy</div></div>
      <div><div className="sk-v">{skN(r.kgcab, 0)}</div><div className="sk-k">kg/cab</div></div>
      <div><div className="sk-v">{skN(r.dias)} d</div><div className="sk-k">estadía</div></div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   1 · STOCK
   ════════════════════════════════════════════════════════════ */
function skStockDe(kpis) {
  if (!kpis) return null;
  var K = kpis.kpis || kpis;
  var cat = skObjToArr(K.por_categoria).map(function (c) {
    return { c: c.c, n: c.n, cab: c.cabezas, kg: c.kg_estimado, kgcab: c.kg_promedio };
  });
  var est = Object.keys(K.por_establecimiento || {}).map(function (e) {
    var o = K.por_establecimiento[e];
    return { n: e, cab: o.cabezas, kg: o.kg_estimado, kgcab: o.kg_promedio };
  }).sort(function (a, b) { return b.cab - a.cab; });
  var prop = Object.keys(K.por_propietario || {}).map(function (pn) {
    var o = K.por_propietario[pn];
    return { n: pn, cab: o.cabezas, kg: o.kg_estimado, kgcab: o.kg_promedio };
  }).sort(function (a, b) { return b.cab - a.cab; });
  return { cab: K.total_cabezas, kg: K.total_kg_estimado_hoy, kgcab: K.kg_promedio_estimado,
           dias: K.dias_promedio_feedlot, estab: K.total_establecimientos, cat: cat, est: est, prop: prop };
}

function SkTabStock(props) {
  var data = props.data, who = props.who, setWho = props.setWho, openSheet = props.openSheet;
  var src = who === "pegsa" ? data.pegsa : data.kpis;
  if (src === undefined) return <><SkSkel h={150} /><SkSkel h={260} /><SkSkel h={200} /></>;
  var S = skStockDe(src);
  if (!S) return <SkSinDatos title="Stock" />;
  var tot = S.cab || 1;
  var movil = data.movil;   // puede ser undefined (cargando) o null (falló)
  var quien = who === "pegsa" ? "PEGSA propio" : "grupo completo";

  var sheetCat = function (c) {
    var d = movil && movil.catd && movil.catd[who] && movil.catd[who][c.c];
    openSheet({
      title: c.n,
      sub: quien + " · " + skN(c.cab / tot * 100, 1) + " % del stock",
      body: !d ? <div className="sk-hint">{movil === undefined ? "cargando el detalle…" : "sin detalle: stock_movil no está publicado todavía."}</div> : (
        <>
          <SkShGrid r={d.res} />
          <div className="sk-h4">Por establecimiento</div>
          <SkTabla rows={d.est} tot={d.res.cab} />
          {who === "grupo" && d.prop && d.prop.length > 1 && <><div className="sk-h4">Por propietario</div><SkTabla rows={d.prop} tot={d.res.cab} /></>}
        </>
      )
    });
  };
  var sheetEst = function (e) {
    var d = movil && movil.est && movil.est[who] && movil.est[who][e.n];
    openSheet({
      title: e.n,
      sub: quien + " · " + skN(e.cab / tot * 100, 1) + " % del stock" + (d ? " · " + d.res.corrales + (d.res.corrales === 1 ? " corral" : " corrales") : ""),
      body: !d ? <div className="sk-hint">{movil === undefined ? "cargando el detalle…" : "sin detalle: stock_movil no está publicado todavía."}</div> : (
        <>
          <SkShGrid r={d.res} />
          <div className="sk-h4">Qué hay · por categoría</div>
          <SkTabla rows={d.cat} tot={d.res.cab} />
          {d.prop && d.prop.length > 1 && <><div className="sk-h4">De quién es · por propietario</div><SkTabla rows={d.prop} tot={d.res.cab} /></>}
          {d.res.corrales > 1 && <>
            <div className="sk-h4">Corrales con más hacienda</div>
            <SkBars gold items={d.corr.map(function (x) { return { n: "Corral " + x.n, cab: x.cab, small: skN(x.kgcab, 0) + " kg/cab · " + skN(x.dias) + " d" }; })}
                    label={function (i) { return skN(i.cab); }} />
          </>}
        </>
      )
    });
  };

  return (
    <>
      <div className="sk-seg">
        <button className={who === "pegsa" ? "on" : ""} onClick={function () { setWho("pegsa"); }}>PEGSA propio</button>
        <button className={who === "grupo" ? "on" : ""} onClick={function () { setWho("grupo"); }}>Grupo completo</button>
      </div>
      <SkHero lbl={who === "pegsa" ? "Hacienda propia · PEGSA" : "Grupo · todos los propietarios"}
              big={skN(S.cab)} unit="CAB"
              grid={[{ v: skN(S.kg), k: "kg estimados hoy" }, { v: skN(S.kgcab, 0), k: "kg / cabeza" }, { v: skN(S.dias, 0) + " d", k: "estadía prom." }]} />
      <SkCard title="Por categoría" sub="cabezas · tocá para ver por establecimiento" more={S.cat.length + " cat."}>
        <SkBars items={S.cat.map(function (c) { return Object.assign({}, c, { small: skN(c.cab / tot * 100, 1) + " %" }); })}
                label={function (i) { return <>{skN(i.cab)}<small>{skN(i.kgcab, 0)} kg/cab</small></>; }} onRow={sheetCat} />
      </SkCard>
      <SkCard title="Por establecimiento" sub={"cabezas · " + S.estab + " campos · tocá para ver qué hay en cada uno"}>
        <SkBars gold items={S.est.map(function (e) { return Object.assign({}, e, { small: skN(e.cab / tot * 100, 1) + " %" }); })}
                label={function (i) { return <>{skN(i.cab)}<small>{skT(i.kg)} t</small></>; }} onRow={sheetEst} />
      </SkCard>
      {who === "grupo" && (
        <SkCard title="Por propietario" sub="hotelería · cabezas de terceros">
          <SkBars items={S.prop.map(function (p) { return Object.assign({}, p, { small: skN(p.cab / tot * 100, 1) + " %" }); })}
                  label={function (i) { return <>{skN(i.cab)}<small>{skN(i.kgcab, 0)} kg/cab</small></>; }} />
        </SkCard>
      )}
      <p className="sk-hint">Kg estimados = kg de ingreso + días × ADP calibrado, con techo por categoría (misma cuenta que la PC).</p>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   2 · PRODUCTIVO
   ════════════════════════════════════════════════════════════ */
function SkTabProd(props) {
  var data = props.data, P = data.prod, IN = data.ind, CO = data.cons;
  if (P === undefined && IN === undefined) return <><SkSkel h={150} /><SkSkel h={260} /><SkSkel h={220} /></>;
  var g = P && P.general, f = IN && IN.fuentes, I = IN && IN.indicadores;
  var cat = P ? skObjToArr(P.por_categoria_90d) : [];
  var mes = P ? skMesesArr(P.por_mes).slice(-12) : [];
  var dias = CO && CO.diario ? (CO.diario.dias || []).slice(-30) : [];
  var sem = CO && CO.semanal;
  var ultimo = mes[mes.length - 1];
  return (
    <>
      {f ? (
        <SkHero lbl={"ADP real · último mes (" + skMesL(f.adp_mes) + ")"} big={skN(f.adp_promedio, 3)} unit="KG/DÍA"
                grid={g ? [{ v: skN(g.adp_promedio, 3), k: "ADP · año" }, { v: skN(g.estadia_promedio, 0) + " d", k: "estadía · año" }, { v: skN(g.cabezas), k: "cab vendidas · año" }] : null} />
      ) : (IN === undefined ? <SkSkel h={150} /> : <SkSinDatos title="ADP real · último mes" />)}

      {P === undefined ? <SkSkel h={260} /> : !P ? <SkSinDatos title="ADP por categoría · últimos 90 días" /> : (
        <SkCard title="ADP por categoría · últimos 90 días"
                sub={"real vs teórico " + ((P.meta || {}).base_anios ? "[" + P.meta.base_anios.join("-") + "]" : "") + " · semáforo >20 % / 10–20 % / <10 %"}>
          <table className="sk-tbl">
            <thead><tr><th>Categoría</th><th>Real</th><th>Teórico</th><th>Δ</th></tr></thead>
            <tbody>
              {cat.map(function (c) {
                var s = skSem(c.variacion_pct);
                return <tr key={c.c}>
                  <td>{c.n}<br /><span className="sk-td-sub">{skN(c.cabezas)} cab · {skN(c.estadia_promedio, 0)} d</span></td>
                  <td>{skN(c.adp_promedio, 3)}</td><td>{skN(c.adp_teorico, 3)}</td>
                  <td className={s}><span className={"sk-led " + s} /> {c.variacion_pct > 0 ? "+" : ""}{skN(c.variacion_pct, 1)} %</td>
                </tr>;
              })}
            </tbody>
          </table>
        </SkCard>
      )}

      {IN === undefined ? <SkSkel h={300} /> : !IN ? <SkSinDatos title="Eficiencia del rodeo · El Haras" /> : (
        <SkCard title="Eficiencia del rodeo · El Haras"
                sub={skN(f.cab_haras) + " cab · " + skN(f.kg_stock_haras) + " kg PV · consumo últimos " + f.dias_consumo + " días"}>
          <div className="sk-kpis" style={{ marginBottom: "12px" }}>
            <SkKpi k="% peso vivo (MS)" v={skN(I.pct_peso_vivo.valor, 2)} unit="% PV"><SkGauge ind={I.pct_peso_vivo} val={I.pct_peso_vivo.valor} /></SkKpi>
            <SkKpi k="Conversión" v={skN(I.conversion_alimenticia.valor, 2)} unit="MS : carne"><SkGauge ind={I.conversion_alimenticia} val={I.conversion_alimenticia.valor} /></SkKpi>
            <SkKpi k="Consumo / cab" v={skN(I.consumo_por_cabeza.valor_tc, 1)} unit="kg TC"
                   d={skN(I.consumo_por_cabeza.valor_ms, 1) + " kg MS" + (sem ? " · " + skN(sem.pct_ms_global, 0) + " % MS" : "")} />
            <SkKpi k="Producción diaria" v={skN(f.prod_diaria_kg)} unit="kg" d={skN(f.prom_diario_tc) + " kg TC repartidos/día"} />
          </div>
          <div className="sk-hint">La barra verde marca el rango óptimo; el punto es el valor de hoy.</div>
        </SkCard>
      )}

      {P && mes.length > 0 && (
        <SkCard title="ADP mes a mes" sub="kg/día promedio de las ventas de cada mes · últimos 12 meses">
          <SkSvgBars series={[{ vals: mes.map(function (m) { return m.adp_promedio; }), color: "#2f4f8c" }]}
                     labels={mes.map(function (m) { return skMesL(m.m); })} fmt={function (v) { return skN(v, 1); }} />
          {ultimo && <div className="sk-legend"><span>estadía prom. {skN(ultimo.estadia_promedio, 0)} d en {skMesL(ultimo.m)}</span></div>}
        </SkCard>
      )}

      {CO === undefined ? <SkSkel h={160} /> : !CO ? <SkSinDatos title="Consumo diario · últimos 30 días" /> : (
        <SkCard title="Consumo diario · últimos 30 días"
                sub={"kg tal cual repartidos" + (sem ? " · promedio 3 d " + skN(sem.promedio_diario_kg) + " kg" : "")}>
          <SkSparkline vals={dias.map(function (d) { return d.kg_total; })} color="#2f4f8c" />
          {dias.length > 0 && (
            <div className="sk-legend"><span>{skDM(dias[0].fecha)}</span>
              <span style={{ marginLeft: "auto" }}>{skDM(dias[dias.length - 1].fecha)} · {skN(dias[dias.length - 1].kg_total)} kg</span></div>
          )}
        </SkCard>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   3 · MOVIMIENTOS
   ════════════════════════════════════════════════════════════ */
var SK_TIPO_EGRESO = { V: "Venta", T: "Traslado", M: "Muerte" };
var SK_LISTA_N = 8;

function SkLista(props) {
  var st = React.useState(false), abierta = st[0], setAbierta = st[1];
  var items = props.items || [];
  if (!items.length) return <div className="sk-hint">sin movimientos en los últimos 30 días.</div>;
  var vis = abierta ? items : items.slice(0, SK_LISTA_N);
  return (
    <div className="sk-list">
      {vis.map(function (t, i) {
        return <div key={i} className="sk-li">
          <div className="sk-t"><b>{props.titulo(t)}</b><span>{skDM(t.fecha)} · {props.detalle(t)}</span></div>
          <div className="sk-r">{skN(t.cabezas)} cab<small>{skN(t.kg_prom, 0)} kg/cab</small></div>
        </div>;
      })}
      {items.length > SK_LISTA_N && (
        <button className="sk-more-btn" onClick={function () { setAbierta(!abierta); }}>
          {abierta ? "ver menos" : "ver los " + items.length}
        </button>
      )}
    </div>
  );
}

function SkTabMov(props) {
  var M = props.data.mov;
  if (M === undefined) return <><SkSkel h={150} /><SkSkel h={220} /><SkSkel h={200} /></>;
  if (!M || !M.anio) return <SkSinDatos title="Movimientos" />;
  var a = M.anio.resumen || {}, um = M.ultimo_mes || {}, u = um.resumen || {};
  var ingM = skMesesArr((M.anio.ingresos || {}).por_mes), egrM = skMesesArr((M.anio.egresos || {}).por_mes);
  var meses = {}; ingM.concat(egrM).forEach(function (x) { meses[x.m] = 1; });
  meses = Object.keys(meses).sort().slice(-12);
  var pick = function (arr, m) { var o = arr.filter(function (x) { return x.m === m; })[0]; return o ? o.cabezas : 0; };
  var tipo = (M.anio.egresos || {}).por_tipo_egreso || {};
  var tipos = Object.keys(tipo).map(function (k) { return { n: SK_TIPO_EGRESO[k] || k, cab: tipo[k].cabezas, small: skN(tipo[k].kg_promedio, 0) + " kg/cab" }; })
    .sort(function (x, y) { return y.cab - x.cab; });
  var ingCat = skObjToArr((M.anio.ingresos || {}).por_categoria).map(function (c) { return { n: c.n, cab: c.cabezas, small: skN(c.kg_promedio, 0) + " kg/cab" }; });
  var origen = ((M.anio.ingresos || {}).top10_origen || []).slice(0, 6).map(function (o) { return { n: o.nombre, cab: o.cabezas }; });
  var ing30 = M.anio.ingresos_detalle_30d || [], egr30 = M.anio.egresos_detalle_30d || [];
  var saldo = u.saldo_cabezas || 0;
  return (
    <>
      <SkHero lbl={(um.nombre || "Último mes") + " · saldo de cabezas"} big={(saldo > 0 ? "+" : "") + skN(saldo)} unit="CAB"
              grid={[{ v: "▲ " + skN(u.cabezas_ingresadas), k: "ingresadas · " + skN(u.kg_promedio_ingreso, 0) + " kg/cab", cls: "pos" },
                     { v: "▼ " + skN(u.cabezas_egresadas), k: "egresadas · " + skN(u.kg_promedio_egreso, 0) + " kg/cab", cls: "neg" },
                     { v: skN((u.saldo_kg || 0) / 1000, 0) + " t", k: "saldo kg" }]} />
      <SkCard title="Ingresos vs egresos · último año" sub="cabezas por mes">
        <SkSvgBars series={[{ vals: meses.map(function (m) { return pick(ingM, m); }), color: "#2f4f8c" },
                            { vals: meses.map(function (m) { return pick(egrM, m); }), color: "#c9a24b" }]}
                   labels={meses.map(skMesL)} />
        <div className="sk-legend"><span><i style={{ background: "#2f4f8c" }} />ingresos {skN(a.cabezas_ingresadas)}</span>
          <span><i style={{ background: "#c9a24b" }} />egresos {skN(a.cabezas_egresadas)}</span>
          <span style={{ marginLeft: "auto" }}>saldo {skN(a.saldo_cabezas)}</span></div>
      </SkCard>
      <div className="sk-kpis">
        <SkKpi k="Kg ingresados · año" v={skT(a.kg_ingresado)} unit="t" d={skN(a.kg_promedio_ingreso, 0) + " kg/cab"} />
        <SkKpi k="Kg egresados · año" v={skT(a.kg_egresado)} unit="t" d={skN(a.kg_promedio_egreso, 0) + " kg/cab"} />
      </div>
      <SkCard title="Egresos por tipo" sub="último año"><SkBars gold items={tipos} label={function (i) { return skN(i.cab); }} /></SkCard>
      <SkCard title="Ingresos por categoría" sub="último año · cabezas"><SkBars items={ingCat} label={function (i) { return skN(i.cab); }} /></SkCard>
      <SkCard title="Últimos ingresos" sub="30 días · tropa, cabezas y kg/cab">
        <SkLista items={ing30} titulo={function (t) { return t.doc; }}
                 detalle={function (t) { return (t.consignatario && t.consignatario !== "nan") ? t.consignatario : (t.vendedor || "—"); }} />
      </SkCard>
      <SkCard title="Últimas ventas" sub="30 días · remito, cabezas y kg/cab">
        <SkLista items={egr30} titulo={function (t) { return "Remito " + t.doc; }} detalle={function (t) { return t.lugar || "—"; }} />
      </SkCard>
      <SkCard title="Principales orígenes" sub="cabezas ingresadas · último año"><SkBars items={origen} label={function (i) { return skN(i.cab); }} /></SkCard>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   4 · MUERTES
   ════════════════════════════════════════════════════════════ */
function SkTabMuertes(props) {
  var U = props.data.mue, U30 = props.data.mue30;
  if (U === undefined && U30 === undefined) return <><SkSkel h={150} /><SkSkel h={200} /><SkSkel h={200} /></>;
  var d = U30 && U30.mortandad, a = U && U.mortandad;
  var pm = (U && U.anio && U.anio.por_mes) || {};
  var mes = Object.keys(pm).sort().map(function (m) { return { m: m, n: pm[m] || 0 }; });
  var grp = a ? Object.keys(a.por_grupo || {}).map(function (gname) {
    var v = a.por_grupo[gname];
    return { n: gname, cab: v.muertes, tasa: v.tasa_mensual_pct, small: skN(v.tasa_mensual_pct, 2) + " % mensual" };
  }) : [];
  var anioCat = U ? ((U.anio || {}).por_categoria || {}) : {};
  var d30Cat = U30 ? (((U30.detalle || {}).por_categoria) || (U && (U.mes_anterior || {}).por_categoria) || {}) : {};
  var cats = Object.keys(anioCat).sort(function (x, y) { return anioCat[y] - anioCat[x]; });
  var label30 = (U30 && U30.meta && U30.meta.label_periodo) || (U && U.meta && U.meta.nombre_mes_ant) || "Últimos 30 días";
  return (
    <>
      {d ? (
        <SkHero lbl="Últimos 30 días · tasa de mortandad" big={skN(d.tasa_mensual_pct, 2)} unit="%"
                grid={[{ v: skN(d.muertes_30d), k: "muertes · 30 d" },
                       { v: a ? skN(a.tasa_mensual_pct, 2) + " %" : "—", k: "tasa mensual · año" },
                       { v: a ? skN(a.muertes_anio) : "—", k: "muertes · año" }]} />
      ) : (U30 === undefined ? <SkSkel h={150} /> : <SkSinDatos title="Tasa de mortandad · 30 días" />)}
      {U === undefined ? <SkSkel h={200} /> : !U ? <SkSinDatos title="Muertes por mes" /> : (
        <>
          <SkCard title="Por mes" sub={"muertes con más de 30 días de encierre · últimos " + mes.length + " meses"}>
            <SkSvgBars series={[{ vals: mes.map(function (m) { return m.n; }), color: "#c44a3d" }]} labels={mes.map(function (m) { return skMesL(m.m); })} />
          </SkCard>
          <SkCard title="Por grupo · último año" sub="tasa = muertes ÷ (ingresos + stock El Haras)">
            <SkBars items={grp} label={function (i) { return <>{skN(i.cab)}<small>{skN(i.tasa, 2)} %</small></>; }} />
          </SkCard>
          <SkCard title="Por categoría" sub="30 días vs año">
            <table className="sk-tbl">
              <thead><tr><th>Categoría</th><th>30 d</th><th>Año</th><th>% del año</th></tr></thead>
              <tbody>
                {cats.map(function (c) {
                  return <tr key={c}><td>{SK_CATN[c] || c}</td><td>{skN(d30Cat[c] || 0)}</td><td>{skN(anioCat[c])}</td>
                    <td>{a && a.muertes_anio ? skN(anioCat[c] / a.muertes_anio * 100, 0) + " %" : "—"}</td></tr>;
                })}
              </tbody>
            </table>
          </SkCard>
        </>
      )}
      {d && <p className="sk-hint">{label30} · denominador {skN(d.denominador)} (ingresos 30 d {skN(d.ingresos_30d)} + stock El Haras {skN(d.stock_haras_hoy)}).</p>}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   La pantalla: cabecera navy + sub-pestañas + contenido
   ════════════════════════════════════════════════════════════ */
var SK_TABS = [["stock", "Stock"], ["prod", "Productivo"], ["mov", "Movimientos"], ["muertes", "Muertes"]];

function StockScreen(props) {
  var data = useSkData();
  var tabSt = React.useState(props.initialTab || "stock"), tab = tabSt[0], setTab = tabSt[1];
  var whoSt = React.useState("pegsa"), who = whoSt[0], setWho = whoSt[1];
  var mainRef = React.useRef(null);
  var gen = data.kpis && data.kpis.meta && data.kpis.meta.generado;
  var upd = gen ? skDM(gen) + " " + gen.slice(11, 16) : "";
  var cambiarTab = function (t) {
    setTab(t);
    try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0, 0); }
  };
  return (
    <>
      <div className="sk-hdr">
        <div className="sk-hdr-row">
          <button className="sk-back" onClick={props.onBack} aria-label="Volver a Módulos" title="Volver a Módulos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div><div className="sk-eyebrow">Módulo 01</div><h1>Stock de Masa — Kilos</h1></div>
          <div className="sk-upd">{upd ? <>actualizado<br />{upd}</> : null}</div>
        </div>
        <div className="sk-subtabs" role="tablist">
          {SK_TABS.map(function (t) {
            return <button key={t[0]} role="tab" aria-selected={tab === t[0]} className={tab === t[0] ? "on" : ""}
                           onClick={function () { cambiarTab(t[0]); }}>{t[1]}</button>;
          })}
        </div>
      </div>
      <main className="sk-main" ref={mainRef}>
        {tab === "stock"   && <SkTabStock data={data} who={who} setWho={setWho} openSheet={props.openSheet} />}
        {tab === "prod"    && <SkTabProd data={data} />}
        {tab === "mov"     && <SkTabMov data={data} />}
        {tab === "muertes" && <SkTabMuertes data={data} />}
      </main>
    </>
  );
}
