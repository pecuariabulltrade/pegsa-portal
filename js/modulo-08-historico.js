/* modulo-08-historico.js — Histórico & Evolución · 2026-04-25 */

// v15.52: se eliminó _histData (stock_historico.json) — nunca se le hacía fetch,
// _renderHistHacienda apuntaba a canvas inexistentes en index.html (código huérfano).
var _histDiario    = null;  // stock_diario.json     (diario)
var _histFinData   = null;  // financiero_historico.json
var _histRealData  = null;  // comportamiento_historico.json (módulo 9)
var _valData       = null;  // valuacion_historica.json (módulo 10)
var _histDiarioPer = 30;    // días mostrados por defecto
var _histDiarioFil = 'total';
var _histDiarioAmb = 'pegsa';  // v15.51: 'pegsa' | 'grupo' (solo en modo mensual)
var _mensualMesIdx = null;     // v15.52: mes elegido en el detalle campo×propietario (null = último)
var _histCharts    = {};
var _histInited    = false;

var HIST_COLORS = ['#b8922a','#27613d','#2d6a8a','#8a2d6a','#6a8a2d','#6a2d2d','#2d6a6a','#8a6a2d'];

// v15.47: color FIJO por establecimiento. Antes se asignaba por índice y el
// color de un campo cambiaba según qué campos tuvieran datos ese mes.
// Los establecimientos son un set cerrado (tabla CORRALES del pipeline).
var HIST_COLOR_CAMPO = {
  'El Haras':      '#27613d',
  'El Coloradito': '#6a2d2d',
  'Don Pedro':     '#b8922a',
  'El Descanso':   '#8a2d6a',
  'Campo Medel':   '#2d6a8a',
  'El Morrón':     '#6a8a2d',
  'La Panchita':   '#8a6a2d',
  'La Cucuca':     '#2d6a6a',
  'El Durazno':    '#a86a2d',
  'Recepción':     '#7a7a70'
};

// v15.47: color fijo por insumo (los nombres vienen de STOCK DE INSUMOS.xlsx)
var HIST_COLOR_INSUMO = {
  'SILO DE MAIZ':      '#b8922a',
  'MAIZ GRANO':        '#c9a94a',
  'GLUTEN DE MAIZ':    '#6a8a2d',
  'NUCLEO CONC 5% LDB':'#2d6a8a',
  'HARINA GERMEN':     '#8a6a2d',
  'SOJA':              '#27613d',
  'DIESEL':            '#6a2d2d'
};

// Fallback determinístico para nombres no previstos: hash simple del nombre
// sobre HIST_COLORS (mismo nombre → siempre mismo color, sin depender del orden).
function _colorCampo(nombre){
  if(HIST_COLOR_CAMPO[nombre]) return HIST_COLOR_CAMPO[nombre];
  var h = 0;
  for(var i=0;i<nombre.length;i++) h = (h*31 + nombre.charCodeAt(i)) & 0x7fffffff;
  return HIST_COLORS[h % HIST_COLORS.length];
}

function initHistorico(){
  if(_histInited) return;
  _histInited = true;
  var base = window.DATA_BASE_URL || 'https://raw.githubusercontent.com/pecuariabulltrade/pegsa-portal/main/';
  Promise.all([
    fetch(base + 'stock_diario.json').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
    fetch(base + 'comportamiento_historico.json').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
    fetch(base + 'valuacion_historica.json').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
  ]).then(function(results){
    _histDiario   = results[0];
    _histRealData = results[1];
    _valData      = results[2];
    _renderHistDiario(30, 'total');
    _renderHistInsumos();
    _renderHistReal();
  });
}

function histTab(name, el){
  ['diario','insumos','real'].forEach(function(p){
    document.getElementById('panelHist'+p.charAt(0).toUpperCase()+p.slice(1)).style.display = p===name?'block':'none';
  });
  document.querySelectorAll('#screenHistorico .nav-tab').forEach(function(t){t.classList.remove('active');});
  if(el) el.classList.add('active');
}

function _destroyChart(id){
  if(_histCharts[id]){try{_histCharts[id].destroy();}catch(e){} _histCharts[id]=null;}
}

/**
 * v15.47: plugin inline que dibuja el TOTAL encima de cada barra apilada.
 * Mismo patrón que el _labelsPlugin de modulo-06-tesoreria.js.
 * Suma solo los datasets VISIBLES (respeta el filtro de leyenda). Si recibe
 * `totalesFijos` (array), usa ese valor por barra en vez de sumar — necesario
 * en modo 100%, donde la suma de datasets da 100 pero queremos mostrar el
 * total absoluto real en toneladas.
 */
function _totalesArribaPlugin(fmt, totalesFijos){
  return {
    id: 'totalesArriba',
    afterDatasetsDraw: function(chart){
      var ctx = chart.ctx;
      var nBars = chart.data.labels.length;
      // Con barras muy finas el label se pisa → ocultarlo (guard del handoff)
      if(chart.chartArea && (chart.chartArea.width / Math.max(nBars,1)) < 34) return;
      ctx.save();
      ctx.font = '700 11px "DM Mono",monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(26,22,18,.75)';
      for(var i=0;i<nBars;i++){
        var total = 0, topY = null, x = null, vis = false;
        chart.data.datasets.forEach(function(ds, di){
          if(!chart.isDatasetVisible(di)) return;
          var v = ds.data[i];
          if(v == null) return;
          vis = true;
          total += v;
          var el = chart.getDatasetMeta(di).data[i];
          if(el){ x = el.x; if(topY === null || el.y < topY) topY = el.y; }
        });
        if(topY === null || !vis) continue;
        var mostrado = (totalesFijos && totalesFijos[i] != null) ? totalesFijos[i] : total;
        if(!mostrado) continue;
        ctx.fillText(fmt ? fmt(mostrado) : Math.round(mostrado).toLocaleString('es-AR'), x, topY - 6);
      }
      ctx.restore();
    }
  };
}

/**
 * v15.50 — marca horizontal en el TOTAL NETO de la barra.
 * En una barra divergente el tope de la pila positiva NO es el patrimonio: hay
 * que restarle el segmento negativo. Sin esta marca, el label de arriba (que sí
 * muestra el neto) parece estar rotulando el tope de los positivos. Solo se
 * dibuja en las barras que TIENEN un componente negativo.
 */
function _netoDivergentePlugin(){
  return {
    id: 'netoDivergente',
    afterDatasetsDraw: function(chart){
      var ctx = chart.ctx, esc = chart.scales.y;
      var n = chart.data.labels.length;
      ctx.save();
      ctx.setLineDash([4,3]);
      ctx.strokeStyle = 'rgba(26,22,18,.7)';
      ctx.lineWidth = 1.5;
      for(var i=0;i<n;i++){
        var neto = 0, hayNeg = false, el = null;
        chart.data.datasets.forEach(function(ds, di){
          if(!chart.isDatasetVisible(di)) return;
          var v = ds.data[i];
          if(v == null) return;
          neto += v;
          if(v < 0) hayNeg = true;
          var e = chart.getDatasetMeta(di).data[i];
          if(e) el = e;
        });
        if(!hayNeg || !el) continue;
        var py = esc.getPixelForValue(neto);
        var w  = (el.width || 24) / 2 + 3;
        ctx.beginPath();
        ctx.moveTo(el.x - w, py);
        ctx.lineTo(el.x + w, py);
        ctx.stroke();
      }
      ctx.restore();
    }
  };
}

/**
 * v15.47: barras apiladas con el look del portal (Playfair/DM Mono/HIST_COLORS).
 * opts: { porcentaje:bool, totalFmt:function|false, horizontal:bool, totalesFijos:array, marcarNeto:bool }
 */
function _mkStackedBarChart(canvasId, labels, datasets, yFmt, opts){
  opts = opts || {};
  _destroyChart(canvasId);
  var ctx = document.getElementById(canvasId);
  if(!ctx) return;
  var vAxis = opts.horizontal ? 'x' : 'y';

  var plugins = [];
  if(opts.totalFmt !== false) plugins.push(_totalesArribaPlugin(opts.totalFmt || yFmt, opts.totalesFijos));
  if(opts.marcarNeto) plugins.push(_netoDivergentePlugin());

  _histCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    options: {
      indexAxis: opts.horizontal ? 'y' : 'x',
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 22 } },   // espacio para el label del total
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'DM Mono', size: 11 }, boxWidth: 12, padding: 14, usePointStyle: false }
        },
        tooltip: {
          backgroundColor: 'rgba(26,22,18,.94)',
          titleFont: { family: 'DM Mono', size: 12, weight: '700' },
          bodyFont:  { family: 'DM Mono', size: 11 },
          padding: 10, cornerRadius: 4, boxPadding: 4,
          callbacks: {
            label: function(c){
              if(c.parsed[vAxis] == null) return null;
              var v = c.parsed[vAxis];
              return ' ' + c.dataset.label + ': ' + (yFmt ? yFmt(v) : v.toLocaleString('es-AR'));
            },
            footer: function(items){
              if(!items.length) return '';
              var f = opts.totalFmt || yFmt;
              if(opts.porcentaje){
                // en % la suma es 100 → mostrar el total absoluto real del mes
                var idx = items[0].dataIndex;
                var tot = (opts.totalesFijos && opts.totalesFijos[idx] != null)
                        ? opts.totalesFijos[idx]
                        : items.reduce(function(a,c){ return a + (c.parsed[vAxis]||0); }, 0);
                return 'Total: ' + (f ? f(tot) : tot.toLocaleString('es-AR'));
              }
              var t = items.reduce(function(a,c){ return a + (c.parsed[vAxis]||0); }, 0);
              return 'Total: ' + (f ? f(t) : t.toLocaleString('es-AR'));
            }
          },
          footerFont: { family: 'DM Mono', size: 11, weight: '700' },
          footerColor: '#e8dcc0'
        }
      },
      // El eje de VALOR (tons/%) es y en vertical y x en horizontal; el de
      // CATEGORÍA (los meses) va al revés. Sin este swap, en horizontal los
      // meses salían formateados como "0t..19t".
      scales: (function(){
        var valueScale = {
          stacked: true,
          ticks: {
            font: { family: 'DM Mono', size: 10 },
            callback: opts.porcentaje ? function(v){ return v+'%'; } : (yFmt || function(v){ return v.toLocaleString('es-AR'); })
          },
          grid: { color: 'rgba(0,0,0,.06)' },
          max: opts.porcentaje ? 100 : undefined
        };
        var catScale = {
          stacked: true,
          ticks: { font: { family: 'DM Mono', size: 10 }, maxRotation: opts.horizontal?0:45, minRotation: 0 },
          grid: { display: false }
        };
        return opts.horizontal ? { x: valueScale, y: catScale } : { x: catScale, y: valueScale };
      })(),
      datasets: { bar: { borderRadius: 2, borderSkipped: false, maxBarThickness: 46 } }
    },
    plugins: plugins
  });
}

