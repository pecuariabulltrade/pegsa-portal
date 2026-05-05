/* modulo-03-stock.js — Stock de Masa (WinCampo) · 2026-04-25 */

var STOCK_SB   = '/pegsa-portal'; // mismo dominio en GitHub Pages
var STOCK_PER  = '2025';
var STOCK_CACHE= {};
var STOCK_COLS = ['#b8922a','#27613d','#3d4a5c','#c0392b','#d4a84b','#6bc47a','#5d8aa8','#8b4513'];

function stockFmt(n){ return Number(n||0).toLocaleString('es-AR'); }
function stockSlug(s){ return s.replace(/[^a-zA-Z0-9_]/g,'_'); }

async function stockGet(url) {
  if (STOCK_CACHE[url]) return STOCK_CACHE[url];
  var r = await fetch(url, {});
  if (!r.ok) throw new Error('HTTP '+r.status);
  STOCK_CACHE[url] = await r.json();
  return STOCK_CACHE[url];
}

// Helper fetch con header ngrok
async function pegFetch(url) {
  var r = await fetch(url, {});
  if (!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

async function cargarDesdeOneDrive() {
  document.getElementById('stockLoading').style.display = 'block';
  document.getElementById('stockData').style.display    = 'none';
  document.getElementById('stockError').style.display   = 'none';
  document.getElementById('syncStatus').textContent     = 'Sincronizando...';
  try {
    var data = await stockGet(STOCK_SB+'/stock_kpis_'+STOCK_PER+'.json');
    var kpis = data.kpis||{}, meta = data.meta||{};
  window._stockKpis = kpis;
    document.getElementById('kpi-cabezas').textContent    = stockFmt(kpis.total_cabezas);
    document.getElementById('kpi-tons').textContent       = Number(Math.round(kpis.total_ton_estimado_hoy*1000||0)).toLocaleString('es-AR')+' kg';
    document.getElementById('kpi-peso').textContent       = stockFmt(kpis.kg_promedio_estimado)+' kg';
    document.getElementById('kpi-categorias').textContent = Object.keys(kpis.por_categoria_final||kpis.por_categoria||{}).length;
    // Último dato real registrado en WinCampo (ULTIMA_FECHA_REPARTO o FECHA_ULTIMA_PESADA)
    var fechaUltDato = kpis.fecha_ultimo_dato || null;
    if(fechaUltDato){
      var _fp = fechaUltDato.split('-');
      document.getElementById('kpi-fecha').textContent = (_fp[2]||'?')+'/'+(_fp[1]||'?')+'/'+(_fp[0]||'?');
      document.getElementById('kpi-fecha-sub').textContent = 'último reparto · script: '+(meta.generado ? meta.generado.slice(0,10) : '—');
    } else {
      document.getElementById('kpi-fecha').textContent = meta.generado ? meta.generado.slice(0,10).split('-').reverse().join('/') : '—';
      document.getElementById('kpi-fecha-sub').textContent = 'fecha de generación del script';
    }
    document.getElementById('stockLoading').style.display = 'none';
    document.getElementById('stockData').style.display    = 'block';
    stockRenderCategoria('secCategorias', kpis.por_categoria_final||kpis.por_categoria||{}, kpis.por_categoria_desglose||{}, kpis.total_cabezas||1);
    stockRenderSeccion('secPropietarios',   'Por Propietario',            true,  kpis.por_propietario||{},    kpis.total_cabezas||1);
    stockRenderSeccion('secEstablecimientos','Por Establecimiento',       false, kpis.por_establecimiento||{}, kpis.total_cabezas||1, kpis.por_establecimiento_categoria||{});


    renderPegsaTab();
    document.getElementById('syncStatus').textContent = '\u2713 Actualizado '+new Date().toLocaleTimeString('es-AR');
  } catch(err) {
    document.getElementById('stockLoading').style.display = 'none';
    document.getElementById('stockError').style.display   = 'block';
    document.getElementById('stockErrorMsg').textContent  = err.message;
    document.getElementById('syncStatus').textContent = '\u2717 Error';
  }
}

function stockRenderSeccion(containerId, titulo, clickable, porObj, totalCab, catDesglose) {
  var arr = Object.entries(porObj).sort(function(a,b){ return b[1].cabezas - a[1].cabezas; });
  var el  = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  // Titulo
  var h = document.createElement('div');
  h.style.cssText = 'margin-bottom:20px';
  h.innerHTML = '<div style="font-family:Playfair Display,serif;font-size:22px;font-weight:700;margin-bottom:4px">'+titulo+'</div>'
    + (clickable ? '<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45)">Hac\u00e9 click en una tarjeta para ver el detalle</div>' : '');
  el.appendChild(h);

  // Grid de cards
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:28px';
  arr.forEach(function(entry, i) {
    var nombre = entry[0], d = entry[1];
    var pct  = totalCab > 0 ? (d.cabezas/totalCab*100).toFixed(1) : '0.0';
    var tons = d.ton_estimado > 0 ? Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg' : '-';
    var col  = STOCK_COLS[i % STOCK_COLS.length];
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:1px solid #e8e2d8;border-top:3px solid '+col+';padding:18px 20px;border-radius:2px;transition:box-shadow .15s';
    if (clickable) {
      card.style.cursor = 'pointer';
      card.addEventListener('mouseover', function(){ this.style.boxShadow='0 4px 16px rgba(0,0,0,.12)'; });
      card.addEventListener('mouseout',  function(){ this.style.boxShadow=''; });
      card.addEventListener('click',     function(){ abrirPropietario(nombre); });
    } else if (catDesglose && catDesglose[nombre]) {
      card.style.cursor = 'pointer';
      card.addEventListener('mouseover', function(){ this.style.boxShadow='0 4px 16px rgba(0,0,0,.12)'; });
      card.addEventListener('mouseout',  function(){ this.style.boxShadow=''; });
      card.addEventListener('click', (function(n){ return function(){ abrirEstablecimiento(n, '', catDesglose[n]||{}); }; })(nombre));
      card.innerHTML += '<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(184,146,42,.7);margin-top:6px">Ver categor\u00edas \u2192</div>';
    }
    card.innerHTML = '<div style="font-size:11px;font-family:DM Mono,monospace;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:5px">'+(clickable?'Propietario':'Establecimiento')+'</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:16px;font-weight:700;margin-bottom:12px">'+nombre+'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:7px"><span style="color:rgba(26,22,18,.5)">Cabezas</span><span style="font-family:DM Mono,monospace;font-weight:600">'+stockFmt(d.cabezas)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:6px"><span style="color:rgba(26,22,18,.5)">Toneladas</span><span style="font-family:DM Mono,monospace;color:#27613d">'+tons+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:6px"><span style="color:rgba(26,22,18,.5)">Kg prom.</span><span style="font-family:DM Mono,monospace">'+stockFmt(d.kg_promedio)+' kg</span></div>'
      +'<div style="margin-top:10px;background:rgba(26,22,18,.06);height:4px;border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:2px"></div></div>'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.35);margin-top:3px;display:flex;justify-content:space-between">'
      +(clickable ? '<span style="color:rgba(184,146,42,.7)">Ver detalle \u2192</span>' : '<span></span>')
      +'<span>'+pct+'% del stock</span></div>';
    grid.appendChild(card);
  });
  el.appendChild(grid);

  // Tabla resumen
  var totTons = arr.reduce(function(s,e){ return s+(e[1].ton_estimado||0); }, 0);
  var table = document.createElement('table');
  table.className = 'data-table';
  var label = clickable ? 'Propietario' : 'Establecimiento';
  table.innerHTML = '<thead><tr><th>'+label+'</th><th class="right">Cabezas</th><th class="right">Kilogramos</th><th class="right">Kg Prom.</th><th class="right">% del stock</th></tr></thead>';
  var tbody = document.createElement('tbody');
  arr.forEach(function(entry) {
    var nombre=entry[0], d=entry[1];
    var pct = totalCab > 0 ? (d.cabezas/totalCab*100).toFixed(1) : '0.0';
    var tr = document.createElement('tr');
    if (clickable) { tr.style.cursor='pointer'; tr.addEventListener('click', function(){ abrirPropietario(nombre); }); }
    tr.innerHTML = '<td><strong>'+nombre+'</strong></td>'
      +'<td class="right mono">'+stockFmt(d.cabezas)+'</td>'
      +'<td class="right mono" style="color:#27613d">'+(d.ton_estimado>0?Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg':'-')+'</td>'
      +'<td class="right mono">'+stockFmt(d.kg_promedio)+' kg</td>'
      +'<td class="right mono">'+pct+'%</td>';
    tbody.appendChild(tr);
  });
  var tfoot = document.createElement('tr');
  tfoot.className = 'total';
  tfoot.innerHTML = '<td><strong>TOTAL</strong></td><td class="right"><strong>'+stockFmt(totalCab)+'</strong></td>'
    +'<td class="right"><strong>'+totTons.toFixed(1)+' t</strong></td><td class="right">-</td><td class="right"><strong>100%</strong></td>';
  tbody.appendChild(tfoot);
  table.appendChild(tbody);
  el.appendChild(table);
}

async function abrirPropietario(nombre) {
  document.getElementById('modalPropTitulo').textContent = nombre;
  var body = document.getElementById('modalPropBody');
  body.innerHTML = '<div style="text-align:center;padding:40px;font-family:DM Mono,monospace;font-size:13px;opacity:.4">Cargando...</div>';
  document.getElementById('modalProp').style.display = 'block';
  try {
    var url  = STOCK_SB+'/stock_prop_'+stockSlug(nombre)+'_'+STOCK_PER+'.json';
    var data = await stockGet(url);
    var kpis = data.kpis||{};
    body.innerHTML = '';

    // KPI cards
    var kpiGrid = document.createElement('div');
    kpiGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px';
    [
      ['Total Cabezas', stockFmt(kpis.total_cabezas), ''],
      ['Total Toneladas', (kpis.total_ton_estimado_hoy||0).toFixed(1)+' kg', '#27613d'],
      ['Kg Promedio', stockFmt(kpis.kg_promedio_estimado)+' kg', '']
    ].forEach(function(item) {
      var card = document.createElement('div');
      card.style.cssText = 'background:white;border:1px solid #e8e2d8;padding:16px 18px;border-radius:2px';
      card.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:6px">'+item[0]+'</div>'
        +'<div style="font-family:Playfair Display,serif;font-size:24px;font-weight:700'+(item[2]?';color:'+item[2]:'')+'">' + item[1] + '</div>';
      kpiGrid.appendChild(card);
    });
    body.appendChild(kpiGrid);

    // Por categoria
    var cats = Object.entries(kpis.por_categoria_final||kpis.por_categoria||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
    if (cats.length) {
      var totC = cats.reduce(function(s,e){ return s+e[1].cabezas; }, 0);
      var secDiv = document.createElement('div');
      secDiv.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,22,18,.5);margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid rgba(26,22,18,.1)">Por Categor\u00eda</div>';
      var tbl = document.createElement('table');
      tbl.className = 'data-table';
      tbl.style.marginBottom = '28px';
      tbl.innerHTML = '<thead><tr><th>Categor\u00eda</th><th class="right">Cabezas</th><th class="right">%</th><th class="right">Kilogramos</th><th class="right">Kg Prom.</th></tr></thead>';
      var tb = document.createElement('tbody');
      cats.forEach(function(entry, i) {
        var c=entry[0], d=entry[1];
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+STOCK_COLS[i%STOCK_COLS.length]+';margin-right:7px"></span><strong>'+c+'</strong></td>'
          +'<td class="right mono">'+stockFmt(d.cabezas)+'</td>'
          +'<td class="right mono">'+(totC>0?(d.cabezas/totC*100).toFixed(1):0)+'%</td>'
          +'<td class="right mono" style="color:#27613d">'+(d.ton_estimado>0?Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg':'-')+'</td>'
          +'<td class="right mono">'+stockFmt(d.kg_promedio)+' kg</td>';
        tb.appendChild(tr);
      });
      var totCT = cats.reduce(function(s,e){ return s+(e[1].ton_estimado||0); }, 0);
      var tf = document.createElement('tr'); tf.className='total';
      tf.innerHTML = '<td><strong>TOTAL</strong></td><td class="right"><strong>'+stockFmt(totC)+'</strong></td><td class="right"><strong>100%</strong></td><td class="right"><strong>'+totCT.toFixed(1)+' t</strong></td><td class="right">-</td>';
      tb.appendChild(tf);
      tbl.appendChild(tb);
      secDiv.appendChild(tbl);
      body.appendChild(secDiv);
    }

    // Por establecimiento — clickeable para ver categorias
    var estCat = kpis.por_establecimiento_categoria || {};
    var ests = Object.entries(kpis.por_establecimiento||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
    if (ests.length) {
      var totE = ests.reduce(function(s,e){ return s+e[1].cabezas; }, 0);
      var secDiv2 = document.createElement('div');
      var hasDetail = Object.keys(estCat).length > 0;
      secDiv2.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,22,18,.5);margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid rgba(26,22,18,.1)">Por Campo / Establecimiento'+(hasDetail?' <span style="color:rgba(184,146,42,.6);font-size:8px;margin-left:8px">CLICK PARA VER CATEGORIAS</span>':'')+'</div>';
      var tbl2 = document.createElement('table');
      tbl2.className = 'data-table';
      tbl2.innerHTML = '<thead><tr><th>Establecimiento</th><th class="right">Cabezas</th><th class="right">Kilogramos</th><th class="right">Kg Prom.</th><th class="right"></th></tr></thead>';
      var tb2 = document.createElement('tbody');
      ests.forEach(function(entry) {
        var estNombre=entry[0], d=entry[1];
        var tr = document.createElement('tr');
        var tieneDetalle = estCat[estNombre] && Object.keys(estCat[estNombre]).length > 0;
        if (tieneDetalle) {
          tr.style.cursor = 'pointer';
          tr.addEventListener('mouseover', function(){ this.style.background='rgba(184,146,42,.05)'; });
          tr.addEventListener('mouseout',  function(){ this.style.background=''; });
          tr.addEventListener('click', (function(n, propN, cats){ return function(){ abrirEstablecimiento(n, propN, cats); }; })(estNombre, nombre, estCat[estNombre]));
        }
        tr.innerHTML = '<td><strong>'+estNombre+'</strong></td>'
          +'<td class="right mono">'+stockFmt(d.cabezas)+'</td>'
          +'<td class="right mono" style="color:#27613d">'+(d.ton_estimado>0?Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg':'-')+'</td>'
          +'<td class="right mono">'+stockFmt(d.kg_promedio)+' kg</td>'
          +'<td class="right" style="font-family:DM Mono,monospace;font-size:12px;color:rgba(184,146,42,.6)">'+(tieneDetalle?'Ver →':'')+'</td>';
        tb2.appendChild(tr);
      });
      var totET = ests.reduce(function(s,e){ return s+(e[1].ton_estimado||0); }, 0);
      var tf2 = document.createElement('tr'); tf2.className='total';
      tf2.innerHTML = '<td><strong>TOTAL</strong></td><td class="right"><strong>'+stockFmt(totE)+'</strong></td><td class="right"><strong>'+totET.toFixed(1)+' t</strong></td><td class="right">-</td><td></td>';
      tb2.appendChild(tf2);
      tbl2.appendChild(tb2);
      secDiv2.appendChild(tbl2);
      body.appendChild(secDiv2);
    }

  } catch(err) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#c0392b;font-family:DM Mono,monospace">Error: '+err.message+'</div>';
  }
}

function abrirEstablecimiento(estNombre, propNombre, cats) {
  document.getElementById('modalEstTitulo').textContent = estNombre;
  document.getElementById('modalEstSub').textContent    = propNombre + ' — Establecimiento';
  var body = document.getElementById('modalEstBody');
  body.innerHTML = '';

  var arr = Object.entries(cats).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
  var totC = arr.reduce(function(s,e){ return s+e[1].cabezas; }, 0);
  var totT = arr.reduce(function(s,e){ return s+(e[1].ton_estimado||0); }, 0);

  // KPIs
  var kpiDiv = document.createElement('div');
  kpiDiv.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px';
  [
    ['Cabezas', stockFmt(totC), ''],
    ['Toneladas', totT.toFixed(1)+' kg', '#27613d'],
    ['Kg Promedio', stockFmt(totC > 0 ? Math.round(totT*1000/totC) : 0)+' kg', '']
  ].forEach(function(item) {
    var c = document.createElement('div');
    c.style.cssText = 'background:white;border:1px solid #e8e2d8;padding:14px 16px;border-radius:2px';
    c.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:5px">'+item[0]+'</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:20px;font-weight:700'+(item[2]?';color:'+item[2]:'')+'">' +item[1]+'</div>';
    kpiDiv.appendChild(c);
  });
  body.appendChild(kpiDiv);

  // Tabla categorias
  var secLabel = document.createElement('div');
  secLabel.style.cssText = 'font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,22,18,.5);margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid rgba(26,22,18,.1)';
  secLabel.textContent = 'Por Categoría';
  body.appendChild(secLabel);

  var tbl = document.createElement('table');
  tbl.className = 'data-table';
  tbl.innerHTML = '<thead><tr><th>Categoría</th><th class="right">Cabezas</th><th class="right">%</th><th class="right">Kilogramos</th><th class="right">Kg Prom.</th></tr></thead>';
  var tb = document.createElement('tbody');
  arr.forEach(function(entry, i) {
    var cat=entry[0], d=entry[1];
    var pct = totC > 0 ? (d.cabezas/totC*100).toFixed(1) : 0;
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+STOCK_COLS[i%STOCK_COLS.length]+';margin-right:7px"></span><strong>'+cat+'</strong></td>'
      +'<td class="right mono">'+stockFmt(d.cabezas)+'</td>'
      +'<td class="right mono">'+pct+'%</td>'
      +'<td class="right mono" style="color:#27613d">'+(d.ton_estimado>0?Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg':'-')+'</td>'
      +'<td class="right mono">'+stockFmt(d.kg_promedio)+' kg</td>';
    tb.appendChild(tr);
  });
  var tf = document.createElement('tr'); tf.className = 'total';
  tf.innerHTML = '<td><strong>TOTAL</strong></td><td class="right"><strong>'+stockFmt(totC)+'</strong></td><td class="right"><strong>100%</strong></td><td class="right"><strong>'+totT.toFixed(1)+' t</strong></td><td class="right">-</td>';
  tb.appendChild(tf);
  tbl.appendChild(tb);
  body.appendChild(tbl);

  document.getElementById('modalEst').style.display = 'block';
}

function stockRenderCategoria(containerId, porCat, desgloses, totalCab) {
  var arr = Object.entries(porCat).sort(function(a,b){ return b[1].cabezas - a[1].cabezas; });
  var el  = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  var h = document.createElement('div');
  h.style.cssText = 'margin-bottom:20px';
  h.innerHTML = '<div style="font-family:Playfair Display,serif;font-size:22px;font-weight:700;margin-bottom:4px">Por Categor\u00eda</div>'
    +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45)">Hac\u00e9 click en una tarjeta para ver el desglose por campo y propietario</div>';
  el.appendChild(h);

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:20px';
  arr.forEach(function(entry, i) {
    var cat = entry[0], d = entry[1];
    var pct  = totalCab > 0 ? (d.cabezas/totalCab*100).toFixed(1) : '0.0';
    var tons = d.ton_estimado > 0 ? Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg' : '-';
    var col  = STOCK_COLS[i % STOCK_COLS.length];
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:1px solid #e8e2d8;border-top:3px solid '+col+';padding:18px 20px;border-radius:2px;transition:box-shadow .15s;cursor:pointer';
    card.addEventListener('mouseover', function(){ this.style.boxShadow='0 4px 16px rgba(0,0,0,.12)'; });
    card.addEventListener('mouseout',  function(){ this.style.boxShadow=''; });
    card.addEventListener('click', (function(c){ return function(){ abrirCategoria(c, desgloses[c]||{}); }; })(cat));
    card.innerHTML = '<div style="font-size:11px;font-family:DM Mono,monospace;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:5px">Categor\u00eda</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:16px;font-weight:700;margin-bottom:12px">'+cat+'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:7px"><span style="color:rgba(26,22,18,.5)">Cabezas</span><span style="font-family:DM Mono,monospace;font-weight:600">'+stockFmt(d.cabezas)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:6px"><span style="color:rgba(26,22,18,.5)">Toneladas</span><span style="font-family:DM Mono,monospace;color:#27613d">'+tons+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:6px"><span style="color:rgba(26,22,18,.5)">Kg prom.</span><span style="font-family:DM Mono,monospace">'+stockFmt(d.kg_promedio)+' kg</span></div>'
      +'<div style="margin-top:10px;background:rgba(26,22,18,.06);height:4px;border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:2px"></div></div>'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.35);margin-top:3px;display:flex;justify-content:space-between">'
      +'<span style="color:rgba(184,146,42,.7)">Ver desglose \u2192</span><span>'+pct+'% del stock</span></div>';
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

function abrirCategoria(cat, desglose) {
  document.getElementById('modalPropTitulo').textContent = cat;
  var body = document.getElementById('modalPropBody');
  body.innerHTML = '';
  document.getElementById('modalProp').style.display = 'block';

  function renderMiniTabla(titulo, obj) {
    var arr = Object.entries(obj||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
    if (!arr.length) return;
    var totCab  = arr.reduce(function(s,e){ return s+e[1].cabezas; }, 0);
    var totTons = arr.reduce(function(s,e){ return s+(e[1].ton_estimado||0); }, 0);
    var sec = document.createElement('div');
    sec.style.marginBottom = '28px';
    sec.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,22,18,.5);margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid rgba(26,22,18,.1)">'+titulo+'</div>';
    var tbl = document.createElement('table');
    tbl.className = 'data-table';
    tbl.innerHTML = '<thead><tr><th>'+titulo+'</th><th class="right">Cabezas</th><th class="right">Kilogramos</th><th class="right">Kg Prom.</th><th class="right">%</th></tr></thead>';
    var tb = document.createElement('tbody');
    arr.forEach(function(entry) {
      var nombre=entry[0], d=entry[1];
      var pct = totCab > 0 ? (d.cabezas/totCab*100).toFixed(1) : '0.0';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+nombre+'</strong></td>'
        +'<td class="right mono">'+stockFmt(d.cabezas)+'</td>'
        +'<td class="right mono" style="color:#27613d">'+(d.ton_estimado>0?Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg':'-')+'</td>'
        +'<td class="right mono">'+stockFmt(d.kg_promedio)+' kg</td>'
        +'<td class="right mono">'+pct+'%</td>';
      tb.appendChild(tr);
    });
    var tf = document.createElement('tr'); tf.className = 'total';
    tf.innerHTML = '<td><strong>TOTAL</strong></td><td class="right"><strong>'+stockFmt(totCab)+'</strong></td>'
      +'<td class="right"><strong>'+totTons.toFixed(1)+' t</strong></td><td class="right">-</td><td class="right"><strong>100%</strong></td>';
    tb.appendChild(tf);
    tbl.appendChild(tb);
    sec.appendChild(tbl);
    body.appendChild(sec);
  }

  renderMiniTabla('Por Establecimiento / Campo', desglose.por_establecimiento||{});
  renderMiniTabla('Por Propietario / Hotelero',  desglose.por_propietario||{});
}


window.stockTab = function(name, el) {
  document.getElementById('panelResumen').style.display      = name === 'resumen'      ? 'block' : 'none';
  document.getElementById('panelPegsa').style.display        = name === 'pegsa'        ? 'block' : 'none';
  document.getElementById('panelGraficos').style.display     = name === 'graficos'     ? 'block' : 'none';
  document.getElementById('panelMovimientos').style.display  = name === 'movimientos'  ? 'block' : 'none';
  document.getElementById('panelMuertes').style.display      = name === 'muertes'      ? 'block' : 'none';
  document.getElementById('panelProductivo').style.display   = name === 'productivo'   ? 'block' : 'none';
  document.getElementById('panelMateriaSeca').style.display  = name === 'materiaseca'  ? 'block' : 'none';
  ['stockTabResumen','stockTabPegsa','stockTabGraficos','stockTabMovimientos','stockTabMuertes','stockTabProductivo','stockTabMateriaSeca'].forEach(function(id){
    var t = document.getElementById(id);
    if (t) t.classList.remove('active');
  });
  if (el) el.classList.add('active');
  if (name === 'graficos')    renderGraficos();
  if (name === 'pegsa')       renderPegsaTab();
  if (name === 'movimientos') cargarMovimientos();
  if (name === 'muertes')     cargarMuertes();
  if (name === 'productivo')  cargarProductivo();
  if (name === 'materiaseca') cargarMateriaSeca();
};


var _grafCharts = {};
var _consumoDiarioChart = null;
function renderGraficos() {
  if (!window._stockKpis) return;
  var kpis  = window._stockKpis;
  var cats  = Object.entries(kpis.por_categoria_final||kpis.por_categoria||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
  var ests  = Object.entries(kpis.por_establecimiento||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
  var props = Object.entries(kpis.por_propietario||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });

  function makeDonut(id, labels, vals, colors) {
    if (_grafCharts[id]) _grafCharts[id].destroy();
    var ctx = document.getElementById(id);
    if (!ctx) return;
    _grafCharts[id] = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(ctx) {
            var total = ctx.dataset.data.reduce(function(a,b){ return a+b; }, 0);
            var pct   = total > 0 ? ((ctx.parsed/total)*100).toFixed(1) : 0;
            return ' ' + Number(ctx.parsed).toLocaleString('es-AR') + ' (' + pct + '%)';
          }}}
        }
      }
    });
  }

  function makeLeyenda(id, arr, colors, key, unit) {
    var el = document.getElementById(id);
    if (!el) return;
    var total = arr.reduce(function(s,e){ return s+(e[1][key]||0); }, 0);
    el.innerHTML = arr.map(function(entry, i) {
      var nombre=entry[0], val=entry[1][key]||0;
      var pct = total > 0 ? (val/total*100).toFixed(1) : '0.0';
      var display = unit === 't' ? (val/1000).toFixed(1)+' kg' : Number(val).toLocaleString('es-AR');
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:13px">'
        +'<div style="width:10px;height:10px;border-radius:50%;background:'+colors[i%colors.length]+';flex-shrink:0"></div>'
        +'<span style="flex:1;font-family:DM Mono,monospace;font-size:12px">'+nombre+'</span>'
        +'<span style="font-family:DM Mono,monospace;font-weight:600;font-size:12px">'+display+'</span>'
        +'<span style="font-family:DM Mono,monospace;color:rgba(26,22,18,.4);min-width:40px;text-align:right;font-size:12px">'+pct+'%</span>'
        +'</div>';
    }).join('');
  }

  // Categoria
  makeDonut('chartCatCab', cats.map(function(e){return e[0];}), cats.map(function(e){return e[1].cabezas;}), STOCK_COLS);
  makeDonut('chartCatKg',  cats.map(function(e){return e[0];}), cats.map(function(e){return e[1].kg_estimado||e[1].ton_estimado*1000||0;}), STOCK_COLS);
  makeLeyenda('leyendaCatCab', cats,  STOCK_COLS, 'cabezas',     '');
  makeLeyenda('leyendaCatKg',  cats,  STOCK_COLS, 'kg_estimado', 't');

  // Establecimiento
  makeDonut('chartEstCab', ests.map(function(e){return e[0];}), ests.map(function(e){return e[1].cabezas;}), STOCK_COLS);
  makeDonut('chartEstKg',  ests.map(function(e){return e[0];}), ests.map(function(e){return e[1].kg_estimado||e[1].ton_estimado*1000||0;}), STOCK_COLS);
  makeLeyenda('leyendaEstCab', ests,  STOCK_COLS, 'cabezas',     '');
  makeLeyenda('leyendaEstKg',  ests,  STOCK_COLS, 'kg_estimado', 't');

  // Propietario
  makeDonut('chartPropCab', props.map(function(e){return e[0];}), props.map(function(e){return e[1].cabezas;}), STOCK_COLS);
  makeDonut('chartPropKg',  props.map(function(e){return e[0];}), props.map(function(e){return e[1].kg_estimado||e[1].ton_estimado*1000||0;}), STOCK_COLS);
  makeLeyenda('leyendaPropCab', props, STOCK_COLS, 'cabezas',     '');
  makeLeyenda('leyendaPropKg',  props, STOCK_COLS, 'kg_estimado', 't');
}


function renderPegsaTab() {
  var el = document.getElementById('secPegsaTab');
  if (!el || !window._stockKpis) return;
  var kpis     = window._stockKpis;
  var pegsaKey = Object.keys(kpis.por_propietario||{}).find(function(k){ return k.toUpperCase().indexOf('PEGSA') >= 0; });
  if (!pegsaKey) { el.innerHTML = '<div style="padding:40px;text-align:center;opacity:.4;font-family:DM Mono,monospace">No se encontr\u00f3 PEGSA en los datos</div>'; return; }
  var d        = kpis.por_propietario[pegsaKey];
  var totalCab = kpis.total_cabezas || 1;
  var pct      = (d.cabezas / totalCab * 100).toFixed(1);
  var kgTotal  = d.kg_estimado || Math.round((d.ton_estimado||0)*1000);

  el.innerHTML = '';

  // Header destacado
  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:linear-gradient(135deg,#1a1612 0%,#2a2218 100%);border:1px solid rgba(184,146,42,.3);border-left:4px solid #b8922a;border-radius:2px;padding:28px 32px;margin-bottom:32px';
  hdr.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(212,168,75,.5);margin-bottom:6px">Propietario Principal</div>'
    +'<div style="font-family:Playfair Display,serif;font-size:32px;font-weight:700;color:#d4a84b;margin-bottom:4px">'+pegsaKey+'</div>'
    +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(255,255,255,.4);margin-bottom:20px">'+pct+'% del stock total &mdash; Principal hotelero del grupo</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.06)">'
    +'<div style="background:rgba(26,22,18,.6);padding:16px 18px"><div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;color:rgba(212,168,75,.4);margin-bottom:6px">Cabezas</div><div style="font-family:Playfair Display,serif;font-size:30px;font-weight:700;color:white">'+stockFmt(d.cabezas)+'</div></div>'
    +'<div style="background:rgba(26,22,18,.6);padding:16px 18px"><div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;color:rgba(212,168,75,.4);margin-bottom:6px">Kilogramos</div><div style="font-family:Playfair Display,serif;font-size:30px;font-weight:700;color:#6bc47a">'+Number(kgTotal).toLocaleString('es-AR')+' kg</div></div>'
    +'<div style="background:rgba(26,22,18,.6);padding:16px 18px"><div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;color:rgba(212,168,75,.4);margin-bottom:6px">Kg por Cabeza</div><div style="font-family:Playfair Display,serif;font-size:30px;font-weight:700;color:white">'+stockFmt(d.kg_promedio)+' kg</div></div>'
    +'<div style="background:rgba(26,22,18,.6);padding:16px 18px"><div style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;color:rgba(212,168,75,.4);margin-bottom:6px">% del Stock</div><div style="font-family:Playfair Display,serif;font-size:30px;font-weight:700;color:#d4a84b">'+pct+'%</div></div>'
    +'</div>';
  el.appendChild(hdr);

  // Cargar detalle del propietario PEGSA desde su JSON
  var url = STOCK_SB+'/stock_prop_'+stockSlug(pegsaKey)+'_'+STOCK_PER+'.json';
  stockGet(url).then(function(data) {
    var pk = data.kpis || {};

    // Por categoría
    var cats = Object.entries(pk.por_categoria_final||pk.por_categoria||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
    if (cats.length) {
      var totC = cats.reduce(function(s,e){ return s+e[1].cabezas; },0);
      var secCat = document.createElement('div');
      secCat.style.marginBottom = '36px';
      secCat.innerHTML = '<div style="font-family:Playfair Display,serif;font-size:20px;font-weight:700;margin-bottom:4px">Por Categor\u00eda</div>'
        +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45);margin-bottom:16px">Distribuci\u00f3n de hacienda PEGSA</div>';
      var tbl = document.createElement('table');
      tbl.className = 'data-table';
      tbl.innerHTML = '<thead><tr><th>Categor\u00eda</th><th class="right">Cabezas</th><th class="right">%</th><th class="right">Kilogramos</th><th class="right">Kg Prom.</th></tr></thead>';
      var tb = document.createElement('tbody');
      cats.forEach(function(entry,i){
        var c=entry[0],d=entry[1];
        var pct2 = totC>0?(d.cabezas/totC*100).toFixed(1):'0.0';
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+STOCK_COLS[i%STOCK_COLS.length]+';margin-right:7px"></span><strong>'+c+'</strong></td>'
          +'<td class="right mono">'+stockFmt(d.cabezas)+'</td>'
          +'<td class="right mono">'+pct2+'%</td>'
          +'<td class="right mono" style="color:#27613d">'+(d.ton_estimado>0?Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg':'-')+'</td>'
          +'<td class="right mono">'+stockFmt(d.kg_promedio)+' kg</td>';
        tb.appendChild(tr);
      });
      var tf=document.createElement('tr'); tf.className='total';
      tf.innerHTML='<td><strong>TOTAL</strong></td><td class="right"><strong>'+stockFmt(totC)+'</strong></td><td class="right"><strong>100%</strong></td>'
        +'<td class="right"><strong>'+cats.reduce(function(s,e){return s+(e[1].ton_estimado||0);},0).toFixed(1)+' t</strong></td><td class="right">-</td>';
      tb.appendChild(tf); tbl.appendChild(tb); secCat.appendChild(tbl);
      el.appendChild(secCat);
    }

    // Por establecimiento
    var ests = Object.entries(pk.por_establecimiento||{}).sort(function(a,b){ return b[1].cabezas-a[1].cabezas; });
    if (ests.length) {
      var totE = ests.reduce(function(s,e){ return s+e[1].cabezas; },0);
      var secEst = document.createElement('div');
      secEst.style.cssText = 'border-top:2px solid var(--border-strong);padding-top:28px;margin-top:8px';
      secEst.innerHTML = '<div style="font-family:Playfair Display,serif;font-size:20px;font-weight:700;margin-bottom:4px">Por Establecimiento</div>'
        +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45);margin-bottom:16px">Campos donde tiene hacienda PEGSA</div>';
      var tbl2 = document.createElement('table');
      tbl2.className = 'data-table';
      tbl2.innerHTML = '<thead><tr><th>Establecimiento</th><th class="right">Cabezas</th><th class="right">Kilogramos</th><th class="right">Kg Prom.</th><th class="right">%</th></tr></thead>';
      var tb2 = document.createElement('tbody');
      ests.forEach(function(entry){
        var e=entry[0],d=entry[1];
        var pct2=totE>0?(d.cabezas/totE*100).toFixed(1):'0.0';
        var tr=document.createElement('tr');
        tr.innerHTML='<td><strong>'+e+'</strong></td>'
          +'<td class="right mono">'+stockFmt(d.cabezas)+'</td>'
          +'<td class="right mono" style="color:#27613d">'+(d.ton_estimado>0?Number(Math.round(d.ton_estimado*1000)).toLocaleString('es-AR')+' kg':'-')+'</td>'
          +'<td class="right mono">'+stockFmt(d.kg_promedio)+' kg</td>'
          +'<td class="right mono">'+pct2+'%</td>';
        tb2.appendChild(tr);
      });
      var tf2=document.createElement('tr'); tf2.className='total';
      tf2.innerHTML='<td><strong>TOTAL</strong></td><td class="right"><strong>'+stockFmt(totE)+'</strong></td>'
        +'<td class="right"><strong>'+ests.reduce(function(s,e){return s+(e[1].ton_estimado||0);},0).toFixed(1)+' t</strong></td>'
        +'<td class="right">-</td><td class="right"><strong>100%</strong></td>';
      tb2.appendChild(tf2); tbl2.appendChild(tb2); secEst.appendChild(tbl2);
      el.appendChild(secEst);
    }
  }).catch(function(err){
    var errDiv = document.createElement('div');
    errDiv.style.cssText='text-align:center;padding:20px;color:#c0392b;font-family:DM Mono,monospace;font-size:13px';
    errDiv.textContent = 'Error cargando detalle: '+err.message;
    el.appendChild(errDiv);
  });
}



// ─────────────────────────────────────────────────────────
//  MÓDULO MUERTES
// ─────────────────────────────────────────────────────────
var _muertesData = null;

var _muertes30dData = null;


var _productivoData  = null;
var _consumoData     = null;
var _indicadoresData = null;

var _eficienciaHistoricoData = null;
var _comportamientoHistoricoData = null;

async function cargarProductivo() {
  var contentEl = document.getElementById('productivoContent');
  var loading   = document.getElementById('productivLoading');
  if (_productivoData && _indicadoresData) {
    contentEl.innerHTML = '';
    if (_indicadoresData) renderIndicadores(_indicadoresData);
    if (_eficienciaHistoricoData) renderEficienciaHistorico(_eficienciaHistoricoData);
    renderProductivo(_productivoData);
    contentEl.style.display = 'block';
    if (loading) loading.style.display = 'none';
    return;
  }
  if (loading)   loading.style.display  = 'block';
  if (contentEl) contentEl.style.display = 'none';
  try {
    var [resp1, resp2, resp3, resp4, resp5] = await Promise.all([
      fetch(STOCK_SB + '/productivo_'  + STOCK_PER + '.json', {}),
      fetch(STOCK_SB + '/consumo_'     + STOCK_PER + '.json', {}),
      fetch(STOCK_SB + '/indicadores_' + STOCK_PER + '.json', {}),
      fetch(STOCK_SB + '/eficiencia_historico.json', {}).catch(function(){ return null; }),
      fetch(STOCK_SB + '/comportamiento_historico.json', {}).catch(function(){ return null; }),
    ]);
    if (!resp1.ok) throw new Error('HTTP ' + resp1.status);
    _productivoData  = await resp1.json();
    if (resp2.ok) _consumoData          = await resp2.json();
    if (resp3.ok) _indicadoresData      = await resp3.json();
    if (resp4 && resp4.ok) _eficienciaHistoricoData = await resp4.json();
    if (resp5 && resp5.ok) _comportamientoHistoricoData = await resp5.json();
    if (loading) loading.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
    contentEl.innerHTML = '';
    if (_indicadoresData) renderIndicadores(_indicadoresData);
    if (_eficienciaHistoricoData) renderEficienciaHistorico(_eficienciaHistoricoData);
    renderProductivo(_productivoData);
    // renderConsumo ahora vive en la pestaña % MS
  } catch(e) {
    if (loading) loading.innerHTML =
      '<div style="padding:60px;text-align:center">'
      + '<div style="font-size:28px">&#9888;</div>'
      + '<div style="font-family:\'Playfair Display\',serif;font-size:18px;margin-top:12px">No se encontró productivo_'+STOCK_PER+'.json</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.4);margin-top:8px">Ejecutá 2_EJECUTAR_AHORA.bat para generar el archivo</div>'
      + '</div>';
  }
}

function renderEficienciaHistorico(data) {
  var el = document.getElementById('productivoContent');
  if (!el || !data) return;
  var registros = (data.registros || []).filter(function(r){ return r.fecha && r.kg_pv != null && r.cabezas; });
  if (registros.length < 1) return;

  // ── Cálculo de valores anuales (mismo criterio que renderIndicadores) ──
  var consAn   = (typeof _consumoData !== 'undefined' && _consumoData) ? (_consumoData.anual || {}) : {};
  var compHist = (typeof _comportamientoHistoricoData !== 'undefined' && _comportamientoHistoricoData) ? (_comportamientoHistoricoData.snapshots || []) : [];
  var prodMes  = (typeof _productivoData !== 'undefined' && _productivoData) ? (_productivoData.por_mes || {}) : {};
  var ult12 = compHist.slice(-12);
  var sumKg = 0, nKg = 0, sumCab = 0, nCab = 0;
  ult12.forEach(function(r){
    var hm = r && r.hacienda_masa;
    var haras = hm && hm.pegsa && hm.pegsa.por_campo && hm.pegsa.por_campo['El Haras'];
    if (haras && haras.kg_proyectado) { sumKg  += haras.kg_proyectado; nKg++; }
    if (haras && haras.cabezas)       { sumCab += haras.cabezas;       nCab++; }
  });
  var kgPVAnualEf = nKg  > 0 ? sumKg  / nKg  : 0;
  var cabAnualEf  = nCab > 0 ? sumCab / nCab : 0;
  var msAnualDiaEf = (consAn.total_kg_ms || 0) / 365;
  var tcAnualDiaEf = (consAn.total_kg    || 0) / 365;
  var pvAnualEf    = kgPVAnualEf > 0 ? (msAnualDiaEf / kgPVAnualEf * 100) : null;
  var msPorCabAnEf = cabAnualEf  > 0 ? (msAnualDiaEf / cabAnualEf) : null;
  var cabAnDiaEf   = cabAnualEf  > 0 ? (tcAnualDiaEf / cabAnualEf) : null;
  var mesesProd2   = Object.keys(prodMes).sort().slice(-12);
  var adpNum2 = 0, adpDen2 = 0;
  mesesProd2.forEach(function(m){
    var d = prodMes[m] || {};
    if (d.cabezas > 0 && d.adp_promedio > 0) { adpNum2 += d.adp_promedio * d.cabezas; adpDen2 += d.cabezas; }
  });
  var adpAnualEf  = adpDen2 > 0 ? adpNum2 / adpDen2 : 0;
  var convAnualEf = (msPorCabAnEf != null && adpAnualEf > 0) ? (msPorCabAnEf / adpAnualEf) : null;

  // ── Recalcular cada registro con la fórmula nueva (consistente con tarjetas) ──
  registros = registros.map(function(r){
    var pctPVAj = r.pct_pv != null ? r.pct_pv / 0.92 : null;
    var kgCabDia = (r.kg_pv > 0 && r.cabezas > 0) ? (r.kg_pv / r.cabezas) : null;
    // Conversión nueva: (%PV anual × kg/cab del día) ÷ ADP del día
    var convNueva = null;
    if (pvAnualEf != null && kgCabDia != null && r.adp > 0) {
      convNueva = pvAnualEf / 100 * kgCabDia / r.adp;
    }
    return Object.assign({}, r, {
      pct_pv_aj:  pctPVAj,
      conv_calc:  convNueva,
      kg_cab_dia: kgCabDia,
    });
  });

  var wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:48px';

  // Header
  wrap.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-l);margin-bottom:6px">HISTÓRICO DE EFICIENCIA</div>'
   +'<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;margin-bottom:4px">Evolución de Indicadores</div>'
   +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-bottom:20px">'+registros.length+' día'+(registros.length!==1?'s':'')+' registrado'+(registros.length!==1?'s':'')+' · El Haras · líneas punteadas = referencia anual</div>';

  // Botones de período
  var btnBar = document.createElement('div');
  btnBar.style.cssText = 'display:flex;gap:8px;margin-bottom:18px';
  var periodos = [
    {label:'30 días',  dias:30},
    {label:'90 días',  dias:90},
    {label:'Todo',     dias:0},
  ];
  var canvasId = 'efic-hist-canvas';
  var chartInst = null;

  function buildDatasets(dias) {
    var regs = dias > 0 ? registros.slice(-dias) : registros;
    var labels  = regs.map(function(r){ var p=r.fecha.split('-'); return p[2]+'/'+p[1]; });
    var n = regs.length;
    function lineaRef(val){ return Array(n).fill(val != null ? val : null); }
    return {
      labels: labels,
      datasets: [
        {
          label: '% Peso Vivo',
          data: regs.map(function(r){ return r.pct_pv_aj; }),
          borderColor: '#c0392b', backgroundColor: 'rgba(192,57,43,.08)',
          yAxisID: 'yPv', tension: 0.3, pointRadius: 2, pointHoverRadius: 5,
          borderWidth: 2, fill: false,
        },
        {
          label: 'Ref. % PV anual',
          data: lineaRef(pvAnualEf),
          borderColor: 'rgba(192,57,43,.55)', borderDash: [5,4],
          yAxisID: 'yPv', pointRadius: 0, pointHoverRadius: 0,
          borderWidth: 1.5, fill: false, spanGaps: true,
        },
        {
          label: 'Conversión (:1)',
          data: regs.map(function(r){ return r.conv_calc; }),
          borderColor: '#27613d', backgroundColor: 'rgba(39,97,61,.08)',
          yAxisID: 'yConv', tension: 0.3, pointRadius: 2, pointHoverRadius: 5,
          borderWidth: 2, fill: false,
        },
        {
          label: 'Ref. Conv. anual',
          data: lineaRef(convAnualEf),
          borderColor: 'rgba(39,97,61,.55)', borderDash: [5,4],
          yAxisID: 'yConv', pointRadius: 0, pointHoverRadius: 0,
          borderWidth: 1.5, fill: false, spanGaps: true,
        },
        {
          label: 'MS/cab/día (kg)',
          data: regs.map(function(r){ return r.consumo_ms_cab; }),
          borderColor: '#b8922a', backgroundColor: 'rgba(184,146,42,.08)',
          yAxisID: 'yMs', tension: 0.3, pointRadius: 2, pointHoverRadius: 5,
          borderWidth: 2, fill: false,
        },
        {
          label: 'Ref. MS/cab anual',
          data: lineaRef(msPorCabAnEf),
          borderColor: 'rgba(184,146,42,.55)', borderDash: [5,4],
          yAxisID: 'yMs', pointRadius: 0, pointHoverRadius: 0,
          borderWidth: 1.5, fill: false, spanGaps: true,
        },
      ]
    };
  }

  function renderChart(dias) {
    var ds = buildDatasets(dias);
    if (chartInst) { chartInst.destroy(); }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    chartInst = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: ds,
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'DM Mono, monospace', size: 11 }, boxWidth: 12, padding: 16 } },
          tooltip: {
            backgroundColor: 'rgba(26,22,18,.92)', titleFont: { family: 'DM Mono, monospace', size: 11 },
            bodyFont: { family: 'DM Mono, monospace', size: 11 }, padding: 10, cornerRadius: 2,
          }
        },
        scales: {
          x: { ticks: { font: { family: 'DM Mono, monospace', size: 10 }, maxTicksLimit: 12, color: 'rgba(26,22,18,.4)' }, grid: { color: 'rgba(26,22,18,.05)' } },
          yPv:   { position: 'left',  title: { display: true, text: '% PV', font: { family: 'DM Mono, monospace', size: 10 }, color: '#c0392b' }, ticks: { color: '#c0392b', font: { size: 10, family: 'DM Mono, monospace' } }, grid: { color: 'rgba(26,22,18,.06)' } },
          yConv: { position: 'right', title: { display: true, text: 'Conversión', font: { family: 'DM Mono, monospace', size: 10 }, color: '#27613d' }, ticks: { color: '#27613d', font: { size: 10, family: 'DM Mono, monospace' } }, grid: { drawOnChartArea: false } },
          yMs:   { position: 'right', title: { display: true, text: 'kg MS/cab', font: { family: 'DM Mono, monospace', size: 10 }, color: '#b8922a' }, ticks: { color: '#b8922a', font: { size: 10, family: 'DM Mono, monospace' } }, grid: { drawOnChartArea: false }, offset: true },
        }
      }
    });
  }

  periodos.forEach(function(p, idx) {
    var btn = document.createElement('button');
    btn.textContent = p.label;
    btn.dataset.dias = p.dias;
    btn.style.cssText = 'font-family:DM Mono,monospace;font-size:11px;padding:4px 12px;border-radius:2px;cursor:pointer;border:1px solid rgba(26,22,18,.2);background:'+(idx===1?'rgba(26,22,18,.08)':'transparent')+';color:rgba(26,22,18,.7)';
    btn.addEventListener('click', function() {
      btnBar.querySelectorAll('button').forEach(function(b){ b.style.background='transparent'; });
      btn.style.background = 'rgba(26,22,18,.08)';
      renderChart(parseInt(btn.dataset.dias));
    });
    btnBar.appendChild(btn);
  });
  wrap.appendChild(btnBar);

  // Canvas
  var canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative;height:280px;background:#fff;border:1px solid rgba(26,22,18,.1);border-radius:2px;padding:16px';
  var canvas = document.createElement('canvas');
  canvas.id = canvasId;
  canvasWrap.appendChild(canvas);
  wrap.appendChild(canvasWrap);

  // Separador
  var sep = document.createElement('hr');
  sep.style.cssText = 'border:none;border-top:2px solid rgba(26,22,18,.08);margin:36px 0 32px';
  wrap.appendChild(sep);

  el.appendChild(wrap);

  // Render con 90 días por defecto
  setTimeout(function(){ renderChart(90); }, 50);
}

