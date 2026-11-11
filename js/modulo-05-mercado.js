/* modulo-05-mercado.js — Mercado y Precios · 2026-04-26 · v15.97: fuera Negocios, Seguimiento e Indiferencia (mercado) */

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

/* v15.97: 3 nav-tabs (Precios, Indiferencia de Precios de Compra,
   Información de Mercado). Información de Mercado muestra directo el
   Histórico: Seguimiento e Indiferencia (mercado) se retiraron, igual que
   Últimos Negocios de Compra. Los ids mercadoTabInferencia /
   panelMercadoInferencia no cambian (bridge ?mod=mercado&tab=inferencia). */
function mercadoTab(tab, el){
  var mainNav = document.querySelector('#screenMercado > .nav-tabs');
  if (mainNav) mainNav.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  ['panelMercadoHacienda','panelMercadoInferencia','panelMercadoInfoMercado'].forEach(function(p){
    var n=document.getElementById(p); if(n) n.style.display='none';
  });
  var map = {
    hacienda:    'panelMercadoHacienda',
    inferencia:  'panelMercadoInferencia',
    infomercado: 'panelMercadoInfoMercado',
  };
  if(map[tab]){
    document.getElementById(map[tab]).style.display='block';
    if(tab==='inferencia')  renderInferencia();
    if(tab==='infomercado') renderHistoricoChart();
  }
}

/* v15.97: queda por compatibilidad (window.infoMercadoTab); sólo hay Histórico. */
function infoMercadoTab(subtab, el){
  renderHistoricoChart();
}
// Exponer global (igual que mercadoTab) para los onclick inline del HTML.
window.infoMercadoTab = infoMercadoTab;

/* ============================================================
   v8 · Pestaña "Inferencia" del módulo Mercado.
   Tabla cronológica + line chart por categoría, leyendo
   D.preciosInferenciaHist (semanas[].items[]).
   ============================================================ */
var _inferenciaChart = null;
function renderInferencia(){
  var D = window.PEGSA_DATA || {};
  var semanas = Array.isArray(D.preciosInferenciaHist) ? D.preciosInferenciaHist.slice() : [];
  var noData = document.getElementById('inferenciaNoData');
  var subEl  = document.getElementById('inferenciaMetaSub');
  var wrapCh = document.getElementById('inferenciaChartWrap');
  var wrapTb = document.getElementById('inferenciaTablaWrap');
  if (!semanas.length) {
    if (noData) noData.style.display = 'block';
    if (wrapCh) wrapCh.style.display = 'none';
    if (wrapTb) wrapTb.innerHTML = '';
    return;
  }
  if (noData) noData.style.display = 'none';
  if (wrapCh) wrapCh.style.display = 'block';

  // Orden cronológico ascendente para el chart.
  semanas.sort(function(a,b){ return String(a.fecha).localeCompare(String(b.fecha)); });

  var meta = D.preciosInferenciaMeta || {};
  var ultima = meta.fecha || semanas[semanas.length-1].fecha;
  if (subEl) subEl.textContent = 'Calculado en planilla del simulador · ' +
    semanas.length + ' semana' + (semanas.length === 1 ? '' : 's') +
    ' · última ' + String(ultima).split('-').reverse().join('/');

  // v15.66: categorías DINÁMICAS — se arman desde los items del histórico,
  // en orden de aparición. Las 4 clásicas conservan su color; las nuevas
  // toman de la paleta extra.
  var CAT_COLORS = { vaca_100:'#1a5276', vaca_60:'#7b3f2a', novillo:'#27613d', vaquillona:'#b8922a' };
  var EXTRA_COLORS = ['#8e44ad','#c0392b','#5d8aa8','#d4a84b','#6bc47a'];
  var CATS = []; var _seen = {}; var _ei = 0;
  semanas.forEach(function(s){ (s.items||[]).forEach(function(it){
    if (!it.id || _seen[it.id]) return;
    _seen[it.id] = 1;
    CATS.push({ id: it.id, nombre: it.nombre || it.id,
                color: CAT_COLORS[it.id] || EXTRA_COLORS[_ei++ % EXTRA_COLORS.length] });
  }); });
  var labels = semanas.map(function(s){
    var p = String(s.fecha).split('-');
    return p[2] + '/' + p[1];
  });
  function serie(catId){
    return semanas.map(function(s){
      var it = (s.items || []).find(function(i){ return i.id === catId; });
      return it && it.precio_comp != null ? Math.round(it.precio_comp) : null;
    });
  }
  var datasets = CATS.map(function(c){
    return {
      label: c.nombre,
      data: serie(c.id),
      borderColor: c.color,
      backgroundColor: c.color + '22',
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 4,
      pointHoverRadius: 6,
      spanGaps: true,
    };
  });

  if (_inferenciaChart) { try { _inferenciaChart.destroy(); } catch(e) {} _inferenciaChart = null; }
  var ctx = document.getElementById('chartInferencia');
  if (ctx && typeof Chart !== 'undefined') {
    _inferenciaChart = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: "'DM Mono', monospace", size: 12 } } },
          tooltip: {
            callbacks: {
              label: function(ctx){
                return ctx.dataset.label + ': $ ' + Number(ctx.parsed.y).toLocaleString('es-AR') + ' /kg';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: { callback: function(v){ return '$ ' + Number(v).toLocaleString('es-AR'); },
                     font: { family: "'DM Mono', monospace", size: 11 } },
            grid: { color: 'rgba(26,22,18,.06)' }
          },
          x: {
            ticks: { font: { family: "'DM Mono', monospace", size: 11 } },
            grid: { color: 'rgba(26,22,18,.04)' }
          }
        }
      }
    });
  }

  // Tabla: orden DESC (más reciente arriba).
  var semDesc = semanas.slice().reverse();
  var html = '<table class="data-table">'
    + '<thead><tr><th>Fecha</th>'
    + CATS.map(function(c){ return '<th class="right">' + c.nombre + '</th>'; }).join('')
    + '</tr></thead><tbody>';
  semDesc.forEach(function(s){
    var pd = String(s.fecha).split('-');
    html += '<tr><td><strong>' + pd[2] + '/' + pd[1] + '/' + pd[0].slice(2) + '</strong></td>';
    CATS.forEach(function(c){
      var it = (s.items || []).find(function(i){ return i.id === c.id; });
      var v = it && it.precio_comp != null ? '$ ' + Math.round(it.precio_comp).toLocaleString('es-AR') : '—';
      html += '<td class="right mono">' + v + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  if (wrapTb) wrapTb.innerHTML = html;
}

function fmtPrecio(v){ return v!=null ? '$'+Number(v).toLocaleString('es-AR') : '<span style="color:rgba(26,22,18,.3)">—</span>'; }

var MERCADO_DATA_CACHE  = null;

function initMercado(){
  document.getElementById('mercadoLoading').style.display='block';
  document.getElementById('mercadoData').style.display='none';
  var status = document.getElementById('mercadoSyncStatus');
  status.textContent = 'Cargando precios...';

  // v15.97: sólo mercado_precios.json (negocios_* e indiferencia ya no se usan)
  fetch(STOCK_SB+'/mercado_precios.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;})
  .then(function(data){
    MERCADO_DATA_CACHE  = data;

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