function _mkLineChart(canvasId, labels, datasets, yFmt, yTitle){
  _destroyChart(canvasId);
  var ctx = document.getElementById(canvasId);
  if(!ctx) return;
  _histCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'DM Mono', size: 11 }, boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: function(ctx){ return ' ' + ctx.dataset.label + ': ' + (yFmt ? yFmt(ctx.parsed.y) : ctx.parsed.y.toLocaleString('es-AR')); }
          }
        }
      },
      scales: {
        x: { ticks: { font: { family: 'DM Mono', size: 10 } }, grid: { color: 'rgba(0,0,0,.06)' } },
        y: {
          ticks: { font: { family: 'DM Mono', size: 10 }, callback: yFmt || function(v){ return v.toLocaleString('es-AR'); } },
          grid: { color: 'rgba(0,0,0,.06)' },
          title: yTitle ? { display: true, text: yTitle, font: { family: 'DM Mono', size: 9 } } : undefined
        }
      }
    }
  });
}

// ── DIARIO ──────────────────────────────────────────────────
function histDiarioPeriodo(dias){
  _histDiarioPer = dias;
  // v15.51: el selector de ámbito (PEGSA/grupo) solo aplica al modo mensual
  var w = document.getElementById('wrapDiarioAmbito');
  if(w) w.style.display = (dias === -1) ? 'flex' : 'none';
  _renderHistDiario(_histDiarioPer, _histDiarioFil);
}
function histDiarioFiltro(tipo){
  _histDiarioFil = tipo;
  _mensualMesIdx = null;   // v15.52: reset del mes del detalle al cambiar de desglose
  _renderHistDiario(_histDiarioPer, _histDiarioFil);
}
function histDiarioAmbito(v){   // v15.51
  _histDiarioAmb = v;
  _mensualMesIdx = null;   // v15.52
  _renderHistDiario(_histDiarioPer, _histDiarioFil);
}

/**
 * v15.51 — vista MENSUAL de la pestaña Diario.
 * El desglose por establecimiento del stock diario solo puede acumularse hacia
 * adelante (el running balance reconstruye totales, no desgloses), así que
 * tardaría ~3 meses en poblarse. comportamiento_historico ya tiene 20 meses
 * completos con cabezas Y kg por establecimiento.
 * Fuente: _histRealData.snapshots[].hacienda_masa
 */
function _renderHistMensual(filtro){
  var chartsEl = document.getElementById('histDiarioCharts');
  var noDataEl = document.getElementById('histDiarioNoData');
  var noDataMsg= document.getElementById('histDiarioNoDataMsg');
  var resumenEl= document.getElementById('histMensualResumen');
  var kpisEl   = document.getElementById('histDiarioKpis');
  if(kpisEl) kpisEl.innerHTML = '';   // v15.51: los KPIs diarios no aplican en mensual

  function noData(msg){
    if(chartsEl) chartsEl.style.display = 'none';
    if(noDataEl) noDataEl.style.display = 'block';
    if(noDataMsg) noDataMsg.innerHTML = msg;
    if(resumenEl) resumenEl.style.display = 'none';
    var _d = document.getElementById('histMensualDetalle'); if(_d) _d.style.display = 'none';   // v15.52
    _destroyChart('chartDiarioCabezas'); _destroyChart('chartDiarioKg');
  }

  if(!_histRealData || !_histRealData.snapshots || !_histRealData.snapshots.length){
    return noData('Sin datos mensuales. Se generan al procesar los archivos Listado_Caravanas.');
  }

  var snaps  = _histRealData.snapshots.slice().sort(function(a,b){ return a.periodo<b.periodo?-1:1; });
  var labels = snaps.map(function(s){ return s.periodo; });
  var amb    = _histDiarioAmb;

  // Combinaciones no disponibles
  // v15.52: el desglose por campo del grupo ya existe (hacienda_masa.por_campo).
  // Guard defensivo por si algún mes quedó sin injertar.
  if(amb === 'grupo' && filtro === 'establecimiento'){
    var _conCampo = snaps.filter(function(s){ return (s.hacienda_masa || {}).por_campo; }).length;
    if(!_conCampo){
      return noData('El desglose por establecimiento del grupo todavía no se generó.<br><br>'
        + 'Se crea en la próxima ejecución del actualizador (v15.52).');
    }
  }
  if(amb === 'pegsa' && filtro === 'propietario'){
    return noData('PEGSA propio <strong>es</strong> un único propietario — no hay desglose posible.'
      + '<br><br>Elegí "Por establecimiento" para ver los campos, o cambiá la Hacienda a "Grupo completo".');
  }

  if(chartsEl) chartsEl.style.display = 'block';
  if(noDataEl) noDataEl.style.display = 'none';

  // v15.51: "Otro" = corral 10000 (tropa PEG.DES.19/02/26, 179 cabezas). El
  // usuario decidió en v15.46 no contabilizarlo. Aparece solo en 2026-06/07.
  var EXCLUIR_CAMPOS = { 'Otro': 1 };

  function bloque(s){ var hm = s.hacienda_masa || {}; return amb === 'pegsa' ? (hm.pegsa || {}) : hm; }
  function totalCab(s){ var hm = s.hacienda_masa || {}; return amb === 'pegsa' ? ((hm.pegsa||{}).cabezas || 0) : (hm.total_cabezas || 0); }
  function totalKg(s){ var hm = s.hacienda_masa || {}; return amb === 'pegsa' ? ((hm.pegsa||{}).kg_proyectado || 0) : (hm.total_kg || 0); }

  var dsCab, dsKg;

  if(filtro === 'total'){
    var nom = amb === 'pegsa' ? 'PEGSA propio' : 'Grupo completo';
    dsCab = [{ label: nom, data: snaps.map(totalCab), backgroundColor: '#b8922a' }];
    dsKg  = [{ label: nom, data: snaps.map(function(s){ return Math.round(totalKg(s)/1000); }), backgroundColor: '#27613d' }];
  } else {
    var key = (filtro === 'establecimiento') ? 'por_campo' : 'por_hotelero';
    var set = {};
    snaps.forEach(function(s){
      var b = bloque(s)[key] || {};
      Object.keys(b).forEach(function(k){ if(!EXCLUIR_CAMPOS[k]) set[k]=1; });
    });
    var claves = Object.keys(set).sort();
    if(!claves.length) return noData('Sin desglose disponible para esta combinación.');

    dsCab = claves.map(function(k){
      return { label: k, backgroundColor: _colorCampo(k),
        data: snaps.map(function(s){ var e = (bloque(s)[key]||{})[k]; return e ? e.cabezas : 0; }) };
    });
    dsKg = claves.map(function(k){
      return { label: k, backgroundColor: _colorCampo(k),
        data: snaps.map(function(s){ var e = (bloque(s)[key]||{})[k]; return e ? Math.round(e.kg_proyectado/1000) : 0; }) };
    });
  }

  var fCab = function(v){ return Math.round(v).toLocaleString('es-AR'); };
  var fKg  = function(v){ return Math.round(v).toLocaleString('es-AR')+' t'; };

  _mkStackedBarChart('chartDiarioCabezas', labels, dsCab, fCab, { totalFmt: fCab });
  _mkStackedBarChart('chartDiarioKg',      labels, dsKg,  fKg,  { totalFmt: fKg  });

  var nomF = { total:'total', propietario:'por propietario', establecimiento:'por establecimiento' };
  var sub = 'histórico mensual · ' + (amb==='pegsa'?'PEGSA propio':'grupo completo') + ' · ' + (nomF[filtro]||filtro);
  var a = document.getElementById('dSubCab'); if(a) a.textContent = sub;
  var b = document.getElementById('dSubKg');  if(b) b.textContent = sub;

  _renderHistMensualResumen(snaps, totalCab, totalKg);

  // v15.52: detalle campo × propietario (solo en grupo + establecimiento)
  if(amb === 'grupo' && filtro === 'establecimiento'){
    var chM = _histCharts['chartDiarioCabezas'];
    if(chM){
      chM.options.onClick = function(evt, elems){
        if(!elems || !elems.length) return;
        _mensualMesIdx = elems[0].index;
        _renderMensualDetalle(snaps, _mensualMesIdx, EXCLUIR_CAMPOS);
      };
      chM.update();
    }
    _renderMensualDetalle(snaps, _mensualMesIdx == null ? snaps.length-1 : _mensualMesIdx, EXCLUIR_CAMPOS);
  } else {
    var _det = document.getElementById('histMensualDetalle');
    if(_det) _det.style.display = 'none';
  }
}

