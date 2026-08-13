/* modulo-09-remitos.js — Resultado por Remito · v15.59 (2026-08-13)
   ────────────────────────────────────────────────────────────────
   Port al portal del prototipo standalone v2.5 validado por el usuario
   (Claude_Outputs\Scripts_Auxiliares\modulo_resultado_remito\).

   El COSTO viene calculado del pipeline (resultado_remitos.json): compra +
   comisión + alimento (%PV mensual real) + estructura + sanidad + mortandad.
   La VENTA se carga acá a mano y persiste en localStorage.
*/

var _remData = null;
var _remSel  = null;

// v15.59: la venta se carga a mano y persiste en localStorage POR NAVEGADOR.
// Decisión del usuario 2026-08-13: provisorio hasta conectar una base de datos.
// No inventar sincronización — cada dispositivo ve su propia carga.
var REM_LS_PREFIX = 'pegsa_venta_remito_';

function remVentaGet(nro) {
  try {
    var raw = localStorage.getItem(REM_LS_PREFIX + nro);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function remVentaSet(nro, obj) {
  try { localStorage.setItem(REM_LS_PREFIX + nro, JSON.stringify(obj)); } catch (e) {}
}

var _remM = function (n) {
  if (n == null || isNaN(n)) return '—';
  return (n < 0 ? '−' : '') + '$ ' + Math.round(Math.abs(n)).toLocaleString('es-AR');
};
var _remN = function (n, d) {
  if (n == null || isNaN(n)) return '—';
  d = d || 0;
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

async function cargarRemitos() {
  if (_remData) { renderRemitos(); return; }
  var loading = document.getElementById('remLoading');
  var content = document.getElementById('remContent');
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';
  try {
    var resp = await fetch(STOCK_SB + '/resultado_remitos.json', {}, {});
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _remData = await resp.json();
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
    renderRemitos();
  } catch (e) {
    // Degradación: el módulo avisa y no rompe el resto del portal.
    if (loading) loading.innerHTML =
      '<div style="padding:60px;text-align:center">'
      + '<div style="font-size:28px">&#9888;</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:14px;margin-top:12px;opacity:.6">No se encontró resultado_remitos.json</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:12px;margin-top:8px;opacity:.4">Lo genera el pipeline en cada tick, con las ventas desde 2026-07-01</div>'
      + '</div>';
  }
}

function initRemitos() { cargarRemitos(); }

function remSelChange(v) { _remSel = v; renderRemitos(); }

function remVentaInput(nro, campo, valor) {
  var v = remVentaGet(nro);
  var n = parseFloat(String(valor).replace(',', '.'));
  v[campo] = isNaN(n) ? null : n;
  remVentaSet(nro, v);
  renderRemitos(true);
}

/* ════════════════════════════════════════════════════════════
   v15.60 · INFORME PDF DE UNA PÁGINA (para compartir por WhatsApp)
   ────────────────────────────────────────────────────────────
   Ventana nueva autocontenida + window.print() → el usuario elige
   "Guardar como PDF". Sin librerías: ni jsPDF ni html2canvas.
   El informe SOLO LEE lo que el módulo ya tiene calculado.
   ════════════════════════════════════════════════════════════ */

// v15.60.1: montos SIEMPRE enteros en formato es-AR ("$ 45.152.141"), nunca
// abreviados a millones. Preferencia explícita del usuario.
function _remMM(n) { return _remM(n); }

/* Puente (waterfall) en SVG inline.
   pasos: [{lbl, val, tipo:'total'|'baja'|'final', color}]
   'total' arranca del piso, 'baja' resta del acumulado, 'final' es el saldo. */
function _remPuenteSVG(pasos) {
  var W = 660, H = 250, PAD_B = 46, PAD_T = 26;
  var n = pasos.length, bw = Math.floor((W - 20) / n) - 14, gap = 14;

  // Recorrido para conocer el rango (el resultado puede ser negativo)
  var run = 0, hi = 0, lo = 0, tramos = [];
  pasos.forEach(function (p) {
    var t;
    if (p.tipo === 'total') { t = { de: 0, a: p.val }; run = p.val; }
    else if (p.tipo === 'baja') { t = { de: run, a: run - p.val }; run = run - p.val; }
    else { t = { de: 0, a: p.val }; run = p.val; }
    hi = Math.max(hi, t.de, t.a); lo = Math.min(lo, t.de, t.a);
    tramos.push(t);
  });
  var span = (hi - lo) || 1;
  var y = function (v) { return PAD_T + (hi - v) / span * (H - PAD_T - PAD_B); };

  var s = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" font-family="DM Mono, monospace" style="font-variant-numeric:tabular-nums">';
  s += '<line x1="8" y1="' + y(0) + '" x2="' + (W - 8) + '" y2="' + y(0) + '" stroke="#d8d6ce" stroke-width="1"/>';
  var prev = null;   // última etiqueta dibujada, para escalonar si se pisan
  pasos.forEach(function (p, i) {
    var t = tramos[i], x = 14 + i * (bw + gap);
    var yTop = Math.min(y(t.de), y(t.a)), hBar = Math.max(Math.abs(y(t.a) - y(t.de)), 2);
    s += '<rect x="' + x + '" y="' + yTop + '" width="' + bw + '" height="' + hBar + '" fill="' + p.color + '" rx="1"/>';
    // v15.60.1: con los montos enteros ("−$ 15.044.501") las etiquetas no entran
    // adentro de las caidas angostas, asi que van SIEMPRE AFUERA: arriba del
    // segmento, o abajo cuando el tramo termina bajo el eje. Si una se pisa con
    // la anterior, se le corre la altura un renglon.
    var FS = 9.5;
    var txt = (p.tipo === 'baja' ? '−' : '') + _remM(Math.abs(p.val));
    var wTxt = txt.length * FS * 0.62;          // DM Mono ~0.62em de ancho
    var cx = x + bw / 2, x1 = cx - wTxt / 2, x2 = cx + wTxt / 2;
    var bajo = t.a < 0;
    var yTxt = bajo ? (yTop + hBar + 12) : (yTop - 5);
    if (prev && !(x1 > prev.x2 + 2 || x2 < prev.x1 - 2) && Math.abs(yTxt - prev.y) < 11) {
      yTxt = bajo ? prev.y + 11 : prev.y - 11;
    }
    prev = { x1: x1, x2: x2, y: yTxt };
    s += '<text x="' + cx + '" y="' + yTxt + '" text-anchor="middle" font-size="' + FS + '" font-weight="700" fill="'
      + (p.tipo === 'baja' ? '#6b6560' : (t.a < 0 ? '#c0392b' : '#1a1612')) + '">' + txt + '</text>';
    // etiqueta al pie, en dos líneas si hace falta
    var partes = String(p.lbl).split(' ');
    var l1 = partes.slice(0, 2).join(' '), l2 = partes.slice(2).join(' ');
    s += '<text x="' + (x + bw / 2) + '" y="' + (H - 26) + '" text-anchor="middle" font-size="10.5" letter-spacing="0.06em" fill="#6b6560">' + l1 + '</text>';
    if (l2) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 14) + '" text-anchor="middle" font-size="10.5" letter-spacing="0.06em" fill="#6b6560">' + l2 + '</text>';
    // conector punteado al siguiente
    if (i < n - 1) {
      var yc = y(t.a);
      s += '<line x1="' + (x + bw) + '" y1="' + yc + '" x2="' + (x + bw + gap) + '" y2="' + yc + '" stroke="#b9b4ac" stroke-width="1" stroke-dasharray="2,2"/>';
    }
  });
  s += '</svg>';
  return s;
}

function remInformePDF() {
  if (!_remData || !_remSel) return;
  var r = _remData.remitos[_remSel], meta = _remData.meta || {};
  var C = r.costos, I = r.indicadores, RP = r.reposicion;
  var venta = remVentaGet(_remSel);
  var kgc = venta.kg_carne || 0, pkg = venta.precio_kg || 0;
  var gastos = (venta.flete || 0) + (venta.pesada || 0) + (venta.guia_senasa || 0) + (venta.guia_comuna || 0);
  var bruto = kgc * pkg, neto = bruto - gastos, hayVenta = bruto > 0;
  var res = neto - C.total, resRepo = neto - RP.total;
  var GOLD = '#b8922a', GREEN = '#27613d', BLUE = '#2d6a8a', RED = '#c0392b', NAVY = '#0F1B64';

  var pasos = hayVenta
    ? [{ lbl: 'VENTA NETA', val: neto, tipo: 'total', color: NAVY },
       { lbl: 'COMPRA + COM', val: C.compra + C.comision, tipo: 'baja', color: GOLD },
       { lbl: 'ALIMENTO', val: C.alimento, tipo: 'baja', color: GREEN },
       { lbl: 'ESTR + SAN', val: C.estructura + C.sanidad, tipo: 'baja', color: BLUE },
       { lbl: 'MORTANDAD', val: C.mortandad, tipo: 'baja', color: RED },
       { lbl: 'RESULTADO', val: res, tipo: 'final', color: res >= 0 ? GOLD : RED }]
    : [{ lbl: 'COSTO TOTAL', val: C.total, tipo: 'total', color: '#1a1612' },
       { lbl: 'COMPRA + COM', val: C.compra + C.comision, tipo: 'baja', color: GOLD },
       { lbl: 'ALIMENTO', val: C.alimento, tipo: 'baja', color: GREEN },
       { lbl: 'ESTR + SAN', val: C.estructura + C.sanidad, tipo: 'baja', color: BLUE },
       { lbl: 'MORTANDAD', val: C.mortandad, tipo: 'baja', color: RED }];

  var w = function (x) { return C.total > 0 ? x / C.total * 100 : 0; };
  var comp = 'compra ' + _remN(w(C.compra + C.comision), 1) + ' % · alimento ' + _remN(w(C.alimento), 1)
    + ' % · estr+san ' + _remN(w(C.estructura + C.sanidad), 1) + ' % · mortandad ' + _remN(w(C.mortandad), 1) + ' %';

  var IND = [
    ['Kg prom. ingreso', _remN(I.kg_prom_ingreso, 1), 'kg/cab'],
    ['Kg prom. salida', _remN(I.kg_prom_salida, 1), 'kg/cab'],
    ['Estadía promedio', _remN(I.estadia_prom), 'días/cab'],
    ['Engorde diario', _remN(I.adp, 3), 'kg/cab/día'],
    ['% MS s/ kg vivo', _remN(I.pct_ms, 2) + ' %', 'consumo'],
    ['Conversión MS', _remN(I.conversion_ms, 2), 'kg MS/kg prod'],
    ['Costo kg producido', _remM(I.costo_kg_producido), 'alim+estr+san'],
    ['Precio prom. pagado', '$ ' + _remN(I.precio_prom_pagado), 'por kg entrada']
  ];

  var tas = meta.tasas_mortandad || {};
  var nSin = (r.tropas_sin_precio || []).length;
  var ahora = new Date();
  var fh = ('0' + ahora.getDate()).slice(-2) + '/' + ('0' + (ahora.getMonth() + 1)).slice(-2) + '/' + ahora.getFullYear()
    + ' ' + ('0' + ahora.getHours()).slice(-2) + ':' + ('0' + ahora.getMinutes()).slice(-2);

  var h = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<title>Resultado Remito ' + _remSel + ' · PEGSA &amp; Bulltrade</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">'
    + '<style>'
    + '@page{size:A4 portrait;margin:12mm}'
    // los fondos oscuros tienen que imprimirse: sin esto Chrome los descarta
    + '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{margin:0;font-family:"DM Mono",monospace;color:#1a1612;font-size:11px;font-variant-numeric:tabular-nums}'
    + '.t{font-family:"Playfair Display",serif;font-weight:700}'
    + '.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1612;padding-bottom:8px}'
    + '.hd .n{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#8a827a}'
    + '.sec{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#8a827a;margin:13px 0 6px;border-bottom:1px solid #e3e1da;padding-bottom:3px}'
    + '.k{display:grid;gap:7px}'
    + '.kc{border:1px solid #e3e1da;border-radius:2px;padding:8px 10px}'
    + '.kc .l{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#8a827a}'
    + '.kc .v{font-family:"Playfair Display",serif;font-weight:700;font-size:19px;line-height:1.25}'
    + '.kc .u{font-size:9px;color:#8a827a}'
    + '.big{background:#1a1612;border-color:#1a1612}.big .l{color:rgba(255,255,255,.5)}'
    + '.big .v{color:#d4a84b}.big .u{color:rgba(255,255,255,.45)}'
    + '.repo{background:#faf6ea;border:1px solid ' + GOLD + ';border-radius:2px;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:center}'
    + '.rl{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#8a827a}'
    + '.ft{margin-top:12px;border-top:1px solid #e3e1da;padding-top:6px;font-size:8.5px;color:#8a827a;line-height:1.55}'
    + '.neg{color:' + RED + '}'
    + '</style></head><body>';

  // 1 · Encabezado
  h += '<div class="hd"><div>'
    + '<div class="n">PEGSA &amp; Bulltrade · Resultado por Remito</div>'
    + '<div class="t" style="font-size:27px;line-height:1.1">Remito ' + _remSel + '</div>'
    + '<div style="font-size:10px;color:#6b6560;margin-top:3px">'
    + (r.fecha_egreso ? r.fecha_egreso.split('-').reverse().join('/') + ' · ' : '')
    + r.cabezas + ' cabezas · ' + r.tropas + ' tropas · ' + _remN(r.kg_ingreso) + ' → ' + _remN(r.kg_egreso) + ' kg'
    + ' · cobertura precios ' + _remN(r.cobertura_pct, 1) + ' %</div>'
    + (r.comprador ? '<div style="font-size:9.5px;color:#8a827a;margin-top:2px">' + r.comprador + '</div>' : '')
    + '</div><div style="text-align:right">'
    + '<div class="l" style="font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#8a827a">Costo total</div>'
    + '<div class="t" style="font-size:22px">' + _remM(C.total) + '</div>'
    + '<div style="font-size:9px;color:#8a827a">$ ' + _remN(C.por_kg_vendido) + ' / kg vendido</div>'
    + '</div></div>';

  // 2 · Puente
  h += '<div class="sec">' + (hayVenta ? 'De la venta al resultado' : 'Composición del costo') + '</div>';
  h += _remPuenteSVG(pasos);
  h += '<div style="text-align:center;font-size:9.5px;color:#6b6560;margin-top:-4px">Composición del costo · ' + comp + '</div>';

  // 3 · Resultado económico
  h += '<div class="sec">Resultado económico</div>';
  if (hayVenta) {
    h += '<div class="k" style="grid-template-columns:repeat(4,1fr)">'
      + '<div class="kc"><div class="l">Venta bruta</div><div class="v">' + _remMM(bruto) + '</div><div class="u">' + _remN(kgc) + ' kg × $ ' + _remN(pkg, 2) + '</div></div>'
      + '<div class="kc"><div class="l">Gastos de venta</div><div class="v neg">' + _remMM(-gastos) + '</div><div class="u">$ ' + _remN(gastos / kgc, 2) + '/kg carne</div></div>'
      + '<div class="kc"><div class="l">Venta neta</div><div class="v">' + _remMM(neto) + '</div><div class="u">rinde ' + _remN(kgc / r.kg_egreso * 100, 2) + ' %</div></div>'
      + '<div class="kc big"><div class="l">Resultado</div><div class="v">' + _remMM(res) + '</div><div class="u">'
      + _remN(res / C.total * 100, 1) + ' % s/costo · ' + _remM(res / r.cabezas) + '/cab</div></div>'
      + '</div>';
  } else {
    h += '<div class="kc" style="text-align:center;color:#8a827a;padding:14px">Sin venta cargada — el informe muestra el costo y los indicadores.</div>';
  }

  // 4 · Indicadores
  h += '<div class="sec">Indicadores</div><div class="k" style="grid-template-columns:repeat(4,1fr)">';
  IND.forEach(function (t) {
    h += '<div class="kc"><div class="l">' + t[0] + '</div><div class="v" style="font-size:16px">' + t[1] + '</div><div class="u">' + t[2] + '</div></div>';
  });
  h += '</div>';

  // 5 · Reposición — el resultado va destacado, con el mismo peso visual que el
  // RESULTADO histórico (tarjeta oscura y número grande).
  h += '<div class="sec">Resultado a reposición</div><div class="repo">'
    + '<div><div class="rl">Costo total reposición</div>'
    + '<div class="t" style="font-size:20px">' + _remM(RP.total) + '</div>'
    + '<div style="font-size:9px;color:#8a827a">$ ' + _remN(RP.por_kg_vendido) + ' / kg vendido · hist $ ' + _remN(C.por_kg_vendido) + '</div>'
    + '<div style="font-size:9px;color:#6b6560;margin-top:4px">' + RP.fuente_precio + ' $ ' + _remN(RP.precio_kg)
    + '/kg · MS ' + RP.mes_ms + ' $ ' + _remN(RP.precio_kg_ms, 2) + '</div></div>'
    + (hayVenta
        ? '<div class="kc big" style="text-align:right"><div class="l">Resultado a reposición</div>'
          + '<div class="v" style="font-size:24px;color:' + (resRepo >= 0 ? '#d4a84b' : '#ff8b7d') + '">' + _remM(resRepo) + '</div>'
          + '<div class="u">' + _remN(resRepo / RP.total * 100, 1) + ' % s/costo repo</div>'
          + '<div class="u">histórico ' + _remM(res) + ' · dif ' + (resRepo - res >= 0 ? '+' : '') + _remM(resRepo - res) + '</div>'
          + '<div class="u" style="margin-top:3px">comprando y alimentando a precios de hoy</div></div>'
        : '<div class="kc" style="text-align:right"><div class="rl">Resultado a reposición</div>'
          + '<div class="t" style="font-size:20px;color:#8a827a">—</div>'
          + '<div style="font-size:9px;color:#8a827a">sin venta cargada</div>'
          + '<div style="font-size:9px;color:#8a827a;margin-top:3px">comprando y alimentando a precios de hoy</div></div>')
    + '</div>';

  // 6 · Pie — los supuestos salen de meta, no hardcodeados
  h += '<div class="ft">Generado el ' + fh + ' · Portal PEGSA v15.60.1 · Supuestos: %PV real por mes (límites '
    + _remN(meta.pv_min, 1) + '–' + _remN(meta.pv_max, 1) + ' %) · consumo Vaca +' + Math.round((meta.factor_vaca - 1) * 100) + ' %'
    + ' · mortandad Vacas ' + _remN(tas.Vaca, 2) + ' % / Machos ' + _remN(tas.Novillo, 2) + ' % / Hembras ' + _remN(tas.Vaquillona, 2) + ' %'
    + (nSin ? ' · ' + nSin + ' tropa(s) sin precio estimadas al promedio de las compañeras' : '')
    + '</div></body></html>';

  var win = window.open('', '_blank');
  if (!win) { alert('El navegador bloqueó la ventana del informe. Permití las ventanas emergentes para este sitio.'); return; }
  win.document.open();
  win.document.write(h);
  win.document.close();
  // Dar tiempo a que bajen las fuentes antes de abrir el diálogo de impresión
  win.onload = function () { setTimeout(function () { win.focus(); win.print(); }, 550); };
}

function renderRemitos(soloResultado) {
  var el = document.getElementById('remContent');
  if (!el || !_remData) return;
  var remitos = _remData.remitos || {};
  var nros = Object.keys(remitos).sort();
  if (!nros.length) {
    el.innerHTML = '<div style="padding:48px;text-align:center;font-family:\'DM Mono\',monospace;opacity:.5">Sin ventas con remito desde ' + (_remData.meta || {}).desde + '</div>';
    return;
  }
  if (!_remSel || !remitos[_remSel]) _remSel = nros[nros.length - 1];
  var r = remitos[_remSel];
  var meta = _remData.meta || {};

  var venta = remVentaGet(_remSel);
  var kgc = venta.kg_carne || 0, pkg = venta.precio_kg || 0;
  var gastos = (venta.flete || 0) + (venta.pesada || 0) + (venta.guia_senasa || 0) + (venta.guia_comuna || 0);
  var bruto = kgc * pkg, neto = bruto - gastos;
  var costo = r.costos.total, res = neto - costo;
  var resRepo = neto - r.reposicion.total;

  var C = r.costos, I = r.indicadores, RP = r.reposicion;
  var w = function (x) { return costo > 0 ? (x / costo * 100) : 0; };

  var LBL = 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.45);margin-bottom:5px';
  var VAL = 'font-family:\'Playfair Display\',serif;font-size:21px;font-weight:700';
  var UNI = 'font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.5);margin-top:3px';
  var CARD = 'background:#fff;border:1px solid var(--border);border-radius:2px;padding:13px 16px';
  var GRID = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:12px;margin-bottom:8px';
  var H2 = 'font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;margin:26px 0 12px';
  var SUB = 'font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.45);margin:-6px 0 12px';
  var WARN = 'background:#fdf6e3;border:1px solid var(--gold);border-radius:2px;padding:12px 16px;margin:14px 0;font-family:\'DM Mono\',monospace;font-size:12px;color:#7a5c14;line-height:1.6';
  var INP = 'font-family:\'DM Mono\',monospace;font-size:13px;padding:7px 11px;border:1px solid #d8d6ce;border-radius:2px;background:#faf8f4;width:120px';

  function card(l, v, u, big) {
    return '<div style="' + CARD + (big ? ';background:var(--ink)' : '') + '">'
      + '<div style="' + LBL + (big ? ';color:rgba(255,255,255,.45)' : '') + '">' + l + '</div>'
      + '<div style="' + VAL + (big ? ';color:#d4a84b' : '') + '">' + v + '</div>'
      + '<div style="' + UNI + (big ? ';color:rgba(255,255,255,.4)' : '') + '">' + (u || '') + '</div></div>';
  }

  var h = '';

  // ── Selector + carga de venta ──
  h += '<div style="background:#fff;border:1px solid var(--border);border-radius:3px;padding:16px 20px;margin-bottom:6px;display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap">';
  h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">Remito de salida</label>'
    + '<select onchange="remSelChange(this.value)" style="' + INP + ';width:150px">'
    + nros.map(function (n) { return '<option value="' + n + '"' + (n === _remSel ? ' selected' : '') + '>' + n + (remVentaGet(n).kg_carne ? ' ✓' : '') + '</option>'; }).join('')
    + '</select></div>';
  var CAMPOS = [['kg_carne', 'Kg carne'], ['precio_kg', '$ / kg carne'], ['flete', 'Flete'],
                ['pesada', 'Pesada'], ['guia_senasa', 'Guía SENASA'], ['guia_comuna', 'Guía comuna']];
  CAMPOS.forEach(function (c) {
    h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">' + c[1] + '</label>'
      + '<input value="' + (venta[c[0]] != null ? venta[c[0]] : '') + '" style="' + INP + '" '
      + 'onchange="remVentaInput(\'' + _remSel + '\',\'' + c[0] + '\',this.value)"></div>';
  });
  // v15.60: informe de una página para compartir
  h += '<div style="margin-left:auto;display:flex;flex-direction:column;gap:5px">'
    + '<button onclick="remInformePDF()" style="padding:8px 16px;background:var(--ink);border:1px solid var(--ink);border-radius:2px;'
    + 'color:#d4a84b;font-family:\'DM Mono\',monospace;font-size:12px;cursor:pointer;white-space:nowrap">&#128196; Informe PDF</button></div>';
  h += '</div>';
  h += '<div style="' + SUB + ';margin:0 0 16px">Carga local en este navegador — se migrará a base de datos.</div>';

  // ── Cabecera del remito ──
  h += '<div style="' + H2 + '">Remito ' + _remSel + '</div>';
  h += '<div style="' + SUB + '">' + r.cabezas + ' cabezas · ' + r.tropas + ' tropas · '
    + _remN(r.kg_ingreso) + ' kg entrada → ' + _remN(r.kg_egreso) + ' kg salida (+'
    + _remN(r.kg_producidos) + ' kg) · ' + _remN(r.kg_ms) + ' kg MS consumidos'
    + (r.comprador ? ' · ' + r.comprador : '') + '</div>';

  // ── KPIs de costo ──
  h += '<div style="' + GRID + '">'
    + card('Compra + comisión', _remM(C.compra + C.comision), '$ ' + _remN((C.compra + C.comision) / r.kg_ingreso) + '/kg entrada')
    + card('Alimento', _remM(C.alimento), _remN(C.alimento / r.kg_ms) + ' $/kg MS prom')
    + card('Estructura + sanidad', _remM(C.estructura + C.sanidad), '$/día animal + ingreso')
    + card('Mortandad', _remM(C.mortandad), 'tasa portal × costo compra')
    + card('Costo total', _remM(C.total), '$ ' + _remN(C.por_kg_vendido) + ' por kg vendido', true)
    + '</div>';

  // ── Barra de composición ──
  // Los segmentos chicos (estructura, mortandad) no llevan etiqueta adentro:
  // a 2-3 % del ancho el texto se pisa con el del vecino. Van en la leyenda.
  var SEG = [['compra', C.compra + C.comision, '#b8922a'], ['alimento', C.alimento, '#27613d'],
             ['estr+san', C.estructura + C.sanidad, '#2d6a8a'], ['mortandad', C.mortandad, '#c0392b']];
  h += '<div style="display:flex;height:26px;border-radius:2px;overflow:hidden;margin:8px 0 4px;border:1px solid var(--border);font-family:\'DM Mono\',monospace">'
    + SEG.map(function (s) {
        var pc = w(s[1]);
        return '<div style="width:' + pc + '%;background:' + s[2] + ';display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;overflow:hidden;white-space:nowrap">'
          + (pc >= 8 ? s[0] + ' ' + _remN(pc) + '%' : '') + '</div>';
      }).join('')
    + '</div>';
  h += '<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.5);margin-bottom:4px">'
    + SEG.map(function (s) {
        return '<span style="display:inline-block;width:9px;height:9px;background:' + s[2] + ';border-radius:1px;margin:0 5px 0 14px"></span>'
          + s[0] + ' ' + _remN(w(s[1]), 1) + '%';
      }).join('') + '</div>';

  // ── Warnings ──
  var mAcot = Object.keys(r.meses_pv_acotados || {});
  if (mAcot.length) {
    h += '<div style="' + WARN + '"><strong>⚠ ' + mAcot.length + ' mes(es) fuera de los límites '
      + meta.pv_min + '–' + meta.pv_max + ' % de consumo MS</strong> — acotados al límite: '
      + mAcot.map(function (m) { return m + ': ' + _remN(r.meses_pv_acotados[m], 2) + ' %'; }).join(' · ') + '.</div>';
  }
  if ((r.tropas_sin_precio || []).length) {
    var kgSin = r.tropas_sin_precio.reduce(function (a, t) { return a + t.kg_ingreso; }, 0);
    h += '<div style="' + WARN + '"><strong>⚠ ' + r.tropas_sin_precio.length + ' tropas sin precio de compra</strong> — '
      + _remN(kgSin) + ' kg estimados al promedio de las compañeras: <strong>$ ' + _remN(r.precio_estimado)
      + '/kg</strong>. Cobertura real: <strong>' + _remN(r.cobertura_pct, 1) + ' %</strong>.</div>';
  }

  // ── Resultado ──
  if (bruto > 0) {
    h += '<div style="' + H2 + '">Resultado</div><div style="' + GRID + '">'
      + card('Venta bruta', _remM(bruto), _remN(kgc) + ' kg carne × $ ' + _remN(pkg, 2))
      + card('Gastos venta', _remM(-gastos), kgc ? '$ ' + _remN(gastos / kgc, 2) + ' por kg carne' : '')
      + card('Venta neta', _remM(neto), 'rinde ' + _remN(kgc / r.kg_egreso * 100, 2) + ' %')
      + card('Resultado', _remM(res), _remN(res / costo * 100, 1) + ' % s/costo · ' + _remM(res / r.cabezas) + '/cab', true)
      + '</div>';
  } else {
    h += '<div style="' + WARN + '">Cargá <strong>kg carne</strong> y <strong>$/kg carne</strong> para ver el resultado.</div>';
  }

  // ── Indicadores ──
  h += '<div style="' + H2 + '">Indicadores</div><div style="' + GRID + '">'
    + card('Kg prom. ingreso', _remN(I.kg_prom_ingreso, 1), 'kg por cabeza')
    + card('Kg prom. salida', _remN(I.kg_prom_salida, 1), 'kg por cabeza')
    + card('Estadía promedio', _remN(I.estadia_prom), 'días por cabeza')
    + card('Engorde diario (ADP)', _remN(I.adp, 3), 'kg/cab/día · ' + _remN(r.kg_producidos) + ' kg producidos')
    + card('% MS s/ kg vivo prom.', _remN(I.pct_ms, 2) + ' %', 'kg MS ÷ (kg vivo prom × días)')
    + card('Conversión MS', _remN(I.conversion_ms, 2), 'kg MS dados ÷ kg producidos')
    + card('Costo del kg producido', _remM(I.costo_kg_producido), 'alim + estr + sanidad ÷ kg prod')
    + card('Precio prom. pagado', '$ ' + _remN(I.precio_prom_pagado), 'histórico · compra ÷ kg entrada')
    + '</div>';

  // ── Reposición ──
  h += '<div style="' + H2 + '">Resultado a reposición</div>';
  h += '<div style="' + SUB + '">Mismos kg de entrada y mismos kg MS, valuados a precio de hoy ('
    + RP.fuente_precio + ' $ ' + _remN(RP.precio_kg) + '/kg · MS ' + RP.mes_ms + ' $ ' + _remN(RP.precio_kg_ms, 2)
    + ') — la diferencia contra el gasto histórico es revalorización. Estructura y sanidad quedan históricas.</div>';
  h += '<div style="' + GRID + '">'
    + card('Compra a reposición', _remM(RP.compra + RP.comision), 'vs hist ' + ((RP.compra + RP.comision - C.compra - C.comision) >= 0 ? '+' : '') + _remM(RP.compra + RP.comision - C.compra - C.comision))
    + card('Alimento a reposición', _remM(RP.alimento), 'vs hist ' + ((RP.alimento - C.alimento) >= 0 ? '+' : '') + _remM(RP.alimento - C.alimento))
    + card('Costo total reposición', _remM(RP.total), '$ ' + _remN(RP.por_kg_vendido) + ' por kg vendido · hist $ ' + _remN(C.por_kg_vendido))
    + (bruto > 0 ? card('Resultado a reposición', _remM(resRepo), _remN(resRepo / RP.total * 100, 1) + ' % s/costo repo · hist ' + _remM(res), true) : '')
    + '</div>';

  // ── Detalle por tropa ──
  h += '<div style="' + H2 + '">Detalle por tropa</div>';
  h += '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--border);font-family:\'DM Mono\',monospace">'
    + '<thead><tr>' + ['Tropa', 'Cab', 'Ingreso', 'Kg ent', 'Kg sal', 'Días', '$/kg compra', 'Compra', 'Kg MS', '% MS', 'Alimento', 'Estr+San']
      .map(function (t, i) { return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:9px 10px;border-bottom:2px solid var(--border);text-align:' + (i === 0 ? 'left' : 'right') + ';white-space:nowrap">' + t + '</th>'; }).join('')
    + '</tr></thead><tbody>';
  (r.filas || []).forEach(function (f) {
    var td = 'padding:8px 10px;border-bottom:1px solid #f0eee8;text-align:right;font-size:13px;white-space:nowrap';
    var tag = '<span style="display:inline-block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:2px;background:rgba(184,146,42,.15);color:#7a5c14;margin-left:6px">';
    h += '<tr' + (f.estimado ? ' style="background:#fffbf0"' : '') + '>'
      + '<td style="' + td + ';text-align:left">' + f.tropa + (f.estimado ? tag + 'est</span>' : '') + '</td>'
      + '<td style="' + td + '">' + f.cabezas + '</td>'
      + '<td style="' + td + '">' + f.fecha_ingreso.split('-').reverse().join('/') + '</td>'
      + '<td style="' + td + '">' + _remN(f.kg_ingreso) + '</td>'
      + '<td style="' + td + '">' + _remN(f.kg_egreso) + '</td>'
      + '<td style="' + td + '">' + f.dias + '</td>'
      + '<td style="' + td + '">' + _remN(f.precio_kg) + '</td>'
      + '<td style="' + td + '">' + _remM(f.costo_compra) + '</td>'
      + '<td style="' + td + '">' + _remN(f.kg_ms) + '</td>'
      + '<td style="' + td + '">' + _remN(f.pct_ms, 2) + (f.acotado ? tag + 'lim</span>' : '') + '</td>'
      + '<td style="' + td + '">' + _remM(f.alimento) + '</td>'
      + '<td style="' + td + '">' + _remM(f.estructura + f.sanidad) + '</td></tr>';
  });
  h += '</tbody><tfoot><tr style="font-weight:500;border-top:2px solid var(--border);background:#faf8f4">'
    + '<td style="padding:8px 10px;text-align:left;font-size:13px">TOTAL</td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + r.cabezas + '</td><td></td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + _remN(r.kg_ingreso) + '</td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + _remN(r.kg_egreso) + '</td><td></td><td></td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + _remM(C.compra) + '</td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + _remN(r.kg_ms) + '</td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + _remN(I.pct_ms, 2) + '</td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + _remM(C.alimento) + '</td>'
    + '<td style="padding:8px 10px;text-align:right;font-size:13px">' + _remM(C.estructura + C.sanidad) + '</td>'
    + '</tr></tfoot></table>';

  // ── Tropas para completar en el Excel ──
  if ((r.tropas_sin_precio || []).length) {
    h += '<div style="' + H2 + '">Tropas para completar en el Excel</div>';
    h += '<div style="' + SUB + '">Agregalas en <code>compras de hacienda.xlsx</code> · hoja OK</div>';
    h += '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--border);font-family:\'DM Mono\',monospace"><thead><tr>'
      + ['Tropa', 'Cat', 'Cab', 'Kg entrada', 'Fecha ingreso', 'Estimado a'].map(function (t, i) {
        return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:9px 10px;border-bottom:2px solid var(--border);text-align:' + (i < 2 ? 'left' : 'right') + '">' + t + '</th>';
      }).join('') + '</tr></thead><tbody>';
    r.tropas_sin_precio.slice().sort(function (a, b) { return b.kg_ingreso - a.kg_ingreso; }).forEach(function (t) {
      var td = 'padding:8px 10px;border-bottom:1px solid #f0eee8;text-align:right;font-size:13px';
      h += '<tr><td style="' + td + ';text-align:left">' + t.tropa + '</td>'
        + '<td style="' + td + ';text-align:left">' + t.categoria + '</td>'
        + '<td style="' + td + '">' + t.cabezas + '</td>'
        + '<td style="' + td + '">' + _remN(t.kg_ingreso) + '</td>'
        + '<td style="' + td + '">' + t.fecha_ingreso.split('-').reverse().join('/') + '</td>'
        + '<td style="' + td + ';color:rgba(26,22,18,.4)">$ ' + _remN(t.estimado_a) + '</td></tr>';
    });
    h += '</tbody></table>';
  }

  // ── De dónde salen los números (no editable en esta versión) ──
  h += '<div style="' + SUB + ';margin-top:22px;line-height:1.7">'
    + 'Parámetros del modelo · consumo Vaca +' + Math.round((meta.factor_vaca - 1) * 100) + ' % sobre el %PV base'
    + ' · límites de consumo MS ' + _remN(meta.pv_min, 1) + '–' + _remN(meta.pv_max, 1) + ' %'
    + ' · comisión por tropa desde el Excel (fallback ' + Math.round(meta.comision_default * 100) + ' %)'
    + ' · %PV mensual ajustado ÷0,92 de <code>pct_pv_mensual.json</code>'
    + ' · mortandad: tasa del portal por grupo × costo de compra.'
    + '<br>La edición fina de estos parámetros sigue en el prototipo standalone.'
    + '</div>';

  el.innerHTML = h;
}
