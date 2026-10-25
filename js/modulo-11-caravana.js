/* modulo-11-caravana.js — 14 · Consulta de Caravana · v15.89 (2026-10-24)
   ────────────────────────────────────────────────────────────────
   Historia de UN animal buscándolo por el EID completo, por una parte del
   número o por la caravana visual: compra → feedlot (hoy) → salida → venta.

   No calcula nada nuevo: cruza lo que ya publica el pipeline.
     stock_detalle_2025.json   animal en stock (kg estimado hoy, ADP, techo)
     egresos_detalle.json      v15.89 · egresos por animal desde 01/01/2025
     datamars_lecturas.json    v15.89 · pesadas reales del bastón por EID
     compras_ingresos.json     tropa: proveedor, origen, localidad, compañeros
     compras_liquidaciones.json precio, comisión, gastos, desbaste, semáforo
     resultado_remitos/<nro>   costeo de la fila tropa + categoría del remito
     resultados_ventas.json    venta cargada (precio, rinde, resultado)
     productivo_2025.json      ADP teórico y techos (meta, v15.89)

   ⚠ La conversión, el costo por kg ganado y el resultado son de la fila
   TROPA + CATEGORÍA dentro del remito, no del animal solo: el 07 costea por
   fila. Los sin caravana del remito pueden estar imputados a otra tropa
   (cruce Datamars v15.68.2); si la tropa WinCampo del animal no tiene fila,
   se usa la de su categoría y se avisa.

   ⚠ DEPENDENCIA DE CARGA: va después de `modulo-09-remitos.js` (usa `_remM`,
   `_remN`, `_remFec`, `remFilas`, `remCatColor`).
*/

var _cvD = null;          // {stock, egr, dm, ci, cl, rv, prod}
var _cvProm = null;
var _cvQ = '';            // última búsqueda
var _cvSelKey = null;     // ficha abierta (clave de animal)
var _cvCand = [];         // candidatos de la última búsqueda
var _cvFila = {};         // remito → filas (cache local de remFilas)

var CV_CAT = { TM: 'Ternero', TH: 'Ternera', NT: 'Novillito', NV: 'Novillo',
               VQ: 'Vaquillona', VA: 'Vaca', TO: 'Toro' };
var CV_SIGLA = {};
Object.keys(CV_CAT).forEach(function (k) { CV_SIGLA[CV_CAT[k]] = k; });
var CV_MOTIVO = { V: 'VENTA', M: 'MUERTE', T: 'TRASLADO' };

// ════════════════════════════════════════════════════════════
//  Carga (perezosa, la primera vez que se entra)
// ════════════════════════════════════════════════════════════
function _cvGet(n) {
  return fetch(STOCK_SB + '/' + n + '?v=' + Date.now().toString().slice(0, -5), {}, {})
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}
function cvCargar() {
  if (_cvProm) return _cvProm;
  var nombres = ['stock_detalle_2025.json', 'egresos_detalle.json', 'datamars_lecturas.json',
                 'compras_ingresos.json', 'compras_liquidaciones.json', 'resultados_ventas.json',
                 'productivo_2025.json'];
  _cvProm = Promise.all(nombres.map(_cvGet)).then(function (a) {
    var egr = a[1] || { meta: { cols: [] }, filas: [] };
    var cols = (egr.meta && egr.meta.cols) || [];
    var filas = (egr.filas || []).map(function (r) {
      var o = {}; cols.forEach(function (c, i) { o[c] = r[i]; }); return o;
    });
    _cvD = {
      stock: (a[0] && a[0].detalle) || [], stockMeta: (a[0] && a[0].meta) || {},
      egr: filas, egrMeta: egr.meta || {}, egrFalta: !a[1],
      dm: a[2] || { sesiones: {}, eids: {}, vids: {} }, dmFalta: !a[2],
      ci: a[3] || { tropas: {}, grupos: [] }, cl: a[4] || { liquidaciones: [], por_tropa_cat: {}, semaforo: {} },
      rv: a[5] || { ventas: [] }, prod: a[6] || {}
    };
    return _cvD;
  });
  return _cvProm;
}

function initCaravana() {
  var load = document.getElementById('cvLoading');
  var cont = document.getElementById('cvContent');
  if (load) load.style.display = 'block';
  if (cont) cont.style.display = 'none';
  cvCargar().then(function () {
    if (load) load.style.display = 'none';
    if (cont) cont.style.display = 'block';
    var q = cvHashQ();
    if (q) { _cvQ = q; cvBuscar(q, true); } else cvRender();
  });
}
function cvHashQ() {
  var m = /caravana=([^&]+)/.exec(location.hash || '');
  return m ? decodeURIComponent(m[1]) : '';
}

// ════════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════════
function _cvNorm(s) { return String(s == null ? '' : s).toUpperCase().replace(/[\s\-.]/g, ''); }
function _cvDig(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function _cvTropaNorm(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/20(\d{2})$/, '$1');
}
function _cvCatLarga(c) {
  var k = String(c || '').trim();
  return CV_CAT[k.toUpperCase()] || k || '—';
}
function _cvEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function _cvDias(a, b) {           // días entre dos ISO (b − a)
  if (!a || !b) return null;
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
}
function _cvHoy() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function _cvMotivo(m) {
  var k = String(m || '').toUpperCase().trim();
  if (CV_MOTIVO[k]) return CV_MOTIVO[k];
  if (k.indexOf('VENTA') >= 0) return 'VENTA';
  if (k.indexOf('MUER') >= 0) return 'MUERTE';
  if (k.indexOf('TRASL') >= 0) return 'TRASLADO';
  return k || '—';
}
function _cvKg(n, d) { return n == null || isNaN(n) ? '—' : _remN(n, d || 0) + ' kg'; }
function _cvPx(n) { return n == null || isNaN(n) ? '—' : '$ ' + _remN(n, 0); }

// ════════════════════════════════════════════════════════════
//  Búsqueda
// ════════════════════════════════════════════════════════════
/* Un "animal" se identifica por su EID (solo dígitos). Lo que no tiene EID
   (visual o placeholder del cargador) va con clave 'V:' + visual. */
function _cvKeyDe(rfid, visual) {
  var d = _cvDig(rfid);
  if (d.length >= 8) return d;
  return visual ? 'V:' + _cvNorm(visual) : null;
}

