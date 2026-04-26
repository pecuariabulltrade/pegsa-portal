/* modulo-08-historico.js — Histórico & Evolución · 2026-04-25 */

var _histData      = null;  // stock_historico.json  (mensual)
var _histDiario    = null;  // stock_diario.json     (diario)
var _histFinData   = null;  // financiero_historico.json
var _histRealData  = null;  // comportamiento_historico.json (módulo 9)
var _valData       = null;  // valuacion_historica.json (módulo 10)
var _histFiltroAct = 'total';
var _histDiarioPer = 30;    // días mostrados por defecto
var _histDiarioFil = 'total';
var _histCharts    = {};
var _histInited    = false;

var HIST_COLORS = ['#b8922a','#27613d','#2d6a8a','#8a2d6a','#6a8a2d','#6a2d2d','#2d6a6a','#8a6a2d'];

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

function histFiltro(tipo, el){
  _histFiltroAct = tipo;
  document.querySelectorAll('.hist-filter').forEach(function(b){b.classList.remove('active');});
  if(el) el.classList.add('active');
  _renderHistHacienda(tipo);
}

function _destroyChart(id){
  if(_histCharts[id]){try{_histCharts[id].destroy();}catch(e){} _histCharts[id]=null;}
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
  _renderHistDiario(_histDiarioPer, _histDiarioFil);
}
function histDiarioFiltro(tipo){
  _histDiarioFil = tipo;
  _renderHistDiario(_histDiarioPer, _histDiarioFil);
}