function renderIndicadores(data) {
  var el = document.getElementById('productivoContent');
  if (!el || !data) return;

  var ind   = data.indicadores || {};
  var fuen  = data.fuentes     || {};
  var pvRaw = ind.pct_peso_vivo         || {};
  var pv = {
    valor:   pvRaw.valor != null ? pvRaw.valor / 0.92 : null,
    ref_min: 2.2,
    ref_opt: 2.4,
    ref_max: 2.7,
    esc_min: 1.5,
    esc_max: 3.0,
  };
  var cab   = ind.consumo_por_cabeza    || {};
  var conv  = ind.conversion_alimenticia || {};

  // ── Pre-cálculo anual (necesario para sobrescribir la conversión diaria) ──
  var consAn   = (typeof _consumoData !== 'undefined' && _consumoData) ? (_consumoData.anual || {}) : {};
  var compHist = (typeof _comportamientoHistoricoData !== 'undefined' && _comportamientoHistoricoData) ? (_comportamientoHistoricoData.snapshots || []) : [];
  var prodMes  = (typeof _productivoData !== 'undefined' && _productivoData) ? (_productivoData.por_mes || {}) : {};

  var ult12 = compHist.slice(-12);
  var nKg = 0, sumKg = 0, nCab = 0, sumCab = 0;
  ult12.forEach(function(r){
    var hm = r && r.hacienda_masa;
    var haras = hm && hm.pegsa && hm.pegsa.por_campo && hm.pegsa.por_campo['El Haras'];
    if (haras && haras.kg_proyectado) { sumKg  += haras.kg_proyectado; nKg++; }
    if (haras && haras.cabezas)       { sumCab += haras.cabezas;       nCab++; }
  });
  var kgPVAnual = nKg  > 0 ? sumKg  / nKg  : 0;
  var cabAnual  = nCab > 0 ? sumCab / nCab : 0;

  var mesesProd = Object.keys(prodMes).sort().slice(-12);
  var adpNum = 0, adpDen = 0;
  mesesProd.forEach(function(m){
    var d = prodMes[m] || {};
    var c = d.cabezas || 0;
    var a = d.adp_promedio || 0;
    if (c > 0 && a > 0) { adpNum += a * c; adpDen += c; }
  });
  var adpAnual = adpDen > 0 ? adpNum / adpDen : 0;

  var msAnualDia  = (consAn.total_kg_ms || 0) / 365;
  var tcAnualDia  = (consAn.total_kg    || 0) / 365;
  var pvAnual     = (kgPVAnual > 0) ? (msAnualDia / kgPVAnual * 100) : null;
  var cabAnualDia = (cabAnual  > 0) ? (tcAnualDia / cabAnual) : null;
  var msPorCabDia = (cabAnual  > 0) ? (msAnualDia / cabAnual) : null;
  var convAnual   = (msPorCabDia != null && adpAnual > 0) ? (msPorCabDia / adpAnual) : null;

  // Sobrescribir la conversión diaria con: (%PV anual × kg/cab Haras actual) ÷ ADP último mes
  // El %PV anual actúa como factor "semi-fijo" para que la conversión diaria refleje el peso actual.
  var kgCabHaras = (fuen.kg_stock_haras > 0 && fuen.cab_haras > 0) ? (fuen.kg_stock_haras / fuen.cab_haras) : 0;
  var adpUltMes  = fuen.adp_promedio || 0;
  if (pvAnual != null && kgCabHaras > 0 && adpUltMes > 0) {
    conv.valor = pvAnual / 100 * kgCabHaras / adpUltMes;
  }

  function fmtD(n, d) { return (n != null && n !== undefined) ? Number(n).toFixed(d||1).replace('.',',') : '—'; }
  function fmtN(n)    { return n != null ? Number(Math.round(n||0)).toLocaleString('es-AR') : '—'; }

  // Semáforo: devuelve color + etiqueta según posición relativa a refs
  function semaforo(val, min, opt, max, invertido) {
    // invertido=true: menor es mejor (conversión)
    if (val == null) return { color:'#aaa', bg:'rgba(150,150,150,.1)', label:'Sin datos' };
    if (!invertido) {
      if (val < min)             return { color:'#c0392b', bg:'rgba(192,57,43,.08)',  label:'Bajo' };
      if (val >= min && val < opt) return { color:'#b8922a', bg:'rgba(184,146,42,.1)', label:'Normal' };
      if (val >= opt && val <=max) return { color:'#27613d', bg:'rgba(39,97,61,.08)',  label:'Óptimo' };
      return                          { color:'#c0392b', bg:'rgba(192,57,43,.08)',  label:'Alto' };
    } else {
      if (val <= max && val >= min) return { color:'#27613d', bg:'rgba(39,97,61,.08)',  label:'Óptimo' };
      if (val < min)                return { color:'#27613d', bg:'rgba(39,97,61,.08)',  label:'Excelente' };
      if (val > max && val < max*1.3) return { color:'#b8922a', bg:'rgba(184,146,42,.1)', label:'Elevado' };
      return                            { color:'#c0392b', bg:'rgba(192,57,43,.08)',  label:'Muy alto' };
    }
  }

  // Semáforo consumo/cab: rango total 8-19, normal 10-16, óptimo 13-15
  function semaforoCab(val) {
    if (val == null) return { color:'#aaa', bg:'rgba(150,150,150,.1)', label:'Sin datos' };
    if (val < 10)              return { color:'#c0392b', bg:'rgba(192,57,43,.08)',  label:'Bajo' };
    if (val >= 10 && val < 13)  return { color:'#b8922a', bg:'rgba(184,146,42,.1)', label:'Normal' };
    if (val >= 13 && val <= 15) return { color:'#27613d', bg:'rgba(39,97,61,.08)',  label:'Óptimo' };
    if (val > 15 && val <= 16)  return { color:'#b8922a', bg:'rgba(184,146,42,.1)', label:'Normal' };
    return                          { color:'#c0392b', bg:'rgba(192,57,43,.08)',  label:'Alto' };
  }
  function barraRefCab(val) {
    // Escala: 8 a 19 kg/cab/día · óptimo 13–15
    var rMin = 8, rMax = 19, optMin = 13, optMax = 15;
    if (val == null) return '';
    var pct    = Math.min(Math.max((val - rMin) / (rMax - rMin) * 100, 2), 98);
    var oMinPct = (optMin - rMin) / (rMax - rMin) * 100;
    var oMaxPct = (optMax - rMin) / (rMax - rMin) * 100;
    var col = semaforoCab(val).color;
    return '<div style="position:relative;height:6px;background:rgba(26,22,18,.07);border-radius:4px;margin-top:14px">'
      +'<div style="position:absolute;left:'+oMinPct.toFixed(1)+'%;width:'+(oMaxPct-oMinPct).toFixed(1)+'%;height:100%;background:rgba(39,97,61,.18);border-radius:4px"></div>'
      +'<div style="position:absolute;left:'+pct.toFixed(1)+'%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:'+col+';top:-3px;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.35);margin-top:6px">'
      +'<span>8</span><span style="color:rgba(39,97,61,.6)">óptimo 13–15</span><span>19</span></div>';
  }

  var sPv   = semaforo(pv.valor,   pv.ref_min,  pv.ref_opt,  pv.ref_max,  false);
  var sCab  = semaforoCab(cab.valor_tc);
  var sConv = semaforo(conv.valor, conv.ref_min, conv.ref_min, conv.ref_max, true);

  // Barra de posición dentro del rango de referencia (escala fija opcional)
  function barraRef(val, min, max, invertido, escMin, escMax) {
    if (val == null) return '';
    var rMin = (escMin != null) ? escMin : min * 0.7;
    var rMax = (escMax != null) ? escMax : max * 1.3;
    var pct  = Math.min(Math.max((val - rMin) / (rMax - rMin) * 100, 2), 98);
    var minPct = (min - rMin) / (rMax - rMin) * 100;
    var maxPct = (max - rMin) / (rMax - rMin) * 100;
    var lblMin = (escMin != null) ? escMin : min;
    var lblMax = (escMax != null) ? escMax : max;
    return '<div style="position:relative;height:6px;background:rgba(26,22,18,.07);border-radius:4px;margin-top:14px">'
      // zona óptima sombreada
      +'<div style="position:absolute;left:'+minPct.toFixed(1)+'%;width:'+(maxPct-minPct).toFixed(1)+'%;height:100%;background:rgba(39,97,61,.15);border-radius:4px"></div>'
      // marcador del valor
      +'<div style="position:absolute;left:'+pct.toFixed(1)+'%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:'+(invertido ? (val<=max?'#27613d':'#c0392b') : (val>=min&&val<=max?'#27613d':'#c0392b'))+';top:-3px;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.35);margin-top:6px">'
      +'<span>'+fmtD(lblMin,1)+'</span><span style="color:rgba(39,97,61,.6)">óptimo '+fmtD(min,1)+'–'+fmtD(max,1)+'</span><span>'+fmtD(lblMax,1)+'</span></div>';
  }

  var denominador = data.denominador || 'El Haras';
  var cabDenom    = fuen.cab_haras       || fuen.cab_stock  || 0;
  var kgDenom     = fuen.kg_stock_haras  || fuen.kg_stock_total || 0;

  // Panel principal
  var panel = document.createElement('div');
  panel.style.cssText = 'margin-bottom:40px';

  // Header
  panel.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-l);margin-bottom:6px">INDICADORES PRODUCTIVOS</div>'
   +'<div style="font-family:\'Playfair Display\',serif;font-size:28px;font-weight:700;margin-bottom:6px">Eficiencia del Rodeo</div>'
   +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-bottom:28px">'
   +'<span style="background:rgba(26,22,18,.07);padding:2px 8px;border-radius:2px;margin-right:8px">'+denominador+'</span>'
   +'<strong>'+fmtN(cabDenom)+'</strong> cab · <strong>'+fmtN(kgDenom)+'</strong> kg PV &nbsp;|&nbsp; '
   +'Consumo MS: <strong>'+fmtN(fuen.prom_diario_ms)+'</strong> kg/día ('+fuen.dias_consumo+' días) &nbsp;|&nbsp; '
   +'ADP: <strong>'+fmtD(fuen.adp_promedio,2)+'</strong> kg/día'
   +'</div>';

  // Cards de indicadores
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:20px';

  function makeIndicCard(titulo, valorHtml, subtitulo, refTexto, formula, estado, barraHtml) {
    var c = document.createElement('div');
    c.style.cssText = 'padding:24px 28px 20px;border:1px solid rgba(26,22,18,.1);border-radius:2px;background:'+estado.bg
      +';border-left:4px solid '+estado.color+';position:relative';
    c.innerHTML =
      // badge estado
      '<div style="position:absolute;top:16px;right:16px;font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;'
      +'background:'+estado.color+';color:#fff;padding:3px 8px;border-radius:2px">'+estado.label+'</div>'
      // título
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.45);margin-bottom:10px">'+titulo+'</div>'
      // valor
      +'<div style="font-family:\'Playfair Display\',serif;font-size:34px;font-weight:700;color:'+estado.color+';line-height:1">'+valorHtml+'</div>'
      // subtítulo
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.5);margin-top:6px">'+subtitulo+'</div>'
      // barra de referencia
      + barraHtml
      // referencia y fórmula
      +'<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(26,22,18,.08)">'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.4)">Ref: <strong>'+refTexto+'</strong></div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.3);margin-top:3px">'+formula+'</div>'
      +'</div>';
    return c;
  }

  // Card 1 — % Peso Vivo
  grid.appendChild(makeIndicCard(
    '% Consumo de Peso Vivo',
    fmtD(pv.valor, 2) + '<span style="font-size:18px;margin-left:4px">% PV</span>',
    'kg MS/día sobre el peso vivo — '+denominador,
    '1,5% – 3,0%  ·  normal 2,2 – 2,7  ·  óptimo 2,4 – 2,6',
    '(kg MS/día ÷ kg PV '+denominador+' × 100) ÷ 0,92',
    sPv,
    barraRef(pv.valor, pv.ref_min, pv.ref_max, false, pv.esc_min, pv.esc_max)
  ));

  // Card 2 — Consumo por cabeza
  grid.appendChild(makeIndicCard(
    'Consumo por Cabeza',
    fmtD(cab.valor_tc, 1) + '<span style="font-size:18px;margin-left:4px">kg TC/cab</span>',
    fmtD(cab.valor_ms, 1) + ' kg MS/cab/día  ·  '+fmtN(cabDenom)+' cabezas ('+denominador+')',
    '8 – 19 kg TC/cab/día  ·  normal 10 – 16  ·  óptimo 13 – 15',
    'kg TC/día ÷ cabezas '+denominador,
    sCab,
    barraRefCab(cab.valor_tc)
  ));

  // Card 3 — Conversión alimenticia
  // Nuevo cálculo: (%PV anual × kg/cab Haras actuales) ÷ ADP último mes cerrado.
  // El %PV anual actúa como factor "semi-fijo" para que el indicador refleje el estado actual del Haras.
  grid.appendChild(makeIndicCard(
    'Conversión Alimenticia',
    fmtD(conv.valor, 1) + '<span style="font-size:18px;margin-left:4px">: 1</span>',
    (pvAnual != null ? fmtD(pvAnual,2)+'% PV anual' : '—')
      + ' × ' + fmtD(kgCabHaras,1) + ' kg/cab Haras  ÷  ADP ' + fmtD(adpUltMes,2) + ' kg/día'
      + (fuen.adp_mes ? '  ·  ' + fuen.adp_mes : ''),
    '5 : 1 – 8 : 1  ·  menor = más eficiente',
    '(% PV anual × kg/cab Haras) ÷ ADP último mes cerrado',
    sConv,
    barraRef(conv.valor, conv.ref_min, conv.ref_max, true)
  ));

  panel.appendChild(grid);

  // Nota metodológica
  var nota = document.createElement('div');
  nota.style.cssText = 'font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.35);padding:10px 16px;'
    +'background:rgba(26,22,18,.03);border-radius:2px;line-height:1.7';
  var _adpMesLabel = fuen.adp_mes || 'último mes cerrado';
  nota.innerHTML = 'ℹ <strong>Nota:</strong> El ADP utilizado es el engorde real del último mes cerrado ('
    + _adpMesLabel + ' · ' + fmtD(fuen.adp_promedio, 3) + ' kg/día). '
    +'El consumo MS corresponde al promedio de los últimos días con registros. '
    +'Para mayor precisión se recomienda comparar períodos cerrados.';
  panel.appendChild(nota);

  // ── Referencia anual: 3 tarjetas más chicas con promedios ponderados ──
  // (Los cálculos anuales se hicieron arriba para sobrescribir la conversión diaria.)
  if (kgPVAnual > 0 || cabAnual > 0) {
    var hdrAnual = document.createElement('div');
    hdrAnual.style.cssText = 'font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.45);margin-top:28px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid rgba(26,22,18,.08)';
    hdrAnual.innerHTML = 'Referencia anual <span style="text-transform:none;letter-spacing:0;color:rgba(26,22,18,.35);margin-left:8px">(últimos 12 meses · PEGSA en El Haras · valores ponderados)</span>';
    panel.appendChild(hdrAnual);

    var gridAnual = document.createElement('div');
    gridAnual.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:8px';

    function makeRefCard(titulo, valor, sub, formula) {
      var c = document.createElement('div');
      c.style.cssText = 'padding:16px 20px;border:1px solid rgba(26,22,18,.1);border-radius:2px;background:rgba(26,22,18,.025)';
      c.innerHTML =
        '<div style="font-family:DM Mono,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:6px">'+titulo+'</div>'
        +'<div style="font-family:\'Playfair Display\',serif;font-size:24px;font-weight:700;color:rgba(26,22,18,.8);line-height:1">'+valor+'</div>'
        +'<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.45);margin-top:6px">'+sub+'</div>'
        +'<div style="font-family:DM Mono,monospace;font-size:10px;color:rgba(26,22,18,.3);margin-top:4px">'+formula+'</div>';
      return c;
    }

    gridAnual.appendChild(makeRefCard(
      '% Consumo PV anual',
      pvAnual != null ? fmtD(pvAnual,2) + ' % PV' : '—',
      'MS anual ÷ 365 ÷ kg PV prom. anual',
      fmtN(consAn.total_kg_ms) + ' kg MS  ÷  ' + fmtN(kgPVAnual) + ' kg PV'
    ));
    gridAnual.appendChild(makeRefCard(
      'Consumo por cab anual',
      cabAnualDia != null ? fmtD(cabAnualDia,1) + ' kg TC/cab' : '—',
      'TC anual ÷ 365 ÷ cab. promedio anuales',
      fmtN(consAn.total_kg) + ' kg TC  ÷  ' + fmtN(cabAnual) + ' cab'
    ));
    gridAnual.appendChild(makeRefCard(
      'Conversión anual',
      convAnual != null ? fmtD(convAnual,1) + ' : 1' : '—',
      'kg MS/cab/día anual ÷ ADP anual ponderado',
      (msPorCabDia != null ? fmtD(msPorCabDia,1) : '—') + ' MS/cab/día  ÷  ' + fmtD(adpAnual,3) + ' kg/día'
    ));

    panel.appendChild(gridAnual);
  }

  // Separador
  var sep = document.createElement('hr');
  sep.style.cssText = 'border:none;border-top:2px solid rgba(26,22,18,.08);margin:36px 0 32px';
  panel.appendChild(sep);

  el.appendChild(panel);
}