function cvBuscar(q, desdeHash) {
  _cvQ = String(q || '').trim();
  _cvSelKey = null;
  var n = _cvNorm(_cvQ);
  if (!desdeHash) {
    try { history.replaceState(null, '', '#caravana=' + encodeURIComponent(_cvQ)); } catch (e) {}
  }
  if (n.length < 4) { _cvCand = null; cvRender(n ? 'corto' : ''); return; }
  var D = _cvD, soloDig = /^\d+$/.test(n);
  var hit = {};   // key → {key, eid, visual}
  function add(rfid, vis) {
    var k = _cvKeyDe(rfid, vis);
    if (!k) return;
    if (!hit[k]) hit[k] = { key: k, eid: k.indexOf('V:') === 0 ? null : k, visual: vis || null };
    else if (vis && !hit[k].visual) hit[k].visual = vis;
  }
  function matchVis(v) { return v && _cvNorm(v).indexOf(n) >= 0; }
  D.stock.forEach(function (r) {
    var d = _cvDig(r.RFID);
    if (soloDig ? d.indexOf(n) >= 0 : matchVis(r.NRO_CARAVANA)) add(r.RFID, r.NRO_CARAVANA);
  });
  D.egr.forEach(function (r) {
    var d = r.rfid || '';
    if (soloDig ? d.indexOf(n) >= 0 : matchVis(r.caravana)) add(r.rfid, r.caravana);
  });
  var E = D.dm.eids || {}, V = D.dm.vids || {};
  if (soloDig) {
    Object.keys(E).forEach(function (eid) { if (eid.indexOf(n) >= 0) add(eid, (E[eid][0] || [])[3]); });
  } else {
    Object.keys(V).forEach(function (vid) {
      if (vid.indexOf(n) >= 0) V[vid].forEach(function (eid) { add(eid, vid); });
    });
  }
  var lista = Object.keys(hit).map(function (k) { return hit[k]; });
  // EID completo: el match exacto gana
  if (soloDig && n.length === 15 && hit[n]) lista = [hit[n]];
  _cvCand = lista.map(cvResumen).sort(function (a, b) {
    return (b.ultFecha || '').localeCompare(a.ultFecha || '');
  });
  if (_cvCand.length === 1) _cvSelKey = _cvCand[0].key;
  cvRender();
}

function cvAbrir(key) { _cvSelKey = key; cvRender(); window.scrollTo(0, 0); }
function cvVolver() { _cvSelKey = null; cvRender(); }

/* Todo lo que se sabe de un animal, juntado de las tres fuentes. */
function cvAnimal(key) {
  var D = _cvD, eid = key.indexOf('V:') === 0 ? null : key, vis = eid ? null : key.slice(2);
  function esEste(rfid, v) {
    if (eid) { var d = _cvDig(rfid); return d === eid || (d && d.replace(/^0+/, '') === eid.replace(/^0+/, '')); }
    return v && _cvNorm(v) === vis;
  }
  var st = D.stock.filter(function (r) { return esEste(r.RFID, r.NRO_CARAVANA); });
  var eg = D.egr.filter(function (r) { return esEste(r.rfid, r.caravana); })
    .sort(function (a, b) { return (b.fecha_egreso || '').localeCompare(a.fecha_egreso || ''); });
  var lect = eid ? ((D.dm.eids || {})[eid] || []).map(function (l) {
    var s = (D.dm.sesiones || {})[String(l[2])] || {};
    return { fecha: l[0], peso: l[1], sesion: l[2], vid: l[3], nombre: s.nombre || '' };
  }) : [];
  var visual = (st[0] && st[0].NRO_CARAVANA) || (eg[0] && eg[0].caravana)
    || (lect.filter(function (l) { return l.vid; })[0] || {}).vid || vis;
  // Historias: una por paso por el feedlot. La de stock (si hay) es la vigente
  // salvo que haya un egreso posterior a su ingreso.
  var hist = [];
  st.forEach(function (r) { hist.push({ tipo: 'stock', fi: r.FECHA_INGRESO, s: r }); });
  eg.forEach(function (r) { hist.push({ tipo: 'egreso', fi: r.fecha_ingreso, fe: r.fecha_egreso, e: r }); });
  // Lecturas del bastón posteriores a su última salida en WinCampo (o sin
  // registro en WinCampo): salió como "sin caravana" con la caravana de OTRO
  // animal cargada. Se busca el egreso de venta de ese día con el mismo peso y
  // sin lectura propia (caso 982000459618644 → 2432, cargado como LA061B251).
  var ultEgr = eg.length ? eg[0].fecha_egreso : '';
  if (!st.length) {
    lect.filter(function (l) { return l.fecha && l.fecha > ultEgr && l.peso != null; }).forEach(function (l) {
      var m = cvEgresoPorPeso(l);
      if (m && !hist.some(function (h) { return h.e === m; })) {
        hist.push({ tipo: 'egreso', fi: m.fecha_ingreso, fe: m.fecha_egreso, e: m, porPeso: l });
      }
    });
  }
  hist.sort(function (a, b) {
    var fa = a.fe || '9999', fb = b.fe || '9999';
    if (fa !== fb) return fb.localeCompare(fa);
    return (b.fi || '').localeCompare(a.fi || '');
  });
  return { key: key, eid: eid, visual: visual, hist: hist, lect: lect };
}

/* Egreso de VENTA del día de la lectura (o el siguiente) con el mismo kg de
   salida (±1 kg) cuya caravana cargada NO fue leída por el bastón esos días.
   Solo si hay uno: con dos candidatos al mismo peso no se adivina. */
var _cvEgrPorFecha = null;
function cvEgresoPorPeso(l) {
  if (!_cvEgrPorFecha) {
    _cvEgrPorFecha = {};
    _cvD.egr.forEach(function (r) {
      if (_cvMotivo(r.motivo) !== 'VENTA' || !r.fecha_egreso) return;
      (_cvEgrPorFecha[r.fecha_egreso] = _cvEgrPorFecha[r.fecha_egreso] || []).push(r);
    });
  }
  var E = _cvD.dm.eids || {}, d1 = new Date(l.fecha + 'T00:00:00');
  d1.setDate(d1.getDate() + 1);
  var f1 = d1.toISOString().slice(0, 10);
  var cand = (_cvEgrPorFecha[l.fecha] || []).concat(_cvEgrPorFecha[f1] || []).filter(function (r) {
    if (r.kg_egr == null || Math.abs(r.kg_egr - l.peso) > 1) return false;
    var propias = (r.rfid && E[r.rfid]) || [];
    return !propias.some(function (x) { var dd = _cvDias(x[0], r.fecha_egreso); return dd != null && Math.abs(dd) <= 1; });
  });
  return cand.length === 1 ? cand[0] : null;
}

function cvResumen(h) {
  var a = cvAnimal(h.key), x = a.hist[0];
  var r = { key: h.key, eid: a.eid, visual: a.visual, tropa: '—', cat: '—', estado: 'Solo Datamars',
            ultFecha: null, ultPesada: null };
  if (x && x.porPeso) {
    r.tropa = x.e.tropa; r.cat = _cvCatLarga(x.e.cat);
    r.estado = 'Salió ' + _remFec(x.e.fecha_egreso) + ' · remito ' + x.e.remito + ' (por peso)';
    r.ultFecha = x.e.fecha_egreso;
  } else if (x && x.tipo === 'stock') {
    r.tropa = x.s.NRO_TROPA; r.cat = _cvCatLarga(x.s.CATEGORIA); r.estado = 'En stock'; r.ultFecha = '9999';
  } else if (x) {
    r.tropa = x.e.tropa; r.cat = _cvCatLarga(x.e.cat);
    r.estado = (_cvMotivo(x.e.motivo) === 'MUERTE' ? 'Murió ' : 'Salió ') + _remFec(x.e.fecha_egreso)
      + (x.e.remito ? ' · remito ' + x.e.remito : '');
    r.ultFecha = x.e.fecha_egreso;
  }
  var ul = a.lect[a.lect.length - 1];
  if (ul) { r.ultPesada = ul; if (!r.ultFecha) r.ultFecha = ul.fecha; }
  return r;
}