function _renderHistDiario(dias, filtro){
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

// ── MENSUAL ──────────────────────────────────────────────────
function _renderHistHacienda(tipo){
  if(!_histData || !_histData.snapshots || !_histData.snapshots.length){
    document.getElementById('chartHistCabezas').parentElement.innerHTML='<div style="text-align:center;padding:60px 0;font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.4)">Sin datos históricos aún. Se acumularán con cada ejecución mensual del actualizador.</div>';
    return;
  }
  var snaps  = _histData.snapshots;
  var labels = snaps.map(function(s){ return s.periodo; });

  // Actualizar subtítulo
  var subtitulos = {total:'total',propietario:'por propietario',establecimiento:'por establecimiento',categoria:'por categoría'};
  var sub = document.getElementById('histHacSub');
  if(sub) sub.textContent = 'Evolución mensual · ' + (subtitulos[tipo]||tipo);

  if(tipo === 'total'){
    var dsCab = [{
      label: 'Cabezas totales',
      data: snaps.map(function(s){ return s.hacienda.total_cabezas||0; }),
      borderColor: '#b8922a', backgroundColor: 'rgba(184,146,42,.1)',
      tension: .3, fill: true, pointRadius: 5, pointHoverRadius: 7
    }];
    var dsKg = [{
      label: 'Kg estimado total',
      data: snaps.map(function(s){ return s.hacienda.total_kg_estimado||0; }),
      borderColor: '#27613d', backgroundColor: 'rgba(39,97,61,.1)',
      tension: .3, fill: true, pointRadius: 5, pointHoverRadius: 7
    }];
    _mkLineChart('chartHistCabezas', labels, dsCab, null, 'cabezas');
    _mkLineChart('chartHistKg', labels, dsKg, function(v){ return (v/1000).toFixed(0)+'t'; }, 'toneladas');

  } else {
    // Recolectar todas las claves del grupo
    var claveSet = {};
    snaps.forEach(function(s){
      var grupo = s.hacienda['por_'+tipo] || {};
      Object.keys(grupo).forEach(function(k){ claveSet[k]=1; });
    });
    var claves = Object.keys(claveSet);

    var dsCab = claves.map(function(k, i){
      return {
        label: k,
        data: snaps.map(function(s){ return (s.hacienda['por_'+tipo]||{})[k] ? (s.hacienda['por_'+tipo][k].cabezas||0) : null; }),
        borderColor: HIST_COLORS[i%HIST_COLORS.length],
        backgroundColor: 'transparent',
        tension: .3, pointRadius: 4, spanGaps: true
      };
    });
    var dsKg = claves.map(function(k, i){
      return {
        label: k,
        data: snaps.map(function(s){ return (s.hacienda['por_'+tipo]||{})[k] ? (s.hacienda['por_'+tipo][k].kg_estimado||0) : null; }),
        borderColor: HIST_COLORS[i%HIST_COLORS.length],
        backgroundColor: 'transparent',
        tension: .3, pointRadius: 4, spanGaps: true
      };
    });
    _mkLineChart('chartHistCabezas', labels, dsCab, null, 'cabezas');
    _mkLineChart('chartHistKg', labels, dsKg, function(v){ return (v/1000).toFixed(0)+'t'; }, 'toneladas');
  }
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

  // ── Gráfico masa kg PEGSA por campo ──
  var camposSet = {};
  snaps.forEach(function(s){
    var pc = (s.hacienda_masa && s.hacienda_masa.pegsa && s.hacienda_masa.pegsa.por_campo) || {};
    Object.keys(pc).forEach(function(c){ camposSet[c]=1; });
  });
  var campos = Object.keys(camposSet);
  var dsKg;
  if(campos.length > 1){
    dsKg = campos.map(function(campo, i){
      return {
        label: campo,
        data: snaps.map(function(s){
          var pc = (s.hacienda_masa && s.hacienda_masa.pegsa && s.hacienda_masa.pegsa.por_campo) || {};
          return pc[campo] ? Math.round(pc[campo].kg_proyectado/1000) : 0;
        }),
        borderColor: HIST_COLORS[i%HIST_COLORS.length],
        backgroundColor: 'rgba('+[184,146,42,39,97,61,45,106,138][i*3%9]+','+[184,146,42,39,97,61,45,106,138][i*3%9+1]+','+[184,146,42,39,97,61,45,106,138][i*3%9+2]+',.1)',
        tension: .3, fill: i===0, pointRadius: 4, spanGaps: true
      };
    });
  } else {
    dsKg = [{
      label: 'Masa PEGSA total (t)',
      data: snaps.map(function(s){ return s.hacienda_masa && s.hacienda_masa.pegsa ? Math.round(s.hacienda_masa.pegsa.kg_proyectado/1000) : 0; }),
      borderColor: '#b8922a', backgroundColor: 'rgba(184,146,42,.1)',
      tension: .3, fill: true, pointRadius: 5
    }];
  }
  _mkLineChart('chartRealKgPegsa', labels, dsKg, function(v){ return v.toFixed(0)+'t'; }, 'toneladas');

  // ── Valuación en pesos ──
  _renderValuacion();

  // ── Gráfico kg por cabeza ──
  _renderRealKgCab('pegsa');

  // ── Gráficos insumos ──
  _renderRealInsumos(snaps, labels);

  // ── Gráfico financiero ──
  var dsDisp = {
    label: 'Disponible ($M)',
    data: snaps.map(function(s){ return s.financiero ? Math.round((s.financiero.disponible||0)/1000000) : null; }),
    borderColor: '#27613d', backgroundColor: 'rgba(39,97,61,.08)',
    tension: .3, fill: true, pointRadius: 5, spanGaps: true
  };
  var dsCobrar = {
    label: 'Cobrar Hacienda ($M)',
    data: snaps.map(function(s){ return s.financiero ? Math.round((s.financiero.cobrar_hacienda||0)/1000000) : null; }),
    borderColor: '#2d6a8a', backgroundColor: 'transparent',
    tension: .3, pointRadius: 4, spanGaps: true
  };
  var dsPagar = {
    label: 'Pagar Hacienda ($M)',
    data: snaps.map(function(s){ return s.financiero ? Math.round((s.financiero.pagar_hacienda||0)/1000000)*-1 : null; }),
    borderColor: '#c0392b', backgroundColor: 'transparent',
    tension: .3, pointRadius: 4, spanGaps: true
  };
  _mkLineChart('chartRealFinanciero', labels, [dsDisp, dsCobrar, dsPagar], function(v){ return (v>=0?'':'−')+'$\u00a0'+Math.abs(v).toFixed(0)+'M'; }, '$ millones');

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

  // ── Gráfico stacked barras ──
  var colores = {
    hacienda:   { bg: 'rgba(184,146,42,.8)',  border: '#b8922a' },
    insumos:    { bg: 'rgba(39,97,61,.75)',   border: '#27613d' },
    financiero: { bg: 'rgba(45,106,138,.75)', border: '#2d6a8a' },
    usd:        { bg: 'rgba(138,45,138,.7)',  border: '#8a2d8a' },
  };
  var dsStack = [
    { label: 'Hacienda PEGSA', data: snaps.map(function(s){ return s.componentes.hacienda_pesos!=null ? Math.round(s.componentes.hacienda_pesos/1e6) : null; }),
      backgroundColor: colores.hacienda.bg, borderColor: colores.hacienda.border, borderWidth:1, borderRadius:2 },
    { label: 'Insumos (M+S)',  data: snaps.map(function(s){ return s.componentes.insumos_pesos!=null ? Math.round(s.componentes.insumos_pesos/1e6) : null; }),
      backgroundColor: colores.insumos.bg, borderColor: colores.insumos.border, borderWidth:1, borderRadius:2 },
    { label: 'Pos. Financiera', data: snaps.map(function(s){ return s.componentes.financiero_pesos!=null ? Math.round(s.componentes.financiero_pesos/1e6) : null; }),
      backgroundColor: colores.financiero.bg, borderColor: colores.financiero.border, borderWidth:1, borderRadius:2 },
    { label: 'USD (en $)',      data: snaps.map(function(s){ return s.componentes.usd_pesos!=null ? Math.round(s.componentes.usd_pesos/1e6) : null; }),
      backgroundColor: colores.usd.bg, borderColor: colores.usd.border, borderWidth:1, borderRadius:2 },
  ];
  _destroyChart('chartValStack');
  var ctxS = document.getElementById('chartValStack');
  if(ctxS){
    _histCharts['chartValStack'] = new Chart(ctxS, {
      type: 'bar',
      data: { labels: labels, datasets: dsStack },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { position:'bottom', labels:{ font:{family:'DM Mono',size:11}, boxWidth:12, padding:14 } },
          tooltip: { callbacks: { label: function(ctx){ return ' '+ctx.dataset.label+': $'+ctx.parsed.y.toLocaleString('es-AR')+'M'; } } }
        },
        scales: {
          x: { stacked:true, ticks:{ font:{family:'DM Mono',size:10}, maxRotation:0 }, grid:{ display:false } },
          y: { stacked:true, ticks:{ font:{family:'DM Mono',size:10}, callback:function(v){ return '$'+v.toLocaleString('es-AR')+'M'; } }, grid:{color:'rgba(0,0,0,.06)'} }
        }
      }
    });
  }

  // ── Gráfico total línea ──
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

