/* mobile.jsx — Panel ejecutivo PEGSA & Bulltrade — vista mobile
   React 18 UMD + Babel standalone.
   Datos: window.MOBILE_DATA (mobile-data.js, adaptador de window.PEGSA_DATA)

   v3 (2026-05-27): login + drill modals + navegación a módulos desktop
   --------------------------------------------------------------- */

const { useState, useRef, useEffect, useMemo, useContext, createContext } = React;

// Referencia que se actualiza al recibir 'mobile:data-ready'. <App/> incrementa
// un tick para forzar re-render cuando los datos reales llegan.
let D = window.MOBILE_DATA;

/* ============================================================
   USERS (espejo de js/core-home.js, mantener sincronizado)
   ============================================================ */
const USERS = {
  'pegsa':    { pass: 'garobi2025', name: 'PEGSA Admin',     initials: 'PA' },
  'bulltrade':{ pass: 'bull2025',   name: 'Bulltrade Admin', initials: 'BA' },
  'gerencia': { pass: 'gestion25',  name: 'Gerencia',        initials: 'GR' },
  'admin':    { pass: 'admin123',   name: 'Administrador',   initials: 'AD' }
};
const SESSION_KEY = 'pegsa_mobile_user';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.ts || !s.username) return null;
    if (Date.now() - s.ts > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch (e) { return null; }
}
function saveSession(username) {
  const acc = USERS[username];
  if (!acc) return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: username,
      name: acc.name,
      initials: acc.initials,
      ts: Date.now()
    }));
  } catch (e) {}
}
function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}

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
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  // v12.0: icono de "compartir PDF" (un documento con flecha hacia arriba).
  // Estilo lineal igual al resto, sin relleno.
  Share: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M14 3h-7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
      <path d="M14 3v6h6" />
      <path d="M12 18v-6" />
      <path d="M9 15l3-3 3 3" />
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
   Modal context
   ============================================================ */
const ModalCtx = createContext({ open: () => {}, close: () => {} });
const useModal = () => useContext(ModalCtx);