function renderProductivo(data) {
  var el = document.getElementById('productivoContent');
  if (!el) return;
  el.style.display = 'block';
  // No limpia el contenedor — renderIndicadores ya escribió primero

  var meta    = data.meta          || {};
  var gral    = data.general       || {};
  var porCat  = data.por_categoria || {};
  var porMes  = data.por_mes       || {};

  function fmtN(n)   { return n != null ? Number(Math.round(n||0)).toLocaleString('es-AR') : '—'; }
  function fmtD(n,d) { return n != null ? Number(n).toFixed(d||2).replace('.',',') : '—'; }

  // ── Header ──
  var hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:32px';
  hdr.innerHTML =
    '<div style="font-family:\'\1\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-l);margin-bottom:6px">PARÁMETROS PRODUCTIVOS</div>'
   +'<div style="font-family:\'\1\',serif;font-size:28px;font-weight:700;margin-bottom:6px">Engorde &amp; Estadía</div>'
   +'<div style="font-family:\'\1\',monospace;font-size:12px;color:rgba(26,22,18,.4)">'
   +'v_PB_Egresos · WinCampo FEEDLOT'
   +(meta.desde_anio ? ' &nbsp;·&nbsp; Desde: '+meta.desde_anio : '')
   +'&nbsp;·&nbsp; Solo ventas &nbsp;·&nbsp; '+fmtN(meta.registros_filtrados)+' registros'
   +'</div>';
  el.appendChild(hdr);
  el.appendChild(document.createElement('hr')).style.cssText = 'border:none;border-top:1px solid rgba(26,22,18,.1);margin:0 0 32px';

  // ── Función card KPI ──
  function makeCard(label, value, sub, color) {
    var c = document.createElement('div');
    c.style.cssText = 'padding:20px 24px;border:1px solid rgba(26,22,18,.1);border-radius:2px;background:#fff';
    c.innerHTML = '<div style="font-family:\'\1\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:8px">'+label+'</div>'
      +'<div style="font-family:\'\1\',serif;font-size:30px;font-weight:700;color:'+(color||'rgba(26,22,18,.9)')+'">'+value+'</div>'
      +'<div style="font-family:\'\1\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:6px">'+sub+'</div>';
    return c;
  }

  // ── Cards generales ──
  var secGral = document.createElement('div');
  secGral.style.cssText = 'margin-bottom:40px';
  secGral.innerHTML = '<div style="font-family:\'\1\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:16px">RESUMEN ÚLTIMO AÑO — VENTAS</div>';
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px';
  grid.appendChild(makeCard('ADP Promedio', fmtD(gral.adp_promedio,3)+' kg/día', 'engorde diario sin debaste · promedio ponderado', '#1a5276'));
  grid.appendChild(makeCard('Estadía Promedio', fmtD(gral.estadia_promedio,1)+' días', 'días en feedlot al momento del egreso', '#27613d'));
  grid.appendChild(makeCard('Cabezas analizadas', fmtN(gral.cabezas), 'egresos VENTA con datos completos', 'rgba(26,22,18,.85)'));
  secGral.appendChild(grid);

  // Cards min/max
  var grid2 = document.createElement('div');
  grid2.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px';
  function makeCardSm(label, value, color) {
    var c = document.createElement('div');
    c.style.cssText = 'padding:14px 18px;border:1px solid rgba(26,22,18,.08);border-radius:2px;background:rgba(26,22,18,.02)';
    c.innerHTML = '<div style="font-family:\'\1\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:6px">'+label+'</div>'
      +'<div style="font-family:\'\1\',monospace;font-size:16px;font-weight:700;color:'+(color||'rgba(26,22,18,.7)')+'">'+value+'</div>';
    return c;
  }
  grid2.appendChild(makeCardSm('ADP Mínimo',      fmtD(gral.adp_min,3)+' kg/día',  '#c0392b'));
  grid2.appendChild(makeCardSm('ADP Máximo',       fmtD(gral.adp_max,3)+' kg/día',  '#27613d'));
  grid2.appendChild(makeCardSm('Estadía Mínima',   fmtD(gral.estadia_min,0)+' días', '#c0392b'));
  grid2.appendChild(makeCardSm('Estadía Máxima',   fmtD(gral.estadia_max,0)+' días', '#27613d'));
  secGral.appendChild(grid2);
  el.appendChild(secGral);

  // ── Sección ADP Real 90 días vs Teórico ──
  var porCat90 = data.por_categoria_90d || {};
  var cats90   = Object.keys(porCat90);
  if (cats90.length) {
    var sec90 = document.createElement('div');
    sec90.style.cssText = 'margin-bottom:40px';
    sec90.innerHTML =
      '<div class="section-header">'
      +'<span class="section-title">ADP Real — Últimos 90 Días</span>'
      +'<span class="section-sub">ADP observado vs teórico por categoría · rango controlado ±10%</span>'
      +'</div>';

    // Cards por categoría (grid responsive)
    var gridADP = document.createElement('div');
    gridADP.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-bottom:16px';

    cats90.sort(function(a,b){ return (porCat90[b].cabezas||0)-(porCat90[a].cabezas||0); });
    cats90.forEach(function(cat) {
      var d       = porCat90[cat];
      var obs     = d.adp_promedio;
      var teo     = d.adp_teorico;
      var cal     = d.adp_calibrado;
      var varPct  = d.variacion_pct;
      var ajust   = d.ajustado;
      var minR    = d.adp_min_range;
      var maxR    = d.adp_max_range;

      // Color semáforo
      var dotColor = '#27613d'; // dentro del rango
      var dotLabel = 'Dentro del rango';
      if (ajust) { dotColor = '#b8922a'; dotLabel = 'Ajustado al límite'; }

      // Barra progreso: obs relativo al rango [teo*0.85, teo*1.15]
      var barMin  = teo ? teo * 0.85 : 0;
      var barMax  = teo ? teo * 1.15 : 2;
      var barPct  = obs != null ? Math.min(100, Math.max(0, (obs - barMin) / (barMax - barMin) * 100)) : 50;
      var midPct  = 50; // posición del valor teórico en la barra
      var zonePct = 100/3; // ±10% ocupa ~33% del rango visible

      var varStr  = varPct != null ? (varPct >= 0 ? '+' : '') + varPct.toFixed(1) + '%' : '—';
      var varCol  = varPct == null ? 'rgba(26,22,18,.4)' : (Math.abs(varPct) <= 10 ? '#27613d' : '#b8922a');

      var card = document.createElement('div');
      card.style.cssText = 'padding:18px 20px;border:1px solid rgba(26,22,18,.1);border-radius:2px;background:#fff';
      card.innerHTML =
        // Encabezado categoría + estado
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.5)">'+cat+'</div>'
        +'<div style="display:flex;align-items:center;gap:5px">'
        +'<div style="width:7px;height:7px;border-radius:50%;background:'+dotColor+'"></div>'
        +'<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:'+dotColor+'">'+dotLabel+'</div>'
        +'</div></div>'
        // Valor principal: ADP observado
        +'<div style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:700;color:rgba(26,22,18,.9);line-height:1">'
        +(obs != null ? fmtD(obs,3) : '—')
        +'<span style="font-family:\'DM Mono\',monospace;font-size:12px;font-weight:400;color:rgba(26,22,18,.4);margin-left:4px">kg/día</span>'
        +'</div>'
        // Teórico + variación
        +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.45);margin-top:5px">'
        +'Teórico: '+(teo != null ? fmtD(teo,3) : '—')+' kg/día &nbsp;'
        +'<span style="color:'+varCol+';font-weight:600">'+varStr+'</span>'
        +'</div>'
        // Barra de rango
        +'<div style="margin-top:10px">'
        +'<div style="position:relative;background:rgba(26,22,18,.06);border-radius:2px;height:5px">'
        // Zona permitida (verde claro, de 40% a 60% del ancho = ±10% sobre teórico)
        +'<div style="position:absolute;left:'+((midPct-zonePct/2)).toFixed(1)+'%;width:'+(zonePct).toFixed(1)+'%;height:100%;background:rgba(39,97,61,.18);border-radius:2px"></div>'
        // Posición observada
        +(obs != null ? '<div style="position:absolute;left:'+barPct.toFixed(1)+'%;transform:translateX(-50%);width:9px;height:9px;border-radius:50%;background:'+dotColor+';top:-2px;border:2px solid #fff;box-shadow:0 0 0 1px '+dotColor+'"></div>' : '')
        +'</div>'
        +'<div style="display:flex;justify-content:space-between;font-family:\'DM Mono\',monospace;font-size:10px;color:rgba(26,22,18,.3);margin-top:3px">'
        +'<span>'+(minR != null ? fmtD(minR,3) : '—')+'</span>'
        +'<span style="color:rgba(26,22,18,.45)">±10% teo.</span>'
        +'<span>'+(maxR != null ? fmtD(maxR,3) : '—')+'</span>'
        +'</div>'
        +'</div>'
        // Calibrado
        +(cal != null ? '<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:rgba(26,22,18,.35);margin-top:6px;border-top:1px solid rgba(26,22,18,.06);padding-top:6px">ADG usado en historial: <strong style="color:rgba(26,22,18,.6)">'+fmtD(cal,3)+' kg/día</strong></div>' : '')
        // Sub-nota cabezas
        +'<div style="font-family:\'DM Mono\',monospace;font-size:10px;color:rgba(26,22,18,.3);margin-top:4px">'+fmtN(d.cabezas)+' cabezas analizadas</div>';
      gridADP.appendChild(card);
    });
    sec90.appendChild(gridADP);

    // Nota explicativa
    var nota = document.createElement('div');
    nota.style.cssText = 'background:rgba(26,22,18,.03);border:1px solid rgba(26,22,18,.08);border-radius:2px;padding:12px 16px;font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.5);line-height:1.7';
    nota.innerHTML = '📐 <strong style="color:rgba(26,22,18,.65)">Metodología:</strong> ADP observado = promedio ponderado de <em>AdpSinDebaste</em> en egresos por VENTA de los últimos 90 días · '
      +'Rango controlado: el valor usado en la estimación de masa histórica se clampea a ±10% del ADP teórico de tabla · '
      +'Si no hay egresos recientes de una categoría, se usa el valor teórico de tabla.';
    sec90.appendChild(nota);
    el.appendChild(sec90);
  }

  // ── Tabla por categoría ──
  var cats = Object.keys(porCat);
  if (cats.length) {
    var secCat = document.createElement('div');
    secCat.style.cssText = 'margin-bottom:40px';
    secCat.innerHTML = '<div class="section-header"><span class="section-title">Por Categoría</span><span class="section-sub">ADP y estadía promedio · ventas último año</span></div>';
    var tbl = document.createElement('table'); tbl.className = 'data-table';
    tbl.innerHTML = '<thead><tr>'
      +'<th>Categoría</th>'
      +'<th class="right">Cabezas</th>'
      +'<th class="right">ADP Prom.</th>'
      +'<th class="right">ADP Mín.</th>'
      +'<th class="right">ADP Máx.</th>'
      +'<th class="right">Estadía Prom.</th>'
      +'<th class="right">Estadía Mín.</th>'
      +'<th class="right">Estadía Máx.</th>'
      +'</tr></thead>';
    var tb = document.createElement('tbody');
    // Ordenar por cabezas desc
    cats.sort(function(a,b){ return (porCat[b].cabezas||0)-(porCat[a].cabezas||0); });
    cats.forEach(function(cat) {
      var d = porCat[cat];
      // Color ADP: verde si >= promedio general, rojo si <
      var adpColor = (d.adp_promedio != null && gral.adp_promedio != null)
        ? (d.adp_promedio >= gral.adp_promedio ? '#27613d' : '#c0392b') : 'inherit';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+cat+'</strong></td>'
        +'<td class="right mono">'+fmtN(d.cabezas)+'</td>'
        +'<td class="right mono" style="color:'+adpColor+';font-weight:700">'+fmtD(d.adp_promedio,3)+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+fmtD(d.adp_min,3)+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+fmtD(d.adp_max,3)+'</td>'
        +'<td class="right mono" style="color:#27613d;font-weight:700">'+fmtD(d.estadia_promedio,1)+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+fmtD(d.estadia_min,0)+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+fmtD(d.estadia_max,0)+'</td>';
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); secCat.appendChild(tbl); el.appendChild(secCat);
  }

  // ── Evolución mensual ──
  var meses = Object.keys(porMes).sort();
  if (meses.length) {
    var secMes = document.createElement('div');
    secMes.style.cssText = 'margin-bottom:40px';
    secMes.innerHTML = '<div class="section-header"><span class="section-title">Evolución Mensual</span><span class="section-sub">ADP y estadía promedio mes a mes</span></div>';
    var tbl2 = document.createElement('table'); tbl2.className = 'data-table';
    tbl2.innerHTML = '<thead><tr><th>Mes</th><th class="right">Cabezas</th><th class="right">ADP Prom.</th><th class="right">Estadía Prom.</th></tr></thead>';
    var tb2 = document.createElement('tbody');
    var adpVals = meses.map(function(m){ return porMes[m].adp_promedio||0; });
    var maxAdp  = Math.max.apply(null, adpVals) || 1;
    var prevAdp = null;
    meses.forEach(function(mes) {
      var d   = porMes[mes];
      var adp = d.adp_promedio;
      var est = d.estadia_promedio;
      var barW = adp ? (adp/maxAdp*100).toFixed(1) : '0';
      // Flecha variación ADP
      var flecha = '';
      if (prevAdp != null && adp != null) {
        flecha = adp > prevAdp
          ? ' <span style="color:#c0392b;font-size:13px">&#9650;</span>'
          : adp < prevAdp
            ? ' <span style="color:#27613d;font-size:13px">&#9660;</span>'
            : '';
      }
      prevAdp = adp;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+mes+'</strong></td>'
        +'<td class="right mono">'+fmtN(d.cabezas)+'</td>'
        +'<td class="right mono" style="font-weight:600">'
          +'<span>'+fmtD(adp,3)+' kg/día</span>'+flecha
          +'<div style="margin-top:4px;background:rgba(26,22,18,.07);border-radius:2px;height:6px">'
            +'<div style="background:#1a5276;height:100%;width:'+barW+'%;border-radius:2px"></div>'
          +'</div>'
        +'</td>'
        +'<td class="right mono" style="color:#27613d;font-weight:600">'+fmtD(est,1)+' días</td>';
      tb2.appendChild(tr);
    });
    tbl2.appendChild(tb2); secMes.appendChild(tbl2); el.appendChild(secMes);
  }
}


