/* modulo-05-mercado.js — Mercado y Precios + Seguimiento Diario · 2026-04-26 */

// ── MERCADO Y PRECIOS ────────────────────────────────────────
var MERCADO_INITED = false;

var PRECIOS_HACIENDA = [];

var PRECIOS_COMMODITIES = [
  {nombre:'Maíz',         unidad:'$/tn', precio:null, ref:'MATBA-ROFEX'},
  {nombre:'Soja',         unidad:'$/tn', precio:null, ref:'MATBA-ROFEX'},
  {nombre:'Trigo',        unidad:'$/tn', precio:null, ref:'MATBA-ROFEX'},
  {nombre:'Girasol',      unidad:'$/tn', precio:null, ref:'BCR'},
  {nombre:'Gluten Maíz',  unidad:'$/tn', precio:null, ref:'Mercado local'},
  {nombre:'Maíz (USD)',   unidad:'USD/tn', precio:null, ref:'CBOT'},
  {nombre:'Soja (USD)',   unidad:'USD/tn', precio:null, ref:'CBOT'},
];

function mercadoTab(tab, el){
  document.querySelectorAll('#screenMercado .nav-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  ['panelMercadoHacienda','panelMercadoNegocios','panelMercadoHistorico','panelMercadoSeguimiento','panelMercadoAnalisis'].forEach(function(p){
    document.getElementById(p).style.display='none';
  });
  var map = {
    hacienda:     'panelMercadoHacienda',
    negocios:     'panelMercadoNegocios',
    historico:    'panelMercadoHistorico',
    seguimiento:  'panelMercadoSeguimiento',
    analisis:     'panelMercadoAnalisis',
  };
  if(map[tab]){
    document.getElementById(map[tab]).style.display='block';
    if(tab==='historico')   renderHistoricoChart();
    if(tab==='negocios')    renderNegocios();
    if(tab==='seguimiento') _segRun(MERCADO_DATA_CACHE);
    if(tab==='analisis')    renderAnalisis();
  }
}

function fmtPrecio(v){ return v!=null ? '$'+Number(v).toLocaleString('es-AR') : '<span style="color:rgba(26,22,18,.3)">—</span>'; }