// ════════════════════════════════════════════════════════════
//  Cruces
// ════════════════════════════════════════════════════════════
function cvCompra(tropa, cat) {
  var D = _cvD, tn = _cvTropaNorm(tropa), catL = _cvCatLarga(cat);
  var ptc = ((D.cl.por_tropa_cat || {})[tn] || {})[catL] || null;
  var liq = null, liqCat = null;
  if (ptc && ptc.liq_id) {
    liq = (D.cl.liquidaciones || []).filter(function (l) { return l.id === ptc.liq_id; })[0] || null;
    if (liq) liqCat = (liq.categorias || []).filter(function (c) {
      return c.tropa_norm === tn && c.categoria === catL;
    })[0] || null;
  }
  var tr = (D.ci.tropas || {})[tn] || null;
  var gr = (D.ci.grupos || []).filter(function (g) { return g.tropa_norm === tn && g.categoria === catL; })[0]
        || (D.ci.grupos || []).filter(function (g) { return g.tropa_norm === tn; })[0] || null;
  var sem = (D.cl.semaforo || {})[tn] || null;
  return { tn: tn, catL: catL, ptc: ptc, liq: liq, liqCat: liqCat, tropa: tr, grupo: gr, sem: sem };
}

/* Fila del remito para la tropa + categoría del animal. Si la tropa no tiene
   fila (el cruce Datamars le cambió la tropa a los sin caravana), la de su
   categoría; si hay varias, la más grande. */
function cvFilaRemito(filas, tropa, cat, noLeida) {
  var tn = _cvTropaNorm(tropa), catL = _cvCatLarga(cat);
  // no leída por el bastón: el 07 la pasó a la fila IMPUTADA del remito
  if (noLeida) {
    var im = (filas || []).filter(function (x) { return x.imputado || x.origen === 'imputado'; });
    if (im.length) return { fila: _cvSumaFilas(im), exacta: true, imputada: true };
  }
  var f = (filas || []).filter(function (x) {
    return (x.tropa_norm || _cvTropaNorm(x.tropa)) === tn && x.categoria === catL;
  });
  if (f.length) return { fila: _cvSumaFilas(f), exacta: true };
  f = (filas || []).filter(function (x) { return x.categoria === catL; });
  if (f.length) return { fila: _cvSumaFilas(f), exacta: false };
  return null;
}
function _cvSumaFilas(fs) {
  if (fs.length === 1) return fs[0];
  var o = JSON.parse(JSON.stringify(fs[0]));
  ['cabezas', 'kg_ingreso', 'kg_egreso', 'kg_ms', 'costo_compra', 'costo_compra_cg', 'comision',
   'gastos_compra', 'alimento', 'estructura', 'sanidad', 'mortandad', 'costo_fila',
   'venta_prorrateada', 'resultado_fila'].forEach(function (k) {
    var s = 0, hay = false;
    fs.forEach(function (x) { if (x[k] != null) { s += +x[k]; hay = true; } });
    o[k] = hay ? s : null;
  });
  o._n = fs.length;
  return o;
}
function cvCostosFila(f) {
  if (!f) return null;
  var kgp = (f.kg_egreso || 0) - (f.kg_ingreso || 0);
  var prod = (f.alimento || 0) + (f.estructura || 0) + (f.sanidad || 0) + (f.mortandad || 0);
  var compra = f.costo_compra_cg != null ? f.costo_compra_cg
    : (f.precio_kg_cg != null && f.kg_ingreso ? f.precio_kg_cg * f.kg_ingreso
       : (f.costo_compra || 0) + (f.comision || 0) + (f.gastos_compra || 0));
  var total = f.costo_fila != null ? f.costo_fila : compra + prod;
  return {
    kgp: kgp, prod: prod, compra: compra, total: total,
    conv: kgp > 0 && f.kg_ms ? f.kg_ms / kgp : null,
    prodKg: kgp > 0 ? prod / kgp : null,
    totKg: f.kg_egreso ? total / f.kg_egreso : null
  };
}
function cvVenta(remito) {
  var V = (_cvD.rv.ventas || []).filter(function (v) {
    return (v.remitos || []).map(String).indexOf(String(remito)) >= 0;
  });
  V.sort(function (a, b) { return String(b.generado || '').localeCompare(String(a.generado || '')); });
  return V[0] || null;
}
function _cvFilasRemito(nro) {
  if (_cvFila[nro]) return Promise.resolve(_cvFila[nro]);
  var p = (typeof remFilas === 'function') ? remFilas(nro)
    : fetch(STOCK_SB + '/resultado_remitos/' + nro + '.json').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
      }).then(function (j) { return (j && j.filas) || []; });
  return p.then(function (f) { _cvFila[nro] = f; return f; });
}

/* Parámetros de engorde. Vienen de productivo_2025.json → meta desde v15.89;
   si el JSON es anterior, queda null y la ficha lo dice. */
function cvParams(sigla) {
  var P = _cvD.prod || {}, M = P.meta || {}, c90 = (P.por_categoria_90d || {})[sigla] || {};
  return {
    techo: (M.techo_kg_por_cat || {})[sigla],
    techoRecria: M.techo_kg_recria, engRecria: M.engorde_recria,
    adpTeo: c90.adp_teorico, adpCal: c90.adp_calibrado
  };
}

// ════════════════════════════════════════════════════════════
//  Render
// ════════════════════════════════════════════════════════════
var CV_CARD = 'background:#fff;border:1px solid var(--border,#e6e1d6);padding:18px 22px;margin-bottom:16px';
var CV_H = 'font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;margin:0 0 12px';
var CV_LBL = 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.5)';
var CV_VAL = 'font-family:\'DM Mono\',monospace;font-size:15px;color:var(--ink,#1a1612);margin-top:2px';

function _cvKV(lbl, val, sub) {
  return '<div style="min-width:150px;flex:1 1 150px"><div style="' + CV_LBL + '">' + lbl + '</div>'
    + '<div style="' + CV_VAL + '">' + val + '</div>'
    + (sub ? '<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.5);margin-top:2px">' + sub + '</div>' : '')
    + '</div>';
}
function _cvGrid(items) {
  return '<div style="display:flex;flex-wrap:wrap;gap:14px 22px">' + items.join('') + '</div>';
}
function _cvChip(txt, color, fg) {
  return '<span style="display:inline-block;padding:2px 9px;border-radius:2px;font-family:\'DM Mono\',monospace;'
    + 'font-size:11px;letter-spacing:.06em;background:' + color + ';color:' + (fg || '#fff') + '">' + _cvEsc(txt) + '</span>';
}
function _cvCatChip(catL) { return _cvChip(catL, remCatColor(catL, 0)); }
function _cvSigno(n, txt) {
  return '<span style="color:' + (n < 0 ? '#c0392b' : '#27613d') + ';font-weight:600">' + txt + '</span>';
}