/**
 * v15.52 — tabla campo × propietario de un mes.
 * En un feedlot que hotelea, "cuántas cabezas hay en El Haras" se compone de
 * PEGSA + terceros. Esta tabla abre esa composición.
 */
function _renderMensualDetalle(snaps, idx, excluir){
  var box = document.getElementById('histMensualDetalle');
  if(!box) return;
  var s = snaps[idx];
  var pc = (s && s.hacienda_masa && s.hacienda_masa.por_campo) || null;
  if(!pc){ box.style.display = 'none'; return; }

  var campos = Object.keys(pc).filter(function(k){ return !(excluir||{})[k]; })
                             .sort(function(a,b){ return pc[b].cabezas - pc[a].cabezas; });

  // Set de hoteleros presentes, ordenados por volumen total
  var hset = {};
  campos.forEach(function(c){
    Object.keys(pc[c].por_hotelero || {}).forEach(function(h){
      hset[h] = (hset[h] || 0) + (pc[c].por_hotelero[h].cabezas || 0);
    });
  });
  var hots = Object.keys(hset).sort(function(a,b){ return hset[b]-hset[a]; });

  var thL = 'style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:8px 10px;border-bottom:2px solid var(--border);white-space:nowrap"';
  var thR = thL.replace('nowrap"', 'nowrap;text-align:right"');
  var tdL = 'style="font-family:\'DM Mono\',monospace;font-size:13px;padding:8px 10px;white-space:nowrap"';
  var tdR = 'style="font-family:\'DM Mono\',monospace;font-size:13px;padding:8px 10px;text-align:right"';
  // v15.52: variantes bien formadas (el snippet del PROMPT concatenaba mal ;font-weight adentro del "")
  var tdRB = tdR.replace(/"$/, ';font-weight:600"');
  function tdRcolor(col){ return tdR.replace(/"$/, ';color:'+col+'"'); }

  var html = '<div class="panel" style="display:block">'
    + '<div class="section-header">'
    + '<span class="section-title">Ocupación por establecimiento — ' + s.periodo + '</span>'
    + '<span class="section-sub">Cabezas por propietario · clic en una barra del gráfico para cambiar de mes</span>'
    + '</div><div style="overflow-x:auto"><table class="data-table" style="width:100%;border-collapse:collapse">'
    + '<thead><tr><th ' + thL + '>Establecimiento</th>';
  hots.forEach(function(h){ html += '<th ' + thR + '>' + h + '</th>'; });
  html += '<th ' + thR + '>Total cab.</th><th ' + thR + '>Total kg</th><th ' + thR + '>% terceros</th></tr></thead><tbody>';

  campos.forEach(function(c){
    var e = pc[c], det = e.por_hotelero || {};
    var pegsa = (det['PEGSA'] || {}).cabezas || 0;
    var terceros = (e.cabezas || 0) - pegsa;
    var pct = e.cabezas ? (terceros / e.cabezas * 100) : 0;
    html += '<tr style="border-bottom:1px solid var(--border)">'
      + '<td ' + tdL + '><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'
      + _colorCampo(c) + ';margin-right:8px"></span>' + c + '</td>';
    hots.forEach(function(h){
      var v = (det[h] || {}).cabezas;
      html += '<td ' + tdR + '>' + (v ? v.toLocaleString('es-AR') : '—') + '</td>';
    });
    html += '<td ' + tdRB + '>' + (e.cabezas||0).toLocaleString('es-AR') + '</td>'
      + '<td ' + tdR + '>' + Math.round((e.kg_proyectado||0)/1000).toLocaleString('es-AR') + ' t</td>'
      + '<td ' + tdRcolor(pct > 0 ? '#2d6a8a' : 'rgba(26,22,18,.35)') + '>'
      + (pct > 0 ? pct.toFixed(1).replace('.',',') + '%' : '—') + '</td></tr>';
  });

  html += '</tbody></table></div></div>';
  box.innerHTML = html;
  box.style.display = 'block';
}

/**
 * v15.51 — tarjetas de promedio mensual + flujo punta a punta.
 */
function _renderHistMensualResumen(snaps, totalCab, totalKg){
  var box = document.getElementById('histMensualResumen');
  if(!box) return;

  var cabs = snaps.map(totalCab);
  var kgs  = snaps.map(totalKg);
  var n    = snaps.length;
  if(!n){ box.style.display='none'; return; }

  var promCab   = cabs.reduce(function(a,b){return a+b;},0) / n;
  var promKg    = kgs.reduce(function(a,b){return a+b;},0) / n;
  var promKgCab = promKg / Math.max(promCab,1);

  var dCab = cabs[n-1] - cabs[0];
  var dKg  = kgs[n-1]  - kgs[0];

  var iMax = cabs.indexOf(Math.max.apply(null, cabs));
  var iMin = cabs.indexOf(Math.min.apply(null, cabs));

  function card(lbl, val, sub, col){
    return '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:14px 18px">'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.45);margin-bottom:6px">'+lbl+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:21px;font-weight:700;color:'+(col||'var(--ink)')+'">'+val+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.5);margin-top:4px">'+sub+'</div>'
      +'</div>';
  }
  var sg = function(v){ return v>=0?'#27613d':'#c0392b'; };
  var fN = function(v){ return Math.round(v).toLocaleString('es-AR'); };

  box.style.display = 'block';
  box.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px">'
    + card('Promedio cabezas', fN(promCab), n+' meses')
    + card('Promedio masa',    fN(promKg/1000)+' t', n+' meses')
    + card('Kg por cabeza',    fN(promKgCab), 'promedio del período')
    + card('Flujo cabezas',    (dCab>=0?'+':'−')+fN(Math.abs(dCab)),
           snaps[0].periodo+' → '+snaps[n-1].periodo, sg(dCab))
    + card('Flujo masa',       (dKg>=0?'+':'−')+fN(Math.abs(dKg)/1000)+' t',
           snaps[0].periodo+' → '+snaps[n-1].periodo, sg(dKg))
    + card('Pico / piso',      fN(cabs[iMax])+' / '+fN(cabs[iMin]),
           snaps[iMax].periodo+' · '+snaps[iMin].periodo)
    + '</div>';
}

function _renderHistDiario(dias, filtro){
  // v15.51: modo mensual usa otra fuente (comportamiento_historico)
  if(dias === -1) return _renderHistMensual(filtro);
  var _resM = document.getElementById('histMensualResumen');
  if(_resM) _resM.style.display = 'none';
  var _detM = document.getElementById('histMensualDetalle');   // v15.52
  if(_detM) _detM.style.display = 'none';
  var chartsEl  = document.getElementById('histDiarioCharts');
  var noDataEl  = document.getElementById('histDiarioNoData');
  var noDataMsg = document.getElementById('histDiarioNoDataMsg');
  var kpisEl    = document.getElementById('histDiarioKpis');
  var genLbl    = document.getElementById('histDiarioGenLabel');

  function showNoData(msg){
    if(chartsEl)  chartsEl.style.display = 'none';
    if(noDataEl)  noDataEl.style.display = 'block';
    if(noDataMsg) noDataMsg.innerHTML = msg;
    if(kpisEl)    kpisEl.innerHTML = '';
    _destroyChart('chartDiarioCabezas');
    _destroyChart('chartDiarioKg');
  }
  function showCharts(){
    if(chartsEl) chartsEl.style.display = 'block';
    if(noDataEl) noDataEl.style.display = 'none';
  }

  if(!_histDiario || !_histDiario.snapshots || !_histDiario.snapshots.length){
    if(kpisEl) kpisEl.innerHTML='';
    showNoData('Sin datos diarios aún.<br>Se acumulan automáticamente con cada ejecución del actualizador de datos.');
    return;
  }

  // Filtrar por período
  var snaps = _histDiario.snapshots.slice();
  if(dias > 0) snaps = snaps.slice(-dias);
  var labels = snaps.map(function(s){
    var d=s.fecha.split('-'); return d[2]+'/'+d[1]; // DD/MM
  });

  // Mostrar fecha de generación
  if(genLbl && _histDiario.generado){
    var gd = new Date(_histDiario.generado);
    genLbl.textContent = 'Actualizado ' + gd.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'}) + ' ' + gd.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  }

  // KPIs rápidos
  var ultimo = snaps[snaps.length-1];
  var primero = snaps[0];
  var deltaCab = ultimo.hacienda.total_cabezas - primero.hacienda.total_cabezas;
  var deltaKg  = ultimo.hacienda.total_kg_estimado - primero.hacienda.total_kg_estimado;
  var kpiFmt = function(n){ return n>=0?'+'+n.toLocaleString('es-AR'):n.toLocaleString('es-AR'); };
  var kpiColor = function(n){ return n>=0?'#27613d':'#c0392b'; };
  var kpiBox = function(label, val, sub, col){
    return '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:14px 18px">'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.45);margin-bottom:6px">'+label+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;color:'+col+'">'+val+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.5);margin-top:4px">'+sub+'</div>'
      +'</div>';
  };
  document.getElementById('histDiarioKpis').innerHTML =
    kpiBox('Cabezas hoy', ultimo.hacienda.total_cabezas.toLocaleString('es-AR'), 'stock actual', 'var(--ink)') +
    kpiBox('Variación cabezas', kpiFmt(deltaCab), 'en el período', kpiColor(deltaCab)) +
    kpiBox('Kg estimado hoy', (ultimo.hacienda.total_kg_estimado/1000).toFixed(0)+'t', 'toneladas', 'var(--ink)') +
    kpiBox('Variación kg', kpiFmt(Math.round(deltaKg/1000))+'t', 'en el período', kpiColor(deltaKg));

  // Sub-labels
  var perLabel = dias>0?'últimos '+dias+' días':'todo el historial';
  var nomFiltro = {total:'total',propietario:'por propietario',establecimiento:'por establecimiento',categoria:'por categoría'};
  var sub = perLabel+' · '+(nomFiltro[filtro]||filtro);
  var dSubCab = document.getElementById('dSubCab'); if(dSubCab) dSubCab.textContent = sub;
  var dSubKg  = document.getElementById('dSubKg');  if(dSubKg)  dSubKg.textContent  = sub;

  // Construir datasets
  var dsCab, dsKg;
  if(filtro === 'total'){
    dsCab = [{
      label: 'Cabezas',
      data: snaps.map(function(s){ return s.hacienda.total_cabezas; }),
      borderColor: '#b8922a', backgroundColor: 'rgba(184,146,42,.08)',
      tension: .2, fill: true, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2
    }];
    dsKg = [{
      label: 'Kg estimado',
      data: snaps.map(function(s){ return s.hacienda.total_kg_estimado; }),
      borderColor: '#27613d', backgroundColor: 'rgba(39,97,61,.08)',
      tension: .2, fill: true, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2
    }];
  } else {
    var keyMap = {propietario:'por_propietario', establecimiento:'por_establecimiento', categoria:'por_categoria'};
    var nomFiltroLabel = {propietario:'propietarios / hoteleros', establecimiento:'establecimientos', categoria:'categorías'};
    var key = keyMap[filtro];
    var claveSet = {};
    snaps.forEach(function(s){ Object.keys(s.hacienda[key]||{}).forEach(function(k){ claveSet[k]=1; }); });
    var claves = Object.keys(claveSet);

    // Sin claves → aún no hay datos acumulados para este desglose
    if(!claves.length){
      var nomDesglose = nomFiltroLabel[filtro] || filtro;
      showNoData(
        'No hay datos desglosados por <strong>'+nomDesglose+'</strong> en el historial guardado aún.<br><br>'
        + 'Los datos se acumulan día a día con cada ejecución del actualizador. '
        + 'Ejecutá <code>ACTUALIZAR_PORTAL_AUTO.bat</code> y en la próxima corrida este gráfico se irá poblando.'
      );
      return;
    }

    dsCab = claves.map(function(k,i){
      return {
        label: k,
        data: snaps.map(function(s){ return (s.hacienda[key]||{})[k] ? s.hacienda[key][k].cabezas : null; }),
        borderColor: HIST_COLORS[i%HIST_COLORS.length], backgroundColor:'transparent',
        tension: .2, pointRadius: 1, pointHoverRadius: 4, borderWidth: 1.5, spanGaps: true
      };
    });
    dsKg = claves.map(function(k,i){
      return {
        label: k,
        data: snaps.map(function(s){ return (s.hacienda[key]||{})[k] ? s.hacienda[key][k].kg_estimado : null; }),
        borderColor: HIST_COLORS[i%HIST_COLORS.length], backgroundColor:'transparent',
        tension: .2, pointRadius: 1, pointHoverRadius: 4, borderWidth: 1.5, spanGaps: true
      };
    });
  }
  showCharts();

  // Tick: mostrar solo cada N labels para no saturar eje X
  var maxTicks = 12;
  var step = Math.max(1, Math.ceil(labels.length / maxTicks));

  var xTicks = {
    font:{family:'DM Mono',size:10},
    callback: function(val,i){ return i%step===0?labels[i]:''; },
    maxRotation: 0
  };

  _destroyChart('chartDiarioCabezas');
  var ctx1 = document.getElementById('chartDiarioCabezas');
  if(ctx1) _histCharts['chartDiarioCabezas'] = new Chart(ctx1, {
    type:'line', data:{labels:labels,datasets:dsCab},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:'bottom',labels:{font:{family:'DM Mono',size:11},boxWidth:12,padding:14}}},
      scales:{
        x:{ticks:xTicks, grid:{color:'rgba(0,0,0,.04)'}},
        y:{ticks:{font:{family:'DM Mono',size:10},callback:function(v){return v.toLocaleString('es-AR');}}, grid:{color:'rgba(0,0,0,.06)'}}
      }
    }
  });

  _destroyChart('chartDiarioKg');
  var ctx2 = document.getElementById('chartDiarioKg');
  if(ctx2) _histCharts['chartDiarioKg'] = new Chart(ctx2, {
    type:'line', data:{labels:labels,datasets:dsKg},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:'bottom',labels:{font:{family:'DM Mono',size:11},boxWidth:12,padding:14}}},
      scales:{
        x:{ticks:xTicks, grid:{color:'rgba(0,0,0,.04)'}},
        y:{ticks:{font:{family:'DM Mono',size:10},callback:function(v){return (v/1000).toFixed(0)+'t';}}, grid:{color:'rgba(0,0,0,.06)'}}
      }
    }
  });
}