function renderConsumo(data) {
  var el = document.getElementById('materiasecaContent');
  if (!el) return;

  var meta    = data.meta    || {};
  var anual   = data.anual   || {};
  var semanal = data.semanal || {};

  function fmtN(n)   { return n != null ? Number(Math.round(n||0)).toLocaleString('es-AR') : '—'; }
  function fmtD(n,d) { return n != null ? Number(n).toFixed(d||1).replace('.',',') : '—'; }

  // ── Banner de datos desactualizados (verde/amarillo/rojo) ──
  if (meta.ultimo_completo) {
    var ult = new Date(meta.ultimo_completo + 'T00:00:00');
    var hoy0 = new Date(); hoy0.setHours(0,0,0,0);
    var diasRetraso = Math.max(0, Math.floor((hoy0 - ult) / 86400000));
    if (diasRetraso >= 3) {
      var rojo = diasRetraso >= 5;
      var col = rojo ? '#c0392b' : '#b8922a';
      var bg  = rojo ? 'rgba(192,57,43,.07)' : 'rgba(184,146,42,.09)';
      var icon = rojo ? '🔴' : '⚠';
      var banner = document.createElement('div');
      banner.style.cssText = 'background:'+bg+';border-left:4px solid '+col+';padding:14px 18px;border-radius:2px;margin-bottom:24px;display:flex;align-items:center;gap:12px;font-family:DM Mono,monospace';
      banner.innerHTML =
        '<span style="font-size:18px">'+icon+'</span>'
        + '<div style="flex:1">'
        +   '<div style="font-weight:700;color:'+col+';font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px">Mixer desactualizado</div>'
        +   '<div style="font-size:13px;color:rgba(26,22,18,.75)">Última lectura: <strong>' + meta.ultimo_completo + '</strong> · hace <strong>' + diasRetraso + ' días</strong>'
        +     '<span style="color:rgba(26,22,18,.45);font-size:12px;margin-left:10px">(la próxima corrida del pipeline puede regenerar los datos)</span>'
        +   '</div>'
        + '</div>';
      el.appendChild(banner);
    }
  }

  // ── Separador (separa el resumen % MS del detalle de insumos) ──
  var sep = document.createElement('hr');
  sep.style.cssText = 'border:none;border-top:2px solid rgba(26,22,18,.08);margin:40px 0 32px';
  el.appendChild(sep);

  // ── Header sección ──
  var hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:28px';
  var fuenteTxt = meta.fuente === 'mixer_dropbox'
    ? 'Mixer (Dropbox) · ' + (meta.tabla || 'Lectura_Viajes + Lectura_Carga')
    : (meta.tabla || 'v_PB_ConsumoDetallado') + ' · últimos 365 días';
  var ultCompletoTxt = meta.ultimo_completo
    ? ' · último día completo: '+meta.ultimo_completo
    : (meta.desde_anual ? ' · Desde: '+meta.desde_anual : '');
  hdr.innerHTML =
    '<div style="font-family:\'\1\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-l);margin-bottom:6px">CONSUMO DE ALIMENTO</div>'
   +'<div style="font-family:\'\1\',serif;font-size:24px;font-weight:700;margin-bottom:6px">Suministro de Insumos</div>'
   +'<div style="font-family:\'\1\',monospace;font-size:12px;color:rgba(26,22,18,.4)">'
   +fuenteTxt+ultCompletoTxt
   +'</div>';
  el.appendChild(hdr);

  // ── Cards resumen ──
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px';

  function makeCard(label, value, sub, color) {
    var c = document.createElement('div');
    c.style.cssText = 'padding:20px 24px;border:1px solid rgba(26,22,18,.1);border-radius:2px;background:#fff';
    c.innerHTML = '<div style="font-family:\'\1\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:8px">'+label+'</div>'
      +'<div style="font-family:\'\1\',serif;font-size:28px;font-weight:700;color:'+(color||'rgba(26,22,18,.9)')+'">'+value+'</div>'
      +'<div style="font-family:\'\1\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:6px">'+sub+'</div>';
    return c;
  }

  var totalAnual   = anual.total_kg    || 0;
  var totalAnualMs = anual.total_kg_ms || 0;
  var promDiario   = semanal.promedio_diario_kg    || 0;
  var promDiarioMs = semanal.promedio_diario_kg_ms || 0;
  var insumos      = (anual.por_insumo || []).length;
  var nDias        = semanal.dias_registrados || 3;
  var pctMsGlobal  = semanal.pct_ms_global   || (promDiario > 0 ? Math.round(promDiarioMs / promDiario * 1000) / 10 : 0);
  var subProm      = 'últ. '+nDias+' días registrados · '+semanal.desde+' → '+semanal.hasta;

  grid.style.gridTemplateColumns = 'repeat(2,1fr)';
  grid.style.marginBottom = '12px';
  // Fila 1: totales anuales
  grid.appendChild(makeCard('Total Anual (Tal Cual)', fmtN(totalAnual)+' kg', 'suministrado último año · todos los insumos', '#b8922a'));
  grid.appendChild(makeCard('Total Anual (Materia Seca)', fmtN(totalAnualMs)+' kg MS', 'equivalente en materia seca · último año', '#7b3f2a'));
  el.appendChild(grid);
  // Fila 2: promedios diarios
  var grid2b = document.createElement('div');
  grid2b.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px';
  grid2b.appendChild(makeCard('Prom. Diario TC', fmtN(promDiario)+' kg/día', subProm, '#1a5276'));
  grid2b.appendChild(makeCard('Prom. Diario MS', fmtN(promDiarioMs)+' kg MS/día', 'materia seca · '+nDias+' días registrados', '#2e6b6b'));
  grid2b.appendChild(makeCard('% Materia Seca', pctMsGlobal.toFixed(1).replace('.',',')+' %', 'MS ÷ TC · últimos '+nDias+' días registrados', '#5b4fcf'));
  grid2b.appendChild(makeCard('Insumos distintos', insumos, 'tipos de alimento en el año', 'rgba(26,22,18,.85)'));
  el.appendChild(grid2b);

  // ── Tabla anual por insumo ──
  var porIns = anual.por_insumo || [];
  if (porIns.length) {
    var maxKg  = porIns[0].kg || 1;
    var secAnu = document.createElement('div'); secAnu.style.cssText = 'margin-bottom:36px';
    secAnu.innerHTML = '<div class="section-header"><span class="section-title">Total por Insumo — Último Año</span><span class="section-sub">kg suministrados totales</span></div>';
    var tbl = document.createElement('table'); tbl.className = 'data-table';
    tbl.innerHTML = '<thead><tr><th>#</th><th>Insumo</th><th class="right">Kg TC</th><th class="right">MS %</th><th class="right">Kg MS</th><th class="right">% del Total</th><th style="width:160px">Proporción TC</th></tr></thead>';
    var tb = document.createElement('tbody');
    porIns.forEach(function(r, i) {
      var pct  = totalAnual > 0 ? (r.kg / totalAnual * 100).toFixed(1) : '0.0';
      var barW = (r.kg / maxKg * 100).toFixed(1);
      var tr = document.createElement('tr');
      tr.innerHTML = '<td style="color:rgba(26,22,18,.4);font-family:DM Mono,monospace;font-size:13px;width:32px">'+(i+1)+'</td>'
        +'<td><strong>'+r.desc+'</strong>'+(r.cod ? ' <span style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.35)">#'+r.cod+'</span>' : '')+'</td>'
        +'<td class="right mono" style="font-weight:700;color:#b8922a">'+fmtN(r.kg)+' kg</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+(r.ms_pct != null ? r.ms_pct+'%' : '—')+'</td>'
        +'<td class="right mono" style="font-weight:700;color:#7b3f2a">'+(r.kg_ms != null ? fmtN(r.kg_ms)+' kg' : '—')+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.55)">'+pct+'%</td>'
        +'<td style="padding:6px 16px;vertical-align:middle">'
          +'<div style="display:flex;align-items:center;gap:8px">'
            +'<div style="flex:1;background:rgba(26,22,18,.07);border-radius:2px;height:10px">'
              +'<div style="background:#b8922a;height:100%;width:'+barW+'%;border-radius:2px"></div>'
            +'</div>'
          +'</div>'
        +'</td>';
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); secAnu.appendChild(tbl); el.appendChild(secAnu);
  }

  // ── Tabla semanal por insumo (promedio diario) ──
  var porIns7 = semanal.por_insumo || [];
  if (porIns7.length) {
    var maxProm = porIns7[0].promedio_diario || 1;
    var sec7 = document.createElement('div'); sec7.style.cssText = 'margin-bottom:36px';
    var nDias7 = semanal.dias_registrados || 3;
    sec7.innerHTML = '<div class="section-header"><span class="section-title">Promedio Diario — Últimos '+nDias7+' días registrados</span><span class="section-sub">'+semanal.desde+' → '+semanal.hasta+' · '+fmtN(semanal.total_kg_3d)+' kg totales ÷ '+nDias7+' días</span></div>';
    var tbl7 = document.createElement('table'); tbl7.className = 'data-table';
    tbl7.innerHTML = '<thead><tr><th>#</th><th>Insumo</th><th class="right">Total '+nDias7+' días TC</th><th class="right">Prom. kg/día TC</th><th class="right">MS %</th><th class="right">Prom. kg/día MS</th><th style="width:140px">Proporción</th></tr></thead>';
    var tb7 = document.createElement('tbody');
    porIns7.forEach(function(r, i) {
      var barW = (r.promedio_diario / maxProm * 100).toFixed(1);
      var tr = document.createElement('tr');
      tr.innerHTML = '<td style="color:rgba(26,22,18,.4);font-family:DM Mono,monospace;font-size:13px;width:32px">'+(i+1)+'</td>'
        +'<td><strong>'+r.desc+'</strong>'+(r.cod ? ' <span style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.35)">#'+r.cod+'</span>' : '')+'</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.6)">'+fmtN(r.kg_3d)+' kg</td>'
        +'<td class="right mono" style="font-weight:700;color:#1a5276">'+fmtD(r.promedio_diario,1)+' kg/día</td>'
        +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+(r.ms_pct != null ? r.ms_pct+'%' : '—')+'</td>'
        +'<td class="right mono" style="font-weight:700;color:#2e6b6b">'+(r.promedio_diario_ms != null ? fmtD(r.promedio_diario_ms,1)+' kg/día' : '—')+'</td>'
        +'<td style="padding:6px 16px;vertical-align:middle">'
          +'<div style="display:flex;align-items:center;gap:8px">'
            +'<div style="flex:1;background:rgba(26,22,18,.07);border-radius:2px;height:10px">'
              +'<div style="background:#1a5276;height:100%;width:'+barW+'%;border-radius:2px"></div>'
            +'</div>'
          +'</div>'
        +'</td>';
      tb7.appendChild(tr);
    });
    // Fila total
    var tf = document.createElement('tr'); tf.className = 'total';
    tf.innerHTML = '<td></td><td><strong>TOTAL</strong></td>'
      +'<td class="right"><strong>'+fmtN(semanal.total_kg_3d)+' kg</strong></td>'
      +'<td class="right" style="color:#1a5276"><strong>'+fmtD(semanal.promedio_diario_kg,1)+' kg/día</strong></td>'
      +'<td></td>'
      +'<td class="right" style="color:#2e6b6b"><strong>'+fmtD(semanal.promedio_diario_kg_ms,1)+' kg MS/día</strong></td>'
      +'<td></td>';
    tb7.appendChild(tf);
    tbl7.appendChild(tb7); sec7.appendChild(tbl7); el.appendChild(sec7);
  }

  // ── Último día de carga registrado ────────────────────────────────────
  var ult = data.ultimo_dia || {};
  if (ult.fecha && ult.total_tc) {
    var secUlt = document.createElement('div');
    secUlt.style.cssText = 'margin-bottom:36px';

    // Formatear fecha legible
    var fechaUltFmt = ult.fecha;
    try {
      var dp = ult.fecha.split('-');
      fechaUltFmt = dp[2]+'/'+dp[1]+'/'+dp[0];
    } catch(e){}

    var esProm = ult.es_promedio === true;
    secUlt.innerHTML =
      '<div class="section-header">'
      +'<span class="section-title">Último Día de Carga Registrado</span>'
      +'<span class="section-sub">'+fechaUltFmt+(esProm ? ' · promedio diario del período reciente' : ' · dato real del sistema')+'</span>'
      +'</div>';

    // Dos tarjetas de totales del día
    var rowDay = document.createElement('div');
    rowDay.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px';
    var subDia = esProm ? 'promedio diario (7 días) · todos los insumos' : 'total suministrado ese día · todos los insumos';
    var subMs  = esProm ? 'promedio MS diario (7 días)' : 'equivalente en materia seca · ese día';
    rowDay.appendChild(makeCard(
      (esProm ? 'Promedio Diario TC' : 'Total Tal Cual')+' — '+fechaUltFmt,
      fmtN(ult.total_tc)+' kg TC',
      subDia, '#b8922a'
    ));
    rowDay.appendChild(makeCard(
      (esProm ? 'Promedio Diario MS' : 'Total Materia Seca')+' — '+fechaUltFmt,
      fmtN(ult.total_ms)+' kg MS',
      subMs, '#7b3f2a'
    ));
    secUlt.appendChild(rowDay);

    // Tabla desglose por insumo del último día
    var ultIns = ult.por_insumo || [];
    if (ultIns.length) {
      var maxUlt = ultIns[0].kg || 1;
      var tblUlt = document.createElement('table'); tblUlt.className = 'data-table';
      tblUlt.innerHTML =
        '<thead><tr>'
        +'<th>#</th><th>Insumo</th>'
        +'<th class="right">kg TC</th>'
        +'<th class="right">% del día</th>'
        +'<th class="right">MS %</th>'
        +'<th class="right">kg MS</th>'
        +'<th style="width:160px">Proporción TC</th>'
        +'</tr></thead>';
      var tbUlt = document.createElement('tbody');
      ultIns.forEach(function(r, i) {
        var barW = (r.kg / maxUlt * 100).toFixed(1);
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td style="color:rgba(26,22,18,.4);font-family:DM Mono,monospace;font-size:13px;width:32px">'+(i+1)+'</td>'
          +'<td><strong>'+r.desc+'</strong>'+(r.cod?' <span style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.35)">#'+r.cod+'</span>':'')+'</td>'
          +'<td class="right mono" style="font-weight:700;color:#b8922a">'+fmtN(r.kg)+' kg</td>'
          +'<td class="right mono" style="color:rgba(26,22,18,.55)">'+(r.pct_total != null ? r.pct_total+'%' : '—')+'</td>'
          +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+(r.ms_pct != null ? r.ms_pct+'%' : '—')+'</td>'
          +'<td class="right mono" style="font-weight:700;color:#7b3f2a">'+(r.kg_ms != null ? fmtN(r.kg_ms)+' kg' : '—')+'</td>'
          +'<td style="padding:6px 16px;vertical-align:middle">'
            +'<div style="flex:1;background:rgba(26,22,18,.07);border-radius:2px;height:10px">'
              +'<div style="background:#b8922a;height:100%;width:'+barW+'%;border-radius:2px"></div>'
            +'</div>'
          +'</td>';
        tbUlt.appendChild(tr);
      });
      // Fila total
      var tfUlt = document.createElement('tr'); tfUlt.className = 'total';
      tfUlt.innerHTML = '<td></td><td><strong>TOTAL</strong></td>'
        +'<td class="right"><strong>'+fmtN(ult.total_tc)+' kg</strong></td>'
        +'<td class="right">100%</td><td></td>'
        +'<td class="right" style="color:#7b3f2a"><strong>'+fmtN(ult.total_ms)+' kg</strong></td>'
        +'<td></td>';
      tbUlt.appendChild(tfUlt);
      tblUlt.appendChild(tbUlt);
      secUlt.appendChild(tblUlt);
    }
    el.appendChild(secUlt);
  }

  // ── Tabla DIARIA últimos 30 días (fuente: Mixer Dropbox) ──
  var diario = data.diario || {};
  var diasArr = diario.dias || [];
  if (diasArr.length) {
    var secD = document.createElement('div');
    secD.style.cssText = 'margin-top:36px;margin-bottom:36px';

    // Subtítulo con fechas en formato DD/MM/YYYY
    function fmtFecha(iso) {
      if (!iso) return '';
      var p = iso.split('-');
      return p[2]+'/'+p[1]+'/'+p[0];
    }
    var subFechas = fmtFecha(diario.desde)+' → '+fmtFecha(diario.hasta);

    secD.innerHTML =
      '<div class="section-header">'
      +'<span class="section-title">Consumo Diario — Últimos '+diasArr.length+' días</span>'
      +'<span class="section-sub">'+subFechas+' · fuente: Mixer (Dropbox) · sólo días completos</span>'
      +'</div>';

    // Identificar todos los insumos presentes (orden por kg total)
    var insumosTotal = {};
    diasArr.forEach(function(d) {
      var pi = d.por_insumo || {};
      Object.keys(pi).forEach(function(k){
        insumosTotal[k] = (insumosTotal[k]||0) + (pi[k]||0);
      });
    });
    var insumosOrden = Object.keys(insumosTotal).sort(function(a,b){
      return insumosTotal[b] - insumosTotal[a];
    });

    // Calcular max para barra
    var maxDay = 0;
    diasArr.forEach(function(d){ if (d.kg_total > maxDay) maxDay = d.kg_total; });
    if (!maxDay) maxDay = 1;

    var tblD = document.createElement('table');
    tblD.className = 'data-table';

    // Header dinámico con un column por insumo + total + %MS
    var thead = '<thead><tr><th>Fecha</th>';
    insumosOrden.forEach(function(ins){
      thead += '<th class="right">'+ins+'</th>';
    });
    thead += '<th class="right">Total TC</th><th class="right">Total MS</th><th class="right">%MS</th><th style="width:140px">Volumen</th></tr></thead>';
    tblD.innerHTML = thead;

    var tbD = document.createElement('tbody');
    // Mostrar de más reciente a más antiguo (al revés del array)
    var diasRev = diasArr.slice().reverse();
    diasRev.forEach(function(d) {
      var barW    = (d.kg_total / maxDay * 100).toFixed(1);
      var esDesc  = d.descartado === true;
      var tr      = document.createElement('tr');
      // Estilo del día descartado: fondo rosado claro + texto opaco
      if (esDesc) {
        tr.style.cssText = 'background:rgba(220,80,80,.06);color:rgba(26,22,18,.45)';
        tr.title = 'Día descartado del cálculo (caída >30% — probable falta de datos de un mixer)';
      }
      var fechaCell = '<strong>'+fmtFecha(d.fecha)+'</strong>'
        + (esDesc ? ' <span style="font-family:DM Mono,monospace;font-size:10px;color:#c0392b;background:rgba(220,80,80,.12);padding:1px 6px;border-radius:2px;margin-left:6px;letter-spacing:.06em">PARCIAL</span>' : '');
      var html = '<td>'+fechaCell+'</td>';
      insumosOrden.forEach(function(ins){
        var v = (d.por_insumo||{})[ins];
        var col = esDesc ? 'rgba(26,22,18,.35)' : 'rgba(26,22,18,.6)';
        html += '<td class="right mono" style="color:'+col+'">'+(v ? fmtN(v) : '—')+'</td>';
      });
      var colTC = esDesc ? 'rgba(184,146,42,.5)' : '#b8922a';
      var colMS = esDesc ? 'rgba(123,63,42,.5)' : '#7b3f2a';
      var colPC = esDesc ? 'rgba(91,79,207,.5)' : '#5b4fcf';
      var colBR = esDesc ? 'rgba(184,146,42,.4)' : '#b8922a';
      html += '<td class="right mono" style="font-weight:700;color:'+colTC+'">'+fmtN(d.kg_total)+' kg</td>';
      html += '<td class="right mono" style="font-weight:700;color:'+colMS+'">'+fmtN(d.kg_ms_total)+' kg</td>';
      html += '<td class="right mono" style="color:'+colPC+'">'+(d.pct_ms != null ? d.pct_ms.toFixed(1).replace('.',',')+'%' : '—')+'</td>';
      html += '<td style="padding:6px 16px;vertical-align:middle">'
            +'<div style="flex:1;background:rgba(26,22,18,.07);border-radius:2px;height:8px">'
            +'<div style="background:'+colBR+';height:100%;width:'+barW+'%;border-radius:2px"></div>'
            +'</div></td>';
      tr.innerHTML = html;
      tbD.appendChild(tr);
    });
    tblD.appendChild(tbD);
    secD.appendChild(tblD);

    // Leyenda de días descartados (si hay)
    var hayDescartados = diasArr.some(function(d){ return d.descartado === true; });
    if (hayDescartados) {
      var leyenda = document.createElement('div');
      leyenda.style.cssText = 'margin-top:12px;padding:10px 14px;background:rgba(220,80,80,.05);border-left:3px solid #c0392b;font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.7);line-height:1.6';
      leyenda.innerHTML =
        '<strong style="color:#c0392b">Nota:</strong> los días marcados como '
        + '<span style="background:rgba(220,80,80,.12);color:#c0392b;padding:1px 6px;border-radius:2px">PARCIAL</span> '
        + 'tienen una caída &gt;30% vs el promedio reciente. Posible causa: uno de los dos mixers no subió datos al Dropbox ese día. '
        + 'Estos días NO se usan para calcular el promedio diario ni el total de los últimos 3 días.';
      secD.appendChild(leyenda);
    }

    el.appendChild(secD);
  }

  // ── Gráfico: evolución diaria del suministro (últimos 30 días) ──
  if (diasArr.length) {
    var secG = document.createElement('div');
    secG.style.cssText = 'margin-top:12px;margin-bottom:36px';

    var promRef = semanal.promedio_diario_kg || 0;
    var subTxt = 'kg TC/día · últimos '+diasArr.length+' días'
      + (promRef > 0 ? ' · línea = promedio ('+fmtN(promRef)+' kg/día, excluye días parciales)' : '');

    secG.innerHTML =
      '<div class="section-header">'
      +'<span class="section-title">Evolución del Suministro Diario</span>'
      +'<span class="section-sub">'+subTxt+'</span>'
      +'</div>';

    var canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:relative;height:280px;background:#fff;border:1px solid rgba(26,22,18,.1);border-radius:2px;padding:16px';
    var canvas = document.createElement('canvas');
    canvas.id = 'consumoDiarioChart';
    canvasWrap.appendChild(canvas);
    secG.appendChild(canvasWrap);
    el.appendChild(secG);

    function fmtFechaCorta(iso){
      if(!iso) return '';
      var p = iso.split('-');
      return p[2]+'/'+p[1];
    }

    var labels = diasArr.map(function(d){ return fmtFechaCorta(d.fecha); });
    var valores = diasArr.map(function(d){ return d.kg_total || 0; });
    var colores = diasArr.map(function(d){
      return d.descartado ? 'rgba(26,22,18,.18)' : '#b8922a';
    });
    var bordes = diasArr.map(function(d){
      return d.descartado ? 'rgba(26,22,18,.28)' : '#b8922a';
    });
    var lineaProm = diasArr.map(function(){ return promRef || null; });

    if (_consumoDiarioChart) { _consumoDiarioChart.destroy(); _consumoDiarioChart = null; }

    var ctx = canvas.getContext('2d');
    _consumoDiarioChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: 'kg TC/día',
            data: valores,
            backgroundColor: colores,
            borderColor: bordes,
            borderWidth: 1,
            borderRadius: 2,
            categoryPercentage: 0.85,
            barPercentage: 0.95,
          },
          {
            type: 'line',
            label: 'Promedio',
            data: lineaProm,
            borderColor: '#1a5276',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: 0,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(26,22,18,.92)',
            titleFont: { family: 'DM Mono, monospace', size: 11 },
            bodyFont: { family: 'DM Mono, monospace', size: 11 },
            padding: 10,
            cornerRadius: 2,
            callbacks: {
              title: function(items){
                if (!items || !items.length) return '';
                var idx = items[0].dataIndex;
                var d = diasArr[idx];
                if (!d) return items[0].label;
                var iso = d.fecha || '';
                var p = iso.split('-');
                return p.length === 3 ? (p[2]+'/'+p[1]+'/'+p[0]) : iso;
              },
              label: function(item){
                var idx = item.dataIndex;
                var d = diasArr[idx] || {};
                if (item.dataset.label === 'Promedio'){
                  return ' Promedio: '+fmtN(item.parsed.y)+' kg/día';
                }
                var lines = [' '+fmtN(d.kg_total)+' kg TC'];
                if (d.kg_ms_total != null) lines.push(' '+fmtN(d.kg_ms_total)+' kg MS · '+(d.pct_ms != null ? d.pct_ms.toFixed(1).replace('.',',')+'% MS' : ''));
                if (d.descartado) lines.push(' ⚠ día parcial — excluido del promedio');
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { family: 'DM Mono, monospace', size: 10 }, color: 'rgba(26,22,18,.5)', maxRotation: 0, autoSkip: true, maxTicksLimit: 15 },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { family: 'DM Mono, monospace', size: 10 },
              color: 'rgba(26,22,18,.5)',
              callback: function(v){ return Number(v).toLocaleString('es-AR'); },
            },
            grid: { color: 'rgba(26,22,18,.06)' },
          },
        },
      },
    });
  }
}