function cvRender(aviso) {
  var cont = document.getElementById('cvContent');
  if (!cont) return;
  var h = '<div style="' + CV_CARD + ';display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    + '<input id="cvInput" type="text" value="' + _cvEsc(_cvQ) + '" placeholder="EID completo, parte del número o caravana visual"'
    + ' onkeydown="if(event.key===\'Enter\')cvBuscar(this.value)"'
    + ' style="flex:1 1 320px;padding:12px 14px;font-family:\'DM Mono\',monospace;font-size:18px;border:1px solid var(--border,#e6e1d6);background:#fbfaf7">'
    + '<button onclick="cvBuscar(document.getElementById(\'cvInput\').value)" style="padding:12px 22px;background:var(--ink,#1a1612);'
    + 'color:var(--cream,#f5f0e6);border:0;font-family:\'DM Mono\',monospace;font-size:13px;letter-spacing:.08em;cursor:pointer">BUSCAR</button>'
    + '</div>';
  var D = _cvD;
  var faltan = [];
  if (D.egrFalta) faltan.push('egresos_detalle.json');
  if (D.dmFalta) faltan.push('datamars_lecturas.json');
  if (faltan.length) {
    h += '<div style="' + CV_CARD + ';border-left:3px solid #b8922a;font-family:\'DM Mono\',monospace;font-size:12px">'
      + '⚠ Todavía no está publicado ' + faltan.join(' ni ') + ' (sale en el próximo tick del bot). '
      + 'Hasta entonces la búsqueda solo ve ' + (D.egrFalta && D.dmFalta ? 'el stock vivo' : D.egrFalta ? 'el stock vivo y Datamars' : 'stock y egresos') + '.</div>';
  }
  if (aviso === 'corto') {
    h += '<div style="' + CV_CARD + ';font-family:\'DM Mono\',monospace;font-size:13px">Poné al menos 4 caracteres (dígitos del EID o parte de la visual).</div>';
  } else if (_cvSelKey) {
    h += cvFicha(_cvSelKey);
  } else if (_cvCand && _cvCand.length === 0 && _cvQ) {
    h += '<div style="' + CV_CARD + ';font-family:\'DM Mono\',monospace;font-size:13px">No encontrada en stock, egresos desde '
      + _remFec((D.egrMeta || {}).desde || '2025-01-01') + ' ni lecturas Datamars.</div>';
  } else if (_cvCand && _cvCand.length) {
    h += cvTablaCand(_cvCand);
  } else {
    h += '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.55);padding:4px 2px 20px">'
      + 'Busca en el stock de hoy (' + _remN(D.stock.length) + ' animales), en los egresos desde '
      + _remFec((D.egrMeta || {}).desde || '2025-01-01') + ' (' + _remN(D.egr.length) + ') y en las pesadas Datamars ('
      + _remN(Object.keys(D.dm.eids || {}).length) + ' EID). Ejemplos: <b>459618644</b> · <b>TY141B424</b> · <b>B424</b>.</div>';
  }
  h += '<div style="font-family:\'DM Mono\',monospace;font-size:10.5px;color:rgba(26,22,18,.45);margin-top:22px">'
    + 'Fuentes: WinCampo (stock y egresos), Datamars (pesadas), Compras y Liquidaciones, Resultado por Remito · v15.89</div>';
  cont.innerHTML = h;
  if (_cvSelKey && _cvPendiente) { var p = _cvPendiente; _cvPendiente = null; p(); }
}

