/* modulo-09-remitos.js — Resultado por Remito · v15.71 (2026-09-04)
   ────────────────────────────────────────────────────────────────
   Port al portal del prototipo standalone v2.5 validado por el usuario
   (Claude_Outputs\Scripts_Auxiliares\modulo_resultado_remito\).

   El COSTO viene calculado del pipeline (resultado_remitos.json): compra +
   comisión + alimento (%PV mensual real) + estructura + sanidad + mortandad.
   La VENTA se carga acá a mano y persiste en localStorage.

   v15.68 · Los animales SIN CARAVANA. Cuando el bastón no lee la caravana, el
   cargador de WinCampo le asigna al egreso un animal cualquiera del stock y el
   remito hereda kg de ingreso, precio, fecha y estadía de OTRO animal. El
   pipeline los detecta buscando el RFID en TODAS las lecturas reales de los
   ultimos 30 dias (Datamars, sin importar la sesion) y les imputa el origen de
   la tropa mayoritaria confirmada. Acá se muestran con
   badge y marca propia, y se puede pisar ese origen a mano ($/kg, kg/cab y
   fecha) con recálculo en vivo. Sin sesión de Datamars no cambia nada: vale lo
   cargado en WinCampo.
*/

var _remData = null;
var _remSel  = null;
// v15.69 · caravanas fantasma: leidas por el baston en una salida y todavia en
// el stock de WinCampo. El cargador tiene que renombrarlas a un placeholder.
var _remFant = null;
var _remFantOpen = false;
var _remFantHot = '';
var _remFantFec = '';
// v15.69.1 · historial de resultados por venta. Cada informe PDF baja un JSON
// con el resultado completo de esa venta; Nicolás lo deja en
// datos\resultados_ventas\ y el pipeline lo consolida.
var REM_LS_HIST = 'pegsa_resultados_hist';
var _remHist = null;   // resultados_ventas.json consolidado por el pipeline

// v15.59: la venta se carga a mano y persiste en localStorage POR NAVEGADOR.
// Decisión del usuario 2026-08-13: provisorio hasta conectar una base de datos.
// No inventar sincronización — cada dispositivo ve su propia carga.
var REM_LS_PREFIX = 'pegsa_venta_remito_';
// v15.62: una faena se lleva 2-3 remitos y el frigorífico liquida todo junto.
// La venta del grupo va en su propia clave, canónica (ids ordenados), para que
// el mismo grupo re-seleccionado en cualquier orden recupere su carga.
var REM_LS_GRUPO  = 'pegsa_venta_grupo_';
// v15.68: origen cargado a mano para los animales SIN CARAVANA de un remito.
// {precio, kgCab, fecha} — null en cualquiera de los tres = automático (el
// valor que imputó el pipeline). Misma convención que los overrides de
// reposición de v15.62.1.
var REM_LS_SC     = 'pegsa_sc_remito_';
var REM_LS_SC_GR  = 'pegsa_sc_grupo_';
var _remModo = 'simple';   // 'simple' | 'grupo'
var _remGrupo = [];        // ids seleccionados en modo grupo

function _remLsGet(k) {
  try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : {}; }
  catch (e) { return {}; }
}
function _remLsSet(k, obj) {
  try { localStorage.setItem(k, JSON.stringify(obj)); } catch (e) {}
}
function remVentaGet(nro) { return _remLsGet(REM_LS_PREFIX + nro); }
function remVentaSet(nro, obj) { _remLsSet(REM_LS_PREFIX + nro, obj); }

// Clave de la venta del contexto actual (remito suelto o grupo).
function remVentaKey() {
  return _remModo === 'grupo'
    ? REM_LS_GRUPO + _remGrupo.slice().sort().join('-')
    : REM_LS_PREFIX + _remSel;
}
function remVentaCtx() { return _remLsGet(remVentaKey()); }

// v15.68 · clave y lectura del origen manual de los "sin caravana".
function remSCKey() {
  return _remModo === 'grupo'
    ? REM_LS_SC_GR + _remGrupo.slice().sort().join('-')
    : REM_LS_SC + _remSel;
}
function remSCCtx() { return _remLsGet(remSCKey()); }

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
    try {
      var rf = await fetch(STOCK_SB + '/fantasmas.json', {}, {});
      if (rf.ok) _remFant = await rf.json();
    } catch (e) { _remFant = null; }   // el modulo funciona igual sin fantasmas
    try {
      var rh = await fetch(STOCK_SB + '/resultados_ventas.json', {}, {});
      if (rh.ok) _remHist = await rh.json();
    } catch (e) { _remHist = null; }
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

/* v15.62 · Consolida varios remitos en un objeto con la MISMA forma que uno
   suelto, para que todo lo de abajo (KPIs, barra, resultado, indicadores,
   reposición, detalle, informe PDF) siga funcionando sin ramificaciones.

   ⚠ Los indicadores se RECALCULAN desde los agregados, no se promedian los de
   cada remito: promediar un ADP o una conversión da un número que no existe.
   Los días-animal salen de dias × cabezas de cada fila (el JSON no los trae
   explícitos). */
function remConsolidar(ids) {
  var R = _remData.remitos, orden = ids.slice().sort();
  var filas = [], sinPrecio = [], acot = {}, compradores = [];
  var C = { compra: 0, comision: 0, alimento: 0, estructura: 0, sanidad: 0, mortandad: 0, total: 0 };
  var RP = { compra: 0, comision: 0, alimento: 0, mortandad: 0, total: 0 };
  var cab = 0, kgi = 0, kge = 0, kgms = 0, diasAnimal = 0, pvDen = 0, kgiConPrecio = 0;
  var repoPrecioNum = 0, repoPrecioDen = 0, fuentes = {}, mesMs = null, precioMs = null;
  var fechas = [], sinPv = 0;
  // v15.68: verificación sumada del grupo — cabezas sin caravana de todos sus
  // remitos, y las tropas a las que se les imputó el origen.
  var VER = { sc: 0, kgSc: 0, conf: 0, ant: 0, dobles: 0, sinE: 0, noL: 0, vent: 0, estados: {}, tropas: [], imputado: null };

  orden.forEach(function (id) {
    var r = R[id]; if (!r) return;
    ['compra', 'comision', 'alimento', 'estructura', 'sanidad', 'mortandad', 'total'].forEach(function (k) {
      C[k] += r.costos[k] || 0;
    });
    ['compra', 'comision', 'alimento', 'mortandad', 'total'].forEach(function (k) {
      RP[k] += r.reposicion[k] || 0;
    });
    cab += r.cabezas || 0; kgi += r.kg_ingreso || 0; kge += r.kg_egreso || 0; kgms += r.kg_ms || 0;
    sinPv += r.dias_sin_pv || 0;
    if (r.fecha_egreso) fechas.push(r.fecha_egreso);
    if (r.comprador && compradores.indexOf(r.comprador) < 0) compradores.push(r.comprador);
    Object.keys(r.meses_pv_acotados || {}).forEach(function (m) { acot[m] = r.meses_pv_acotados[m]; });
    (r.tropas_sin_precio || []).forEach(function (t) { sinPrecio.push(t); });
    // precio de reposición: ponderado por kg de entrada del remito
    if (r.reposicion.precio_kg) { repoPrecioNum += r.reposicion.precio_kg * (r.kg_ingreso || 0); repoPrecioDen += (r.kg_ingreso || 0); }
    fuentes[r.reposicion.fuente_precio] = 1;
    mesMs = r.reposicion.mes_ms; precioMs = r.reposicion.precio_kg_ms;
    var vv = r.verificacion || { estado: 'sin_datamars', sc: 0 };
    VER.estados[vv.estado] = (VER.estados[vv.estado] || 0) + 1;
    VER.sc += vv.sc || 0;
    VER.conf += vv.confirmadas || 0;
    VER.ant += vv.confirmadas_anterior || 0;
    VER.dobles += vv.dobles_lectura || 0;
    VER.sinE += vv.sc_sin_electronica || 0;
    VER.noL += vv.sc_no_leida || 0;
    VER.vent = vv.ventana_dias || VER.vent;
    if (vv.tropa_imputada && VER.tropas.indexOf(vv.tropa_imputada) < 0) VER.tropas.push(vv.tropa_imputada);
    if (vv.imputado && !VER.imputado) VER.imputado = vv.imputado;   // prefill del grupo
    (r.filas || []).forEach(function (f) {
      if (f.imputado) VER.kgSc += f.kg_egreso || 0;
      var fr = {}; for (var k in f) fr[k] = f[k];
      fr.remito = id;                                  // columna extra del detalle
      filas.push(fr);
      var da = (f.dias || 0) * (f.cabezas || 0);
      diasAnimal += da;
      pvDen += ((f.kg_ingreso + f.kg_egreso) / 2) * (f.dias || 0);
      if (!f.estimado) kgiConPrecio += f.kg_ingreso || 0;
    });
  });

  var kgProd = kge - kgi;
  var tropasUnicas = {}; filas.forEach(function (f) { tropasUnicas[f.tropa] = 1; });
  var fu = Object.keys(fuentes);

  return {
    esGrupo: true, remitos_ids: orden,
    remitos_detalle: orden.map(function (id) {
      return { id: id, fecha_egreso: (R[id] || {}).fecha_egreso, cabezas: (R[id] || {}).cabezas };
    }),
    filas: filas,
    cabezas: cab, tropas: Object.keys(tropasUnicas).length,
    kg_ingreso: Math.round(kgi * 10) / 10, kg_egreso: Math.round(kge * 10) / 10,
    kg_producidos: Math.round(kgProd * 10) / 10, kg_ms: Math.round(kgms * 10) / 10,
    fecha_egreso: fechas.sort().slice(-1)[0] || null,
    comprador: compradores.join(' · ') || null,
    costos: {
      compra: C.compra, comision: C.comision, alimento: C.alimento,
      estructura: C.estructura, sanidad: C.sanidad, mortandad: C.mortandad,
      total: C.total, por_kg_vendido: kge ? C.total / kge : null
    },
    indicadores: {
      kg_prom_ingreso: cab ? kgi / cab : null,
      kg_prom_salida: cab ? kge / cab : null,
      estadia_prom: cab ? Math.round(diasAnimal / cab) : null,
      adp: diasAnimal ? kgProd / diasAnimal : null,
      pct_ms: pvDen ? kgms / pvDen * 100 : null,
      conversion_ms: kgProd > 0 ? kgms / kgProd : null,
      costo_kg_producido: kgProd > 0 ? (C.alimento + C.estructura + C.sanidad) / kgProd : null,
      precio_prom_pagado: kgi ? C.compra / kgi : null
    },
    reposicion: {
      precio_kg: repoPrecioDen ? repoPrecioNum / repoPrecioDen : null,
      fuente_precio: fu.length === 1 ? fu[0] : 'prom. ponderado de ' + orden.length + ' remitos',
      precio_kg_ms: precioMs, mes_ms: mesMs,
      compra: RP.compra, comision: RP.comision, alimento: RP.alimento,
      mortandad: RP.mortandad, total: RP.total,
      por_kg_vendido: kge ? RP.total / kge : null
    },
    // v15.68.2: el estado del grupo es el peor de sus remitos — si a uno le
    // faltan lecturas de Datamars en la ventana, el grupo no está verificado.
    verificacion: {
      estado: VER.estados.sin_datamars ? 'sin_datamars' : 'verificado',
      ventana_dias: VER.vent || 30,
      confirmadas: VER.conf,
      sc: VER.sc,
      sc_pct_cab: cab ? Math.round(VER.sc / cab * 1000) / 10 : null,
      sc_pct_kg: kge ? Math.round(VER.kgSc / kge * 1000) / 10 : null,
      confirmadas_anterior: VER.ant,
      confirmadas_salida: VER.conf - VER.ant,
      dobles_lectura: VER.dobles,
      sc_sin_electronica: VER.sinE,
      sc_no_leida: VER.noL,
      tropa_imputada: VER.tropas.join(' · ') || null,
      imputado: VER.imputado,
      esGrupo: true, remitos_estados: VER.estados
    },
    cobertura_pct: kgi ? kgiConPrecio / kgi * 100 : null,
    tropas_sin_precio: sinPrecio,
    precio_estimado: kgiConPrecio ? C.compra / kgi : null,
    meses_pv_acotados: acot,
    dias_sin_pv: sinPv
  };
}