// ══════════════════════════════════════════════════════════
//  % MATERIA SECA — pestaña dedicada
// ══════════════════════════════════════════════════════════
async function cargarMateriaSeca() {
  var contentEl = document.getElementById('materiasecaContent');
  var loading   = document.getElementById('materiasecaLoading');
  // Reutilizar datos ya cargados en Productivo
  if (_consumoData) {
    if (loading)   loading.style.display  = 'none';
    if (contentEl) { contentEl.style.display = 'block'; contentEl.innerHTML = ''; }
    renderMateriaSeca(_consumoData);   // resumen % MS arriba
    renderConsumo(_consumoData);       // tablas detalladas de insumos abajo
    return;
  }
  if (loading)   loading.style.display  = 'block';
  if (contentEl) contentEl.style.display = 'none';
  try {
    var resp = await fetch(STOCK_SB + '/consumo_' + STOCK_PER + '.json', {});
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _consumoData = await resp.json();
    if (loading)   loading.style.display  = 'none';
    if (contentEl) { contentEl.style.display = 'block'; contentEl.innerHTML = ''; }
    renderMateriaSeca(_consumoData);   // resumen % MS arriba
    renderConsumo(_consumoData);       // tablas detalladas de insumos abajo
  } catch(e) {
    if (loading) loading.innerHTML =
      '<div style="padding:60px;text-align:center">'
      + '<div style="font-size:28px">⚠</div>'
      + '<div style="font-family:\'Playfair Display\',serif;font-size:18px;margin-top:12px">No se encontró consumo_'+STOCK_PER+'.json</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.4);margin-top:8px">Ejecutá 2_EJECUTAR_AHORA.bat para generar el archivo</div>'
      + '</div>';
  }
}

