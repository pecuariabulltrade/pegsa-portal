/* modulo-10-acumulados.js — 11 · Resultados Acumulados · v15.84 (2026-10-09)
   ────────────────────────────────────────────────────────────────
   Todo lo que se fue guardando con "Informe PDF" en 07 · Resultado por Remito,
   junto y por tramo de tiempo: resultado del período, por categoría y el
   ranking de tropas de origen.

   Hasta v15.71.2 esto era un bloque colapsable adentro del módulo 07. Ahora es
   pantalla propia (`screenAcumulados`) con su propia carga de datos.

   v15.78 · dos secciones nuevas entre las tarjetas y "Mes a mes": la tabla de
   VENTAS LIQUIDADAS (una fila por venta guardada, completa, sin prorratear) y
   los remitos SIN LIQUIDAR (índice del 07 menos los remitos de las ventas
   guardadas; los traslados a feria van aparte). Entran también al CSV y al PDF.

   v15.79 · informe completo, en este orden: 8 tarjetas (histórico y con
   reposición), puente de costos, por categoría ampliada, por destino ×
   categoría, ventas / sin liquidar, tortas de categoría y top de ORÍGENES DEL
   INGRESO (`f.origen_ing`, lo agrega el pipeline cruzando con
   compras_ingresos.json). Mes a mes y Tropas de origen quedan al final.

   v15.80 · categoría de VENTA (Vaca / Macho / Hembra) en categoría, destino,
   tortas y chips; puente de 9 pasos con etiquetas, conectores y unidad ($,
   $/kg carne, $/cab); orígenes por proveedor / proveedor + tipo / localidad;
   tropas de origen con su origen y localidad. Las tablas por tropa y por
   origen siguen con la categoría fina.

   v15.80.2 · el puente junta alimento, estructura, sanidad y mortandad en una
   sola barra "Gastos feedlot" (8 pasos); el desglose va en el tooltip y en la
   línea de texto, así el PDF no lo pierde.

   v15.81 · presentación para el dueño (pantalla y PDF): cada sección abre con
   una caja "Qué muestra" + "Lectura rápida" armada con los números; semáforo
   verde/rojo, fondo graduado en $/cab, punto del mejor y del peor, chips de
   categoría, barra de volumen; orígenes con "Qué vendimos" (mix) en vez de
   "Cat. principal" y encabezado Vendedor; en el PDF todo negativo en rojo.

   v15.84 · la misma caja dice con qué %PV se costeó el consumo (pct_pv_mensual.json)
   v15.82 · la caja del resumen dice a qué precio de ración se costeó el feedlot
   (racion_mensual.json, del portal de Hotelería, con markup) y avisa si alguna
   venta usó un precio repetido o del Excel.

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
var _rvRacion = null;   // v15.82 · racion_mensual.json
var _rvPctPv = null;    // v15.84 · pct_pv_mensual.json
function rvCargarRacion() {
  if (!_rvPctPv) {
    _rvPctPv = {};
    fetch(STOCK_SB + '/pct_pv_mensual.json', {}, {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { _rvPctPv = j; if (document.getElementById('rvContent') && _rvHist) rvRender(); } })
      .catch(function () {});
  }
  if (_rvRacion) return;
  _rvRacion = {};
  fetch(STOCK_SB + '/racion_mensual.json', {}, {})
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j) { _rvRacion = j; if (document.getElementById('rvContent') && _rvHist) rvRender(); } })
    .catch(function () {});
}
function rvCargar() {
  rvCargarRacion();
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
  rvCargarIdx();           // v15.78 · para "Sin liquidar"; re-renderiza al llegar
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
  else if (campo === 'orden_ori') _rvOrdenOri = v;
  else if (campo === 'puente_u') { _rvPuenteU = v; rvLsSet('pegsa_rv_puente_u', v); }
  else if (campo === 'ori_nivel') { _rvOrigenNivel = v; rvLsSet('pegsa_rv_origen_nivel', v); }
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
    // v15.79 · bruta por kg de egreso (mismo peso que venta_prorrateada) y el
    // delta de reposición por costo de compra (es lo único que la reposición
    // cambia, con alimento y mortandad a precio de hoy prorrateados igual).
    var bruV = ((v.venta || {}).bruta) || 0;
    var ccTot = filas.reduce(function (a, f) { return a + (f.costo_compra || 0); }, 0);
    var rpv = v.reposicion, repoDif = (rpv && rpv.costos && v.costos)
      ? (rpv.costos.total || 0) - (v.costos.total || 0) : null;
    filas.forEach(function (f) {
      if (_rvHot && f.hotelero !== _rvHot) return;
      if (_rvCat && rvCatV(f.categoria) !== _rvCat) return;   // v15.80 · categoría de venta
      if (porIngreso) {
        if (!f.fecha_ingreso) { sinFecha++; return; }
        if (!rvEnTramo(f.fecha_ingreso, t)) return;
      }
      var w = kgeTot ? (f.kg_egreso || 0) / kgeTot : 0;
      out.push({ v: v, f: f, kg_carne: (kgeTot && kgcV) ? kgcV * (f.kg_egreso || 0) / kgeTot : 0,
                 bruta: bruV * w, sin_repo: repoDif == null,
                 repo_d: repoDif == null ? 0 : (ccTot ? repoDif * (f.costo_compra || 0) / ccTot : repoDif * w) });
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
      venta_neta: 0, costo: 0, compra: 0, aes: 0, diasAnimal: 0, hot: {}, cat: {}, fi: {},
      bruta: 0, comision: 0, gastos_compra: 0, alimento: 0, estructura: 0, sanidad: 0, mortandad: 0,
      kg_ms: 0, kg_ms_n: 0, kg_ms_est: 0, repo_d: 0, sin_repo: 0, tropas: {},
      ori: {}, oril: {}, otip: {}, loc: {} });
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
    // v15.79
    a.bruta += r.bruta || 0;
    a.comision += f.comision || 0; a.gastos_compra += f.gastos_compra || 0;
    a.alimento += f.alimento || 0; a.estructura += f.estructura || 0;
    a.sanidad += f.sanidad || 0; a.mortandad += f.mortandad || 0;
    if (f.kg_ms != null) { a.kg_ms += f.kg_ms; a.kg_ms_n++; if (f.kg_ms_estimado) a.kg_ms_est++; }
    a.repo_d += r.repo_d || 0;
    if (r.sin_repo) a.sin_repo += f.cabezas || 0;
    if (f.tropa) a.tropas[f.tropa] = 1;
    // v15.80 · de dónde vino (por cabezas)
    if (f.origen_ing) a.ori[f.origen_ing] = (a.ori[f.origen_ing] || 0) + (f.cabezas || 0);
    if (f.origen_ing) a.oril[rvOriLbl(f)] = (a.oril[rvOriLbl(f)] || 0) + (f.cabezas || 0);
    if (f.origen_tipo) a.otip[f.origen_tipo] = (a.otip[f.origen_tipo] || 0) + (f.cabezas || 0);
    if (f.localidad) a.loc[f.localidad] = (a.loc[f.localidad] || 0) + (f.cabezas || 0);
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
      hotelero: moda(a.hot), categoria: moda(a.cat), fecha_ingreso: moda(a.fi),
      // v15.79
      bruta: a.bruta, gastos_venta: a.bruta - a.venta_neta, compra: a.compra, comision: a.comision,
      gastos_compra: a.gastos_compra, alimento: a.alimento, estructura: a.estructura,
      sanidad: a.sanidad, mortandad: a.mortandad,
      kg_ms: a.kg_ms_n ? a.kg_ms : null, kg_ms_est: a.kg_ms_est > 0,
      conversion: (a.kg_ms_n && kgProd > 0) ? a.kg_ms / kgProd : null,
      repo_delta: a.repo_d, sin_repo: a.sin_repo,
      resultado_repo: res - a.repo_d,
      resultado_repo_pct: (a.costo + a.repo_d) ? (res - a.repo_d) / (a.costo + a.repo_d) * 100 : null,
      resultado_repo_cab: a.cabezas ? (res - a.repo_d) / a.cabezas : null,
      precio_kg_carne: a.kg_carne ? a.bruta / a.kg_carne : null,
      estadia: a.cabezas ? a.diasAnimal / a.cabezas : null,
      kg_prod_cab: a.cabezas ? kgProd / a.cabezas : null,
      kg_ing_cab: a.cabezas ? a.kg_ingreso / a.cabezas : null,
      kg_egr_cab: a.cabezas ? a.kg_egreso / a.cabezas : null,
      n_tropas: Object.keys(a.tropas).length,
      origen_ing: moda(a.ori), origen_lbl: moda(a.oril), origen_tipo: moda(a.otip),
      localidad: moda(a.loc), n_prov: Object.keys(a.ori).length,
      mix: rvMixArr(a.cat), categorias: rvMixTexto(rvMixArr(a.cat))   // v15.81
    };
  });
}
function rvTotal(rows) {
  var t = rvAgg(rows, function () { return 'TOTAL'; });
  return t.length ? t[0] : null;
}

/* Δ entre A y B, con el formato de cada magnitud. */
function rvDelta(a, b, tipo) {
  if (a == null || b == null) return '';
  var d = a - b;
  var s = d >= 0 ? '+' : '−', abs = Math.abs(d);
  var txt = tipo === 'pp' ? _remN(abs, 1) + ' pp'
          : tipo === 'pct' ? _remN(abs, 2) + ' %'
          : tipo === 'kg' ? '$ ' + _remN(abs)
          : tipo === 'n' ? _remN(abs)
          : tipo === 'adp' ? _remN(abs, 3)
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

  // v15.74.12 · avisos de Compras y Liquidaciones sumados sobre el tramo A
  // (tropa · categoría únicas, con el semáforo guardado en cada snapshot)
  if (typeof remAvisosComprasHTML === 'function') {
    h += remAvisosComprasHTML(dA.rows.map(function (x) { return x.f; }), 'del tramo', false);
  }

  // ── v15.79 · 2 tarjetas · 3 puente · 4 categoría · 5 destino ──
  var kpi = function (lbl, valA, subA, valB, delta, big) {
    // v15.81 · `big` puede ser un color de fondo (verde/rojo oscuro según el signo)
    return '<div style="' + S.CARD + (big ? ';background:' + (typeof big === 'string' ? big : 'var(--ink)') + ';border-color:transparent' : '') + '">'
      + '<div style="' + S.LBL + (big ? ';color:rgba(255,255,255,.45)' : '') + '">' + lbl + '</div>'
      + '<div style="' + S.VAL + (big ? ';color:#d4a84b' : '') + '">' + valA + '</div>'
      + '<div style="' + S.UNI + (big ? ';color:rgba(255,255,255,.4)' : '') + '">' + (subA || '') + '</div>'
      + (valB != null ? '<div style="' + S.UNI + (big ? ';color:rgba(255,255,255,.55)' : '')
          + ';border-top:1px dashed rgba(26,22,18,.12);margin-top:5px;padding-top:4px">B: ' + valB
          + ' · ' + delta + '</div>' : '')
      + '</div>';
  };
  h += rvSecTarjetas(S, TA, TB, A, kpi);
  h += rvSecPuente(S, TA);
  h += rvSecCategoria(S, dA, dB, TA, TB);
  h += rvSecDestino(S, dA);

  // ── v15.78 · ventas liquidadas (siempre del tramo A) + sin liquidar ──
  var vtsA = rvVentasTramo(A);
  h += '<div style="' + S.H2 + ';font-size:17px">Ventas liquidadas'
    + (TB ? ' <span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--gold)">'
            + '· tramo A</span>' : '')
    + '<button onclick="rvCSV(\'ventas\')" style="float:right;padding:4px 11px;background:#faf8f4;'
    + 'border:1px solid #d8d6ce;border-radius:2px;font-family:\'DM Mono\',monospace;font-size:11px;'
    + 'cursor:pointer">&#11015; CSV</button></div>';
  h += rvIntro('ventas', RV_LECT.ventas(vtsA.map(function (x) { return rvVentaFila(x.v); })));
  h += '<div style="' + S.SUB + ';margin:0 0 8px">Cada fila es la venta completa, como se guardó en el 07 '
    + '(los filtros deciden qué ventas entran, no recortan sus números). Resultado c/ repos. = venta neta menos '
    + 'lo que costaría reponer esos animales hoy.</div>';
  h += vtsA.length ? rvTablaVentas(S, vtsA)
                   : '<div style="' + S.SUB + '">Ninguna venta en el tramo con esos filtros.</div>';
  h += rvSeccionSinLiquidar(S, A);

  // ── v15.79 · 7 tortas · 8 orígenes del ingreso ──
  h += rvSecTortas(S, dA.rows);
  h += rvSecOrigenes(S, dA);

  // ── serie mensual ──
  var mesesA = rvAgg(dA.rows, function (r) { return String(r.v.fecha_egreso || '').slice(0, 7); })
    .sort(function (a, b) { return a.clave < b.clave ? -1 : 1; });
  if (mesesA.length > 1) {
    h += '<div style="' + S.H2 + ';font-size:17px">Mes a mes</div>' + rvIntro('meses', '')
      + '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:14px;'
      + 'height:260px;margin-bottom:6px"><canvas id="rvChartMes"></canvas></div>';
  } else if (mesesA.length === 1) {
    h += '<div style="' + S.H2 + ';font-size:17px">Mes a mes</div>' + rvIntro('meses', '')
      + '<div style="' + S.SUB + ';margin:-6px 0 8px">El tramo cubre un solo mes.</div>'
      + rvTabla(['Mes', 'Ventas', 'Cab', 'Resultado', '% s/costo'], mesesA.map(function (m) {
          return [m.clave, m.ventas, _remN(m.cabezas), rvSem(m.resultado, _remM(m.resultado)),
                  rvSem(m.resultado_pct, _remN(m.resultado_pct, 1) + ' %')];
        }), [mesesA[0].resultado < 0]);
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
  h += rvIntro('tropas', '');
  if (!_rvVerTropas) {
    h += '<div style="' + S.SUB + ';margin:-6px 0 8px">' + elegibles.length + ' tropas con al menos ' + minCab
      + ' cabezas · <a onclick="rvToggleTropas()" style="cursor:pointer;color:var(--gold);text-decoration:underline">'
      + 'ver tropas</a></div>';
  } else {
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
    ['Tropa', 'Origen', 'Localidad', 'Hotelero', 'Cat'].concat(porIng ? ['Ingreso'] : [])
      .concat(['Cab', 'Kg prod', 'Resultado', '% s/costo', '$/cab', 'Rinde', 'ADP', '$/kg prod', '$/kg pagado']),
    muestra.map(function (t) {
      return [t.clave, rvCorta(t.origen_lbl || '—', 28), t.localidad || '—', t.hotelero || '—',
              t.categoria ? rvCatChip(t.categoria) : '—']
        .concat(porIng ? [_remFec(t.fecha_ingreso)] : [])
        .concat([_remN(t.cabezas), _remN(t.kg_producidos), rvSem(t.resultado, _remM(t.resultado)),
                 rvSem(t.resultado_pct, _remN(t.resultado_pct, 1) + ' %'), rvSem(t.resultado_cab, _remM(t.resultado_cab)),
                 _remN(t.rinde, 2) + ' %',
                 _remN(t.adp, 3), _remM(t.costo_kg_prod), '$ ' + _remN(t.precio_pagado)]);
    }), muestra.map(function (t) { return t.resultado < 0; }));
  h += '<div style="' + S.SUB + ';margin:6px 0 0"><a onclick="rvToggleTropas()" style="cursor:pointer;'
    + 'color:var(--gold);text-decoration:underline">ocultar tropas</a></div>';
  }

  el.innerHTML = h;
  if (mesesA.length > 1) setTimeout(function () { rvPintarMeses(mesesA, dB); }, 0);
  setTimeout(function () { rvPintarPuente(TA); rvPintarTortas(dA.rows); }, 0);
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
//  v15.78 · Ventas liquidadas (una fila por venta) y remitos sin liquidar
// ════════════════════════════════════════════════════════════
/* Cada fila es la VENTA COMPLETA tal cual se guardó con "Informe PDF" en el
   07: no se prorratea por tropa (eso ya lo hacen "Por categoría" y "Tropas de
   origen"). Los chips de hotelero / categoría / comprador deciden si la venta
   entra (alcanza con que una fila cumpla), pero no recortan sus números. */
/* Decimales sólo si el número los tiene: $ 7.200 pero $ 3.904,57. */
function _rvNd(n, d) {
  if (n == null || isNaN(n)) return '—';
  return _remN(n, Math.abs(n - Math.round(n)) < 0.005 ? 0 : d);
}

function rvVentasTramo(t) {
  var porIng = (t && t.base === 'ingreso');
  var out = [];
  rvVentas().forEach(function (v) {
    if (_rvComp && v.comprador !== _rvComp) return;
    var filas = v.filas || [];
    var cumple = function (f) {
      return (!_rvHot || f.hotelero === _rvHot) && (!_rvCat || rvCatV(f.categoria) === _rvCat);
    };
    var porIngreso = false;
    if (porIng) {
      var ok = filas.some(function (f) {
        return cumple(f) && f.fecha_ingreso && rvEnTramo(f.fecha_ingreso, t);
      });
      if (!ok) return;
      porIngreso = true;
    } else {
      if (!rvEnTramo(v.fecha_egreso, t)) return;
      if ((_rvHot || _rvCat) && !filas.some(cumple)) return;
    }
    out.push({ v: v, porIngreso: porIngreso });
  });
  var primer = function (v) { return String((v.remitos || [])[0] || ''); };
  out.sort(function (a, b) {
    var fa = String(a.v.fecha_egreso || ''), fb = String(b.v.fecha_egreso || '');
    if (fa !== fb) return fa < fb ? 1 : -1;
    return primer(a.v) < primer(b.v) ? 1 : primer(a.v) > primer(b.v) ? -1 : 0;
  });
  return out;
}

/* "PEGSA 97 · UGMA 1": un campo de las filas ponderado por cabezas, de mayor a
   menor. Con un solo valor va sin número. */
function rvPond(v, campo) {
  var o = {};
  (v.filas || []).forEach(function (f) {
    var k = f[campo] || '—';
    o[k] = (o[k] || 0) + (f.cabezas || 0);
  });
  var ks = Object.keys(o).sort(function (a, b) { return o[b] - o[a] || (a < b ? -1 : 1); });
  if (ks.length === 1) return ks[0];
  return ks.map(function (k) { return k + ' ' + o[k]; }).join(' · ');
}

/* Una venta → los números de su fila (pantalla, CSV y PDF usan esto). */
function rvVentaFila(v) {
  var ve = v.venta || {}, re = v.resultado || {}, rp = v.reposicion || null;
  var kgv = v.kg_egreso || 0, kgc = ve.kg_carne || 0;
  return {
    fecha: v.fecha_egreso, remitos: (v.remitos || []).join('+'), es_grupo: !!v.es_grupo,
    comprador: v.comprador || '', propietario: rvPond(v, 'hotelero'),
    categorias: rvPond(v, 'categoria'), cabezas: v.cabezas || 0,
    kg_vivo: kgv, kg_carne: kgc,
    rinde: ve.rinde_pct != null ? ve.rinde_pct : (kgv ? kgc / kgv * 100 : null),
    precio_kg: ve.precio_kg, bruta: ve.bruta, neta: ve.neta,
    costo: (v.costos || {}).total, res: re.monto, res_pct: re.pct_costo,
    repo: rp ? rp.resultado : null, repo_precio: rp ? rp.precio_kg : null,
    repo_manual: rp ? !!rp.manual : null, repo_costo: rp ? (rp.costos || {}).total : null,
    estado: (v.verificacion || {}).estado || '', version: v.version_portal || ''
  };
}

/* TOTAL = la misma cuenta que una venta grande: rinde y $/kg salen de los
   totales, no de promediar las filas. */
function rvVentasTotal(F) {
  var t = { cabezas: 0, kg_vivo: 0, kg_carne: 0, bruta: 0, neta: 0, costo: 0, res: 0,
            repo: 0, repo_costo: 0, n_repo: 0, n_remitos: 0 };
  F.forEach(function (x) {
    t.cabezas += x.cabezas; t.kg_vivo += x.kg_vivo; t.kg_carne += x.kg_carne;
    t.bruta += x.bruta || 0; t.neta += x.neta || 0; t.costo += x.costo || 0; t.res += x.res || 0;
    t.n_remitos += x.remitos ? x.remitos.split('+').length : 0;
    if (x.repo != null) { t.repo += x.repo; t.repo_costo += x.repo_costo || 0; t.n_repo++; }
  });
  t.rinde = t.kg_vivo ? t.kg_carne / t.kg_vivo * 100 : null;
  t.precio_kg = t.kg_carne ? t.bruta / t.kg_carne : null;
  t.res_pct = t.costo ? t.res / t.costo * 100 : null;
  t.repo_pct = t.repo_costo ? t.repo / t.repo_costo * 100 : null;
  return t;
}


/* ── remitos sin liquidar ── */
var _rvIdx = null;          // resultado_remitos_index.json (el mismo objeto que usa el 07)
var _rvIdxEstado = '';      // '' | 'cargando' | 'ok' | 'error'
var _rvFeriaVer = false;

function rvCargarIdx() {
  if (_rvIdxEstado === 'ok' || _rvIdxEstado === 'cargando') return;
  if (typeof remIndice !== 'function') { _rvIdxEstado = 'error'; return; }
  _rvIdxEstado = 'cargando';
  remIndice()
    .then(function (j) { _rvIdx = j; _rvIdxEstado = 'ok'; })
    .catch(function () { _rvIdx = null; _rvIdxEstado = 'error'; })
    .then(function () { if (document.getElementById('rvContent')) rvRender(); });
}

function rvEsFeria(r) { return /TRASLADO\s+A\s+FERIA/i.test(String((r || {}).comprador || '')); }

/* Remitos del índice que no están en ninguna venta guardada. Se filtra por
   fecha de EGRESO del tramo A (el índice no trae fecha de ingreso por fila) y
   por comprador; un remito dentro de un grupo guardado cuenta como liquidado. */
function rvSinLiquidar(t) {
  if (!_rvIdx || !_rvIdx.remitos) return null;
  var liq = {};
  rvVentas().forEach(function (v) { (v.remitos || []).forEach(function (n) { liq[String(n)] = 1; }); });
  var desdeIdx = (_rvIdx.meta || {}).desde || '';
  var tt = { desde: (t && t.desde) || desdeIdx, hasta: (t && t.hasta) || '' };
  var sin = [], feria = [];
  Object.keys(_rvIdx.remitos).forEach(function (n) {
    if (liq[String(n)]) return;
    var r = _rvIdx.remitos[n];
    if (!rvEnTramo(r.fecha_egreso, tt)) return;
    if (_rvComp && r.comprador !== _rvComp) return;
    var x = { nro: String(n), fecha: r.fecha_egreso, comprador: r.comprador || '',
              cabezas: r.cabezas || 0, kg_vivo: r.kg_egreso || 0, cobertura: r.cobertura_pct };
    (rvEsFeria(r) ? feria : sin).push(x);
  });
  var ord = function (a, b) {
    return a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : (a.nro < b.nro ? 1 : -1);
  };
  sin.sort(ord); feria.sort(ord);
  return { sin: sin, feria: feria, desde: tt.desde,
           cab: sin.reduce(function (a, x) { return a + x.cabezas; }, 0),
           kg: sin.reduce(function (a, x) { return a + x.kg_vivo; }, 0) };
}

/* Abre el 07 con ese remito elegido, en modo de un remito. renderRemitos sólo
   pisa _remSel si no existe en el índice, así que alcanza con dejarlo puesto. */
function rvLiquidar(nro) {
  if (typeof _remModo !== 'undefined') { _remModo = 'simple'; _remGrupo = []; _remSel = String(nro); }
  sbNavigate('remitos');
}
function rvFeriaToggle() { _rvFeriaVer = !_rvFeriaVer; rvRender(); }


function rvTablaSinLiq(lista, accion) {
  var cols = ['Fecha', 'Remito', 'Comprador', 'Cab', 'Kg vivo', 'Cobertura'].concat(accion ? [''] : []);
  var td = 'padding:6px 9px;border-bottom:1px solid #f0eee8;font-size:12.5px;white-space:nowrap';
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:#fff;'
    + 'border:1px solid var(--border);font-family:\'DM Mono\',monospace"><thead><tr>'
    + cols.map(function (c, i) {
        return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);'
          + 'padding:8px 9px;border-bottom:2px solid var(--border);text-align:' + (i < 3 ? 'left' : 'right') + '">' + c + '</th>';
      }).join('') + '</tr></thead><tbody>';
  lista.forEach(function (x) {
    var cob = x.cobertura == null ? '—'
      : '<span style="color:' + (x.cobertura < 70 ? '#c0392b' : 'inherit') + '">' + _remN(x.cobertura, 1) + ' %</span>';
    h += '<tr><td style="' + td + '">' + _remFec(x.fecha) + '</td><td style="' + td + '">' + x.nro + '</td>'
      + '<td style="' + td + '">' + x.comprador + '</td>'
      + '<td style="' + td + ';text-align:right">' + _remN(x.cabezas) + '</td>'
      + '<td style="' + td + ';text-align:right">' + _remN(x.kg_vivo) + '</td>'
      + '<td style="' + td + ';text-align:right">' + cob + '</td>'
      + (accion ? '<td style="' + td + ';text-align:right"><a onclick="rvLiquidar(\'' + x.nro + '\')" '
          + 'style="cursor:pointer;color:var(--gold);text-decoration:underline">Liquidar →</a></td>' : '')
      + '</tr>';
  });
  return h + '</tbody></table></div>';
}