function _renderHistInsumos(){
  if(!_histRealData || !_histRealData.snapshots || !_histRealData.snapshots.length) return;
  var snaps  = _histRealData.snapshots;
  var labels = snaps.map(function(s){ return s.periodo; });

  // Total kg
  var dsTot = [{
    label: 'Stock total insumos (kg)',
    data: snaps.map(function(s){ return s.insumos ? (s.insumos.total_kg||0) : 0; }),
    borderColor: '#b8922a', backgroundColor: 'rgba(184,146,42,.1)',
    tension: .3, fill: true, pointRadius: 5, pointHoverRadius: 7
  }];
  _mkLineChart('chartHistInsumos', labels, dsTot, function(v){ return (v/1000).toFixed(0)+'t'; }, 'toneladas');

  // Detalle por insumo — items puede ser array [{nombre,stock_kg}] u objeto {nombre:kg}
  var insuSet = {};
  snaps.forEach(function(s){
    if(s.insumos && s.insumos.items){
      var it = s.insumos.items;
      if(Array.isArray(it)){ it.forEach(function(x){ insuSet[x.nombre]=1; }); }
      else { Object.keys(it).forEach(function(k){ insuSet[k]=1; }); }
    }
  });
  var insumos = Object.keys(insuSet).sort();
  var dsIns = insumos.map(function(nom, i){
    return {
      label: nom.replace(/\s*\(KG\)/i,'').trim(),
      data: snaps.map(function(s){
        if(!s.insumos||!s.insumos.items) return null;
        var it = s.insumos.items;
        var kg = Array.isArray(it)
          ? (function(){ var x=it.find(function(x){ return x.nombre===nom; }); return x?x.stock_kg:null; })()
          : (it[nom]!=null ? it[nom] : null);
        return kg!=null ? +(kg/1000).toFixed(1) : null;
      }),
      borderColor: HIST_COLORS[i%HIST_COLORS.length],
      backgroundColor: 'transparent',
      tension: .3, pointRadius: 4, spanGaps: true
    };
  });
  _mkLineChart('chartHistInsumoDetalle', labels, dsIns, function(v){ return v.toFixed(0)+'t'; }, 'toneladas');
}

function _renderHistFinanciero(){
  if(!_histFinData || !_histFinData.cortes || !_histFinData.cortes.length) return;
  var cortes = _histFinData.cortes.filter(function(c){ return c.posicion && c.posicion.saldo_disponibilidades !== undefined; });
  if(!cortes.length) return;
  var labels = cortes.map(function(c){ return c.fecha_corte; });
  var vals   = cortes.map(function(c){ return c.posicion.saldo_disponibilidades||0; });

  _destroyChart('chartHistFinanciero');
  var ctx = document.getElementById('chartHistFinanciero');
  if(!ctx) return;

  _histCharts['chartHistFinanciero'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Posición Líquida ($)',
        data: vals,
        backgroundColor: vals.map(function(v){ return v>=0?'rgba(39,97,61,.7)':'rgba(192,57,43,.7)'; }),
        borderColor: vals.map(function(v){ return v>=0?'#27613d':'#c0392b'; }),
        borderWidth: 1, borderRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx){
              var v=ctx.parsed.y;
              return ' ' + (v>=0?'+':'') + '$\u00a0' + Math.round(Math.abs(v)).toLocaleString('es-AR') + (v<0?' (negativo)':'');
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { family: 'DM Mono', size: 10 } } },
        y: { ticks: { font: { family: 'DM Mono', size: 10 }, callback: function(v){ return '$\u00a0'+(v/1000000).toFixed(1)+'M'; } }, grid: { color: 'rgba(0,0,0,.06)' } }
      }
    }
  });

  // Tabla de cortes
  var tabla = document.getElementById('histFinancieroTabla');
  if(!tabla) return;
  var html = '<table class="data-table"><thead><tr><th>Fecha</th><th style="text-align:right">Saldo Disponibilidades</th><th style="text-align:right">FCI</th><th style="text-align:right">eCheqs Cartera</th><th style="text-align:right">USD cant.</th></tr></thead><tbody>';
  cortes.forEach(function(c){
    var p = c.posicion;
    var sd = p.saldo_disponibilidades||0;
    var color = sd>=0?'color:#27613d':'color:#c0392b';
    html += '<tr>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:13px">'+c.fecha_corte+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:600;'+color+'">'+(sd>=0?'+':'')+'$\u00a0'+Math.round(sd).toLocaleString('es-AR')+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px">$\u00a0'+Math.round(p.fci||0).toLocaleString('es-AR')+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px">$\u00a0'+Math.round((c.cheques&&c.cheques.total_cartera)||0).toLocaleString('es-AR')+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px">'+(p.usd_cant ? Math.round(p.usd_cant).toLocaleString('es-AR')+' USD' : '—')+'</td>'
      + '</tr>';
  });
  tabla.innerHTML = html + '</tbody></table>';
}