function renderMateriaSeca(data) {
  // Renderiza SOLO el resumen de % MS (cards + barra visual).
  // Las tablas detalladas de insumos las muestra renderConsumo justo debajo.
  var el = document.getElementById('materiasecaContent');
  if (!el || !data) return;

  var anual   = data.anual   || {};
  var semanal = data.semanal || {};

  function fmtN(n)   { return n != null ? Number(Math.round(n||0)).toLocaleString('es-AR') : '—'; }
  function fmtD(n,d) { return n != null ? Number(n).toFixed(d!=null?d:1).replace('.',',') : '—'; }

  var totalTc  = anual.total_kg    || 0;
  var totalMs  = anual.total_kg_ms || 0;
  var pctAnual = totalTc > 0 ? (totalMs / totalTc * 100) : 0;
  var promTc   = semanal.promedio_diario_kg    || 0;
  var promMs   = semanal.promedio_diario_kg_ms || 0;
  var pctRec   = semanal.pct_ms_global || (promTc > 0 ? promMs / promTc * 100 : 0);
  var nDias    = semanal.dias_registrados || 3;

  // ── Header ──
  var hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:28px';
  hdr.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-l);margin-bottom:6px">ANÁLISIS DE MATERIA SECA</div>'
   +'<div style="font-family:\'Playfair Display\',serif;font-size:28px;font-weight:700;margin-bottom:6px">% Materia Seca / Tal Cual</div>'
   +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.4)">'
   +'MS % = kg MS ÷ kg TC × 100 &nbsp;·&nbsp; global y por insumo'
   +'</div>';
  el.appendChild(hdr);
  el.appendChild(document.createElement('hr')).style.cssText = 'border:none;border-top:1px solid rgba(26,22,18,.1);margin:0 0 28px';

  // ── Cards ──
  function makeCard(label, value, sub, color, bgColor) {
    var c = document.createElement('div');
    c.style.cssText = 'padding:20px 24px;border:1px solid rgba(26,22,18,.1);border-radius:2px;background:'+(bgColor||'#fff');
    c.innerHTML =
      '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:8px">'+label+'</div>'
     +'<div style="font-family:\'Playfair Display\',serif;font-size:38px;font-weight:700;color:'+(color||'rgba(26,22,18,.9)')+'">'+value+'</div>'
     +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:6px">'+sub+'</div>';
    return c;
  }
  var gridMs = document.createElement('div');
  gridMs.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px';
  gridMs.appendChild(makeCard(
    '% MS — Últimos '+nDias+' días registrados',
    fmtD(pctRec,1)+' %',
    semanal.desde+' → '+semanal.hasta+' &nbsp;·&nbsp; '+fmtN(promMs)+' kg MS/día ÷ '+fmtN(promTc)+' kg TC/día',
    '#5b4fcf', 'rgba(91,79,207,.04)'
  ));
  gridMs.appendChild(makeCard(
    '% MS — Anual',
    fmtD(pctAnual,1)+' %',
    'último año &nbsp;·&nbsp; '+fmtN(totalMs)+' kg MS ÷ '+fmtN(totalTc)+' kg TC total',
    '#7b3f2a', 'rgba(123,63,42,.04)'
  ));
  el.appendChild(gridMs);

  // ── Barra visual % MS reciente ──
  var barSec = document.createElement('div');
  barSec.style.cssText = 'margin-bottom:12px;padding:20px 24px;border:1px solid rgba(91,79,207,.2);border-radius:2px;background:rgba(91,79,207,.02)';
  var barPct = Math.min(pctRec, 100).toFixed(1);
  barSec.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:12px">% MS Global — Últimos '+nDias+' días registrados</div>'
   +'<div style="display:flex;align-items:center;gap:16px">'
     +'<div style="flex:1;background:rgba(26,22,18,.07);border-radius:4px;height:22px;overflow:hidden">'
       +'<div style="background:linear-gradient(90deg,#5b4fcf,#8b7cf7);height:100%;width:'+barPct+'%;border-radius:4px;transition:width .6s ease"></div>'
     +'</div>'
     +'<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;color:#5b4fcf;min-width:68px;text-align:right">'+fmtD(pctRec,1)+' %</div>'
   +'</div>'
   +'<div style="display:flex;gap:32px;margin-top:10px;font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.5)">'
     +'<span>TC: <strong style="color:#1a5276">'+fmtN(promTc)+' kg/día</strong></span>'
     +'<span>MS: <strong style="color:#2e6b6b">'+fmtN(promMs)+' kg/día</strong></span>'
     +'<span>Anual: <strong style="color:#7b3f2a">'+fmtD(pctAnual,1)+' %</strong></span>'
   +'</div>';
  el.appendChild(barSec);
}

async function cargarMuertes() {
  var content = document.getElementById('muertesContent');
  var loading = document.getElementById('muertesLoading');
  if (_muertesData && _muertes30dData) { renderMuertes(_muertesData); renderMuertes30d(_muertes30dData); return; }
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';
  try {
    var [resp1, resp2] = await Promise.all([
      fetch(STOCK_SB + '/muertes_' + STOCK_PER + '.json', {}),
      fetch(STOCK_SB + '/muertes_30d_' + STOCK_PER + '.json', {}),
    ]);
    if (!resp1.ok) throw new Error('HTTP ' + resp1.status + ' — muertes_' + STOCK_PER + '.json');
    _muertesData = await resp1.json();
    if (resp2.ok) _muertes30dData = await resp2.json();
    if (loading) loading.style.display = 'none';
    renderMuertes(_muertesData);
    if (_muertes30dData) renderMuertes30d(_muertes30dData);
  } catch(e) {
    if (loading) loading.innerHTML =
      '<div style="padding:60px;text-align:center">'
      + '<div style="font-size:28px">&#9888;</div>'
      + '<div style="font-family:\'Playfair Display\',serif;font-size:18px;margin-top:12px">No se encontró muertes_'+STOCK_PER+'.json</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.4);margin-top:8px">Ejecutá 2_EJECUTAR_AHORA.bat para generar el archivo</div>'
      + '</div>';
  }
}

function renderMuertes(data) {
  var el = document.getElementById('muertesContent');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = '';

  var meta      = data.meta        || {};
  var anio      = data.anio        || {};
  var mesAnt    = data.mes_anterior || {};
  var mort      = data.mortandad   || {};
  var nomMesAnt = mesAnt.nombre    || meta.nombre_mes_ant || 'Mes anterior';
  var desde     = meta.desde_anio  || '';

  function fmtN(n)   { return Number(Math.round(n||0)).toLocaleString('es-AR'); }
  function fmtPct(n) { return n != null ? Number(n).toFixed(2).replace('.',',') + '%' : '—'; }

  // Encabezado
  var hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:36px;padding-bottom:18px;border-bottom:2px solid var(--border-strong)';
  hdr.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:6px">Números Productivos</div>'
    +'<div style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:700">Muertes & Tasa de Mortandad</div>'
    +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:4px">'
    +'V_MUERTES · WinCampo FEEDLOT'+(desde?' &nbsp;·&nbsp; Desde: '+desde:'')+'</div>';
  el.appendChild(hdr);

  // Card helper
  function makeCard(label, val, sub, borderColor, valSize) {
    var d = document.createElement('div');
    d.style.cssText = 'background:white;border:1px solid var(--border);padding:22px 26px;border-left:4px solid '+(borderColor||'var(--border-strong)');
    d.innerHTML =
      '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:8px">'+label+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:'+(valSize||'28px')+';font-weight:700;line-height:1;color:'+(borderColor||'var(--ink)')+'">'+val+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.38);margin-top:6px">'+sub+'</div>';
    return d;
  }

  // ═══ TASA DE MORTANDAD ═══
  var tasaLabel = document.createElement('div');
  tasaLabel.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:10px';
  tasaLabel.textContent = 'Tasa de Mortandad Mensual';
  el.appendChild(tasaLabel);

  var tasaWrap = document.createElement('div');
  tasaWrap.style.cssText = 'margin-bottom:48px;padding:28px 32px;background:rgba(26,22,18,.02);border:1px solid var(--border-strong);border-left:4px solid var(--gold)';

  var tasaColor = mort.tasa_mensual_pct == null ? 'var(--gold)'
    : (mort.tasa_mensual_pct > 2 ? '#c0392b' : mort.tasa_mensual_pct > 1 ? '#b8922a' : '#27613d');

  var g1 = document.createElement('div');
  g1.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2px;background:rgba(26,22,18,.07);margin-bottom:20px';
  g1.appendChild(makeCard('Tasa Mensual',
    mort.tasa_mensual_pct != null ? fmtPct(mort.tasa_mensual_pct) : '—',
    'muertes ÷ (ingresos + stock)', tasaColor, '34px'));
  g1.appendChild(makeCard('Muertes Año',
    fmtN(mort.muertes_anio), 'cabezas fallecidas último año (>30d encierre)', '#c0392b'));
  tasaWrap.appendChild(g1);

  // Desglose fórmula
  var fDesc = document.createElement('div');
  fDesc.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;padding:12px 4px 0;border-top:1px solid var(--border)';
  function fItem(lbl, val, note) {
    var d = document.createElement('div');
    d.style.cssText = 'font-family:\'DM Mono\',monospace';
    d.innerHTML = '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:4px">'+lbl+'</div>'
      +'<div style="font-size:18px;font-weight:700">'+val+'</div>'
      +'<div style="font-size:11px;color:rgba(26,22,18,.32);margin-top:2px">'+note+'</div>';
    return d;
  }
  fDesc.appendChild(fItem('Ingresos año (filtrados)', fmtN(mort.ingresos_anio), 'excl. DESTETE y TRASLADO'));
  fDesc.appendChild(fItem('Stock El Haras hoy', fmtN(mort.stock_haras_hoy), 'corrales 1–199'));
  fDesc.appendChild(fItem('Denominador', fmtN(mort.denominador), 'ingresos + stock'));
  tasaWrap.appendChild(fDesc);
  el.appendChild(tasaWrap);

  // ═══ TASA POR GRUPO ═══
  var porGrupo = mort.por_grupo || {};
  var GRUPOS   = ['Vacas','Machos','Hembras'];
  var GRUPO_COLOR = { Vacas:'#7b3f2a', Machos:'#1a5276', Hembras:'#27613d' };
  var GRUPO_ICON  = { Vacas:'🐄', Machos:'🐂', Hembras:'🐮' };

  var lblGrupo = document.createElement('div');
  lblGrupo.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:10px';
  lblGrupo.textContent = 'Tasa de Mortandad por Grupo';
  el.appendChild(lblGrupo);

  var grupoWrap = document.createElement('div');
  grupoWrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;background:rgba(26,22,18,.07);margin-bottom:48px';

  GRUPOS.forEach(function(g) {
    var tg = porGrupo[g] || {};
    var color = GRUPO_COLOR[g];
    var tm = tg.tasa_mensual_pct;
    var taColor = tm == null ? color : (tm > 2 ? '#c0392b' : tm > 1 ? '#b8922a' : '#27613d');

    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:1px solid var(--border);padding:22px 26px;border-left:4px solid '+color;
    card.innerHTML =
      '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:8px">'+GRUPO_ICON[g]+' '+g+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:30px;font-weight:700;line-height:1;color:'+taColor+'">'+(tm != null ? fmtPct(tm) : '—')+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.38);margin-top:6px">tasa mensual</div>'
      +'<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-family:\'DM Mono\',monospace;font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">'
        +'<span style="color:rgba(26,22,18,.4)">Muertes</span><span style="color:#c0392b;font-weight:700">'+fmtN(tg.muertes||0)+'</span>'
        +'<span style="color:rgba(26,22,18,.4)">Ingresos</span><span>'+fmtN(tg.ingresos||0)+'</span>'
        +'<span style="color:rgba(26,22,18,.4)">Stock</span><span>'+fmtN(tg.stock||0)+'</span>'
        +'<span style="color:rgba(26,22,18,.4)">Denominador</span><span>'+fmtN(tg.denominador||0)+'</span>'
      +'</div>';
    grupoWrap.appendChild(card);
  });
  el.appendChild(grupoWrap);

  // ═══ REPORTE ÚLTIMO AÑO ═══
  var lblAnio = document.createElement('div');
  lblAnio.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:10px';
  lblAnio.textContent = 'Reporte — Últimos 12 meses';
  el.appendChild(lblAnio);

  var catsSorted = Object.entries(anio.por_categoria||{}).sort(function(a,b){return b[1]-a[1];});
  var g2 = document.createElement('div');
  g2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2px;background:rgba(26,22,18,.07);border:1px solid rgba(192,57,43,.15);margin-bottom:32px';
  g2.appendChild(makeCard('Total Muertes', fmtN(anio.total_muertes), 'cabezas fallecidas en el período', '#c0392b'));
  g2.appendChild(makeCard('Categoría Principal',
    catsSorted[0] ? catsSorted[0][0] : '—',
    catsSorted[0] ? fmtN(catsSorted[0][1])+' cabezas' : 'sin datos', '#b8922a'));
  el.appendChild(g2);

  // Tabla categorías año
  if (catsSorted.length) {
    var sA = document.createElement('div'); sA.style.cssText = 'margin-bottom:36px';
    sA.innerHTML = '<div class="section-header"><span class="section-title">Por Categoría — Último año</span></div>';
    var tA = document.createElement('table'); tA.className = 'data-table';
    tA.innerHTML = '<thead><tr><th>Categoría</th><th class="right">Muertes</th><th class="right">% del total</th></tr></thead>';
    var bA = document.createElement('tbody');
    var totA = anio.total_muertes || 0;
    catsSorted.forEach(function(e) {
      var pct = totA > 0 ? (e[1]/totA*100).toFixed(1) : '0.0';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+e[0]+'</strong></td>'
        +'<td class="right mono" style="color:#c0392b">'+fmtN(e[1])+'</td>'
        +'<td class="right mono">'+pct+'%</td>';
      bA.appendChild(tr);
    });
    var rA = document.createElement('tr'); rA.className = 'total';
    rA.innerHTML = '<td><strong>TOTAL</strong></td><td class="right" style="color:#c0392b"><strong>'+fmtN(totA)+'</strong></td><td class="right"><strong>100%</strong></td>';
    bA.appendChild(rA); tA.appendChild(bA); sA.appendChild(tA); el.appendChild(sA);
  }

  // Evolución mensual año
  var mesesA = Object.entries(anio.por_mes||{}).filter(function(e){return e[0]!=='Sin fecha';}).sort(function(a,b){return a[0]>b[0]?1:-1;});
  if (mesesA.length) {
    var sM = document.createElement('div'); sM.style.cssText = 'margin-bottom:48px';
    sM.innerHTML = '<div class="section-header"><span class="section-title">Evolución Mensual</span><span class="section-sub">último año</span></div>';
    var tM = document.createElement('table'); tM.className = 'data-table';
    tM.innerHTML = '<thead><tr><th>Mes</th><th class="right">Muertes</th><th class="right">% del total</th><th>Variación</th></tr></thead>';
    var bM = document.createElement('tbody');
    var totM  = anio.total_muertes || 0;
    var maxM  = Math.max.apply(null, mesesA.map(function(e){return e[1];}));
    var prevM = null;
    mesesA.forEach(function(e) {
      var mes = e[0], val = e[1];
      var pct    = totM > 0 ? (val/totM*100).toFixed(1) : '0.0';
      var barPct = maxM > 0 ? (val/maxM*100) : 0;
      // Color barra: rojo si sube respecto al mes anterior, verde si baja, gris si igual
      var barColor = prevM === null ? '#b8922a'
                   : val > prevM   ? '#c0392b'
                   : val < prevM   ? '#27613d'
                   : 'rgba(26,22,18,.25)';
      // Flecha de tendencia
      var arrow = prevM === null ? ''
                : val > prevM ? ' <span style="color:#c0392b;font-size:12px">▲</span>'
                : val < prevM ? ' <span style="color:#27613d;font-size:12px">▼</span>'
                : ' <span style="color:rgba(26,22,18,.3);font-size:12px">●</span>';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+mes+'</strong></td>'
        +'<td class="right mono" style="color:#c0392b">'+fmtN(val)+arrow+'</td>'
        +'<td class="right mono">'+pct+'%</td>'
        +'<td style="padding:0 16px;vertical-align:middle;width:220px">'
          +'<div style="background:rgba(26,22,18,.07);border-radius:2px;height:14px;width:100%;position:relative">'
            +'<div style="background:'+barColor+';height:100%;width:'+barPct.toFixed(1)+'%;border-radius:2px;transition:width .3s"></div>'
          +'</div>'
        +'</td>';
      bM.appendChild(tr);
      prevM = val;
    });
    var rM = document.createElement('tr'); rM.className = 'total';
    rM.innerHTML = '<td><strong>TOTAL</strong></td><td class="right" style="color:#c0392b"><strong>'+fmtN(totM)+'</strong></td><td class="right"><strong>100%</strong></td><td></td>';
    bM.appendChild(rM); tM.appendChild(bM); sM.appendChild(tM); el.appendChild(sM);
  }

}



function renderMuertes30d(data) {
  var el = document.getElementById('muertesContent');
  if (!el) return;

  var meta  = data.meta    || {};
  var mort  = data.mortandad || {};
  var det   = data.detalle || {};
  var label = meta.label_periodo || 'Últimos 30 días';

  function fmtN(n)   { return Number(Math.round(n||0)).toLocaleString('es-AR'); }
  function fmtPct(n) { return n != null ? Number(n).toFixed(2).replace('.',',') + '%' : '—'; }

  function makeCard30(label, val, sub, color) {
    var d = document.createElement('div');
    d.style.cssText = 'background:white;border:1px solid var(--border);padding:24px 28px';
    d.innerHTML =
      '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:10px">'+label+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:36px;font-weight:700;line-height:1'+(color?';color:'+color:'')+'" >'+val+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.38);margin-top:6px">'+sub+'</div>';
    return d;
  }

  // ── Separador y título ──
  var sep = document.createElement('div');
  sep.style.cssText = 'border-top:3px solid var(--border-strong);margin:48px 0 32px';
  el.appendChild(sep);

  var hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:32px';
  hdr.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:6px">Reporte — Últimos 30 días</div>'
    +'<div style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:700">'+label+'</div>'
    +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:4px">V_MUERTES · v_PB_Ingresos · V_STOCK_HACIENDA · >30 días encierre</div>';
  el.appendChild(hdr);

  // ── Sección 1: Tasa global 30 días ──
  var secTasa = document.createElement('div');
  secTasa.style.cssText = 'margin-bottom:16px;padding:2px;background:rgba(26,22,18,.05);border:1px solid rgba(26,22,18,.1)';
  var secTasaLbl = document.createElement('div');
  secTasaLbl.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:10px;margin-top:20px;padding-left:4px';
  secTasaLbl.textContent = 'Tasa de Mortandad — 30 días';
  el.appendChild(secTasaLbl);

  var tasaColor = mort.tasa_mensual_pct == null ? 'var(--gold)'
    : (mort.tasa_mensual_pct > 2 ? '#c0392b' : mort.tasa_mensual_pct > 1 ? '#b8922a' : '#27613d');

  var gTasa = document.createElement('div');
  gTasa.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2px;background:rgba(26,22,18,.07);border:1px solid rgba(26,22,18,.1);margin-bottom:12px';
  gTasa.appendChild(makeCard30('Tasa 30 días', fmtPct(mort.tasa_mensual_pct), 'muertes ÷ (ingresos + stock)', tasaColor));
  gTasa.appendChild(makeCard30('Muertes 30 días', fmtN(mort.muertes_30d), 'cabezas fallecidas (>30d encierre)', '#c0392b'));
  el.appendChild(gTasa);

  var gDen = document.createElement('div');
  gDen.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:rgba(26,22,18,.05);border:1px solid rgba(26,22,18,.08);margin-bottom:36px';
  [{l:'Ingresos 30 días (filtrados)',v:fmtN(mort.ingresos_30d),s:'excl. DESTETE y TRASLADO'},
   {l:'Stock El Haras Hoy',v:fmtN(mort.stock_haras_hoy),s:'corrales 1-199'},
   {l:'Denominador',v:fmtN(mort.denominador),s:'ingresos + stock'}
  ].forEach(function(k){
    var d = document.createElement('div');
    d.style.cssText = 'background:white;padding:16px 20px';
    d.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:11px;text-transform:uppercase;color:rgba(26,22,18,.38);letter-spacing:.1em;margin-bottom:8px">'+k.l+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700">'+k.v+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.35);margin-top:4px">'+k.s+'</div>';
    gDen.appendChild(d);
  });
  el.appendChild(gDen);

  // ── Sección 2: Tasa por grupo 30 días ──
  var grpLbl = document.createElement('div');
  grpLbl.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:10px';
  grpLbl.textContent = 'Tasa de Mortandad por Grupo — 30 días';
  el.appendChild(grpLbl);

  var GRUPOS_V = ['Vacas','Machos','Hembras'];
  var GCOL_V   = {Vacas:'#7b3f2a', Machos:'#1a5276', Hembras:'#27613d'};
  var GICO_V   = {Vacas:'🐄', Machos:'🐂', Hembras:'🐮'};
  var grupoWrap = document.createElement('div');
  grupoWrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:rgba(26,22,18,.07);margin-bottom:36px';
  var pg = mort.por_grupo || {};
  GRUPOS_V.forEach(function(g) {
    var tg  = pg[g] || {};
    var tm  = tg.tasa_mensual_pct;
    var col = GCOL_V[g];
    var tc  = tm == null ? 'var(--gold)' : (tm > 2 ? '#c0392b' : tm > 1 ? '#b8922a' : '#27613d');
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:1px solid var(--border);padding:24px 28px;border-left:4px solid '+col;
    card.innerHTML =
      '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:10px">'+GICO_V[g]+' '+g+'</div>'
      +'<div style="font-family:\'Playfair Display\',serif;font-size:36px;font-weight:700;line-height:1;color:'+tc+'">'+fmtPct(tm)+'</div>'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.38);margin-top:5px">tasa 30 días</div>'
      +'<div style="border-top:1px solid rgba(26,22,18,.08);margin-top:14px;padding-top:10px;font-family:\'DM Mono\',monospace;font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px">'
      +'<span style="color:rgba(26,22,18,.4)">Muertes</span><span style="color:#c0392b;font-weight:700">'+fmtN(tg.muertes||0)+'</span>'
      +'<span style="color:rgba(26,22,18,.4)">Ingresos</span><span>'+fmtN(tg.ingresos||0)+'</span>'
      +'<span style="color:rgba(26,22,18,.4)">Stock</span><span>'+fmtN(tg.stock||0)+'</span>'
      +'<span style="color:rgba(26,22,18,.4)">Denominador</span><span>'+fmtN(tg.denominador||0)+'</span>'
      +'</div>';
    grupoWrap.appendChild(card);
  });
  el.appendChild(grupoWrap);

  // ── Sección 3: Por categoría 30 días ──
  var catsSorted30 = Object.entries(det.por_categoria||{}).sort(function(a,b){return b[1]-a[1];});
  var tot30 = det.total_muertes || 0;

  var g2_30 = document.createElement('div');
  g2_30.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2px;background:rgba(26,22,18,.07);border:1px solid rgba(192,57,43,.15);margin-bottom:32px';
  g2_30.appendChild(makeCard30('Total Muertes', fmtN(tot30), 'cabezas fallecidas en los últimos 30 días', '#c0392b'));
  g2_30.appendChild(makeCard30('Categoría Principal',
    catsSorted30[0] ? catsSorted30[0][0] : '—',
    catsSorted30[0] ? fmtN(catsSorted30[0][1])+' cabezas' : 'sin datos', '#b8922a'));
  el.appendChild(g2_30);

  if (catsSorted30.length) {
    var sC30 = document.createElement('div'); sC30.style.cssText = 'margin-bottom:48px';
    sC30.innerHTML = '<div class="section-header"><span class="section-title">Por Categoría — '+label+'</span></div>';
    var tC30 = document.createElement('table'); tC30.className = 'data-table';
    tC30.innerHTML = '<thead><tr><th>Categoría</th><th class="right">Muertes</th><th class="right">% del total</th></tr></thead>';
    var bC30 = document.createElement('tbody');
    catsSorted30.forEach(function(e) {
      var pct = tot30 > 0 ? (e[1]/tot30*100).toFixed(1) : '0.0';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+e[0]+'</strong></td>'
        +'<td class="right mono" style="color:#c0392b">'+fmtN(e[1])+'</td>'
        +'<td class="right mono">'+pct+'%</td>';
      bC30.appendChild(tr);
    });
    var rC30 = document.createElement('tr'); rC30.className = 'total';
    rC30.innerHTML = '<td><strong>TOTAL</strong></td><td class="right" style="color:#c0392b"><strong>'+fmtN(tot30)+'</strong></td><td class="right"><strong>100%</strong></td>';
    bC30.appendChild(rC30); tC30.appendChild(bC30); sC30.appendChild(tC30); el.appendChild(sC30);
  }
}