// ════ v15.81 · presentación: intros, semáforo, chips de categoría, barras ════
/* Nicolás 05/10: "detallá un poco más la info de qué va a ver el dueño antes de
   mostrar la tabla ... necesitamos un poco más de color" y "en el informe PDF
   los negativos tienen que ser en rojo". Todo lo de acá usa colores en hex (no
   variables CSS) porque se usa igual en pantalla y en la ventana del PDF. */
var RV_VERDE = '#27613d', RV_ROJO = '#c0392b', RV_GOLD = '#b8922a';

/* Textos fijos de "Qué muestra" — son para el dueño, no para el que programa. */
var RV_INTRO = {
  tarjetas: 'Resumen de todo lo vendido en el tramo elegido. El <b>resultado histórico</b> compara la venta con '
    + 'lo que realmente se pagó por la hacienda más todo lo que costó engordarla; el <b>resultado con '
    + 'reposición</b> repite la cuenta valuando la compra a lo que costaría hoy reponer esa hacienda: es el '
    + 'número que dice si el negocio se puede repetir.',
  puente: 'De cada peso que pagó el frigorífico, cuánto se fue en gastos de venta, cuánto en comprar la hacienda, '
    + 'cuánto en el feedlot (alimento, estructura, sanidad y mortandad) y cuánto quedó. Las barras bajan con cada '
    + 'costo y la última es el resultado.',
  categoria: 'La misma cuenta separada por lo que se vendió: <b>Vaca</b>, <b>Macho</b> (novillo, novillito, '
    + 'ternero, toro) y <b>Hembra</b> (vaquillona, ternera). Sirve para ver qué tipo de hacienda está dejando '
    + 'plata y cuál no.',
  destino: 'A quién se le vendió y qué. Permite comparar precio, rinde y kilos de salida entre frigoríficos para '
    + 'la misma categoría.',
  ventas: 'Una fila por cada venta ya liquidada (remito o grupo de remitos), con su resultado histórico y con '
    + 'reposición. Las filas en rosa perdieron plata.',
  sinliq: 'Remitos de venta que todavía no tienen la liquidación del frigorífico cargada en el portal, y por eso '
    + 'no entran en ninguna cuenta de arriba.',
  tortas: 'Qué parte de lo vendido fue vaca, macho y hembra, en cabezas y en kilos de carne.',
  origenes: '<b>Acá no se mira la categoría sino de dónde vino la hacienda.</b> Cada fila junta todos los animales '
    + 'que <b>un mismo vendedor</b> (el proveedor del remito de ingreso en WinCampo) nos entregó y ya se vendieron, '
    + 'sin importar en qué tropa entraron ni qué categoría eran: dice si esa procedencia nos deja plata. Las tropas '
    + 'propias figuran como PROPIO. Se puede agrupar también por <b>proveedor y tipo</b> (campo o feria) o por '
    + '<b>localidad</b>.',
  oxc: 'La tabla anterior abierta por categoría: para un mismo vendedor, qué categoría convino comprarle. Es la que '
    + 'responde preguntas como «¿la vaca de Huinca o la de Darwash?».',
  meses: 'El resultado del tramo repartido por el mes en que salió cada venta.',
  tropas: 'El detalle más fino: cada tropa de ingreso con su resultado. Es para buscar un caso puntual; para decidir '
    + 'a quién comprar, mirar «Orígenes del ingreso».'
};

/* Caja de presentación: línea gold corta (marca la sección al hojear) + "Qué
   muestra" + "Lectura rápida" (si hay datos; nunca "undefined"). */
function rvIntro(clave, lectura, pdf, queExtra) {
  var que = (RV_INTRO[clave] || '') + (queExtra ? ' ' + queExtra : '');
  if (pdf) {
    return '<div class="intro"><div><b>Qué muestra.</b> ' + que + '</div>'
      + (lectura ? '<div><b>Lectura rápida.</b> ' + lectura + '</div>' : '') + '</div>';
  }
  return '<div style="width:48px;border-bottom:2px solid ' + RV_GOLD + ';margin:-8px 0 10px"></div>'
    + '<div class="rv-intro" style="background:#faf8f4;border-left:3px solid ' + RV_GOLD + ';padding:10px 14px;'
    + 'margin:0 0 10px;font-family:\'DM Mono\',monospace;font-size:11.5px;line-height:1.6;color:rgba(26,22,18,.78)">'
    + '<div><b>Qué muestra.</b> ' + que + '</div>'
    + (lectura ? '<div style="margin-top:5px"><b>Lectura rápida.</b> ' + lectura + '</div>' : '') + '</div>';
}
function rvOk(x) { return x != null && isFinite(x); }
/* v15.82 · a qué precio de ración se costeó el feedlot y si hubo meses sin
   precio de hotelería (repetidos o del Excel) en las ventas del tramo. */