function Modal({ content, onClose }) {
  // Bloquear scroll del body mientras modal abierto
  useEffect(() => {
    if (!content) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [content]);

  if (!content) return null;

  const onBackdrop = (e) => {
    if (e.target.classList.contains("modal-backdrop")) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onBackdrop} role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-head">
          <div className="modal-head-text">
            <h3>{content.title}</h3>
            {content.sub && <div className="modal-head-sub">{content.sub}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <Icon.Close />
          </button>
        </div>
        <div className="modal-body">
          {content.body}
        </div>
        {content.foot && (
          <div className="modal-foot">{content.foot}</div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LoginScreen
   ============================================================ */
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const userRef = useRef(null);

  useEffect(() => { if (userRef.current) userRef.current.focus(); }, []);

  const submit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const u = user.trim().toLowerCase();
    const p = pass;
    if (!u || !p) { setErr("Completá usuario y contraseña."); return; }
    const acc = USERS[u];
    if (!acc || acc.pass !== p) { setErr("Usuario o contraseña incorrectos."); return; }
    saveSession(u);
    onLogin(u);
  };

  return (
    <div className="login-mobile">
      <div className="login-card">
        <div className="login-logo">PB</div>
        <div className="login-eyebrow">PEGSA & BULLTRADE</div>
        <h1 className="login-title">Acceso <em>restringido</em>.</h1>
        <div className="login-sub">Ingresá tus credenciales para entrar al panel</div>

        <form className="login-form" onSubmit={submit} noValidate>
          <label className="login-field">
            <span>Usuario</span>
            <input
              ref={userRef}
              type="text"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={user}
              onChange={(e) => { setUser(e.target.value); setErr(""); }}
              inputMode="text"
              placeholder="usuario"
            />
          </label>
          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => { setPass(e.target.value); setErr(""); }}
              placeholder="••••••••"
            />
          </label>
          {err && <div className="login-err">{err}</div>}
          <button type="submit" className="login-btn">Entrar</button>
        </form>

        <div className="login-foot">Uso interno · Dirección</div>
      </div>
    </div>
  );
}

/* ============================================================
   v12.0 · PDF export — Informe ejecutivo
   --------------------------------------------------------------
   Arma un PDF A4 multipágina con jsPDF (cargado en mobile.html
   como UMD) usando los datos de window.MOBILE_DATA. Las secciones
   son fijas y coinciden con lo que pidió el usuario:
     1. Stock terminados (Novillo>550, Vaca>650) con desglose
        PEGSA propio / El Haras / Grupo completo.
     2. Insumos críticos (Maíz + Silo) con stock kg, consumo/día y
        días restantes.
     3. Financiero PEG-BULL — cierre + saldo proyectado + tabla
        de 6 semanas.
     4. Financiero DW — idem (si hay datos; si no, se omite).
     5. Productivos — 6 KPIs del rodeo con actual + referencia.
     6. Precios de indiferencia de compra — 4 categorías.
   Después se ofrece compartir via Web Share API (con file),
   y si el navegador no soporta `canShare({files})`, se cae a
   descarga directa con doc.save(filename).
   ============================================================ */

const PDF_COLORS = {
  navy:    [14, 30, 58],      // PEGSA primary
  navy2:   [20, 40, 75],      // pill / chip del logo en la banda
  ink:     [25, 28, 35],
  ink2:    [80, 88, 100],
  muted:   [140, 148, 160],
  rule:    [220, 220, 220],
  zebra:   [247, 247, 248],
  bandSoft:[240, 244, 250],
  gold:    [193, 154, 107],
  pos:     [16, 122, 88],
  neg:     [196, 64, 60],
  warn:    [194, 132, 33],
  // v12.2: variantes "soft" para bg de cards (Productivos severo) y mini-barras
  // v12.5: posSoft/negSoft más vívidos para las barras del Financiero — la
  // versión anterior era casi blanca y las barras parecían invisibles.
  // badSoft/warnSoft/goodSoft siguen claros (los usa Productivos para bg).
  posSoft: [144, 198, 178],
  negSoft: [232, 158, 152],
  warnSoft:[252, 247, 230],
  badSoft: [253, 232, 232],
  goodSoft:[232, 246, 240]
};

// v12.1: jsPDF usa Helvetica Type-1 con WinAnsiEncoding (= Win-1252).
// El "signo menos verdadero" U+2212 NO está en Win-1252; Helvetica lo
// renderiza como `"`. Eso hacía que "−31%" del chip de Productivos
// saliera `"31%`. Normalizamos a "-" ASCII antes de cada doc.text().
function pdfSafe(s) {
  if (s == null) return "";
  return String(s).replace(/−/g, "-");
}

function pdfFmtInt(n) {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("es-AR");
}
function pdfFmtKg(n) {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("es-AR") + " kg";
}
function pdfFmtMoney(n) {
  if (n == null || isNaN(n)) return "—";
  var a = Math.abs(n);
  var sign = n < 0 ? "-" : "";
  if (a >= 1e9) return sign + "$ " + (a/1e9).toFixed(2).replace(".", ",") + " MM";
  if (a >= 1e6) return sign + "$ " + Math.round(a/1e6).toLocaleString("es-AR") + " M";
  if (a >= 1e3) return sign + "$ " + Math.round(a/1e3).toLocaleString("es-AR") + " k";
  return sign + "$ " + Math.round(a).toLocaleString("es-AR");
}

// v12.2: Header compacto (banda 14mm). El layout del mockup mete
// mucho contenido por página, asi que el header se achica al máximo:
// pill P&B + marca + fecha · paginador, todo en una fila. El nuevo
// buildPdfDoc() lo llama con (doc, null, null, pageNum, pageTotal) y
// dibuja los titulos de seccion por dentro de cada pagina.
function pdfDrawPageHeader(doc, _ignoredTitle, _ignoredSubtitle, pageNum, pageTotal) {
  var W = doc.internal.pageSize.getWidth();
  doc.setFillColor.apply(doc, PDF_COLORS.navy);
  doc.rect(0, 0, W, 14, 'F');
  // Pill P&B (logo)
  doc.setFillColor.apply(doc, PDF_COLORS.navy2);
  doc.roundedRect(8, 3.5, 12, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("P&B", 14, 8.4, { align: "center" });
  // Brand + fecha
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text("PEGSA & BULLTRADE", 24, 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor.apply(doc, PDF_COLORS.gold);
  doc.text("INFORME EJECUTIVO · " + new Date().toLocaleDateString("es-AR"), 24, 10.5);
  // Pill paginador a la derecha
  var pillW = 14;
  doc.setFillColor.apply(doc, PDF_COLORS.navy2);
  doc.roundedRect(W - pillW - 8, 3.5, pillW, 7, 1.5, 1.5, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(pageNum + " / " + pageTotal, W - pillW / 2 - 8, 8.4, { align: "center" });
  return 18; // Y inicial (debajo de banda + breathing)
}

function pdfDrawFooter(doc) {
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  doc.setDrawColor.apply(doc, PDF_COLORS.rule);
  doc.line(15, H - 12, W - 15, H - 12);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor.apply(doc, PDF_COLORS.muted);
  doc.text("Documento autogenerado · datos del panel PEGSA-Bulltrade", 15, H - 7);
  doc.text("Uso interno · Dirección", W - 15, H - 7, { align: "right" });
}

// Tabla simple: dibujá rect + text. cols = [{key,label,align,w}]
function pdfDrawTable(doc, x, y, cols, rows, opts) {
  opts = opts || {};
  var rowH = opts.rowH || 8;
  var headerH = opts.headerH || 9;
  var totalW = cols.reduce(function (s, c) { return s + (c.w || 30); }, 0);
  // Header bg
  doc.setFillColor.apply(doc, opts.headerBg || PDF_COLORS.navy);
  doc.rect(x, y, totalW, headerH, 'F');
  doc.setTextColor.apply(doc, opts.headerFg || [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(opts.headerFs || 9);
  var cx = x;
  cols.forEach(function (c) {
    var align = c.align || "left";
    var tx = cx + (align === "right" ? (c.w - 2) : (align === "center" ? c.w / 2 : 2));
    doc.text(c.label, tx, y + 6, { align: align });
    cx += c.w;
  });
  // Rows
  var cy = y + headerH;
  doc.setTextColor.apply(doc, PDF_COLORS.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(opts.rowFs || 9);
  rows.forEach(function (row, ri) {
    if (ri % 2 === 0) {
      doc.setFillColor.apply(doc, PDF_COLORS.zebra);
      doc.rect(x, cy, totalW, rowH, 'F');
    }
    var cxr = x;
    cols.forEach(function (c) {
      var v = row[c.key];
      var text = (v == null || v === "") ? "—" : String(v);
      var align = c.align || "left";
      var tx = cxr + (align === "right" ? (c.w - 2) : (align === "center" ? c.w / 2 : 2));
      // Si la celda tiene un color custom (row[c.key + "_color"]), usarlo
      var colorKey = c.key + "_color";
      if (row[colorKey]) doc.setTextColor.apply(doc, row[colorKey]);
      else doc.setTextColor.apply(doc, PDF_COLORS.ink);
      // Negrita opcional
      if (c.bold || row[c.key + "_bold"]) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");
      doc.text(text, tx, cy + 5.5, { align: align });
      cxr += c.w;
    });
    cy += rowH;
  });
  doc.setTextColor.apply(doc, PDF_COLORS.ink);
  doc.setFont("helvetica", "normal");
  return cy;
}

// Mini gráfico de barras horizontales — usado para las 6 semanas del
// flujo financiero. Cada barra muestra su valor a la derecha.
function pdfDrawFlujoBars(doc, x, y, w, bars, fmtFn) {
  var rowH = 6, gap = 2;
  var maxAbs = bars.reduce(function (m, b) { return Math.max(m, Math.abs(b.v || 0)); }, 1);
  // Eje cero: dividimos la barra en 60% para "magnitud" y 40% para etiqueta
  var barMaxW = w * 0.62;
  var zeroX = x + barMaxW * 0.50; // eje central
  var labelX = x + barMaxW + 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  bars.forEach(function (b, i) {
    var by = y + i * (rowH + gap);
    // Label izquierda
    doc.setTextColor.apply(doc, PDF_COLORS.ink2);
    doc.text(String(b.label || ("Sem " + (i+1))), x, by + 4.2);
    // Barra
    var v = b.v || 0;
    var len = (Math.abs(v) / maxAbs) * (barMaxW / 2);
    var color = v >= 0 ? PDF_COLORS.pos : PDF_COLORS.neg;
    doc.setFillColor.apply(doc, color);
    if (v >= 0) doc.rect(zeroX, by, len, rowH, 'F');
    else doc.rect(zeroX - len, by, len, rowH, 'F');
    // Eje cero (línea fina)
    doc.setDrawColor.apply(doc, PDF_COLORS.muted);
    doc.setLineWidth(0.2);
    doc.line(zeroX, by - 1, zeroX, by + rowH + 1);
    // Valor a la derecha
    doc.setTextColor.apply(doc, color);
    doc.setFont("helvetica", "bold");
    doc.text(fmtFn(v), labelX + w * 0.18, by + 4.2, { align: "right" });
    doc.setFont("helvetica", "normal");
  });
  return y + bars.length * (rowH + gap);
}

// Mini-card (caja con border + título arriba + KPI grande + sub-label).
// Usada para Productivos (6 KPIs en grid 2×3) y Precios (4 cards en 2×2).
function pdfDrawKpiCard(doc, x, y, w, h, opts) {
  doc.setDrawColor.apply(doc, PDF_COLORS.rule);
  doc.setLineWidth(0.3);
  if (opts.bgColor) {
    doc.setFillColor.apply(doc, opts.bgColor);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  } else {
    doc.roundedRect(x, y, w, h, 2, 2, 'S');
  }
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor.apply(doc, PDF_COLORS.ink2);
  doc.text(opts.title || "", x + 3, y + 5);
  // KPI grande
  doc.setFont("helvetica", "bold");
  doc.setFontSize(opts.kpiFs || 18);
  doc.setTextColor.apply(doc, opts.kpiColor || PDF_COLORS.navy);
  var kpiY = y + 5 + (opts.kpiOffset || 9);
  doc.text(opts.kpi || "—", x + 3, kpiY);
  // Unit (al lado del kpi, más chico)
  if (opts.unit) {
    var kpiW = doc.getStringUnitWidth(opts.kpi || "—") * (opts.kpiFs || 18) / doc.internal.scaleFactor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.ink2);
    doc.text(opts.unit, x + 3 + kpiW + 1.5, kpiY);
  }
  // Sub
  if (opts.sub) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text(opts.sub, x + 3, y + h - 3);
  }
  // Chip de delta (esquina superior derecha)
  if (opts.chip) {
    var chipColor = opts.chipColor || PDF_COLORS.muted;
    doc.setFillColor.apply(doc, chipColor);
    var cw = doc.getStringUnitWidth(opts.chip) * 7.5 / doc.internal.scaleFactor + 3;
    doc.roundedRect(x + w - cw - 3, y + 2.5, cw, 4.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(opts.chip, x + w - cw / 2 - 3, y + 5.8, { align: "center" });
  }
}

function buildPdfDoc() {
  var jspdfNS = window.jspdf || {};
  var JsPdfCtor = jspdfNS.jsPDF || window.jsPDF;
  if (!JsPdfCtor) throw new Error("jsPDF no está cargado");

  var doc = new JsPdfCtor({ unit: "mm", format: "a4", orientation: "portrait" });
  var W = doc.internal.pageSize.getWidth();   // 210
  var H = doc.internal.pageSize.getHeight();  // 297
  var margin = 10;
  var contentW = W - 2 * margin;              // 190
  var pageTotal = 2;
  var pageNum = 0;

  // ----- Helpers locales del layout v12.2 -----

  function newPage() {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    return pdfDrawPageHeader(doc, null, null, pageNum, pageTotal);
  }

  // Title de sección: v12.6 — fontSize 13 → 16 (PDF estaba muy vacío)
  function drawSectionTitle(y, label, sub) {
    doc.setFont("times", "bolditalic");
    doc.setFontSize(16);
    doc.setTextColor.apply(doc, PDF_COLORS.ink);
    doc.text(pdfSafe(label), margin, y + 5);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, PDF_COLORS.muted);
      doc.text(pdfSafe(sub), margin + contentW, y + 5, { align: "right" });
    }
    return y + 9;
  }

  // v12.4: mini-card horizontal de un origen (PEGSA/HARAS/OTROS/GRUPO)
  // con label arriba, KPI cabezas grande, y kg en formato compacto debajo.
  // Se usa en la fila "Totales del rodeo" de la P1.
  function drawTotalCard(x, y, w, h, item) {
    // v12.6: tipografías y posiciones escaladas (h 20 → 26)
    doc.setDrawColor.apply(doc, PDF_COLORS.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S');
    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.ink2);
    doc.text(pdfSafe(item.label), x + 3, y + 6);
    // KPI cabezas (grande, navy)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor.apply(doc, PDF_COLORS.navy);
    var cab = item.cabezas != null ? pdfFmtInt(item.cabezas) : "—";
    doc.text(pdfSafe(cab), x + 3, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text("cabezas", x + w - 3, y + 16, { align: "right" });
    // Kg compacto (formato XX.XXX kg / X,X M kg / etc.)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor.apply(doc, PDF_COLORS.ink);
    var kgVal = item.kg;
    var kgFmt = "—";
    if (kgVal != null) {
      if (kgVal >= 1e6)      kgFmt = (kgVal / 1e6).toFixed(2).replace(".", ",") + " M kg";
      else if (kgVal >= 1e3) kgFmt = Math.round(kgVal / 1e3).toLocaleString("es-AR") + " k kg";
      else                   kgFmt = pdfFmtInt(kgVal) + " kg";
    }
    doc.text(pdfSafe(kgFmt), x + 3, y + h - 3);
  }

  // Card de Stock terminados: v12.5 — 2 rows (PEGSA, GRUPO) en lugar de 4.
  // HARAS y OTROS ya viven arriba en la fila "Totales del rodeo", no se
  // duplican acá. Card baja de 38mm → 28mm.
  function drawStockCard(x, y, w, cat) {
    // v12.6: 28mm → 36mm, fuentes escaladas
    var h = 36;
    doc.setDrawColor.apply(doc, PDF_COLORS.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S');
    // Title bar (6 → 7.5mm)
    doc.setFillColor.apply(doc, PDF_COLORS.bandSoft);
    doc.rect(x + 0.3, y + 0.3, w - 0.6, 7.5, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, PDF_COLORS.navy);
    doc.text(pdfSafe((cat.label || "").toUpperCase()), x + 2.5, y + 5.3);

    // v12.5: solo 2 rows (PEGSA + GRUPO)
    var rows = [
      { lbl: "PEGSA", src: cat.pegsa },
      { lbl: "GRUPO", src: cat.grupo }
    ];
    var rowH = 7;
    var ry = y + 10;
    rows.forEach(function (r) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor.apply(doc, PDF_COLORS.ink2);
      doc.text(r.lbl, x + 2.5, ry + 4);
      // Cabezas
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor.apply(doc, PDF_COLORS.navy);
      var cab = (r.src && r.src.cabezas != null) ? pdfFmtInt(r.src.cabezas) : "—";
      doc.text(pdfSafe(cab), x + w * 0.50, ry + 4, { align: "right" });
      // Kg
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor.apply(doc, PDF_COLORS.ink);
      var kg = (r.src && r.src.kg != null) ? (pdfFmtInt(r.src.kg) + " kg") : "—";
      doc.text(pdfSafe(kg), x + w - 2.5, ry + 4, { align: "right" });
      ry += rowH;
    });

    // Footer Kg/cab.
    doc.setDrawColor.apply(doc, PDF_COLORS.rule);
    doc.setLineWidth(0.2);
    doc.line(x + 2.5, y + h - 7, x + w - 2.5, y + h - 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text("Kg / cab.", x + 2.5, y + h - 2.2);
    function kpc(src) {
      if (!src || !src.cabezas || !src.kg) return null;
      return Math.round(src.kg / src.cabezas);
    }
    var p = kpc(cat.pegsa), g = kpc(cat.grupo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, PDF_COLORS.ink);
    doc.text(pdfSafe((p != null ? p : "—") + " / " + (g != null ? g : "—") + " kg"),
             x + w - 2.5, y + h - 2.2, { align: "right" });

    return y + h;
  }

  // Fila de Insumo crítico: name + stock/consumo (sub) + KPI días grande + chip estado
  function drawInsumoRow(x, y, w, ins) {
    // v12.6: h 14 → 20, fuentes escaladas
    var h = 20;
    doc.setDrawColor.apply(doc, PDF_COLORS.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S');
    var stateColor = { bad: PDF_COLORS.neg, warn: PDF_COLORS.warn, ok: PDF_COLORS.pos };
    var col = stateColor[ins.state] || PDF_COLORS.muted;
    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor.apply(doc, PDF_COLORS.ink);
    doc.text(pdfSafe((ins.title || "").toUpperCase()), x + 3, y + 7.5);
    // Sub
    var stock = ins.stockKg != null ? pdfFmtInt(ins.stockKg) + " kg" : "—";
    var cons  = ins.consumoKgDia != null ? pdfFmtInt(ins.consumoKgDia) + " kg/d" : "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text(pdfSafe(stock + "  ·  " + cons), x + 3, y + 15);
    // KPI días
    var diasNum = ins.diasRaw != null ? String(Math.round(ins.diasRaw)) : "—";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor.apply(doc, col);
    doc.text(pdfSafe(diasNum), x + w - 44, y + 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text("días", x + w - 40, y + 14);
    // Chip
    var chipText = pdfSafe("• " + (ins.stateLabel || "—"));
    doc.setFontSize(9);
    var cw = doc.getStringUnitWidth(chipText) * 9 / doc.internal.scaleFactor + 4;
    doc.setFillColor.apply(doc, col);
    doc.roundedRect(x + w - cw - 3, y + h/2 - 3.25, cw, 6.5, 1.2, 1.2, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(chipText, x + w - cw / 2 - 3, y + h/2 + 1, { align: "center" });

    return y + h;
  }

  // Card Financiero (PEG-BULL o DW) — full-width, alto fijo, incluye
  // título + Hoy (saldo de partida) en header, 2 KPIs cierre/proyectado
  // en una fila, y 6 mini barras stylizadas con labels de semana.
  function drawFinCard(x, y, w, flujo, title, sub) {
    // v12.6: 46mm → 56mm, fuentes escaladas
    var h = 56;
    doc.setDrawColor.apply(doc, PDF_COLORS.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S');
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, PDF_COLORS.ink);
    doc.text(pdfSafe(title), x + 3, y + 6);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, PDF_COLORS.muted);
      doc.text(pdfSafe(sub), x + 3, y + 11);
    }
    // Hoy (saldo de partida)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text("Hoy", x + w - 3, y + 6, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    var hoyV = flujo.acumulado && flujo.acumulado.value;
    doc.setTextColor.apply(doc, hoyV >= 0 ? PDF_COLORS.navy : PDF_COLORS.neg);
    doc.text(pdfSafe(pdfFmtMoney(hoyV)), x + w - 3, y + 11, { align: "right" });
    // 2 KPIs (Cierre + Proyectado)
    var halfW = (w - 6) / 2;
    function kpi(px, label, range, value) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, PDF_COLORS.muted);
      doc.text(pdfSafe(label + " · " + (range || "—")), px, y + 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor.apply(doc, value >= 0 ? PDF_COLORS.pos : PDF_COLORS.neg);
      doc.text(pdfSafe(pdfFmtMoney(value)), px, y + 28);
    }
    kpi(x + 3, "CIERRE", flujo.cerrada && flujo.cerrada.range, flujo.cerrada && flujo.cerrada.value);
    var projRange = (flujo.proxima && flujo.proxima.range || "").replace("Cierre semana ", "");
    kpi(x + 3 + halfW, "PROYECTADO", projRange, flujo.proxima && flujo.proxima.value);
    // Mini bars + labels (carriles repartidos uniformes)
    var bars = flujo.bars || [];
    if (bars.length > 0) {
      var barsAreaY = y + 34;
      var barsAreaH = 14;
      var slotW = (w - 6) / bars.length;
      var maxAbs = bars.reduce(function (m, b) { return Math.max(m, Math.abs(b.v || 0)); }, 1);
      var zeroY = barsAreaY + barsAreaH * 0.55;
      var halfH = barsAreaH * 0.45;
      doc.setDrawColor.apply(doc, PDF_COLORS.rule);
      doc.setLineWidth(0.2);
      doc.line(x + 3, zeroY, x + w - 3, zeroY);
      // v12.6: thresholds para pesos enteros — MM (≥1e9), M (≥1e6), k (≥1e3)
      function fmtBarShort(v) {
        if (v == null) return "";
        var abs = Math.abs(v);
        var sign = v < 0 ? "-" : "+";
        if (abs >= 1e9) return sign + "$" + (abs / 1e9).toFixed(2).replace(".", ",") + "MM";
        if (abs >= 1e6) return sign + "$" + Math.round(abs / 1e6) + "M";
        if (abs >= 1e3) return sign + "$" + Math.round(abs / 1e3) + "k";
        return sign + "$" + Math.round(abs);
      }
      bars.forEach(function (b, i) {
        var v = b.v || 0;
        var bx = x + 3 + i * slotW + slotW * 0.18;
        var bw = slotW * 0.64;
        var bh = (Math.abs(v) / maxAbs) * halfH;
        var color = v >= 0 ? PDF_COLORS.posSoft : PDF_COLORS.negSoft;
        doc.setFillColor.apply(doc, color);
        if (v >= 0) doc.rect(bx, zeroY - bh, bw, bh, 'F');
        else doc.rect(bx, zeroY, bw, bh, 'F');
        // v12.5/6: label numérico encima/debajo del borde exterior de la barra.
        var labelV = fmtBarShort(v);
        if (labelV) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          if (v >= 0) {
            doc.setTextColor.apply(doc, PDF_COLORS.pos);
            var topY = Math.min(zeroY - 1.5, zeroY - bh - 1);
            doc.text(pdfSafe(labelV), bx + bw / 2, topY, { align: "center" });
          } else {
            doc.setTextColor.apply(doc, PDF_COLORS.neg);
            var botY = Math.max(zeroY + bh + 3, zeroY + 3);
            doc.text(pdfSafe(labelV), bx + bw / 2, botY, { align: "center" });
          }
        }
      });
      // Labels de semana
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, PDF_COLORS.muted);
      bars.forEach(function (b, i) {
        var lx = x + 3 + i * slotW + slotW * 0.5;
        doc.text(pdfSafe(String(b.label || "")), lx, y + h - 2.5, { align: "center" });
      });
    }
    return y + h;
  }

  // Card de Productivo (KPI con delta + bg coloreado según severity/tone)
  function drawProdCard(x, y, w, h, p) {
    var bg = null, kpiColor = PDF_COLORS.ink;
    if (p.severity === "severo") {
      if (p.tone === "bad") { bg = PDF_COLORS.badSoft; kpiColor = PDF_COLORS.neg; }
      else if (p.tone === "good") { bg = PDF_COLORS.goodSoft; kpiColor = PDF_COLORS.pos; }
    } else if (p.severity === "moderado") {
      bg = PDF_COLORS.warnSoft;
    }
    doc.setDrawColor.apply(doc, PDF_COLORS.rule);
    doc.setLineWidth(0.3);
    if (bg) {
      doc.setFillColor.apply(doc, bg);
      doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
    } else {
      doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S');
    }
    // Title — v12.6 scale
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.ink2);
    doc.text(pdfSafe((p.title || "").toUpperCase()), x + 3, y + 5.5);
    // Chip delta · v12.5/6: triángulo vectorial + pctOnly normalizado por pdfSafe
    if (p.deltaFmt) {
      var chipColor = (p.chipTone === "bad") ? PDF_COLORS.neg :
                      (p.chipTone === "good") ? PDF_COLORS.pos :
                      (p.chipTone === "warn") ? PDF_COLORS.warn : PDF_COLORS.muted;
      // v12.6 fix C: normalizar U+2212 a "-" ASCII ANTES del regex para que
      // el chip neutral muestre "13%" en lugar de la comilla rara.
      var pctOnly = pdfSafe(p.deltaFmt).replace(/^[+\-]/, '');
      doc.setFontSize(8);
      var pctW = doc.getStringUnitWidth(pctOnly) * 8 / doc.internal.scaleFactor;
      var hasArrow = (p.tone === "good" || p.tone === "bad");
      var triW = 2;
      var pad  = hasArrow ? 1.5 : 0;
      var cw   = (hasArrow ? triW + pad : 0) + pctW + 4;
      var chipX = x + w - cw - 2;
      var chipY = y + 1.8;
      doc.setFillColor.apply(doc, chipColor);
      doc.roundedRect(chipX, chipY, cw, 5, 0.9, 0.9, 'F');
      if (hasArrow) {
        var tx = chipX + 2;
        var ty = chipY + 2.5;
        doc.setFillColor(255, 255, 255);
        if (p.tone === "good") {
          doc.triangle(tx, ty + 1.2, tx + triW, ty + 1.2, tx + triW / 2, ty - 1.2, 'F');
        } else {
          doc.triangle(tx, ty - 1.2, tx + triW, ty - 1.2, tx + triW / 2, ty + 1.2, 'F');
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(pctOnly, chipX + (hasArrow ? triW + pad : 0) + 1.7, y + 5.7);
    }
    // KPI
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor.apply(doc, kpiColor);
    var kpiText = pdfSafe(p.kpi);
    doc.text(kpiText, x + 3, y + 15);
    if (p.unit) {
      var kpiW = doc.getStringUnitWidth(kpiText) * 20 / doc.internal.scaleFactor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, PDF_COLORS.ink2);
      doc.text(pdfSafe(p.unit), x + 3 + kpiW + 1.5, y + 15);
    }
    // Sub · v12.5: override del subLabel según id del KPI.
    var subOverride = {
      engordeDiario: "vs 12 m",
      estadia:       "vs 12 m",
      kgRepartidos:  "prom 3 d"
    };
    var subLabelFinal = subOverride[p.id] || (p.subLabel || "vs anual");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text(pdfSafe(subLabelFinal), x + 3, y + h - 2.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.ink2);
    doc.text(pdfSafe(p.subVal), x + w - 3, y + h - 2.5, { align: "right" });
  }

  // Card de Precio de indiferencia (KPI grande + 6 params en grid 2x3 + chip margen)
  function drawPrecioCard(x, y, w, h, p) {
    // v12.6 — fuentes y posiciones escaladas (caller pasará h=62)
    doc.setDrawColor.apply(doc, PDF_COLORS.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'S');
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, PDF_COLORS.ink);
    doc.text(pdfSafe(p.nombreBase || ""), x + 3, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    // v12.5: fallback "· N días" cuando el nombre no incluye días
    var nombreSubFinal = p.nombreSub ||
      (p.diasFeed != null ? "· " + Math.round(p.diasFeed) + " días" : "");
    doc.text(pdfSafe(nombreSubFinal), x + 3, y + 12);
    // Chip margen · neutral → pos (verde)
    if (p.margenPctFmt) {
      var mc = p.margenTone === "good" ? PDF_COLORS.pos :
               p.margenTone === "bad"  ? PDF_COLORS.neg :
               p.margenTone === "warn" ? PDF_COLORS.warn : PDF_COLORS.pos;
      var chipText = pdfSafe(p.margenPctFmt);
      doc.setFontSize(8);
      var cw = doc.getStringUnitWidth(chipText) * 8 / doc.internal.scaleFactor + 3;
      doc.setFillColor.apply(doc, mc);
      doc.roundedRect(x + w - cw - 2, y + 3, cw, 5.5, 1.1, 1.1, 'F');
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(chipText, x + w - cw / 2 - 2, y + 7, { align: "center" });
    }
    // KPI
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor.apply(doc, PDF_COLORS.navy);
    doc.text(pdfSafe(p.precioCompFmt || "—"), x + 3, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF_COLORS.muted);
    doc.text("/kg compra", x + 3, y + 27);
    // 6 params en grid 2×3 — v12.6 paramY y+27→y+33, paramH 5.5→7
    var paramY = y + 33;
    var paramH = 7;
    var halfW = (w - 6) / 2;
    function param(idx, lbl, val) {
      var col = idx % 2;
      var row = Math.floor(idx / 2);
      var px = x + 3 + col * halfW;
      var py = paramY + row * paramH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, PDF_COLORS.muted);
      doc.text(pdfSafe(lbl), px, py + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor.apply(doc, PDF_COLORS.ink);
      doc.text(pdfSafe(val || "—"), px + halfW - 2, py + 4, { align: "right" });
    }
    param(0, "Compra",   p.kgCompraFmt);
    param(1, "Venta",    p.kgVentaFmt);
    param(2, "Rinde",    p.rindeFmt);
    param(3, "Feed",     p.diasFeedFmt);
    param(4, "P. venta", p.precioVentaFmt);
    param(5, "Costo",    p.costoKgProdFmt);
  }

  // ====================== PÁGINA 1 ======================
  (function () {
    var y = newPage();

    // v12.4: TOTALES DEL RODEO — 4 mini-cards horizontales con
    // cabezas + kg por origen (PEGSA / HARAS / OTROS / GRUPO).
    y = drawSectionTitle(y, "Totales del rodeo", "cabezas · kilos por origen");
    var totales = D.STOCK_TOTALES || [];
    var tCardW = (contentW - 3 * 3) / 4;  // 4 cards con gap 3mm
    var tCardH = 26;  // v12.6: 20 → 26
    totales.slice(0, 4).forEach(function (it, i) {
      drawTotalCard(margin + i * (tCardW + 3), y, tCardW, tCardH, it);
    });
    y += tCardH + 5;

    // STOCK TERMINADOS — 2 cards lado a lado (Novillo>550 + Vaca>650)
    y = drawSectionTitle(y, "Stock terminados", "cabezas · kilos");
    var st = D.STOCK_TERMINADOS || [];
    var sCardW = (contentW - 4) / 2;
    var sBaseY = y;
    drawStockCard(margin, sBaseY, sCardW, st[0] || {});
    drawStockCard(margin + sCardW + 4, sBaseY, sCardW, st[1] || {});
    y = sBaseY + 36 + 6;  // v12.6: Stock card 28 → 36mm

    // INSUMOS CRITICOS — 2 rows full-width
    y = drawSectionTitle(y, "Insumos críticos", "autonomía estimada");
    var ins = (D.INSUMOS || []).slice(0, 2);
    ins.forEach(function (it) {
      y = drawInsumoRow(margin, y, contentW, it);
      y += 2;
    });
    y += 3;

    // FINANCIERO — 2 cards stacked full-width (PEG-BULL arriba, DW abajo)
    y = drawSectionTitle(y, "Financiero", "saldo proyectado · 6 semanas");
    if (D.FLUJO_SEMANAL) {
      y = drawFinCard(margin, y, contentW, D.FLUJO_SEMANAL,
                      "PEG-BULL", "Pecuaria El Garabí + Bulltrade");
      y += 3;
    }
    if (D.FLUJO_SEMANAL_DW) {
      drawFinCard(margin, y, contentW, D.FLUJO_SEMANAL_DW,
                  "DW · DARWASH", "análisis independiente");
    }
    pdfDrawFooter(doc);
  })();

  // ====================== PÁGINA 2 ======================
  (function () {
    var y = newPage();

    // PRODUCTIVOS — grid 2 cols × 3 rows
    y = drawSectionTitle(y, "Productivos", "actual vs anual");
    var prod = D.PRODUCTIVOS || [];
    var pCardW = (contentW - 4) / 2;
    var pCardH = 28;  // v12.6: 22 → 28
    var pBaseY = y;
    prod.forEach(function (p, i) {
      var col = i % 2;
      var row = Math.floor(i / 2);
      drawProdCard(margin + col * (pCardW + 4),
                   pBaseY + row * (pCardH + 3),
                   pCardW, pCardH, p);
    });
    y = pBaseY + Math.ceil(prod.length / 2) * (pCardH + 3) + 4;

    // PRECIOS DE INDIFERENCIA — grid 2×2
    var meta = D.PRECIOS_INFERENCIA_META || {};
    y = drawSectionTitle(y, "Precios de indiferencia",
                         "tope de compra · " + (meta.fechaLabel || "—"));
    var pin = (D.PRECIOS_INFERENCIA || []).slice(0, 4);
    var prCardW = (contentW - 4) / 2;
    var prCardH = 62;  // v12.6: 50 → 62
    var prBaseY = y;
    pin.forEach(function (p, i) {
      var col = i % 2;
      var row = Math.floor(i / 2);
      drawPrecioCard(margin + col * (prCardW + 4),
                     prBaseY + row * (prCardH + 3),
                     prCardW, prCardH, p);
    });

    pdfDrawFooter(doc);
  })();

  return doc;
}

// Genera el PDF y lo comparte via Web Share API; si no está disponible,
// cae a descarga directa.
async function handleSharePdf() {
  try {
    var doc = buildPdfDoc();
    var blob = doc.output("blob");
    var ts = new Date().toISOString().slice(0, 10);
    var filename = "PEGSA-Informe-" + ts + ".pdf";
    var file = new File([blob], filename, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "PEGSA · Informe Ejecutivo " + ts,
          text: "Resumen ejecutivo PEGSA-Bulltrade · " + new Date().toLocaleDateString("es-AR")
        });
        return;
      } catch (e) {
        // Si el usuario cancela el share, no caer a descarga
        if (e && e.name === "AbortError") return;
      }
    }
    // Fallback: descarga directa
    doc.save(filename);
  } catch (e) {
    console.error("PDF export error:", e);
    alert("No se pudo generar el PDF: " + ((e && e.message) || e));
  }
}

/* ============================================================
   Header
   ============================================================ */
function Header({ session, onLogout }) {
  const { brand, sub, notifications } = D.HEADER;
  const [generating, setGenerating] = useState(false);
  const onPdf = async () => {
    if (generating) return;
    setGenerating(true);
    try { await handleSharePdf(); }
    finally { setTimeout(() => setGenerating(false), 600); }
  };
  return (
    <header className="hdr">
      <div className="hdr-row">
        <div className="hdr-logo">PB</div>
        <div className="hdr-brand">
          <div className="hdr-brand-name">{brand}</div>
          <div className="hdr-brand-sub">{sub}</div>
        </div>
        <button
          className={"hdr-btn hdr-btn-pdf" + (generating ? " is-loading" : "")}
          aria-label="Compartir informe en PDF"
          onClick={onPdf}
          disabled={generating}
          title="Generar y compartir informe PDF"
        >
          <Icon.Share />
        </button>
        <button className="hdr-btn" aria-label="Notificaciones">
          <Icon.Bell />
          {notifications > 0 && (
            <span className="hdr-badge">{notifications}</span>
          )}
        </button>
        <button className="hdr-btn hdr-btn-logout" aria-label="Salir" onClick={onLogout} title={session ? "Salir (" + session.name + ")" : "Salir"}>
          <Icon.LogOut />
        </button>
      </div>
    </header>
  );
}

/* v4: La barra de tabs superior (Importante / Insumos / Sub-datos /
   Módulos) fue removida — las secciones ya están separadas con
   .sec-head + .sec-div dentro del main. La nav de abajo (Panel/Datos/
   Alertas/Módulos) cubre la navegación principal. */

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
   Helpers para construir contenido de modales
   ============================================================ */
function kvList(rows) {
  return (
    <div className="modal-kv">
      {rows.map((r, i) => (
        <div key={i} className="modal-kv-row">
          <span className="modal-kv-k">{r.k}</span>
          <span className={"modal-kv-v " + (r.cls || "")}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

/* Barras horizontales en CSS puro — usadas en el drill del Stock hero
   para mostrar D.stockCategorias (espejo del block 1 del módulo Stock
   del desktop, ordenado desc por kg). */
function CategoriasBars({ items }) {
  if (!items || !items.length) return null;
  const { fmt } = D;
  const max = Math.max.apply(null, items.map((it) => it.cabezas || 0)) || 1;
  return (
    <div className="mbars">
      {items.map((it, i) => {
        const pct = Math.max(2, Math.round((it.cabezas || 0) / max * 100));
        return (
          <div key={i} className="mbar-row">
            <div className="mbar-head">
              <span className="mbar-name">{it.categoria}</span>
              <span className="mbar-val">
                {fmt(it.cabezas)} cab · {fmt(Math.round((it.kg || 0) / 1000))} t
              </span>
            </div>
            <div className="mbar-track">
              <div className="mbar-fill" style={{ width: pct + "%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Donut SVG puro — usado en el drill del Stock hero para mostrar
   D.haciendaPegsaPorEstab (espejo del block 2 del módulo Stock del
   desktop, distribución de cabezas PEGSA por establecimiento).
   Hasta 7 segmentos coloreados con la paleta del portal. */
const DONUT_PALETTE = [
  "oklch(0.42 0.13 256)",
  "oklch(0.55 0.13 155)",
  "oklch(0.72 0.15 75)",
  "oklch(0.50 0.12 200)",
  "oklch(0.55 0.14 320)",
  "oklch(0.60 0.10 280)",
  "oklch(0.55 0.16 30)"
];
function EstabDonut({ items }) {
  if (!items || !items.length) return null;
  const { fmt } = D;
  const total = items.reduce((s, it) => s + (it.cabezas || 0), 0);
  if (!total) return null;

  const R = 50, r = 30, cx = 60, cy = 60;
  let acc = 0;
  const arcPath = (start, end) => {
    if (end - start >= 0.9999) {
      // Caso 1 solo segmento: dibujar como dos medios arcos para evitar M==L
      return [
        "M", cx + R, cy,
        "A", R, R, 0, 1, 1, cx - R, cy,
        "A", R, R, 0, 1, 1, cx + R, cy,
        "L", cx + r, cy,
        "A", r, r, 0, 1, 0, cx - r, cy,
        "A", r, r, 0, 1, 0, cx + r, cy,
        "Z"
      ].join(" ");
    }
    const a1 = start * 2 * Math.PI - Math.PI / 2;
    const a2 = end   * 2 * Math.PI - Math.PI / 2;
    const large = (end - start) > 0.5 ? 1 : 0;
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
    const xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
    const xi2 = cx + r * Math.cos(a2), yi2 = cy + r * Math.sin(a2);
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z`;
  };

  return (
    <div className="mdonut-wrap">
      <svg viewBox="0 0 120 120" className="mdonut-svg" aria-hidden="true">
        {items.map((it, i) => {
          const start = acc / total;
          acc += (it.cabezas || 0);
          const end = acc / total;
          if (end <= start) return null;
          const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
          return <path key={i} d={arcPath(start, end)} fill={color} stroke="#fff" strokeWidth="0.8" />;
        })}
        <text x="60" y="58" textAnchor="middle" className="mdonut-num">{fmt(total)}</text>
        <text x="60" y="72" textAnchor="middle" className="mdonut-num-sub">cab</text>
      </svg>
      <ul className="mdonut-leg">
        {items.map((it, i) => {
          const pct = ((it.cabezas || 0) / total) * 100;
          return (
            <li key={i}>
              <span className="mleg-dot" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
              <span className="mleg-name">{it.nombre}</span>
              <span className="mleg-pct">{pct.toFixed(pct < 10 ? 1 : 0).replace(".", ",")}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================
   Stock hero card (clickable → modal)
   ============================================================ */
function StockHero() {
  const h = D.STOCK_HERO;
  const { fmt, fmtPct } = D;
  const modal = useModal();

  const open = () => {
    modal.open({
      title: "Stock de hacienda",
      sub: h.sub,
      body: (
        <>
          {/* v5: PEGSA primero (lo que el usuario más necesita ver), Grupo
              después como referencia. Si no hay categoriasPegsa (data.js
              vieja sin el campo) cae al Grupo solo, sin romper. */}

          {/* Block 1: barras por categoría · PEGSA propio. */}
          {h.categoriasPegsa && h.categoriasPegsa.length > 0 && (
            <div className="modal-section">
              <h4>Por categoría · PEGSA propio</h4>
              <CategoriasBars items={h.categoriasPegsa} />
            </div>
          )}

          {/* Block 2: torta por establecimiento (PEGSA propio). */}
          {h.detallePorEstab && h.detallePorEstab.length > 0 && (
            <div className="modal-section">
              <h4>Por establecimiento · PEGSA propio</h4>
              <EstabDonut items={h.detallePorEstab} />
            </div>
          )}

          {/* Block 3: barras por categoría · Grupo completo (referencia). */}
          {h.categorias && h.categorias.length > 0 && (
            <div className="modal-section">
              <h4>Por categoría · Grupo completo</h4>
              <CategoriasBars items={h.categorias} />
            </div>
          )}

          {/* Referencia: var 12m y hoteleros (terceros). */}
          <div className="modal-section">
            <h4>Referencia</h4>
            {kvList([
              { k: h.var12mLabel, v: h.var12m != null ? fmtPct(h.var12m) : "N/D",
                cls: (h.var12m != null && h.var12m < 0) ? "neg" : "pos" },
              { k: "Hoteleros (terceros)", v: fmt(h.hoteleros) + " cab" },
              { k: "PEGSA propio",         v: fmt(h.pegsa.cab) + " cab · " + fmt(h.pegsa.t) + " t" },
              { k: "Grupo total",          v: fmt(h.grupo.cab) + " cab · " + fmt(h.grupo.t) + " t" }
            ])}
          </div>
        </>
      )
    });
  };

  return (
    <article className="stock-hero drill" onClick={open} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <div className="sh-head">
        <div>
          <h3>{h.title}</h3>
          <div className="sh-head-sub">{h.sub}</div>
        </div>
        <span className="sh-btn">ver detalle <Icon.ArrowRight /></span>
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
          <span>{h.var12mLabel}</span>
          <span className={"sh-foot-val " + (h.var12m != null && h.var12m >= 0 ? "pos" : (h.var12m != null ? "neg" : ""))}>
            {h.var12m != null ? fmtPct(h.var12m) : "N/D"}
          </span>
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
   Mercado · cotizaciones (cada cell clickable → modal)
   ============================================================ */
function Cotizaciones() {
  const c = D.COTIZACIONES;
  const modal = useModal();

  const openCell = (it) => {
    modal.open({
      title: it.label,
      sub: it.fuente + (c.fecha ? " · " + c.fecha : ""),
      body: kvList([
        { k: "Precio",            v: it.value + (it.unit ? " " + it.unit : "") },
        { k: it.deltaSrc || "Variación", v: it.delta != null ? D.fmtPct(it.delta) : "N/D",
          cls: it.delta != null && it.delta < 0 ? "neg" : (it.delta != null ? "pos" : "") },
        ...(it.deltaAbs != null ? [{ k: "Δ absoluto", v: D.fmtMoney(it.deltaAbs) }] : []),
        { k: "Fuente",            v: it.fuente }
      ])
    });
  };

  return (
    <article className="card cot-card">
      <div className="card-head">
        <div>
          <h3>{c.title}</h3>
          <div className="card-head-sub">{c.sub}{c.fecha ? " · " + c.fecha : ""}</div>
        </div>
      </div>
      <div className="cot-grid">
        {c.items.map((it, i) => (
          <button key={i} className="cot-cell drill" onClick={() => openCell(it)}>
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
          </button>
        ))}
      </div>
    </article>
  );
}

/* ============================================================
   Insumos críticos (cada card clickable → modal)
   ============================================================ */
function InsumoCard({ insumo }) {
  const modal = useModal();
  const open = () => {
    // v6: el modal de Silo/Maíz ahora suma "📋 Todos los insumos" debajo
    // del detalle individual — la card del panel quedó eliminada y este
    // resumen se accede a 1 tap desde cualquier insumo crítico.
    // Matching contra INSUMOS_ALL via display name (la "title" de la
    // card crítica viene de data.js INSUMO_DISPLAY_NAMES, el "nombre_raw"
    // del item ALL viene del JSON: usamos la propiedad raw como id).
    const allList = D.INSUMOS_ALL || [];
    const allTot  = D.INSUMOS_TOTAL || null;
    // El insumo "raw" id del crítico es el nombre upper-case del JSON
    // (ej. "SILO DE MAIZ"). El ID en el item ALL es nombre_raw.
    // insumo.id en INSUMOS críticos = it.nombre del JSON (uppercase original)
    const highlightId = insumo.id;
    return modal.open({
      title: insumo.title,
      sub: insumo.sub,
      body: (
        <>
          <div className="modal-section">
            {kvList([
              { k: "Estado",       v: insumo.stateLabel, cls: insumo.state },
              { k: "Días",         v: insumo.inconsistente ? "Datos inconsistentes" : insumo.dias },
              { k: "Stock",        v: insumo.stockKg != null ? (insumo.stockKg < 0 ? "−" : "") + D.fmt(Math.abs(insumo.stockKg)) + " kg" : "N/D",
                cls: (insumo.stockKg != null && insumo.stockKg < 0) ? "neg" : "" },
              { k: "Consumo / día", v: insumo.consumoKgDia != null ? D.fmt(insumo.consumoKgDia) + " kg" : "N/D" },
              { k: "Última compra", v: insumo.ultCompra ? D.fmtFechaCorta(insumo.ultCompra) : "N/D" }
            ])}
          </div>
          {insumo.inconsistente && (
            <div className="modal-note neg">
              ⚠ Datos contables inconsistentes — revisar en módulo Stock Insumos
            </div>
          )}
          {allList.length > 0 && (
            <div className="modal-section">
              <h4>
                Todos los insumos
                {allTot && allTot.count ? (
                  <span className="modal-section-sub">
                    {" · "}{allTot.count} ítems · {D.fmt(Math.round(allTot.totalKg || 0))} kg
                  </span>
                ) : null}
              </h4>
              <InsumosAllList items={allList} total={allTot} clickable={false} highlight={highlightId} />
            </div>
          )}
        </>
      )
    });
  };

  return (
    <article className="card insumo drill" onClick={open} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
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
        <div className={"insumo-days " + insumo.state + (insumo.inconsistente ? " inconsistente" : "")}>
          <div className="insumo-days-num">{insumo.dias}</div>
          <div className="insumo-days-label">{insumo.inconsistente ? "rev." : "días"}</div>
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
   v6 · <InsumosAllList /> — lista compacta de TODOS los insumos.
   Espejo del módulo Stock Insumos del desktop, reutilizable:
   en v5 estaba en una card en el panel, en v6 se embebe DENTRO
   del modal de cada insumo crítico (Silo / Maíz) — un toque de
   cualquier insumo crítico muestra su detalle + el resumen de
   todos los insumos, sin ocupar lugar en el panel.

   Props:
     items     — array enriquecido de D.INSUMOS_ALL
     total     — { totalKg, count, fecha } de D.INSUMOS_TOTAL
     clickable — bool (default false). Cuando está dentro de un
                 modal NO debe ser clickable (evita modales anidados).
     highlight — id opcional del insumo a resaltar (ej: el insumo
                 cuyo modal estamos viendo).
   ============================================================ */
function InsumosAllList({ items, total, clickable, highlight }) {
  const modal = useModal();
  const { fmt } = D;
  const list = items || [];
  const tot  = total || { totalKg: 0, count: list.length };
  if (!list.length) return null;

  const openItem = (it) => {
    if (!clickable) return;
    const semClass = it.semaforo || (it.dias != null ? (it.dias < 7 ? "bad" : (it.dias < 15 ? "warn" : "ok")) : "");
    modal.open({
      title: it.nombre,
      sub: it.descripcion || "",
      body: (
        <>
          <div className="modal-section">
            {kvList([
              { k: "Días restantes",  v: it.dias != null ? it.diasFmt + " d" : "N/D", cls: semClass },
              { k: "Stock",           v: it.stockKg != null ? (it.stockKg < 0 ? "−" : "") + fmt(Math.round(Math.abs(it.stockKg))) + " kg" : "N/D",
                cls: (it.stockKg != null && it.stockKg < 0) ? "neg" : "" },
              { k: "Consumo / día",   v: it.consumoKgDia != null ? fmt(Math.round(it.consumoKgDia)) + " kg" : "—" },
              { k: "% del stock total", v: it.pctTotal != null ? it.pctTotal.toFixed(1).replace(".", ",") + "%" : "—" }
            ])}
          </div>
          {it.inconsistente && (
            <div className="modal-note neg">
              ⚠ Stock negativo o días negativos — datos contables a revisar
            </div>
          )}
        </>
      )
    });
  };

  return (
    <ul className={"ins-all-list " + (clickable ? "" : "ro")}>
      {list.map((it) => {
        const sem = it.semaforo || (it.dias != null ? (it.dias < 7 ? "bad" : (it.dias < 15 ? "warn" : "ok")) : "");
        const pct = Math.max(0, Math.min(100, it.pctTotal != null ? Math.abs(it.pctTotal) : 0));
        const isHi = highlight && it.id === highlight;
        const RowTag = clickable ? "button" : "div";
        const rowProps = clickable
          ? { className: "ins-all-row drill" + (isHi ? " hi" : ""), onClick: () => openItem(it) }
          : { className: "ins-all-row" + (isHi ? " hi" : "") };
        return (
          <li key={it.id}>
            <RowTag {...rowProps}>
              <div className="ins-all-row-top">
                <span className="ins-all-name">{it.nombre}</span>
                <span className={"ins-all-days " + sem}>
                  {it.dias != null ? it.diasFmt : "—"}
                  <span className="ins-all-days-u">d</span>
                </span>
              </div>
              <div className="ins-all-row-mid">
                <span className="ins-all-stock">
                  {it.stockKg != null
                    ? (it.stockKg < 0 ? "−" : "") + fmt(Math.round(Math.abs(it.stockKg))) + " kg"
                    : "N/D"}
                </span>
                <span className="ins-all-pct">{it.pctTotal != null ? it.pctTotal.toFixed(1).replace(".", ",") + "%" : "—"}</span>
              </div>
              <div className="ins-all-bar">
                <div className={"ins-all-bar-fill " + sem} style={{ width: pct + "%" }} />
              </div>
            </RowTag>
          </li>
        );
      })}
    </ul>
  );
}

/* ============================================================
   Financiero · saldo proyectado (clickable → modal)
   v11: acepta prop `source` ("pegbull" default | "dw"). La misma
   card y modal se reusan para Financiero PEG-BULL y Financiero DW
   — ambas leen el mismo shape de mobile-data.js (FLUJO_SEMANAL /
   FLUJO_SEMANAL_DW). Si no hay datos para una fuente → null (early
   return), no se renderiza esa card.
   ============================================================ */
function FlujoSemanal({ source }) {
  const f = source === "dw" ? D.FLUJO_SEMANAL_DW : D.FLUJO_SEMANAL;
  if (!f) return null;  // early return cuando la fuente no tiene datos
  const { fmtMoneyCompact, fmtMoney } = D;
  const modal = useModal();
  const cerradaIsPos = (f.cerrada.value ?? 0) >= 0;
  const proxIsPos = (f.proxima.value ?? 0) >= 0;
  const maxAbs = Math.max(1, ...f.bars.map((b) => Math.abs(b.v)));

  const open = () => {
    modal.open({
      title: f.title,
      sub: f.sub + (f.fechaCorte ? " · corte " + D.fmtFechaCorta(f.fechaCorte) : ""),
      body: (
        <>
          <div className="modal-section">
            <h4>{f.cerrada.label}</h4>
            <div className={"modal-big " + (cerradaIsPos ? "pos" : "neg")}>
              {f.cerrada.value != null ? fmtMoneyCompact(f.cerrada.value) : "N/D"}
            </div>
            <div className="modal-section-sub">{f.cerrada.range}</div>
          </div>
          <div className="modal-section">
            <h4>{f.proxima.label}</h4>
            <div className={"modal-big " + (proxIsPos ? "pos" : "neg")}>
              {f.proxima.value != null ? fmtMoneyCompact(f.proxima.value) : "N/D"}
            </div>
            <div className="modal-section-sub">{f.proxima.range}</div>
          </div>
          {f.bars.length > 0 && (
            <div className="modal-section">
              <h4>Saldo proyectado · {f.bars.length} semanas</h4>
              {kvList(f.bars.map((b) => ({
                k: b.label + (b.kind === "next" ? " · actual" : ""),
                v: fmtMoneyCompact(b.v),
                cls: b.v >= 0 ? "pos" : "neg"
              })))}
            </div>
          )}
          <div className="modal-section">
            {kvList([
              { k: f.acumulado.label, v: f.acumulado.value != null ? fmtMoneyCompact(f.acumulado.value) : "N/D" }
            ])}
          </div>
        </>
      )
    });
  };

  return (
    <article className="card flujo drill" onClick={open} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <div className="card-head">
        <div>
          <h3>{f.title}</h3>
          <div className="card-head-sub">{f.sub}</div>
        </div>
      </div>

      <div className={"flujo-panel " + (cerradaIsPos ? "pos" : "neg")}>
        <div>
          <div className="flujo-panel-label">{f.cerrada.label}</div>
          <div className="flujo-panel-sub">{f.cerrada.range}</div>
        </div>
        <div className="flujo-panel-val">{f.cerrada.value != null ? fmtMoneyCompact(f.cerrada.value) : "N/D"}</div>
      </div>

      <div className="flujo-arrow">↓</div>

      <div className={"flujo-panel " + (proxIsPos ? "pos" : "neg")}>
        <div>
          <div className="flujo-panel-label">{f.proxima.label}</div>
          <div className="flujo-panel-sub">{f.proxima.range}</div>
        </div>
        <div className="flujo-panel-val">{f.proxima.value != null ? fmtMoneyCompact(f.proxima.value) : "N/D"}</div>
      </div>

      {f.bars.length > 0 && (
        <div className="flujo-bars">
          {f.bars.map((b, i) => {
            // v11.1: agregamos label numérico flotante encima/debajo de
            // cada barra ("$2.964M" / "−$120M"). La altura sube de 30%
            // a 40% del track para que se distingan mejor las diferencias.
            const h = (Math.abs(b.v) / maxAbs) * 40;
            const pct = h.toFixed(1) + "%";
            const isPos = b.v >= 0;
            const fillStyle = isPos
              ? { bottom: "50%", height: pct }
              : { top: "50%", height: pct };
            const numStyle = isPos
              ? { bottom: `calc(50% + ${pct} + 2px)` }
              : { top:    `calc(50% + ${pct} + 2px)` };
            return (
              <div key={i} className={"flujo-bar-cell " + b.kind}>
                <div className="flujo-bar-track">
                  <div className="flujo-bar-axis" />
                  <div
                    className={"flujo-bar-fill " + (isPos ? "pos" : "neg")}
                    style={fillStyle}
                  />
                  <div
                    className={"flujo-bar-num " + (isPos ? "pos" : "neg")}
                    style={numStyle}
                  >
                    {fmtMoneyCompact(b.v)}
                  </div>
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
        <div className="flujo-acum-val">{f.acumulado.value != null ? fmtMoneyCompact(f.acumulado.value) : "N/D"}</div>
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

/* ============================================================
   ChartCard (Patrimonio USD + Stock kilos) — clickable
   ============================================================ */
function ChartCard({ data }) {
  const isPos = data.delta != null && data.delta >= 0;
  const modal = useModal();

  const open = () => {
    const lastP = data.points[data.points.length - 1];
    const firstP = data.points[0];
    modal.open({
      title: data.title,
      sub: data.sub,
      body: (
        <>
          <div className="modal-section">
            {kvList([
              { k: "Actual", v: data.sub },
              { k: data.deltaLabel || "Variación", v: data.delta != null ? D.fmtPct(data.delta) : "N/D",
                cls: data.delta != null && data.delta < 0 ? "neg" : (data.delta != null ? "pos" : "") },
              { k: "Cantidad de puntos", v: data.nPuntos != null ? String(data.nPuntos) : "—" },
              { k: "Primer punto", v: firstP ? (firstP.x + ": " + Number(firstP.v).toLocaleString("es-AR", { maximumFractionDigits: 2 }).replace(".", ",")) : "—" },
              { k: "Último punto", v: lastP ? (lastP.x + ": " + Number(lastP.v).toLocaleString("es-AR", { maximumFractionDigits: 2 }).replace(".", ",")) : "—" }
            ])}
          </div>
          <div className="modal-note">
            La serie se construye en data.js desde los JSONs del pipeline.
            Para ver la serie completa, abrí el módulo Histórico.
          </div>
        </>
      )
    });
  };

  return (
    <article className="card chart-card drill" onClick={open} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <div className="card-head">
        <div>
          <h3>{data.title}</h3>
          <div className="chart-head-kpi">
            <span className="chart-head-val">{data.sub}</span>
            {data.delta != null && (
              <span className={"chart-head-delta " + (isPos ? "pos" : "neg")}>
                {D.fmtPct(data.delta)} {data.deltaLabel || ""}
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
   v9 · Productivos · grid 2×3 con semáforo escalonado + TOGGLE
   INLINE (no más modal). Tap en la card → expand con CTA al
   módulo Stock de Masa (donde vive la tab "📈 Productivo").
   Acordeón: una sola card abierta por sección. KPI_BETTER_WHEN
   reemplaza el legacy mejorEs (up/down/flat con misma semántica).
   ============================================================ */
function ProductivosGrid() {
  const list = D.PRODUCTIVOS || [];
  const [openK, setOpenK] = useState(null);
  if (!list.length) return null;

  const arrow = (p) => {
    if (p.delta == null) return "·";
    return p.delta > 0 ? "↑" : (p.delta < 0 ? "↓" : "·");
  };

  return (
    <div className="prod-grid">
      {list.map((p) => {
        const isOpen = openK === p.id;
        return (
          <div
            key={p.id}
            className={
              "prod-card" +
              " lvl-" + (p.severity || "neutro") +
              " card-tone-" + (p.cardTone || "neutral") +
              (isOpen ? " is-open" : "")
            }
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={p.title + ": " + p.kpi + " " + (p.unit || "") + (p.deltaFmt ? " (" + p.deltaFmt + ")" : "")}
            onClick={() => setOpenK(isOpen ? null : p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenK(isOpen ? null : p.id); } }}
          >
            <div className="prod-eyebrow">{p.title}</div>
            <div className="prod-big">
              <span className="prod-big-num">{p.kpi}</span>
              {p.unit ? <span className="prod-big-unit">{p.unit}</span> : null}
            </div>
            <div className="prod-divider" />
            <div className="prod-foot">
              <span className="prod-foot-lab">{p.subLabel}</span>
              <span className="prod-foot-val">{p.subVal}</span>
            </div>
            {p.deltaFmt && (
              <span className={"prod-chip chip-tone-" + (p.chipTone || "neutral")}>
                <span className="prod-chip-arr">{arrow(p)}</span>
                {p.deltaFmt}
              </span>
            )}
            {isOpen && (
              <div className="prod-expand">
                <button
                  className="btn-pill-outline"
                  onClick={(e) => { e.stopPropagation(); navigateToModule("stock"); }}
                >
                  Ver módulo Producción →
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   v9 · Precios de inferencia · grid 2×2 MINIMAL + TOGGLE INLINE.
   Card minimal: categoría grande / sub + precio en mono.
   Tap → expand con grid de 6 parámetros, caja MARGEN ESTIMADO/CAB
   y botón solid "Ver en Mercado →" que navega al módulo Mercado
   (idealmente activando la tab "📊 Inferencia" agregada en v8).
   Acordeón: una sola card abierta por sección.
   ============================================================ */
function PreciosInferenciaGrid() {
  const list = D.PRECIOS_INFERENCIA || [];
  // v12.3: multi-open (mapa id→bool) en lugar de acordeón exclusivo.
  const [openMap, setOpenMap] = useState({});
  const toggleOpen = (id) => setOpenMap(m => ({ ...m, [id]: !m[id] }));
  if (!list.length) return null;

  return (
    <div className="prinf-grid">
      {list.map((it) => {
        const isOpen = !!openMap[it.id];
        return (
          <div
            key={it.id}
            className={"prinf-card" + (isOpen ? " is-open" : "")}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={it.nombre + ": " + it.precioCompFmt + " por kg vivo"}
            onClick={() => toggleOpen(it.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleOpen(it.id); } }}
          >
            <div className="prinf-head">
              <div className="prinf-titles">
                <div className="prinf-cat">{it.nombreBase}</div>
                {it.nombreSub ? <div className="prinf-sub-cat">{it.nombreSub}</div> : null}
              </div>
              <span className="prinf-chev" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
            </div>
            <div className="prinf-big">
              <span className="prinf-big-sym">$</span>
              <span className="prinf-big-num">{it.precioCompNum}</span>
              <span className="prinf-big-unit">/kg</span>
            </div>
            {isOpen && (
              <div className="prinf-expand">
                <div className="prinf-divider" />
                <div className="prinf-params-grid">
                  <div><span>Compra</span><strong>{it.kgCompraFmt}</strong></div>
                  <div><span>Días feedlot</span><strong>{it.diasFeedFmt}</strong></div>
                  <div><span>Venta</span><strong>{it.kgVentaFmt}</strong></div>
                  <div><span>Rinde</span><strong>{it.rindeFmt}</strong></div>
                  <div><span>Precio venta</span><strong>{it.precioVentaFmt}</strong></div>
                  <div><span>Costo prod</span><strong>{it.costoKgProdFmt}</strong></div>
                </div>
                {/* v12.3: bloque .prinf-margen eliminado del panel.
                    El cálculo de margen sigue en mobile-data.js porque
                    el PDF v12.2+ lo muestra como chip dorado. */}
                <button
                  className="btn-solid-primary"
                  onClick={(e) => { e.stopPropagation(); navigateToModule("mercado", "inferencia"); }}
                >
                  Ver en Mercado →
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Módulos grid — navegación real a index.html?mod=<id>
   v9: opcionalmente acepta una tab interna (?tab=inferencia) para
   que el bridge del index.html active la pestaña correspondiente
   después de openModule().
   ============================================================ */
function navigateToModule(portalId, tab) {
  var qs = "?mod=" + encodeURIComponent(portalId);
  if (tab) qs += "&tab=" + encodeURIComponent(tab);
  window.location.href = "index.html" + qs;
}

function Modulos() {
  return (
    <div className="modulos">
      {D.MODULOS.map((m) => (
        <button key={m.n} className="mod"
                onClick={() => navigateToModule(m.portalId)}>
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
function Footer({ session }) {
  return (
    <div className="foot">
      PEGSA & BULLTRADE · {session ? session.name + " · " : ""}{new Date().toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
    </div>
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
   App raíz — con login gate + ModalProvider
   ============================================================ */
function App() {
  const [session, setSession] = useState(() => loadSession());
  // v4: state `tab` eliminado junto con la barra de tabs superior.
  const [bottomTab, setBottomTab] = useState("panel");
  const [modalContent, setModalContent] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const onReady = () => {
      D = window.MOBILE_DATA;
      setTick((t) => t + 1);
    };
    // v4 fix: si la referencia de MOBILE_DATA cambió entre el initial value
    // de `let D` (cuando Babel ejecutó este script) y el primer effect (post-
    // commit), forzar refresh — cubre el caso race en que 'mobile:data-ready'
    // disparó después del eval pero antes del addEventListener.
    if (D !== window.MOBILE_DATA) {
      D = window.MOBILE_DATA;
      setTick((t) => t + 1);
    }
    window.addEventListener("mobile:data-ready", onReady);
    // Defensivo extra: si por algún timing la cadena panel→mobile no llegó,
    // escuchamos también el evento upstream (mobile-data.js corre rebuild
    // que reemplaza MOBILE_DATA antes de dispatchar mobile:data-ready).
    window.addEventListener("panel:data-ready", onReady);
    return () => {
      window.removeEventListener("mobile:data-ready", onReady);
      window.removeEventListener("panel:data-ready", onReady);
    };
  }, []);

  // Login gate
  if (!session) {
    return <LoginScreen onLogin={(u) => setSession(loadSession())} />;
  }

  const onLogout = () => {
    clearSession();
    setSession(null);
  };

  const modalApi = {
    open: (content) => setModalContent(content),
    close: () => setModalContent(null)
  };

  return (
    <ModalCtx.Provider value={modalApi}>
      <div className="app">
        <Header session={session} onLogout={onLogout} />

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
          {/* v6: la lista "Todos los insumos" vivía acá como card
              independiente, ahora vive dentro del modal de cada
              insumo crítico (Silo / Maíz) para no saturar el panel. */}
          <Insumos />

          <hr className="sec-div" />

          <div className="sec-head">
            <h2><span className="ico">📋</span>Sub-datos</h2>
          </div>
          <FlujoSemanal />
          {/* v11: segunda card de Financiero DW (Darwash) — análisis
              independiente, abajo del PEG-BULL. Si la carpeta DW está
              vacía → null (early return). */}
          <FlujoSemanal source="dw" />
          <ChartCard data={D.PATRIMONIO_USD} />
          <ChartCard data={D.STOCK_KILOS} />

          <hr className="sec-div" />

          {/* v6: sección nueva — 6 KPIs productivos del feedlot
              (ADP, estadía, eficiencia, consumo/cab, conversión,
              kg repartidos), espejo del desktop.
              v7: header con la regla del semáforo escalonado. */}
          <div className="sec-head">
            <h2><span className="ico">📈</span>Productivos</h2>
            <span className="sec-head-sub">
              último mes · variación vs histórico · semáforo &gt;20% / 10–20% / &lt;10%
            </span>
          </div>
          <ProductivosGrid />

          <hr className="sec-div" />

          {/* v8: precios de inferencia (4 cards) — simulador semanal. */}
          {D.PRECIOS_INFERENCIA && D.PRECIOS_INFERENCIA.length > 0 && (
            <>
              <div className="sec-head">
                <h2><span className="ico">📊</span>Precios de inferencia</h2>
                <span className="sec-head-sub">
                  compra · sem {(D.PRECIOS_INFERENCIA_META && D.PRECIOS_INFERENCIA_META.fechaLabel) || "—"}
                </span>
              </div>
              <PreciosInferenciaGrid />

              <hr className="sec-div" />
            </>
          )}

          <div className="sec-head">
            <h2><span className="ico">📂</span>Módulos</h2>
            <span className="sec-head-sub">{D.MODULOS.length} módulos · tocar para abrir</span>
          </div>
          <Modulos />

          <Footer session={session} />
        </main>

        <TabBar active={bottomTab} onChange={setBottomTab} />

        <Modal content={modalContent} onClose={() => setModalContent(null)} />
      </div>
    </ModalCtx.Provider>
  );
}

/* Mount */
const root = ReactDOM.createRoot(document.getElementById("mobileRoot"));
root.render(<App />);
