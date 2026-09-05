/* modulo-10-acumulados.js — 11 · Resultados Acumulados · v15.71.3 (2026-09-04)
   ────────────────────────────────────────────────────────────────
   Todo lo que se fue guardando con "Informe PDF" en 07 · Resultado por Remito,
   junto y por tramo de tiempo: resultado del período, por categoría y el
   ranking de tropas de origen.

   Hasta v15.71.2 esto era un bloque colapsable adentro del módulo 07. Ahora es
   pantalla propia (`screenAcumulados`) con su propia carga de datos.

   ⚠ DEPENDENCIA DE CARGA: `modulo-09-remitos.js` tiene que cargarse ANTES que
   este archivo. De ahí salen los helpers de formato `_remM`, `_remN`, `_remFec`
   y el objeto de estilos `REM_STYLES` (la paleta no se duplica).

   ⚠ El rinde se conoce por VENTA (kg carne del camión ÷ kg vivo del camión),
   no por animal: la planta liquida la media res del embarque entero. El rinde
   por tropa es el de las ventas en las que participó, ponderado por sus kg
   vivos. Para tenerlo por animal haría falta el romaneo por caravana.
*/

var _rvHist = null;        // resultados_ventas.json
var _rvPromesa = null;     // promesa cacheada de la carga
var _rvChart = null;

/* Tramos guardados por Nicolás. Un tramo es
   {id, nombre, desde, hasta, base} con fechas ISO; `hasta` vacío = hoy y
   `base` es "egreso" (fecha de egreso de la venta) o "ingreso" (fecha de
   ingreso de la tropa — sirve para "cómo rindió lo que compré entre tal y tal
   fecha"; con esa base el filtro se aplica POR FILA, no por venta). */
var RV_LS_TRAMOS = 'pegsa_rv_tramos';
var RV_LS_SEL    = 'pegsa_rv_sel';
var RV_MAX_CMP   = 2;      // comparar de a dos. Si hace falta un tercero, acá.

var _rvSel   = 'todo';     // id de preset o de tramo guardado
var _rvSelB  = null;       // tramo B de la comparación
var _rvCmp   = false;
var _rvDesde = '', _rvHasta = '';   // tramo "Personalizado" sin guardar
var _rvHot = '', _rvComp = '', _rvCat = '';
var _rvOrden = 'resultado';         // resultado | pct | rinde | adp | cabezas
var _rvTop = 10;                    // 0 = todas
var _rvEdit = null;                 // tramo en edición (o {} para uno nuevo)
var _rvBorrar = null;               // id con borrado pendiente de confirmar

// ════════════════════════════════════════════════════════════
//  Carga
// ════════════════════════════════════════════════════════════
function rvCargar() {
  if (_rvPromesa) return _rvPromesa;
  // si 07 ya lo bajó, se reusa y no se pide de nuevo
  if (typeof _remHist !== 'undefined' && _remHist) {
    _rvHist = _remHist;
    _rvPromesa = Promise.resolve(_rvHist);
    return _rvPromesa;
  }
  _rvPromesa = fetch(STOCK_SB + '/resultados_ventas.json', {}, {})
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { _rvHist = j; return j; })
    .catch(function () { _rvHist = null; return null; });
  return _rvPromesa;
}

function initAcumulados() {
  var load = document.getElementById('rvLoading');
  var cont = document.getElementById('rvContent');
  if (_rvHist) { rvRender(); return; }
  if (load) load.style.display = 'block';
  if (cont) cont.style.display = 'none';
  rvLeerSel();
  rvCargar().then(function () { rvRender(); });
}

// ════════════════════════════════════════════════════════════
//  Tramos
// ════════════════════════════════════════════════════════════
function rvTramos() {
  try { return JSON.parse(localStorage.getItem(RV_LS_TRAMOS) || '[]') || []; }
  catch (e) { return []; }
}
function rvGuardarTramos(a) {
  try { localStorage.setItem(RV_LS_TRAMOS, JSON.stringify(a)); } catch (e) {}
}
function rvLeerSel() {
  try {
    var v = JSON.parse(localStorage.getItem(RV_LS_SEL) || '{}') || {};
    if (v.sel) _rvSel = v.sel;
    if (v.comparar && v.comparar.length === 2) { _rvCmp = true; _rvSelB = v.comparar[1]; }
    if (v.desde) _rvDesde = v.desde;
    if (v.hasta) _rvHasta = v.hasta;
  } catch (e) {}
}
function rvGuardarSel() {
  try {
    localStorage.setItem(RV_LS_SEL, JSON.stringify({
      sel: _rvSel, comparar: (_rvCmp && _rvSelB) ? [_rvSel, _rvSelB] : null,
      desde: _rvDesde, hasta: _rvHasta
    }));
  } catch (e) {}
}