function initStock() {
  // Activar pestaña PEGSA por defecto
  var t = document.getElementById('stockTabPegsa');
  if (t) { t.classList.add('active'); }
  var tr = document.getElementById('stockTabResumen');
  if (tr) tr.classList.remove('active');
  cargarDesdeOneDrive();
}

// ─────────────────────────────────────────────────────────
//  MÓDULO MOVIMIENTOS PRODUCTIVOS
// ─────────────────────────────────────────────────────────
var _movData = null;

async function cargarMovimientos() {
  var content = document.getElementById('movContent');
  var loading = document.getElementById('movLoading');
  if (_movData) { renderMovimientos(_movData); return; }
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';
  try {
    var url = STOCK_SB + '/movimientos_' + STOCK_PER + '.json';
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _movData = await resp.json();
    if (loading) loading.style.display = 'none';
    renderMovimientos(_movData);
  } catch(e) {
    if (loading) loading.innerHTML =
      '<div style="padding:60px;text-align:center">'
      + '<div style="font-size:28px">&#9888;</div>'
      + '<div style="font-family:\'Playfair Display\',serif;font-size:18px;margin-top:12px">No se encontró movimientos_'+STOCK_PER+'.json</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.4);margin-top:8px">Ejecutá 2_EJECUTAR_AHORA.bat para generar el archivo</div>'
      + '</div>';
  }
}

function movFmt(n) { return Number(Math.round(n||0)).toLocaleString('es-AR'); }
function movFmtKg(n) { return Number(Math.round(n||0)).toLocaleString('es-AR') + ' kg'; }

// ── Modal torta categorías (global, una sola instancia) ──
var _pieOverlay = null;
function _initPieModal() {
  if (_pieOverlay) return;
  _pieOverlay = document.createElement('div');
  _pieOverlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(26,22,18,.55);z-index:9999;align-items:center;justify-content:center';
  _pieOverlay.addEventListener('click', function(e){ if(e.target===_pieOverlay) closePieModal(); });
  var box = document.createElement('div');
  box.style.cssText = 'background:#faf8f4;border-radius:4px;padding:32px 36px;max-width:520px;width:92%;position:relative;box-shadow:0 8px 40px rgba(0,0,0,.18)';
  var btnClose = document.createElement('button');
  btnClose.innerHTML = '&#10005;';
  btnClose.style.cssText = 'position:absolute;top:14px;right:16px;background:none;border:none;font-size:18px;cursor:pointer;color:rgba(26,22,18,.4);line-height:1';
  btnClose.onclick = function(){ closePieModal(); };
  box.appendChild(btnClose);
  var t = document.createElement('div'); t.id='_pieTitle';
  t.style.cssText='font-family:"Playfair Display",serif;font-size:17px;font-weight:700;margin-bottom:4px';
  box.appendChild(t);
  var s = document.createElement('div'); s.id='_pieSub';
  s.style.cssText='font-family:"DM Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:20px';
  box.appendChild(s);
  var b = document.createElement('div'); b.id='_pieBody';
  b.style.cssText='display:flex;gap:24px;align-items:flex-start';
  box.appendChild(b);
  _pieOverlay.appendChild(box);
  document.body.appendChild(_pieOverlay);
}

function openPieModal(nombre, total, porCat, accentColor, subtitulo) {
  _initPieModal();
  document.getElementById('_pieTitle').textContent = nombre;
  document.getElementById('_pieSub').textContent   = subtitulo + ' · ' + movFmt(total) + ' cab. totales';
  var body = document.getElementById('_pieBody');
  body.innerHTML = '';
  var cats   = Object.keys(porCat||{});
  var vals   = cats.map(function(c){ return porCat[c]; });
  var colors = ['#1a5276','#27613d','#7b3f2a','#b8922a','#5d4e75','#2e6b6b','#7a3535','#4a6741','#6b5a2e','#2e4a6b','#6b3a5a','#3a6b5a'];
  var tot    = vals.reduce(function(s,v){return s+v;},0)||1;
  // SVG donut
  var sz=160, cx=sz/2, cy=sz/2, r=68, ri=34;
  var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width',sz); svg.setAttribute('height',sz); svg.style.flexShrink='0';
  var ang = -Math.PI/2;
  cats.forEach(function(cat,i){
    var sl = vals[i]/tot*2*Math.PI; if(sl<0.001) return;
    var ea=ang+sl;
    var x1=cx+r*Math.cos(ang),y1=cy+r*Math.sin(ang),x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);
    var ix1=cx+ri*Math.cos(ang),iy1=cy+ri*Math.sin(ang),ix2=cx+ri*Math.cos(ea),iy2=cy+ri*Math.sin(ea);
    var lg=sl>Math.PI?1:0;
    var p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d','M '+ix1+' '+iy1+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+lg+' 1 '+x2+' '+y2+' L '+ix2+' '+iy2+' A '+ri+' '+ri+' 0 '+lg+' 0 '+ix1+' '+iy1+' Z');
    p.setAttribute('fill',colors[i%colors.length]); p.setAttribute('stroke','#faf8f4'); p.setAttribute('stroke-width','1.5');
    svg.appendChild(p); ang=ea;
  });
  var c=document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',ri-2);c.setAttribute('fill','#faf8f4');svg.appendChild(c);
  var tl=document.createElementNS('http://www.w3.org/2000/svg','text');
  tl.setAttribute('x',cx);tl.setAttribute('y',cy-5);tl.setAttribute('text-anchor','middle');
  tl.setAttribute('font-size','17');tl.setAttribute('font-weight','700');tl.setAttribute('fill','rgba(26,22,18,.85)');
  tl.setAttribute('font-family','DM Mono,monospace');tl.textContent=movFmt(tot);svg.appendChild(tl);
  var ts=document.createElementNS('http://www.w3.org/2000/svg','text');
  ts.setAttribute('x',cx);ts.setAttribute('y',cy+11);ts.setAttribute('text-anchor','middle');
  ts.setAttribute('font-size','8');ts.setAttribute('fill','rgba(26,22,18,.4)');
  ts.setAttribute('font-family','DM Mono,monospace');ts.setAttribute('letter-spacing','1');ts.textContent='CAB';svg.appendChild(ts);
  body.appendChild(svg);
  // Leyenda
  var leg=document.createElement('div'); leg.style.cssText='flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px';
  cats.forEach(function(cat,i){
    var pct=(vals[i]/tot*100).toFixed(1);
    var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px';
    var dot=document.createElement('div'); dot.style.cssText='width:10px;height:10px;border-radius:50%;flex-shrink:0;background:'+colors[i%colors.length];
    var txt=document.createElement('div'); txt.style.cssText='font-size:13px;flex:1;line-height:1.3';
    txt.innerHTML='<strong>'+cat+'</strong><br><span style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.5)">'+movFmt(vals[i])+' cab · '+pct+'%</span>';
    row.appendChild(dot); row.appendChild(txt); leg.appendChild(row);
  });
  body.appendChild(leg);
  _pieOverlay.style.display='flex';
}

function closePieModal() {
  if (_pieOverlay) _pieOverlay.style.display='none';
}