// ── INSUMOS (Real Mensual) ───────────────────────────────────
function _renderRealInsumos(snaps, labels){
  if(!snaps || !snaps.length) return;

  // ── Total en toneladas ──
  _destroyChart('chartRealInsuTotal');
  var ctxT = document.getElementById('chartRealInsuTotal');
  if(ctxT){
    _histCharts['chartRealInsuTotal'] = new Chart(ctxT, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Stock total insumos',
          data: snaps.map(function(s){ return s.insumos ? +(s.insumos.total_kg/1000).toFixed(1) : 0; }),
          backgroundColor: 'rgba(184,146,42,.75)',
          borderColor: '#b8922a',
          borderWidth: 1,
          borderRadius: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { family: 'DM Mono', size: 10 }, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { font: { family: 'DM Mono', size: 10 }, callback: function(v){ return v.toFixed(0)+'t'; } }, grid: { color: 'rgba(0,0,0,.06)' } }
        }
      }
    });
  }

  // ── Desglose por tipo de insumo ──
  // items es un objeto {nombre: kg} — no un array
  var insuSet = {};
  snaps.forEach(function(s){
    if(s.insumos && s.insumos.items){
      var it = s.insumos.items;
      if(Array.isArray(it)){
        // Compatibilidad futura: si algún día fuera array
        it.forEach(function(x){ insuSet[x.nombre]=1; });
      } else {
        Object.keys(it).forEach(function(nom){ insuSet[nom]=1; });
      }
    }
  });
  var insumos = Object.keys(insuSet).sort();

  var dsDetalle = insumos.map(function(nom, i){
    return {
      label: nom.replace(/\s*\(KG\)/i,'').trim(),
      data: snaps.map(function(s){
        if(!s.insumos || !s.insumos.items) return null;
        var it = s.insumos.items;
        var kg = Array.isArray(it)
          ? (function(){ var x=it.find(function(x){ return x.nombre===nom; }); return x?x.stock_kg:null; })()
          : (it[nom] != null ? it[nom] : null);
        return kg != null ? +(kg/1000).toFixed(1) : null;
      }),
      borderColor: HIST_COLORS[i % HIST_COLORS.length],
      backgroundColor: 'transparent',
      tension: .3, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2, spanGaps: true
    };
  });

  _destroyChart('chartRealInsuDetalle');
  var ctxD = document.getElementById('chartRealInsuDetalle');
  if(ctxD){
    _histCharts['chartRealInsuDetalle'] = new Chart(ctxD, {
      type: 'line',
      data: { labels: labels, datasets: dsDetalle },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Mono', size: 11 }, boxWidth: 12, padding: 14 } } },
        scales: {
          x: { ticks: { font: { family: 'DM Mono', size: 10 }, maxRotation: 0 }, grid: { color: 'rgba(0,0,0,.04)' } },
          y: { ticks: { font: { family: 'DM Mono', size: 10 }, callback: function(v){ return v.toFixed(0)+'t'; } }, grid: { color: 'rgba(0,0,0,.06)' } }
        }
      }
    });
  }
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
        borderColor: HIST_COLORS[i%HIST_COLORS.length],
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