function cvTablaCand(lista) {
  var th = 'font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:8px 9px;border-bottom:2px solid var(--border,#e6e1d6);text-align:left';
  var td = 'padding:7px 9px;border-bottom:1px solid #f0eee8;font-size:12.5px;white-space:nowrap';
  var h = '<div style="' + CV_CARD + '"><div style="' + CV_H + '">' + lista.length + ' caravanas coinciden</div>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-family:\'DM Mono\',monospace"><thead><tr>'
    + ['EID', 'Visual', 'Tropa', 'Cat', 'Estado', 'Última pesada'].map(function (c) { return '<th style="' + th + '">' + c + '</th>'; }).join('')
    + '</tr></thead><tbody>';
  lista.slice(0, 200).forEach(function (c) {
    h += '<tr style="cursor:pointer" onclick="cvAbrir(\'' + c.key.replace(/'/g, '') + '\')" onmouseover="this.style.background=\'#faf7f0\'" onmouseout="this.style.background=\'\'">'
      + '<td style="' + td + '">' + _cvEsc(c.eid || '—') + '</td>'
      + '<td style="' + td + '">' + _cvEsc(c.visual || '—') + '</td>'
      + '<td style="' + td + '">' + _cvEsc(c.tropa || '—') + '</td>'
      + '<td style="' + td + '">' + _cvEsc(c.cat) + '</td>'
      + '<td style="' + td + '">' + _cvEsc(c.estado) + '</td>'
      + '<td style="' + td + '">' + (c.ultPesada ? _remFec(c.ultPesada.fecha) + ' · ' + _cvKg(c.ultPesada.peso) : '—') + '</td></tr>';
  });
  h += '</tbody></table></div>' + (lista.length > 200 ? '<div style="' + CV_LBL + ';margin-top:8px">Se muestran 200 — afiná la búsqueda.</div>' : '')
    + '</div>';
  return h;
}

// ── Ficha ──
var _cvPendiente = null;   // carga asíncrona de la fila del remito
var _cvTexto = [];         // líneas para "Copiar ficha"

function cvFicha(key) {
  var a = cvAnimal(key), x = a.hist[0];
  _cvTexto = [];
  _cvPendiente = null;
  var back = (_cvCand && _cvCand.length > 1)
    ? '<a onclick="cvVolver()" style="cursor:pointer;font-family:\'DM Mono\',monospace;font-size:12px;color:#7a5c14">← volver a los ' + _cvCand.length + ' resultados</a>' : '';
  var acciones = '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:12px">' + back
    + '<div style="display:flex;gap:8px;margin-left:auto">'
    + '<button onclick="cvCopiar(this)" style="' + _cvBtn() + '">Copiar ficha</button>'
    + '<button onclick="cvPDF()" style="' + _cvBtn() + '">Informe PDF</button></div></div>';
  if (!x) return acciones + cvFichaSoloDM(a);
  var h = acciones + '<div id="cvFicha">' + cvBloqueHist(a, x, true) + '</div>';
  if (a.hist.length > 1) {
    h += '<details style="' + CV_CARD + '"><summary style="cursor:pointer;font-family:\'DM Mono\',monospace;font-size:12px">'
      + (a.hist.length - 1) + ' paso(s) anterior(es) por el feedlot</summary><div style="margin-top:12px">'
      + a.hist.slice(1).map(function (y) { return cvBloqueHist(a, y, false); }).join('') + '</div></details>';
  }
  return h;
}
function eg0Fecha(a) {
  var r = a.hist.filter(function (h) { return h.tipo === 'egreso' && !h.porPeso; })[0];
  return r ? r.e.fecha_egreso : null;
}
function _cvBtn() {
  return 'padding:7px 14px;background:#fff;border:1px solid var(--border,#e6e1d6);font-family:\'DM Mono\',monospace;font-size:12px;cursor:pointer';
}

function cvFichaSoloDM(a) {
  _cvTexto.push('Caravana ' + (a.eid || '') + (a.visual ? ' · visual ' + a.visual : ''), 'Sin registro en WinCampo con este EID.');
  return '<div id="cvFicha"><div style="' + CV_CARD + ';border-left:3px solid #b8922a">'
    + '<div style="' + CV_H + '">' + _cvEsc(a.eid || a.visual) + '</div>'
    + _cvGrid([_cvKV('EID', _cvEsc(a.eid || '—')), _cvKV('Visual', _cvEsc(a.visual || '—'))])
    + '<div style="font-family:\'DM Mono\',monospace;font-size:12.5px;margin-top:12px">⚠ Sin registro en WinCampo (ni stock ni egresos) con este EID: '
    + 'buscar por la visual. Suele ser un animal que salió como "sin caravana" y el cruce lo imputó a otra tropa.</div></div>'
    + cvPesadas(a.lect, null) + '</div>';
}

function cvBloqueHist(a, x, vigente) {
  var esStock = x.tipo === 'stock', s = x.s || {}, e = x.e || {};
  var tropa = esStock ? s.NRO_TROPA : e.tropa;
  var cat = esStock ? s.CATEGORIA : e.cat;
  var catL = _cvCatLarga(cat), sigla = CV_SIGLA[catL] || String(cat || '').toUpperCase();
  var C = cvCompra(tropa, cat);
  var motivo = esStock ? null : _cvMotivo(e.motivo);
  var estado = esStock ? _cvChip('EN STOCK', '#27613d')
    : motivo === 'MUERTE' ? _cvChip('MUERTO · ' + _remFec(e.fecha_egreso), '#c0392b')
    : _cvChip('SALIÓ · ' + motivo + ' · ' + _remFec(e.fecha_egreso), '#b8922a');
  var g = C.grupo || {}, t = C.tropa || {};
  var origen = [g.proveedor || t.proveedor, g.origen ? String(g.origen).toLowerCase() : null, g.localidad]
    .filter(Boolean).join(' · ');
  var campo = esStock ? [s.NOMBRE_CORRAL, s.NRO_CORRAL ? 'corral ' + s.NRO_CORRAL : null].filter(Boolean).join(' · ')
    : (e.corral ? 'corral ' + e.corral : '—');
  var fi = esStock ? s.FECHA_INGRESO : e.fecha_ingreso;
  var kgIng = esStock ? s.KG_INGRESO : e.kg_ing;

  // 1 · Identidad
  var aviso = x.porPeso
    ? '<div style="font-family:\'DM Mono\',monospace;font-size:12px;background:#fbf3e0;border-left:3px solid #b8922a;padding:8px 12px;margin-bottom:12px">'
      + '⚠ El bastón leyó este EID el ' + _remFec(x.porPeso.fecha) + ' (' + _cvEsc(x.porPeso.nombre) + ', ' + _remN(x.porPeso.peso) + ' kg), '
      + 'pero en WinCampo no figura en ninguna salida de ese día' + (eg0Fecha(a) ? ' (su última salida con este EID es del ' + _remFec(eg0Fecha(a)) + ')' : '') + '. '
      + 'Por peso, es el egreso del remito <b>' + _cvEsc(e.remito) + '</b> cargado con la caravana <b>' + _cvEsc(e.rfid || '—')
      + (e.caravana ? ' · ' + _cvEsc(e.caravana) : '') + '</b> (' + _remN(e.kg_egr) + ' kg, no leída por el bastón): '
      + 'tropa, categoría, ingreso y costeo de abajo son los de ese registro, no necesariamente los de este animal.</div>' : '';
  if (x.porPeso && vigente) _cvTexto.push('⚠ Leída el ' + _remFec(x.porPeso.fecha) + ' sin salida en WinCampo con este EID; por peso = remito '
    + e.remito + ' cargado como ' + (e.rfid || '') + (e.caravana ? ' / ' + e.caravana : ''));
  var h = '<div style="' + CV_CARD + (vigente ? ';border-top:3px solid var(--gold,#d4a84b)' : '') + '">' + aviso
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">'
    + '<div style="' + CV_H + ';font-size:26px">' + _cvEsc(a.eid || a.visual) + '</div><div>' + estado + '</div></div>'
    + _cvGrid([
        _cvKV('EID', _cvEsc(a.eid || '—')),
        _cvKV('Visual', _cvEsc(x.porPeso ? (x.porPeso.vid || a.visual || '—') : ((esStock ? s.NRO_CARAVANA : e.caravana) || a.visual || '—')),
          x.porPeso && e.caravana ? 'en WinCampo: ' + _cvEsc(e.caravana) : ''),
        _cvKV('Tropa', _cvEsc(tropa || '—')),
        _cvKV('Categoría', _cvCatChip(catL), esStock && s.CATEGORIA_FINAL ? 'final: ' + _cvEsc(s.CATEGORIA_FINAL) : ''),
        _cvKV('Hotelero', _cvEsc((esStock ? s.HOTELERO : e.hotelero) || '—')),
        _cvKV('Campo / corral', _cvEsc(campo || '—')),
        _cvKV('Origen', _cvEsc(origen || (esStock ? s.ORIGEN : e.origen) || '—')),
        _cvKV('Ingreso', _remFec(fi), _cvKg(kgIng))
      ]) + '</div>';
  if (vigente) {
    _cvTexto.push('CARAVANA ' + (a.eid || '') + ' · visual ' + ((esStock ? s.NRO_CARAVANA : e.caravana) || a.visual || '—'),
      'Estado: ' + (esStock ? 'EN STOCK' : (motivo + ' ' + _remFec(e.fecha_egreso))),
      'Tropa ' + (tropa || '—') + ' · ' + catL + ' · ' + ((esStock ? s.HOTELERO : e.hotelero) || '') + ' · ' + (campo || ''),
      'Origen: ' + (origen || '—') + ' · ingreso ' + _remFec(fi) + ' · ' + _cvKg(kgIng));
  }

  // 2 · Compra
  h += cvBloqueCompra(C, kgIng, fi, vigente);

  // 3a · En stock
  if (esStock) h += cvBloqueStock(a, s, sigla, vigente);
  // 3b/3c · Salida y venta (la fila del remito se baja aparte)
  else h += cvBloqueSalida(a, e, tropa, cat, vigente);

  // 4 · Compañeros de tropa
  h += cvCompaneros(tropa, C);
  return h;
}

function cvBloqueCompra(C, kgIng, fi, vigente) {
  var P = C.ptc, L = C.liq || {}, LC = C.liqCat || {};
  var h = '<div style="' + CV_CARD + '"><div style="' + CV_H + '">Compra</div>';
  if (!P) {
    var est = (C.sem && C.sem.estado) || 'sin liquidación';
    h += '<div style="font-family:\'DM Mono\',monospace;font-size:12.5px">Sin liquidación cargada para ' + _cvEsc(C.catL) + ' de esta tropa'
      + ' (' + _cvEsc(est) + '). Si salió, el 07 la costeó con la estimación de su fila (marca <b>est.</b>, ver abajo).</div>';
    if (C.tropa) h += '<div style="' + CV_LBL + ';margin-top:8px">Proveedor ' + _cvEsc(C.tropa.proveedor || '—')
      + ' · consignatario ' + _cvEsc(C.tropa.consignatario || '—') + '</div>';
    if (vigente) _cvTexto.push('Compra: sin liquidación cargada');
    return h + '</div>';
  }
  var com = L.comision_modo === 'pct' ? _remN((L.comision_valor || 0) * 100, 1) + ' %' : _cvPx(P.comision_cat);
  var desb;
  if (P.desbaste_aceptado_vigente || (P.desbaste_pct && P.desbaste_pct > 0)) {
    desb = _remN(P.desbaste_pct || 0, 1) + ' %' + (P.desbaste_aceptado_vigente ? ' (aceptado)' : '');
  } else desb = 'sin desbaste';
  var kgW = LC.kg_wc, kgL = LC.kg_liq != null ? LC.kg_liq : P.kg_liq;
  var semE = (C.sem && C.sem.estado) || '';
  var semCol = semE === 'ok' ? '#27613d' : (semE === 'revisar' || semE === 'rojo') ? '#c0392b' : '#b8922a';
  var semTxt = semE + (C.sem && C.sem.avisos && C.sem.avisos.length ? ' · ' + C.sem.avisos.join(', ') : '');
  var costo = kgIng && P.precio_kg_cg ? kgIng * P.precio_kg_cg : null;
  h += _cvGrid([
      _cvKV('Fecha liquidación', _remFec(P.fecha || L.fecha)),
      _cvKV('Proveedor', _cvEsc(L.proveedor || (C.tropa || {}).proveedor || '—'), 'consig. ' + _cvEsc(L.consignataria || (C.tropa || {}).consignatario || '—')),
      _cvKV('Tropa · ' + _cvEsc(C.catL), _remN(P.cabezas_liq) + ' cab', _cvKg(kgL) + ' liquidados'),
      _cvKV('$/kg liquidado', _cvPx(P.precio_kg)),
      _cvKV('$/kg c/ comisión y gastos', _cvPx(P.precio_kg_cg)),
      _cvKV('Comisión · gastos', com, 'gastos ' + _cvPx(P.gastos_cat)),
      _cvKV('Desbaste', desb, kgW != null ? 'kg WinCampo ' + _remN(kgW) + ' vs liq. ' + _remN(kgL) : ''),
      _cvKV('Costo estimado del animal', _remM(costo), _cvKg(kgIng) + ' × ' + _cvPx(P.precio_kg_cg))
    ])
    + (semE ? '<div style="margin-top:12px">' + _cvChip('liquidación ' + semTxt, semCol) + '</div>' : '')
    + (P.n_liq > 1 ? '<div style="' + CV_LBL + ';margin-top:8px">' + P.n_liq + ' liquidaciones para esta tropa-categoría (se muestra la vigente)</div>' : '');
  if (vigente) _cvTexto.push('Compra ' + _remFec(P.fecha || L.fecha) + ' · ' + (L.proveedor || '') + ' · '
    + _cvPx(P.precio_kg) + '/kg (c/gastos ' + _cvPx(P.precio_kg_cg) + ') · desbaste ' + desb + ' · costo animal ' + _remM(costo));
  return h + '</div>';
}

function cvBloqueStock(a, s, sigla, vigente) {
  var p = cvParams(sigla), hoy = _cvHoy();
  var recria = s.NOMBRE_CORRAL && s.NOMBRE_CORRAL !== 'El Haras';
  var techo = recria ? p.techoRecria : p.techo;
  var adp = s.ENGORDE_DIARIO_KG, kgi = s.KG_INGRESO, kge = s.KG_ESTIMADO_HOY, dias = s.DIAS_EN_FEEDLOT;
  // si productivo_2025.json todavía no trae los techos (JSON anterior a v15.89),
  // el techo se deduce del propio estimado: kg ingreso + días × ADP > estimado
  if (techo == null && kgi != null && dias != null && adp != null && kge != null && kgi + dias * adp > kge + 0.5) techo = kge;
  var enTecho = techo != null && kge != null && kge >= techo - 0.5;
  var formula = enTecho ? 'en el techo de la categoría (' + _remN(techo) + ' kg)'
    : _remN(kgi) + ' + ' + _remN(dias) + ' d × ' + _remN(adp, 3) + ' (ADP ' + (recria ? 'recría' : 'calibrado') + ')';
  var falta = (techo != null && adp > 0 && !enTecho) ? Math.ceil((techo - kge) / adp) : null;
  var h = '<div style="' + CV_CARD + '"><div style="' + CV_H + '">Hoy en el feedlot</div>'
    + _cvGrid([
        _cvKV('Estadía', _remN(dias) + ' días'),
        _cvKV('Kg ingreso', _cvKg(kgi)),
        _cvKV('Kg estimado hoy', '<b>' + _cvKg(kge) + '</b>', formula),
        _cvKV('Kg ganados (est.)', _cvKg(kge != null && kgi != null ? kge - kgi : null)),
        _cvKV('ADP usado', _remN(adp, 3) + ' kg/d', p.adpTeo != null && !recria ? 'teórico ' + _CV_CAT_TXT(sigla) + ' ' + _remN(p.adpTeo, 3) : ''),
        _cvKV('Techo', techo != null ? _cvKg(techo) : '—', techo == null ? 'falta productivo meta (v15.89)' : (recria ? 'recría' : _CV_CAT_TXT(sigla))),
        _cvKV('Días al techo', enTecho ? 'llegó' : (falta != null ? _remN(falta) + ' días' : '—'))
      ]) + '</div>';
  // estimado a una fecha: el mismo cálculo que el pipeline, cortado en el techo
  var estA = function (f) {
    var d = _cvDias(s.FECHA_INGRESO, f);
    if (d == null || kgi == null || adp == null) return null;
    var v = kgi + Math.max(d, 0) * adp;
    return techo != null ? Math.min(v, techo) : v;
  };
  h += cvPesadas(a.lect.filter(function (l) { return !s.FECHA_INGRESO || l.fecha >= s.FECHA_INGRESO; }), estA);
  if (vigente) {
    var ul = a.lect[a.lect.length - 1];
    _cvTexto.push('Hoy: ' + dias + ' días · kg estimado ' + _cvKg(kge) + ' (' + formula + ') · ADP ' + _remN(adp, 3)
      + (falta != null ? ' · ' + falta + ' días al techo' : (enTecho ? ' · en el techo' : '')),
      ul ? 'Última pesada Datamars ' + _remFec(ul.fecha) + ' · ' + _cvKg(ul.peso) + ' (' + ul.nombre + ')' : 'Sin pesadas Datamars');
  }
  return h;
}
function _CV_CAT_TXT(sigla) { return (CV_CAT[sigla] || sigla || '').toLowerCase(); }

function cvPesadas(lect, estA) {
  var h = '<div style="' + CV_CARD + '"><div style="' + CV_H + '">Pesadas reales (Datamars)</div>';
  if (!lect || !lect.length) return h + '<div style="font-family:\'DM Mono\',monospace;font-size:12.5px">Sin pesadas en la balanza para este EID'
    + (_cvD.dm.meta && _cvD.dm.meta.desde ? ' (la caché de Datamars arranca el ' + _remFec(_cvD.dm.meta.desde) + ')' : '') + '.</div></div>';
  var th = 'font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:6px 9px;border-bottom:2px solid var(--border,#e6e1d6);text-align:right';
  var td = 'padding:6px 9px;border-bottom:1px solid #f0eee8;font-size:12.5px;text-align:right;white-space:nowrap';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-family:\'DM Mono\',monospace"><thead><tr>'
    + ['Fecha', 'Kg', 'Sesión', 'Visual leída', 'ADP real desde la anterior'].concat(estA ? ['Estimado a esa fecha', 'Dif.'] : [])
      .map(function (c, i) { return '<th style="' + th + (i === 2 || i === 3 ? ';text-align:left' : '') + '">' + c + '</th>'; }).join('')
    + '</tr></thead><tbody>';
  lect.forEach(function (l, i) {
    var prev = lect[i - 1], adp = null;
    if (prev && prev.peso != null && l.peso != null) {
      var d = _cvDias(prev.fecha, l.fecha);
      if (d > 0) adp = (l.peso - prev.peso) / d;
    }
    var est = estA ? estA(l.fecha) : null;
    h += '<tr><td style="' + td + '">' + _remFec(l.fecha) + '</td><td style="' + td + '">' + _remN(l.peso) + '</td>'
      + '<td style="' + td + ';text-align:left">' + _cvEsc(l.nombre || l.sesion) + '</td>'
      + '<td style="' + td + ';text-align:left">' + _cvEsc(l.vid || '—') + '</td>'
      + '<td style="' + td + '">' + (adp != null ? _remN(adp, 3) : '—') + '</td>'
      + (estA ? '<td style="' + td + '">' + (est != null ? _remN(est) : '—') + '</td><td style="' + td + '">'
        + (est != null && l.peso != null ? _cvSigno(l.peso - est, (l.peso - est >= 0 ? '+' : '−') + _remN(Math.abs(l.peso - est))) : '—') + '</td>' : '')
      + '</tr>';
  });
  return h + '</tbody></table></div></div>';
}

function cvBloqueSalida(a, e, tropa, cat, vigente) {
  var motivo = _cvMotivo(e.motivo);
  var dmDia = a.lect.filter(function (l) { var d = _cvDias(e.fecha_egreso, l.fecha); return d != null && Math.abs(d) <= 1; });
  var dm = dmDia[dmDia.length - 1] || null;
  var adp = e.adp != null ? e.adp : (e.dias > 0 && e.kg_egr != null && e.kg_ing != null ? (e.kg_egr - e.kg_ing) / e.dias : null);
  var difiere = dm && e.kg_egr != null && Math.abs(dm.peso - e.kg_egr) >= 2;
  var linkRem = e.remito
    ? '<a onclick="cvIrRemito(\'' + _cvEsc(e.remito) + '\')" style="cursor:pointer;color:#7a5c14;text-decoration:underline">' + _cvEsc(e.remito) + ' →</a>' : '—';
  var h = '<div style="' + CV_CARD + '"><div style="' + CV_H + '">Salida</div>'
    + _cvGrid([
        _cvKV('Fecha', _remFec(e.fecha_egreso), motivo),
        _cvKV('Remito', linkRem),
        _cvKV('Comprador / destino', _cvEsc(e.destino || e.consignatario || '—'), e.consignatario && e.destino && e.consignatario !== e.destino ? 'consig. ' + _cvEsc(e.consignatario) : ''),
        _cvKV('Kg salida WinCampo', _cvKg(e.kg_egr)),
        _cvKV('Pesada Datamars del día', dm ? _cvKg(dm.peso) : 'sin lectura', dm ? (difiere ? '⚠ difiere de WinCampo · ' : '') + _cvEsc(dm.nombre) : ''),
        _cvKV('Kg ganados', _cvKg(e.kg_egr != null && e.kg_ing != null ? e.kg_egr - e.kg_ing : null), _remN(e.dias) + ' días'),
        _cvKV('ADP real del animal', adp != null ? _remN(adp, 3) + ' kg/d' : '—')
      ]) + '</div>';
  if (vigente) _cvTexto.push('Salida ' + _remFec(e.fecha_egreso) + ' · ' + motivo + (e.remito ? ' · remito ' + e.remito : '')
    + ' · ' + (e.destino || e.consignatario || '') + ' · ' + _cvKg(e.kg_egr) + (dm ? ' (Datamars ' + _cvKg(dm.peso) + ')' : '')
    + ' · ADP ' + (adp != null ? _remN(adp, 3) : '—'));
  if (motivo !== 'VENTA' || !e.remito) return h + cvPesadas(a.lect, null);
  var id = 'cvRem_' + String(e.remito).replace(/\W/g, '') + '_' + (vigente ? 'v' : 'h');
  h += '<div id="' + id + '"><div style="' + CV_CARD + ';font-family:\'DM Mono\',monospace;font-size:12px;opacity:.6">Cargando el costeo del remito ' + _cvEsc(e.remito) + '…</div></div>';
  h += cvPesadas(a.lect, null);
  var prevP = _cvPendiente;
  _cvPendiente = function () {
    if (prevP) prevP();
    _cvFilasRemito(String(e.remito)).then(function (filas) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = cvBloqueCosteo(e, tropa, cat, filas, vigente);
    }).catch(function () {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="' + CV_CARD + ';font-family:\'DM Mono\',monospace;font-size:12px">El remito '
        + _cvEsc(e.remito) + ' no está en Resultado por Remito (el 07 cubre ventas desde su fecha de inicio).</div>' + cvBloqueVenta(e, tropa, cat, vigente);
    });
  };
  return h;
}