/* v15.62.1 · Economía de la venta, con la comisión del consignatario.
   El $ manual MANDA sobre el %: si el usuario escribe el monto, ese vale y el
   % queda como referencia calculada. Las ventas guardadas antes de esta
   versión no tienen estos campos → comisión 0, todo sigue igual. */
function remVentaCalc(venta) {
  var kgc = venta.kg_carne || 0, pkg = venta.precio_kg || 0;
  var bruto = kgc * pkg;
  var manual = venta.com_venta_monto != null;
  var comVenta = manual ? venta.com_venta_monto
                        : (venta.com_venta_pct ? bruto * venta.com_venta_pct / 100 : 0);
  var otros = (venta.flete || 0) + (venta.pesada || 0) + (venta.guia_senasa || 0) + (venta.guia_comuna || 0);
  return {
    kgc: kgc, pkg: pkg, bruto: bruto, otros: otros,
    comVenta: comVenta, comManual: manual,
    comPct: bruto ? comVenta / bruto * 100 : null,
    gastos: otros + comVenta, neto: bruto - otros - comVenta
  };
}

/* v15.62.1 · Reposición con precios editables a mano.
   Todos los rubros repo son LINEALES en su precio (compra = kg × $/kg,
   comisión = compra × %, mortandad = kg_mort × $/kg, alimento = kg MS × $/kg MS),
   así que alcanza con reescalar lo que ya vino calculado — no hace falta
   rehacer el cálculo fila por fila y el resultado es exacto.
   Estructura y sanidad quedan históricas, como en el prototipo.
   ⚠ En un grupo cuyos remitos tenían precios repo distintos, la mortandad
   reescalada tiene una diferencia de segundo orden (es ~1 % del costo). */
function remRepoCalc(r, venta) {
  var RP = r.reposicion;
  var pAuto = RP.precio_kg, msAuto = RP.precio_kg_ms;
  var p = venta.repoPrecio != null ? venta.repoPrecio : pAuto;
  var ms = venta.repoMS != null ? venta.repoMS : msAuto;
  var fp = pAuto ? p / pAuto : 1, fm = msAuto ? ms / msAuto : 1;
  var estrSan = RP.total - ((RP.compra || 0) + (RP.comision || 0) + (RP.alimento || 0) + (RP.mortandad || 0));
  var compra = (RP.compra || 0) * fp, comision = (RP.comision || 0) * fp;
  var mort = (RP.mortandad || 0) * fp, alim = (RP.alimento || 0) * fm;
  var total = compra + comision + alim + mort + estrSan;
  return {
    precio: p, precioMs: ms, pAuto: pAuto, msAuto: msAuto,
    manualP: venta.repoPrecio != null, manualMs: venta.repoMS != null,
    manual: venta.repoPrecio != null || venta.repoMS != null,
    compra: compra, comision: comision, alimento: alim, mortandad: mort,
    total: total, por_kg_vendido: r.kg_egreso ? total / r.kg_egreso : null
  };
}