// ── REAL MENSUAL (Módulo 9) ──────────────────────────────────
function _renderHistReal(){
  var noData = '<div style="text-align:center;padding:60px 0;font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.4)">Sin datos de comportamiento histórico. Se generan al ejecutar el actualizador con archivos Listado_Caravanas.</div>';

  // Guardar en variable global para re-render
  if(!_histRealData || !_histRealData.snapshots || !_histRealData.snapshots.length){
    document.getElementById('histRealKpis').innerHTML='';
    document.getElementById('histRealTabla').innerHTML=noData;
    return;
  }

  var snaps  = _histRealData.snapshots.slice().sort(function(a,b){ return a.fecha < b.fecha ? -1 : 1; });
  var labels = snaps.map(function(s){ return s.periodo; });

  // ── KPIs ──
  var ultimo = snaps[snaps.length - 1];
  var hm = ultimo.hacienda_masa || {};
  var fin = ultimo.financiero || {};
  var pegsa = (hm.pegsa) || {};
  var kpis = [
    { label:'Cabezas PEGSA', value: (pegsa.cabezas||0).toLocaleString('es-AR'), sub: 'último mes disponible' },
    { label:'Masa PEGSA',    value: ((pegsa.kg_proyectado||0)/1000).toFixed(0)+' t', sub: 'kg proyectado' },
    { label:'Disponible',    value: fin.disponible!=null ? '$\u00a0'+(Math.round(fin.disponible)/1000000).toFixed(1)+'M' : '—', sub: 'saldo líquido' },
    { label:'Cobrar Hac.',   value: fin.cobrar_hacienda!=null ? '$\u00a0'+(Math.round(fin.cobrar_hacienda)/1000000).toFixed(1)+'M' : '—', sub: 'vtos a cobrar' },
  ];
  var kpiHtml = kpis.map(function(k){
    return '<div class="kpi-card"><div class="kpi-label">'+k.label+'</div><div class="kpi-value">'+k.value+'</div><div class="kpi-sub">'+k.sub+'</div></div>';
  }).join('');
  document.getElementById('histRealKpis').innerHTML = kpiHtml;

  // ── Gráfico masa kg PEGSA por campo — v15.47 barras apiladas ──
  _renderMasaPegsa();

  // ── Valuación en pesos ──
  _renderValuacion();

  // ── Gráfico kg por cabeza ──
  _renderRealKgCab('pegsa');

  // ── Gráficos insumos ──
  _renderRealInsumos(snaps, labels);

  // ── Gráfico financiero — v15.47 barras divergentes ──
  var fM = function(v){
    var a = Math.abs(v);
    return (v < 0 ? '−' : '') + '$ ' + a.toFixed(0) + 'M';
  };
  var dsFin = [
    { label: 'Disponible',      backgroundColor: '#27613d',
      data: snaps.map(function(s){ return s.financiero ? Math.round((s.financiero.disponible||0)/1000000) : 0; }) },
    { label: 'Cobrar Hacienda', backgroundColor: '#2d6a8a',
      data: snaps.map(function(s){ return s.financiero ? Math.round((s.financiero.cobrar_hacienda||0)/1000000) : 0; }) },
    { label: 'Pagar Hacienda',  backgroundColor: '#c0392b',
      data: snaps.map(function(s){ return s.financiero ? -Math.round((s.financiero.pagar_hacienda||0)/1000000) : 0; }) }
  ];
  // El "total" de arriba es la POSICIÓN NETA del mes (positivos − pagar).
  _mkStackedBarChart('chartRealFinanciero', labels, dsFin, fM, { totalFmt: fM, marcarNeto: true });
  // Línea de cero marcada para leer la divergencia
  var chFin = _histCharts['chartRealFinanciero'];
  if(chFin){
    chFin.options.scales.y.grid.color = function(c){ return c.tick.value === 0 ? 'rgba(26,22,18,.35)' : 'rgba(0,0,0,.06)'; };
    chFin.options.scales.y.grid.lineWidth = function(c){ return c.tick.value === 0 ? 1.5 : 1; };
    chFin.update();
  }

  // ── Tabla completa ──
  var thStyle = 'style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:8px 10px;border-bottom:2px solid var(--border);white-space:nowrap;text-align:right"';
  var thStyleL = 'style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:8px 10px;border-bottom:2px solid var(--border);white-space:nowrap"';
  var html = '<table class="data-table" style="width:100%;border-collapse:collapse">'
    + '<thead><tr>'
    + '<th '+thStyleL+'>Periodo</th>'
    + '<th '+thStyle+'>Cab. Total</th>'
    + '<th '+thStyle+'>Cab. PEGSA</th>'
    + '<th '+thStyle+'>Kg PEGSA (t)</th>'
    + '<th '+thStyle+'>Disponible</th>'
    + '<th '+thStyle+'>Cartera</th>'
    + '<th '+thStyle+'>Emitidos</th>'
    + '<th '+thStyle+'>Cobrar Hac.</th>'
    + '<th '+thStyle+'>Pagar Hac.</th>'
    + '<th '+thStyle+'>USD cant.</th>'
    + '<th '+thStyle+'>LCG</th>'
    + '<th '+thStyle+'>Tercio Bravo</th>'
    + '<th '+thStyle+'>Insumos (t)</th>'
    + '</tr></thead><tbody>';

  snaps.slice().reverse().forEach(function(s){
    var hm2 = s.hacienda_masa || {};
    var fin2 = s.financiero || {};
    var ins2 = s.insumos || {};
    var pegsa2 = hm2.pegsa || {};
    var disp = fin2.disponible != null ? fin2.disponible : null;
    var dispColor = disp != null ? (disp >= 0 ? 'color:#27613d' : 'color:#c0392b') : '';
    function fM(v){ return v != null ? '$\u00a0'+(Math.round(v)/1000000).toFixed(1)+'M' : '—'; }
    function fN(v){ return v != null ? Math.round(v).toLocaleString('es-AR') : '—'; }

    html += '<tr style="border-bottom:1px solid var(--border)">'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:13px;font-weight:600;padding:9px 10px;white-space:nowrap">'+s.periodo+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+(hm2.total_cabezas ? hm2.total_cabezas.toLocaleString('es-AR') : '—')+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+(pegsa2.cabezas ? pegsa2.cabezas.toLocaleString('es-AR') : '—')+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+(pegsa2.kg_proyectado ? (pegsa2.kg_proyectado/1000).toFixed(0)+'t' : '—')+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px;font-weight:600;'+dispColor+'">'+fM(fin2.disponible)+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+fM(fin2.cheques_cartera)+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+fM(fin2.cheques_emitidos)+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px;color:#27613d">'+fM(fin2.cobrar_hacienda)+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px;color:#c0392b">'+fM(fin2.pagar_hacienda)+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+(fin2.usd_cant ? Math.round(fin2.usd_cant).toLocaleString('es-AR')+' u' : '—')+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+fM(fin2.lcg != null && fin2.lcg !== 0 ? fin2.lcg : null)+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+fM(fin2.tercio_bravo != null && fin2.tercio_bravo !== 0 ? fin2.tercio_bravo : null)+'</td>'
      + '<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:9px 10px">'+(ins2.total_kg ? (ins2.total_kg/1000).toFixed(0)+'t' : '—')+'</td>'
      + '</tr>';
  });

  document.getElementById('histRealTabla').innerHTML = html + '</tbody></table>';
}

