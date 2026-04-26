/* modulo-01-resultados.js — Estado de Resultados · navegación, modales, charts · 2026-04-25 */

const MAIN_TABS = ['centros', 'consolidado', 'flujo'];

// ── Navigation ────────────────────────────────────────────────────────────
function showMain(name, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (el) {
    el.classList.add('active');
  } else {
    document.querySelectorAll('.nav-tab').forEach(t => {
      if ((name === 'centros' && t.textContent.includes('Centros')) ||
          (name === 'consolidado' && t.textContent.includes('Consolidado')) ||
          (name === 'flujo' && t.textContent.includes('Flujo'))) {
        t.classList.add('active');
      }
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDetail(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Render in-panel charts after tab shows
  setTimeout(() => renderPanelChart(name), 80);
}

// Animate bars on load
window.addEventListener('load', () => {
  document.querySelectorAll('.bar').forEach(b => {
    const w = b.style.width;
    b.style.width = '0';
    setTimeout(() => { b.style.width = w; }, 300);
  });
  renderConsolidadoChart();
});

// ── Colour palette ────────────────────────────────────────────────────────
const PALETTE = [
  '#27613d','#b8922a','#3d4a5c','#6bc47a','#d4a84b','#5a7a8a',
  '#a3c97e','#e8c56a','#8fabbf','#c0392b','#7d5a3c','#e88b4a'
];
const GREEN = '#27613d'; const RED = '#c0392b'; const GOLD = '#b8922a';

// ── Chart data per centre ─────────────────────────────────────────────────
const CENTRO_DATA = {
  ganaderia: {
    title: 'Ganadería',
    sub: 'Composición ingresos vs egresos operativos',
    type: 'ingEgr',
    ing: 27022178029, eg: 25923525853, tenencia: 5825445437,
    ingItems: [
      { label:'Venta de Hacienda', v:27022178029 },
    ],
    egItems: [
      { label:'Compra Hacienda', v:17164354898 },
      { label:'Hotelería', v:7937591578 },
      { label:'Dif. Inventario Histórico', v:-1765338486 },
      { label:'Fletes Venta', v:616769516 },
      { label:'Comisiones', v:472252404 },
      { label:'Movimientos Pagados', v:527058349 },
      { label:'Fletes Compra', v:318720728 },
      { label:'Gastos Manejo', v:352339532 },
      { label:'Resto', v:312789746 },
    ],
    donut: [
      { label:'Resultado Operativo', v:1098652176, color:GREEN },
      { label:'Tenencia Hacienda', v:5825445437, color:GOLD },
      { label:'Total Egresos (referencia)', v:25923525853, color:'#ddd' },
    ],
    footerL: 'Ingresos: $27.022 M',
    footerR: 'Resultado neto: +$6.924 M',
  },
  feedlot: {
    title: 'Feedlot',
    sub: 'Composición por área de negocio',
    type: 'subareas',
    donut: [
      { label:'Alimentación', v:1860648132, color:GREEN },
      { label:'Sanidad', v:36111360, color:GOLD },
      { label:'Estructura El Haras', v:10091233, color:'#3d4a5c' },
    ],
    footerL: 'Ingresos totales: $10.911 M',
    footerR: 'Resultado: +$1.907 M (17,48%)',
  },
  consignataria: {
    title: 'Consignataria Bulltrade',
    sub: 'Composición de ingresos',
    type: 'ingItems',
    donut: [
      { label:'Adm. Consig. Bull', v:428902936, color:GREEN },
      { label:'Adm. Bull', v:576799026, color:GOLD },
      { label:'Financiero Bull', v:168117966, color:'#3d4a5c' },
      { label:'ADM Financiera PEGSA', v:3845086, color:'#6bc47a' },
    ],
    footerL: 'Ingresos: $748 M',
    footerR: 'Resultado: +$396 M (52,96%)',
  },
  campos: {
    title: 'Campos',
    sub: 'Resultado neto por campo',
    type: 'campos',
    donut: [
      { label:'Don Pedro', v:97805467, color:GREEN },
      { label:'El Coloradito', v:287792591, color:GOLD },
      { label:'El Descanso', v:76625626, color:'#3d4a5c' },
      { label:'El Haras', v:-1979270, color:RED },
      { label:'El Tacurú', v:-168234095, color:'#c07030' },
    ],
    footerL: 'Ingresos: $668 M',
    footerR: 'Resultado: +$292 M (43,65%)',
  },
  agricultura: {
    title: 'Agricultura 24/25',
    sub: 'Composición de ingresos y resultado',
    type: 'ingItems',
    donut: [
      { label:'Venta de Soja', v:1205945602, color:GREEN },
      { label:'Fibra y Grano', v:1209001357, color:GOLD },
      { label:'Maíz Silo Futuro', v:173891540, color:'#3d4a5c' },
    ],
    footerL: 'Ingresos: $2.588 M',
    footerR: 'Resultado neto c/ten.: +$173 M',
  },
  transporte: {
    title: 'Transporte',
    sub: 'Composición de ingresos por vehículo',
    type: 'ingItems',
    donut: [
      { label:'FIAT IVECO 330', v:62843019, color:GREEN },
      { label:'MERCEDES BENZ 1634', v:97642236, color:GOLD },
    ],
    footerL: 'Ingresos: $160 M',
    footerR: 'Resultado: +$61,8 M (38,55%)',
  },
  donpedro: {
    title: 'Don Pedro',
    sub: 'Composición de egresos',
    type: 'egItems',
    donut: [
      { label:'Ingresos Estructura', v:513910492, color:GREEN },
      { label:'MP / Insumos Feedlo', v:221969137, color:RED },
      { label:'Arrendamientos', v:127983352, color:'#c07030' },
      { label:'Kilos Don Pedro', v:288608557, color:GOLD },
      { label:'Otros costos', v:118198963, color:'#3d4a5c' },
    ],
    footerL: 'Egresos: -$468 M · Tenencia: +$254 M',
    footerR: 'Resultado neto: +$45 M',
  },
  administracion: {
    title: 'Administración',
    sub: 'Composición de egresos',
    type: 'egItems',
    donut: [
      { label:'Ret. Ganancias Sufridas', v:446283616, color:RED },
      { label:'Sueldos Brutos', v:77970462, color:'#c07030' },
      { label:'Honorarios Prof.', v:33510500, color:GOLD },
      { label:'Gtos. Cómputo y Sistemas', v:17307915, color:'#3d4a5c' },
      { label:'Otros gastos', v:33109360, color:'#8fabbf' },
    ],
    footerL: 'Centro puro de costos',
    footerR: 'Resultado: -$608 M',
  },
  equinos: {
    title: 'Equinos',
    sub: 'Centro de costo mínimo',
    type: 'egItems',
    donut: [
      { label:'Honorarios Veterinario', v:920000, color:RED },
    ],
    footerL: 'Un solo egreso en el período',
    footerR: 'Resultado: -$920.000',
  },
};

// ── Consolidated ranking chart data ──────────────────────────────────────
const RANKING_CHART = {
  title: 'Ranking Consolidado — Resultado con Tenencia',
  sub: 'Todos los centros de negocio',
  donut: [
    { label:'Ganadería', v:6924097613, color:'#27613d' },
    { label:'Feedlot', v:1906850726, color:'#3d6b5a' },
    { label:'Consignataria', v:396559215, color:'#b8922a' },
    { label:'Campos', v:292010319, color:'#5a7a8a' },
    { label:'Agricultura', v:173299807, color:'#6bc47a' },
    { label:'Transporte', v:61874007, color:'#d4a84b' },
    { label:'Don Pedro', v:45759040, color:'#8fabbf' },
    { label:'Administración', v:-608181853, color:RED },
    { label:'Equinos', v:-920000, color:'#c07030' },
  ],
  footerL: 'Total consolidado c/tenencia',
  footerR: '+$9.191 M (18,97%)',
};

// ── Modal system ─────────────────────────────────────────────────────────
let modalChartInstance = null;

function fmt(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v/1e9).toFixed(2).replace('.',',') + ' M';
  if (abs >= 1e6) return (v/1e6).toFixed(1).replace('.',',') + ' K';
  return v.toLocaleString('es-AR');
}

function openModal(data) {
  const overlay = document.getElementById('chartModal');
  overlay.classList.add('open');
  document.getElementById('modalTitle').textContent = data.title;
  document.getElementById('modalSub').textContent = data.sub;
  document.getElementById('modalFooterL').textContent = data.footerL;
  document.getElementById('modalFooterR').textContent = data.footerR;

  // Build legend
  const legend = document.getElementById('modalLegend');
  const positives = data.donut.filter(d => d.v > 0);
  legend.innerHTML = positives.map(d => `
    <div class="chart-modal-legend-item">
      <div class="cml-dot" style="background:${d.color}"></div>
      <span class="cml-name">${d.label}</span>
      <span class="cml-val ${d.v>=0?'pos':'neg'}">${d.v>=0?'+':''}$${fmt(d.v)}</span>
    </div>`).join('');

  // Destroy previous chart
  if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; }

  const ctx = document.getElementById('modalChart').getContext('2d');
  const absData = positives.map(d => Math.abs(d.v));
  modalChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: positives.map(d => d.label),
      datasets: [{
        data: absData,
        backgroundColor: positives.map(d => d.color),
        borderWidth: 2,
        borderColor: '#f5f0e8',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: $${fmt(ctx.raw)}`
          }
        }
      },
      animation: { animateRotate: true, duration: 500 }
    }
  });
}

function closeModal() {
  document.getElementById('chartModal').classList.remove('open');
  if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; }
}
document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

// ── In-panel charts ───────────────────────────────────────────────────────
const panelChartInstances = {};

function renderPanelChart(name) {
  const data = CENTRO_DATA[name];
  if (!data) return;
  const wrap = document.getElementById('panel-chart-' + name);
  if (!wrap) return;
  const canvas = wrap.querySelector('canvas');
  if (!canvas) return;
  if (panelChartInstances[name]) { panelChartInstances[name].destroy(); }

  const positives = data.donut.filter(d => d.v > 0);

  // Fill inline legend
  const leg = document.getElementById('legend-' + name);
  if (leg) {
    leg.innerHTML = data.donut.map(d => `
      <div class="chart-modal-legend-item">
        <div class="cml-dot" style="background:${d.color}"></div>
        <span class="cml-name">${d.label}</span>
        <span class="cml-val ${d.v>=0?'pos':'neg'}">${d.v>=0?'+':''}$${fmt(Math.abs(d.v))}</span>
      </div>`).join('');
  }

  const ctx = canvas.getContext('2d');
  panelChartInstances[name] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: positives.map(d => d.label),
      datasets: [{
        data: positives.map(d => Math.abs(d.v)),
        backgroundColor: positives.map(d => d.color),
        borderWidth: 2, borderColor: '#f5f0e8', hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: $${fmt(ctx.raw)}` } }
      },
      animation: { animateRotate: true, duration: 600 }
    }
  });
}