function renderMovimientos(data) {
  var el = document.getElementById('movContent');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = '';

  var meta      = data.meta || {};
  var anio      = data.anio || {};
  var ultMes    = data.ultimo_mes || {};
  var resAnio   = anio.resumen   || {};
  var resMes    = ultMes.resumen || {};
  var ingAnio   = anio.ingresos  || {};
  var egrAnio   = anio.egresos   || {};
  var ingMes    = ultMes.ingresos|| {};
  var egrMes    = ultMes.egresos || {};
  var nomMes    = ultMes.nombre  || meta.nombre_mes_ant || meta.nombre_mes || 'Mes anterior';
  var desde     = meta.desde_anio || '';

  // ── Encabezado ──
  var hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:36px;padding-bottom:18px;border-bottom:2px solid var(--border-strong)';
  hdr.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:6px">Movimientos Productivos</div>'
    +'<div style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:700">Ingresos & Egresos — Último año</div>'
    +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:4px">'
    +'v_PB_Ingresos · v_PB_Egresos · WinCampo FEEDLOT'
    +(desde ? ' &nbsp;·&nbsp; Desde: '+desde : '')
    +'</div>';
  el.appendChild(hdr);

  // ══════════════════════════════════════════════════════════
  // ── FILTRO DE MESES ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  var ingDet = (anio.ingresos  || {}).por_mes_detalle || {};
  var egrDet = (anio.egresos   || {}).por_mes_detalle || {};
  var todosMeses = Array.from(new Set(Object.keys(ingDet).concat(Object.keys(egrDet))))
    .filter(function(m){ return m !== 'Sin fecha'; }).sort();

  var MESES_LABEL = {
    '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun',
    '07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic'
  };
  function labelMes(m) {
    var p = m.split('-'); return (MESES_LABEL[p[1]] || p[1]) + ' ' + p[0];
  }

  // Estado del filtro (meses seleccionados)
  var selMeses = todosMeses.length ? [todosMeses[todosMeses.length - 1]] : [];

  // ── Panel de filtro ──
  var filtroPan = document.createElement('div');
  filtroPan.style.cssText = 'margin-bottom:32px;padding:20px 24px;background:#fff;border:1px solid rgba(26,22,18,.1);border-radius:2px';

  var filtroTit = document.createElement('div');
  filtroTit.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:12px';
  filtroTit.textContent = 'Filtrar por período';
  filtroPan.appendChild(filtroTit);

  // Botones rápidos
  var quickRow = document.createElement('div');
  quickRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px';

  function makeQuickBtn(label, meses) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;padding:5px 12px;border:1px solid rgba(26,22,18,.2);border-radius:2px;background:#fff;cursor:pointer;letter-spacing:.06em';
    b.addEventListener('click', function(){
      selMeses = meses.slice();
      actualizarFiltro();
    });
    return b;
  }

  // Botón: último mes
  if (todosMeses.length >= 1) {
    quickRow.appendChild(makeQuickBtn('Último mes', [todosMeses[todosMeses.length-1]]));
  }
  // Botón: últimos 3 meses
  if (todosMeses.length >= 3) {
    quickRow.appendChild(makeQuickBtn('Últimos 3 meses', todosMeses.slice(-3)));
  }
  // Botón: últimos 6 meses
  if (todosMeses.length >= 6) {
    quickRow.appendChild(makeQuickBtn('Últimos 6 meses', todosMeses.slice(-6)));
  }
  // Botón: todo el año
  quickRow.appendChild(makeQuickBtn('Todo el año', todosMeses.slice()));
  filtroPan.appendChild(quickRow);

  // Chips de meses individuales (multi-select)
  var chipsRow = document.createElement('div');
  chipsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  var chipEls = {};
  todosMeses.forEach(function(m) {
    var chip = document.createElement('button');
    chip.textContent = labelMes(m);
    chip.dataset.mes = m;
    chip.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;padding:5px 10px;border-radius:2px;cursor:pointer;transition:all .15s;letter-spacing:.04em';
    chip.addEventListener('click', function(){
      var idx = selMeses.indexOf(m);
      if (idx >= 0) {
        if (selMeses.length > 1) selMeses.splice(idx, 1);
      } else {
        selMeses.push(m);
        selMeses.sort();
      }
      actualizarFiltro();
    });
    chipEls[m] = chip;
    chipsRow.appendChild(chip);
  });
  filtroPan.appendChild(chipsRow);

  // Label resultado
  var filtroRes = document.createElement('div');
  filtroRes.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.4);margin-top:10px';
  filtroPan.appendChild(filtroRes);

  el.appendChild(filtroPan);

  // Contenedor dinámico del filtro
  var filtroContent = document.createElement('div');
  filtroContent.id = 'movFiltroContent';
  el.appendChild(filtroContent);

  // ── Función helper: agregar dicts de {cabezas,kg} ──
  function sumarGrupos(dictsArray) {
    var res = {};
    dictsArray.forEach(function(d) {
      Object.keys(d).forEach(function(k) {
        if (!res[k]) res[k] = {cabezas:0, kg:0};
        res[k].cabezas += (d[k].cabezas || 0);
        res[k].kg      += (d[k].kg      || 0);
      });
    });
    // calcular kg_promedio
    Object.keys(res).forEach(function(k) {
      res[k].cabezas    = Math.round(res[k].cabezas);
      res[k].kg         = Math.round(res[k].kg * 10) / 10;
      res[k].kg_promedio = res[k].cabezas > 0 ? Math.round(res[k].kg / res[k].cabezas * 10)/10 : 0;
    });
    return res;
  }

  // ── Función principal que redibuja al cambiar selección ──
  function actualizarFiltro() {
    // Actualizar estilo de chips
    todosMeses.forEach(function(m) {
      var activo = selMeses.indexOf(m) >= 0;
      chipEls[m].style.background = activo ? 'rgba(26,22,18,.85)' : '#fff';
      chipEls[m].style.color      = activo ? '#fff' : 'rgba(26,22,18,.7)';
      chipEls[m].style.border     = activo ? '1px solid rgba(26,22,18,.85)' : '1px solid rgba(26,22,18,.2)';
    });

    // Label período
    if (selMeses.length === 1) {
      filtroRes.textContent = 'Período: ' + labelMes(selMeses[0]);
    } else {
      filtroRes.textContent = 'Período: ' + labelMes(selMeses[0]) + ' → ' + labelMes(selMeses[selMeses.length-1]) + ' (' + selMeses.length + ' meses)';
    }

    // Agregar datos de los meses seleccionados
    var ingCat  = sumarGrupos(selMeses.map(function(m){ return (ingDet[m]||{}).por_categoria   || {}; }));
    var ingProp = sumarGrupos(selMeses.map(function(m){ return (ingDet[m]||{}).por_propietario || {}; }));
    var egrCat  = sumarGrupos(selMeses.map(function(m){ return (egrDet[m]||{}).por_categoria   || {}; }));
    var egrProp = sumarGrupos(selMeses.map(function(m){ return (egrDet[m]||{}).por_propietario || {}; }));

    // Totales
    var totIngCab = Object.values(ingDet).filter(function(_,i){ return selMeses.indexOf(todosMeses[i]) >= 0; });
    var ingTotCab = selMeses.reduce(function(s,m){ return s + ((ingDet[m]||{}).cabezas||0); }, 0);
    var ingTotKg  = selMeses.reduce(function(s,m){ return s + ((ingDet[m]||{}).kg||0); }, 0);
    var egrTotCab = selMeses.reduce(function(s,m){ return s + ((egrDet[m]||{}).cabezas||0); }, 0);
    var egrTotKg  = selMeses.reduce(function(s,m){ return s + ((egrDet[m]||{}).kg||0); }, 0);
    var saldoCab  = ingTotCab - egrTotCab;
    var saldoKg   = ingTotKg  - egrTotKg;

    // Construir HTML del panel filtrado
    var fc = filtroContent;
    fc.innerHTML = '';

    // KPIs resumen del período
    var kpiPer = document.createElement('div');
    kpiPer.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:rgba(26,22,18,.07);border:1px solid rgba(184,146,42,.25);margin-bottom:32px';
    function kpiCell(label, val, sub, color) {
      var c = document.createElement('div');
      c.style.cssText = 'background:#fff;padding:18px 22px;border-left:3px solid '+(color||'transparent');
      c.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:6px">'+label+'</div>'
        +'<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;line-height:1'+(color?';color:'+color:'')+'">'+(val||'—')+'</div>'
        +'<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.38);margin-top:4px">'+sub+'</div>';
      return c;
    }
    kpiPer.appendChild(kpiCell('Ingresos', movFmt(ingTotCab)+' cab', movFmtKg(ingTotKg), '#27613d'));
    kpiPer.appendChild(kpiCell('Egresos',  movFmt(egrTotCab)+' cab', movFmtKg(egrTotKg), '#c0392b'));
    kpiPer.appendChild(kpiCell('Saldo',    (saldoCab>=0?'+':'')+movFmt(saldoCab)+' cab', (saldoKg>=0?'+':'')+movFmtKg(saldoKg), saldoCab>=0?'#27613d':'#c0392b'));
    fc.appendChild(kpiPer);

    // ── Tablas por categoría y propietario ──
    var hasCatDet  = Object.keys(ingCat).length  > 0 || Object.keys(egrCat).length  > 0;
    var hasPropDet = Object.keys(ingProp).length > 0 || Object.keys(egrProp).length > 0;

    if (hasCatDet || hasPropDet) {
      // Dos columnas: Ingresos | Egresos
      var cols2 = document.createElement('div');
      cols2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px';

      function panelDet(titulo, colorBorder, catObj, propObj) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'padding:20px 22px;border:1px solid rgba(26,22,18,.1);border-left:4px solid '+colorBorder+';border-radius:2px;background:#fff';
        wrap.innerHTML = '<div style="font-family:\'Playfair Display\',serif;font-size:16px;font-weight:700;margin-bottom:16px;color:'+colorBorder+'">'+titulo+'</div>';

        function miniTabla(label, obj) {
          if (!Object.keys(obj).length) {
            wrap.innerHTML += '<div style="font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(26,22,18,.35);margin-bottom:12px">'+label+': sin detalle (disponible al correr pipeline)</div>';
            return;
          }
          var arr = Object.entries(obj).sort(function(a,b){ return (b[1].cabezas||0)-(a[1].cabezas||0); });
          var totC = arr.reduce(function(s,e){ return s+(e[1].cabezas||0); },0);
          var tbl = '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:6px;margin-top:14px">'+label+'</div>';
          tbl += '<table class="data-table" style="font-size:12px"><thead><tr><th>'+label+'</th><th class="right">Cab.</th><th class="right">%</th><th class="right">Kg prom.</th></tr></thead><tbody>';
          arr.forEach(function(e) {
            var pct = totC > 0 ? (e[1].cabezas/totC*100).toFixed(1) : '0.0';
            tbl += '<tr><td><strong>'+e[0]+'</strong></td>'
              +'<td class="right mono">'+movFmt(e[1].cabezas)+'</td>'
              +'<td class="right mono">'+pct+'%</td>'
              +'<td class="right mono">'+movFmtKg(e[1].kg_promedio)+'</td></tr>';
          });
          tbl += '<tr class="total"><td><strong>Total</strong></td><td class="right"><strong>'+movFmt(totC)+'</strong></td><td class="right"><strong>100%</strong></td><td class="right">—</td></tr>';
          tbl += '</tbody></table>';
          wrap.innerHTML += tbl;
        }

        miniTabla('Por Categoría',   catObj);
        miniTabla('Por Propietario', propObj);
        return wrap;
      }

      cols2.appendChild(panelDet('↑ Ingresos', '#27613d', ingCat, ingProp));
      cols2.appendChild(panelDet('↓ Egresos',  '#c0392b', egrCat, egrProp));
      fc.appendChild(cols2);
    } else {
      // Sin detalle aún — mostrar aviso
      var aviso = document.createElement('div');
      aviso.style.cssText = 'padding:20px;background:rgba(26,22,18,.03);border:1px solid rgba(26,22,18,.08);border-radius:2px;font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.45);margin-bottom:32px';
      aviso.innerHTML = '📋 El detalle por categoría y propietario estará disponible a partir de la próxima actualización del pipeline (requiere reconectar con SQL Server).';
      fc.appendChild(aviso);
    }

    // ── Evolución mensual del período seleccionado ──
    if (selMeses.length > 1) {
      var secEvo = document.createElement('div');
      secEvo.style.cssText = 'margin-bottom:32px';
      secEvo.innerHTML = '<div class="section-header"><span class="section-title">Evolución del período</span><span class="section-sub">mes a mes · ingresos vs egresos</span></div>';
      var tEvo = document.createElement('table'); tEvo.className = 'data-table';
      tEvo.innerHTML = '<thead><tr><th>Mes</th><th class="right">Cab. Ingr.</th><th class="right">Kg Ingr.</th><th class="right">Cab. Egr.</th><th class="right">Kg Egr.</th><th class="right">Saldo Cab.</th></tr></thead>';
      var tbEvo = document.createElement('tbody');
      var totIC2=0,totIK2=0,totEC2=0,totEK2=0;
      selMeses.forEach(function(m) {
        var ii = ingDet[m] || {cabezas:0,kg:0};
        var ee = egrDet[m] || {cabezas:0,kg:0};
        var dc = (ii.cabezas||0) - (ee.cabezas||0);
        totIC2+=ii.cabezas||0; totIK2+=ii.kg||0; totEC2+=ee.cabezas||0; totEK2+=ee.kg||0;
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><strong>'+labelMes(m)+'</strong></td>'
          +'<td class="right mono">'+movFmt(ii.cabezas)+'</td>'
          +'<td class="right mono" style="color:#27613d">'+movFmtKg(ii.kg)+'</td>'
          +'<td class="right mono">'+movFmt(ee.cabezas)+'</td>'
          +'<td class="right mono" style="color:#c0392b">'+movFmtKg(ee.kg)+'</td>'
          +'<td class="right mono" style="color:'+(dc>=0?'#27613d':'#c0392b')+';font-weight:600">'+(dc>=0?'+':'')+movFmt(dc)+'</td>';
        tbEvo.appendChild(tr);
      });
      var tfEvo = document.createElement('tr'); tfEvo.className='total';
      var sd2=totIC2-totEC2;
      tfEvo.innerHTML='<td><strong>TOTAL</strong></td>'
        +'<td class="right"><strong>'+movFmt(totIC2)+'</strong></td>'
        +'<td class="right"><strong>'+movFmtKg(totIK2)+'</strong></td>'
        +'<td class="right"><strong>'+movFmt(totEC2)+'</strong></td>'
        +'<td class="right"><strong>'+movFmtKg(totEK2)+'</strong></td>'
        +'<td class="right" style="color:'+(sd2>=0?'#27613d':'#c0392b')+';font-size:14px"><strong>'+(sd2>=0?'+':'')+movFmt(sd2)+'</strong></td>';
      tbEvo.appendChild(tfEvo);
      tEvo.appendChild(tbEvo);
      secEvo.appendChild(tEvo);
      fc.appendChild(secEvo);
    }

    // Divisor antes del bloque anual existente
    var div = document.createElement('hr');
    div.style.cssText = 'border:none;border-top:2px solid var(--border-strong);margin:32px 0 36px';
    fc.appendChild(div);
    var lblAnual = document.createElement('div');
    lblAnual.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.35);margin-bottom:20px';
    lblAnual.textContent = '▸ Resumen anual (últimos 12 meses) a continuación';
    fc.appendChild(lblAnual);
  }

  // Inicializar con último mes seleccionado
  actualizarFiltro();

  // ── Helper: construir una grilla de 3 cards KPI ──
  function makeKpiRow(kpis, borderColor) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:rgba(26,22,18,.07);border:1px solid '+(borderColor||'var(--border-strong)')+';margin-bottom:2px';
    kpis.forEach(function(k) {
      var cell = document.createElement('div');
      cell.style.cssText = 'background:white;padding:20px 24px;border-left:3px solid '+(borderColor||'transparent');
      cell.innerHTML =
        '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:8px">'+k.label+'</div>'
        +'<div style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:700;line-height:1'+(k.color?';color:'+k.color:'')+'">'+(k.val||'—')+'</div>'
        +'<div style="font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.38);margin-top:5px">'+k.sub+'</div>';
      wrap.appendChild(cell);
    });
    return wrap;
  }

  // ── KPIs ANIO: fila ingresos (verde) + fila egresos (roja) ──
  var secKpi = document.createElement('div');
  secKpi.style.cssText = 'margin-bottom:40px';

  var lblAnio = document.createElement('div');
  lblAnio.style.cssText = 'font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:10px';
  lblAnio.textContent = 'Últimos 12 meses';
  secKpi.appendChild(lblAnio);

  secKpi.appendChild(makeKpiRow([
    { label:'Cabezas Ingresadas', val: movFmt(resAnio.cabezas_ingresadas),  sub: movFmtKg(resAnio.kg_ingresado),      color:'#27613d' },
    { label:'Kg Ingresados',      val: movFmtKg(resAnio.kg_ingresado),      sub: movFmt(resAnio.cabezas_ingresadas)+' cabezas', color:'' },
    { label:'Kg Prom. Ingreso',   val: movFmtKg(resAnio.kg_promedio_ingreso), sub:'por cabeza al ingreso',            color:'' },
  ], 'rgba(39,97,61,.3)'));

  secKpi.appendChild(makeKpiRow([
    { label:'Cabezas Egresadas',  val: movFmt(resAnio.cabezas_egresadas),   sub: movFmtKg(resAnio.kg_egresado),       color:'#c0392b' },
    { label:'Kg Egresados',       val: movFmtKg(resAnio.kg_egresado),       sub: movFmt(resAnio.cabezas_egresadas)+' cabezas', color:'' },
    { label:'Kg Prom. Egreso',    val: movFmtKg(resAnio.kg_promedio_egreso), sub:'por cabeza al egreso',              color:'' },
  ], 'rgba(192,57,43,.3)'));

  el.appendChild(secKpi);

  // ── Bloque MES ACTUAL ──
  var secMes = document.createElement('div');
  secMes.style.cssText = 'margin-bottom:48px;padding:24px 28px;background:rgba(184,146,42,.05);border:1px solid rgba(184,146,42,.2);border-left:4px solid var(--gold);border-radius:2px';

  var lblMes = document.createElement('div');
  lblMes.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:4px">Resumen del mes</div>'
    +'<div style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;margin-bottom:16px">'+nomMes+'</div>';
  secMes.appendChild(lblMes);

  var sinDatosMes = (resMes.cabezas_ingresadas === 0 && resMes.cabezas_egresadas === 0);
  if (sinDatosMes) {
    var aviso = document.createElement('div');
    aviso.style.cssText = 'padding:20px 0;font-family:\'DM Mono\',monospace;font-size:13px;color:rgba(26,22,18,.38);letter-spacing:.06em';
    aviso.textContent = 'Sin movimientos registrados en ' + nomMes + ' aún.';
    secMes.appendChild(aviso);
  } else {
    secMes.appendChild(makeKpiRow([
      { label:'Cabezas Ingresadas', val: movFmt(resMes.cabezas_ingresadas),    sub: movFmtKg(resMes.kg_ingresado),       color:'#27613d' },
      { label:'Kg Ingresados',      val: movFmtKg(resMes.kg_ingresado),        sub: movFmt(resMes.cabezas_ingresadas)+' cabezas', color:'' },
      { label:'Kg Prom. Ingreso',   val: movFmtKg(resMes.kg_promedio_ingreso), sub:'por cabeza',                         color:'' },
    ], 'rgba(39,97,61,.2)'));
    var gap2 = document.createElement('div'); gap2.style.height = '2px';
    secMes.appendChild(gap2);
    secMes.appendChild(makeKpiRow([
      { label:'Cabezas Egresadas',  val: movFmt(resMes.cabezas_egresadas),     sub: movFmtKg(resMes.kg_egresado),        color:'#c0392b' },
      { label:'Kg Egresados',       val: movFmtKg(resMes.kg_egresado),         sub: movFmt(resMes.cabezas_egresadas)+' cabezas', color:'' },
      { label:'Kg Prom. Egreso',    val: movFmtKg(resMes.kg_promedio_egreso),  sub:'por cabeza',                         color:'' },
    ], 'rgba(192,57,43,.2)'));
  }

  el.appendChild(secMes);

  // ── Función genérica para tabla de agrupación ──
  function renderTabla(titulo, grupos) {
    if (!grupos || !Object.keys(grupos).length) return null;
    var arr = Object.entries(grupos).sort(function(a,b){ return (b[1].cabezas||0)-(a[1].cabezas||0); });
    var totCab = arr.reduce(function(s,e){ return s+(e[1].cabezas||0); }, 0);
    var totKg  = arr.reduce(function(s,e){ return s+(e[1].kg||0); }, 0);

    var sec = document.createElement('div');
    sec.style.cssText = 'margin-bottom:36px';
    sec.innerHTML = '<div class="section-header"><span class="section-title">'+titulo+'</span></div>';

    var tbl = document.createElement('table');
    tbl.className = 'data-table';
    tbl.innerHTML = '<thead><tr><th>'+titulo+'</th><th class="right">Cabezas</th><th class="right">%</th><th class="right">Kilogramos</th><th class="right">Kg / Cab</th></tr></thead>';
    var tb = document.createElement('tbody');

    arr.forEach(function(entry) {
      var nombre = entry[0], d = entry[1];
      var pct = totCab > 0 ? (d.cabezas/totCab*100).toFixed(1) : '0.0';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+nombre+'</strong></td>'
        +'<td class="right mono">'+movFmt(d.cabezas)+'</td>'
        +'<td class="right mono">'+pct+'%</td>'
        +'<td class="right mono" style="color:#27613d">'+movFmtKg(d.kg)+'</td>'
        +'<td class="right mono">'+movFmtKg(d.kg_promedio)+'</td>';
      tb.appendChild(tr);
    });

    var tf = document.createElement('tr'); tf.className = 'total';
    tf.innerHTML = '<td><strong>TOTAL</strong></td>'
      +'<td class="right"><strong>'+movFmt(totCab)+'</strong></td>'
      +'<td class="right"><strong>100%</strong></td>'
      +'<td class="right"><strong>'+movFmtKg(totKg)+'</strong></td>'
      +'<td class="right">—</td>';
    tb.appendChild(tf);
    tbl.appendChild(tb);
    sec.appendChild(tbl);
    return sec;
  }

  // ── Función evolución mensual ──
  function renderMeses(ingMeses, egrMeses) {
    var meses = Array.from(new Set(Object.keys(ingMeses||{}).concat(Object.keys(egrMeses||{})))).filter(function(m){ return m !== 'Sin fecha'; }).sort();
    if (!meses.length) return null;
    var sec = document.createElement('div');
    sec.style.cssText = 'margin-bottom:40px';
    sec.innerHTML = '<div class="section-header"><span class="section-title">Evolución Mensual</span><span class="section-sub">Ingresos vs Egresos · último año</span></div>';
    var tbl = document.createElement('table');
    tbl.className = 'data-table';
    tbl.innerHTML = '<thead><tr><th>Mes</th><th class="right">Cab. Ingr.</th><th class="right">Kg Ingr.</th><th class="right">Cab. Egr.</th><th class="right">Kg Egr.</th><th class="right">Saldo Cab.</th><th class="right">Saldo Kg</th></tr></thead>';
    var tb = document.createElement('tbody');
    var totIC=0,totIK=0,totEC=0,totEK=0;
    meses.forEach(function(m) {
      var ii = ingMeses[m]||{cabezas:0,kg:0};
      var ee = egrMeses[m]||{cabezas:0,kg:0};
      var dCab = (ii.cabezas||0)-(ee.cabezas||0);
      var dKg  = (ii.kg||0)-(ee.kg||0);
      totIC+=ii.cabezas||0; totIK+=ii.kg||0; totEC+=ee.cabezas||0; totEK+=ee.kg||0;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>'+m+'</strong></td>'
        +'<td class="right mono">'+movFmt(ii.cabezas)+'</td>'
        +'<td class="right mono" style="color:#27613d">'+movFmtKg(ii.kg)+'</td>'
        +'<td class="right mono">'+movFmt(ee.cabezas)+'</td>'
        +'<td class="right mono" style="color:#c0392b">'+movFmtKg(ee.kg)+'</td>'
        +'<td class="right mono" style="color:'+(dCab>=0?'#27613d':'#c0392b')+';font-weight:600">'+(dCab>=0?'+':'')+movFmt(dCab)+'</td>'
        +'<td class="right mono" style="color:'+(dKg>=0?'#27613d':'#c0392b')+';font-weight:600">'+(dKg>=0?'+':'')+movFmtKg(dKg)+'</td>';
      tb.appendChild(tr);
    });
    var tf = document.createElement('tr'); tf.className = 'total';
    var sdC = totIC-totEC, sdK = totIK-totEK;
    tf.innerHTML = '<td><strong>TOTAL</strong></td>'
      +'<td class="right"><strong>'+movFmt(totIC)+'</strong></td>'
      +'<td class="right"><strong>'+movFmtKg(totIK)+'</strong></td>'
      +'<td class="right"><strong>'+movFmt(totEC)+'</strong></td>'
      +'<td class="right"><strong>'+movFmtKg(totEK)+'</strong></td>'
      +'<td class="right" style="color:'+(sdC>=0?'#27613d':'#c0392b')+';font-size:15px"><strong>'+(sdC>=0?'+':'')+movFmt(sdC)+'</strong></td>'
      +'<td class="right" style="color:'+(sdK>=0?'#27613d':'#c0392b')+';font-size:15px"><strong>'+(sdK>=0?'+':'')+movFmtKg(sdK)+'</strong></td>';
    tb.appendChild(tf);
    tbl.appendChild(tb);
    sec.appendChild(tbl);
    return sec;
  }

  // ── Bloque INGRESOS (sin establecimiento) ──
  var divIng = document.createElement('div');
  divIng.style.cssText = 'margin-bottom:48px;padding:28px 32px;background:rgba(39,97,61,.03);border:1px solid rgba(39,97,61,.12);border-left:4px solid #27613d;border-radius:2px';
  divIng.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#27613d;margin-bottom:4px">Detalle · Último año</div>'
    +'<div style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;margin-bottom:20px">&#8593; Ingresos al Feedlot</div>';
  var tI1 = renderTabla('Por Propietario', ingAnio.por_propietario||{});
  var tI2 = renderTabla('Por Categor\u00eda',  ingAnio.por_categoria||{});
  if (tI1) divIng.appendChild(tI1);
  if (tI2) divIng.appendChild(tI2);

  // ── Top 10 Proveedores (Ingresos) ──
  var top10prov = ingAnio.top10_origen || [];
  if (top10prov.length) {
    var maxProv = top10prov[0].cabezas;
    var secProv = document.createElement('div'); secProv.style.cssText = 'margin-bottom:24px';
    secProv.innerHTML = '<div class="section-header"><span class="section-title">Top 10 Proveedores</span><span class="section-sub">mayor cantidad de cabezas ingresadas · último año</span></div>';
    var tProv = document.createElement('table'); tProv.className = 'data-table';
    tProv.innerHTML = '<thead><tr><th>#</th><th>Proveedor / Origen</th><th class="right">Cabezas</th><th style="width:200px">Participación</th></tr></thead>';
    var bProv = document.createElement('tbody');
    var totProv = top10prov.reduce(function(s,r){return s+r.cabezas;},0);
    top10prov.forEach(function(r,i) {
      var pct  = totProv>0 ? (r.cabezas/totProv*100).toFixed(1) : '0.0';
      var barW = maxProv>0 ? (r.cabezas/maxProv*100).toFixed(1) : '0';
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Ver desglose por categoría';
      tr.innerHTML = '<td style="color:rgba(26,22,18,.4);font-family:DM Mono,monospace;font-size:13px;width:32px">'+(i+1)+'</td>'
        +'<td><strong>'+r.nombre+'</strong> <span style="font-size:12px;color:rgba(26,22,18,.3)">&#9656;</span></td>'
        +'<td class="right mono" style="color:#27613d;font-weight:700">'+movFmt(r.cabezas)+'</td>'
        +'<td style="padding:6px 16px;vertical-align:middle">'
          +'<div style="display:flex;align-items:center;gap:8px">'
            +'<div style="flex:1;background:rgba(26,22,18,.07);border-radius:2px;height:12px">'
              +'<div style="background:#27613d;height:100%;width:'+barW+'%;border-radius:2px"></div>'
            +'</div>'
            +'<span style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.5);width:36px;text-align:right">'+pct+'%</span>'
          +'</div>'
        +'</td>';
      (function(row){ tr.addEventListener('click', function(){
        openPieModal(row.nombre, row.cabezas, row.por_categoria||{}, '#27613d', 'Ingresos por categoría');
      }); })(r);
      bProv.appendChild(tr);
    });
    tProv.appendChild(bProv); secProv.appendChild(tProv); divIng.appendChild(secProv);
  }
  el.appendChild(divIng);

  // ── Bloque EGRESOS ──
  var divEgr = document.createElement('div');
  divEgr.style.cssText = 'margin-bottom:48px;padding:28px 32px;background:rgba(192,57,43,.03);border:1px solid rgba(192,57,43,.12);border-left:4px solid #c0392b;border-radius:2px';
  divEgr.innerHTML =
    '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#c0392b;margin-bottom:4px">Detalle · Último año</div>'
    +'<div style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;margin-bottom:20px">&#8595; Egresos del Feedlot</div>';
  var tE1 = renderTabla('Por Propietario',    egrAnio.por_propietario||{});
  var tE2 = renderTabla('Por Categor\u00eda', egrAnio.por_categoria||{});
  if (tE1) divEgr.appendChild(tE1);
  if (tE2) divEgr.appendChild(tE2);

  // ── Top 10 Destinos de Venta (Egresos) ──
  var top10dest = egrAnio.top10_destino || [];
  if (top10dest.length) {
    var maxDest = top10dest[0].cabezas;
    var secDest = document.createElement('div'); secDest.style.cssText = 'margin-bottom:24px';
    secDest.innerHTML = '<div class="section-header"><span class="section-title">Top 10 Destinos de Venta</span><span class="section-sub">mayor cantidad de cabezas vendidas · último año</span></div>';
    var tDest = document.createElement('table'); tDest.className = 'data-table';
    tDest.innerHTML = '<thead><tr><th>#</th><th>Frigorífico / Destino</th><th class="right">Cabezas</th><th style="width:200px">Participación</th></tr></thead>';
    var bDest = document.createElement('tbody');
    var totDest = top10dest.reduce(function(s,r){return s+r.cabezas;},0);
    top10dest.forEach(function(r,i) {
      var pct  = totDest>0 ? (r.cabezas/totDest*100).toFixed(1) : '0.0';
      var barW = maxDest>0 ? (r.cabezas/maxDest*100).toFixed(1) : '0';
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Ver desglose por categoría';
      tr.innerHTML = '<td style="color:rgba(26,22,18,.4);font-family:DM Mono,monospace;font-size:13px;width:32px">'+(i+1)+'</td>'
        +'<td><strong>'+r.nombre+'</strong> <span style="font-size:12px;color:rgba(26,22,18,.3)">&#9656;</span></td>'
        +'<td class="right mono" style="color:#c0392b;font-weight:700">'+movFmt(r.cabezas)+'</td>'
        +'<td style="padding:6px 16px;vertical-align:middle">'
          +'<div style="display:flex;align-items:center;gap:8px">'
            +'<div style="flex:1;background:rgba(26,22,18,.07);border-radius:2px;height:12px">'
              +'<div style="background:#c0392b;height:100%;width:'+barW+'%;border-radius:2px"></div>'
            +'</div>'
            +'<span style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.5);width:36px;text-align:right">'+pct+'%</span>'
          +'</div>'
        +'</td>';
      (function(row){ tr.addEventListener('click', function(){
        openPieModal(row.nombre, row.cabezas, row.por_categoria||{}, '#c0392b', 'Egresos por categoría');
      }); })(r);
      bDest.appendChild(tr);
    });
    tDest.appendChild(bDest); secDest.appendChild(tDest); divEgr.appendChild(secDest);
  }
  el.appendChild(divEgr);

  // ── Evolución mensual ──
  var tMes = renderMeses(ingAnio.por_mes||{}, egrAnio.por_mes||{});
  if (tMes) el.appendChild(tMes);

  // ── Nota filtros ──
  if (meta.filtros) {
    var nota = document.createElement('div');
    nota.style.cssText = 'margin-top:24px;padding:10px 14px;background:rgba(184,146,42,.07);border-left:3px solid var(--gold);font-family:\'DM Mono\',monospace;font-size:12px;color:rgba(26,22,18,.45)';
    nota.textContent = '\u24d8 ' + meta.filtros;
    el.appendChild(nota);
  }
}