function _remDiasEntre(a, b) {
  var d = (Date.parse(a + 'T00:00:00') && Date.parse(b + 'T00:00:00'))
    ? (Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000 : NaN;
  return isNaN(d) ? null : Math.max(1, Math.round(d));
}

/* v15.68 · Origen cargado a mano para los animales SIN CARAVANA.

   El pipeline le imputa a cada fila `imputado` el origen de la tropa
   mayoritaria confirmada del remito. Acá se puede pisar ese origen con $/kg,
   kg de ingreso por cabeza y fecha de ingreso propios, y todo se recalcula en
   vivo. Devuelve un objeto con la MISMA forma que el remito, así nada de lo
   que sigue (KPIs, resultado, indicadores, reposición, detalle, PDF) se
   ramifica; si no hay carga manual devuelve el mismo objeto sin tocar.

   Compra, comisión y mortandad son lineales en kg × $/kg, así que salen
   exactas. Alimento, estructura y kg MS se reescalan PROPORCIONALMENTE a los
   días (costo_día = costo_fila ÷ días) — es una aproximación: el modelo real
   cobra cada mes a su %PV y su precio de ración. La sanidad NO se reescala:
   es única por cabeza al ingreso, no un costo por día. */
function remAplicarSC(r, sc) {
  sc = sc || {};
  var hayManual = (sc.precio != null || sc.kgCab != null || !!sc.fecha);
  var filas = r.filas || [];
  if (!hayManual || !filas.some(function (f) { return f.imputado; })) return r;

  var comDef = ((_remData || {}).meta || {}).comision_default || 0.03;
  var D = { compra: 0, comision: 0, alimento: 0, estructura: 0, mortandad: 0 };
  var cab = 0, kgi = 0, kge = 0, kgms = 0, diasAnimal = 0, pvDen = 0;
  var kgiMort = 0, kgiConPrecio = 0;

  var filas2 = filas.map(function (f) {
    var g = {}; for (var k in f) g[k] = f[k];
    if (f.imputado) {
      var nCab = f.cabezas || 1;
      var mortPct = f.costo_compra ? (f.mortandad || 0) / f.costo_compra : 0;
      var comPct = (f.comision_pct || 0) / 100;
      if (sc.fecha) {
        var d2 = _remDiasEntre(sc.fecha, f.fecha_egreso);
        if (d2) { g.fecha_ingreso = sc.fecha; g.dias = d2; }
      }
      var fd = (f.dias ? g.dias / f.dias : 1);
      if (sc.kgCab != null) g.kg_ingreso = sc.kgCab * nCab;
      if (sc.precio != null) g.precio_kg = sc.precio;
      g.costo_compra = g.kg_ingreso * g.precio_kg;
      g.mortandad = g.costo_compra * mortPct;
      g.alimento = (f.alimento || 0) * fd;
      g.estructura = (f.estructura || 0) * fd;
      g.kg_ms = (f.kg_ms || 0) * fd;
      var kgp = (g.kg_ingreso + g.kg_egreso) / 2;
      g.pct_ms = (g.dias && kgp) ? g.kg_ms / (kgp * g.dias) * 100 : null;
      g.manual = true;
      D.compra += g.costo_compra - (f.costo_compra || 0);
      D.comision += (g.costo_compra - (f.costo_compra || 0)) * comPct;
      D.alimento += g.alimento - (f.alimento || 0);
      D.estructura += g.estructura - (f.estructura || 0);
      D.mortandad += g.mortandad - (f.mortandad || 0);
    }
    cab += g.cabezas || 0; kgi += g.kg_ingreso || 0; kge += g.kg_egreso || 0;
    kgms += g.kg_ms || 0;
    diasAnimal += (g.dias || 0) * (g.cabezas || 0);
    pvDen += ((g.kg_ingreso + g.kg_egreso) / 2) * (g.dias || 0);
    kgiMort += (g.kg_ingreso || 0) * (f.costo_compra ? (f.mortandad || 0) / f.costo_compra : 0);
    if (!g.estimado) kgiConPrecio += g.kg_ingreso || 0;
    return g;
  });

  // Los rubros no imputados se toman del pipeline y solo se les suma el delta:
  // recalcularlos desde las filas arrastraría el redondeo del % de comisión.
  var C = {};
  ['compra', 'comision', 'alimento', 'estructura', 'sanidad', 'mortandad'].forEach(function (k) {
    C[k] = (r.costos[k] || 0) + (D[k] || 0);
  });
  C.total = C.compra + C.comision + C.alimento + C.estructura + C.sanidad + C.mortandad;
  C.por_kg_vendido = kge ? C.total / kge : null;

  var RP = r.reposicion, rp = RP.precio_kg || 0, rms = RP.precio_kg_ms || 0;
  var compraR = kgi * rp, comR = compraR * comDef, aliR = kgms * rms, mortR = kgiMort * rp;
  var kgProd = kge - kgi;

  var out = {}; for (var k2 in r) out[k2] = r[k2];
  out.filas = filas2;
  out.scManual = true;
  out.costos = C;
  out.kg_ingreso = kgi; out.kg_egreso = kge;
  out.kg_producidos = kgProd; out.kg_ms = kgms;
  out.indicadores = {
    kg_prom_ingreso: cab ? kgi / cab : null,
    kg_prom_salida: cab ? kge / cab : null,
    estadia_prom: cab ? Math.round(diasAnimal / cab) : null,
    adp: diasAnimal ? kgProd / diasAnimal : null,
    pct_ms: pvDen ? kgms / pvDen * 100 : null,
    conversion_ms: kgProd > 0 ? kgms / kgProd : null,
    costo_kg_producido: kgProd > 0 ? (C.alimento + C.estructura + C.sanidad) / kgProd : null,
    precio_prom_pagado: kgi ? C.compra / kgi : null
  };
  out.reposicion = {
    precio_kg: RP.precio_kg, fuente_precio: RP.fuente_precio,
    precio_kg_ms: RP.precio_kg_ms, mes_ms: RP.mes_ms,
    compra: compraR, comision: comR, alimento: aliR, mortandad: mortR,
    total: compraR + comR + aliR + mortR + C.estructura + C.sanidad,
    por_kg_vendido: kge ? (compraR + comR + aliR + mortR + C.estructura + C.sanidad) / kge : null
  };
  out.cobertura_pct = kgi ? kgiConPrecio / kgi * 100 : null;
  return out;
}

// Objeto activo: el remito suelto o el consolidado del grupo, con el origen
// manual de los sin caravana ya aplicado (v15.68).
function remActual() {
  var r = (_remModo === 'grupo' && _remGrupo.length >= 2)
    ? remConsolidar(_remGrupo)
    : (_remData.remitos || {})[_remSel];
  return r ? remAplicarSC(r, remSCCtx()) : r;
}

function remToggleModo() {
  if (_remModo === 'simple') {
    _remModo = 'grupo';
    if (!_remGrupo.length && _remSel) _remGrupo = [_remSel];
  } else {
    _remModo = 'simple';
  }
  renderRemitos();
}
function remToggleRemito(id) {
  var i = _remGrupo.indexOf(id);
  if (i >= 0) _remGrupo.splice(i, 1); else _remGrupo.push(id);
  renderRemitos();
}

function initRemitos() { cargarRemitos(); }

function remSelChange(v) { _remSel = v; renderRemitos(); }

// v15.62.1: al escribir el %, se limpia el monto manual para que el % vuelva a
// mandar; al escribir el monto, ese manda y el % queda de referencia.
function remComInput(campo, valor) {
  var k = remVentaKey(), v = _remLsGet(k);
  var n = parseFloat(String(valor).replace(',', '.'));
  n = isNaN(n) ? null : n;
  if (campo === 'pct') { v.com_venta_pct = n; v.com_venta_monto = null; }
  else { v.com_venta_monto = n; }
  _remLsSet(k, v);
  renderRemitos(true);
}
// Overrides de reposicion. null = automatico (vuelve al valor del JSON).
function remRepoInput(campo, valor) {
  var k = remVentaKey(), v = _remLsGet(k);
  var n = parseFloat(String(valor).replace(',', '.'));
  v[campo] = isNaN(n) ? null : n;
  _remLsSet(k, v);
  renderRemitos(true);
}
function remRepoAuto() {
  var k = remVentaKey(), v = _remLsGet(k);
  v.repoPrecio = null; v.repoMS = null;
  _remLsSet(k, v);
  renderRemitos(true);
}

// v15.68 · origen manual de los sin caravana. null / '' = automático.
function remSCInput(campo, valor) {
  var k = remSCKey(), v = _remLsGet(k);
  if (campo === 'fecha') {
    v.fecha = String(valor || '').trim() || null;
  } else {
    var n = parseFloat(String(valor).replace(',', '.'));
    v[campo] = isNaN(n) ? null : n;
  }
  _remLsSet(k, v);
  renderRemitos(true);
}
function remSCAuto() {
  _remLsSet(remSCKey(), { precio: null, kgCab: null, fecha: null });
  renderRemitos(true);
}

function remVentaInput(campo, valor) {
  var k = remVentaKey(), v = _remLsGet(k);
  var n = parseFloat(String(valor).replace(',', '.'));
  v[campo] = isNaN(n) ? null : n;
  _remLsSet(k, v);
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

/* v15.68 · Línea de supuestos del PDF sobre el origen de los sin caravana. */
function _remSCLineaPDF(r) {
  var v = (r || {}).verificacion || { estado: 'sin_datamars', sc: 0 };
  var vent = v.ventana_dias || 30;
  if (v.estado !== 'verificado')
    return 'Origen sin verificar (sin lecturas de Datamars en la ventana) — vale lo cargado en WinCampo.';
  if (!v.confirmadas)
    return 'Ninguna caravana verificada en los ultimos ' + vent + ' dias'
      + (_remSCDesglose(v, true) ? ' (' + _remSCDesglose(v, true) + ')' : '')
      + ' — vale lo cargado en WinCampo.';
  var ant = v.confirmadas_anterior || 0;
  var sufAnt = ant ? (ant === v.confirmadas ? ' Ninguna se leyo al salir: la verificacion sale de'
                        + ' lecturas anteriores (el ingreso).'
                      : ' ' + ant + ' de las confirmadas salen de una lectura anterior, no de la'
                        + ' pesada de salida.') : '';
  if (!v.sc)
    return 'Verificado contra las lecturas de Datamars de los ultimos ' + vent + ' dias: '
      + v.confirmadas + ' caravanas leidas, ningun animal sin caravana.' + sufAnt;
  var SC = remSCEstado(r);
  var desP = _remSCDesglose(v, true);
  return 'Verificado contra las lecturas de Datamars de los ultimos ' + vent + ' dias. '
    + v.sc + ' animal(es) sin caravana (' + _remN(v.sc_pct_cab, 1) + ' % de las cabezas'
    + (desP ? '; ' + desP : '') + ') — '
    + (SC.manual
        ? ('origen manual $ ' + _remN(SC.precio) + '/kg · ' + _remN(SC.kgCab, 1) + ' kg/cab · ' + _remFec(SC.fecha))
        : ('origen imputado a tropa ' + (v.tropa_imputada || '—')))
    + '.' + sufAnt;
}

function remInformePDF() {
  if (!_remData || !_remSel) return;
  // v15.62: el informe sale igual en modo grupo — el consolidado tiene la
  // misma forma que un remito suelto.
  var r = remActual(); if (!r) return;
  var meta = _remData.meta || {};
  var esGrupo = !!r.esGrupo;
  var titulo = esGrupo ? 'Grupo · ' + r.remitos_ids.join(' + ') : 'Remito ' + _remSel;
  var C = r.costos, I = r.indicadores, RP = r.reposicion;
  var venta = remVentaCtx();
  var V = remVentaCalc(venta), RPc = remRepoCalc(r, venta);
  var kgc = V.kgc, pkg = V.pkg, gastos = V.gastos, bruto = V.bruto, neto = V.neto, hayVenta = bruto > 0;
  var res = neto - C.total, resRepo = neto - RPc.total;
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
    + '<title>Resultado ' + titulo + ' · PEGSA &amp; Bulltrade</title>'
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
    + '<div class="t" style="font-size:27px;line-height:1.1">' + titulo + '</div>'
    + '<div style="font-size:10px;color:#6b6560;margin-top:3px">'
    + (r.fecha_egreso ? r.fecha_egreso.split('-').reverse().join('/') + ' · ' : '')
    + r.cabezas + ' cabezas · ' + r.tropas + ' tropas · ' + _remN(r.kg_ingreso) + ' → ' + _remN(r.kg_egreso) + ' kg'
    + ' · cobertura precios ' + _remN(r.cobertura_pct, 1) + ' %</div>'
    + (esGrupo ? '<div style="font-size:9.5px;color:#8a827a;margin-top:2px">' + r.remitos_detalle.map(function (d) {
        return d.id + (d.fecha_egreso ? ' (' + d.fecha_egreso.split('-').reverse().join('/') + ')' : '');
      }).join(' + ') + '</div>' : '')
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
      + '<div class="kc"><div class="l">Gastos de venta</div><div class="v neg">' + _remMM(-gastos) + '</div>'
      + (V.comVenta ? '<div class="u">com. venta ' + _remM(V.comVenta) + ' (' + _remN(V.comPct, 1) + ' %)</div>'
                      + '<div class="u">flete y guías ' + _remM(V.otros) + '</div>'
                    : '<div class="u">$ ' + _remN(gastos / kgc, 2) + '/kg carne</div>') + '</div>'
      + '<div class="kc"><div class="l">Venta neta</div><div class="v">' + _remMM(neto) + '</div><div class="u">' + _remN(kgc) + ' kg carne</div></div>'
      + '<div class="kc big"><div class="l">Resultado</div><div class="v">' + _remMM(res) + '</div><div class="u">'
      + _remN(res / C.total * 100, 1) + ' % s/costo · ' + _remM(res / r.cabezas) + '/cab</div></div>'
      + '</div>';
    // v15.71 · rinde y precio por kg vivo, misma fila de tarjetas
    var KVp = remVentaKgVivo(r, V);
    if (KVp) {
      h += '<div class="k" style="grid-template-columns:repeat(2,1fr)">'
        + '<div class="kc"><div class="l">Rinde</div><div class="v">' + _remN(KVp.rinde, 2) + ' %</div>'
        + '<div class="u">' + _remN(kgc) + ' kg carne / ' + _remN(KVp.kgVivo) + ' kg vivo</div></div>'
        + '<div class="kc"><div class="l">Precio kg vivo</div><div class="v">$ ' + _remN(KVp.bruto) + '</div>'
        + '<div class="u">neto de gastos: $ ' + _remN(KVp.neto) + '/kg vivo</div></div>'
        + '</div>';
    }
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
    + '<div class="t" style="font-size:20px">' + _remM(RPc.total) + '</div>'
    + '<div style="font-size:9px;color:#8a827a">$ ' + _remN(RPc.por_kg_vendido) + ' / kg vendido · hist $ ' + _remN(C.por_kg_vendido) + '</div>'
    + '<div style="font-size:9px;color:#6b6560;margin-top:4px">' + (RPc.manualP ? 'manual' : RP.fuente_precio)
    + ' $ ' + _remN(RPc.precio) + '/kg · MS ' + (RPc.manualMs ? 'manual' : RP.mes_ms) + ' $ ' + _remN(RPc.precioMs, 2) + '</div></div>'
    + (hayVenta
        ? '<div class="kc big" style="text-align:right"><div class="l">Resultado a reposición</div>'
          + '<div class="v" style="font-size:24px;color:' + (resRepo >= 0 ? '#d4a84b' : '#ff8b7d') + '">' + _remM(resRepo) + '</div>'
          + '<div class="u">' + _remN(resRepo / RPc.total * 100, 1) + ' % s/costo repo</div>'
          + '<div class="u">histórico ' + _remM(res) + ' · dif ' + (resRepo - res >= 0 ? '+' : '') + _remM(resRepo - res) + '</div>'
          + '<div class="u" style="margin-top:3px">comprando y alimentando a precios de hoy</div></div>'
        : '<div class="kc" style="text-align:right"><div class="rl">Resultado a reposición</div>'
          + '<div class="t" style="font-size:20px;color:#8a827a">—</div>'
          + '<div style="font-size:9px;color:#8a827a">sin venta cargada</div>'
          + '<div style="font-size:9px;color:#8a827a;margin-top:3px">comprando y alimentando a precios de hoy</div></div>')
    + '</div>';

  // 6 · Pie — los supuestos salen de meta, no hardcodeados
  h += '<div class="ft">Generado el ' + fh + ' · Portal PEGSA v15.71 · Supuestos: %PV real por mes (límites '
    + _remN(meta.pv_min, 1) + '–' + _remN(meta.pv_max, 1) + ' %) · consumo Vaca +' + Math.round((meta.factor_vaca - 1) * 100) + ' %'
    + ' · mortandad Vacas ' + _remN(tas.Vaca, 2) + ' % / Machos ' + _remN(tas.Novillo, 2) + ' % / Hembras ' + _remN(tas.Vaquillona, 2) + ' %'
    + (RPc.manual ? ' · reposición a precio manual $ ' + _remN(RPc.precio) + '/kg'
                    + (RPc.manualMs ? ' y MS $ ' + _remN(RPc.precioMs, 2) : '') : '')
    + (V.comVenta ? ' · comisión de venta ' + _remN(V.comPct, 1) + ' %' : '')
    + (nSin ? ' · ' + nSin + ' tropa(s) sin precio estimadas al promedio de las compañeras' : '')
    // v15.68: el origen de los sin caravana es un supuesto, y va dicho.
    + '<br>' + _remSCLineaPDF(r)
    + '</div></body></html>';

  // v15.69.1: además del PDF, guardar el resultado de esta venta.
  try { remGuardarSnapshot(r); } catch (e) {}

  var win = window.open('', '_blank');
  if (!win) { alert('El navegador bloqueó la ventana del informe. Permití las ventanas emergentes para este sitio.'); return; }
  win.document.open();
  win.document.write(h);
  win.document.close();
  // Dar tiempo a que bajen las fuentes antes de abrir el diálogo de impresión
  win.onload = function () { setTimeout(function () { win.focus(); win.print(); }, 550); };
}

/* v15.68 · Estado efectivo del origen de los sin caravana: lo que cargó el
   usuario, y si no, lo que imputó el pipeline. */
function remSCEstado(r) {
  var VI = ((r || {}).verificacion || {}).imputado || {};
  var m = remSCCtx();
  // El bloque `imputado` del pipeline puede traer precio_kg en null cuando la
  // tropa imputada no está en el Excel de compras. En ese caso el prefill sale
  // de la fila imputada, que es el valor que el motor terminó usando (el
  // promedio estimado de las compañeras del remito).
  var fi = (r && r.filas || []).filter(function (f) { return f.imputado; })[0] || {};
  var kgFila = fi.cabezas ? fi.kg_ingreso / fi.cabezas : null;
  return {
    precio: m.precio != null ? m.precio : (VI.precio_kg != null ? VI.precio_kg : (fi.precio_kg != null ? fi.precio_kg : null)),
    kgCab: m.kgCab != null ? m.kgCab : (VI.kg_ingreso_cab != null ? VI.kg_ingreso_cab : kgFila),
    fecha: m.fecha || VI.fecha_ingreso || fi.fecha_ingreso || null,
    mP: m.precio != null, mK: m.kgCab != null, mF: !!m.fecha,
    manual: (m.precio != null || m.kgCab != null || !!m.fecha)
  };
}

function _remFec(f) { return f ? String(f).split('-').reverse().join('/') : '—'; }

/* v15.71 · Las dos medidas de la venta contra el KG VIVO de egreso (no contra
   los kg de carne): el rinde y lo que se termina cobrando por kilo de animal
   que salio del corral. Es la forma en que Nicolas compara ventas entre si. */
function remVentaKgVivo(r, V) {
  var kgv = r.kg_egreso || 0;
  if (!kgv || !V || !(V.bruto > 0)) return null;
  return {
    kgVivo: kgv,
    rinde: V.kgc ? V.kgc / kgv * 100 : null,
    bruto: V.bruto / kgv,
    neto: V.neto / kgv
  };
}

/* v15.69.1 · Snapshot del resultado de una venta ───────────────────
   Todo lo que muestra el PDF, ya con los overrides aplicados, en un JSON que se
   baja al disco. La venta se prorratea por fila segun sus kg de egreso, asi que
   los agregados por tropa y por hotelero del pipeline cierran contra la neta. */
function remSnapshot(r) {
  var venta = remVentaCtx(), V = remVentaCalc(venta), RPc = remRepoCalc(r, venta);
  var SC = remSCEstado(r), C = r.costos, I = r.indicadores;
  var ids = (r.esGrupo ? r.remitos_ids.slice() : [_remSel]).slice().sort();
  // El prorrateo va sobre la suma de los kg de las FILAS, no sobre
  // r.kg_egreso: los dos vienen redondeados por separado y la diferencia
  // (unos gramos) dejaba la venta prorrateada corta por ~$1.500. Asi la suma
  // de venta_prorrateada da la neta exacta.
  var kge = (r.filas || []).reduce(function (a, f) { return a + (f.kg_egreso || 0); }, 0);
  var res = V.neto - C.total;
  var _kv = remVentaKgVivo(r, V);
  var v = r.verificacion || {};

  var filas = (r.filas || []).map(function (f) {
    var com = (f.costo_compra || 0) * (f.comision_pct || 0) / 100;
    var costo = (f.costo_compra || 0) + com + (f.alimento || 0)
              + (f.estructura || 0) + (f.sanidad || 0) + (f.mortandad || 0);
    var vp = kge ? V.neto * (f.kg_egreso || 0) / kge : 0;
    return {
      remito: f.remito || ids[0],
      tropa: f.tropa, hotelero: f.hotelero, categoria: f.categoria,
      corral: f.corral, cabezas: f.cabezas,
      kg_ingreso: f.kg_ingreso, kg_egreso: f.kg_egreso, dias: f.dias,
      precio_kg: f.precio_kg, estimado: !!f.estimado,
      costo_compra: f.costo_compra, comision: com,
      alimento: f.alimento, estructura: f.estructura,
      sanidad: f.sanidad, mortandad: f.mortandad,
      costo_fila: costo,
      origen: f.origen, sc_tipo: f.sc_tipo || null,
      venta_prorrateada: vp,
      resultado_fila: vp - costo
    };
  });

  return {
    id: ids.join('-') + '_' + (r.fecha_egreso || ''),
    generado: new Date().toISOString(),
    version_portal: 'v15.71',
    remitos: ids,
    es_grupo: !!r.esGrupo,
    fecha_egreso: r.fecha_egreso,
    comprador: r.comprador,
    cabezas: r.cabezas, tropas: r.tropas,
    kg_ingreso: r.kg_ingreso, kg_egreso: r.kg_egreso,
    kg_producidos: r.kg_producidos, kg_ms: r.kg_ms,
    venta: {
      kg_carne: V.kgc, precio_kg: V.pkg, bruta: V.bruto,
      flete: venta.flete || 0, pesada: venta.pesada || 0,
      guia_senasa: venta.guia_senasa || 0, guia_comuna: venta.guia_comuna || 0,
      com_venta_pct: (V.bruto ? V.comVenta / V.bruto * 100 : null),
      com_venta_monto: V.comVenta, com_venta_manual: !!V.comManual,
      gastos: V.gastos, neta: V.neto,
      // v15.71: las tres medidas contra el kg vivo de egreso
      rinde_pct: (_kv ? _kv.rinde : null),
      precio_kg_vivo_bruto: (_kv ? _kv.bruto : null),
      precio_kg_vivo_neto: (_kv ? _kv.neto : null)
    },
    costos: {
      compra: C.compra, comision: C.comision, alimento: C.alimento,
      estructura: C.estructura, sanidad: C.sanidad, mortandad: C.mortandad,
      total: C.total, por_kg_vendido: C.por_kg_vendido
    },
    resultado: {
      monto: res,
      pct_costo: (C.total ? res / C.total * 100 : null),
      por_cab: (r.cabezas ? res / r.cabezas : null)
    },
    indicadores: {
      kg_prom_ingreso: I.kg_prom_ingreso, kg_prom_salida: I.kg_prom_salida,
      estadia_prom: I.estadia_prom, adp: I.adp, pct_ms: I.pct_ms,
      conversion_ms: I.conversion_ms, costo_kg_producido: I.costo_kg_producido,
      precio_prom_pagado: I.precio_prom_pagado
    },
    reposicion: {
      precio_kg: RPc.precio, precio_kg_ms: RPc.precioMs, manual: RPc.manual,
      costos: { compra: RPc.compra, comision: RPc.comision, alimento: RPc.alimento,
                mortandad: RPc.mortandad, total: RPc.total,
                por_kg_vendido: RPc.por_kg_vendido },
      resultado: V.neto - RPc.total
    },
    verificacion: {
      estado: v.estado, ventana_dias: v.ventana_dias,
      confirmadas: v.confirmadas || 0, sc: v.sc || 0,
      sc_sin_electronica: v.sc_sin_electronica || 0,
      sc_no_leida: v.sc_no_leida || 0,
      confirmadas_anterior: v.confirmadas_anterior || 0,
      tropa_imputada: v.tropa_imputada || null,
      origen_manual: SC.manual
        ? { precio_kg: SC.precio, kg_ingreso_cab: SC.kgCab, fecha_ingreso: SC.fecha }
        : null
    },
    filas: filas
  };
}

/* Guarda el snapshot en localStorage y lo baja al disco. */
function remGuardarSnapshot(r) {
  var snap = remSnapshot(r);
  var hist = [];
  try { hist = JSON.parse(localStorage.getItem(REM_LS_HIST) || '[]') || []; } catch (e) { hist = []; }
  // una venta = un registro: la ultima version manda
  hist = hist.filter(function (x) { return x.id !== snap.id; });
  hist.push(snap);
  try { localStorage.setItem(REM_LS_HIST, JSON.stringify(hist)); } catch (e) {}

  var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
  var stamp = d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate())
            + '-' + z(d.getHours()) + z(d.getMinutes());
  var nombre = 'resultado_' + snap.remitos.join('-') + '_' + (snap.fecha_egreso || 's-f')
             + '_' + stamp + '.json';
  try {
    var blob = new Blob([JSON.stringify(snap, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) {}
  remToast('Resultado guardado — mové <strong>' + nombre + '</strong> a '
    + '<code>PEGSA_Portal\\datos\\resultados_ventas\\</code> para que entre al historial');
  return snap;
}

function remHistDe(id) {
  var hist = [];
  try { hist = JSON.parse(localStorage.getItem(REM_LS_HIST) || '[]') || []; } catch (e) { hist = []; }
  return hist.filter(function (x) { return x.id === id; });
}
function remBajarSnapshot(id) {
  var x = remHistDe(id)[0];
  if (!x) return;
  try {
    var blob = new Blob([JSON.stringify(x, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'resultado_' + x.remitos.join('-') + '_' + (x.fecha_egreso || 's-f') + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) {}
}

/* Aviso efimero abajo a la derecha. */
function remToast(html) {
  try {
    var t = document.createElement('div');
    t.innerHTML = html;
    t.style.cssText = 'position:fixed;right:22px;bottom:22px;z-index:9999;max-width:420px;'
      + 'background:var(--ink,#1a1612);color:#f5f2ec;padding:13px 17px;border-radius:3px;'
      + "font-family:'DM Mono',monospace;font-size:12px;line-height:1.6;"
      + 'box-shadow:0 6px 24px rgba(0,0,0,.25);transition:opacity .4s';
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, 7000);
    setTimeout(function () { t.remove(); }, 7600);
  } catch (e) {}
}

/* v15.69 · Fantasmas ──────────────────────────────────────────────
   Una caravana fantasma es un EID que el baston leyo el dia de una salida y que
   sigue en el stock de WinCampo: la vaca salio de verdad, pero en los papeles
   quedo adentro. Renombrarla a un placeholder es lo que le permite salir en la
   proxima venta como "sin caravana". Cuando el cargador la renombra desaparece
   sola de esta lista al tick siguiente. */
function remFantLista() {
  var f = (_remFant && _remFant.fantasmas) || [];
  return f.filter(function (x) {
    return (!_remFantHot || x.hotelero === _remFantHot)
        && (!_remFantFec || x.fecha_lectura === _remFantFec);
  });
}
function remFantToggle() { _remFantOpen = !_remFantOpen; renderRemitos(); }
function remFantFiltro(campo, v) {
  if (campo === 'hot') _remFantHot = (v === _remFantHot ? '' : v);
  else _remFantFec = (v === _remFantFec ? '' : v);
  renderRemitos();
}
function remFantCopiar(t) {
  try { navigator.clipboard.writeText(t); } catch (e) {}
}
function remFantCSV() {
  var COL = ['fecha_lectura', 'placeholder_sugerido', 'eid', 'caravana_visual', 'hotelero',
             'tropa', 'categoria', 'corral', 'kg_ingreso', 'fecha_ingreso', 'dias_en_stock',
             'peso_lectura', 'sesion_id', 'sesion_nombre'];
  var filas = remFantLista();
  var txt = COL.join(';') + ';remitos_del_dia\n' + filas.map(function (x) {
    return COL.map(function (c) {
      var v = x[c] == null ? '' : String(x[c]);
      return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(';') + ';' + (x.remitos_del_dia || []).map(function (d) { return d.remito; }).join(' ');
  }).join('\n');
  // BOM para que Excel en es-AR abra los acentos bien
  var blob = new Blob(['\ufeff' + txt], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'caravanas_fantasma_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* v15.68.5 · Desglose de los sin caravana. Son dos problemas distintos:
   - sin caravana electrónica: WinCampo no tiene el número (código visual o el
     placeholder que pone el cargador) — no hay nada que cruzar contra la balanza.
   - electrónica no leída: el número está, pero el bastón no lo leyó en los
     últimos 30 días.
   Las dos se imputan igual; la diferencia dice de qué lado está el problema. */
function _remSCDesglose(v, ascii) {
  var a = v.sc_sin_electronica || 0, b = v.sc_no_leida || 0;
  if (!a && !b) return '';
  var p = [];
  if (a) p.push(a + (ascii ? ' sin caravana electronica' : ' sin caravana electrónica'));
  if (b) p.push(b + (ascii ? ' electronica(s) no leida(s)' : ' electrónica' + (b === 1 ? '' : 's') + ' no leída' + (b === 1 ? '' : 's')));
  return p.join(' · ');
}
var REM_SC_TOOLTIP = 'Solo la caravana electrónica se cruza con la balanza; un código visual o el '
  + 'placeholder del cargador es sin caravana directo. Todas se imputan igual — el desglose dice si '
  + 'el problema es la carga en WinCampo o la lectura del bastón.';

/* Texto y tono del badge de verificación (lo comparten el módulo y el PDF).

   v15.68.2: el pipeline ya no matchea remito contra sesión de balanza — busca
   cada caravana en TODAS las lecturas de los últimos 30 días. Estados posibles:
   'verificado' y 'sin_datamars'. El rojo no es un estado: es un remito
   verificado al que no se le leyó NINGUNA caravana, así que no hay de dónde
   imputar y hay que cargarle el origen a mano. */
function remVerifInfo(r, SC) {
  var v = (r || {}).verificacion || { estado: 'sin_datamars', sc: 0 };
  var sc = v.sc || 0, conf = v.confirmadas || 0, vent = v.ventana_dias || 30;
  // Confirmar por una lectura ANTERIOR (el ingreso) no es lo mismo que
  // confirmar por la pesada de salida: al animal se lo vio en el campo, pero
  // nadie lo leyó subiendo al camión. El remito 2229 es todo de este tipo.
  var ant = v.confirmadas_anterior || 0;
  var sufAnt = ant ? ' · ' + (ant === conf ? 'ninguna leída al salir'
                              : ant + ' por lectura anterior, no al salir') : '';
  if (v.estado !== 'verificado')
    return { tono: 'gris', txt: 'Sin lecturas de Datamars en la ventana — valen los datos de WinCampo.' };
  if (!conf) {
    var desR = _remSCDesglose(v);
    return { tono: 'mal', txt: 'Ninguna caravana verificada en los últimos ' + vent + ' días'
      + (desR ? ' (' + desR + ')' : '') + ' — vale WinCampo, hay que cargar el origen a mano.' };
  }
  if (!sc)
    return { tono: ant ? 'aviso' : 'ok',
      txt: '&#10003; Datamars · ' + conf + ' caravana' + (conf === 1 ? '' : 's')
        + ' leída' + (conf === 1 ? '' : 's') + ' en los últimos ' + vent + ' días · 0 sin caravana'
        + sufAnt };
  var org = (SC && SC.manual)
    ? ('origen manual $ ' + _remN(SC.precio) + '/kg · ' + _remN(SC.kgCab) + ' kg/cab · ' + _remFec(SC.fecha))
    : ('origen imputado a tropa ' + (v.tropa_imputada || '—'));
  var des = _remSCDesglose(v);
  return {
    tono: 'aviso',
    txt: '&#10003; Datamars · <strong>' + sc + ' sin caravana</strong> (' + _remN(v.sc_pct_cab, 1)
      + ' % cab · ' + _remN(v.sc_pct_kg, 1) + ' % kg)'
      + (des ? ' — <span title="' + REM_SC_TOOLTIP + '" style="border-bottom:1px dotted;cursor:help">'
               + des + '</span>' : '')
      + sufAnt + ' — ' + org
  };
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
  // v15.62: en modo grupo (>=2 remitos) se trabaja sobre el consolidado, que
  // tiene la misma forma que un remito suelto — nada de abajo se ramifica.
  _remGrupo = _remGrupo.filter(function (id) { return !!remitos[id]; });
  var esGrupo = _remModo === 'grupo' && _remGrupo.length >= 2;
  var r = remActual();
  var meta = _remData.meta || {};
  if (!r) { el.innerHTML = ''; return; }

  var venta = remVentaCtx();
  var V = remVentaCalc(venta);
  var kgc = V.kgc, pkg = V.pkg, gastos = V.gastos, bruto = V.bruto, neto = V.neto;
  var costo = r.costos.total, res = neto - costo;
  var RPc = remRepoCalc(r, venta);          // reposición con overrides
  var resRepo = neto - RPc.total;

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

  // ── v15.69 · Caravanas fantasma (encabezado, colapsable) ──
  var FT = (_remFant && _remFant.meta) || null;
  if (FT && FT.total) {
    var fl = remFantLista();
    h += '<div style="background:#fff;border:1px solid var(--gold);border-radius:3px;margin-bottom:10px">'
      + '<div onclick="remFantToggle()" style="padding:12px 18px;cursor:pointer;display:flex;'
      + 'align-items:center;gap:12px;flex-wrap:wrap">'
      + '<span style="font-family:\'Playfair Display\',serif;font-size:17px;font-weight:700">'
      + '&#9888; Caravanas fantasma · ' + FT.total + '</span>'
      + '<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.55);flex:1;min-width:240px">'
      + 'leídas por el bastón en una salida y todavía en stock de WinCampo — renombrar a placeholder '
      + 'para darles salida como sin caravana</span>'
      + '<span style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--gold)">'
      + (_remFantOpen ? '&#9650; ocultar' : '&#9660; ver') + '</span></div>';
    if (_remFantOpen) {
      h += '<div style="padding:0 18px 16px">';
      // chips de totales por hotelero y por fecha (son filtros)
      var chip = function (txt, on, onclick) {
        return '<span onclick="' + onclick + '" style="cursor:pointer;padding:3px 9px;border-radius:2px;'
          + 'font-family:\'DM Mono\',monospace;font-size:11px;margin:0 5px 5px 0;display:inline-block;'
          + (on ? 'background:var(--ink);color:#d4a84b;border:1px solid var(--ink)'
                : 'background:#faf8f4;color:var(--ink);border:1px solid #e3e1da') + '">' + txt + '</span>';
      };
      h += '<div style="margin-bottom:8px">'
        + Object.keys(FT.por_hotelero || {}).map(function (k) {
            return chip(k + ' · ' + FT.por_hotelero[k], _remFantHot === k,
                        'remFantFiltro(\'hot\',\'' + k.replace(/'/g, "\\'") + '\')');
          }).join('')
        + '</div><div style="margin-bottom:10px">'
        + Object.keys(FT.por_fecha || {}).map(function (k) {
            return chip(_remFec(k) + ' · ' + FT.por_fecha[k], _remFantFec === k,
                        'remFantFiltro(\'fec\',\'' + k + '\')');
          }).join('')
        + (_remFantHot || _remFantFec
            ? '<a onclick="_remFantHot=\'\';_remFantFec=\'\';renderRemitos()" style="cursor:pointer;'
              + 'font-family:\'DM Mono\',monospace;font-size:11px;color:var(--gold);text-decoration:underline;'
              + 'margin-left:6px">quitar filtros</a>' : '')
        + '<button onclick="remFantCSV()" style="float:right;padding:6px 14px;background:var(--ink);'
        + 'border:1px solid var(--ink);border-radius:2px;color:#d4a84b;font-family:\'DM Mono\',monospace;'
        + 'font-size:11px;cursor:pointer">&#11015; Exportar CSV</button></div>';
      var TH = ['Fecha lectura', 'Hotelero', 'Tropa', 'Cat', 'Corral', 'EID', 'Kg ing',
                'Fecha ingreso', 'Días', 'Peso leído', 'Remitos del día', 'Placeholder sugerido'];
      h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;'
        + 'font-family:\'DM Mono\',monospace;background:#fff;border:1px solid var(--border)"><thead><tr>'
        + TH.map(function (t, i) {
            return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;'
              + 'color:rgba(26,22,18,.5);padding:8px 9px;border-bottom:2px solid var(--border);'
              + 'text-align:' + (i < 5 ? 'left' : 'right') + ';white-space:nowrap">' + t + '</th>';
          }).join('') + '</tr></thead><tbody>';
      fl.forEach(function (x) {
        var td = 'padding:7px 9px;border-bottom:1px solid #f0eee8;font-size:12px;white-space:nowrap';
        h += '<tr>'
          + '<td style="' + td + '">' + _remFec(x.fecha_lectura) + '</td>'
          + '<td style="' + td + '">' + (x.hotelero || '—') + '</td>'
          + '<td style="' + td + '">' + (x.tropa || '—') + '</td>'
          + '<td style="' + td + '">' + (x.categoria || '—') + '</td>'
          + '<td style="' + td + '">' + (x.corral || '—') + '</td>'
          + '<td style="' + td + ';text-align:right">' + x.eid
          + (x.caravana_visual ? '<span style="color:rgba(26,22,18,.4)"> · ' + x.caravana_visual + '</span>' : '')
          + '</td>'
          + '<td style="' + td + ';text-align:right">' + _remN(x.kg_ingreso) + '</td>'
          + '<td style="' + td + ';text-align:right">' + _remFec(x.fecha_ingreso) + '</td>'
          + '<td style="' + td + ';text-align:right">' + x.dias_en_stock + '</td>'
          + '<td style="' + td + ';text-align:right">' + _remN(x.peso_lectura) + '</td>'
          + '<td style="' + td + ';text-align:right;color:rgba(26,22,18,.5)">'
          + (x.remitos_del_dia || []).map(function (d) { return d.remito; }).join(' ') + '</td>'
          + '<td style="' + td + ';text-align:right"><strong>' + x.placeholder_sugerido + '</strong>'
          + '<span onclick="remFantCopiar(\'' + x.placeholder_sugerido + '\')" title="copiar" '
          + 'style="cursor:pointer;margin-left:7px;color:var(--gold)">&#128203;</span></td></tr>';
      });
      h += '</tbody></table></div>';
      h += '<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.45);'
        + 'margin-top:9px;line-height:1.6">' + fl.length + ' de ' + FT.total + ' · '
        + 'Cuando el cargador las renombra en WinCampo desaparecen solas de esta lista al tick '
        + 'siguiente — no hay nada que marcar a mano. Criterio: EID leído el mismo día que un remito '
        + 'de venta, todavía en stock, ingresado hace más de ' + FT.dias_min + ' días y ausente de '
        + 'los remitos de ese día.</div></div>';
    }
    h += '</div>';
  }

  // ── Selector + carga de venta ──
  h += '<div style="background:#fff;border:1px solid var(--border);border-radius:3px;padding:16px 20px;margin-bottom:6px;display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap">';
  // v15.62: toggle de modo. En grupo el <select> se reemplaza por chips.
  h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">Modo</label>'
    + '<button onclick="remToggleModo()" style="padding:7px 14px;border-radius:2px;cursor:pointer;'
    + 'font-family:\'DM Mono\',monospace;font-size:12px;white-space:nowrap;'
    + (esGrupo || _remModo === 'grupo'
        ? 'background:var(--ink);border:1px solid var(--ink);color:#d4a84b">✓ Agrupar'
        : 'background:#faf8f4;border:1px solid #d8d6ce;color:var(--ink)">Agrupar')
    + '</button></div>';
  if (_remModo === 'grupo') {
    h += '<div style="display:flex;flex-direction:column;gap:5px;flex:1;min-width:260px">'
      + '<label style="' + LBL + '">Remitos del grupo · ' + _remGrupo.length + ' seleccionado'
      + (_remGrupo.length === 1 ? '' : 's') + (_remGrupo.length < 2 ? ' (mínimo 2)' : '') + '</label>'
      + '<div style="display:flex;flex-wrap:wrap;gap:5px;max-height:92px;overflow:auto;'
      + 'border:1px solid #d8d6ce;border-radius:2px;padding:7px;background:#faf8f4">'
      + nros.map(function (n) {
          var on = _remGrupo.indexOf(n) >= 0;
          return '<span onclick="remToggleRemito(\'' + n + '\')" style="cursor:pointer;padding:3px 9px;border-radius:2px;'
            + 'font-family:\'DM Mono\',monospace;font-size:12px;'
            + (on ? 'background:var(--ink);color:#d4a84b;border:1px solid var(--ink)'
                  : 'background:#fff;color:var(--ink);border:1px solid #e3e1da')
            + '">' + n + (remVentaGet(n).kg_carne ? ' ✓' : '') + '</span>';
        }).join('')
      + '</div></div>';
  } else {
  h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">Remito de salida</label>'
    + '<select onchange="remSelChange(this.value)" style="' + INP + ';width:150px">'
    + nros.map(function (n) { return '<option value="' + n + '"' + (n === _remSel ? ' selected' : '') + '>' + n + (remVentaGet(n).kg_carne ? ' ✓' : '') + '</option>'; }).join('')
    + '</select></div>';
  }
  var CAMPOS = [['kg_carne', 'Kg carne'], ['precio_kg', '$ / kg carne'], ['flete', 'Flete'],
                ['pesada', 'Pesada'], ['guia_senasa', 'Guía SENASA'], ['guia_comuna', 'Guía comuna']];
  CAMPOS.forEach(function (c) {
    h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">' + c[1] + '</label>'
      + '<input value="' + (venta[c[0]] != null ? venta[c[0]] : '') + '" style="' + INP + '" '
      + 'onchange="remVentaInput(\'' + c[0] + '\',this.value)"></div>';
  });
  // v15.62.1: comisión del consignatario/frigorífico. El $ manual pisa al %.
  h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">% com. venta</label>'
    + '<input value="' + (venta.com_venta_pct != null ? venta.com_venta_pct : '') + '" style="' + INP + ';width:92px" '
    + 'onchange="remComInput(\'pct\',this.value)"></div>';
  h += '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">$ com. venta'
    + (V.comVenta && !V.comManual ? ' (calc.)' : '') + '</label>'
    + '<input value="' + (V.comManual ? venta.com_venta_monto : (V.comVenta ? Math.round(V.comVenta) : '')) + '" style="' + INP + '" '
    + 'onchange="remComInput(\'monto\',this.value)"></div>';
  // v15.60: informe de una página para compartir
  h += '<div style="margin-left:auto;display:flex;flex-direction:column;gap:5px">'
    + '<button onclick="remInformePDF()" style="padding:8px 16px;background:var(--ink);border:1px solid var(--ink);border-radius:2px;'
    + 'color:#d4a84b;font-family:\'DM Mono\',monospace;font-size:12px;cursor:pointer;white-space:nowrap">&#128196; Informe PDF</button></div>';
  h += '</div>';
  h += '<div style="' + SUB + ';margin:0 0 16px">Carga local en este navegador — se migrará a base de datos.'
    + (_remHist && _remHist.meta && _remHist.meta.n_ventas
        ? ' · Historial: <strong>' + _remHist.meta.n_ventas + ' venta'
          + (_remHist.meta.n_ventas === 1 ? '' : 's') + ' consolidada'
          + (_remHist.meta.n_ventas === 1 ? '' : 's') + '</strong>'
          + (_remHist.meta.hasta ? ' (última ' + _remFec(_remHist.meta.hasta) + ')' : '')
        : '')
    + '</div>';

  // v15.69.1 · snapshots de ESTA venta guardados en este navegador
  var _idV = (esGrupo ? r.remitos_ids.slice().sort() : [_remSel]).join('-') + '_' + (r.fecha_egreso || '');
  var _snaps = remHistDe(_idV);
  if (_snaps.length) {
    h += '<div style="' + SUB + ';margin:-10px 0 16px">Historial de esta venta · '
      + _snaps.map(function (x) {
          return String(x.generado || '').slice(0, 16).replace('T', ' ');
        }).join(' · ')
      + ' <a onclick="remBajarSnapshot(\'' + _idV + '\')" style="cursor:pointer;color:var(--gold);'
      + 'text-decoration:underline">descargar de nuevo</a></div>';
  }

  // ── Cabecera del remito ──
  h += '<div style="' + H2 + '">' + (esGrupo ? 'Grupo · ' + r.remitos_ids.join(' + ') : 'Remito ' + _remSel) + '</div>';
  if (esGrupo) {
    // qué remitos lo componen, con su fecha de egreso
    h += '<div style="' + SUB + ';margin-bottom:6px">' + r.remitos_detalle.map(function (d) {
      return d.id + (d.fecha_egreso ? ' (' + d.fecha_egreso.split('-').reverse().join('/') + ' · ' + d.cabezas + ' cab)' : '');
    }).join(' + ') + '</div>';
    // aviso suave si algún remito del grupo ya tenía venta individual cargada
    var conVenta = r.remitos_ids.filter(function (id) { return remVentaGet(id).kg_carne; });
    if (conVenta.length) {
      h += '<div style="' + WARN + '">El remito ' + conVenta.join(', ') + ' tiene una venta individual cargada; '
        + 'en modo grupo se usa la venta del grupo. No se borró nada — al volver a modo simple sigue ahí.</div>';
    }
  }
  h += '<div style="' + SUB + '">' + r.cabezas + ' cabezas · ' + r.tropas + ' tropas' + (esGrupo ? ' únicas' : '') + ' · '
    + _remN(r.kg_ingreso) + ' kg entrada → ' + _remN(r.kg_egreso) + ' kg salida (+'
    + _remN(r.kg_producidos) + ' kg) · ' + _remN(r.kg_ms) + ' kg MS consumidos'
    + (r.comprador ? ' · ' + r.comprador : '') + '</div>';

  // ── v15.68 · Verificación contra la lectura del bastón (Datamars) ──
  var SC = remSCEstado(r);
  var VF = remVerifInfo(r, SC);
  var VER = r.verificacion || {};
  var TONO = {
    ok:    ['#f2f7f3', '#27613d', '#27613d'],
    aviso: ['#fdf6e3', 'var(--gold)', '#7a5c14'],
    gris:  ['#f6f5f2', '#d8d6ce', 'rgba(26,22,18,.5)'],
    mal:   ['#fdf1ef', '#c0392b', '#a3311f']
  }[VF.tono];
  h += '<div style="background:' + TONO[0] + ';border:1px solid ' + TONO[1] + ';border-radius:2px;'
    + 'padding:10px 14px;margin:0 0 14px;font-family:\'DM Mono\',monospace;font-size:12px;'
    + 'color:' + TONO[2] + ';line-height:1.6">' + VF.txt + '</div>';

  // v15.69: si el bastón leyó caravanas ese día que siguen en stock, decirlo acá
  // — son las que hay que renombrar para que puedan salir en la próxima venta.
  var _fechasR = esGrupo
    ? (r.remitos_detalle || []).map(function (d) { return d.fecha_egreso; })
    : [r.fecha_egreso];
  var _fant = ((_remFant && _remFant.fantasmas) || []).filter(function (x) {
    return _fechasR.indexOf(x.fecha_lectura) >= 0;
  });
  if (_fant.length) {
    var _hots = [];
    _fant.forEach(function (x) { if (_hots.indexOf(x.hotelero) < 0) _hots.push(x.hotelero); });
    h += '<div style="' + SUB + ';margin:-8px 0 14px">' + _fant.length
      + ' caravana' + (_fant.length === 1 ? '' : 's') + ' leída' + (_fant.length === 1 ? '' : 's')
      + ' ese día sigue' + (_fant.length === 1 ? '' : 'n') + ' en stock (' + _hots.join(', ') + ') → '
      + '<a onclick="_remFantOpen=true;_remFantFec=\'' + _fant[0].fecha_lectura + '\';renderRemitos()" '
      + 'style="cursor:pointer;color:var(--gold);text-decoration:underline">ver Fantasmas</a></div>';
  }

  // Carga manual del origen de los sin caravana (mismo patrón que reposición).
  if (VER.sc) {
    h += '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:12px 16px;'
      + 'margin-bottom:14px;display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap">'
      + '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">$/kg ingreso · '
      + (SC.mP ? '<span style="color:var(--gold)">manual</span>' : 'automático') + '</label>'
      + '<input value="' + (SC.precio != null ? _remN(SC.precio) : '') + '" style="' + INP + '" '
      + 'onchange="remSCInput(\'precio\',this.value)"></div>'
      + '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">Kg ingreso / cab · '
      + (SC.mK ? '<span style="color:var(--gold)">manual</span>' : 'automático') + '</label>'
      + '<input value="' + (SC.kgCab != null ? _remN(SC.kgCab, 1) : '') + '" style="' + INP + '" '
      + 'onchange="remSCInput(\'kgCab\',this.value)"></div>'
      + '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">Fecha ingreso · '
      + (SC.mF ? '<span style="color:var(--gold)">manual</span>' : 'automático') + '</label>'
      + '<input type="date" value="' + (SC.fecha || '') + '" style="' + INP + ';width:145px" '
      + 'onchange="remSCInput(\'fecha\',this.value)"></div>'
      + (SC.manual
          ? '<a onclick="remSCAuto()" style="cursor:pointer;font-family:\'DM Mono\',monospace;font-size:11px;'
            + 'color:var(--gold);text-decoration:underline;padding-bottom:9px">restaurar automático</a>'
          : '')
      + '<div style="' + SUB + ';margin:0;flex-basis:100%;padding-top:2px" '
      + 'title="Compra, comisión y mortandad se recalculan exactas (son lineales en kg × $/kg). '
      + 'Alimento y estructura se reescalan proporcionalmente a los días — es una aproximación: el modelo '
      + 'del pipeline cobra cada mes a su %PV y su precio de ración. La sanidad no cambia: es única por '
      + 'cabeza al ingreso, no un costo por día.">Aplica a las ' + VER.sc + ' cabezas sin caravana. '
      + 'Compra y comisión exactas; alimento y estructura proporcionales a los días '
      + '<span style="border-bottom:1px dotted;cursor:help">(aproximación)</span>.</div>'
      + '</div>';
  }

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
      + card('Gastos venta', _remM(-gastos),
             V.comVenta ? 'com. venta ' + _remM(V.comVenta) + ' (' + _remN(V.comPct, 1) + ' %) + otros ' + _remM(V.otros)
                        : (kgc ? '$ ' + _remN(gastos / kgc, 2) + ' por kg carne' : ''))
      + card('Venta neta', _remM(neto), _remN(kgc) + ' kg carne')
      + card('Resultado', _remM(res), _remN(res / costo * 100, 1) + ' % s/costo · ' + _remM(res / r.cabezas) + '/cab', true)
      + '</div>';
    // v15.71 · la venta medida contra el kg vivo que salio
    var KV = remVentaKgVivo(r, V);
    if (KV) {
      h += '<div style="' + GRID + '">'
        + card('Rinde', _remN(KV.rinde, 2) + ' %',
               _remN(kgc) + ' kg carne / ' + _remN(KV.kgVivo) + ' kg vivo')
        + card('Precio kg vivo', '$ ' + _remN(KV.bruto),
               'neto de gastos: $ ' + _remN(KV.neto) + '/kg vivo')
        + '</div>';
    }
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
  h += '<div style="' + SUB + '">Mismos kg de entrada y mismos kg MS, valuados a precio de hoy — la diferencia '
    + 'contra el gasto histórico es revalorización. Estructura y sanidad quedan históricas.</div>';
  // v15.62.1: precios de reposición editables a mano (como el prototipo).
  h += '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:12px 16px;margin-bottom:12px;'
    + 'display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap">'
    + '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">$/kg reposición compra · '
    + (RPc.manualP ? '<span style="color:var(--gold)">manual</span>' : RP.fuente_precio) + '</label>'
    + '<input value="' + _remN(RPc.precio) + '" style="' + INP + '" onchange="remRepoInput(\'repoPrecio\',this.value)"></div>'
    + '<div style="display:flex;flex-direction:column;gap:5px"><label style="' + LBL + '">$/kg MS reposición · '
    + (RPc.manualMs ? '<span style="color:var(--gold)">manual</span>' : RP.mes_ms) + '</label>'
    + '<input value="' + _remN(RPc.precioMs, 2) + '" style="' + INP + '" onchange="remRepoInput(\'repoMS\',this.value)"></div>'
    + (RPc.manual
        ? '<a onclick="remRepoAuto()" style="cursor:pointer;font-family:\'DM Mono\',monospace;font-size:11px;'
          + 'color:var(--gold);text-decoration:underline;padding-bottom:9px">restaurar automático</a>'
        : '')
    + '</div>';
  h += '<div style="' + GRID + '">'
    + card('Compra a reposición', _remM(RPc.compra + RPc.comision), 'vs hist ' + ((RPc.compra + RPc.comision - C.compra - C.comision) >= 0 ? '+' : '') + _remM(RPc.compra + RPc.comision - C.compra - C.comision))
    + card('Alimento a reposición', _remM(RPc.alimento), 'vs hist ' + ((RPc.alimento - C.alimento) >= 0 ? '+' : '') + _remM(RPc.alimento - C.alimento))
    + card('Costo total reposición', _remM(RPc.total), '$ ' + _remN(RPc.por_kg_vendido) + ' por kg vendido · hist $ ' + _remN(C.por_kg_vendido))
    + (bruto > 0 ? card('Resultado a reposición', _remM(resRepo), _remN(resRepo / RPc.total * 100, 1) + ' % s/costo repo · hist ' + _remM(res), true) : '')
    + '</div>';

  // ── Detalle por tropa ──
  h += '<div style="' + H2 + '">Detalle por tropa</div>';
  h += '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--border);font-family:\'DM Mono\',monospace">'
    + '<thead><tr>' + (esGrupo ? ['Remito', 'Tropa'] : ['Tropa']).concat(['Cab', 'Ingreso', 'Kg ent', 'Kg sal', 'Días', '$/kg compra', 'Compra', 'Kg MS', '% MS', 'Alimento', 'Estr+San'])
      .map(function (t, i) { return '<th style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:9px 10px;border-bottom:2px solid var(--border);text-align:' + (i === 0 ? 'left' : 'right') + ';white-space:nowrap">' + t + '</th>'; }).join('')
    + '</tr></thead><tbody>';
  (r.filas || []).forEach(function (f) {
    var td = 'padding:8px 10px;border-bottom:1px solid #f0eee8;text-align:right;font-size:13px;white-space:nowrap';
    var tag = '<span style="display:inline-block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:2px;background:rgba(184,146,42,.15);color:#7a5c14;margin-left:6px">';
    // v15.68: la fila imputada (sin caravana) va en tono aparte y con marca —
    // su tropa y su fecha de ingreso las puso el cruce, no WinCampo.
    // v15.68.5: dos chips distintos según de qué lado está el problema.
    var scLbl = f.sc_tipo === 'sin_electronica' ? 's/car electrónica'
              : f.sc_tipo === 'no_leida' ? 's/car no leída'
              : 's/caravana';
    var scDet = f.sc_tipo === 'sin_electronica'
      ? 'WinCampo no tiene caravana electrónica para estos animales (código visual o placeholder del cargador): no hay nada que cruzar contra la balanza.'
      : f.sc_tipo === 'no_leida'
        ? 'Tienen caravana electrónica, pero el bastón no la leyó en los últimos 30 días.'
        : 'Sin caravana verificable contra la balanza.';
    // En un remito sin ninguna confirmada no hay de dónde imputar: la fila
    // conserva lo de WinCampo, pero igual se marca — su identidad no está
    // verificada y eso es lo que el chip dice.
    var tagSC = !f.sc_tipo ? '' : ('<span title="' + scDet + ' '
      + (f.imputado
          ? ('El origen está imputado a la tropa mayoritaria confirmada del remito'
             + (f.manual ? ' y pisado a mano' : '') + '.')
          : 'No hay ninguna caravana confirmada en el remito, así que no se imputó nada: valen los datos de WinCampo.')
      + '" style="display:inline-block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;'
      + 'padding:2px 6px;border-radius:2px;background:rgba(192,57,43,.12);color:#a3311f;margin-left:6px;cursor:help">'
      + '&#9679; ' + (f.manual ? scLbl + ' manual' : scLbl) + '</span>');
    // v15.68.4: la fila confirmada por una lectura ANTERIOR (su ingreso) no se
    // vio salir — vale la pena distinguirla de la que paso por la balanza el
    // dia del remito.
    var tagAnt = (f.tipo_lectura === 'anterior' || f.tipo_lectura === 'mixto')
      ? '<span title="Confirmada por una lectura anterior de Datamars (tipicamente su ingreso), '
        + 'no por la pesada de salida: la caravana existe y el animal estaba en el campo, pero nadie '
        + 'lo leyo el dia del remito." style="display:inline-block;font-size:9px;letter-spacing:.08em;'
        + 'text-transform:uppercase;padding:2px 6px;border-radius:2px;background:rgba(45,106,138,.12);'
        + 'color:#2d6a8a;margin-left:6px;cursor:help">lectura ' + f.tipo_lectura + '</span>'
      : '';
    h += '<tr' + (f.sc_tipo ? ' style="background:#fdf6f4"' : (f.estimado ? ' style="background:#fffbf0"' : '')) + '>'
      + (esGrupo ? '<td style="' + td + ';text-align:left;color:rgba(26,22,18,.5)">' + f.remito + '</td>' : '')
      + '<td style="' + td + ';text-align:left">' + f.tropa + (f.sc_tipo ? tagSC : tagAnt)
      + (f.estimado ? tag + 'est</span>' : '') + '</td>'
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
    + (esGrupo ? '<td></td>' : '')
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