// ── Consolidated donut in Resultado Consolidado tab ───────────────────────
function renderConsolidadoChart() {
  const wrap = document.getElementById('consolidado-chart');
  if (!wrap) return;
  const canvas = wrap.querySelector('canvas');
  if (!canvas) return;
  const positives = RANKING_CHART.donut.filter(d => d.v > 0);
  const leg = document.getElementById('legend-consolidado');
  if (leg) {
    leg.innerHTML = RANKING_CHART.donut.map(d => `
      <div class="chart-modal-legend-item">
        <div class="cml-dot" style="background:${d.color}"></div>
        <span class="cml-name">${d.label}</span>
        <span class="cml-val ${d.v>=0?'pos':'neg'}">${d.v>=0?'+':''}$${fmt(Math.abs(d.v))}</span>
      </div>`).join('');
  }
  new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: positives.map(d => d.label),
      datasets: [{
        data: positives.map(d => d.v),
        backgroundColor: positives.map(d => d.color),
        borderWidth: 2, borderColor: '#f5f0e8', hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: $${fmt(ctx.raw)}` } }
      }
    }
  });
}

// ── Pct bar injection ─────────────────────────────────────────────────────
function parsePeso(text) {
  var clean = text.replace(/[^0-9]/g, '');
  return parseFloat(clean) || 0;
}

function addPctBars(panelId) {
  var panel = document.getElementById(panelId);
  if (!panel || panel.dataset.pctDone) return;
  panel.dataset.pctDone = '1';

  var tables = panel.querySelectorAll('table.data-table');
  tables.forEach(function(table) {
    var rows = Array.from(table.querySelectorAll('tbody tr'));

    var totalEg = 0;
    rows.forEach(function(row) {
      var skip = row.classList.contains('group-header') ||
                 row.classList.contains('subtotal') ||
                 row.classList.contains('total') ||
                 row.classList.contains('tenencia-row');
      if (skip || !row.cells || !row.cells[1]) return;
      var txt = row.cells[1].textContent.trim();
      if (txt.indexOf('-') === 0 && txt.indexOf('$') >= 0) totalEg += parsePeso(txt);
    });
    if (totalEg < 1000) return;

    var thead = table.querySelector('thead tr');
    if (thead) {
      var th = document.createElement('th');
      th.className = 'right pct-bar-cell';
      th.textContent = '% s/eg.';
      thead.appendChild(th);
    }

    rows.forEach(function(row) {
      var td = document.createElement('td');
      td.className = 'pct-bar-cell';
      var skip = row.classList.contains('group-header') ||
                 row.classList.contains('subtotal') ||
                 row.classList.contains('total') ||
                 row.classList.contains('tenencia-row');
      if (skip) { row.appendChild(td); return; }

      var cell = row.cells && row.cells[1];
      var txt = cell ? cell.textContent.trim() : '';
      var isEg = txt.indexOf('-') === 0 && txt.indexOf('$') >= 0;

      if (!isEg) {
        td.innerHTML = '<span style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.18)">—</span>';
        row.appendChild(td); return;
      }

      var val = parsePeso(txt);
      var pct = (val / totalEg) * 100;
      var color = pct > 30 ? '#8b1a0e' : '#c0392b';
      var opacity = pct > 30 ? '0.88' : '0.55';
      var w = Math.min(pct, 100).toFixed(1);

      td.innerHTML =
        '<div style="display:flex;align-items:center;gap:5px">' +
          '<div style="flex:1;height:5px;background:rgba(26,22,18,0.08);border-radius:2px;overflow:hidden;min-width:30px">' +
            '<div style="height:100%;border-radius:2px;background:' + color + ';opacity:' + opacity + ';width:' + w + '%;transition:width .8s ease"></div>' +
          '</div>' +
          '<span style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.5);white-space:nowrap;min-width:30px;text-align:right">' + pct.toFixed(1) + '%</span>' +
        '</div>';

      row.appendChild(td);
    });
  });
}

var _sdBase = showDetail;
showDetail = function(name) {
  _sdBase(name);
  setTimeout(function(){ addPctBars('tab-' + name); }, 150);
};

window.addEventListener('load', function(){
  setTimeout(function(){
    ['ganaderia','feedlot','consignataria','campos','agricultura',
     'transporte','donpedro','administracion','equinos'].forEach(function(n){
      addPctBars('tab-' + n);
    });
  }, 700);
});