function cvBloqueCosteo(e, tropa, cat, filas, vigente) {
  var V = cvVenta(e.remito);
  // si la venta está cargada, su snapshot trae los overrides: se usa su fila
  var vf = V ? (V.filas || []).filter(function (f) { return String(f.remito) === String(e.remito); }) : [];
  var E = _cvD.dm.eids || {}, propias = (e.rfid && E[e.rfid]) || [];
  var noLeida = !propias.some(function (x) { var dd = _cvDias(x[0], e.fecha_egreso); return dd != null && Math.abs(dd) <= 1; })
    && (filas || []).some(function (x) { return x.imputado; });
  var m = cvFilaRemito(vf.length ? vf : filas, tropa, cat, noLeida) || cvFilaRemito(filas, tropa, cat, noLeida);
  var h = '<div style="' + CV_CARD + '"><div style="' + CV_H + '">Costeo de su fila en el remito ' + _cvEsc(e.remito) + '</div>';
  if (!m) {
    h += '<div style="font-family:\'DM Mono\',monospace;font-size:12.5px">No hay fila de ' + _cvEsc(_cvCatLarga(cat)) + ' en el remito.</div></div>';
    return h + cvBloqueVenta(e, tropa, cat, vigente, null);
  }
  var f = m.fila, K = cvCostosFila(f);
  h += _cvGrid([
      _cvKV('Fila', _cvEsc(f.tropa) + ' · ' + _cvEsc(f.categoria), _remN(f.cabezas) + ' cab' + (f._n > 1 ? ' · ' + f._n + ' filas' : '') + (f.estimado ? ' · <b>est.</b>' : '')),
      _cvKV('Kg producidos', _cvKg(K.kgp), _remN(f.kg_ingreso) + ' → ' + _remN(f.kg_egreso) + ' kg'),
      _cvKV('Conversión', K.conv != null ? _remN(K.conv, 2) + ' kg MS/kg' : '—', f.kg_ms != null ? _remN(f.kg_ms) + ' kg MS' + (f.kg_ms_estimado ? ' (est.)' : '') : ''),
      _cvKV('Costo productivo / kg ganado', _cvPx(K.prodKg), 'alimento + estructura + sanidad + mortandad'),
      _cvKV('Costo total / kg vendido', _cvPx(K.totKg), 'compra c/gastos ' + _remM(K.compra) + ' + productivo ' + _remM(K.prod)),
      _cvKV('$/kg compra c/gastos', _cvPx(f.precio_kg_cg), f.fuente_precio ? _cvEsc(f.fuente_precio) : '')
    ])
    + '<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.55);margin-top:10px">'
    + 'Son de la tropa + categoría en ese remito, no del animal solo.'
    + (m.imputada ? ' Su caravana no la leyó el bastón: el 07 la costeó dentro de la fila de los sin caravana, imputada a ' + _cvEsc(f.tropa) + ' · ' + _cvEsc(f.categoria) + '.' : '')
    + (m.exacta ? '' : ' ⚠ Su tropa WinCampo (' + _cvEsc(tropa) + ') no tiene fila en el remito (el cruce Datamars la imputó a otra): se muestra la fila de su categoría.')
    + (K.prodKg != null && e.kg_egr != null && e.kg_ing != null
       ? ' Prorrateado a este animal por sus ' + _remN(e.kg_egr - e.kg_ing) + ' kg ganados: costo productivo ≈ ' + _remM(K.prodKg * (e.kg_egr - e.kg_ing)) + '.' : '')
    + '</div></div>';
  if (vigente) _cvTexto.push('Fila ' + f.tropa + ' · ' + f.categoria + ': conversión ' + (K.conv != null ? _remN(K.conv, 2) : '—')
    + ' kg MS/kg · costo productivo ' + _cvPx(K.prodKg) + '/kg ganado · costo total ' + _cvPx(K.totKg) + '/kg vendido');
  return h + cvBloqueVenta(e, tropa, cat, vigente, V, f);
}

