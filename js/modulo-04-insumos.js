/* modulo-04-insumos.js — Stock de Insumos · 2026-04-25 */

var INS_SB  = '/pegsa-portal'; // mismo dominio en GitHub Pages
var INS_PER = '2025';
var INS_COLS = ['#b8922a','#27613d','#3d4a5c','#c0392b','#d4a84b','#6bc47a','#5d8aa8','#8b4513'];

function initInsumos() { cargarInsumos(); }

async function cargarInsumos() {
  document.getElementById('insLoading').style.display = 'block';
  document.getElementById('insData').style.display    = 'none';
  document.getElementById('insError').style.display   = 'none';
  document.getElementById('insSyncStatus').textContent = 'Sincronizando...';
  try {
    var r    = await fetch(INS_SB+'/stock_insumos_'+INS_PER+'.json', {});
    if (!r.ok) throw new Error('HTTP '+r.status);
    var data = await r.json();
    renderInsumos(data);
    document.getElementById('insSyncStatus').textContent = '✓ Actualizado '+new Date().toLocaleTimeString('es-AR');
  } catch(err) {
    document.getElementById('insLoading').style.display = 'none';
    document.getElementById('insError').style.display   = 'block';
    document.getElementById('insErrorMsg').textContent  = err.message;
    document.getElementById('insSyncStatus').textContent = '✗ Error';
  }
}

function renderInsumos(data) {
  document.getElementById('insLoading').style.display = 'none';
  document.getElementById('insData').style.display    = 'block';
  var insumos  = data.insumos || [];
  var totalKg  = data.total_kg || 0;
  var meta     = data.meta || {};

  document.getElementById('ins-kpi-total').textContent = Number(Math.round(totalKg)).toLocaleString('es-AR')+' kg';
  document.getElementById('ins-kpi-count').textContent = insumos.length;
  document.getElementById('ins-kpi-fecha').textContent = meta.generado ? new Date(meta.generado).toLocaleString('es-AR') : '-';

  // Cards
  var grid = document.getElementById('insCards');
  grid.innerHTML = '';
  insumos.forEach(function(ins, i) {
    var pct  = totalKg > 0 ? (ins.stock_kg/totalKg*100).toFixed(1) : '0.0';
    var col  = INS_COLS[i % INS_COLS.length];
    var dias = ins.dias_restantes != null ? ins.dias_restantes : (ins.dias_cons != null ? ins.dias_cons : null);
    var promTC = ins.consumo_diario_tc;

    // Semáforo días: <7 rojo, 7-15 amarillo, >15 verde
    var diasCol = '#aaa';
    var diasBg  = 'transparent';
    if (dias != null) {
      if (dias < 7)        { diasCol = '#c0392b'; diasBg = 'rgba(192,57,43,.07)'; }
      else if (dias < 15)  { diasCol = '#b8922a'; diasBg = 'rgba(184,146,42,.07)'; }
      else                 { diasCol = '#27613d'; diasBg = 'rgba(39,97,61,.06)'; }
    }

    var diasHTML = dias != null
      ? '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:7px;margin-top:4px">'
          +'<span style="color:rgba(26,22,18,.5)">Consumo/día</span>'
          +'<span style="font-family:DM Mono,monospace;color:rgba(26,22,18,.55);font-size:13px">'+(promTC ? Number(Math.round(promTC)).toLocaleString('es-AR')+' kg/día' : '—')+'</span>'
        +'</div>'
        +'<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;border-top:1px dashed rgba(26,22,18,.08);padding-top:7px;margin-top:4px;background:'+diasBg+';border-radius:2px;padding:6px 8px;margin-left:-8px;margin-right:-8px">'
          +'<span style="color:rgba(26,22,18,.5);font-weight:600">Días restantes</span>'
          +'<span style="font-family:DM Mono,monospace;font-weight:700;font-size:15px;color:'+diasCol+'">'+Number(dias).toFixed(1).replace('.',',')+'</span>'
        +'</div>'
      : '';

    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:1px solid #e8e2d8;border-top:3px solid '+col+';padding:20px 22px;border-radius:2px';
    card.innerHTML = '<div style="font-size:11px;font-family:DM Mono,monospace;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:6px">Insumo</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:17px;font-weight:700;margin-bottom:14px">'+ins.nombre+'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:13px;border-top:1px dashed rgba(26,22,18,.1);padding-top:7px"><span style="color:rgba(26,22,18,.5)">Stock</span><span style="font-family:DM Mono,monospace;font-weight:600;color:#27613d">'+Number(Math.round(ins.stock_kg)).toLocaleString('es-AR')+' kg</span></div>'
      + diasHTML
      +'<div style="margin-top:12px;background:rgba(26,22,18,.06);height:4px;border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:2px"></div></div>'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.35);margin-top:3px;text-align:right">'+pct+'% del stock</div>';
    grid.appendChild(card);
  });

  // Tabla
  var tbody = document.getElementById('insTabla');
  tbody.innerHTML = '';
  insumos.forEach(function(ins) {
    var pct  = totalKg > 0 ? (ins.stock_kg/totalKg*100).toFixed(1) : '0.0';
    var dias = ins.dias_restantes != null ? ins.dias_restantes : (ins.dias_cons != null ? ins.dias_cons : null);
    var diasCol = '#aaa';
    if (dias != null) {
      if (dias < 7)       diasCol = '#c0392b';
      else if (dias < 15) diasCol = '#b8922a';
      else                diasCol = '#27613d';
    }
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><strong>'+ins.nombre+'</strong></td>'
      +'<td class="right mono" style="color:#27613d">'+Number(Math.round(ins.stock_kg)).toLocaleString('es-AR')+' kg</td>'
      +'<td class="right mono" style="color:rgba(26,22,18,.5)">'+(ins.consumo_diario_tc ? Number(Math.round(ins.consumo_diario_tc)).toLocaleString('es-AR')+' kg/día' : '—')+'</td>'
      +'<td class="right mono" style="font-weight:700;color:'+diasCol+'">'+(dias != null ? Number(dias).toFixed(1).replace('.',',') : '—')+'</td>';
    tbody.appendChild(tr);
  });
  var tfoot = document.createElement('tr');
  tfoot.className = 'total';
  tfoot.innerHTML = '<td><strong>TOTAL</strong></td>'
    +'<td class="right"><strong>'+Number(Math.round(totalKg)).toLocaleString('es-AR')+' kg</strong></td>'
    +'<td class="right">—</td><td class="right">—</td>';
  tbody.appendChild(tfoot);
}