// ── VALUACIÓN EN PESOS (Módulo 10) ──────────────────────────
function _renderValuacion(){
  var panel = document.getElementById('panelValuacion');
  if(!panel) return;

  if(!_valData || !_valData.snapshots || !_valData.snapshots.length){
    panel.innerHTML = '<div style="text-align:center;padding:40px;font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.4)">Valuación en pesos pendiente — se genera en la próxima ejecución del actualizador.</div>';
    return;
  }

  var snaps  = _valData.snapshots.slice().sort(function(a,b){ return a.periodo<b.periodo?-1:1; });
  var labels = snaps.map(function(s){ return s.periodo; });

  function fM(v){
    if(v==null) return '—';
    var abs = Math.abs(v), sign = v<0?'−':'';
    if(abs>=1e9)  return sign+'$\u00a0'+(abs/1e9).toFixed(2)+'B';
    if(abs>=1e6)  return sign+'$\u00a0'+(abs/1e6).toFixed(1)+'M';
    return sign+'$\u00a0'+Math.round(abs).toLocaleString('es-AR');
  }
  function fKg(v){ return v ? (v/1000).toFixed(0)+'t' : '—'; }

  // helper: total_usd explícito o derivado de total_pesos / bna_tc_venta
  function _totalUSDval(s){
    var c_ = s.componentes || {}, pr_ = s.precios || {};
    if(c_.total_usd != null) return c_.total_usd;
    if(c_.total_pesos != null && pr_.bna_tc_venta) return Math.round(c_.total_pesos / pr_.bna_tc_venta);
    return null;
  }

  // ── KPIs último mes disponible ──
  var ult = snaps[snaps.length-1];
  var c   = ult.componentes || {};
  var pr  = ult.precios || {};
  function fUSD(v){ if(v==null) return '—'; var abs=Math.abs(v),sign=v<0?'−':''; if(abs>=1e6) return sign+'U$S\u00a0'+(abs/1e6).toFixed(2)+'M'; return sign+'U$S\u00a0'+Math.round(abs).toLocaleString('es-AR'); }
  var _tcDisp = pr.bna_tc_venta ? 'MEP $'+Math.round(pr.bna_tc_venta).toLocaleString('es-AR')+'/USD' : 'MEP no disponible';
  var kpiDefs = [
    { label:'Hacienda PEGSA',   value: fM(c.hacienda_pesos),   sub: (pr.mag_indice ? '@ $'+pr.mag_indice.toFixed(0)+'/kg MAG' : 'índice MAG') },
    { label:'Insumos (M+S)',    value: fM(c.insumos_pesos),    sub: fKg(c.maiz_kg)+' maíz · '+fKg(c.soja_kg)+' soja' },
    { label:'USD (en $)',       value: fM(c.usd_pesos),        sub: c.usd_cant ? Math.round(c.usd_cant).toLocaleString('es-AR')+' USD · '+_tcDisp : _tcDisp },
    { label:'Patrimonio en $',  value: fM(c.total_pesos),      sub: ult.periodo+' · todos los componentes' },
    { label:'Patrimonio en USD',value: fUSD(_totalUSDval(ult)), sub: _tcDisp },
  ];
  var kpiHtml = kpiDefs.map(function(k){
    var isTotal = k.label==='Patrimonio Total';
    return '<div style="background:'+(isTotal?'var(--ink)':'#fff')+';border:1px solid var(--border);border-radius:2px;padding:14px 18px">'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:'+(isTotal?'rgba(255,255,255,.5)':'rgba(26,22,18,.45)')+';margin-bottom:6px">'+k.label+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;color:'+(isTotal?'#d4a84b':'var(--ink)')+'">'+k.value+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:'+(isTotal?'rgba(255,255,255,.4)':'rgba(26,22,18,.5)')+';margin-top:4px">'+k.sub+'</div>'
      +'</div>';
  }).join('');
  document.getElementById('valKpis').innerHTML = kpiHtml;

  // v15.49: avisar cuando los insumos se valúan con precios BCR viejos
  // (heredados por forward-fill). El scraping estuvo roto 3 meses en silencio.
  var _aviso = document.getElementById('valAvisoPrecios');
  if(_aviso){
    var _h = (ult.precios_efectivos && ult.precios_efectivos.heredado) || {};
    if(_h.bcr_maiz_ton || _h.bcr_soja_ton){
      var _cuales = [];
      if(_h.bcr_maiz_ton) _cuales.push('maíz');
      if(_h.bcr_soja_ton) _cuales.push('soja');
      _aviso.innerHTML = '<div style="background:#fdf6e3;border:1px solid #d4a84b;border-radius:2px;'
        + 'padding:10px 14px;font-family:\'DM Mono\',monospace;font-size:12px;color:#7a5c14">'
        + '⚠ Precio de ' + _cuales.join(' y ') + ' heredado del mes anterior — '
        + 'los insumos pueden estar subvaluados. Actualizar <code>datos/precios_bcr/</code>.'
        + '</div>';
    } else {
      _aviso.innerHTML = '';   // limpiar si no hay problema (no queda pegado)
    }
  }

  // ── Gráfico stacked barras ──
  var colores = {
    hacienda:   { bg: 'rgba(184,146,42,.8)',  border: '#b8922a' },
    insumos:    { bg: 'rgba(39,97,61,.75)',   border: '#27613d' },
    financiero: { bg: 'rgba(45,106,138,.75)', border: '#2d6a8a' },
    usd:        { bg: 'rgba(138,45,138,.7)',  border: '#8a2d8a' },
  };
  // v15.50: se revierte la absorción de v15.25. Aquel fix movía la Pos.
  // Financiera negativa dentro de Hacienda para que la barra no cruzara el
  // cero, a costa de dibujar Hacienda más chica de lo real (mayo 2026:
  // -$2.276M respecto de la tabla y del propio tooltip). Ahora se usan barras
  // divergentes: cada segmento mide su valor real, el negativo va abajo del
  // cero y el neto se marca explícitamente. NO volver a absorber.
  var dsStack = [
    { label: 'Hacienda PEGSA',
      data: snaps.map(function(s){ var v=(s.componentes||{}).hacienda_pesos;  return v!=null?Math.round(v/1e6):null; }),
      backgroundColor: colores.hacienda.bg,   borderColor: colores.hacienda.border,   borderWidth:1, borderRadius:2 },
    { label: 'Insumos (M+S)',
      data: snaps.map(function(s){ var v=(s.componentes||{}).insumos_pesos;   return v!=null?Math.round(v/1e6):null; }),
      backgroundColor: colores.insumos.bg,    borderColor: colores.insumos.border,    borderWidth:1, borderRadius:2 },
    { label: 'Pos. Financiera',
      data: snaps.map(function(s){ var v=(s.componentes||{}).financiero_pesos;return v!=null?Math.round(v/1e6):null; }),
      backgroundColor: colores.financiero.bg, borderColor: colores.financiero.border, borderWidth:1, borderRadius:2 },
    { label: 'USD (en $)',
      data: snaps.map(function(s){ var v=(s.componentes||{}).usd_pesos;       return v!=null?Math.round(v/1e6):null; }),
      backgroundColor: colores.usd.bg,        borderColor: colores.usd.border,        borderWidth:1, borderRadius:2 }
  ];
  var fM = function(v){
    var a = Math.abs(v);
    return (v<0?'−':'') + '$ ' + Math.round(a).toLocaleString('es-AR') + 'M';
  };
  // v15.50: reusa el helper de v15.47 (divergente + total neto encima + tooltip).
  _mkStackedBarChart('chartValStack', labels, dsStack, fM, { totalFmt: fM, marcarNeto: true });
  var chVS = _histCharts['chartValStack'];
  if(chVS){
    // Línea de cero marcada (mismo tratamiento que chartRealFinanciero en v15.47)
    chVS.options.scales.y.grid.color = function(c){ return c.tick.value === 0 ? 'rgba(26,22,18,.35)' : 'rgba(0,0,0,.06)'; };
    chVS.options.scales.y.grid.lineWidth = function(c){ return c.tick.value === 0 ? 1.5 : 1; };
    chVS.update();
  }

  // ── Gráfico total línea ──
  // v15.48/v15.50: composición en kg de novillo (deflactada por MAG)
  _renderValNovillo(snaps, labels, colores);

  var dsTotal = [{
    label: 'Patrimonio total ($M)',
    data: snaps.map(function(s){ return s.componentes.total_pesos!=null ? Math.round(s.componentes.total_pesos/1e6) : null; }),
    borderColor: '#b8922a', backgroundColor: 'rgba(184,146,42,.1)',
    tension: .3, fill: true, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2, spanGaps: true
  }];
  _destroyChart('chartValTotal');
  var ctxT = document.getElementById('chartValTotal');
  if(ctxT){
    _histCharts['chartValTotal'] = new Chart(ctxT, {
      type: 'line',
      data: { labels: labels, datasets: dsTotal },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: { legend:{ display:false } },
        scales: {
          x: { ticks:{ font:{family:'DM Mono',size:10}, maxRotation:0 }, grid:{color:'rgba(0,0,0,.04)'} },
          y: { ticks:{ font:{family:'DM Mono',size:10}, callback:function(v){ return '$'+v.toLocaleString('es-AR')+'M'; } }, grid:{color:'rgba(0,0,0,.06)'} }
        }
      }
    });
  }

  // ── Gráfico USD ──
  var dsUSD = [{
    label: 'Patrimonio total (U$S)',
    data: snaps.map(function(s){ var v=_totalUSDval(s); return v!=null?Math.round(v/1000):null; }),
    borderColor: '#2d6a8a', backgroundColor: 'rgba(45,106,138,.1)',
    tension: .3, fill: true, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2, spanGaps: true
  }];
  _destroyChart('chartValUSD');
  var ctxU = document.getElementById('chartValUSD');
  if(ctxU){
    _histCharts['chartValUSD'] = new Chart(ctxU, {
      type: 'line',
      data: { labels: labels, datasets: dsUSD },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { display:false },
          tooltip: { callbacks: { label: function(ctx){ return ' U$S '+Math.round(ctx.parsed.y).toLocaleString('es-AR')+'K'; } } }
        },
        scales: {
          x: { ticks:{ font:{family:'DM Mono',size:10}, maxRotation:0 }, grid:{color:'rgba(0,0,0,.04)'} },
          y: { ticks:{ font:{family:'DM Mono',size:10}, callback:function(v){ return 'U$S '+v.toLocaleString('es-AR')+'K'; } }, grid:{color:'rgba(0,0,0,.06)'} }
        }
      }
    });
  }

  // ── Tabla de precios de referencia ──
  var thS = 'style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:8px 10px;border-bottom:2px solid var(--border);text-align:right;white-space:nowrap"';
  var thL = 'style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:8px 10px;border-bottom:2px solid var(--border)"';
  var html = '<table class="data-table" style="width:100%;border-collapse:collapse">'
    +'<thead><tr><th '+thL+'>Período</th><th '+thS+'>Índice MAG ($/kg)</th><th '+thS+'>Maíz BCR ($/ton)</th><th '+thS+'>Soja BCR ($/ton)</th><th '+thS+'>Dólar MEP ($/USD)</th>'
    +'<th '+thS+'>Hacienda PEGSA</th><th '+thS+'>Insumos (M+S)</th><th '+thS+'>Financiero</th><th '+thS+'>USD (en $)</th><th '+thS+'>Total $</th><th '+thS+'>Total USD</th></tr></thead><tbody>';

  snaps.slice().reverse().forEach(function(s){
    var p = s.precios||{}, c2 = s.componentes||{};
    var tdR = 'style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:8px 10px;border-bottom:1px solid var(--border)"';
    var tdL = 'style="font-family:\'DM Mono\',monospace;font-size:13px;font-weight:600;padding:8px 10px;border-bottom:1px solid var(--border);white-space:nowrap"';
    var tdUSD = 'style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;padding:8px 10px;border-bottom:1px solid var(--border);color:rgba(138,45,138,.9)"';
    html += '<tr>'
      +'<td '+tdL+'>'+s.periodo+'</td>'
      +'<td '+tdR+'>'+(p.mag_indice!=null ? p.mag_indice.toLocaleString('es-AR',{minimumFractionDigits:3}) : '—')+'</td>'
      +'<td '+tdR+'>'+(p.bcr_maiz_ton!=null ? Math.round(p.bcr_maiz_ton).toLocaleString('es-AR') : '—')+'</td>'
      +'<td '+tdR+'>'+(p.bcr_soja_ton!=null ? Math.round(p.bcr_soja_ton).toLocaleString('es-AR') : '—')+'</td>'
      +'<td '+tdR+'>'+(p.bna_tc_venta!=null ? Math.round(p.bna_tc_venta).toLocaleString('es-AR') : '—')+'</td>'
      +'<td '+tdR+'>'+fM(c2.hacienda_pesos)+'</td>'
      +'<td '+tdR+'>'+fM(c2.insumos_pesos)+'</td>'
      +'<td '+tdR+'>'+fM(c2.financiero_pesos)+'</td>'
      +'<td '+tdUSD+'>'+(c2.usd_pesos!=null ? fM(c2.usd_pesos) : (c2.usd_cant ? Math.round(c2.usd_cant).toLocaleString('es-AR')+'\u00a0USD' : '—'))+'</td>'
      +'<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:700;padding:8px 10px;border-bottom:1px solid var(--border);color:var(--gold)">'+fM(c2.total_pesos)+'</td>'
      +'<td style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:700;padding:8px 10px;border-bottom:1px solid var(--border);color:#2d6a8a">'+fUSD(_totalUSDval(s))+'</td>'
      +'</tr>';
  });
  document.getElementById('valTablaPrecios').innerHTML = html+'</tbody></table>';
}