function cvBloqueVenta(e, tropa, cat, vigente, V, f) {
  if (V === undefined) V = cvVenta(e.remito);
  if (!V) {
    if (vigente) _cvTexto.push('Venta sin liquidar en el portal');
    return '<div style="' + CV_CARD + ';border-left:3px solid #b8922a"><div style="' + CV_H + '">Venta</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:12.5px">Venta sin liquidar en el portal — cargarla en '
      + '<a onclick="cvIrRemito(\'' + _cvEsc(e.remito) + '\')" style="cursor:pointer;color:#7a5c14;text-decoration:underline">07 · Resultado por Remito →</a></div></div>';
  }
  var v = V.venta || {}, R = V.resultado || {}, RP = V.reposicion || {};
  var tieneFila = f && f.resultado_fila != null;
  var cab = tieneFila && f.cabezas ? f.cabezas : null;
  var costo = tieneFila ? (f.costo_fila != null ? f.costo_fila : null) : null;
  var h = '<div style="' + CV_CARD + '"><div style="' + CV_H + '">Venta' + (V.es_grupo ? ' (grupo ' + _cvEsc((V.remitos || []).join('+')) + ')' : '') + '</div>'
    + _cvGrid([
        _cvKV('Precio venta', _cvPx(v.precio_kg) + '/kg carne', _remN(v.kg_carne) + ' kg carne'),
        _cvKV('Rinde', v.rinde_pct != null ? _remN(v.rinde_pct, 2) + ' %' : '—'),
        _cvKV('$/kg vivo', _cvPx(v.precio_kg_vivo_bruto) + ' bruto', _cvPx(v.precio_kg_vivo_neto) + ' neto'),
        tieneFila ? _cvKV('Venta de la fila', _remM(f.venta_prorrateada), 'prorrateada') : '',
        tieneFila && costo != null ? _cvKV('Costo de la fila', _remM(costo)) : '',
        tieneFila ? _cvKV('Resultado de la tropa', _cvSigno(f.resultado_fila, _remM(f.resultado_fila)),
          (cab ? _remM(f.resultado_fila / cab) + '/cab' : '') + (costo ? ' · ' + _remN(f.resultado_fila / costo * 100, 1) + ' % s/costo' : '')) : ''
      ].filter(Boolean))
    + '<div style="font-family:\'DM Mono\',monospace;font-size:11.5px;margin-top:12px;color:rgba(26,22,18,.65)">Venta completa: resultado histórico '
    + _cvSigno(R.monto || 0, _remM(R.monto)) + (R.pct_costo != null ? ' (' + _remN(R.pct_costo, 1) + ' %)' : '')
    + (RP.resultado != null ? ' · con reposición ' + _cvSigno(RP.resultado, _remM(RP.resultado)) : '')
    + (tieneFila ? '' : ' · (sin resultado por fila para su tropa-categoría)') + '</div></div>';
  if (vigente) _cvTexto.push('Venta ' + _cvPx(v.precio_kg) + '/kg carne · rinde ' + (v.rinde_pct != null ? _remN(v.rinde_pct, 2) + ' %' : '—')
    + (tieneFila ? ' · resultado de la tropa ' + _remM(f.resultado_fila) + (cab ? ' (' + _remM(f.resultado_fila / cab) + '/cab)' : '') : '')
    + ' · venta completa ' + _remM(R.monto));
  return h;
}