function rvRacionFrase(A, pdf) {
  var R = _rvRacion || {}, M = R.meta || {}, mes = M.ultimo_cerrado, v = mes && (R.meses || {})[mes];
  var s = '';
  if (v && rvOk(v.precio_ms)) {
    s = 'El feedlot se costea al precio de ración que liquida el portal de Hotelería (con su markup): <b>$ '
      + _remN(v.precio_ms, 2) + '/kg MS en ' + (typeof remMesCorto === 'function' ? remMesCorto(mes) : mes)
      + '</b>; meses sin cierre se calculan con los precios diarios cargados.';
  } else if (M.fuente_principal === 'excel') {
    s = 'El feedlot se costea con el Excel de precios de ración (el portal de Hotelería no estaba disponible).';
  }
  // v15.84 · el %PV del último mes cerrado (el que se usó para costear)
  var PM = (_rvPctPv || {}).meses || {};
  var mpv = Object.keys(PM).filter(function (m) { return !PM[m].parcial; }).sort().pop();
  if (mpv && rvOk(PM[mpv].pct_pv_usado)) {
    var pv = PM[mpv];
    s += (s ? ' ' : '') + 'Consumo usado: <b>' + _remN(pv.pct_pv_usado, 2) + ' % del peso vivo en '
      + (typeof remMesCorto === 'function' ? remMesCorto(mpv) : mpv) + '</b> (' + _remN(pv.kg_ms_cab_dia, 2)
      + ' kg MS/cab/día, ' + (pv.fuente_ms === 'mixer' ? 'mixer' : 'liquidador de Hotelería') + ')'
      + (pv.acotado ? ', acotado al rango 2,3–2,7 %' : '') + '.';
  }
  var cop = {}, n = 0;
  rvVentasTramo(A).forEach(function (x) {
    var mc = ((x.v.reposicion || {}).meses_copiados) || [];
    if (mc.length) { n++; mc.forEach(function (m) { cop[m] = 1; }); }
  });
  if (n) {
    var lista = Object.keys(cop).sort().join(', ');
    s += (s ? ' ' : '') + (pdf ? '<span class="neg">⚠' : '<span title="' + lista + '" style="color:#a3311f;cursor:help">⚠')
      + ' ' + n + ' venta' + (n === 1 ? ' usó' : 's usaron') + ' un precio de ración repetido o del Excel en algún mes de la estadía'
      + (pdf ? ' (' + lista + ')' : '') + '.</span>';
  }
  return s;
}

/* Semáforo: verde si gana, rojo si pierde. La clase `neg` la usa el PDF (y el
   test que verifica que todo negativo del PDF esté en rojo). */
function rvSem(n, txt) {
  if (!rvOk(n) || n === 0) return txt;
  return n < 0 ? '<span class="neg" style="color:' + RV_ROJO + '">' + txt + '</span>'
               : '<span class="pos" style="color:' + RV_VERDE + '">' + txt + '</span>';
}
/* Fondo graduado del $/cab: tres escalones según |valor| / máximo de la tabla. */
function rvGrad(v, max) {
  if (!rvOk(v) || !max) return '';
  var r = Math.abs(v) / max, a = r > 2 / 3 ? 0.28 : r > 1 / 3 ? 0.19 : 0.10;
  return 'background:' + (v < 0 ? 'rgba(192,57,43,' : 'rgba(39,97,61,') + a + ')';
}
function rvMaxAbs(lista, k) {
  return lista.reduce(function (m, x) { return rvOk(x[k]) ? Math.max(m, Math.abs(x[k])) : m; }, 0);
}
function rvPunto(bueno) { return '<span style="color:' + (bueno ? RV_VERDE : RV_ROJO) + '">●</span> '; }
/* índices del mejor y del peor $/cab de una lista (si hay al menos dos) */
function rvMejorPeor(lista, k) {
  k = k || 'resultado_cab';
  var b = -1, w = -1;
  lista.forEach(function (x, i) {
    if (!rvOk(x[k])) return;
    if (b < 0 || x[k] > lista[b][k]) b = i;
    if (w < 0 || x[k] < lista[w][k]) w = i;
  });
  return lista.length >= 2 ? { mejor: b, peor: w } : { mejor: -1, peor: -1 };
}

/* Chip de categoría con su color (venta: RV_CAT_VENTA_COLOR; fina: la paleta
   del 07) al 15 % de fondo. */