/**
 * v15.48 — Valuación en kg de novillo. Divide cada componente por el índice
 * MAG ($/kg de novillo) del mes → "cuántos kilos de novillo vale el patrimonio"
 * (medida REAL, sin inflación). Espeja chartValStack: mismas 4 series, colores
 * y orden. v15.50: lee los componentes ORIGINALES del JSON (se revirtió la
 * absorción de v15.25) y es divergente — la serie Hacienda vuelve a ser
 * exactamente hacienda_kg_pegsa/1000 en los 20 meses.
 */
function _renderValNovillo(snaps, labels, colores){
  var ctx = document.getElementById('chartValNovillo');
  if(!ctx) return;

  // MAG efectivo por mes (precios_efectivos tiene el fallback resuelto).
  var mags = snaps.map(function(s){
    var pe = s.precios_efectivos || s.precios || {};
    return pe.mag_indice || null;
  });

  // $ → toneladas de novillo (los valores van de ~3.500 a ~5.100 t; en kg
  // serían millones y el eje quedaría ilegible).
  function aTon(pesos, i){
    if(pesos == null || !mags[i]) return null;
    return +(pesos / mags[i] / 1000).toFixed(1);
  }

  function comp(s, k, i){ return aTon((s.componentes || {})[k], i); }
  var dsNov = [
    { label: 'Hacienda PEGSA',
      data: snaps.map(function(s,i){ return comp(s,'hacienda_pesos', i); }),
      backgroundColor: colores.hacienda.bg,   borderColor: colores.hacienda.border,   borderWidth:1, borderRadius:2 },
    { label: 'Insumos (M+S)',
      data: snaps.map(function(s,i){ return comp(s,'insumos_pesos', i); }),
      backgroundColor: colores.insumos.bg,    borderColor: colores.insumos.border,    borderWidth:1, borderRadius:2 },
    { label: 'Pos. Financiera',
      data: snaps.map(function(s,i){ return comp(s,'financiero_pesos', i); }),
      backgroundColor: colores.financiero.bg, borderColor: colores.financiero.border, borderWidth:1, borderRadius:2 },
    { label: 'USD (en $)',
      data: snaps.map(function(s,i){ return comp(s,'usd_pesos', i); }),
      backgroundColor: colores.usd.bg,        borderColor: colores.usd.border,        borderWidth:1, borderRadius:2 }
  ];

  var fT = function(v){ return Math.round(v).toLocaleString('es-AR')+' t'; };

  // Reusa el helper de v15.47 (divergente + total neto encima + tooltip con Total).
  _mkStackedBarChart('chartValNovillo', labels, dsNov, fT, { totalFmt: fT, marcarNeto: true });

  // El tooltip dice con qué MAG se dividió (para poder auditar el número).
  var ch = _histCharts['chartValNovillo'];
  if(ch){
    ch.options.plugins.tooltip.callbacks.title = function(items){
      if(!items.length) return '';
      var i = items[0].dataIndex;
      return labels[i] + (mags[i] ? '  ·  MAG $'+Math.round(mags[i]).toLocaleString('es-AR')+'/kg' : '');
    };
    ch.update();
  }

  _renderValNovilloBrecha(snaps, mags);
}

/**
 * v15.48 — tarjeta con la brecha nominal vs real punta a punta. Se calcula en
 * runtime desde el primer y último snapshot: NO hardcodear los porcentajes.
 */
function _renderValNovilloBrecha(snaps, mags){
  var box = document.getElementById('valNovilloBrecha');
  if(!box || snaps.length < 2) return;

  var i0 = 0, i1 = snaps.length - 1;
  while(i0 < i1 && !mags[i0]) i0++;   // primer mes con MAG válido (defensivo)
  if(!mags[i0] || !mags[i1]) { box.innerHTML = ''; return; }

  var p0 = (snaps[i0].componentes||{}).total_pesos || 0;
  var p1 = (snaps[i1].componentes||{}).total_pesos || 0;
  if(!p0){ box.innerHTML = ''; return; }

  var n0 = p0 / mags[i0] / 1000;   // toneladas de novillo
  var n1 = p1 / mags[i1] / 1000;

  var varPesos   = (p1/p0 - 1) * 100;
  var varNovillo = (n1/n0 - 1) * 100;

  function pct(v){ return (v>=0?'+':'−') + Math.abs(v).toFixed(1).replace('.',',') + '%'; }
  function col(v){ return v >= 0 ? '#27613d' : '#c0392b'; }

  var lbl = 'desde ' + snaps[i0].periodo + ' hasta ' + snaps[i1].periodo;

  box.innerHTML =
      '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:stretch">'
    +   '<div style="flex:1;min-width:190px;background:#fff;border:1px solid var(--border);border-radius:2px;padding:12px 16px">'
    +     '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.45);margin-bottom:5px">En pesos (nominal)</div>'
    +     '<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;color:'+col(varPesos)+'">'+pct(varPesos)+'</div>'
    +     '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.5);margin-top:3px">'+lbl+'</div>'
    +   '</div>'
    +   '<div style="flex:1;min-width:190px;background:#fff;border:1px solid var(--border);border-radius:2px;padding:12px 16px">'
    +     '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.45);margin-bottom:5px">En novillo (real)</div>'
    +     '<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;color:'+col(varNovillo)+'">'+pct(varNovillo)+'</div>'
    +     '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.5);margin-top:3px">'
    +       Math.round(n0).toLocaleString('es-AR')+' t → '+Math.round(n1).toLocaleString('es-AR')+' t'
    +     '</div>'
    +   '</div>'
    +   '<div style="flex:1.4;min-width:230px;background:var(--ink);border:1px solid var(--border);border-radius:2px;padding:12px 16px">'
    +     '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:5px">Brecha</div>'
    +     '<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;color:#d4a84b">'+pct(varPesos - varNovillo)+'</div>'
    +     '<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(255,255,255,.4);margin-top:3px">del crecimiento nominal fue inflación</div>'
    +   '</div>'
    + '</div>';
}

// ── MASA PEGSA (Real Mensual) · v15.47 barras apiladas ───────
// Estado del gráfico Masa PEGSA
var _masaModo = 'apiladas';   // 'apiladas' | 'porcentaje' | 'horizontal'
var _masaSolo = null;         // nombre del campo aislado, null = todos