function cvCompaneros(tropa, C) {
  var tn = _cvTropaNorm(tropa), t = C.tropa;
  var n = { V: 0, M: 0, T: 0 };
  _cvD.egr.forEach(function (r) {
    if (_cvTropaNorm(r.tropa) !== tn) return;
    var m = _cvMotivo(r.motivo);
    if (m === 'VENTA') n.V++; else if (m === 'MUERTE') n.M++; else if (m === 'TRASLADO') n.T++;
  });
  var enStock = _cvD.stock.filter(function (r) { return _cvTropaNorm(r.NRO_TROPA) === tn; }).length;
  var txt = 'Tropa ' + _cvEsc(tropa || '—') + ': '
    + (t && t.cabezas ? _remN(t.cabezas) + ' cab ingresadas · ' : '')
    + _remN(enStock) + ' en stock · ' + _remN(n.V) + ' vendidas · ' + _remN(n.M) + ' muertas'
    + (n.T ? ' · ' + _remN(n.T) + ' trasladadas' : '');
  return '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.7);padding:2px 4px 16px">' + txt + '</div>';
}

function cvIrRemito(nro) {
  if (typeof _remModo !== 'undefined') { _remModo = 'simple'; _remGrupo = []; _remSel = String(nro); }
  sbNavigate('remitos');
}

// ════════════════════════════════════════════════════════════
//  Copiar y PDF
// ════════════════════════════════════════════════════════════
function cvCopiar(b) {
  var t = _cvTexto.join('\n') + '\n— Portal PEGSA · Consulta de Caravana · ' + _remFec(_cvHoy());
  var ok = function () { if (b) { var o = b.textContent; b.textContent = 'Copiada ✓'; setTimeout(function () { b.textContent = o; }, 1500); } };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () { prompt('Copiar:', t); });
  else prompt('Copiar:', t);
}
function cvPDF() {
  var el = document.getElementById('cvFicha');
  if (!el) return;
  var h = '<!doctype html><html><head><meta charset="utf-8"><title>Caravana ' + _cvEsc(_cvSelKey) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">'
    + '<style>@page{size:A4 portrait;margin:12mm}body{font-family:\'DM Mono\',monospace;color:#1a1612;margin:0;'
    + '-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:11px}'
    + 'div[style*="margin-bottom:16px"]{break-inside:avoid;margin-bottom:8px!important;padding:10px 14px!important}'
    + 'a{color:#1a1612;text-decoration:none}table{font-size:10.5px}</style></head><body>'
    + '<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;margin-bottom:8px">Consulta de Caravana</div>'
    + el.innerHTML
    + '<div style="font-size:9.5px;color:#777;margin-top:10px">Fuentes: WinCampo (stock y egresos), Datamars (pesadas), Compras y Liquidaciones, '
    + 'Resultado por Remito · v15.89 · ' + _remFec(_cvHoy()) + '</div></body></html>';
  var win = window.open('', '_blank');
  if (!win) { alert('El navegador bloqueó la ventana del informe. Permití las ventanas emergentes para este sitio.'); return; }
  win.document.open(); win.document.write(h); win.document.close();
  win.onload = function () { setTimeout(function () { win.focus(); win.print(); }, 550); };
}