function renderTablaHacienda(){
  var html = '<table class="data-table"><thead><tr>'
    +'<th>Categoría</th><th class="right">Precio</th><th>Unidad</th><th>Fuente</th>'
    +'</tr></thead><tbody>';
  PRECIOS_HACIENDA.forEach(function(r){
    html += '<tr><td><strong>'+r.categoria+'</strong></td>'
      +'<td class="right mono">'+fmtPrecio(r.precio)+'</td>'
      +'<td class="muted">'+r.unidad+'</td>'
      +'<td class="muted">'+r.ref+'</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('mercadoHaciendaTabla').innerHTML = html;
}

function renderTablaCommodities(){
  var html = '<table class="data-table"><thead><tr>'
    +'<th>Commodity</th><th class="right">Precio</th><th>Unidad</th><th>Fuente</th>'
    +'</tr></thead><tbody>';
  PRECIOS_COMMODITIES.forEach(function(r){
    html += '<tr><td><strong>'+r.nombre+'</strong></td>'
      +'<td class="right mono">'+fmtPrecio(r.precio)+'</td>'
      +'<td class="muted">'+r.unidad+'</td>'
      +'<td class="muted">'+r.ref+'</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('mercadoCommoditiesTabla').innerHTML = html;
}

var MERCADO_DATA_CACHE  = null;
var NEGOCIOS_DATA_CACHE = null;
var NEGOCIOS_SNAPSHOTS_CACHE = null;

function initMercado(){
  document.getElementById('mercadoLoading').style.display='block';
  document.getElementById('mercadoData').style.display='none';
  var status = document.getElementById('mercadoSyncStatus');
  status.textContent = 'Cargando precios...';

  // Cargar ambos JSONs en paralelo
  Promise.all([
    fetch(STOCK_SB+'/mercado_precios.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;}),
    fetch(STOCK_SB+'/negocios_resumen.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;}),
    fetch(STOCK_SB+'/negocios_snapshots.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;}),
  ]).then(function(results){
    var data = results[0];
    var neg  = results[1];
    var snap = results[2];
    MERCADO_DATA_CACHE  = data;
    NEGOCIOS_DATA_CACHE = neg;
    NEGOCIOS_SNAPSHOTS_CACHE = snap;

    if(data){
      // Actualizar tablas de precios
      if(data.hacienda) data.hacienda.forEach(function(d){
        var found = PRECIOS_HACIENDA.find(function(h){ return h.categoria===d.categoria; });
        if(found){ found.precio=d.precio; found.variacion=d.variacion||0; }
        else PRECIOS_HACIENDA.push({categoria:d.categoria, unidad:d.unidad||'$/kg en pie', precio:d.precio, variacion:d.variacion||0, ref:'MAG'});
      });
      if(data.commodities) data.commodities.forEach(function(d){
        var found = PRECIOS_COMMODITIES.find(function(c){ return c.nombre===d.nombre; });
        if(found){ found.precio=d.precio; found.ref=d.fuente||found.ref; }
      });
      if(data.fecha) status.textContent = 'Actualizado: '+data.fecha;
      // Fuente label
      var fEl = document.getElementById('mercadoHaciendaFuente');
      if(fEl && data.fuente) fEl.innerHTML = 'Fuente: <strong>'+data.fuente+'</strong> · '+data.fecha;
      // KPIs
      var nov = data.hacienda && data.hacienda.find(function(h){return h.categoria&&h.categoria.toLowerCase().indexOf('novillo')>=0&&h.categoria.toLowerCase().indexOf('especial')<0;});
      var vac = data.hacienda && data.hacienda.find(function(h){return h.categoria&&h.categoria.toLowerCase().indexOf('vaca')>=0;});
      var mz  = data.commodities && data.commodities.find(function(c){return c.nombre&&c.nombre.toLowerCase().indexOf('maíz')>=0||c.nombre&&c.nombre.toLowerCase().indexOf('maiz')>=0;});
      var sj  = data.commodities && data.commodities.find(function(c){return c.nombre&&c.nombre.toLowerCase().indexOf('soja')>=0;});
      document.getElementById('mkpi-novillo').textContent = nov?'$'+Number(nov.precio).toLocaleString('es-AR'):'—';
      document.getElementById('mkpi-vaca').textContent    = vac?'$'+Number(vac.precio).toLocaleString('es-AR'):'—';
      document.getElementById('mkpi-maiz').textContent    = mz ?'$'+Number(mz.precio).toLocaleString('es-AR') :'—';
      document.getElementById('mkpi-soja').textContent    = sj ?'$'+Number(sj.precio).toLocaleString('es-AR') :'—';
      // KPI Dólar MEP — tomar del último registro del historial
      var mepVal = data.insumos && data.insumos.dolar ? data.insumos.dolar
                 : (data.historico && data.historico.length ? (data.historico[data.historico.length-1].tc_mep || null) : null);
      var mepEl = document.getElementById('mkpi-mep');
      if(mepEl) mepEl.textContent = mepVal ? '$'+Number(mepVal).toLocaleString('es-AR') : '—';
    } else {
      status.textContent = 'Sin datos — ejecutar actualización';
    }
  })
  .catch(function(){ status.textContent = 'Error al cargar datos'; })
  .finally(function(){
    renderTablaHaciendaNueva();
    renderTablaCommoditiesNueva();
    renderTablaTermerosESYC();
    document.getElementById('mercadoLoading').style.display='none';
    document.getElementById('mercadoData').style.display='block';
    // Pre-calcular seguimiento con datos del día (se muestra al abrir el tab)
    if(MERCADO_DATA_CACHE) _segRun(MERCADO_DATA_CACHE);
  });
}

function renderTablaTermerosESYC() {
  var el = document.getElementById('mercadoTernerosTabla');
  if (!el) return;
  var data = MERCADO_DATA_CACHE;
  var items = data && data.terneros_esyc;
  if (!items || !items.length) {
    el.innerHTML = '<div style="padding:20px;font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.4)">Sin datos disponibles — se cargarán en la próxima actualización automática.</div>';
    return;
  }

  // Categorías de interés (resaltadas)
  var DESTACADAS = [
    // Terneros
    'Terneros 130-160 Kg.', 'Terneros 230-260 Kg.', 'Novillitos 330-370 Kg.',
    // Terneras (bandas equivalentes)
    'Terneras 130-150 Kg.', 'Terneras 150-170 Kg.',
    'Vaquillonas 250-290 Kg.', 'Vaquillonas 320-360 Kg.',
  ];

  // Separar terneros y terneras
  var terneros = items.filter(function(r){ return r.tipo === 'terneros'; });
  var terneras = items.filter(function(r){ return r.tipo === 'terneras'; });

  function buildTable(rows, titulo) {
    if (!rows.length) return '';
    var html = '<div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,22,18,.5);margin:20px 0 10px;padding-bottom:8px;border-bottom:2px solid rgba(26,22,18,.1)">'
      + titulo + '</div>';
    html += '<table class="data-table"><thead><tr>'
      + '<th>Categoría</th><th class="right">Cant.</th>'
      + '<th class="right">Prom. $/kg</th><th class="right">Máx. $/kg</th><th class="right">Mín. $/kg</th>'
      + '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var destacado = DESTACADAS.indexOf(r.categoria) >= 0;
      var style = destacado
        ? 'background:rgba(184,146,42,.06);border-left:3px solid #b8922a;'
        : '';
      html += '<tr style="' + style + '">'
        + '<td><strong>' + r.categoria + '</strong>'
        + (destacado ? ' <span style="font-family:DM Mono,monospace;font-size:9px;background:#b8922a;color:#fff;padding:1px 5px;border-radius:2px;margin-left:4px">REF</span>' : '')
        + '</td>'
        + '<td class="right mono">' + Number(r.cantidad||0).toLocaleString('es-AR') + '</td>'
        + '<td class="right mono" style="font-weight:700;color:' + (destacado?'#27613d':'inherit') + '">'
        + '$' + Number(r.precio).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</td>'
        + '<td class="right mono" style="color:rgba(26,22,18,.5)">'
        + (r.precio_max ? '$' + Number(r.precio_max).toLocaleString('es-AR', {maximumFractionDigits:0}) : '—') + '</td>'
        + '<td class="right mono" style="color:rgba(26,22,18,.5)">'
        + (r.precio_min ? '$' + Number(r.precio_min).toLocaleString('es-AR', {maximumFractionDigits:0}) : '—') + '</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  el.innerHTML = buildTable(terneros, 'Terneros') + buildTable(terneras, 'Terneras');
}

// ══ SEGUIMIENTO ECONÓMICO DIARIO ════════════════════════════════════════════
// Simula 5 categorías con precios del día (MAG + insumos) y guarda
// historial en localStorage para mostrar evolución de resultados y equilibrios.

var SEG_CATS = [
  {nombre:'Novillito',    tipo:'terneros', pesoE:390, pesoS:500, precioKey:'Novillitos hasta 390'},
  {nombre:'Novillo',      tipo:'terneros', pesoE:460, pesoS:500, precioKey:'Novillos 431/460'},
  {nombre:'Vaquillona',   tipo:'terneras', pesoE:350, pesoS:450, precioKey:'Vaquillonas hasta 390'},
  {nombre:'Vaca Buena',   tipo:'vacas',    pesoE:500, pesoS:600, precioKey:'Vacas Buenas'},
  {nombre:'Vaca Regular', tipo:'vacas',    pesoE:450, pesoS:600, precioKey:'Vacas Regulares'},
];
var SEG_COLORS  = ['#2980b9','#27ae60','#c0392b','#d4a23a','#8e44ad'];
var SEG_METRICAS = [
  {key:'resEco', label:'Resultado / cab ($)'},
  {key:'pvInd',  label:'Equilibrio Precio Venta ($/kg)'},
  {key:'pcInd',  label:'Equilibrio Precio Compra ($/kg)'},
  {key:'racInd', label:'Equilibrio Precio Ración ($/kgTC)'},
];
var _segMetrica = 'resEco';
var _segChart   = null;
var SEG_LS_KEY  = 'pegsa_seg_v1';

// ── Simulación pura (sin tocar DOM de resultados) ────────────────────────
// bp: objeto opcional con parámetros base (override del DOM del simulador)
function _segSimCat(tipo, pesoE, pesoS, pc, ins, bp){
  var pfx = tipo==='terneros'?'tn': tipo==='terneras'?'ta':'va';
  function gv(id){
    if(bp && bp[id]!==undefined && bp[id]!==null) return parseFloat(bp[id])||0;
    var el=document.getElementById(pfx+'-'+id); return el?(parseFloat(el.value)||0):0;
  }

  var kmo     = gv('kmo');
  var kmd     = gv('kmd');
  var pflete  = (ins.flete_12tn||0) || gv('pflete');
  var comC    = gv('ccom')/100;
  var comV    = gv('cvta')/100;
  var guias   = (ins.guias||0)    || gv('guias');
  var hotel   = (ins.hoteleria||0)|| gv('hotel');
  var sanidad = (ins.sanidad||0)  || gv('sanidad');
  var pcarne  = gv('pcarne');
  var rend    = gv('rend')/100;
  var decomiso= gv('decomiso')/100;
  var mort    = gv('mort')/100;

  var pesoPromedio = (pesoE + pesoS) / 2;
  var aumento = pesoPromedio * _simAdpPct(tipo, pesoE) / 100;
  if(!aumento) return null;
  if(pesoE >= pesoS) return null;
  var dias        = (pesoS - pesoE) / aumento;
  var kgsProducidos = pesoS - pesoE;

  // Precio venta
  var pv = (pcarne && rend) ? pcarne * rend : gv('pv');
  if(!pv) return null;

  // Alimentación por etapas
  var maiz_neto = Math.max(0, ins.maiz - SIM_MAIZ_CONTRAFLETE + SIM_MAIZ_FLETE_LOCAL);
  var etapas3   = SIM_ETAPAS[tipo];
  var msT3      = tipo==='vacas' ? SIM_MS_TABLE_VAC : SIM_MS_TABLE_GEN;
  var wNow=pesoE, dLeft=dias, totTC=0, totAlim=0;
  for(var ei=0; ei<etapas3.length; ei++){
    var et3 = etapas3[ei];
    var sd  = et3.dias!==null ? Math.min(et3.dias, dLeft) : dLeft;
    if(sd<=0) break;
    var wEnd    = wNow + aumento * sd;
    var wAvg    = (wNow + wEnd) / 2;
    var msPct   = simLookupMS(msT3, wEnd);
    var consPct = msPct / SIM_MSTC[tipo];
    var consDay = consPct * wAvg;
    var c3      = et3.comp;
    var stRac   = (c3[0]*maiz_neto + c3[1]*(ins.silo||0) + c3[2]*(ins.gluten||0) + c3[3]*(ins.nucleo||0) + c3[4]*(ins.germen||0))/100/1000*1.15;
    totTC   += consDay * sd;
    totAlim += stRac * consDay * sd;
    wNow = wEnd; dLeft -= sd;
  }
  var consumoDiario  = dias>0 ? totTC/dias : 0;
  var alimentacion   = totAlim;

  // Compra
  var fleteC;
  if(tipo==='vacas')         fleteC = (kmo * pflete + 11000) / 13950;
  else if(tipo==='terneras') fleteC = (kmo * pflete + 110000) / 12000;
  else                       fleteC = (kmo * pflete) / 12000;
  var compraNeta    = (pc + fleteC + pc * comC) * pesoE;
  var compraNeta_kg = compraNeta / pesoE;
  var hoteleriaTotal = hotel * dias;
  var totalCostos   = alimentacion + hoteleriaTotal + sanidad;

  // Venta
  var fleteV      = (kmd * pflete) / 19000;
  var gastoV      = fleteV + pv*comV + (pesoS>0 ? guias/pesoS : 0) + pv*decomiso;
  var ventaNeta_kg= pv - gastoV;
  var ingresoVenta= ventaNeta_kg * pesoS;

  // Mortandad
  var mortTotal = dias>0 ? mort*dias/30 : 0;
  var mortCost  = (pesoE+pesoS)/2 * mortTotal * (ventaNeta_kg+compraNeta_kg)/2;

  var resEco = ingresoVenta - compraNeta - mortCost - totalCostos;
  var pvInd  = pesoS>0 ? ((totalCostos+compraNeta)/pesoS + fleteV + guias/pesoS)/(1-comV) : 0;
  var pcInd  = pesoE>0 ? ((ingresoVenta-totalCostos)/pesoE - fleteC)/(1+comC) : 0;
  var racInd = consumoDiario*dias>0 ? (ingresoVenta-compraNeta-mortCost-hoteleriaTotal-sanidad)/(consumoDiario*dias) : 0;

  return {
    pc:   Math.round(pc),
    pv:   Math.round(pv),
    dias: Math.round(dias),
    alimentacion: Math.round(alimentacion),
    resEco: Math.round(resEco),
    pvInd:  Math.round(pvInd),
    pcInd:  Math.round(pcInd),
    racInd: Math.round(racInd*10)/10,
    compraNeta: Math.round(compraNeta),
    ingresoVenta: Math.round(ingresoVenta),
  };
}

// ── LocalStorage helpers ──────────────────────────────────────────────────
function _segCargar(){
  try{ return JSON.parse(localStorage.getItem(SEG_LS_KEY)||'[]'); } catch(e){ return []; }
}
function _segGuardar(fecha, maiz, cats){
  var hist = _segCargar();
  hist = hist.filter(function(d){ return d.fecha!==fecha; }); // reemplazar mismo día
  hist.push({fecha:fecha, maiz:maiz, cats:cats});
  hist.sort(function(a,b){ return a.fecha<b.fecha?-1:1; });
  if(hist.length>90) hist = hist.slice(hist.length-90);
  try{ localStorage.setItem(SEG_LS_KEY, JSON.stringify(hist)); } catch(e){}
}

// ── Función principal: ejecuta simulación y guarda ────────────────────────
function _segRun(data){
  if(!data || !data.insumos) return;
  var ins = data.insumos;
  // Cargar parámetros base (independientes del simulador sandbox)
  var baseParams = bpGet();
  // Mapa de precios de hacienda: clave = nombre categoría
  var hac = {};
  if(data.hacienda) data.hacienda.forEach(function(h){ hac[h.categoria]=h.precio; });

  var hoy = data.fecha || new Date().toISOString().slice(0,10);
  var resultados = SEG_CATS.map(function(cat){
    var pc = null;
    Object.keys(hac).forEach(function(k){
      if(k.toLowerCase().indexOf(cat.precioKey.toLowerCase())>=0) pc=hac[k];
    });
    if(!pc) return null;
    var bp = baseParams[cat.tipo] || null;
    var r = _segSimCat(cat.tipo, cat.pesoE, cat.pesoS, pc, ins, bp);
    return r ? Object.assign({nombre:cat.nombre}, r) : null;
  });

  var validos = resultados.filter(Boolean);
  if(validos.length>0) _segGuardar(hoy, ins.maiz, validos);
  _segRender(resultados, hoy);
}

// ── Render completo ───────────────────────────────────────────────────────
function _segRender(hoyRes, fecha){
  _segRenderTablaHoy(hoyRes, fecha);
  _segRenderESYC(MERCADO_DATA_CACHE);
  _segRenderMetricBtns();
  _segRenderChart();
}

function _segRenderESYC(data){
  var el = document.getElementById('segHoyTabla');
  if(!el || !data) return;
  var items = data.terneros_esyc;
  if(!items || !items.length) return;

  var REF = [
    { cat:'Terneros 130-160 Kg.',  label:'Ternero 130-160',   grupo:'Terneros' },
    { cat:'Terneros 230-260 Kg.',  label:'Ternero 230-260',   grupo:'Terneros' },
    { cat:'Novillitos 330-370 Kg.',label:'Novillito 330-370', grupo:'Terneros' },
    { cat:'Terneras 130-150 Kg.',  label:'Ternera 130-150',   grupo:'Terneras' },
    { cat:'Terneras 150-170 Kg.',  label:'Ternera 150-170',   grupo:'Terneras' },
    { cat:'Vaquillonas 250-290 Kg.',label:'Vaquillona 250-290',grupo:'Terneras'},
    { cat:'Vaquillonas 320-360 Kg.',label:'Vaquillona 320-360',grupo:'Terneras'},
  ];

  // Obtener histórico para calcular variación
  var hist = data.historico || [];
  var prev = hist.length >= 2 ? hist[hist.length - 2] : null;
  var KEY_MAP = {
    'Terneros 130-160 Kg.':   'ter_130_160',
    'Terneros 230-260 Kg.':   'ter_230_260',
    'Novillitos 330-370 Kg.': 'nov_330_370',
    'Terneras 130-150 Kg.':   'tera_130_150',
    'Terneras 150-170 Kg.':   'tera_150_170',
    'Vaquillonas 250-290 Kg.':'vaq_250_290',
    'Vaquillonas 320-360 Kg.':'vaq_320_360',
  };

  function getItem(cat){ return items.find(function(r){ return r.categoria===cat; }); }
  function fN(n){ return n!=null ? '$'+Number(n).toLocaleString('es-AR',{maximumFractionDigits:0}) : '—'; }
  function varStr(cur, cat){
    var key = KEY_MAP[cat];
    if(!prev || !key || !prev[key] || !cur) return '';
    var pct = (cur - prev[key]) / prev[key] * 100;
    var col = pct >= 0 ? 'var(--green)' : 'var(--red)';
    var sign = pct >= 0 ? '+' : '';
    return ' <span style="font-size:10px;color:'+col+'">'+sign+pct.toFixed(1)+'%</span>';
  }

  // Agrupar por grupo
  var grupos = ['Terneros','Terneras'];
  var wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:24px';
  wrap.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(184,146,42,.8);margin-bottom:10px">Precios de Referencia Compra · Entre Surcos y Corrales</div>';

  grupos.forEach(function(g){
    var gItems = REF.filter(function(r){ return r.grupo===g; });
    var html = '<div style="font-family:DM Mono,monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(26,22,18,.4);margin:12px 0 6px">' + g + '</div>';
    html += '<div style="overflow-x:auto"><table class="data-table"><thead><tr>'
      +'<th>Categoría</th>'
      +'<th class="right">Prom. $/kg</th>'
      +'<th class="right">Máx.</th>'
      +'<th class="right">Mín.</th>'
      +'<th class="right">Cabezas</th>'
      +'</tr></thead><tbody>';
    gItems.forEach(function(ref){
      var it = getItem(ref.cat);
      if(!it){ html += '<tr><td>'+ref.label+'</td><td colspan="4" class="muted" style="text-align:center">Sin dato</td></tr>'; return; }
      html += '<tr style="background:rgba(184,146,42,.04)">'
        +'<td><strong>'+ref.label+'</strong></td>'
        +'<td class="right mono" style="font-weight:700;color:var(--green)">'+fN(it.precio)+varStr(it.precio, ref.cat)+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+fN(it.precio_max)+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+fN(it.precio_min)+'</td>'
        +'<td class="right mono">'+Number(it.cantidad||0).toLocaleString('es-AR')+'</td>'
        +'</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML += html;
  });

  // Agregar después de la tabla de simulación
  var existing = el.querySelector('.esyc-ref-wrap');
  if(existing) existing.remove();
  wrap.className = 'esyc-ref-wrap';
  el.appendChild(wrap);
}

function _segRenderTablaHoy(res, fecha){
  var el = document.getElementById('segHoyTabla');
  if(!el) return;
  var html = '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px">Resultado del día · '+fecha+'</div>';
  html += '<div style="overflow-x:auto"><table class="data-table"><thead><tr>'
    +'<th>Categoría</th>'
    +'<th class="right">Compra<br><span style="font-weight:400;opacity:.6">$/kg pie</span></th>'
    +'<th class="right">Venta<br><span style="font-weight:400;opacity:.6">$/kg pie</span></th>'
    +'<th class="right">Resultado<br><span style="font-weight:400;opacity:.6">$/cab</span></th>'
    +'<th class="right">Eq. Venta<br><span style="font-weight:400;opacity:.6">$/kg</span></th>'
    +'<th class="right">Eq. Compra<br><span style="font-weight:400;opacity:.6">$/kg</span></th>'
    +'<th class="right">Eq. Ración<br><span style="font-weight:400;opacity:.6">$/kgTC</span></th>'
    +'</tr></thead><tbody>';
  SEG_CATS.forEach(function(cat, i){
    var r   = res && res[i];
    var col = SEG_COLORS[i];
    if(!r){
      html += '<tr><td><strong style="color:'+col+'">'+cat.nombre+'</strong><br><span class="muted" style="font-size:12px">'+cat.pesoE+'→'+cat.pesoS+' kg</span></td>'
        +'<td colspan="6" class="muted" style="text-align:center">Sin precio disponible</td></tr>';
      return;
    }
    var resPos = r.resEco>=0;
    var resCol = resPos ? 'color:var(--green);font-weight:700' : 'color:var(--red);font-weight:700';
    var resPfx = resPos ? '+' : '';
    html += '<tr>'
      +'<td><strong style="color:'+col+'">'+cat.nombre+'</strong><br><span class="muted" style="font-size:12px">'+cat.pesoE+'→'+cat.pesoS+' kg · '+r.dias+'d</span></td>'
      +'<td class="right mono">$'+Number(r.pc).toLocaleString('es-AR')+'</td>'
      +'<td class="right mono">$'+Number(r.pv).toLocaleString('es-AR')+'</td>'
      +'<td class="right mono" style="'+resCol+'">'+resPfx+'$'+Number(r.resEco).toLocaleString('es-AR')+'</td>'
      +'<td class="right mono">$'+Number(r.pvInd).toLocaleString('es-AR')+'</td>'
      +'<td class="right mono">$'+Number(r.pcInd).toLocaleString('es-AR')+'</td>'
      +'<td class="right mono">$'+Number(r.racInd).toLocaleString('es-AR',{maximumFractionDigits:1})+'</td>'
      +'</tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function _segRenderMetricBtns(){
  var box = document.getElementById('segMetricBtns');
  if(!box) return;
  box.innerHTML = '';
  SEG_METRICAS.forEach(function(m){
    var active = m.key===_segMetrica;
    var btn = document.createElement('button');
    btn.textContent = m.label;
    btn.style.cssText = 'padding:5px 12px;border-radius:2px;font-family:DM Mono,monospace;font-size:12px;cursor:pointer;transition:all .2s;'
      +(active
        ? 'background:var(--gold);color:var(--ink);border:1px solid var(--gold);font-weight:700;'
        : 'background:transparent;color:rgba(26,22,18,.6);border:1px solid rgba(26,22,18,.2);');
    btn.onclick = function(){ _segMetrica = m.key; _segRenderMetricBtns(); _segRenderChart(); };
    box.appendChild(btn);
  });
}

function _segRenderChart(){
  var canvas = document.getElementById('chartSeguimiento');
  if(!canvas) return;
  var hist = _segCargar();
  if(hist.length === 0){
    if(_segChart){ _segChart.destroy(); _segChart=null; }
    canvas.style.display='none';
    var wrap = canvas.parentNode;
    if(wrap && !wrap.querySelector('.seg-nodata')){
      var msg = document.createElement('div');
      msg.className = 'seg-nodata';
      msg.style.cssText='padding:40px;text-align:center;color:rgba(26,22,18,.4);font-family:DM Mono,monospace;font-size:13px';
      msg.textContent = 'Aún no hay historial. Se acumula automáticamente cada vez que se abren los precios del día.';
      wrap.appendChild(msg);
    }
    return;
  }
  canvas.style.display='block';
  var nodata = canvas.parentNode && canvas.parentNode.querySelector('.seg-nodata');
  if(nodata) nodata.remove();

  var labels = hist.map(function(d){
    var p=d.fecha.split('-'); return p[2]+'/'+p[1]; // DD/MM
  });

  var metricaDef = SEG_METRICAS.find(function(m){ return m.key===_segMetrica; }) || SEG_METRICAS[0];

  var datasets = SEG_CATS.map(function(cat, i){
    var data = hist.map(function(d){
      var c = d.cats && d.cats.find(function(c){ return c.nombre===cat.nombre; });
      return c ? (c[_segMetrica]||null) : null;
    });
    return {
      label: cat.nombre,
      data: data,
      borderColor: SEG_COLORS[i],
      backgroundColor: SEG_COLORS[i]+'22',
      borderWidth: 2,
      pointRadius: hist.length<=15 ? 4 : 2,
      pointHoverRadius: 6,
      tension: 0.3,
      spanGaps: true,
    };
  });

  var yLabel = metricaDef.label;

  if(_segChart){ _segChart.destroy(); _segChart=null; }
  _segChart = new Chart(canvas, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { position:'top', labels:{ font:{family:'DM Mono, monospace', size:10}, padding:12 } },
        tooltip: {
          callbacks: {
            label: function(ctx){
              var v = ctx.parsed.y;
              if(v===null) return ctx.dataset.label+': —';
              return ctx.dataset.label+': $'+Number(v).toLocaleString('es-AR');
            }
          }
        }
      },
      scales: {
        x: { ticks:{ font:{family:'DM Mono, monospace', size:9}, maxRotation:45 }, grid:{ color:'rgba(26,22,18,.07)' } },
        y: {
          ticks:{ font:{family:'DM Mono, monospace', size:9},
                  callback:function(v){ return '$'+Number(v).toLocaleString('es-AR'); } },
          grid:{ color:'rgba(26,22,18,.07)' },
          title:{ display:true, text:yLabel, font:{family:'DM Mono, monospace', size:9} }
        }
      }
    }
  });
}

// ── Tabla Hacienda mejorada (con variación) ────────────────
function renderTablaHaciendaNueva(){
  var html = '<table class="data-table"><thead><tr>'
    +'<th>Categoría</th><th class="right">Precio</th><th class="right">Var.</th><th>Unidad</th><th>Fuente</th>'
    +'</tr></thead><tbody>';
  PRECIOS_HACIENDA.forEach(function(r){
    var varStr = '';
    if(r.variacion){
      var cls = r.variacion>0?'color:var(--green)':'color:var(--red)';
      varStr = '<span style="font-size:12px;'+cls+'">'+(r.variacion>0?'↑':'↓')+' '+Math.abs(r.variacion).toFixed(1)+'%</span>';
    } else varStr = '<span style="color:rgba(26,22,18,.3)">—</span>';
    html += '<tr><td><strong>'+r.categoria+'</strong></td>'
      +'<td class="right mono">'+fmtPrecio(r.precio)+'</td>'
      +'<td class="right mono">'+varStr+'</td>'
      +'<td class="muted">'+r.unidad+'</td>'
      +'<td class="muted">'+(r.ref||'MAG')+'</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('mercadoHaciendaTabla').innerHTML = html;
}

// ── Tabla Commodities mejorada ─────────────────────────────
function renderTablaCommoditiesNueva(){
  var html = '<table class="data-table"><thead><tr>'
    +'<th>Cereal</th><th class="right">Precio</th><th>Unidad</th><th>Fuente</th>'
    +'</tr></thead><tbody>';
  PRECIOS_COMMODITIES.forEach(function(r){
    html += '<tr><td><strong>'+r.nombre+'</strong></td>'
      +'<td class="right mono">'+fmtPrecio(r.precio)+'</td>'
      +'<td class="muted">'+r.unidad+'</td>'
      +'<td class="muted">'+r.ref+'</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('mercadoCommoditiesTabla').innerHTML = html;
}

// ── Helpers Negocios ───────────────────────────────────────
function _negParseYM(fecha) {
  if(!fecha) return null;
  var m = String(fecha).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(m){ var y=m[3].length===2?'20'+m[3]:m[3]; return y+'-'+m[2].padStart(2,'0'); }
  var m2 = String(fecha).match(/^(\d{4})-(\d{2})/);
  if(m2) return m2[1]+'-'+m2[2];
  return null;
}
function _negNormCat(cat) {
  return (cat||'').trim().toLowerCase()
    .replace(/(^|\s)\w/g, function(c){ return c.toUpperCase(); });
}
function _negFmtMes(ym) {
  if(!ym) return ym;
  var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var parts = ym.split('-');
  return meses[parseInt(parts[1],10)-1]+'-'+parts[0].slice(2);
}

// ── Render Negocios ────────────────────────────────────────
function renderNegocios(){
  var neg = NEGOCIOS_DATA_CACHE;
  var msgEl  = document.getElementById('mercadoNegociosMsg');
  var bodyEl = document.getElementById('mercadoNegociosBody');
  if(!neg){
    msgEl.innerHTML = '⏳ Datos de negocios no disponibles aún. Ejecutar actualización para conectar la planilla de Google Sheets.';
    bodyEl.innerHTML = '';
    return;
  }
  if(neg.error){
    msgEl.innerHTML = '⚠ '+neg.error+'<br><small>ID Planilla: <code>'+neg.sheet_id+'</code></small>';
  } else {
    msgEl.innerHTML = '✓ Planilla conectada · <strong>'+neg.total_ventas+'</strong> ventas · <strong>'+neg.total_compras+'</strong> compras · Actualizado: '+neg.fecha;
  }

  var html = '';

  // ── A. COMPRAS — Evolución mensual de precios ──────────────
  if(neg.compras && neg.compras.length){
    // Construir pivot {cat -> {ym -> {sum,n,cabs}}}
    var pivot = {}, allMeses = {}, catCabs = {};
    neg.compras.forEach(function(c){
      var ym  = _negParseYM(c.fecha);
      var cat = _negNormCat(c.categoria);
      var p   = Number(c.precio_kg) || 0;
      var cab = Number(c.cabezas)   || 1;
      if(!cat || !p || !ym) return;
      if(!pivot[cat])    pivot[cat]    = {};
      if(!pivot[cat][ym]) pivot[cat][ym] = {sum:0, n:0, cabs:0};
      pivot[cat][ym].sum  += p * cab;
      pivot[cat][ym].n    += cab;
      pivot[cat][ym].cabs += cab;
      allMeses[ym] = 1;
      catCabs[cat] = (catCabs[cat]||0) + cab;
    });

    // Ordenar meses y tomar los últimos 7
    var meses = Object.keys(allMeses).sort().slice(-7);
    // Ordenar categorías por volumen total desc
    var cats = Object.keys(catCabs).sort(function(a,b){ return catCabs[b]-catCabs[a]; });

    var TH = 'font-family:DM Mono,monospace;font-size:11px;letter-spacing:.09em;text-transform:uppercase;'
           + 'color:rgba(26,22,18,.42);padding:8px 12px;background:rgba(26,22,18,.03);'
           + 'border-bottom:2px solid rgba(26,22,18,.1);white-space:nowrap;text-align:right;font-weight:400';
    var TD = 'padding:7px 12px;border-bottom:1px solid rgba(26,22,18,.06);vertical-align:middle;font-family:DM Mono,monospace;font-size:13px';

    html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:28px 0 8px">Compras · Precio Promedio $/kg por Mes y Categoría</div>';
    html += '<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45);margin-bottom:14px">Fuente: hoja COMPRAS · col. A–F · Google Sheets. Color: variación vs mes anterior — <span style="color:#c0392b">▲ alza</span> · <span style="color:#27613d">▼ baja</span>.</div>';
    html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:8px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:500px">';
    html += '<thead><tr>';
    html += '<th style="'+TH+';text-align:left;min-width:140px">Categoría</th>';
    meses.forEach(function(m){ html += '<th style="'+TH+'">'+_negFmtMes(m)+'</th>'; });
    html += '<th style="'+TH+'">Cab. total</th>';
    html += '<th style="'+TH+'">Var. ult. mes</th>';
    html += '</tr></thead><tbody>';

    cats.forEach(function(cat){
      var rowData = meses.map(function(m){
        var d = pivot[cat][m];
        return d && d.n ? Math.round(d.sum / d.n) : null;
      });
      // Solo mostrar si tiene al menos 1 mes con datos
      var hasData = rowData.some(function(v){ return v!=null; });
      if(!hasData) return;

      var lastTwo = rowData.filter(function(v){ return v!=null; }).slice(-2);
      var varPct  = lastTwo.length===2 ? (lastTwo[1]-lastTwo[0])/lastTwo[0]*100 : null;
      var varCol  = varPct==null ? 'rgba(26,22,18,.4)' : varPct > 5 ? '#c0392b' : varPct < -5 ? '#27613d' : 'rgba(26,22,18,.55)';
      var varTxt  = varPct==null ? '—' : (varPct>=0?'▲ +':'▼ ')+Math.abs(varPct).toFixed(1)+'%';

      html += '<tr>';
      html += '<td style="'+TD+';text-align:left;font-weight:600;color:var(--ink)">'+cat+'</td>';
      rowData.forEach(function(p, i){
        if(p==null){ html += '<td style="'+TD+';text-align:right;color:rgba(26,22,18,.25)">—</td>'; return; }
        var prev = i > 0 ? rowData[i-1] : null;
        var bg = '';
        if(prev!=null){
          var chg = (p-prev)/prev*100;
          if(chg > 5)       bg = ';background:rgba(192,57,43,.07)';
          else if(chg < -5) bg = ';background:rgba(39,97,61,.07)';
        }
        html += '<td style="'+TD+';text-align:right'+bg+'">$'+p.toLocaleString('es-AR')+'</td>';
      });
      html += '<td style="'+TD+';text-align:right;color:rgba(26,22,18,.5)">'+catCabs[cat].toLocaleString('es-AR')+'</td>';
      html += '<td style="'+TD+';text-align:right;font-weight:600;color:'+varCol+'">'+varTxt+'</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Últimas compras registradas
    // ── helper: mapea nombre de categoría → parámetros de simulación ──────
    var _negCatMap = {
      novillito:  {tipo:'terneros', pesoE:390, pesoS:500},
      novillo:    {tipo:'terneros', pesoE:460, pesoS:500},
      ternero:    {tipo:'terneros', pesoE:220, pesoS:490},
      ternera:    {tipo:'terneras', pesoE:200, pesoS:450},
      vaquillona: {tipo:'terneras', pesoE:350, pesoS:450},
      vaca:       {tipo:'vacas',    pesoE:480, pesoS:600},
      toro:       {tipo:'vacas',    pesoE:500, pesoS:600},
    };
    function _negCatSim(catNombre){
      var n = (catNombre||'').toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').trim();
      if(n.indexOf('novillito')>=0) return _negCatMap.novillito;
      if(n.indexOf('novillo')>=0)   return _negCatMap.novillo;
      if(n.indexOf('ternero')>=0)   return _negCatMap.ternero;
      if(n.indexOf('ternera')>=0)   return _negCatMap.ternera;
      if(n.indexOf('vaquillona')>=0) return _negCatMap.vaquillona;
      if(n.indexOf('vaca')>=0)      return _negCatMap.vaca;
      if(n.indexOf('toro')>=0)      return _negCatMap.toro;
      return null;
    }
    var _compInsums = (MERCADO_DATA_CACHE && MERCADO_DATA_CACHE.insumos) ? MERCADO_DATA_CACHE.insumos : {};
    var _compBaseParams = bpGet();
    html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:24px 0 8px">Últimas Compras Registradas</div>';
    html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr>'
      +'<th style="'+TH+';text-align:left">Fecha</th>'
      +'<th style="'+TH+';text-align:left">Categoría</th>'
      +'<th style="'+TH+'">Cabezas</th>'
      +'<th style="'+TH+'">$/kg</th>'
      +'<th style="'+TH+'">kg/cab</th>'
      +'<th style="'+TH+'" title="Resultado simulado al momento de cargar la operación">Snapshot</th>'
      +'<th style="'+TH+'" title="Resultado recalculado con parámetros y precios actuales">Actual</th>'
      +'<th style="'+TH+'" title="Diferencia: Actual - Snapshot. Positivo: contexto mejoró. Negativo: contexto empeoró.">Δ</th>'
      +'<th style="'+TH+'">Indif. Compra</th>'
      +'<th style="'+TH+';text-align:left">Origen</th>'
      +'</tr></thead><tbody>';
    neg.compras.slice(-15).reverse().forEach(function(c){
      var catSim = _negCatSim(c.categoria);
      var pesoE  = (c.kg_cab > 0) ? c.kg_cab : (catSim ? catSim.pesoE : 0);
      var pesoS  = catSim ? catSim.pesoS : 0;
      var simRes = (catSim && pesoE && pesoS && c.precio_kg && _compInsums.maiz)
        ? _segSimCat(catSim.tipo, pesoE, pesoS, c.precio_kg, _compInsums, _compBaseParams[catSim.tipo]||null) : null;
      // kg/cab display
      var kgTxt = c.kg_cab > 0
        ? c.kg_cab + ' kg'
        : (catSim ? '<span style="color:rgba(26,22,18,.35)" title="Peso estimado por categoría">'+(catSim.pesoE)+'*</span>' : '—');
      // Resultado ACTUAL display
      var resTxt = '—';
      var resStyle = 'color:rgba(26,22,18,.3)';
      var roiActual = null;
      if(simRes && simRes.ingresoVenta > 0){
        roiActual = simRes.resEco / simRes.ingresoVenta * 100;
        resStyle = 'font-weight:600;color:' + (roiActual >= 0 ? '#27613d' : '#c0392b');
        resTxt   = (roiActual >= 0 ? '+' : '') + roiActual.toFixed(1) + '%'
          + '<br><span style="font-weight:400;font-size:12px;opacity:.7">$'
          + Number(simRes.resEco).toLocaleString('es-AR',{maximumFractionDigits:0})
          + '/cab</span>';
      }

      // Resultado SNAPSHOT (histórico, fijo al momento de cargar la operación)
      var snapTxt = '<span style="color:rgba(26,22,18,.25);font-size:11px">sin snap</span>';
      var snapStyle = '';
      var roiSnap = null;
      if(NEGOCIOS_SNAPSHOTS_CACHE && NEGOCIOS_SNAPSHOTS_CACHE.snapshots){
        // Buscar snapshot por clave única (fecha+cat+origen+kgcab+precio+cabezas)
        var clave = [c.fecha, c.categoria, c.origen, c.kg_cab, c.precio_kg, c.cabezas].join('|');
        var snap = NEGOCIOS_SNAPSHOTS_CACHE.snapshots.find(function(s){ return s.clave_unica === clave; });
        if(snap && snap.simulacion){
          roiSnap = snap.simulacion.rentabilidad_pct;
          snapStyle = 'font-weight:600;color:' + (roiSnap >= 0 ? '#27613d' : '#c0392b');
          snapTxt = (roiSnap >= 0 ? '+' : '') + roiSnap.toFixed(1) + '%'
            + '<br><span style="font-weight:400;font-size:12px;opacity:.7">$'
            + Number(snap.simulacion.resEco).toLocaleString('es-AR',{maximumFractionDigits:0})
            + '/cab</span>';
        }
      }

      // Δ (diferencia Actual - Snapshot)
      var deltaTxt = '<span style="color:rgba(26,22,18,.25)">—</span>';
      var deltaStyle = '';
      if(roiActual !== null && roiSnap !== null){
        var deltaPP = roiActual - roiSnap;
        var sign = deltaPP >= 0 ? '+' : '';
        var col = Math.abs(deltaPP) < 1 ? 'rgba(26,22,18,.5)' : (deltaPP >= 0 ? '#27613d' : '#c0392b');
        deltaTxt = '<span style="font-weight:600;color:'+col+'">'+sign+deltaPP.toFixed(1)+' pp</span>';
        deltaStyle = 'color:'+col;
      }
      // Indiferencia compra display
      var pcIndTxt = '—';
      var pcIndStyle = 'color:rgba(26,22,18,.3)';
      if(simRes && simRes.pcInd > 0){
        var diff = simRes.pcInd - c.precio_kg;
        var diffPct = c.precio_kg > 0 ? (diff / c.precio_kg * 100) : 0;
        var diffSign = diff >= 0 ? '+' : '';
        // color: verde si pcInd > pc (hay margen), rojo si pcInd < pc (ya estamos por encima)
        var pcIndColor = diff >= 0 ? '#27613d' : '#c0392b';
        pcIndTxt  = '$' + Number(simRes.pcInd).toLocaleString('es-AR',{maximumFractionDigits:0})
          + '/kg<br><span style="font-weight:400;font-size:12px;color:'+pcIndColor+'">'
          + diffSign + diffPct.toFixed(1) + '% margen</span>';
        pcIndStyle = 'font-weight:600;color:rgba(26,22,18,.75)';
      }
      html += '<tr>'
        +'<td style="'+TD+';color:rgba(26,22,18,.5)">'+c.fecha+'</td>'
        +'<td style="'+TD+';font-weight:600">'+_negNormCat(c.categoria)+'</td>'
        +'<td style="'+TD+';text-align:right">'+c.cabezas+'</td>'
        +'<td style="'+TD+';text-align:right">'+(c.precio_kg?'$'+Number(c.precio_kg).toLocaleString('es-AR',{maximumFractionDigits:0}):'—')+'</td>'
        +'<td style="'+TD+';text-align:right">'+kgTxt+'</td>'
        +'<td style="'+TD+';text-align:right;'+snapStyle+'">'+snapTxt+'</td>'
        +'<td style="'+TD+';text-align:right;'+resStyle+'">'+resTxt+'</td>'
        +'<td style="'+TD+';text-align:right;'+deltaStyle+'">'+deltaTxt+'</td>'
        +'<td style="'+TD+';text-align:right;'+pcIndStyle+'">'+pcIndTxt+'</td>'
        +'<td style="'+TD+';color:rgba(26,22,18,.5)">'+(c.origen||'—')+'</td>'
        +'</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div style="font-size:12px;color:rgba(26,22,18,.35);margin-top:6px;font-family:DM Mono,monospace">* Peso estimado por categoría (no registrado). <strong>Snapshot</strong>: resultado fijo al momento de cargar la operación. <strong>Actual</strong>: recalculado con precios y parámetros de hoy. <strong>Δ</strong>: diferencia en puntos porcentuales (positivo = contexto mejoró).</div>';
  }

  if(!html){
    html = '<div style="padding:40px;text-align:center;color:rgba(26,22,18,.4);font-family:\'DM Mono\',monospace">Sin datos de negocios disponibles</div>';
  }
  bodyEl.innerHTML = html;
}

// ── Gráfico Histórico de Precios ───────────────────────────
var _histChart = null;
var _histSeries = [
  // [campo, label, color, visible por defecto, isGrano(/1000), isMEP, grupo]
  // ── Cañuelas MAG ──
  ['nov_390',      'Novillito ≤390',     '#6aab9c', true,  false, false, 'MAG'],
  ['nov_430',      'Novillito 391/430',  '#27613d', false, false, false, 'MAG'],
  ['nov_460',      'Novillo 431/460',    '#b8922a', true,  false, false, 'MAG'],
  ['nov_490',      'Novillo 461/490',    '#d4a23a', false, false, false, 'MAG'],
  ['vaq_390',      'Vaquillona ≤390',   '#c0392b', true,  false, false, 'MAG'],
  ['vac_buena',    'Vaca Buena',         '#8e44ad', false, false, false, 'MAG'],
  ['vac_regular',  'Vaca Regular',       '#a569bd', false, false, false, 'MAG'],
  ['vac_conserva', 'Vaca Conserva',      '#c39bd3', false, false, false, 'MAG'],
  ['ternero',      'Ternero MAG',        '#2980b9', true,  false, false, 'MAG'],
  ['ternera',      'Ternera MAG',        '#7fb3d3', false, false, false, 'MAG'],
  ['maiz',         'Maíz $/tn÷1000',    '#e8a020', false, true,  false, 'MAG'],
  ['soja',         'Soja $/tn÷1000',    '#5d8a3c', false, true,  false, 'MAG'],
  ['tc_mep',       'Dólar MEP',         '#5b8aba', false, false, true,  'MAG'],
  // ── Entre Surcos y Corrales — Terneros ──
  ['ter_130_160',  'Ternero 130-160',   '#1a6699', true,  false, false, 'ESYC-T'],
  ['ter_230_260',  'Ternero 230-260',   '#2e86c1', true,  false, false, 'ESYC-T'],
  ['nov_330_370',  'Novillito 330-370', '#5dade2', true,  false, false, 'ESYC-T'],
  // ── Entre Surcos y Corrales — Terneras ──
  ['tera_130_150', 'Ternera 130-150',  '#922b21', true,  false, false, 'ESYC-H'],
  ['tera_150_170', 'Ternera 150-170',  '#cb4335', false, false, false, 'ESYC-H'],
  ['vaq_250_290',  'Vaquillona 250-290','#e74c3c', true,  false, false, 'ESYC-H'],
  ['vaq_320_360',  'Vaquillona 320-360','#f1948a', true,  false, false, 'ESYC-H'],
];
var _histVisible = {};

function _histBuildFiltros(){
  var box = document.getElementById('mercadoHistFiltros');
  if(!box) return;
  box.innerHTML = '';

  var GRUPOS = [
    { key:'MAG',    label:'Mercado Agroganadero (Cañuelas)' },
    { key:'ESYC-T', label:'Entre Surcos y Corrales · Terneros' },
    { key:'ESYC-H', label:'Entre Surcos y Corrales · Terneras' },
  ];

  GRUPOS.forEach(function(g){
    var series = _histSeries.filter(function(s){ return s[6] === g.key; });
    if(!series.length) return;

    // Cabecera del grupo
    var grpDiv = document.createElement('div');
    grpDiv.style.cssText = 'width:100%;margin-top:10px;margin-bottom:4px;font-family:DM Mono,monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.35)';
    grpDiv.textContent = g.label;
    box.appendChild(grpDiv);

    // Botones del grupo
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:2px';
    series.forEach(function(s){
      var field = s[0], label = s[1], color = s[2];
      var on = !!_histVisible[field];
      var isESYC = g.key !== 'MAG';
      var btn = document.createElement('button');
      btn.setAttribute('data-hfield', field);
      btn.style.cssText = 'font-family:DM Mono,monospace;font-size:9.5px;letter-spacing:.05em;padding:4px 10px;border-radius:2px;cursor:pointer;transition:all .15s;'
        + 'border:1px solid ' + (on ? color : 'rgba(26,22,18,.18)') + ';'
        + 'background:' + (on ? color : 'transparent') + ';'
        + 'color:' + (on ? '#fff' : 'rgba(26,22,18,.5)') + ';'
        + (isESYC && on ? 'border-style:dashed;' : '');
      btn.textContent = label;
      btn.onclick = function(){
        _histVisible[field] = !_histVisible[field];
        _histBuildFiltros();
        _histRenderChart();
        _histRenderTabla();
      };
      btnRow.appendChild(btn);
    });
    box.appendChild(btnRow);
  });
}

function _histRenderChart(){
  var data = MERCADO_DATA_CACHE;
  if(!data || !data.historico) return;
  var hist = data.historico.slice(-90);
  var labels = hist.map(function(h){ return h.fecha ? h.fecha.slice(5).replace('-','/') : ''; });
  var hasMEP = false;

  var datasets = [];
  _histSeries.forEach(function(s){
    var field = s[0], label = s[1], color = s[2], isGrano = !!s[4], isMEP = (s[5] === true), isESYC = (s[6] && s[6] !== 'MAG');
    if(!_histVisible[field]) return;
    if(isMEP) hasMEP = true;
    var vals = hist.map(function(h){
      var v = h[field];
      if((v==null||v===0) && field==='nov_460') v = h['novillo']||null;
      if((v==null||v===0) && field==='ternero') v = h['ternero']||null;
      if(v==null||v===0) return null;
      return isGrano ? v/1000 : v;
    });
    var hex2rgba = function(hex, a){ var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return 'rgba('+r+','+g+','+b+','+a+')'; };
    datasets.push({
      label:           label,
      data:            vals,
      borderColor:     color,
      backgroundColor: hex2rgba(color, isESYC ? 0.03 : 0.07),
      tension:         .3,
      pointRadius:     isESYC ? 1.5 : 2,
      borderWidth:     isMEP ? 2.5 : (isESYC ? 1.5 : 2),
      borderDash:      isMEP ? [5,3] : (isESYC ? [4,2] : []),
      spanGaps:        true,
      yAxisID:         isMEP ? 'yMEP' : 'y',
    });
  });

  var ctx = document.getElementById('chartMercadoHistorico').getContext('2d');
  if(_histChart){ _histChart.destroy(); }
  var scalesOpts = {
    x:{ ticks:{ font:{family:'DM Mono,monospace',size:9}, maxTicksLimit:14, color:'rgba(26,22,18,.45)' }, grid:{color:'rgba(0,0,0,.04)'} },
    y:{ ticks:{ font:{family:'DM Mono,monospace',size:9}, color:'rgba(26,22,18,.45)',
          callback:function(v){ return '$'+Number(v).toLocaleString('es-AR',{maximumFractionDigits:0}); }
        }, grid:{color:'rgba(0,0,0,.04)'} },
    yMEP:{ display: hasMEP, position:'right',
      ticks:{ font:{family:'DM Mono,monospace',size:8}, color:'#5b8aba',
        callback:function(v){ return 'U$S '+Number(v).toLocaleString('es-AR'); }
      },
      grid:{ drawOnChartArea:false },
      title:{ display:false }
    }
  };
  _histChart = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options:{
      responsive: true,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ display: false },
        tooltip:{ callbacks:{
          label:function(c){
            var raw = c.raw || 0;
            if(c.dataset.yAxisID === 'yMEP')
              return '  '+c.dataset.label+': U$S '+Number(raw).toLocaleString('es-AR',{maximumFractionDigits:0})+'/USD';
            return '  '+c.dataset.label+': $'+Number(raw).toLocaleString('es-AR',{maximumFractionDigits:0});
          }
        }}
      },
      scales: scalesOpts
    }
  });
}

// ── Análisis histórico de compras ────────────────────────────────────────────
function _analNormCat(cat){
  if(!cat) return 'Sin categoría';
  var c = cat.toLowerCase().trim();
  if(c.indexOf('novillito')>=0) return 'Novillito';
  if(c.indexOf('novillo')>=0)   return 'Novillo';
  if(c.indexOf('ternero')>=0||c.indexOf('ternero macho')>=0) return 'Ternero';
  if(c.indexOf('ternera')>=0)   return 'Ternera';
  if(c.indexOf('vaquillona')>=0||c.indexOf('vaq')>=0) return 'Vaquillona';
  if(c.indexOf('vaca holando')>=0) return 'Vaca Holando';
  if(c.indexOf('vaca')>=0)      return 'Vaca';
  if(c.indexOf('toro')>=0)      return 'Toro';
  return cat.charAt(0).toUpperCase()+cat.slice(1).toLowerCase();
}
function _analCatToTipo(cat){
  var c = cat.toLowerCase();
  if(c==='ternero'||c==='ternero macho') return 'terneros';
  if(c==='ternera')   return 'terneras';
  if(c==='vaca'||c==='vaca holando') return 'vacas';
  if(c==='vaquillona') return 'terneras';
  if(c==='toro') return 'vacas';
  // novillos/novillitos → terneros (categoría más cercana)
  return 'terneros';
}
function _analCatPesoE(cat){
  // ⚠ Debe coincidir con _negCatMap en renderNegocio
  var c = cat.toLowerCase();
  if(c==='ternero'||c==='ternero macho') return 220;
  if(c==='ternera') return 200;
  if(c==='novillito') return 390;
  if(c==='novillo')   return 460;
  if(c==='vaquillona') return 350;
  if(c==='vaca'||c==='vaca holando') return 480;
  if(c==='toro') return 500;
  return 400;
}
function _analCatPesoS(cat){
  // ⚠ Debe coincidir con _negCatMap en renderNegocio
  var c = cat.toLowerCase();
  if(c==='ternero'||c==='ternero macho') return 490;  // era 430
  if(c==='ternera') return 450;                        // era 380
  if(c==='novillito') return 500;                      // era 490
  if(c==='novillo')   return 500;                      // era 490 → igual al mapa de Negocio
  if(c==='vaquillona') return 450;
  if(c==='vaca'||c==='vaca holando') return 600;       // era 620
  if(c==='toro') return 600;                           // era 650
  return 500;
}
function _analFechaMes(f){
  // "30/03/26" o "09/03/26" → "2026-03"
  if(!f) return '';
  var p = f.split('/');
  if(p.length===3){
    var yr = p[2].length===2 ? '20'+p[2] : p[2];
    return yr+'-'+(p[1].length===1?'0'+p[1]:p[1]);
  }
  // "2026-03-30" format
  if(f.indexOf('-')>=0) return f.slice(0,7);
  return f;
}
function _analMesLabel(m){
  var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var p = m.split('-');
  if(p.length===2){ var mi=parseInt(p[1])-1; return meses[mi]+" '"+p[0].slice(2); }
  return m;
}

function renderAnalisis(){
  var el = document.getElementById('analisisBody');
  if(!el) return;
  var neg = NEGOCIOS_DATA_CACHE;
  if(!neg || !neg.compras || !neg.compras.length){
    el.innerHTML='<div style="color:rgba(26,22,18,.4);font-family:DM Mono,monospace;font-size:13px;padding:24px 0">Sin datos de compras disponibles. Ejecutá la actualización.</div>';
    return;
  }
  var ins = (MERCADO_DATA_CACHE && MERCADO_DATA_CACHE.insumos) ? MERCADO_DATA_CACHE.insumos : {};
  var bp  = bpGet();

  // Calcular resultado para cada compra
  var filas = [];
  neg.compras.forEach(function(c){
    var catNorm = _analNormCat(c.categoria);
    var tipo    = _analCatToTipo(catNorm);
    var pesoE   = c.kg_cab > 0 ? c.kg_cab : _analCatPesoE(catNorm);
    var pesoS   = _analCatPesoS(catNorm);
    var mes     = _analFechaMes(c.fecha);
    if(!c.precio_kg || !ins.maiz) { filas.push({cat:catNorm,origen:c.origen||'Sin datos',mes:mes,cab:c.cabezas||1,res:null,pcInd:null,pc:c.precio_kg,pesoE:pesoE,pesoS:pesoS,pesoEreal:c.kg_cab>0}); return; }
    var bpTipo  = bp[tipo] || null;
    var sim     = _segSimCat(tipo, pesoE, pesoS, c.precio_kg, ins, bpTipo);
    filas.push({
      cat:      catNorm,
      origen:   (c.origen||'Sin datos').trim(),
      mes:      mes,
      cab:      c.cabezas||1,
      pc:       c.precio_kg,
      pesoE:    pesoE,
      pesoS:    pesoS,
      pesoEreal: c.kg_cab > 0,
      res:      sim ? sim.resEco      : null,
      pcInd:    sim ? sim.pcInd       : null,
      pv:       sim ? sim.pv          : null,
      dias:     sim ? sim.dias        : null,
      ingV:     sim ? sim.ingresoVenta: null,
    });
  });

  // Filtro acumulativo: solo datos desde 01/03/2026
  var CORTE_ACUM = '2026-03';
  var filasAcum = filas.filter(function(f){ return f.mes && f.mes >= CORTE_ACUM; });

  var filasCon = filas.filter(function(f){ return f.res!==null; });
  var meses    = Array.from(new Set(filas.map(function(f){return f.mes;}))).filter(Boolean).sort();
  var cats     = Array.from(new Set(filas.map(function(f){return f.cat;}))).sort();
  var origs    = Array.from(new Set(filas.map(function(f){return f.origen;}))).filter(function(o){return o&&o!=='Sin datos';}).sort();

  // Sets para las tablas acumulativas (solo desde 01/03/2026)
  var mesesAcum  = Array.from(new Set(filasAcum.map(function(f){return f.mes;}))).filter(Boolean).sort();
  var catsAcum   = Array.from(new Set(filasAcum.map(function(f){return f.cat;}))).sort();
  var origsAcum  = Array.from(new Set(filasAcum.map(function(f){return f.origen;}))).filter(function(o){return o&&o!=='Sin datos';}).sort();

  function fmtRes(res, cab){
    if(res===null) return '<span style="color:rgba(26,22,18,.3)">—</span>';
    var pos = res>=0;
    var col = pos?'#27613d':'#c0392b';
    var pfx = pos?'+':'';
    return '<span style="color:'+col+';font-weight:600">'+pfx+'$'+Number(res).toLocaleString('es-AR',{maximumFractionDigits:0})+'/cab</span>';
  }
  function fmtPct(roi){
    if(roi===null) return '<span style="color:rgba(26,22,18,.3)">—</span>';
    var pos=roi>=0; var col=pos?'#27613d':'#c0392b';
    return '<span style="color:'+col+';font-weight:600">'+(pos?'+':'')+roi.toFixed(1)+'%</span>';
  }
  function bgCell(roi){
    if(roi===null) return 'background:rgba(26,22,18,.03)';
    if(roi>=10)  return 'background:rgba(39,97,61,.13)';
    if(roi>=0)   return 'background:rgba(39,97,61,.06)';
    if(roi>=-10) return 'background:rgba(192,57,43,.06)';
    return 'background:rgba(192,57,43,.13)';
  }
  function avgGroup(arr){
    var v=arr.filter(function(x){return x.res!==null;});
    if(!v.length) return null;
    // peso por cabezas
    var totCab=0, totRes=0, totPc=0, totInd=0, totIngV=0;
    v.forEach(function(f){ totCab+=f.cab; totRes+=f.res*f.cab; totPc+=f.pc*f.cab; totInd+=(f.pcInd||0)*f.cab; totIngV+=(f.ingV||0)*f.cab; });
    return {res:totRes/totCab, pc:totPc/totCab, pcInd:totInd/totCab, ingV:totIngV/totCab, cab:totCab, tropas:v.length};
  }
  // Rentabilidad sobre monto de venta: resultado / ingreso_venta
  function roi(avg){ if(!avg||!avg.ingV) return null; return avg.res/avg.ingV*100; }

  var TH = 'font-family:DM Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.42);padding:7px 10px;background:rgba(26,22,18,.03);border-bottom:2px solid rgba(26,22,18,.1);white-space:nowrap;text-align:right;font-weight:400';
  var TD = 'padding:6px 10px;border-bottom:1px solid rgba(26,22,18,.06);font-family:DM Mono,monospace;font-size:13px;vertical-align:middle';
  var html = '';

  // ── 1. Tabla resumen acumulado por Categoría (desde 01/03/2026) ──
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:4px">Resultado acumulado por Categoría</div>';
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.4);margin-bottom:10px">Datos desde 01/03/2026 · Rent. s/Vta. = resultado / monto venta neto por cab</div>';
  html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:28px">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr>'
    +'<th style="'+TH+';text-align:left">Categoría</th>'
    +'<th style="'+TH+'">Tropas</th>'
    +'<th style="'+TH+'">Cabezas</th>'
    +'<th style="'+TH+'">Precio prom</th>'
    +'<th style="'+TH+'">Indif. prom</th>'
    +'<th style="'+TH+'">Desvío</th>'
    +'<th style="'+TH+'">Resultado prom</th>'
    +'<th style="'+TH+'">Rent. s/Vta.</th>'
    +'</tr></thead><tbody>';
  catsAcum.forEach(function(cat){
    var grupo = filasAcum.filter(function(f){return f.cat===cat;});
    var avg   = avgGroup(grupo);
    var r     = roi(avg);
    var desv  = avg ? avg.pcInd - avg.pc : null;
    var desvCol = desv===null?'rgba(26,22,18,.3)':desv>=0?'#27613d':'#c0392b';
    html += '<tr>'
      +'<td style="'+TD+'"><strong>'+cat+'</strong></td>'
      +'<td style="'+TD+';text-align:right">'+(avg?avg.tropas:'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+(avg?Number(avg.cab).toLocaleString('es-AR'):'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+(avg?'$'+Math.round(avg.pc).toLocaleString('es-AR'):'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+(avg&&avg.pcInd?'$'+Math.round(avg.pcInd).toLocaleString('es-AR'):'—')+'</td>'
      +'<td style="'+TD+';text-align:right;color:'+desvCol+';font-weight:600">'+(desv!==null?(desv>=0?'+':'')+Math.round(desv).toLocaleString('es-AR')+'$/kg':'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+fmtRes(avg?avg.res:null)+'</td>'
      +'<td style="'+TD+';text-align:right;'+bgCell(r)+'">'+fmtPct(r)+'</td>'
      +'</tr>';
  });
  if(!catsAcum.length) html += '<tr><td colspan="8" style="'+TD+';color:rgba(26,22,18,.4);text-align:center;padding:20px">Sin compras registradas desde 01/03/2026</td></tr>';
  html += '</tbody></table></div>';

  // ── 2. Tabla resumen acumulado por Proveedor (desde 01/03/2026) ──
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:4px">Resultado acumulado por Proveedor / Origen</div>';
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.4);margin-bottom:10px">Datos desde 01/03/2026 · Rent. s/Vta. = resultado / monto venta neto por cab</div>';
  html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:28px">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr>'
    +'<th style="'+TH+';text-align:left">Proveedor</th>'
    +'<th style="'+TH+'">Tropas</th>'
    +'<th style="'+TH+'">Cabezas</th>'
    +'<th style="'+TH+'">Precio prom</th>'
    +'<th style="'+TH+'">Indif. prom</th>'
    +'<th style="'+TH+'">Desvío</th>'
    +'<th style="'+TH+'">Resultado prom</th>'
    +'<th style="'+TH+'">Rent. s/Vta.</th>'
    +'</tr></thead><tbody>';
  origsAcum.forEach(function(orig){
    var grupo = filasAcum.filter(function(f){return f.origen===orig;});
    var avg   = avgGroup(grupo);
    var r     = roi(avg);
    var desv  = avg ? avg.pcInd - avg.pc : null;
    var desvCol = desv===null?'rgba(26,22,18,.3)':desv>=0?'#27613d':'#c0392b';
    html += '<tr>'
      +'<td style="'+TD+'"><strong>'+orig+'</strong></td>'
      +'<td style="'+TD+';text-align:right">'+(avg?avg.tropas:'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+(avg?Number(avg.cab).toLocaleString('es-AR'):'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+(avg?'$'+Math.round(avg.pc).toLocaleString('es-AR'):'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+(avg&&avg.pcInd?'$'+Math.round(avg.pcInd).toLocaleString('es-AR'):'—')+'</td>'
      +'<td style="'+TD+';text-align:right;color:'+desvCol+';font-weight:600">'+(desv!==null?(desv>=0?'+':'')+Math.round(desv).toLocaleString('es-AR')+'$/kg':'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+fmtRes(avg?avg.res:null)+'</td>'
      +'<td style="'+TD+';text-align:right;'+bgCell(r)+'">'+fmtPct(r)+'</td>'
      +'</tr>';
  });
  if(!origsAcum.length) html += '<tr><td colspan="8" style="'+TD+';color:rgba(26,22,18,.4);text-align:center;padding:20px">Sin compras registradas desde 01/03/2026</td></tr>';
  html += '</tbody></table></div>';

  // ── 3. Matriz mes × categoría (desde 01/03/2026) ────────────────
  if(mesesAcum.length>1){
    html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Rentabilidad s/Vta. por Mes × Categoría</div>';
    html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:28px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr><th style="'+TH+';text-align:left">Categoría</th>';
    mesesAcum.forEach(function(m){ html+='<th style="'+TH+'">'+_analMesLabel(m)+'</th>'; });
    html += '<th style="'+TH+'">Total</th></tr></thead><tbody>';
    catsAcum.forEach(function(cat){
      html += '<tr><td style="'+TD+'"><strong>'+cat+'</strong></td>';
      mesesAcum.forEach(function(m){
        var g = filasAcum.filter(function(f){return f.cat===cat&&f.mes===m;});
        var avg=avgGroup(g); var r=roi(avg);
        html += '<td style="'+TD+';text-align:right;'+bgCell(r)+'">'+(r!==null?fmtPct(r):'<span style="opacity:.3">—</span>')+'</td>';
      });
      var avgTot=avgGroup(filasAcum.filter(function(f){return f.cat===cat;})); var rTot=roi(avgTot);
      html += '<td style="'+TD+';text-align:right;font-weight:700">'+fmtPct(rTot)+'</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // ── 4. Matriz mes × proveedor (desde 01/03/2026) ─────────────────
    html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Rentabilidad s/Vta. por Mes × Proveedor</div>';
    html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:28px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr><th style="'+TH+';text-align:left">Proveedor</th>';
    mesesAcum.forEach(function(m){ html+='<th style="'+TH+'">'+_analMesLabel(m)+'</th>'; });
    html += '<th style="'+TH+'">Total</th></tr></thead><tbody>';
    origsAcum.forEach(function(orig){
      html += '<tr><td style="'+TD+'"><strong>'+orig+'</strong></td>';
      mesesAcum.forEach(function(m){
        var g=filasAcum.filter(function(f){return f.origen===orig&&f.mes===m;});
        var avg=avgGroup(g); var r=roi(avg);
        html += '<td style="'+TD+';text-align:right;'+bgCell(r)+'">'+(r!==null?fmtPct(r):'<span style="opacity:.3">—</span>')+'</td>';
      });
      var avgTot=avgGroup(filasAcum.filter(function(f){return f.origen===orig;})); var rTot=roi(avgTot);
      html += '<td style="'+TD+';text-align:right;font-weight:700">'+fmtPct(rTot)+'</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // ── 5. Detalle tropa por tropa ────────────────────────────────────
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Detalle por Tropa · Últimas '+Math.min(filas.length,30)+'</div>';
  html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr>'
    +'<th style="'+TH+';text-align:left">Fecha</th>'
    +'<th style="'+TH+';text-align:left">Categoría</th>'
    +'<th style="'+TH+';text-align:left">Proveedor</th>'
    +'<th style="'+TH+'">Cab.</th>'
    +'<th style="'+TH+'">$/kg</th>'
    +'<th style="'+TH+'">kg/cab</th>'
    +'<th style="'+TH+'">Indif.</th>'
    +'<th style="'+TH+'">Desvío</th>'
    +'<th style="'+TH+'">Resultado</th>'
    +'<th style="'+TH+'">Rent. s/Vta.</th>'
    +'</tr></thead><tbody>';
  var detalle = filas.slice().reverse().slice(0,30);
  detalle.forEach(function(f){
    var desv = (f.pcInd&&f.pc) ? f.pcInd-f.pc : null;
    var desvCol = desv===null?'rgba(26,22,18,.3)':desv>=0?'#27613d':'#c0392b';
    var r = (f.res!==null && f.ingV && f.ingV>0) ? f.res/f.ingV*100 : null;
    // kg/cab: entrada real o estimada → salida estimada
    var kgCell = f.pesoE
      ? (f.pesoEreal
          ? '<span style="font-weight:600">'+f.pesoE+'</span><span style="color:rgba(26,22,18,.35);font-size:11px"> →'+f.pesoS+'</span>'
          : '<span style="color:rgba(26,22,18,.45)" title="Peso estimado por categoría">'+f.pesoE+'*</span><span style="color:rgba(26,22,18,.25);font-size:11px"> →'+f.pesoS+'</span>')
      : '—';
    html += '<tr>'
      +'<td style="'+TD+';white-space:nowrap">'+f.mes+'</td>'
      +'<td style="'+TD+'"><strong>'+f.cat+'</strong></td>'
      +'<td style="'+TD+'">'+f.origen+'</td>'
      +'<td style="'+TD+';text-align:right">'+Number(f.cab).toLocaleString('es-AR')+'</td>'
      +'<td style="'+TD+';text-align:right">$'+Math.round(f.pc||0).toLocaleString('es-AR')+'</td>'
      +'<td style="'+TD+';text-align:right;font-family:DM Mono,monospace;font-size:12px">'+kgCell+'</td>'
      +'<td style="'+TD+';text-align:right">'+(f.pcInd?'$'+Math.round(f.pcInd).toLocaleString('es-AR'):'—')+'</td>'
      +'<td style="'+TD+';text-align:right;color:'+desvCol+';font-weight:600">'+(desv!==null?(desv>=0?'+':'')+Math.round(desv).toLocaleString('es-AR')+'$/kg':'—')+'</td>'
      +'<td style="'+TD+';text-align:right">'+fmtRes(f.res)+'</td>'
      +'<td style="'+TD+';text-align:right">'+fmtPct(r)+'</td>'
      +'</tr>';
  });
  html += '</tbody></table></div>';

  el.innerHTML = html;
}

function renderHistoricoChart(){
  var data = MERCADO_DATA_CACHE;
  var noDataEl = document.getElementById('mercadoHistNoData');
  var chartEl  = document.getElementById('mercadoHistoricoChart');

  if(!data || !data.historico || data.historico.length < 3){
    if(noDataEl) noDataEl.style.display='block';
    if(chartEl)  chartEl.style.display='none';
    return;
  }
  if(noDataEl) noDataEl.style.display='none';
  if(chartEl)  chartEl.style.display='block';

  // Inicializar visibilidad por defecto (solo primera vez)
  if(Object.keys(_histVisible).length === 0){
    _histSeries.forEach(function(s){ _histVisible[s[0]] = s[3]; });
  }
  _histBuildFiltros();
  _histRenderChart();
  _histRenderTabla();
}

// ── Tabla variación porcentual histórico ──────────────────────────────────────
function _histRenderTabla(){
  var wrap = document.getElementById('mercadoHistTablaWrap');
  if(!wrap) return;
  var data = MERCADO_DATA_CACHE;
  if(!data || !data.historico || data.historico.length < 2){ wrap.innerHTML=''; return; }

  // Series visibles
  var visibles = _histSeries.filter(function(s){ return !!_histVisible[s[0]]; });
  if(!visibles.length){ wrap.innerHTML=''; return; }

  // Últimas 90 entradas, invertidas (más reciente primero)
  var hist = data.historico.slice(-90).reverse();

  // Helper: valor de un campo (granos /1000 igual que gráfico)
  function getVal(row, s){
    var v = row[s[0]];
    if((v==null||v===0) && s[0]==='nov_460') v = row['novillo']||null;
    if((v==null||v===0) && s[0]==='ternero') v = row['ternero']||null;
    if(v==null||v===0) return null;
    return s[4] ? v/1000 : v;
  }

  // Construir HTML
  var th = '<thead><tr><th style="position:sticky;left:0;background:#f5f2ec;z-index:2;white-space:nowrap;padding:6px 10px;font-family:DM Mono,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid rgba(26,22,18,.15);border-right:1px solid rgba(26,22,18,.08)">Fecha</th>';
  visibles.forEach(function(s){
    th += '<th style="padding:6px 10px;font-family:DM Mono,monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:'+s[2]+';white-space:nowrap;border-bottom:2px solid '+s[2]+';text-align:right;min-width:110px">'+s[1]+'</th>';
  });
  th += '</tr></thead>';

  var rows = '';
  for(var i=0;i<hist.length;i++){
    var row = hist[i];
    var prev = hist[i+1] || null;
    var dateStr = row.fecha ? row.fecha.slice(0,10) : '—'; // yyyy-mm-dd → dd/mm/yyyy
    var parts = dateStr.split('-');
    var label = parts.length===3 ? parts[2]+'/'+parts[1]+'/'+parts[0] : dateStr;

    var bgRow = i%2===0 ? 'background:#faf8f4' : 'background:#fff';
    var tr = '<tr style="'+bgRow+'">';
    tr += '<td style="position:sticky;left:0;z-index:1;'+(i%2===0?'background:#faf8f4':'background:#fff')+';padding:5px 10px;font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.7);white-space:nowrap;border-right:1px solid rgba(26,22,18,.08)">'+label+'</td>';

    visibles.forEach(function(s){
      var cur = getVal(row, s);
      var pre = prev ? getVal(prev, s) : null;

      var priceStr = cur!=null ? '$'+Number(cur).toLocaleString('es-AR',{maximumFractionDigits:0}) : '—';
      var pctStr = '';
      var pctColor = 'rgba(26,22,18,.4)';
      var pctBg = 'transparent';

      if(cur!=null && pre!=null && pre!==0){
        var pct = ((cur - pre)/pre)*100;
        var abs = Math.abs(pct);
        pctStr = (pct>0?'+':'')+pct.toFixed(1)+'%';
        if(pct>0){
          pctColor = '#1a6b3c';
          pctBg = 'rgba(26,107,60,.08)';
        } else if(pct<0){
          pctColor = '#b5341a';
          pctBg = 'rgba(181,52,26,.08)';
        }
      }

      tr += '<td style="padding:5px 10px;text-align:right;vertical-align:middle">'
          + '<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.8)">'+priceStr+'</div>'
          + (pctStr ? '<div style="font-family:DM Mono,monospace;font-size:11px;color:'+pctColor+';background:'+pctBg+';display:inline-block;padding:1px 5px;border-radius:2px;margin-top:2px">'+pctStr+'</div>' : '<div style="font-size:11px;color:rgba(26,22,18,.25);margin-top:2px">—</div>')
          + '</td>';
    });
    tr += '</tr>';
    rows += tr;
  }

  wrap.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:10px;padding-top:4px">Variación mensual de precios ($/kg en pie)</div>'
    + '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:2px">'
    + '<table style="width:100%;border-collapse:collapse;font-size:13px">'
    + th
    + '<tbody>' + rows + '</tbody>'
    + '</table>'
    + '</div>';
}