function rvCatColor(cat) {
  return RV_CAT_VENTA_COLOR[cat] || ((typeof REM_CAT_COLOR !== 'undefined' && REM_CAT_COLOR[cat]) || '#8a827a');
}
function rvCatChip(cat, txt) {
  var c = rvCatColor(cat);
  return '<span style="display:inline-block;padding:0 5px;margin:1px 0;border-radius:2px;background:' + c + '26;'
    + 'color:' + c + ';font-weight:600;white-space:nowrap">' + (txt || cat) + '</span>';
}
/* "Vaca 96 · Vaquillona 2" → un chip por categoría */
function rvCatsChips(s) {
  return String(s || '').split(' · ').map(function (p) {
    return rvCatChip(p.replace(/\s+\d+$/, ''), p);
  }).join(' ');
}
/* Mix de categorías finas por cabezas: [[cat, cab], …] de mayor a menor */
function rvMixArr(o) {
  return Object.keys(o || {}).map(function (k) { return [k, o[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; });
}
function rvMixTexto(m) {
  if (!m || !m.length) return '—';
  return m.slice(0, 3).map(function (x) { return x[0] + ' ' + _remN(x[1]); }).join(' · ')
    + (m.length > 3 ? ' +' + (m.length - 3) : '');
}
function rvMixChips(m) {
  if (!m || !m.length) return '—';
  return m.slice(0, 3).map(function (x) { return rvCatChip(x[0], x[0] + ' ' + _remN(x[1])); }).join(' ')
    + (m.length > 3 ? ' <span style="color:#8a827a">+' + (m.length - 3) + '</span>' : '');
}
/* Barra de volumen detrás del número de cabezas (como en el 07). */
function rvBarra(n, max, txt) {
  var p = max ? Math.max(2, Math.round(n / max * 100)) : 0;
  return '<div style="position:relative;min-width:46px"><div style="position:absolute;right:0;top:1px;bottom:1px;'
    + 'width:' + p + '%;background:rgba(184,146,42,.24);border-radius:1px"></div>'
    + '<span style="position:relative">' + txt + '</span></div>';
}
/* Celda con estilo propio: rvTablaX y la tabla del PDF aceptan {v, st}. */
function rvCelda(v, st) { return { v: v, st: st || '' }; }
function rvNombreNivel() {
  return { proveedor: 'Vendedor', tipo: 'Vendedor · tipo', localidad: 'Localidad' }[_rvOrigenNivel] || 'Vendedor';
}
function rvTituloNivel() {
  return { proveedor: 'por vendedor', tipo: 'por vendedor y tipo', localidad: 'por localidad' }[_rvOrigenNivel] || 'por vendedor';
}

/* ── lecturas rápidas (mismos agregados que las tablas) ── */
var RV_LECT = {
  tarjetas: function (T) {
    if (!T || !rvOk(T.resultado)) return '';
    return 'Se vendieron <b>' + _remN(T.cabezas) + ' cabezas</b> (' + _remN(T.kg_carne) + ' kg de carne) por <b>'
      + _remM(T.venta_neta) + '</b> netos. A costo histórico el negocio dejó <b>' + rvSem(T.resultado, _remM(T.resultado))
      + '</b> (' + _remN(T.resultado_pct, 1) + ' % sobre el costo, ' + _remM(T.resultado_cab) + ' por cabeza)'
      + (rvOk(T.resultado_repo) ? '; a precio de reposición, <b>' + rvSem(T.resultado_repo, _remM(T.resultado_repo)) + '</b>' : '')
      + '.';
  },
  puente: function (T) {
    if (!T || !T.bruta) return '';
    var p = function (x) { return x / T.bruta * 100; };
    var f = function (x) { return (x < 0 ? '−' : '') + '$ ' + _remN(Math.abs(x), 1); };
    return 'De cada <b>$ 100</b> de venta bruta, <b>' + f(p(T.compra + T.comision + T.gastos_compra)) + '</b> fueron la '
      + 'compra de la hacienda, <b>' + f(p(T.alimento + T.estructura + T.sanidad + T.mortandad)) + '</b> el feedlot y <b>'
      + f(p(T.gastos_venta)) + '</b> gastos de venta; quedaron <b>' + rvSem(T.resultado, f(p(T.resultado))) + '</b>.';
  },
  categoria: function (cats) {
    var c = cats.filter(function (x) { return x.cabezas > 0 && rvOk(x.resultado_cab); });
    if (!c.length) return '';
    var m = rvMejorPeor(c);
    var b = c[m.mejor >= 0 ? m.mejor : 0];
    var s = 'La categoría que más dejó por cabeza fue <b>' + b.clave + '</b> (' + rvSem(b.resultado_cab, _remM(b.resultado_cab))
      + '/cab, ' + _remN(b.cabezas) + ' cab)';
    if (m.peor >= 0 && m.peor !== m.mejor) {
      var w = c[m.peor];
      s += '; la que menos, <b>' + w.clave + '</b> (' + rvSem(w.resultado_cab, _remM(w.resultado_cab)) + '/cab)';
    }
    return s + '.';
  },
  destino: function (celdas) {
    var c = celdas.filter(function (x) { return x.clave.slice(-6) !== '|otras'; });
    if (!c.length) return '';
    var bp = c.reduce(function (a, x) { return (rvOk(x.precio_kg_carne) && (!a || x.precio_kg_carne > a.precio_kg_carne)) ? x : a; }, null);
    var br = c.reduce(function (a, x) { return (rvOk(x.rinde) && (!a || x.rinde > a.rinde)) ? x : a; }, null);
    var s = [];
    if (bp) s.push('el mejor precio por kg de carne lo pagó <b>' + bp.clave.split('|')[0] + '</b> ($ '
      + _remN(bp.precio_kg_carne) + '/kg en ' + bp.clave.split('|')[1] + ')');
    if (br) s.push('el mejor rinde lo dio <b>' + br.clave.split('|')[0] + '</b> (' + _remN(br.rinde, 1) + ' % en '
      + br.clave.split('|')[1] + ')');
    if (!s.length) return '';
    var t = s.join('; ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  },
  ventas: function (F) {
    if (!F || !F.length) return '';
    var rem = F.reduce(function (a, x) { return a + (x.remitos ? x.remitos.split('+').length : 0); }, 0);
    var neg = F.filter(function (x) { return x.res < 0; }).length;
    return F.length + ' venta' + (F.length === 1 ? '' : 's') + ' · ' + rem + ' remito' + (rem === 1 ? '' : 's')
      + ' · ' + (neg ? rvSem(-1, neg + ' con resultado negativo') : 'ninguna con resultado negativo') + '.';
  },
  sinliq: function (D) {
    if (!D) return '';
    if (!D.sin.length) return 'Todo lo vendido en el tramo está liquidado.';
    var v = D.sin.reduce(function (a, x) { return (!a || x.fecha < a) ? x.fecha : a; }, '');
    return '<b>' + D.sin.length + ' remito' + (D.sin.length === 1 ? '' : 's') + ' sin liquidar</b> (' + _remN(D.cab)
      + ' cab)' + (v ? ', el más viejo del ' + _remFec(v) : '') + '.';
  },
  tortas: function (G) {
    if (!G || !G.length) return '';
    var tc = G.reduce(function (a, g) { return a + (g.cabezas || 0); }, 0);
    var tk = G.reduce(function (a, g) { return a + (g.kg_carne || 0); }, 0);
    var g = G.reduce(function (a, x) { return (!a || x.cabezas > a.cabezas) ? x : a; }, null);
    if (!g || !tc) return '';
    return '<b>' + g.clave + '</b> fue el ' + _remN(g.cabezas / tc * 100, 1) + ' % de las cabezas'
      + (tk ? ' y el ' + _remN(g.kg_carne / tk * 100, 1) + ' % de la carne' : '') + '.';
  },
  origenes: function (ori) {
    var c = ori.filter(function (x) { return rvOk(x.resultado_cab); });
    if (!c.length) return '';
    var m = rvMejorPeor(c), b = c[m.mejor >= 0 ? m.mejor : 0];
    var vol = c.reduce(function (a, x) { return (!a || x.cabezas > a.cabezas) ? x : a; }, null);
    var s = 'El origen que más dejó por cabeza fue <b>' + b.clave + '</b> (' + rvSem(b.resultado_cab, _remM(b.resultado_cab))
      + '/cab, ' + _remN(b.cabezas) + ' cab)';
    if (vol) s += '; el de mayor volumen, <b>' + vol.clave + '</b> (' + _remN(vol.cabezas) + ' cab, '
      + rvSem(vol.resultado_cab, _remM(vol.resultado_cab)) + '/cab)';
    if (m.peor >= 0 && m.peor !== m.mejor) {
      var w = c[m.peor];
      s += '; el peor, <b>' + w.clave + '</b> (' + rvSem(w.resultado_cab, _remM(w.resultado_cab)) + '/cab)';
    }
    return s + '.';
  },
  oxc: function (oc) {
    var c = oc.filter(function (x) { return rvOk(x.resultado_cab); });
    if (!c.length) return '';
    var m = rvMejorPeor(c), b = c[m.mejor >= 0 ? m.mejor : 0];
    var n = function (x) { var p = x.clave.split('|'); return p[0] + ' · ' + p[1]; };
    var s = 'Mejor combinación: <b>' + n(b) + '</b> (' + rvSem(b.resultado_cab, _remM(b.resultado_cab)) + '/cab, '
      + _remN(b.cabezas) + ' cab)';
    if (m.peor >= 0 && m.peor !== m.mejor) {
      var w = c[m.peor];
      s += '. Peor: <b>' + n(w) + '</b> (' + rvSem(w.resultado_cab, _remM(w.resultado_cab)) + '/cab)';
    }
    return s + '.';
  }
};

/* columnas de orígenes y de vendedor × categoría después de las de nombre */
var RV_COLS_ORI_FIN = ['Cab', 'Tropas', 'Qué vendimos', 'Resultado', '% s/costo', '$/cab', 'Repos./cab', 'Rinde', 'ADP',
                       'Estadía', '$/kg compra', '$/kg prod'];
var RV_COLS_OXC_FIN = ['Categoría', 'Cab', 'Resultado', '% s/costo', '$/cab', 'Rinde', 'ADP', '$/kg compra'];

/* Tabla genérica: rows = [{c:[...], neg, sub, tot, sep}], las primeras `izq`
   columnas van a la izquierda. Una celda puede ser {v, st} (estilo propio:
   fondo graduado, white-space…). `sub` = subtotal, `tot` = TOTAL. */
function rvTablaX(cols, rows, izq) {
  izq = izq || 1;
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:#fff;'
    + 'border:1px solid var(--border);font-family:\'DM Mono\',monospace"><thead><tr>'
    + cols.map(function (c, i) {
        return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);'
          + 'padding:8px 7px;border-bottom:2px solid var(--border);text-align:' + (i < izq ? 'left' : 'right')
          + ';white-space:nowrap">' + c + '</th>';
      }).join('') + '</tr></thead><tbody>';
  rows.forEach(function (r) {
    if (r.sep) {
      h += '<tr><td colspan="' + cols.length + '" style="padding:3px 7px;font-size:11px;color:rgba(26,22,18,.4);'
        + 'border-bottom:1px solid #f0eee8;text-align:center">· · ·</td></tr>';
      return;
    }
    var bg = r.tot ? '#f6f5f2' : r.sub ? '#f9f8f5' : (r.neg ? '#fdf6f4' : '');
    var td = 'padding:6px 7px;border-bottom:1px solid #f0eee8;font-size:12px;white-space:nowrap;vertical-align:top'
      + ((r.tot || r.sub) ? ';font-weight:600' : '') + (r.tot ? ';border-top:2px solid var(--border)' : '');
    h += '<tr' + (bg ? ' style="background:' + bg + '"' : '') + '>' + r.c.map(function (v, j) {
      var o = (v && typeof v === 'object') ? v : { v: v, st: '' };
      return '<td style="' + td + ';text-align:' + (j < izq ? 'left' : 'right') + (o.st ? ';' + o.st : '') + '">'
        + o.v + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</tbody></table></div>';
}
/* v15.81 · semáforo (verde gana, rojo pierde); antes sólo rojo */
function rvRojo(n, txt) { return rvSem(n, txt); }
/* Fila de categoría. `maxCab` = |$/cab| máximo de la tabla, para el fondo. */
function rvFilaCat(c, etiqueta, maxCab) {
  return [etiqueta, _remN(c.cabezas), _remN(c.kg_ing_cab), _remN(c.kg_egr_cab), _remN(c.kg_prod_cab),
          _remN(c.adp, 3), _remN(c.estadia), rvConv(c), _remN(c.rinde, 2) + ' %',
          '$ ' + _remN(c.precio_kg_carne), '$ ' + _remN(c.precio_pagado),
          rvSem(c.resultado, _remM(c.resultado)), rvSem(c.resultado_pct, _remN(c.resultado_pct, 1) + ' %'),
          rvCelda(rvSem(c.resultado_cab, _remM(c.resultado_cab)), maxCab ? rvGrad(c.resultado_cab, maxCab) : ''),
          rvSem(c.resultado_repo, _remM(c.resultado_repo))];
}
/* Filas de una tabla de categoría (venta o fina) + TOTAL, con chips, punto
   del mejor y del peor $/cab y fondo graduado. La usan pantalla y PDF. */
function rvFilasCategoria(cats, TA) {
  var max = rvMaxAbs(cats, 'resultado_cab'), mp = rvMejorPeor(cats);
  var rows = cats.map(function (c, i) {
    var et = (i === mp.mejor ? rvPunto(true) : i === mp.peor ? rvPunto(false) : '') + rvCatChip(c.clave);
    return { c: rvFilaCat(c, et, max), neg: c.resultado < 0 };
  });
  rows.push({ c: rvFilaCat(TA, '<strong>TOTAL</strong>', 0), tot: true });
  return rows;
}
function rvSecTarjetas(S, TA, TB, A, kpi) {
  var fondo = function (n) { return n < 0 ? '#7a1f16' : '#1f4d31'; };
  var gold = function (t) { return '<span style="color:' + RV_GOLD + '">' + t + '</span>'; };
  var h = '<div style="' + S.H2 + ';font-size:17px">Resumen del tramo</div>'
    + rvIntro('tarjetas', RV_LECT.tarjetas(TA), false, rvRacionFrase(A))
    + '<div style="' + rvGrid4() + '">'
    + kpi('Resultado histórico', _remM(TA.resultado),
          _remN(TA.resultado_pct, 1) + ' % s/costo · ' + _remM(TA.resultado_cab) + '/cab',
          TB ? _remM(TB.resultado) : null, TB ? rvDelta(TA.resultado, TB.resultado) : '', fondo(TA.resultado))
    + kpi('Resultado c/ reposición', _remM(TA.resultado_repo),
          _remN(TA.resultado_repo_pct, 1) + ' % s/costo repos. · ' + _remM(TA.resultado_repo_cab) + '/cab'
          + (TA.sin_repo ? '<br>' + _remN(TA.sin_repo) + ' cab sin precio de reposición' : ''),
          TB ? _remM(TB.resultado_repo) : null, TB ? rvDelta(TA.resultado_repo, TB.resultado_repo) : '',
          fondo(TA.resultado_repo))
    + kpi('Venta neta', _remM(TA.venta_neta),
          TA.ventas + ' venta' + (TA.ventas === 1 ? '' : 's') + ' · ' + _remN(TA.cabezas) + ' cab · bruta '
          + _remM(TA.bruta),
          TB ? _remM(TB.venta_neta) : null, TB ? rvDelta(TA.venta_neta, TB.venta_neta) : '')
    + kpi('Costo total', _remM(TA.costo), '$ ' + _remN(TA.kg_egreso ? TA.costo / TA.kg_egreso : null) + '/kg vivo',
          TB ? _remM(TB.costo) : null, TB ? rvDelta(TA.costo, TB.costo) : '')
    + '</div><div style="' + rvGrid4() + '">'
    + kpi('Kg carne vendidos', gold(_remN(TA.kg_carne) + ' kg'), 'rinde ' + _remN(TA.rinde, 2) + ' %',
          TB ? _remN(TB.kg_carne) + ' kg' : null, TB ? rvDelta(TA.rinde, TB.rinde, 'pp') : '')
    + kpi('Cargado', gold(_remN(TA.cabezas) + ' cab'),
          _remN(TA.kg_egreso) + ' kg vivo salida · ' + _remN(TA.kg_ingreso) + ' kg vivo ingreso',
          TB ? _remN(TB.cabezas) + ' cab' : null, TB ? rvDelta(TA.cabezas, TB.cabezas, 'n') : '')
    + kpi('Precio kg carne', '$ ' + _remN(TA.precio_kg_carne, 2),
          'bruto de planta · $ ' + _remN(TA.precio_kg_vivo) + '/kg vivo neto',
          TB ? '$ ' + _remN(TB.precio_kg_carne, 2) : null,
          TB ? rvDelta(TA.precio_kg_carne, TB.precio_kg_carne, 'kg') : '')
    + kpi('Engorde', _remN(TA.kg_producidos) + ' kg prod.',
          'ADP ' + _remN(TA.adp, 3) + ' · ' + _remN(TA.estadia) + ' d · conv. ' + rvConv(TA),
          TB ? _remN(TB.kg_producidos) + ' kg' : null, TB ? rvDelta(TA.adp, TB.adp, 'adp') : '')
    + '</div>';
  // Las tarjetas son por tropa. Si la suma de lo guardado en cada venta da
  // otra cosa (snapshots viejos), se dice — sólo cuando la comparación tiene
  // sentido: sin chips de fila y con tramo por egreso.
  if (!_rvHot && !_rvCat && A.base !== 'ingreso') {
    var sh = 0, sr = 0;
    rvVentasTramo(A).forEach(function (x) {
      sh += ((x.v.resultado || {}).monto) || 0;
      if (x.v.reposicion) sr += x.v.reposicion.resultado || 0;
    });
    var dh = TA.resultado - sh;
    if (Math.abs(dh) >= 1) {
      h += '<div style="' + S.SUB + ';margin:-4px 0 6px">Las tarjetas se calculan por tropa. La suma de lo '
        + 'guardado en cada venta da ' + _remM(sh) + ' (hist.) y ' + _remM(sr) + ' (repos.): la diferencia, '
        + _remM(dh) + ', viene de snapshots guardados con versiones viejas del 07.</div>';
    }
  }
  return h;
}
function rvSecPuente(S, TA) {
  return '<div style="' + S.H2 + ';font-size:17px">Puente de costos</div>'
    + rvIntro('puente', RV_LECT.puente(TA))
    + '<div style="' + S.SUB + ';margin:0 0 8px">Unidad '
    + [['total', '$ total'], ['kg', '$/kg carne'], ['cab', '$/cab']].map(function (o) {
        return rvChip(o[1], _rvPuenteU === o[0], 'rvFiltro(\'puente_u\',\'' + o[0] + '\')'); }).join('')
    + '</div>'
    + '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:14px;height:340px;'
    + 'margin-bottom:6px"><canvas id="rvChartPuente"></canvas></div>'
    + '<div style="' + S.SUB + ';margin:0 0 6px;line-height:1.7">' + rvPuenteTexto(TA, _rvPuenteU) + '</div>';
}
function rvSecCategoria(S, dA, dB, TA, TB) {
  var catsA = rvAgg(dA.rows, function (r) { return rvCatV(r.f.categoria); }).sort(rvOrdCatV);
  var h = '<div style="' + S.H2 + ';font-size:17px">Por categoría de venta' + rvBtnCSV('cat') + '</div>'
    + rvIntro('categoria', RV_LECT.categoria(catsA));
  if (TB) {
    var bCat = {};
    rvAgg(dB.rows, function (r) { return rvCatV(r.f.categoria); }).forEach(function (c) { bCat[c.clave] = c; });
    h += rvTabla(['Cat. de venta', 'Cab A', 'Cab B', 'Resultado A', 'Resultado B', '% A', '% B', 'Δ pp'],
      catsA.map(function (c) {
        var b = bCat[c.clave];
        return [rvCatChip(c.clave), _remN(c.cabezas), b ? _remN(b.cabezas) : '—',
                rvSem(c.resultado, _remM(c.resultado)), b ? rvSem(b.resultado, _remM(b.resultado)) : '—',
                rvSem(c.resultado_pct, _remN(c.resultado_pct, 1) + ' %'),
                b ? rvSem(b.resultado_pct, _remN(b.resultado_pct, 1) + ' %') : '—',
                b ? rvDelta(c.resultado_pct, b.resultado_pct, 'pp') : '—'];
      }), catsA.map(function (c) { return c.resultado < 0; }));
    h += '<div style="' + S.SUB + ';margin:8px 0 6px">Detalle del tramo A:</div>';
  }
  h += rvTablaX(['Cat. de venta'].concat(RV_COLS_CAT.slice(1)), rvFilasCategoria(catsA, TA), 1);
  h += '<div style="' + S.SUB + ';margin:5px 0 0">● verde: la que más dejó por cabeza · ● rojo: la que menos. '
    + '<a onclick="rvToggleCatDet()" style="cursor:pointer;color:var(--gold);text-decoration:underline">'
    + (_rvCatDet ? 'ocultar detalle por categoría' : 'ver detalle por categoría (vaca, novillito, ternero…)') + '</a>'
    + (TA.kg_ms_est ? '<br>* conversión con kg de MS estimados: el consumo de la venta prorrateado por el costo '
        + 'de alimento de cada tropa (los snapshots anteriores a v15.79.1 no guardaban el consumo por tropa).' : '')
    + '</div>';
  if (_rvCatDet) {
    var fina = rvAgg(dA.rows, function (r) { return r.f.categoria; })
      .sort(function (a, b) { return b.cabezas - a.cabezas; });
    h += '<div style="margin-top:8px">' + rvTablaX(RV_COLS_CAT, rvFilasCategoria(fina, TA), 1) + '</div>';
  }
  return h;
}
/* Filas de destino × categoría (pantalla y PDF): subtotal por destino y sus
   categorías debajo, con chips, punto del mejor/peor $/cab y fondo graduado. */
function rvFilasDestino(D) {
  var todas = D.celdas.filter(function (c) { return c.clave.slice(-6) !== '|otras'; });
  var max = rvMaxAbs(D.celdas.concat(D.dest), 'resultado_cab'), mp = rvMejorPeor(todas);
  var mejor = mp.mejor >= 0 ? todas[mp.mejor].clave : null, peor = mp.peor >= 0 ? todas[mp.peor].clave : null;
  var fila = function (x, d, cat) {
    return [d, cat, _remN(x.cabezas), _remN(x.kg_egr_cab), _remN(x.rinde, 2) + ' %', '$ ' + _remN(x.precio_kg_carne),
            _remN(x.estadia), rvConv(x), rvSem(x.resultado, _remM(x.resultado)),
            rvCelda(rvSem(x.resultado_cab, _remM(x.resultado_cab)), rvGrad(x.resultado_cab, max))];
  };
  var rows = [];
  D.dest.forEach(function (d) {
    rows.push({ c: fila(d, rvCorta(d.clave, 30), 'todas'), sub: true });
    D.celdas.filter(function (c) { return c.clave.split('|')[0] === d.clave; }).sort(rvOrdDestCelda)
      .forEach(function (c) {
        var cat = c.clave.split('|')[1];
        var pre = c.clave === mejor ? rvPunto(true) : c.clave === peor ? rvPunto(false) : '';
        rows.push({ c: fila(c, '', pre + (cat === 'otras' ? 'otras' : rvCatChip(cat))), neg: c.resultado < 0 });
      });
  });
  return rows;
}
function rvSecDestino(S, dA) {
  var D = rvDestinoFilas(dA.rows);
  return '<div style="' + S.H2 + ';font-size:17px">Por destino y categoría de venta' + rvBtnCSV('destino') + '</div>'
    + rvIntro('destino', RV_LECT.destino(D.celdas))
    + '<div style="' + S.SUB + ';margin:0 0 8px">Categorías con menos de ' + rvMinCab()
    + ' cabezas en un destino se juntan en «otras».</div>'
    + rvTablaX(['Destino', 'Cat. de venta', 'Cab', 'Kg sal/cab', 'Rinde', '$/kg carne', 'Estadía', 'Conversión',
                'Resultado', '$/cab'], rvFilasDestino(D), 2);
}
function rvSecTortas(S, rows) {
  var caja = 'background:#fff;border:1px solid var(--border);border-radius:2px;padding:12px;height:220px';
  return '<div style="' + S.H2 + ';font-size:17px">Categorías vendidas</div>'
    + rvIntro('tortas', RV_LECT.tortas(rvCatsTorta(rows || [])))
    + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:6px">'
    + '<div><div style="' + S.LBL + '">% por cabezas</div><div style="' + caja + '"><canvas id="rvChartCatCab"></canvas></div></div>'
    + '<div><div style="' + S.LBL + '">% por kg carne</div><div style="' + caja + '"><canvas id="rvChartCatKg"></canvas></div></div>'
    + '</div>';
}
/* Filas de orígenes y de vendedor × categoría (pantalla y PDF). El mejor y el
   peor se marcan sobre la lista ENTERA de elegibles, aunque se muestre el top
   10 y los últimos 5 o el orden sea otro. */
function rvFilasOrigen(ori, X) {
  var maxCab = rvMaxAbs(ori, 'resultado_cab'), maxN = ori.reduce(function (m, o) { return Math.max(m, o.cabezas); }, 0);
  var mp = rvMejorPeor(ori), mejor = mp.mejor >= 0 ? ori[mp.mejor].clave : null, peor = mp.peor >= 0 ? ori[mp.peor].clave : null;
  return rvTopBottom(ori, function (o) {
    var pre = o.clave === mejor ? rvPunto(true) : o.clave === peor ? rvPunto(false) : '';
    return { neg: o.resultado < 0, c: [pre + rvCorta(o.clave, 34), X[1](o), rvBarra(o.cabezas, maxN, _remN(o.cabezas)),
      o.n_tropas, rvCelda(rvMixChips(o.mix), 'white-space:normal;min-width:150px;text-align:left'),
      rvSem(o.resultado, _remM(o.resultado)), rvSem(o.resultado_pct, _remN(o.resultado_pct, 1) + ' %'),
      rvCelda(rvSem(o.resultado_cab, _remM(o.resultado_cab)), rvGrad(o.resultado_cab, maxCab)),
      rvSem(o.resultado_repo_cab, _remM(o.resultado_repo_cab)),
      _remN(o.rinde, 2) + ' %', _remN(o.adp, 3), _remN(o.estadia), '$ ' + _remN(o.precio_pagado),
      _remM(o.costo_kg_prod)] };
  });
}
function rvFilasOxc(oc) {
  var maxCab = rvMaxAbs(oc, 'resultado_cab'), maxN = oc.reduce(function (m, o) { return Math.max(m, o.cabezas); }, 0);
  var mp = rvMejorPeor(oc), mejor = mp.mejor >= 0 ? oc[mp.mejor].clave : null, peor = mp.peor >= 0 ? oc[mp.peor].clave : null;
  return rvTopBottom(oc, function (o) {
    var p = o.clave.split('|');
    var pre = o.clave === mejor ? rvPunto(true) : o.clave === peor ? rvPunto(false) : '';
    return { neg: o.resultado < 0, c: [pre + rvCorta(p[0], 34), rvCatChip(p[1]), rvBarra(o.cabezas, maxN, _remN(o.cabezas)),
      rvSem(o.resultado, _remM(o.resultado)), rvSem(o.resultado_pct, _remN(o.resultado_pct, 1) + ' %'),
      rvCelda(rvSem(o.resultado_cab, _remM(o.resultado_cab)), rvGrad(o.resultado_cab, maxCab)),
      _remN(o.rinde, 2) + ' %', _remN(o.adp, 3), '$ ' + _remN(o.precio_pagado)] };
  });
}
function rvSecOrigenes(S, dA) {
  var h = '<div style="' + S.H2 + ';font-size:17px">Orígenes del ingreso · ' + rvTituloNivel()
    + ' <span style="font-size:13px;font-weight:400">(' + RV_MIN_CAB_ORIGEN + ' cabezas o más)</span>'
    + (rvTieneOrigen() ? rvBtnCSV('origen_cat') + rvBtnCSV('origen') : '') + '</div>';
  if (!rvTieneOrigen()) {
    return h + rvIntro('origenes', '') + '<div style="' + S.SUB + '">El origen del ingreso lo agrega el pipeline '
      + 'desde v15.79: aparece cuando se publique el próximo resultados_ventas.json.</div>';
  }
  var mo = ((_rvHist || {}).meta || {}).origenes || {};
  var O = rvOrigenes(dA.rows), X = rvOriExtra();
  h += rvIntro('origenes', RV_LECT.origenes(O.ori))
    + '<div style="' + S.SUB + ';margin:0 0 8px">'
    + (mo.n_filas ? mo.n_cruzadas + ' de ' + mo.n_filas + ' filas cruzadas con su ingreso · ' : '')
    + 'Alias en <code>datos\\origenes_alias.json</code>.'
    + '<br>Agrupar por ' + [['proveedor', 'vendedor'], ['tipo', 'vendedor + tipo'], ['localidad', 'localidad']]
        .map(function (o) { return rvChip(o[1], _rvOrigenNivel === o[0], 'rvFiltro(\'ori_nivel\',\'' + o[0] + '\')'); }).join('')
    + ' · ordenar por ' + [['cab', '$/cab'], ['resultado', 'resultado $'], ['pct', '% s/costo'], ['rinde', 'rinde'],
        ['adp', 'ADP'], ['cabezas', 'cabezas']].map(function (o) {
          return rvChip(o[1], _rvOrdenOri === o[0], 'rvFiltro(\'orden_ori\',\'' + o[0] + '\')'); }).join('')
    + ' · ' + O.ori.length + ' con ' + RV_MIN_CAB_ORIGEN + ' cabezas o más'
    + (O.ori.length > 15 ? ' (top 10 y últimos 5)' : '') + '.</div>';
  h += rvTablaX([rvNombreNivel(), X[0]].concat(RV_COLS_ORI_FIN), rvFilasOrigen(O.ori, X), 2);
  h += '<div style="' + S.H2 + ';font-size:15px;margin-top:18px">' + rvNombreNivel() + ' × categoría</div>'
    + rvIntro('oxc', RV_LECT.oxc(O.oc));
  h += rvTablaX([rvNombreNivel()].concat(RV_COLS_OXC_FIN), rvFilasOxc(O.oc), 2);
  return h;
}
function rvTablaVentas(S, lista) {
  var F = lista.map(function (x) { var f = rvVentaFila(x.v); f.porIngreso = x.porIngreso; return f; });
  var T = rvVentasTotal(F);
  var cols = ['Fecha', 'Remito(s)', 'Comprador', 'Propietario', 'Categoría', 'Cab', 'Kg vivo',
              'Kg carne', 'Rinde', '$/kg carne', 'Venta neta', 'Resultado hist.', 'Resultado c/ repos.'];
  var izq = 5;   // las primeras 5 columnas son texto
  var sub = function (t) { return '<div style="' + S.UNI + ';margin-top:1px">' + t + '</div>'; };
  var corta = function (s, n) {
    s = String(s || '');
    return s.length > n ? '<span title="' + s.replace(/"/g, '&quot;') + '">' + s.slice(0, n - 1) + '…</span>' : s;
  };
  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:#fff;'
    + 'border:1px solid var(--border);font-family:\'DM Mono\',monospace"><thead><tr>'
    + cols.map(function (c, i) {
        return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);'
          + 'padding:8px 6px;border-bottom:2px solid var(--border);text-align:' + (i < izq ? 'left' : 'right')
          + ';white-space:nowrap">' + c + '</th>';
      }).join('') + '</tr></thead><tbody>';
  var td = 'padding:6px 6px;border-bottom:1px solid #f0eee8;font-size:12px;vertical-align:top';
  var celdas = function (x, total) {
    var repoSub = x.repo == null ? ''
      : total ? (x.repo_pct != null ? _remN(x.repo_pct, 2) + ' % s/costo' : '')
      : '$ ' + _rvNd(x.repo_precio, 2) + '/kg · ' + (x.repo_manual ? 'manual' : 'auto');
    return [
      total ? '<strong>TOTAL</strong>'
            : _remFec(x.fecha) + (x.porIngreso ? ' <span title="entra por fecha de ingreso de alguna de sus '
              + 'tropas" style="cursor:help">·</span>' : ''),
      total ? x.n_remitos + ' remitos'
            : x.remitos + (x.es_grupo ? ' <span style="font-size:9.5px;padding:0 4px;border:1px solid #e3e1da;'
              + 'border-radius:2px;color:rgba(26,22,18,.55)">grupo</span>' : ''),
      total ? '' : corta(x.comprador, 22),
      total ? '' : x.propietario,
      total ? '' : rvCatsChips(x.categorias),
      _remN(x.cabezas), _remN(x.kg_vivo), _rvNd(x.kg_carne, 1),
      _remN(x.rinde, 2) + ' %', '$ ' + _rvNd(x.precio_kg, 2), _remM(x.neta),
      rvSem(x.res, _remM(x.res)) + sub(rvSem(x.res_pct, _remN(x.res_pct, 2) + ' %') + ' s/costo'),
      x.repo == null ? '—' : rvSem(x.repo, _remM(x.repo)) + sub(repoSub)
    ];
  };
  F.forEach(function (x) {
    h += '<tr' + (x.res < 0 ? ' style="background:#fdf6f4"' : '') + '>'
      + celdas(x, false).map(function (c, j) {
          return '<td style="' + td + ';text-align:' + (j < izq ? 'left' : 'right')
            + (j === 3 || j === 4 ? ';white-space:normal;min-width:96px' : ';white-space:nowrap') + '">' + c + '</td>';
        }).join('') + '</tr>';
  });
  h += '<tr style="background:#f6f5f2">' + celdas(T, true).map(function (c, j) {
      return '<td style="' + td + ';font-weight:600;border-top:2px solid var(--border);white-space:nowrap;text-align:'
        + (j < izq ? 'left' : 'right') + '">' + c + '</td>';
    }).join('') + '</tr>';
  h += '</tbody></table></div>';
  var ult = F.length ? F.reduce(function (a, x) { return x.fecha > a ? x.fecha : a; }, '') : '';
  h += '<div style="' + S.SUB + ';margin:6px 0 4px">' + F.length + ' venta' + (F.length === 1 ? '' : 's')
    + ' · ' + T.n_remitos + ' remito' + (T.n_remitos === 1 ? '' : 's')
    + (ult ? ' · última ' + _remFec(ult) : '')
    + (T.n_repo < F.length ? ' · ' + (F.length - T.n_repo) + ' sin reposición guardada' : '') + '</div>';
  return h;
}
function rvSeccionSinLiquidar(S, A) {
  var csv = '<button onclick="rvCSV(\'sin_liquidar\')" style="float:right;padding:4px 11px;background:#faf8f4;'
    + 'border:1px solid #d8d6ce;border-radius:2px;font-family:\'DM Mono\',monospace;font-size:11px;'
    + 'cursor:pointer">&#11015; CSV</button>';
  var h = '<div style="' + S.H2 + ';font-size:17px">Sin liquidar' + (_rvIdxEstado === 'ok' ? csv : '') + '</div>';
  if (_rvIdxEstado === 'cargando' || _rvIdxEstado === '') {
    return h + rvIntro('sinliq', '') + '<div style="' + S.SUB + '">Leyendo el índice de remitos…</div>';
  }
  var D = rvSinLiquidar(A);
  if (!D) return h + rvIntro('sinliq', '') + '<div style="' + S.SUB + ';color:#a3311f">No se pudo leer el índice de remitos.</div>';
  h += rvIntro('sinliq', RV_LECT.sinliq(D));
  h += '<div style="' + S.SUB + ';margin:0 0 8px">Remitos de venta del índice del 07 que no están en '
    + 'ninguna venta guardada, por fecha de egreso'
    + (_rvComp ? ' · comprador ' + _rvComp : '')
    + ((_rvHot || _rvCat) ? ' · <span style="color:#a3311f">los chips de hotelero y categoría no aplican '
        + 'acá: el índice no trae las filas</span>' : '') + '.</div>';
  if (!D.sin.length) {
    h += '<div style="' + S.CARD + ';margin-bottom:8px">Todo lo vendido en el tramo está liquidado.</div>';
  } else {
    h += '<div style="' + S.CARD + ';margin-bottom:8px"><strong>' + D.sin.length + ' remito'
      + (D.sin.length === 1 ? '' : 's') + ' sin liquidar</strong> · ' + _remN(D.cab) + ' cab · '
      + _remN(D.kg) + ' kg vivo · desde ' + _remFec(D.desde) + '</div>';
    h += rvTablaSinLiq(D.sin, true);
  }
  if (D.feria.length) {
    h += '<div style="' + S.SUB + ';margin:6px 0">+ ' + D.feria.length + ' traslado'
      + (D.feria.length === 1 ? '' : 's') + ' a feria (no se liquidan acá) '
      + rvChip(_rvFeriaVer ? 'ocultar' : 'mostrar', _rvFeriaVer, 'rvFeriaToggle()') + '</div>';
    if (_rvFeriaVer) h += rvTablaSinLiq(D.feria, false);
  }
  return h;
}
/* v15.78 · secciones del PDF. La de ventas tiene 13 columnas: el informe va en
   A4 APAISADO; comprador, propietario y categoría se parten en renglones.
   v15.81 · todo negativo en rojo (clase `neg`), positivos en verde, fila rosa
   si la venta perdió, chips de categoría y caja de presentación. */
function rvPdfVentas(A, conB) {
  var F = rvVentasTramo(A).map(function (x) { return rvVentaFila(x.v); });
  var h = '<div class="sec">Ventas liquidadas' + (conB ? ' · tramo A' : '') + '</div>'
    + rvIntro('ventas', RV_LECT.ventas(F), true);
  if (!F.length) return h + '<div class="s">Ninguna venta en el tramo con esos filtros.</div>';
  var T = rvVentasTotal(F);
  var c = function (x, total) {
    return [total ? '<b>TOTAL</b>' : _remFec(x.fecha), total ? x.n_remitos + ' rem.' : x.remitos,
            total ? '' : x.comprador, total ? '' : x.propietario, total ? '' : rvCatsChips(x.categorias),
            _remN(x.cabezas), _remN(x.kg_vivo), _rvNd(x.kg_carne, 1), _remN(x.rinde, 2) + ' %',
            '$ ' + _rvNd(x.precio_kg, 2), _remM(x.neta),
            rvSem(x.res, _remM(x.res)) + '<br><span class="u">' + rvSem(x.res_pct, _remN(x.res_pct, 2) + ' %') + '</span>',
            x.repo == null ? '—' : rvSem(x.repo, _remM(x.repo)) + '<br><span class="u">'
              + (total ? (x.repo_pct != null ? rvSem(x.repo_pct, _remN(x.repo_pct, 2) + ' %') : '')
                       : '$ ' + _rvNd(x.repo_precio, 2) + ' · ' + (x.repo_manual ? 'man.' : 'auto')) + '</span>'];
  };
  var fila = function (x, total) {
    return '<tr' + (total ? ' class="tot"' : (x.res < 0 ? ' class="rneg"' : '')) + '>'
      + c(x, total).map(function (v, j) {
        return '<td style="text-align:' + (j < 5 ? 'left' : 'right') + (j >= 2 && j <= 4 ? ';white-space:normal' : '')
          + '">' + v + '</td>'; }).join('') + '</tr>';
  };
  return h + '<table class="tv"><thead><tr>' + ['Fecha', 'Remito(s)', 'Comprador', 'Propietario', 'Categoría',
      'Cab', 'Kg vivo', 'Kg carne', 'Rinde', '$/kg carne', 'Venta neta', 'Result. hist.', 'Result. repos.']
      .map(function (t, j) { return '<th style="text-align:' + (j < 5 ? 'left' : 'right') + '">' + t + '</th>'; }).join('')
    + '</tr></thead><tbody>' + F.map(function (x) { return fila(x, false); }).join('') + fila(T, true)
    + '</tbody></table>';
}
function rvPdfSinLiquidar(A) {
  var h = '<div class="sec">Sin liquidar</div>';
  var D = rvSinLiquidar(A);
  if (!D) return h + rvIntro('sinliq', '', true) + '<div class="s">No se pudo leer el índice de remitos.</div>';
  h += rvIntro('sinliq', RV_LECT.sinliq(D), true);
  if (D.sin.length) {
    h += '<div class="s">' + D.sin.length + ' remito(s) sin liquidar · ' + _remN(D.cab) + ' cab · '
      + _remN(D.kg) + ' kg vivo · desde ' + _remFec(D.desde) + (_rvComp ? ' · comprador ' + _rvComp : '') + '</div>'
      + '<table><thead><tr><th>Fecha</th><th style="text-align:left">Remito</th><th style="text-align:left">Comprador</th>'
      + '<th>Cab</th><th>Kg vivo</th><th>Cobertura</th></tr></thead><tbody>'
      + D.sin.map(function (x) {
          return '<tr><td>' + _remFec(x.fecha) + '</td><td>' + x.nro + '</td><td>' + x.comprador + '</td>'
            + '<td style="text-align:right">' + _remN(x.cabezas) + '</td><td style="text-align:right">'
            + _remN(x.kg_vivo) + '</td><td style="text-align:right">'
            + (x.cobertura != null && x.cobertura < 70 ? '<span style="color:' + RV_ROJO + '">' + _remN(x.cobertura, 1) + ' %</span>'
               : _remN(x.cobertura, 1) + ' %') + '</td></tr>';
        }).join('') + '</tbody></table>';
  }
  if (D.feria.length) h += '<div class="s" style="margin-top:4px">+ ' + D.feria.length
    + ' traslado(s) a feria, que no se liquidan en el 07.</div>';
  return h;
}
function rvInformePDF() {
  var A = rvTramoA(), B = _rvCmp ? rvTramoB() : null;
  var dA = rvFilas(A), dB = B ? rvFilas(B) : null;
  var TA = rvTotal(dA.rows), TB = dB ? rvTotal(dB.rows) : null;
  if (!TA) return;
  // mismo orden que la pantalla: resumen, puente, categoría, destino, ventas,
  // sin liquidar, tortas, orígenes; al final mes a mes y tropas. Cada sección
  // con su caja de presentación (v15.81).
  var cats = rvAgg(dA.rows, function (r) { return rvCatV(r.f.categoria); }).sort(rvOrdCatV);
  var catsFina = rvAgg(dA.rows, function (r) { return r.f.categoria; })
    .sort(function (a, b) { return b.cabezas - a.cabezas; });
  var bCat = {};
  if (dB) rvAgg(dB.rows, function (r) { return rvCatV(r.f.categoria); }).forEach(function (c) { bCat[c.clave] = c; });
  var minCab = rvMinCab();
  var tropas = rvAgg(dA.rows, function (r) { return r.f.tropa; })
    .filter(function (t) { return t.cabezas >= minCab; })
    .sort(function (a, b) { return b.resultado - a.resultado; });
  var meses = rvAgg(dA.rows, function (r) { return String(r.v.fecha_egreso || '').slice(0, 7); })
    .sort(function (a, b) { return a.clave < b.clave ? -1 : 1; });

  var titulo = 'Resultados acumulados · ' + A.nombre + ' (' + rvVentana(A) + ', por ' + A.base + ')';
  if (B) titulo = 'Resultados acumulados · ' + A.nombre + ' vs ' + B.nombre;
  var filtros = [A.nombre + ' ' + rvVentana(A) + ' · por ' + A.base];
  if (B) filtros.push('B: ' + B.nombre + ' ' + rvVentana(B) + ' · por ' + B.base);
  if (_rvHot) filtros.push('hotelero ' + _rvHot);
  if (_rvCat) filtros.push('categoría ' + _rvCat);
  if (_rvComp) filtros.push('comprador ' + _rvComp);

  var sinTags = function (s) {
    if (s && typeof s === 'object') return { v: sinTags(s.v), st: s.st };
    return String(s).replace(/<sup[^>]*>\*<\/sup>/g, '*');
  };
  // `al` = cuántas columnas van a la izquierda; las filas pueden traer
  // {sub|tot|neg|sep} y las celdas {v, st}
  var tabla = function (cols, filas, al) {
    al = al || 1;
    return '<table><thead><tr>' + cols.map(function (c, j) {
        return '<th style="text-align:' + (j < al ? 'left' : 'right') + '">' + c + '</th>'; }).join('')
      + '</tr></thead><tbody>' + filas.map(function (f) {
        if (f.sep) return '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#8a827a">· · ·</td></tr>';
        var c = f.c || f;
        return '<tr' + (f.tot ? ' class="tot"' : f.sub ? ' class="sub"' : f.neg ? ' class="rneg"' : '') + '>'
          + c.map(function (x, j) {
            var o = sinTags(x), oo = (o && typeof o === 'object') ? o : { v: o, st: '' };
            return '<td style="text-align:' + (j < al ? 'left' : 'right') + (oo.st ? ';' + oo.st : '') + '">' + oo.v + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  };
  var kc = function (l, v, u, fondo) {
    return '<div class="kc' + (fondo ? ' big' : '') + '"' + (fondo ? ' style="background:' + fondo + '"' : '') + '>'
      + '<div class="l">' + l + '</div><div class="v">' + v + '</div>'
      + '<div class="u">' + (u || '&nbsp;') + '</div></div>';
  };
  var fondo = function (n) { return n < 0 ? '#7a1f16' : '#1f4d31'; };
  var conv = function (x) { return x.conversion == null ? '—' : _remN(x.conversion, 1) + (x.kg_ms_est ? '*' : ''); };
  // en las tarjetas oscuras el rojo no se lee: el signo ya lo da el fondo, pero
  // el número queda marcado como negativo (clase neg en un tono claro)
  var semOsc = function (n, t) { return n < 0 ? '<span class="neg" style="color:#ffb3a8">' + t + '</span>' : t; };

  var imgPuente = rvChartPNG(rvPuenteCfg(TA, true, _rvPuenteU), 1000, 360);
  var G = rvCatsTorta(dA.rows);
  var imgCab = rvChartPNG(rvTortaCfg(G, 'cabezas', true), 340, 340);
  var imgKg = rvChartPNG(rvTortaCfg(G, 'kg_carne', true), 340, 340);
  var leyenda = function (campo, uni) {
    var tot = G.reduce(function (a, g) { return a + (g[campo] || 0); }, 0) || 1;
    return G.map(function (g, i) {
      return '<div><span style="display:inline-block;width:9px;height:9px;background:' + rvColCatV(g.clave, i)
        + ';margin-right:5px"></span>' + g.clave + ' · ' + _remN(g[campo] / tot * 100, 1) + ' % · '
        + _remN(g[campo]) + uni + '</div>';
    }).join('');
  };
  var D = rvDestinoFilas(dA.rows);

  var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resultados acumulados</title>'
    + '<style>@page{size:A4 landscape;margin:12mm}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font-family:Georgia,serif;color:#1a1612;font-size:11px}'
    + 'h1{font-size:19px;margin:0 0 2px}.s{font-size:10px;color:#6b6560;margin-bottom:8px}'
    + '.k{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:7px}'
    + '.kc{border:1px solid #e3e1da;padding:7px 10px;border-radius:2px}.kc.big{color:#d4a84b}'
    + '.kc.big .l,.kc.big .u{color:rgba(255,255,255,.7)}'
    + '.l{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#8a827a}'
    + '.v{font-size:15px;font-weight:700;margin-top:2px}.u{font-size:8.5px;color:#8a827a}.gold{color:#b8922a}'
    + '.sec{font-size:13px;font-weight:700;margin:13px 0 5px;padding-bottom:3px}'
    + '.sec:after{content:"";display:block;width:48px;border-bottom:2px solid #b8922a;margin-top:3px}'
    + '.intro{background:#faf8f4;border-left:3px solid #b8922a;padding:6px 10px;font-size:9.5px;line-height:1.5;'
    + 'margin:0 0 6px;color:#3a332c}.intro div+div{margin-top:3px}'
    + '.pb{break-before:page}.neg{color:#c0392b}.pos{color:#27613d}'
    + 'table{width:100%;border-collapse:collapse;font-size:9.5px}'
    + 'th{text-align:right;font-size:8px;text-transform:uppercase;color:#8a827a;border-bottom:1px solid #e3e1da;padding:3px 4px}'
    + 'th:first-child{text-align:left}td{padding:3px 4px;border-bottom:1px solid #f2f0ea;vertical-align:top}'
    + 'tr.sub td{background:#f6f5f2;font-weight:700}tr.tot td{background:#f6f5f2;font-weight:700;border-top:1px solid #d8d6ce}'
    + 'tr.rneg td{background:#fdf6f4}'
    + 'table.tv td,table.tv th{padding:2px 4px;vertical-align:top;white-space:nowrap}'
    + 'table.tv .u{font-size:7.5px;color:#8a827a;font-weight:400}'
    + '.tortas{display:flex;gap:30px;align-items:center}.tortas img{width:170px;height:170px}'
    + '.ley{font-size:9.5px;line-height:1.6}'
    + '.ft{margin-top:13px;font-size:8.5px;color:#8a827a;border-top:1px solid #e3e1da;padding-top:6px}</style>'
    + '</head><body><h1>' + titulo + '</h1><div class="s">' + filtros.join(' · ') + ' · '
    + TA.ventas + ' venta(s) · ' + TA.cabezas + ' cabezas</div>'
    // 2 · resumen
    + '<div class="sec">Resumen del tramo</div>' + rvIntro('tarjetas', RV_LECT.tarjetas(TA), true, rvRacionFrase(A, true))
    + '<div class="k">'
    + kc('Resultado histórico', semOsc(TA.resultado, _remM(TA.resultado)),
        semOsc(TA.resultado_pct, _remN(TA.resultado_pct, 1) + ' %') + ' s/costo · '
        + semOsc(TA.resultado_cab, _remM(TA.resultado_cab)) + '/cab' + (TB ? ' · B ' + semOsc(TB.resultado, _remM(TB.resultado)) : ''),
        fondo(TA.resultado))
    + kc('Resultado c/ reposición', semOsc(TA.resultado_repo, _remM(TA.resultado_repo)),
        semOsc(TA.resultado_repo_pct, _remN(TA.resultado_repo_pct, 1) + ' %') + ' s/costo · '
        + semOsc(TA.resultado_repo_cab, _remM(TA.resultado_repo_cab)) + '/cab'
        + (TA.sin_repo ? ' · ' + TA.sin_repo + ' cab sin repos.' : '')
        + (TB ? ' · B ' + semOsc(TB.resultado_repo, _remM(TB.resultado_repo)) : ''), fondo(TA.resultado_repo))
    + kc('Venta neta', _remM(TA.venta_neta), TA.ventas + ' ventas · bruta ' + _remM(TA.bruta)
        + (TB ? ' · B ' + _remM(TB.venta_neta) : ''))
    + kc('Costo total', _remM(TA.costo), '$ ' + _remN(TA.costo / TA.kg_egreso) + '/kg vivo'
        + (TB ? ' · B ' + _remM(TB.costo) : ''))
    + '</div><div class="k">'
    + kc('Kg carne vendidos', '<span class="gold">' + _remN(TA.kg_carne) + ' kg</span>', 'rinde ' + _remN(TA.rinde, 2) + ' %'
        + (TB ? ' · B ' + _remN(TB.rinde, 2) + ' %' : ''))
    + kc('Cargado', '<span class="gold">' + _remN(TA.cabezas) + ' cab</span>',
        _remN(TA.kg_egreso) + ' kg salida · ' + _remN(TA.kg_ingreso) + ' kg ingreso')
    + kc('Precio kg carne', '$ ' + _remN(TA.precio_kg_carne, 2), '$ ' + _remN(TA.precio_kg_vivo) + '/kg vivo neto')
    + kc('Engorde', _remN(TA.kg_producidos) + ' kg prod.', 'ADP ' + _remN(TA.adp, 3) + ' · ' + _remN(TA.estadia)
        + ' d · conv. ' + conv(TA))
    + '</div>'
    // 3 · puente
    + '<div class="sec">Puente de costos' + (rvPuenteSufijo(_rvPuenteU) ? ' · $' + rvPuenteSufijo(_rvPuenteU) : '') + '</div>'
    + rvIntro('puente', RV_LECT.puente(TA), true)
    + (imgPuente ? '<img src="' + imgPuente + '" style="width:100%;max-width:1000px;height:auto">' : '')
    + '<div class="s" style="line-height:1.6">' + rvPuenteTexto(TA, _rvPuenteU) + '</div>'
    // 4 · categoría
    + '<div class="sec pb">Por categoría de venta</div>' + rvIntro('categoria', RV_LECT.categoria(cats), true)
    + (TB ? tabla(['Categoría', 'Cab A', 'Cab B', 'Resultado A', 'Resultado B', '% A', '% B'],
        cats.map(function (c) {
          var b = bCat[c.clave];
          return { neg: c.resultado < 0, c: [rvCatChip(c.clave), _remN(c.cabezas), b ? _remN(b.cabezas) : '—',
                  rvSem(c.resultado, _remM(c.resultado)), b ? rvSem(b.resultado, _remM(b.resultado)) : '—',
                  rvSem(c.resultado_pct, _remN(c.resultado_pct, 1) + ' %'),
                  b ? rvSem(b.resultado_pct, _remN(b.resultado_pct, 1) + ' %') : '—'] };
        })) + '<div class="s" style="margin:6px 0 3px">Detalle del tramo A:</div>' : '')
    + tabla(['Cat. de venta'].concat(RV_COLS_CAT.slice(1)), rvFilasCategoria(cats, TA))
    + (_rvCatDet ? '<div class="s" style="margin:6px 0 3px">Detalle por categoría:</div>'
        + tabla(RV_COLS_CAT, rvFilasCategoria(catsFina, TA)) : '')
    + (TA.kg_ms_est ? '<div class="s" style="margin-top:3px">* conversión con kg de MS estimados (consumo de la '
        + 'venta prorrateado por el costo de alimento de cada tropa).</div>' : '')
    // 5 · destino
    + '<div class="sec">Por destino y categoría de venta</div>' + rvIntro('destino', RV_LECT.destino(D.celdas), true)
    + tabla(['Destino', 'Cat. de venta', 'Cab', 'Kg sal/cab', 'Rinde', '$/kg carne', 'Estadía', 'Conversión',
             'Resultado', '$/cab'], rvFilasDestino(D), 2)
    // 6 · ventas + sin liquidar
    + '<div class="pb"></div>' + rvPdfVentas(A, !!TB) + rvPdfSinLiquidar(A)
    // 7 · tortas
    + '<div class="sec pb">Categorías vendidas</div>' + rvIntro('tortas', RV_LECT.tortas(G), true) + '<div class="tortas">'
    + (imgCab ? '<img src="' + imgCab + '">' : '') + '<div class="ley"><b>% por cabezas</b>' + leyenda('cabezas', ' cab') + '</div>'
    + (imgKg ? '<img src="' + imgKg + '">' : '') + '<div class="ley"><b>% por kg carne</b>' + leyenda('kg_carne', ' kg') + '</div>'
    + '</div>';

  // 8 · orígenes
  if (rvTieneOrigen()) {
    var O = rvOrigenes(dA.rows), X = rvOriExtra();
    h += '<div class="sec">Orígenes del ingreso · ' + rvTituloNivel() + ' (' + RV_MIN_CAB_ORIGEN + ' cabezas o más)</div>'
      + rvIntro('origenes', RV_LECT.origenes(O.ori), true)
      + tabla([rvNombreNivel(), X[0]].concat(RV_COLS_ORI_FIN), rvFilasOrigen(O.ori, X), 2)
      + '<div class="sec">' + rvNombreNivel() + ' × categoría</div>' + rvIntro('oxc', RV_LECT.oxc(O.oc), true)
      + tabla([rvNombreNivel()].concat(RV_COLS_OXC_FIN), rvFilasOxc(O.oc), 2);
  }

  // 9 · mes a mes y tropas
  h += '<div class="sec">Mes a mes</div>' + rvIntro('meses', '', true)
    + tabla(['Mes', 'Ventas', 'Cab', 'Resultado', '% s/costo', 'Result. repos.', 'Rinde'], meses.map(function (m) {
        return { neg: m.resultado < 0, c: [m.clave, m.ventas, _remN(m.cabezas), rvSem(m.resultado, _remM(m.resultado)),
                rvSem(m.resultado_pct, _remN(m.resultado_pct, 1) + ' %'), rvSem(m.resultado_repo, _remM(m.resultado_repo)),
                _remN(m.rinde, 2) + ' %'] };
      }))
    + '<div class="sec">Tropas de origen (' + minCab + ' cabezas o más)' + (TB ? ' · tramo A' : '') + '</div>'
    + rvIntro('tropas', '', true)
    + tabla(['Tropa', 'Origen', 'Localidad', 'Hotelero', 'Cat'].concat(A.base === 'ingreso' ? ['Ingreso'] : [])
        .concat(['Cab', 'Resultado', '% s/costo', '$/cab', 'Rinde', 'ADP']),
      tropas.slice(0, 30).map(function (t) {
        return { neg: t.resultado < 0, c: [t.clave, rvCorta(t.origen_lbl || '—', 28), t.localidad || '—', t.hotelero || '—',
                  t.categoria ? rvCatChip(t.categoria) : '—']
          .concat(A.base === 'ingreso' ? [_remFec(t.fecha_ingreso)] : [])
          .concat([_remN(t.cabezas), rvSem(t.resultado, _remM(t.resultado)),
                   rvSem(t.resultado_pct, _remN(t.resultado_pct, 1) + ' %'),
                   rvSem(t.resultado_cab, _remM(t.resultado_cab)), _remN(t.rinde, 2) + ' %', _remN(t.adp, 3)]) };
      }))
    + '<div class="ft">Generado el ' + new Date().toLocaleString('es-AR') + ' · Portal PEGSA v15.84 · '
    + 'Las tarjetas y las tablas se calculan por tropa (cada fila de cada venta): la venta de cada remito se '
    + 'prorratea entre sus tropas por kg de egreso, y el ajuste de reposición por costo de compra. La suma de lo '
    + 'guardado en cada venta puede diferir un poco por snapshots de versiones viejas del 07. El rinde es el de la '
    + 'venta (kg carne del camión ÷ kg vivo del camión) ponderado por los kg vivos de la tropa: el rinde real por '
    + 'animal necesitaría romaneo por caravana.'
    + (dA.sinFecha ? ' ' + dA.sinFecha + ' fila(s) sin fecha de ingreso quedaron afuera del tramo.' : '')
    + '</div></body></html>';
  var win = window.open('', '_blank');
  if (!win) { alert('El navegador bloqueó la ventana del informe. Permití las ventanas emergentes.'); return; }
  win.document.open(); win.document.write(h); win.document.close();
  win.onload = function () { setTimeout(function () { win.focus(); win.print(); }, 400); };
}

// ════ v15.80 · categoría de venta, puente con unidad, orígenes por nivel ════
/* Nicolás 05/10: "cuando trabajemos las categorías en venta, hablá por
   categoría de venta: Vaca, Macho y Hembra". Se usa en Por categoría, Por
   destino, las tortas y los chips. Tropas de origen, Orígenes y Ventas
   liquidadas siguen con la categoría fina. */
var RV_CAT_VENTA = { 'Vaca': 'Vaca', 'Novillo': 'Macho', 'Novillito': 'Macho', 'Ternero': 'Macho', 'Toro': 'Macho',
                     'Vaquillona': 'Hembra', 'Ternera': 'Hembra' };   // cualquier otra → 'Otros'
var RV_CAT_VENTA_COLOR = { 'Vaca': '#1a1612', 'Macho': '#2d6a8a', 'Hembra': '#b8922a', 'Otros': '#8a827a' };
var RV_CAT_VENTA_ORDEN = ['Vaca', 'Macho', 'Hembra', 'Otros'];
function rvCatV(c) { return RV_CAT_VENTA[c] || 'Otros'; }
function rvOrdCatV(a, b) {
  var i = function (x) { var k = RV_CAT_VENTA_ORDEN.indexOf(x.clave); return k < 0 ? 99 : k; };
  return i(a) - i(b);
}
function rvColCatV(k, i) { return RV_CAT_VENTA_COLOR[k] || remCatColor(k, i); }
function rvLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function rvLsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

var _rvCatDet = rvLsGet('pegsa_rv_cat_detalle') === '1';
var _rvPuenteU = rvLsGet('pegsa_rv_puente_u') || 'total';           // total | kg | cab
var _rvOrigenNivel = rvLsGet('pegsa_rv_origen_nivel') || 'proveedor'; // proveedor | tipo | localidad
function rvToggleCatDet() { _rvCatDet = !_rvCatDet; rvLsSet('pegsa_rv_cat_detalle', _rvCatDet ? '1' : '0'); rvRender(); }

/* Etiqueta de origen con el tipo: "DARWASH · feria". Las propias ya dicen
   el campo ("PROPIO · El Descanso") y las que no cruzan quedan como están. */
function rvOriLbl(f) {
  var o = f.origen_ing || 'SIN DATO', t = f.origen_tipo;
  return (t && t !== 'propio') ? o + ' · ' + t : o;
}
function rvOriClave(f) {
  if (_rvOrigenNivel === 'localidad') return f.localidad || 'SIN INGRESO';
  if (_rvOrigenNivel === 'tipo') return rvOriLbl(f);
  return f.origen_ing || 'SIN DATO';
}
function rvOriNivelTxt() {
  return { proveedor: 'proveedor', tipo: 'proveedor y tipo', localidad: 'localidad' }[_rvOrigenNivel] || 'proveedor';
}

function rvOpciones() {
  var hot = {}, comp = {}, cat = {};
  rvVentas().forEach(function (v) {
    if (v.comprador) comp[v.comprador] = 1;
    (v.filas || []).forEach(function (f) {
      if (f.hotelero) hot[f.hotelero] = 1;
      if (f.categoria) cat[rvCatV(f.categoria)] = 1;     // v15.80 · categoría de venta
    });
  });
  return { hot: Object.keys(hot).sort(), comp: Object.keys(comp).sort(),
           cat: RV_CAT_VENTA_ORDEN.filter(function (k) { return cat[k]; }) };
}
/* Pasos del puente (8 desde v15.80.2). Cada paso: [etiqueta, desde, hasta,
   tipo, monto, partes, valor acumulado después del paso]. "Compra" junta
   compra + comisión + gastos de compra y "Gastos feedlot" alimento +
   estructura + sanidad + mortandad (Nicolás 05/10); las partes van en el
   tooltip y en la línea de texto. El resto de cierre sólo si es de $ 1 o más. */
function rvPuentePasos(T) {
  var p = [], x = T.bruta;
  var baja = function (lbl, m, partes) {
    if (Math.abs(m) < 0.5 && !partes) return;
    p.push([lbl, Math.min(x - m, x), Math.max(x - m, x), m >= 0 ? 'neg' : 'pos', -m, partes || null, x - m]);
    x -= m;
  };
  p.push(['Venta bruta', 0, x, 'total', x, null, x]);
  baja('Gastos de venta', T.gastos_venta);
  p.push(['Venta neta', 0, T.venta_neta, 'sub', T.venta_neta, null, T.venta_neta]);
  x = T.venta_neta;
  baja('Compra', T.compra + T.comision + T.gastos_compra,
       [['compra', T.compra], ['comisión', T.comision], ['gastos de compra', T.gastos_compra]]);
  baja('Gastos feedlot', T.alimento + T.estructura + T.sanidad + T.mortandad,
       [['alimento', T.alimento], ['estructura', T.estructura], ['sanidad', T.sanidad], ['mortandad', T.mortandad]]);
  var resto = x - T.resultado;
  if (Math.abs(resto) >= 1) baja('Otros (resto)', resto);
  p.push(['Resultado histórico', Math.min(0, T.resultado), Math.max(0, T.resultado), 'res', T.resultado, null, T.resultado]);
  if (Math.abs(T.repo_delta) >= 0.5) {
    p.push(['Ajuste reposición', Math.min(T.resultado, T.resultado_repo), Math.max(T.resultado, T.resultado_repo),
            'adj', -T.repo_delta, null, T.resultado_repo]);
    p.push(['Resultado c/ reposición', Math.min(0, T.resultado_repo), Math.max(0, T.resultado_repo), 'res',
            T.resultado_repo, null, T.resultado_repo]);
  }
  return p;
}
/* Los mismos pasos divididos por la unidad elegida: kg de carne o cabezas. */
function rvPuenteDiv(T, u) { return u === 'kg' ? (T.kg_carne || 0) : u === 'cab' ? (T.cabezas || 0) : 1; }
function rvPuentePasosU(T, u) {
  var d = rvPuenteDiv(T, u) || 1;
  return rvPuentePasos(T).map(function (q) {
    return [q[0], q[1] / d, q[2] / d, q[3], q[4] / d,
            q[5] ? q[5].map(function (x) { return [x[0], x[1] / d]; }) : null, q[6] / d];
  });
}
function rvPuenteSufijo(u) { return u === 'kg' ? '/kg carne' : u === 'cab' ? '/cab' : ''; }
/* $ 3.979 M · $ 129,3 M · −$ 55,5 M; abajo de $ 1 M, en pesos. Por kg o por
   cabeza siempre en pesos. */
function rvPuenteFmt(v, u) {
  if (u === 'total' && Math.abs(v) >= 1e6) {
    var m = Math.abs(v) / 1e6;
    return (v < 0 ? '−' : '') + '$ ' + _remN(m, m >= 1000 ? 0 : 1) + ' M';
  }
  return _remM(v);
}
function rvPuenteCfg(T, pdf, u) {
  u = u || 'total';
  var P = rvPuentePasosU(T, u), bruta = T.bruta / (rvPuenteDiv(T, u) || 1);
  var col = function (q) {
    return q[3] === 'total' ? '#1a1612' : q[3] === 'sub' ? '#b8922a'
         : q[3] === 'res' ? (q[4] < 0 ? '#c0392b' : '#27613d')
         : q[3] === 'adj' ? '#8a827a' : '#c9a59a';
  };
  // etiquetas (monto + % s/ venta bruta) y conectores punteados, en el mismo
  // canvas: corre igual en pantalla y en el canvas oculto del PDF
  var etiquetas = {
    id: 'rvPuenteEtiq',
    afterDatasetsDraw: function (ch) {
      var ctx = ch.ctx, els = ch.getDatasetMeta(0).data, ys = ch.scales.y, top = ch.chartArea.top;
      ctx.save();
      ctx.strokeStyle = 'rgba(26,22,18,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      for (var i = 0; i < els.length - 1; i++) {
        var a = els[i], b = els[i + 1], y = ys.getPixelForValue(P[i][6]);
        ctx.beginPath(); ctx.moveTo(a.x + a.width / 2, y); ctx.lineTo(b.x - b.width / 2, y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      els.forEach(function (el, i) {
        var q = P[i], alto = Math.min(el.y, el.base), bajo = Math.max(el.y, el.base);
        var inter = q[3] === 'neg' || q[3] === 'pos' || q[3] === 'adj';
        var pct = inter && bruta ? _remN(q[4] / bruta * 100, 1) + ' %' : '';
        var arriba = alto - (pct ? 26 : 14) >= top;
        var y1 = arriba ? alto - (pct ? 17 : 5) : bajo + 13;
        ctx.font = '600 ' + (pdf ? 12 : 10) + 'px "DM Mono", monospace';
        ctx.fillStyle = q[4] < 0 && q[3] === 'res' ? '#c0392b' : '#1a1612';
        ctx.fillText(rvPuenteFmt(q[4], u), el.x, y1);
        if (pct) {
          ctx.font = (pdf ? 11 : 9.5) + 'px "DM Mono", monospace';
          ctx.fillStyle = 'rgba(26,22,18,.5)';
          ctx.fillText(pct, el.x, y1 + 12);
        }
      });
      ctx.restore();
    }
  };
  return {
    type: 'bar',
    data: { labels: P.map(function (q) { return q[0]; }),
            datasets: [{ data: P.map(function (q) { return [q[1], q[2]]; }), backgroundColor: P.map(col),
                         borderRadius: 2, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.9 }] },
    plugins: [etiquetas],
    options: {
      responsive: !pdf, maintainAspectRatio: false, animation: pdf ? false : undefined,
      layout: { padding: { top: 34, left: 4, right: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) {
          var q = P[c.dataIndex];
          var l = [' ' + rvPuenteFmt(q[4], u) + rvPuenteSufijo(u)
                   + (bruta ? ' · ' + _remN(q[4] / bruta * 100, 1) + ' % s/ venta bruta' : '')];
          (q[5] || []).forEach(function (x) {
            l.push('   ' + x[0] + ': ' + rvPuenteFmt(x[1], u) + rvPuenteSufijo(u)
                   + (bruta ? ' · ' + _remN(x[1] / bruta * 100, 1) + ' %' : ''));
          });
          return l;
        } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Mono', size: pdf ? 12 : 11 }, autoSkip: false,
             maxRotation: 0, callback: function (v, i) { var l = P[i][0]; return l.length > 12 ? l.split(' ') : l; } } },
        y: { grace: '12%', ticks: { font: { family: 'DM Mono', size: 10 }, callback: function (v) { return rvPuenteFmt(v, u); } },
             grid: { color: 'rgba(26,22,18,.06)' } }
      }
    }
  };
}
function rvPuenteTexto(T, u) {
  u = u || 'total';
  var suf = rvPuenteSufijo(u);
  return rvPuentePasosU(T, u).map(function (q) {
    var fuerte = q[3] === 'total' || q[3] === 'sub' || q[3] === 'res';
    var partes = q[5] ? ' (' + q[5].map(function (x) {
      return x[0] + ' ' + (u === 'total' ? _remN(x[1] / 1e6, 1) : _remN(x[1]));
    }).join(' · ') + ')' : '';
    // en el texto, $ total siempre con un decimal ($ 1.163,9 M); las etiquetas
    // de las barras siguen redondeando arriba de $ 1.000 M
    var monto = (u === 'total' && Math.abs(q[4]) >= 1e6)
      ? (q[4] < 0 ? '−' : '') + '$ ' + _remN(Math.abs(q[4]) / 1e6, 1) + ' M' : rvPuenteFmt(q[4], u);
    return (fuerte ? '<strong>' : '') + q[0] + ' ' + monto + suf + (fuerte ? '</strong>' : '') + partes;
  }).join(' · ');
}
function rvPintarPuente(T) {
  try { if (_rvChPuente) _rvChPuente.destroy(); } catch (e) {}
  _rvChPuente = null;
  var cv = document.getElementById('rvChartPuente');
  if (!cv || typeof Chart === 'undefined' || !T) return;
  _rvChPuente = new Chart(cv.getContext('2d'), rvPuenteCfg(T, false, _rvPuenteU));
}
function rvDestinoFilas(rows) {
  var min = rvMinCab(), n = {};
  rows.forEach(function (r) {
    var k = (r.v.comprador || '—') + '|' + rvCatV(r.f.categoria);
    n[k] = (n[k] || 0) + (r.f.cabezas || 0);
  });
  var celdas = rvAgg(rows, function (r) {
    var d = r.v.comprador || '—', k = d + '|' + rvCatV(r.f.categoria);
    return n[k] >= min ? k : d + '|otras';
  });
  var dest = rvAgg(rows, function (r) { return r.v.comprador || '—'; })
    .sort(function (a, b) { return b.cabezas - a.cabezas; });
  return { celdas: celdas, dest: dest };
}
/* dentro de un destino: Vaca · Macho · Hembra · Otros · otras */
function rvOrdDestCelda(a, b) {
  var i = function (x) {
    var c = x.clave.split('|')[1];
    if (c === 'otras') return 100;
    var k = RV_CAT_VENTA_ORDEN.indexOf(c); return k < 0 ? 99 : k;
  };
  return i(a) - i(b);
}
function rvCatsTorta(rows) {
  return rvAgg(rows, function (r) { return rvCatV(r.f.categoria); }).sort(rvOrdCatV);
}
function rvTortaCfg(G, campo, pdf) {
  var tot = G.reduce(function (a, g) { return a + (g[campo] || 0); }, 0);
  var uni = campo === 'cabezas' ? ' cab' : ' kg';
  return {
    type: 'doughnut',
    data: { labels: G.map(function (g) { return g.clave; }),
            datasets: [{ data: G.map(function (g) { return Math.round(g[campo] || 0); }),
                         backgroundColor: G.map(function (g, i) { return rvColCatV(g.clave, i); }),
                         borderColor: '#fff', borderWidth: 2 }] },
    options: {
      responsive: !pdf, maintainAspectRatio: false, cutout: '52%', animation: pdf ? false : undefined,
      plugins: {
        legend: { display: !pdf, position: 'right', labels: {
          boxWidth: 10, boxHeight: 10, padding: 7, font: { family: 'DM Mono, monospace', size: 11 }, color: '#1a1612',
          generateLabels: function (ch) {
            var ds = ch.data.datasets[0];
            return ch.data.labels.map(function (l, i) {
              return { text: l + ' · ' + _remN(ds.data[i] / (tot || 1) * 100, 1) + ' % · ' + _remN(ds.data[i]) + uni,
                       fillStyle: ds.backgroundColor[i], strokeStyle: '#fff', lineWidth: 1, index: i };
            });
          } } },
        tooltip: { callbacks: { label: function (c) {
          return ' ' + c.label + ': ' + _remN(c.raw) + uni + ' · ' + _remN(c.raw / (tot || 1) * 100, 1) + ' %'; } } }
      }
    }
  };
}
function rvOrigenes(rows) {
  var ori = rvAgg(rows, function (r) { return rvOriClave(r.f); })
    .filter(function (o) { return o.cabezas >= RV_MIN_CAB_ORIGEN; }).sort(rvOrdenOri(_rvOrdenOri));
  var oc = rvAgg(rows, function (r) { return rvOriClave(r.f) + '|' + (r.f.categoria || '—'); })
    .filter(function (o) { return o.cabezas >= RV_MIN_CAB_ORIGEN; }).sort(rvOrdenOri('cab'));
  return { ori: ori, oc: oc };
}
/* columna extra según el nivel: localidad (proveedor / proveedor + tipo) o
   cuántos proveedores (localidad) */
function rvOriExtra() {
  return _rvOrigenNivel === 'localidad' ? ['Proveedores', function (o) { return o.n_prov; }]
                                        : ['Localidad', function (o) { return o.localidad || '—'; }];
}
// ════════════════════════════════════════════════════════════
//  v15.79 · Informe completo: tarjetas, puente, categoría, destino,
//  tortas y orígenes del ingreso
// ════════════════════════════════════════════════════════════
/* Todo sale de rvFilas(A) + rvAgg: por filas (una por tropa dentro de cada
   venta), nunca promediando promedios. La venta bruta y el delta de reposición
   se prorratean en rvFilas, así los filtros y los tramos por ingreso cierran. */
var RV_MIN_CAB_ORIGEN = 20;       // = 4 × el mínimo del ranking de tropas
var _rvOrdenOri = 'cab';          // cab ($/cab) | resultado | pct | rinde | adp | cabezas
var _rvVerTropas = false;         // "Tropas de origen" arranca colapsada
var _rvChPuente = null, _rvChCat1 = null, _rvChCat2 = null;

function rvGrid4() { return 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:12px'; }

function rvConv(x) {
  if (!x || x.conversion == null) return '—';
  return _remN(x.conversion, 1) + (x.kg_ms_est ? '<sup title="kg de MS estimados: prorrateo del consumo de la '
    + 'venta por el costo de alimento de cada tropa">*</sup>' : '');
}
function rvCorta(s, n) {
  s = String(s == null ? '—' : s);
  return s.length > n ? '<span title="' + s.replace(/"/g, '&quot;') + '">' + s.slice(0, n - 1) + '…</span>' : s;
}
function rvBtnCSV(cual) {
  return '<button onclick="rvCSV(\'' + cual + '\')" style="float:right;padding:4px 11px;background:#faf8f4;'
    + 'border:1px solid #d8d6ce;border-radius:2px;font-family:\'DM Mono\',monospace;font-size:11px;'
    + 'cursor:pointer;margin-left:6px">&#11015; CSV' + (cual.indexOf('origen') === 0 && cual !== 'origen' ? ' × cat' : '')
    + '</button>';
}

// ── 2 · tarjetas ──

// ── 3 · puente ──

// ── 4 · por categoría ──
var RV_COLS_CAT = ['Categoría', 'Cab', 'Kg ing/cab', 'Kg sal/cab', 'Kg prod/cab', 'ADP', 'Estadía', 'Conversión',
                   'Rinde', '$/kg carne', '$/kg compra', 'Resultado', '% s/costo', '$/cab', 'Result. repos.'];

// ── 5 · por destino × categoría ──

// ── 7 · tortas ──
function rvPintarTortas(rows) {
  try { if (_rvChCat1) _rvChCat1.destroy(); } catch (e) {}
  try { if (_rvChCat2) _rvChCat2.destroy(); } catch (e) {}
  _rvChCat1 = _rvChCat2 = null;
  if (typeof Chart === 'undefined') return;
  var G = rvCatsTorta(rows);
  var c1 = document.getElementById('rvChartCatCab'), c2 = document.getElementById('rvChartCatKg');
  if (c1) _rvChCat1 = new Chart(c1.getContext('2d'), rvTortaCfg(G, 'cabezas', false));
  if (c2) _rvChCat2 = new Chart(c2.getContext('2d'), rvTortaCfg(G, 'kg_carne', false));
}

// ── 8 · orígenes del ingreso ──
function rvTieneOrigen() {
  return rvVentas().some(function (v) { return (v.filas || []).some(function (f) { return f.origen_ing; }); });
}
function rvOrdenOri(campo) {
  var k = { cab: 'resultado_cab', resultado: 'resultado', pct: 'resultado_pct', rinde: 'rinde', adp: 'adp',
            cabezas: 'cabezas' }[campo] || 'resultado_cab';
  return function (a, b) { return (b[k] == null ? -1e15 : b[k]) - (a[k] == null ? -1e15 : a[k]); };
}
/* top 10 y bottom 5 (si hay más de 15), con una fila "· · ·" en el medio */
function rvTopBottom(lista, fila) {
  var rows = [];
  if (lista.length > 15) {
    lista.slice(0, 10).forEach(function (x) { rows.push(fila(x)); });
    rows.push({ sep: true });
    lista.slice(-5).forEach(function (x) { rows.push(fila(x)); });
  } else lista.forEach(function (x) { rows.push(fila(x)); });
  return rows;
}
function rvToggleTropas() { _rvVerTropas = !_rvVerTropas; rvRender(); }

/* PNG de un gráfico para el PDF: canvas propio, sin animación, fondo blanco
   (el PNG de Chart.js sale transparente). '' si Chart no está. */
function rvChartPNG(cfg, w, h) {
  if (typeof Chart === 'undefined') return '';
  var cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cfg.plugins = (cfg.plugins || []).concat([{ id: 'bgBlanco', beforeDraw: function (c) {
    var x = c.ctx; x.save(); x.globalCompositeOperation = 'destination-over';
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } }]);
  var ch = null, url = '';
  try { ch = new Chart(cv.getContext('2d'), cfg); url = cv.toDataURL('image/png'); } catch (e) { url = ''; }
  try { if (ch) ch.destroy(); } catch (e) {}
  return url;
}

// ════════════════════════════════════════════════════════════
//  CSV y PDF
// ════════════════════════════════════════════════════════════
function _rvSlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tramo';
}
/* v15.78 · formato y descarga de los CSV nuevos: el mismo `;`, coma decimal y
   BOM que el val() de rvCSV (que no se tocó, para no mover los CSV viejos). */
function _rvCsvVal(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(Math.round(v * 100) / 100).replace('.', ',');
  if (typeof v === 'boolean') return v ? 'si' : 'no';
  return /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
}
function _rvBajar(nombre, txt) {
  try {
    var blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) {}
}
function rvCSVVentas(cual) {
  var A = rvTramoA();
  var sufijo = _rvSlug(A.nombre) + (A.desde ? '_' + A.desde : '') + (A.hasta ? '_' + A.hasta : '');
  var cols, filas;
  if (cual === 'ventas') {
    cols = ['fecha_egreso', 'remitos', 'es_grupo', 'comprador', 'propietario', 'categorias', 'cabezas',
            'kg_vivo', 'kg_carne', 'rinde_pct', 'precio_kg_carne', 'venta_bruta', 'venta_neta', 'costo_hist',
            'resultado_hist', 'resultado_hist_pct', 'precio_reposicion', 'reposicion_manual',
            'costo_reposicion', 'resultado_reposicion', 'estado_verificacion', 'version_portal'];
    filas = rvVentasTramo(A).map(function (x) {
      var f = rvVentaFila(x.v);
      return [f.fecha, f.remitos, f.es_grupo, f.comprador, f.propietario, f.categorias, f.cabezas,
              f.kg_vivo, f.kg_carne, f.rinde, f.precio_kg, f.bruta, f.neta, f.costo, f.res, f.res_pct,
              f.repo_precio, f.repo_manual, f.repo_costo, f.repo, f.estado, f.version];
    });
  } else {
    var D = rvSinLiquidar(A);
    if (!D) return;
    cols = ['fecha_egreso', 'remito', 'comprador', 'cabezas', 'kg_vivo', 'cobertura_pct', 'traslado_feria'];
    var fila = function (fer) { return function (x) {
      return [x.fecha, x.nro, x.comprador, x.cabezas, x.kg_vivo, x.cobertura, fer]; }; };
    filas = D.sin.map(fila(false)).concat(D.feria.map(fila(true)));
  }
  _rvBajar((cual === 'ventas' ? 'ventas_' : 'sin_liquidar_') + sufijo + '.csv',
           cols.join(';') + '\n' + filas.map(function (l) { return l.map(_rvCsvVal).join(';'); }).join('\n'));
}

function rvCSV(cual) {
  if (cual === 'ventas' || cual === 'sin_liquidar') return rvCSVVentas(cual);
  var A = rvTramoA(), B = _rvCmp ? rvTramoB() : null;
  var dA = rvFilas(A), dB = B ? rvFilas(B) : null;
  var keyFn = {
    cat: function (r) { return r.f.categoria; },
    destino: function (r) { return (r.v.comprador || '—') + ' | ' + rvCatV(r.f.categoria); },
    origen: function (r) { return rvOriClave(r.f); },
    origen_cat: function (r) { return rvOriClave(r.f) + ' | ' + (r.f.categoria || '—'); }
  }[cual] || function (r) { return r.f.tropa; };
  var rowsA = rvAgg(dA.rows, keyFn);
  var bMap = {};
  if (dB) rvAgg(dB.rows, keyFn).forEach(function (x) { bMap[x.clave] = x; });
  var cols = ['clave', 'hotelero', 'categoria', 'ventas', 'cabezas', 'kg_ingreso', 'kg_egreso',
              'kg_producidos', 'kg_carne', 'venta_neta', 'costo', 'resultado', 'resultado_pct',
              'resultado_cab', 'rinde', 'precio_kg_vivo', 'adp', 'costo_kg_prod', 'precio_pagado',
              // v15.79 · al final, para no mover las de antes
              'bruta', 'gastos_venta', 'comision', 'gastos_compra', 'alimento', 'estructura', 'sanidad',
              'mortandad', 'kg_ms', 'conversion', 'kg_ing_cab', 'kg_egr_cab', 'kg_prod_cab', 'estadia',
              'precio_kg_carne', 'resultado_repo', 'resultado_repo_pct', 'resultado_repo_cab', 'n_tropas',
              'origen_ing', 'origen_tipo', 'localidad', 'categorias'];   // v15.80 · v15.81
  // v15.80 · el CSV de categoría lleva la categoría de venta adelante y la fina
  // en `clave`, ordenado Vaca · Macho · Hembra
  if (cual === 'cat') rowsA.sort(function (a, b) {
    return rvOrdCatV({ clave: rvCatV(a.clave) }, { clave: rvCatV(b.clave) }) || b.cabezas - a.cabezas; });
  var head = cols.slice();
  if (dB) head = head.concat(cols.slice(3).map(function (c) { return c + '_B'; }));
  var val = function (v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(Math.round(v * 100) / 100).replace('.', ',');
    return /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  };
  if (cual === 'cat') head.unshift('categoria_venta');
  var txt = head.join(';') + '\n' + rowsA.map(function (r) {
    var l = cols.map(function (c) { return val(r[c]); });
    if (cual === 'cat') l.unshift(val(rvCatV(r.clave)));
    if (dB) {
      var b = bMap[r.clave];
      l = l.concat(cols.slice(3).map(function (c) { return b ? val(b[c]) : ''; }));
    }
    return l.join(';');
  }).join('\n');
  var nombre = 'resultados_' + ({ cat: 'categoria', destino: 'destino', origen: 'origen',
      origen_cat: 'origen_categoria' }[cual] || 'tropa') + '_' + _rvSlug(A.nombre)
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