function _rvISO(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
/* Presets: no se guardan, se calculan cada vez que se abre el módulo. */
function rvPresets() {
  var h = new Date(), y = h.getFullYear(), m = h.getMonth();
  var hoy = _rvISO(h);
  var menos = function (n) { var d = new Date(h); d.setMonth(d.getMonth() - n); return _rvISO(d); };
  return [
    { id: 'todo',     nombre: 'Todo',              desde: '',                      hasta: '',   base: 'egreso' },
    { id: 'mes',      nombre: 'Este mes',          desde: _rvISO(new Date(y, m, 1)), hasta: hoy, base: 'egreso' },
    { id: 'mes_ant',  nombre: 'Mes anterior',      desde: _rvISO(new Date(y, m - 1, 1)),
      hasta: _rvISO(new Date(y, m, 0)), base: 'egreso' },
    { id: 'm3',       nombre: 'Últimos 3 meses',   desde: menos(3),  hasta: hoy, base: 'egreso' },
    { id: 'm6',       nombre: 'Últimos 6 meses',   desde: menos(6),  hasta: hoy, base: 'egreso' },
    { id: 'm12',      nombre: 'Últimos 12 meses',  desde: menos(12), hasta: hoy, base: 'egreso' },
    { id: 'anio',     nombre: 'Este año',          desde: y + '-01-01', hasta: hoy, base: 'egreso' },
    { id: 'anio_ant', nombre: 'Año anterior',      desde: (y - 1) + '-01-01',
      hasta: (y - 1) + '-12-31', base: 'egreso' }
  ];
}

/* id → tramo resuelto. 'custom' es el de los dos inputs sueltos. */
function rvResolver(id) {
  if (id === 'custom') {
    return { id: 'custom', nombre: 'Personalizado', desde: _rvDesde, hasta: _rvHasta, base: 'egreso' };
  }
  var p = rvPresets().filter(function (x) { return x.id === id; })[0];
  if (p) return p;
  var t = rvTramos().filter(function (x) { return x.id === id; })[0];
  if (t) return { id: t.id, nombre: t.nombre, desde: t.desde, hasta: t.hasta, base: t.base || 'egreso' };
  return rvPresets()[0];
}
function rvTramoA() { return rvResolver(_rvSel); }
function rvTramoB() { return _rvSelB ? rvResolver(_rvSelB) : null; }

function rvVentana(t) {
  if (!t) return '';
  var f = function (d) { return d ? _remFec(d) : (t.desde ? 'hoy' : '—'); };
  if (!t.desde && !t.hasta) return 'sin límite';
  return _remFec(t.desde || '') + ' → ' + (t.hasta ? _remFec(t.hasta) : 'hoy');
}

// ── acciones de la barra ──
function rvSelTramo(id, cual) {
  if (cual === 'B') { _rvSelB = id; } else { _rvSel = id; }
  _rvBorrar = null; rvGuardarSel(); rvRender();
}
function rvToggleCmp() {
  _rvCmp = !_rvCmp;
  if (_rvCmp && !_rvSelB) {
    var otros = rvPresets().concat(rvTramos()).filter(function (t) { return t.id !== _rvSel; });
    _rvSelB = otros.length ? otros[0].id : null;
  }
  rvGuardarSel(); rvRender();
}
function rvNuevoTramo() {
  _rvEdit = { id: '', nombre: '', desde: _rvDesde || '', hasta: _rvHasta || '', base: 'egreso' };
  rvRender();
}
function rvEditarTramo(id) {
  var t = rvTramos().filter(function (x) { return x.id === id; })[0];
  if (t) { _rvEdit = JSON.parse(JSON.stringify(t)); rvRender(); }
}
function rvEditCampo(campo, v) { if (_rvEdit) { _rvEdit[campo] = v; } }
function rvCancelarEdit() { _rvEdit = null; rvRender(); }
function rvGuardarTramo() {
  if (!_rvEdit) return;
  var e = _rvEdit;
  var nombre = String(e.nombre || '').trim();
  if (!nombre) { alert('Poné un nombre al tramo.'); return; }
  if (!e.desde) { alert('Falta la fecha "desde".'); return; }
  if (e.hasta && e.hasta < e.desde) { alert('El "hasta" no puede ser anterior al "desde".'); return; }
  var lista = rvTramos();
  if (!e.id) {
    e.id = 't' + Date.now();
    lista.push({ id: e.id, nombre: nombre, desde: e.desde, hasta: e.hasta || '', base: e.base || 'egreso' });
  } else {
    lista = lista.map(function (x) {
      return x.id === e.id
        ? { id: e.id, nombre: nombre, desde: e.desde, hasta: e.hasta || '', base: e.base || 'egreso' }
        : x;
    });
  }
  rvGuardarTramos(lista);
  _rvSel = e.id; _rvEdit = null; rvGuardarSel(); rvRender();
}
/* Borrado en dos clicks, sin confirm() (bloquea el hilo). */
function rvBorrarTramo(id) {
  if (_rvBorrar !== id) { _rvBorrar = id; rvRender(); return; }
  rvGuardarTramos(rvTramos().filter(function (x) { return x.id !== id; }));
  if (_rvSel === id) _rvSel = 'todo';
  if (_rvSelB === id) _rvSelB = null;
  _rvBorrar = null; rvGuardarSel(); rvRender();
}
function rvGuardarCustom() {
  _rvEdit = { id: '', nombre: '', desde: _rvDesde, hasta: _rvHasta, base: 'egreso' };
  rvRender();
}
function rvFiltro(campo, v) {
  if (campo === 'hot')  _rvHot = (v === _rvHot ? '' : v);
  else if (campo === 'comp') _rvComp = (v === _rvComp ? '' : v);
  else if (campo === 'cat')  _rvCat = (v === _rvCat ? '' : v);
  else if (campo === 'desde') { _rvDesde = v; _rvSel = 'custom'; rvGuardarSel(); }
  else if (campo === 'hasta') { _rvHasta = v; _rvSel = 'custom'; rvGuardarSel(); }
  else if (campo === 'orden') _rvOrden = v;
  else if (campo === 'top')   _rvTop = parseInt(v, 10) || 0;
  rvRender();
}
function rvLimpiar() {
  _rvSel = 'todo'; _rvSelB = null; _rvCmp = false;
  _rvDesde = ''; _rvHasta = ''; _rvHot = ''; _rvComp = ''; _rvCat = '';
  rvGuardarSel(); rvRender();
}

// ════════════════════════════════════════════════════════════
//  Datos
// ════════════════════════════════════════════════════════════
function rvVentas() { return (_rvHist && _rvHist.ventas) || []; }
function rvMinCab() { return ((_rvHist || {}).meta || {}).min_cab_ranking || 5; }

function rvEnTramo(fecha, t) {
  if (!t || (!t.desde && !t.hasta)) return true;
  if (!fecha) return false;
  var f = String(fecha).slice(0, 10);
  if (t.desde && f < t.desde) return false;
  if (t.hasta && f > t.hasta) return false;
  return true;
}

/* Filas que pasan el tramo y los filtros, con los kg de carne prorrateados
   (misma proporción que la venta prorrateada, así el rinde cierra).
   Devuelve {rows, sinFecha} — sinFecha cuenta las filas que quedaron afuera
   por no traer fecha_ingreso (snapshots viejos, con base "ingreso"). */
function rvFilas(t) {
  var out = [], sinFecha = 0;
  var porIngreso = (t && t.base === 'ingreso');
  rvVentas().forEach(function (v) {
    if (!porIngreso && !rvEnTramo(v.fecha_egreso, t)) return;
    if (_rvComp && v.comprador !== _rvComp) return;
    var filas = v.filas || [];
    var kgeTot = filas.reduce(function (a, f) { return a + (f.kg_egreso || 0); }, 0);
    var kgcV = ((v.venta || {}).kg_carne) || 0;
    filas.forEach(function (f) {
      if (_rvHot && f.hotelero !== _rvHot) return;
      if (_rvCat && f.categoria !== _rvCat) return;
      if (porIngreso) {
        if (!f.fecha_ingreso) { sinFecha++; return; }
        if (!rvEnTramo(f.fecha_ingreso, t)) return;
      }
      out.push({ v: v, f: f, kg_carne: (kgeTot && kgcV) ? kgcV * (f.kg_egreso || 0) / kgeTot : 0 });
    });
  });
  return { rows: out, sinFecha: sinFecha };
}

/* Agregador — la misma cuenta que hace el pipeline. */
function rvAgg(rows, keyFn) {
  var m = {};
  rows.forEach(function (r) {
    var k = keyFn(r) || '—';
    var a = m[k] || (m[k] = { ids: {}, cabezas: 0, kg_ingreso: 0, kg_egreso: 0, kg_carne: 0,
      venta_neta: 0, costo: 0, compra: 0, aes: 0, diasAnimal: 0, hot: {}, cat: {}, fi: {} });
    var f = r.f;
    a.ids[r.v.id] = 1;
    a.cabezas += f.cabezas || 0;
    a.kg_ingreso += f.kg_ingreso || 0;
    a.kg_egreso += f.kg_egreso || 0;
    a.kg_carne += r.kg_carne || 0;
    a.venta_neta += f.venta_prorrateada || 0;
    a.costo += f.costo_fila || 0;
    a.compra += f.costo_compra || 0;
    a.aes += (f.alimento || 0) + (f.estructura || 0) + (f.sanidad || 0);
    a.diasAnimal += (f.dias || 0) * (f.cabezas || 0);
    if (f.hotelero) a.hot[f.hotelero] = (a.hot[f.hotelero] || 0) + (f.cabezas || 0);
    if (f.categoria) a.cat[f.categoria] = (a.cat[f.categoria] || 0) + (f.cabezas || 0);
    if (f.fecha_ingreso) a.fi[f.fecha_ingreso] = (a.fi[f.fecha_ingreso] || 0) + (f.cabezas || 0);
  });
  var moda = function (o) {
    var mk = null, mv = -1;
    Object.keys(o).forEach(function (k) { if (o[k] > mv) { mv = o[k]; mk = k; } });
    return mk;
  };
  return Object.keys(m).map(function (k) {
    var a = m[k], res = a.venta_neta - a.costo, kgProd = a.kg_egreso - a.kg_ingreso;
    return {
      clave: k,
      ventas: Object.keys(a.ids).length,
      cabezas: a.cabezas,
      kg_ingreso: a.kg_ingreso, kg_egreso: a.kg_egreso,
      kg_producidos: kgProd, kg_carne: a.kg_carne,
      venta_neta: a.venta_neta, costo: a.costo, resultado: res,
      resultado_pct: a.costo ? res / a.costo * 100 : null,
      resultado_cab: a.cabezas ? res / a.cabezas : null,
      rinde: a.kg_egreso ? a.kg_carne / a.kg_egreso * 100 : null,
      precio_kg_vivo: a.kg_egreso ? a.venta_neta / a.kg_egreso : null,
      adp: a.diasAnimal ? kgProd / a.diasAnimal : null,
      costo_kg_prod: kgProd > 0 ? a.aes / kgProd : null,
      precio_pagado: a.kg_ingreso ? a.compra / a.kg_ingreso : null,
      hotelero: moda(a.hot), categoria: moda(a.cat), fecha_ingreso: moda(a.fi)
    };
  });
}
function rvTotal(rows) {
  var t = rvAgg(rows, function () { return 'TOTAL'; });
  return t.length ? t[0] : null;
}
function rvOpciones() {
  var hot = {}, comp = {}, cat = {};
  rvVentas().forEach(function (v) {
    if (v.comprador) comp[v.comprador] = 1;
    (v.filas || []).forEach(function (f) {
      if (f.hotelero) hot[f.hotelero] = 1;
      if (f.categoria) cat[f.categoria] = 1;
    });
  });
  return { hot: Object.keys(hot).sort(), comp: Object.keys(comp).sort(), cat: Object.keys(cat).sort() };
}

/* Δ entre A y B, con el formato de cada magnitud. */
function rvDelta(a, b, tipo) {
  if (a == null || b == null) return '';
  var d = a - b;
  var s = d >= 0 ? '+' : '−', abs = Math.abs(d);
  var txt = tipo === 'pp' ? _remN(abs, 1) + ' pp'
          : tipo === 'pct' ? _remN(abs, 2) + ' %'
          : tipo === 'kg' ? '$ ' + _remN(abs)
          : _remM(abs);
  return '<span style="color:' + (d >= 0 ? '#27613d' : '#c0392b') + '">' + s + ' ' + txt + '</span>';
}

// ════════════════════════════════════════════════════════════
//  Render
// ════════════════════════════════════════════════════════════
function rvRender() {
  var el = document.getElementById('rvContent');
  var load = document.getElementById('rvLoading');
  if (!el) return;
  if (load) load.style.display = 'none';
  el.style.display = 'block';

  var S = (typeof REM_STYLES !== 'undefined') ? REM_STYLES : null;
  if (!S) { el.innerHTML = '<div style="padding:40px">Falta modulo-09-remitos.js</div>'; return; }

  var ventas = rvVentas();
  if (!ventas.length) {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center">'
      + '<div style="font-family:\'Playfair Display\',serif;font-size:22px;margin-bottom:10px">'
      + 'Todavía no hay ventas guardadas</div>'
      + '<div style="' + S.SUB + ';margin:0">Generá un <strong>Informe PDF</strong> en '
      + '<a onclick="sbNavigate(\'remitos\')" style="cursor:pointer;color:var(--gold);'
      + 'text-decoration:underline">07 · Resultado por Remito</a> y el resultado de esa venta '
      + 'aparece acá.</div></div>';
    return;
  }

  var A = rvTramoA(), B = _rvCmp ? rvTramoB() : null;
  var dA = rvFilas(A), dB = B ? rvFilas(B) : null;
  var TA = rvTotal(dA.rows), TB = dB ? rvTotal(dB.rows) : null;
  var meta = (_rvHist || {}).meta || {};
  var op = rvOpciones();

  var h = '';

  // ── barra de tramos ──
  h += '<div style="background:#fff;border:1px solid var(--border);border-radius:3px;padding:14px 18px;margin-bottom:14px">';
  h += rvBarraTramos(S, 'A');
  if (_rvCmp) {
    h += '<div style="border-top:1px dashed rgba(26,22,18,.12);margin-top:10px;padding-top:10px">'
      + '<span style="' + S.LBL + ';display:inline-block;margin-right:8px">Comparar contra</span><br>'
      + rvBarraTramos(S, 'B') + '</div>';
  }
  if (_rvEdit) h += rvFormTramo(S);
  h += '</div>';

  // ── filtros ──
  h += '<div style="margin-bottom:12px">';
  if (op.hot.length > 1) h += '<div style="margin-bottom:4px">' + op.hot.map(function (k) {
      return rvChip(k, _rvHot === k, 'rvFiltro(\'hot\',\'' + rvEsc(k) + '\')'); }).join('') + '</div>';
  if (op.cat.length > 1) h += '<div style="margin-bottom:4px">' + op.cat.map(function (k) {
      return rvChip(k, _rvCat === k, 'rvFiltro(\'cat\',\'' + rvEsc(k) + '\')'); }).join('') + '</div>';
  if (op.comp.length > 1) h += '<div style="margin-bottom:4px">' + op.comp.map(function (k) {
      return rvChip(k, _rvComp === k, 'rvFiltro(\'comp\',\'' + rvEsc(k) + '\')'); }).join('') + '</div>';
  h += (_rvHot || _rvCat || _rvComp || _rvSel !== 'todo' || _rvCmp)
      ? '<a onclick="rvLimpiar()" style="cursor:pointer;font-family:\'DM Mono\',monospace;font-size:11px;'
        + 'color:var(--gold);text-decoration:underline">quitar todo</a>' : '';
  h += '<button onclick="rvInformePDF()" style="float:right;padding:6px 14px;background:var(--ink);'
    + 'border:1px solid var(--ink);border-radius:2px;color:#d4a84b;font-family:\'DM Mono\',monospace;'
    + 'font-size:11px;cursor:pointer">&#128196; Informe PDF</button></div>';

  h += '<div style="' + S.SUB + ';margin:0 0 14px">' + ventas.length + ' venta'
    + (ventas.length === 1 ? '' : 's') + ' guardada' + (ventas.length === 1 ? '' : 's')
    + (meta.hasta ? ' · última ' + _remFec(meta.hasta) : '')
    + (meta.fuente ? ' · ' + meta.fuente : '')
    + ' · tramo <strong>' + A.nombre + '</strong> (' + rvVentana(A) + ', por ' + A.base + ')'
    + (B ? ' vs <strong>' + B.nombre + '</strong> (' + rvVentana(B) + ')' : '')
    + (dA.sinFecha ? ' · <span style="color:#a3311f">' + dA.sinFecha + ' fila(s) sin fecha de '
        + 'ingreso quedaron afuera</span>' : '')
    + '</div>';

  if (!TA) {
    el.innerHTML = h + '<div style="' + S.SUB + '">Ningún resultado con ese tramo y esos filtros.</div>';
    return;
  }

  // ── 1 · acumulado del período ──
  var kpi = function (lbl, valA, subA, valB, delta, big) {
    return '<div style="' + S.CARD + (big ? ';background:var(--ink)' : '') + '">'
      + '<div style="' + S.LBL + (big ? ';color:rgba(255,255,255,.45)' : '') + '">' + lbl + '</div>'
      + '<div style="' + S.VAL + (big ? ';color:#d4a84b' : '') + '">' + valA + '</div>'
      + '<div style="' + S.UNI + (big ? ';color:rgba(255,255,255,.4)' : '') + '">' + (subA || '') + '</div>'
      + (valB != null ? '<div style="' + S.UNI + (big ? ';color:rgba(255,255,255,.55)' : '')
          + ';border-top:1px dashed rgba(26,22,18,.12);margin-top:5px;padding-top:4px">B: ' + valB
          + ' · ' + delta + '</div>' : '')
      + '</div>';
  };
  h += '<div style="' + S.GRID + '">'
    + kpi('Resultado del período', _remM(TA.resultado),
          _remN(TA.resultado_pct, 1) + ' % s/costo · ' + _remM(TA.resultado_cab) + '/cab',
          TB ? _remM(TB.resultado) : null, TB ? rvDelta(TA.resultado, TB.resultado) : '', true)
    + kpi('Venta neta', _remM(TA.venta_neta),
          TA.ventas + ' venta' + (TA.ventas === 1 ? '' : 's') + ' · ' + TA.cabezas + ' cab',
          TB ? _remM(TB.venta_neta) : null, TB ? rvDelta(TA.venta_neta, TB.venta_neta) : '')
    + kpi('Costo', _remM(TA.costo), '$ ' + _remN(TA.costo / TA.kg_egreso) + '/kg vivo',
          TB ? _remM(TB.costo) : null, TB ? rvDelta(TA.costo, TB.costo) : '')
    + kpi('Rinde promedio', _remN(TA.rinde, 2) + ' %',
          _remN(TA.kg_carne) + ' kg carne / ' + _remN(TA.kg_egreso) + ' kg vivo',
          TB ? _remN(TB.rinde, 2) + ' %' : null, TB ? rvDelta(TA.rinde, TB.rinde, 'pp') : '')
    + kpi('Precio kg vivo', '$ ' + _remN(TA.precio_kg_vivo), 'neto de gastos',
          TB ? '$ ' + _remN(TB.precio_kg_vivo) : null,
          TB ? rvDelta(TA.precio_kg_vivo, TB.precio_kg_vivo, 'kg') : '')
    + '</div>';

  // ── serie mensual ──
  var mesesA = rvAgg(dA.rows, function (r) { return String(r.v.fecha_egreso || '').slice(0, 7); })
    .sort(function (a, b) { return a.clave < b.clave ? -1 : 1; });
  if (mesesA.length > 1) {
    h += '<div style="' + S.H2 + ';font-size:17px">Mes a mes</div>'
      + '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:14px;'
      + 'height:260px;margin-bottom:6px"><canvas id="rvChartMes"></canvas></div>';
  } else if (mesesA.length === 1) {
    h += '<div style="' + S.H2 + ';font-size:17px">Mes a mes</div>'
      + '<div style="' + S.SUB + ';margin:-6px 0 8px">El tramo cubre un solo mes.</div>'
      + rvTabla(['Mes', 'Ventas', 'Cab', 'Resultado', '% s/costo'], mesesA.map(function (m) {
          return [m.clave, m.ventas, _remN(m.cabezas), _remM(m.resultado), _remN(m.resultado_pct, 1) + ' %'];
        }), [mesesA[0].resultado < 0]);
  }

  // ── 2 · por categoría ──
  var catsA = rvAgg(dA.rows, function (r) { return r.f.categoria; })
    .sort(function (a, b) { return b.resultado - a.resultado; });
  var catsB = dB ? rvAgg(dB.rows, function (r) { return r.f.categoria; }) : null;
  var bCat = {};
  if (catsB) catsB.forEach(function (c) { bCat[c.clave] = c; });
  h += '<div style="' + S.H2 + ';font-size:17px">Por categoría'
    + '<button onclick="rvCSV(\'cat\')" style="float:right;padding:4px 11px;background:#faf8f4;'
    + 'border:1px solid #d8d6ce;border-radius:2px;font-family:\'DM Mono\',monospace;font-size:11px;'
    + 'cursor:pointer">&#11015; CSV</button></div>';
  if (TB) {
    h += rvTabla(['Categoría', 'Cab A', 'Cab B', 'Resultado A', 'Resultado B', '% A', '% B', 'Δ pp'],
      catsA.map(function (c) {
        var b = bCat[c.clave];
        return [c.clave, _remN(c.cabezas), b ? _remN(b.cabezas) : '—',
                _remM(c.resultado), b ? _remM(b.resultado) : '—',
                _remN(c.resultado_pct, 1) + ' %', b ? _remN(b.resultado_pct, 1) + ' %' : '—',
                b ? rvDelta(c.resultado_pct, b.resultado_pct, 'pp') : '—'];
      }), catsA.map(function (c) { return c.resultado < 0; }));
  } else {
    h += rvTabla(['Categoría', 'Cab', 'Ventas', 'Resultado', '% s/costo', '$/cab', 'Rinde'],
      catsA.map(function (c) {
        return [c.clave, _remN(c.cabezas), c.ventas, _remM(c.resultado),
                _remN(c.resultado_pct, 1) + ' %', _remM(c.resultado_cab), _remN(c.rinde, 2) + ' %'];
      }), catsA.map(function (c) { return c.resultado < 0; }));
  }

  // ── 3 y 4 · ranking de tropas (siempre del tramo A) ──
  var minCab = rvMinCab();
  var tropas = rvAgg(dA.rows, function (r) { return r.f.tropa; });
  var elegibles = tropas.filter(function (t) { return t.cabezas >= minCab; });
  var cmp = {
    resultado: function (a, b) { return b.resultado - a.resultado; },
    pct:       function (a, b) { return (b.resultado_pct || -1e9) - (a.resultado_pct || -1e9); },
    rinde:     function (a, b) { return (b.rinde || -1e9) - (a.rinde || -1e9); },
    adp:       function (a, b) { return (b.adp || -1e9) - (a.adp || -1e9); },
    cabezas:   function (a, b) { return b.cabezas - a.cabezas; }
  }[_rvOrden];
  elegibles.sort(cmp);
  var muestra = (_rvTop > 0 && elegibles.length > _rvTop * 2)
    ? elegibles.slice(0, _rvTop).concat(elegibles.slice(-_rvTop)) : elegibles;
  var porIng = A.base === 'ingreso';
  h += '<div style="' + S.H2 + ';font-size:17px">Tropas de origen'
    + (TB ? ' <span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--gold)">'
            + '· ranking del tramo A</span>' : '')
    + '<button onclick="rvCSV(\'tropa\')" style="float:right;padding:4px 11px;background:#faf8f4;'
    + 'border:1px solid #d8d6ce;border-radius:2px;font-family:\'DM Mono\',monospace;font-size:11px;'
    + 'cursor:pointer">&#11015; CSV</button></div>';
  h += '<div style="' + S.SUB + ';margin:-6px 0 8px">Ordenar por '
    + [['resultado', 'resultado $'], ['pct', '% s/costo'], ['rinde', 'rinde'], ['adp', 'ADP'],
       ['cabezas', 'cabezas']].map(function (o) {
        return rvChip(o[1], _rvOrden === o[0], 'rvFiltro(\'orden\',\'' + o[0] + '\')'); }).join('')
    + ' · ' + [['10', 'top/bottom 10'], ['0', 'todas']].map(function (o) {
        return rvChip(o[1], String(_rvTop) === o[0], 'rvFiltro(\'top\',\'' + o[0] + '\')'); }).join('')
    + '<br>' + elegibles.length + ' de ' + tropas.length + ' tropas con al menos ' + minCab
    + ' cabezas vendidas. <span title="El rinde se conoce por VENTA (kg carne del camión ÷ kg vivo '
    + 'del camión), no por animal: la planta liquida la media res del embarque entero. Acá es el '
    + 'rinde de las ventas en las que la tropa participó, ponderado por sus kg vivos. El rinde real '
    + 'por animal necesitaría romaneo por caravana." style="border-bottom:1px dotted;cursor:help">'
    + 'El rinde es de la venta, prorrateado.</span></div>';
  h += rvTabla(
    ['Tropa', 'Hotelero', 'Cat'].concat(porIng ? ['Ingreso'] : [])
      .concat(['Cab', 'Kg prod', 'Resultado', '% s/costo', '$/cab', 'Rinde', 'ADP', '$/kg prod', '$/kg pagado']),
    muestra.map(function (t) {
      return [t.clave, t.hotelero || '—', t.categoria || '—']
        .concat(porIng ? [_remFec(t.fecha_ingreso)] : [])
        .concat([_remN(t.cabezas), _remN(t.kg_producidos), _remM(t.resultado),
                 _remN(t.resultado_pct, 1) + ' %', _remM(t.resultado_cab), _remN(t.rinde, 2) + ' %',
                 _remN(t.adp, 3), _remM(t.costo_kg_prod), '$ ' + _remN(t.precio_pagado)]);
    }), muestra.map(function (t) { return t.resultado < 0; }));

  el.innerHTML = h;
  if (mesesA.length > 1) setTimeout(function () { rvPintarMeses(mesesA, dB); }, 0);
}

function rvEsc(s) { return String(s).replace(/'/g, "\\'"); }
function rvChip(txt, on, click) {
  return '<span onclick="' + click + '" style="cursor:pointer;padding:3px 9px;border-radius:2px;'
    + 'font-family:\'DM Mono\',monospace;font-size:11px;margin:0 5px 5px 0;display:inline-block;'
    + (on ? 'background:var(--ink);color:#d4a84b;border:1px solid var(--ink)'
          : 'background:#faf8f4;color:var(--ink);border:1px solid #e3e1da') + '">' + txt + '</span>';
}

/* Barra de presets + tramos guardados. `cual` es 'A' o 'B'. */
function rvBarraTramos(S, cual) {
  var sel = cual === 'B' ? _rvSelB : _rvSel;
  var h = '<div>';
  h += rvPresets().map(function (p) {
    return rvChip(p.nombre, sel === p.id, 'rvSelTramo(\'' + p.id + '\',\'' + cual + '\')');
  }).join('');
  var mios = rvTramos();
  if (mios.length) {
    h += '<span style="display:inline-block;width:1px;height:14px;background:#e3e1da;margin:0 8px 0 4px;'
      + 'vertical-align:middle"></span>';
    h += mios.map(function (t) {
      var on = sel === t.id;
      var lbl = t.nombre + (t.base === 'ingreso' ? ' <span style="opacity:.6">(ing)</span>' : '');
      var chip = '<span title="' + _remFec(t.desde) + ' → ' + (t.hasta ? _remFec(t.hasta) : 'hoy')
        + ' · por ' + (t.base || 'egreso') + '" onclick="rvSelTramo(\'' + t.id + '\',\'' + cual + '\')" '
        + 'style="cursor:pointer;padding:3px 9px;border-radius:2px;font-family:\'DM Mono\',monospace;'
        + 'font-size:11px;margin:0 5px 5px 0;display:inline-block;'
        + (on ? 'background:var(--ink);color:#d4a84b;border:1px solid var(--ink)'
              : 'background:#faf8f4;color:var(--ink);border:1px solid #e3e1da') + '">' + lbl;
      if (on && cual === 'A') {
        chip += '<span onclick="event.stopPropagation();rvEditarTramo(\'' + t.id + '\')" '
          + 'title="editar" style="margin-left:7px;opacity:.75">&#9998;</span>'
          + '<span onclick="event.stopPropagation();rvBorrarTramo(\'' + t.id + '\')" '
          + 'title="borrar" style="margin-left:6px;opacity:.75">'
          + (_rvBorrar === t.id ? '¿borrar?' : '&times;') + '</span>';
      }
      return chip + '</span>';
    }).join('');
  }
  if (cual === 'A') {
    h += rvChip('+ Nuevo tramo', false, 'rvNuevoTramo()');
    h += '<div style="margin-top:6px">'
      + '<span style="' + S.LBL + ';display:inline-block;margin-right:6px">Personalizado</span>'
      + '<input type="date" value="' + _rvDesde + '" onchange="rvFiltro(\'desde\',this.value)" style="'
      + S.INP + ';width:140px;padding:4px 8px;font-size:11px;margin-right:4px">'
      + '<input type="date" value="' + _rvHasta + '" onchange="rvFiltro(\'hasta\',this.value)" style="'
      + S.INP + ';width:140px;padding:4px 8px;font-size:11px">'
      + ((_rvDesde || _rvHasta)
          ? '<a onclick="rvGuardarCustom()" style="cursor:pointer;font-family:\'DM Mono\',monospace;'
            + 'font-size:11px;color:var(--gold);text-decoration:underline;margin-left:8px">guardar como tramo</a>' : '')
      + '<span onclick="rvToggleCmp()" style="float:right;cursor:pointer;padding:4px 12px;border-radius:2px;'
      + 'font-family:\'DM Mono\',monospace;font-size:11px;'
      + (_rvCmp ? 'background:var(--ink);color:#d4a84b;border:1px solid var(--ink)'
                : 'background:#faf8f4;color:var(--ink);border:1px solid #e3e1da') + '">'
      + (_rvCmp ? '✓ Comparar' : 'Comparar') + '</span></div>';
  }
  return h + '</div>';
}

function rvFormTramo(S) {
  var e = _rvEdit;
  return '<div style="border-top:1px dashed rgba(26,22,18,.12);margin-top:10px;padding-top:10px;'
    + 'display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">'
    + '<div style="display:flex;flex-direction:column;gap:4px"><label style="' + S.LBL + '">Nombre</label>'
    + '<input value="' + (e.nombre || '') + '" oninput="rvEditCampo(\'nombre\',this.value)" style="'
    + S.INP + ';width:170px;padding:5px 9px;font-size:12px"></div>'
    + '<div style="display:flex;flex-direction:column;gap:4px"><label style="' + S.LBL + '">Desde</label>'
    + '<input type="date" value="' + (e.desde || '') + '" oninput="rvEditCampo(\'desde\',this.value)" style="'
    + S.INP + ';width:145px;padding:5px 9px;font-size:12px"></div>'
    + '<div style="display:flex;flex-direction:column;gap:4px"><label style="' + S.LBL + '">Hasta (vacío = hoy)</label>'
    + '<input type="date" value="' + (e.hasta || '') + '" oninput="rvEditCampo(\'hasta\',this.value)" style="'
    + S.INP + ';width:145px;padding:5px 9px;font-size:12px"></div>'
    + '<div style="display:flex;flex-direction:column;gap:4px"><label style="' + S.LBL + '" '
    + 'title="egreso: la fecha en que salió la venta. ingreso: la fecha en que entró la tropa al '
    + 'feedlot — sirve para ver cómo rindió lo que se compró en un período. Con base ingreso el '
    + 'filtro se aplica fila por fila.">Base</label>'
    + '<select onchange="rvEditCampo(\'base\',this.value)" style="' + S.INP + ';width:120px;padding:5px 9px;font-size:12px">'
    + '<option value="egreso"' + (e.base !== 'ingreso' ? ' selected' : '') + '>egreso</option>'
    + '<option value="ingreso"' + (e.base === 'ingreso' ? ' selected' : '') + '>ingreso</option>'
    + '</select></div>'
    + '<button onclick="rvGuardarTramo()" style="padding:7px 16px;background:var(--ink);border:1px solid var(--ink);'
    + 'border-radius:2px;color:#d4a84b;font-family:\'DM Mono\',monospace;font-size:12px;cursor:pointer">Guardar</button>'
    + '<a onclick="rvCancelarEdit()" style="cursor:pointer;font-family:\'DM Mono\',monospace;font-size:11px;'
    + 'color:rgba(26,22,18,.5);text-decoration:underline;padding-bottom:9px">Cancelar</a>'
    + '</div>';
}

function rvTabla(cols, filas, neg) {
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:#fff;'
    + 'border:1px solid var(--border);font-family:\'DM Mono\',monospace"><thead><tr>'
    + cols.map(function (c, i) {
        return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);'
          + 'padding:8px 9px;border-bottom:2px solid var(--border);text-align:' + (i === 0 ? 'left' : 'right')
          + ';white-space:nowrap">' + c + '</th>';
      }).join('') + '</tr></thead><tbody>';
  filas.forEach(function (f, i) {
    var td = 'padding:7px 9px;border-bottom:1px solid #f0eee8;font-size:12.5px;white-space:nowrap';
    h += '<tr' + (neg && neg[i] ? ' style="background:#fdf6f4"' : '') + '>'
      + f.map(function (v, j) {
          return '<td style="' + td + ';text-align:' + (j === 0 ? 'left' : 'right') + '">' + v + '</td>';
        }).join('') + '</tr>';
  });
  return h + '</tbody></table></div>';
}

/* Barras de resultado por mes + línea del % s/costo. B superpuesto en gris. */
function rvPintarMeses(mesesA, dB) {
  var cv = document.getElementById('rvChartMes');
  if (!cv || typeof Chart === 'undefined') return;
  var labels = mesesA.map(function (m) { return m.clave; });
  var ds = [
    { type: 'bar', label: 'Resultado A', yAxisID: 'y',
      data: mesesA.map(function (m) { return Math.round(m.resultado); }),
      backgroundColor: mesesA.map(function (m) { return m.resultado < 0 ? '#c0392b' : '#27613d'; }),
      borderRadius: 2, order: 2 },
    { type: 'line', label: '% s/costo A', yAxisID: 'y1',
      data: mesesA.map(function (m) { return m.resultado_pct; }),
      borderColor: '#b8922a', backgroundColor: '#b8922a', tension: .25,
      pointRadius: 3, borderWidth: 2, order: 1 }
  ];
  if (dB) {
    var mB = {};
    rvAgg(dB.rows, function (r) { return String(r.v.fecha_egreso || '').slice(0, 7); })
      .forEach(function (m) { mB[m.clave] = m; });
    ds.splice(1, 0, { type: 'bar', label: 'Resultado B', yAxisID: 'y',
      data: labels.map(function (k) { return mB[k] ? Math.round(mB[k].resultado) : null; }),
      backgroundColor: 'rgba(26,22,18,.25)', borderRadius: 2, order: 3 });
  }
  _rvChart = new Chart(cv.getContext('2d'), {
    data: { labels: labels, datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom',
          labels: { font: { family: 'DM Mono', size: 11 }, boxWidth: 12, padding: 12 } },
        tooltip: {
          backgroundColor: 'rgba(26,22,18,.94)',
          titleFont: { family: 'DM Mono', size: 12, weight: '700' },
          bodyFont: { family: 'DM Mono', size: 11 }, padding: 10, cornerRadius: 4,
          callbacks: { label: function (c) {
            if (c.parsed.y == null) return null;
            return ' ' + c.dataset.label + ': '
              + (String(c.dataset.label).indexOf('%') >= 0
                  ? _remN(c.parsed.y, 1) + ' %' : _remM(c.parsed.y));
          } }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Mono', size: 10 } } },
        y: { position: 'left', ticks: { font: { family: 'DM Mono', size: 10 },
             callback: function (v) { return _remM(v); } },
             grid: { color: 'rgba(26,22,18,.06)' } },
        y1: { position: 'right', grid: { display: false },
              ticks: { font: { family: 'DM Mono', size: 10 },
                       callback: function (v) { return _remN(v, 0) + ' %'; } } }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
//  CSV y PDF
// ════════════════════════════════════════════════════════════
function _rvSlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tramo';
}
function rvCSV(cual) {
  var A = rvTramoA(), B = _rvCmp ? rvTramoB() : null;
  var dA = rvFilas(A), dB = B ? rvFilas(B) : null;
  var keyFn = cual === 'cat' ? function (r) { return r.f.categoria; } : function (r) { return r.f.tropa; };
  var rowsA = rvAgg(dA.rows, keyFn);
  var bMap = {};
  if (dB) rvAgg(dB.rows, keyFn).forEach(function (x) { bMap[x.clave] = x; });
  var cols = ['clave', 'hotelero', 'categoria', 'ventas', 'cabezas', 'kg_ingreso', 'kg_egreso',
              'kg_producidos', 'kg_carne', 'venta_neta', 'costo', 'resultado', 'resultado_pct',
              'resultado_cab', 'rinde', 'precio_kg_vivo', 'adp', 'costo_kg_prod', 'precio_pagado'];
  var head = cols.slice();
  if (dB) head = head.concat(cols.slice(3).map(function (c) { return c + '_B'; }));
  var val = function (v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(Math.round(v * 100) / 100).replace('.', ',');
    return /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  };
  var txt = head.join(';') + '\n' + rowsA.map(function (r) {
    var l = cols.map(function (c) { return val(r[c]); });
    if (dB) {
      var b = bMap[r.clave];
      l = l.concat(cols.slice(3).map(function (c) { return b ? val(b[c]) : ''; }));
    }
    return l.join(';');
  }).join('\n');
  var nombre = 'resultados_' + (cual === 'cat' ? 'categoria' : 'tropa') + '_' + _rvSlug(A.nombre)
    + (A.desde ? '_' + A.desde : '') + (A.hasta ? '_' + A.hasta : '')
    + (B ? '_vs_' + _rvSlug(B.nombre) : '') + '.csv';
  try {
    var blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) {}
}

function rvInformePDF() {
  var A = rvTramoA(), B = _rvCmp ? rvTramoB() : null;
  var dA = rvFilas(A), dB = B ? rvFilas(B) : null;
  var TA = rvTotal(dA.rows), TB = dB ? rvTotal(dB.rows) : null;
  if (!TA) return;
  var cats = rvAgg(dA.rows, function (r) { return r.f.categoria; })
    .sort(function (a, b) { return b.resultado - a.resultado; });
  var bCat = {};
  if (dB) rvAgg(dB.rows, function (r) { return r.f.categoria; }).forEach(function (c) { bCat[c.clave] = c; });
  var minCab = rvMinCab();
  var tropas = rvAgg(dA.rows, function (r) { return r.f.tropa; })
    .filter(function (t) { return t.cabezas >= minCab; })
    .sort(function (a, b) { return b.resultado - a.resultado; });

  var titulo = 'Resultados acumulados · ' + A.nombre + ' (' + rvVentana(A) + ', por ' + A.base + ')';
  if (B) titulo = 'Resultados acumulados · ' + A.nombre + ' vs ' + B.nombre;
  var filtros = [A.nombre + ' ' + rvVentana(A) + ' · por ' + A.base];
  if (B) filtros.push('B: ' + B.nombre + ' ' + rvVentana(B) + ' · por ' + B.base);
  if (_rvHot) filtros.push('hotelero ' + _rvHot);
  if (_rvCat) filtros.push('categoría ' + _rvCat);
  if (_rvComp) filtros.push('comprador ' + _rvComp);

  var tr = function (c) {
    return '<tr><td>' + c[0] + '</td>' + c.slice(1).map(function (x) {
      return '<td style="text-align:right">' + x + '</td>'; }).join('') + '</tr>';
  };
  var kc = function (l, v, u) {
    return '<div class="kc"><div class="l">' + l + '</div><div class="v">' + v + '</div>'
      + '<div class="u">' + (u || '&nbsp;') + '</div></div>';
  };
  var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resultados acumulados</title>'
    + '<style>@page{size:A4;margin:12mm}body{font-family:Georgia,serif;color:#1a1612;font-size:11px}'
    + 'h1{font-size:19px;margin:0 0 2px}.s{font-size:10px;color:#6b6560;margin-bottom:12px}'
    + '.k{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:12px}'
    + '.kc{border:1px solid #e3e1da;padding:8px 10px;border-radius:2px}'
    + '.l{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#8a827a}'
    + '.v{font-size:15px;font-weight:700;margin-top:2px}.u{font-size:8.5px;color:#8a827a}'
    + '.sec{font-size:13px;font-weight:700;margin:13px 0 5px;border-bottom:1px solid #e3e1da;padding-bottom:3px}'
    + 'table{width:100%;border-collapse:collapse;font-size:9.5px}'
    + 'th{text-align:right;font-size:8px;text-transform:uppercase;color:#8a827a;border-bottom:1px solid #e3e1da;padding:3px 4px}'
    + 'th:first-child{text-align:left}td{padding:3px 4px;border-bottom:1px solid #f2f0ea}'
    + '.ft{margin-top:13px;font-size:8.5px;color:#8a827a;border-top:1px solid #e3e1da;padding-top:6px}</style>'
    + '</head><body><h1>' + titulo + '</h1><div class="s">' + filtros.join(' · ') + ' · '
    + TA.ventas + ' venta(s) · ' + TA.cabezas + ' cabezas</div><div class="k">'
    + kc('Resultado', _remM(TA.resultado), _remN(TA.resultado_pct, 1) + ' % s/costo'
        + (TB ? ' · B ' + _remM(TB.resultado) : ''))
    + kc('Venta neta', _remM(TA.venta_neta), TB ? 'B ' + _remM(TB.venta_neta) : '')
    + kc('Costo', _remM(TA.costo), TB ? 'B ' + _remM(TB.costo) : '')
    + kc('Rinde', _remN(TA.rinde, 2) + ' %', _remN(TA.kg_carne) + ' kg carne'
        + (TB ? ' · B ' + _remN(TB.rinde, 2) + ' %' : ''))
    + kc('$/cab', _remM(TA.resultado_cab), TB ? 'B ' + _remM(TB.resultado_cab) : '')
    + '</div>'
    + '<div class="sec">Por categoría</div><table><thead><tr><th>Categoría</th><th>Cab</th>'
    + '<th>Resultado</th><th>% s/costo</th><th>$/cab</th><th>Rinde</th>'
    + (TB ? '<th>Result. B</th><th>% B</th>' : '') + '</tr></thead><tbody>'
    + cats.map(function (c) {
        var b = bCat[c.clave];
        return tr([c.clave, _remN(c.cabezas), _remM(c.resultado), _remN(c.resultado_pct, 1) + ' %',
                   _remM(c.resultado_cab), _remN(c.rinde, 2) + ' %']
          .concat(TB ? [b ? _remM(b.resultado) : '—', b ? _remN(b.resultado_pct, 1) + ' %' : '—'] : []));
      }).join('')
    + '</tbody></table>'
    + '<div class="sec">Tropas de origen (' + minCab + ' cabezas o más)'
    + (TB ? ' · tramo A' : '') + '</div>'
    + '<table><thead><tr><th>Tropa</th><th>Hotelero</th><th>Cat</th>'
    + (A.base === 'ingreso' ? '<th>Ingreso</th>' : '')
    + '<th>Cab</th><th>Resultado</th><th>% s/costo</th><th>$/cab</th><th>Rinde</th><th>ADP</th>'
    + '</tr></thead><tbody>'
    + tropas.slice(0, 30).map(function (t) {
        return tr([t.clave, t.hotelero || '—', t.categoria || '—']
          .concat(A.base === 'ingreso' ? [_remFec(t.fecha_ingreso)] : [])
          .concat([_remN(t.cabezas), _remM(t.resultado), _remN(t.resultado_pct, 1) + ' %',
                   _remM(t.resultado_cab), _remN(t.rinde, 2) + ' %', _remN(t.adp, 3)]));
      }).join('')
    + '</tbody></table>'
    + '<div class="ft">Generado el ' + new Date().toLocaleString('es-AR') + ' · Portal PEGSA v15.71.3 · '
    + 'La venta de cada remito se prorratea entre sus tropas por kg de egreso. El rinde es el de la '
    + 'venta (kg carne del camión ÷ kg vivo del camión) ponderado por los kg vivos de la tropa: el '
    + 'rinde real por animal necesitaría romaneo por caravana.'
    + (dA.sinFecha ? ' ' + dA.sinFecha + ' fila(s) sin fecha de ingreso quedaron afuera del tramo.' : '')
    + '</div></body></html>';
  var win = window.open('', '_blank');
  if (!win) { alert('El navegador bloqueó la ventana del informe. Permití las ventanas emergentes.'); return; }
  win.document.open(); win.document.write(h); win.document.close();
  win.onload = function () { setTimeout(function () { win.focus(); win.print(); }, 400); };
}