function _setModoMasaPegsa(modo, el){
  _masaModo = modo;
  var cont = document.getElementById('realKgPegsaModos');
  if(cont) cont.querySelectorAll('.hist-filter').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  _renderMasaPegsa();
}

function _masaSetAlto(n){
  var wrap = document.getElementById('realKgPegsaWrap');
  if(wrap) wrap.style.height = (_masaModo==='horizontal' ? Math.max(300, n*26) : 300) + 'px';
}

function _renderMasaPegsa(){
  if(!_histRealData || !_histRealData.snapshots || !_histRealData.snapshots.length) return;
  var snaps  = _histRealData.snapshots.slice().sort(function(a,b){ return a.fecha < b.fecha ? -1 : 1; });
  var labels = snaps.map(function(s){ return s.periodo; });

  var camposSet = {};
  snaps.forEach(function(s){
    var pc = (s.hacienda_masa && s.hacienda_masa.pegsa && s.hacienda_masa.pegsa.por_campo) || {};
    Object.keys(pc).forEach(function(c){ camposSet[c] = 1; });
  });
  var campos = Object.keys(camposSet).sort();
  var fmtT = function(v){ return Math.round(v).toLocaleString('es-AR')+'t'; };

  // Fallback: sin desglose por campo → una sola serie con el total
  if(!campos.length){
    _mkStackedBarChart('chartRealKgPegsa', labels, [{
      label: 'Masa PEGSA total',
      data: snaps.map(function(s){ return s.hacienda_masa && s.hacienda_masa.pegsa ? Math.round(s.hacienda_masa.pegsa.kg_proyectado/1000) : 0; }),
      backgroundColor: '#b8922a'
    }], fmtT, { horizontal: _masaModo==='horizontal', totalFmt: fmtT });
    _masaSetAlto(labels.length);
    return;
  }

  var datasets = campos.map(function(campo){
    return {
      label: campo,
      data: snaps.map(function(s){
        var pc = (s.hacienda_masa && s.hacienda_masa.pegsa && s.hacienda_masa.pegsa.por_campo) || {};
        return pc[campo] ? Math.round(pc[campo].kg_proyectado/1000) : 0;
      }),
      backgroundColor: _colorCampo(campo),
      // Aislamiento: con un campo "solo" el resto queda oculto pero sigue en la
      // leyenda (permite cambiar el aislamiento a otra serie).
      hidden: _masaSolo ? (campo !== _masaSolo) : false
    };
  });

  // Totales reales por mes (t) — label absoluto aun en modo %
  var totalesReales = labels.map(function(_, i){
    return datasets.reduce(function(a, ds){ return a + (ds.data[i]||0); }, 0);
  });

  var yFmt, opts;
  if(_masaModo === 'porcentaje'){
    datasets = datasets.map(function(ds){
      return {
        label: ds.label, backgroundColor: ds.backgroundColor, hidden: ds.hidden,
        data: ds.data.map(function(v, i){ return totalesReales[i] ? +(v / totalesReales[i] * 100).toFixed(1) : 0; })
      };
    });
    yFmt = function(v){ return v.toFixed(1).replace('.',',')+'%'; };
    opts = { porcentaje: true, totalFmt: fmtT, totalesFijos: totalesReales };
  } else {
    yFmt = fmtT;
    opts = { horizontal: _masaModo === 'horizontal', totalFmt: fmtT };
  }

  _mkStackedBarChart('chartRealKgPegsa', labels, datasets, yFmt, opts);
  _masaSetAlto(labels.length);

  // Filtro "solo" al clickear la leyenda (aislamiento, no el toggle-hide default)
  var ch = _histCharts['chartRealKgPegsa'];
  if(ch){
    ch.options.plugins.legend.onClick = function(e, item){
      var nombre = item.text;
      _masaSolo = (_masaSolo === nombre) ? null : nombre;
      _renderMasaPegsa();
    };
    ch.update();
  }
}

// ── INSUMOS (Real Mensual) · v15.47 barras apiladas por tipo ──
function _renderRealInsumos(snaps, labels){
  if(!snaps || !snaps.length) return;

  // Set de insumos presentes en cualquier mes (items es {nombre: kg} o array)
  var insuSet = {};
  snaps.forEach(function(s){
    if(s.insumos && s.insumos.items){
      var it = s.insumos.items;
      if(Array.isArray(it)) it.forEach(function(x){ insuSet[x.nombre] = 1; });
      else Object.keys(it).forEach(function(nom){ insuSet[nom] = 1; });
    }
  });

  // v15.47: limpiar sufijo de unidad — (KG) y también (LTS)
  function _limpio(nom){ return nom.replace(/\s*\((KG|LTS)\)\s*$/i,'').trim(); }

  // Orden por volumen DESC → el silo (~82%) queda abajo de la pila
  var vol = {};
  Object.keys(insuSet).forEach(function(nom){
    vol[nom] = snaps.reduce(function(a, s){
      var it = (s.insumos && s.insumos.items) || {};
      var kg = Array.isArray(it)
        ? (function(){ var x = it.find(function(y){ return y.nombre===nom; }); return x ? x.stock_kg : 0; })()
        : (it[nom] || 0);
      return a + (kg || 0);
    }, 0);
  });
  var insumos = Object.keys(insuSet).sort(function(a,b){ return vol[b] - vol[a]; });

  var datasets = insumos.map(function(nom){
    var limpio = _limpio(nom);
    return {
      label: limpio,
      data: snaps.map(function(s){
        var it = (s.insumos && s.insumos.items) || {};
        var kg = Array.isArray(it)
          ? (function(){ var x = it.find(function(y){ return y.nombre===nom; }); return x ? x.stock_kg : null; })()
          : (it[nom] != null ? it[nom] : null);
        // Negativos residuales del Excel (ej. SOJA "-0") → 0, no rompen la pila
        return kg != null ? Math.max(0, +(kg/1000).toFixed(1)) : 0;
      }),
      backgroundColor: HIST_COLOR_INSUMO[limpio] || _colorCampo(limpio)
    };
  });

  var fmtT = function(v){ return Math.round(v).toLocaleString('es-AR')+'t'; };
  _mkStackedBarChart('chartRealInsuDetalle', labels, datasets, fmtT, { totalFmt: fmtT });
}

// ── KG POR CABEZA (Real Mensual) ─────────────────────────────
function _renderRealKgCab(tipo){
  if(!_histRealData || !_histRealData.snapshots || !_histRealData.snapshots.length) return;
  var snaps  = _histRealData.snapshots.slice().sort(function(a,b){ return a.fecha<b.fecha?-1:1; });
  var labels = snaps.map(function(s){ return s.periodo; });
  var ds, subLabel;

  if(tipo === 'pegsa_campo'){
    // PEGSA desglosado por campo
    var camposSet = {};
    snaps.forEach(function(s){
      var pc = (s.hacienda_masa && s.hacienda_masa.pegsa && s.hacienda_masa.pegsa.por_campo) || {};
      Object.keys(pc).forEach(function(c){ camposSet[c]=1; });
    });
    var campos = Object.keys(camposSet);
    ds = campos.map(function(campo, i){
      return {
        label: campo,
        data: snaps.map(function(s){
          var pc = (s.hacienda_masa && s.hacienda_masa.pegsa && s.hacienda_masa.pegsa.por_campo) || {};
          var d = pc[campo];
          if(!d || !d.cabezas || d.cabezas===0) return null;
          return Math.round(d.kg_proyectado / d.cabezas);
        }),
        borderColor: _colorCampo(campo),
        backgroundColor: 'transparent',
        tension: .3, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2, spanGaps: true
      };
    });
    subLabel = 'PEGSA · desglose por campo';

  } else if(tipo === 'pegsa'){
    // PEGSA total
    ds = [{
      label: 'PEGSA — kg / cabeza',
      data: snaps.map(function(s){
        var p = s.hacienda_masa && s.hacienda_masa.pegsa;
        if(!p || !p.cabezas || p.cabezas===0) return null;
        return Math.round(p.kg_proyectado / p.cabezas);
      }),
      borderColor: '#b8922a', backgroundColor: 'rgba(184,146,42,.12)',
      tension: .3, fill: true, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2, spanGaps: true
    }];
    subLabel = 'PEGSA · promedio mensual por animal';

  } else {
    // Total general
    ds = [{
      label: 'Total — kg / cabeza',
      data: snaps.map(function(s){
        var hm = s.hacienda_masa || {};
        if(!hm.total_cabezas || hm.total_cabezas===0) return null;
        return Math.round((hm.total_kg||0) / hm.total_cabezas);
      }),
      borderColor: '#27613d', backgroundColor: 'rgba(39,97,61,.1)',
      tension: .3, fill: true, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2, spanGaps: true
    }];
    subLabel = 'Total feedlot · promedio mensual por animal';
  }

  var sub = document.getElementById('realKgCabSub');
  if(sub) sub.textContent = subLabel;

  _destroyChart('chartRealKgCab');
  var ctx = document.getElementById('chartRealKgCab');
  if(!ctx) return;
  _histCharts['chartRealKgCab'] = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Mono', size: 11 }, boxWidth: 12, padding: 14 } } },
      scales: {
        x: { ticks: { font: { family: 'DM Mono', size: 10 }, maxRotation: 0 }, grid: { color: 'rgba(0,0,0,.04)' } },
        y: {
          ticks: { font: { family: 'DM Mono', size: 10 }, callback: function(v){ return v.toLocaleString('es-AR')+' kg'; } },
          grid: { color: 'rgba(0,0,0,.06)' }
        }
      }
    }
  });
}
