/* modulo-06-tesoreria.js — Tesorería + Cobertura financiera · 2026-04-25 */

// ══════════════════════════════════════════════
//  TESORERÍA — carga tesoreria_ultimo.json
// ══════════════════════════════════════════════
var _tesData = null;
var _tesVista = 'semanal';

async function cargarTesoreria() {
  if (_tesData) { renderTesoreria(_tesData); return; }
  var loading = document.getElementById('tesLoading');
  var content = document.getElementById('tesContent');
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';
  try {
    var resp = await fetch(STOCK_SB + '/tesoreria_ultimo.json', {}, {});
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _tesData = await resp.json();
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
    renderTesoreria(_tesData);
  } catch(e) {
    if (loading) loading.innerHTML =
      '<div style="padding:60px;text-align:center">'
      + '<div style="font-size:28px">&#9888;</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:14px;margin-top:12px;opacity:.6">No se encontró tesoreria_ultimo.json</div>'
      + '<div style="font-family:\'DM Mono\',monospace;font-size:12px;margin-top:8px;opacity:.4">Colocá un YYYY-MM-DD_financiero.xlsx en la carpeta OneDrive y ejecutá el bat</div>'
      + '</div>';
  }
}

function renderTesoreria(d) {
  var el = document.getElementById('tesContent');
  if (!el) return;
  el.innerHTML = '';

  var pos   = d.posicion   || {};
  var cheq  = d.cheques    || {};
  var hac   = d.hacienda   || {};
  var gv    = d.gastos     || [];
  var dw    = d.darwash    || [];
  var flujo = d.flujo      || {};

  function fmtN(n) { if(n==null)return'—'; return '$\u00a0'+Math.round(Math.abs(n)).toLocaleString('es-AR'); }
  function fmtM(v) {
    if(v==null||isNaN(v))return'—';
    var col=v>=0?'var(--green)':'var(--red)';
    return '<span style="font-family:DM Mono,monospace;color:'+col+'">'+(v>=0?'+':'−')+'\u00a0$\u00a0'+Math.round(Math.abs(v)).toLocaleString('es-AR')+'</span>';
  }
  function fmtA(v) {
    if(v==null||isNaN(v))return'—';
    var col=v>=0?'#7ecf9c':'#f09090';
    return '<span style="font-family:DM Mono,monospace;font-weight:700;color:'+col+'">'+(v>=0?'+':'−')+'\u00a0$\u00a0'+Math.round(Math.abs(v)).toLocaleString('es-AR')+'</span>';
  }
  function sec(label) {
    var d=document.createElement('div');
    d.style.cssText='margin-bottom:32px';
    d.innerHTML='<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:6px">'+label+'</div>';
    el.appendChild(d); return d;
  }
  function card(lbl,val,sub,col) {
    return '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:20px 24px;border-left:4px solid '+col+'">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:8px">'+lbl+'</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:22px;font-weight:700;color:'+col+'">'+val+'</div>'
      +(sub?'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:4px">'+sub+'</div>':'')
      +'</div>';
  }

  // ── Header ──
  var hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid var(--border)';
  hdr.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-l);margin-bottom:8px">Tesorería & Posición Financiera</div>'
    + '<div style="font-family:Playfair Display,serif;font-size:28px;font-weight:700;margin-bottom:4px">Módulo 04 · Posición al' + (d.fecha_corte||'—').split('-').reverse().join('/') + '</div>'
    + '<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.4)">Fuente: ' + (d.archivo||'—') + ' · OneDrive · actualización automática</div>';
  el.appendChild(hdr);

  // ── 1. Posición bancaria ──
  var s1 = sec('Sección 1 · Posición Bancaria');
  var totalPeg  = (pos.bancos_peg  ||[]).reduce(function(a,b){return a+b.saldo;},0);
  var totalBull = (pos.bancos_bull ||[]).reduce(function(a,b){return a+b.saldo;},0);
  var totalDisp = pos.saldo_disponibilidades || 0;
  s1.innerHTML += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">'
    + card('Total Disponibilidades', fmtN(totalDisp), 'Bancos + efectivo + FCI + ECheq', 'var(--gold)')
    + card('Bancos Pecuaria', fmtN(totalPeg), (pos.bancos_peg||[]).length+' cuentas', 'var(--green)')
    + card('Bancos Bulltrade', fmtN(totalBull), (pos.bancos_bull||[]).length+' cuentas', 'var(--blue)')
    + card('FCI + ECheq', fmtN((pos.fci||0)+(pos.echeq||0)), 'Inversiones + eCheqs al cobro', 'var(--amber)')
    + '</div>';
  // Grilla bancos
  var bg = document.createElement('div');
  bg.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:20px';
  function bancoList(arr, titulo) {
    var h = '<div><div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(26,22,18,.1)">'+titulo+'</div>';
    (arr||[]).forEach(function(b){
      h+='<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(26,22,18,.05)">'
        +'<span style="font-size:13px">'+b.nombre+'</span>'
        +'<span style="font-family:DM Mono,monospace;font-size:13px;font-weight:500;color:var(--green)">'+fmtN(b.saldo)+'</span></div>';
    });
    h += '</div>'; return h;
  }
  bg.innerHTML = bancoList(pos.bancos_peg,'Pecuaria El Garabí SA') + bancoList(pos.bancos_bull,'Bulltrade SRL');
  s1.appendChild(bg);
  // USD
  if (pos.usd_ars) {
    var usdBox = document.createElement('div');
    usdBox.style.cssText = 'background:var(--ink);color:#fff;border-radius:2px;padding:16px 24px;display:flex;gap:32px;align-items:center';
    usdBox.innerHTML = '<div><div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:4px">Posición USD</div><div style="font-family:Playfair Display,serif;font-size:18px;font-weight:700;color:var(--gold-l)">'+fmtN(pos.usd_ars)+'</div></div>'
      +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(255,255,255,.35)">Posición en dólares valuada en ARS</div>';
    s1.appendChild(usdBox);
  }

  // ── 2. Cheques al cobro ──
  var s2 = sec('Sección 2 · Cheques Diferidos — Egresos Futuros');
  var pb = cheq.por_vencimiento || [];
  var total7d = (pb.find(function(b){return b.bucket==='0-7 días';})||{}).monto||0;
  s2.innerHTML += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">'
    + card('Total Compromisos', fmtN(cheq.total_cartera), 'Total compromisos futuros', 'var(--green)')
    + card('Vence Esta Semana', fmtN(total7d), '0–7 días', 'var(--blue)')
    + card('Vence Próx. 30 días', fmtN(pb.slice(0,3).reduce(function(a,b){return a+(b.monto||0);},0)), 'Buckets 0–30 días', 'var(--gold)')
    + '</div>';
  // Timeline cheques
  var tl = document.createElement('div');
  tl.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:10px';
  var maxMonto = Math.max.apply(null, pb.map(function(b){return b.monto||0;})) || 1;
  pb.forEach(function(b) {
    var pct = ((b.monto||0)/maxMonto*100).toFixed(1);
    var col = b.bucket==='0-7 días'?'var(--green)':b.bucket==='+60 días'?'rgba(26,22,18,.3)':'var(--gold)';
    tl.innerHTML += '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:14px 16px;border-top:3px solid '+col+'">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:6px">'+b.bucket+'</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:15px;font-weight:700;color:var(--green)">'+fmtN(b.monto)+'</div>'
      +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:3px">'+Math.round(b.cantidad||0)+' cheques</div>'
      +'<div style="margin-top:10px;background:rgba(26,22,18,.07);height:3px;border-radius:2px"><div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:2px"></div></div>'
      +'</div>';
  });
  s2.appendChild(tl);

  // ── 3. Hacienda ──
  var s3 = sec('Sección 3 · Vencimientos de Hacienda');
  var totComp = (hac.compras||[]).reduce(function(a,h){return a+h.monto;},0);
  var totVent = (hac.ventas||[]).reduce(function(a,h){return a+h.monto;},0);
  s3.innerHTML += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">'
    + card('Total Compras', fmtN(totComp), 'Egresos programados', 'var(--red)')
    + card('Total Ventas', fmtN(totVent), 'Ingresos programados', 'var(--green)')
    + '</div>';
  var hg = document.createElement('div');
  hg.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:24px';
  function hacBox(arr, titulo, tipo) {
    var col = tipo==='egreso'?'var(--red)':'var(--green)';
    var h = '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:20px">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:'+col+';margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(26,22,18,.08)">'+titulo+'</div>';
    if (!arr||!arr.length) { h += '<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.35)">Sin vencimientos registrados</div>'; }
    (arr||[]).forEach(function(it){
      var fParts = it.fecha.split('-'); var fLabel = fParts[2]+'/'+fParts[1]+'/'+fParts[0];
      h += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(26,22,18,.05)">'
        +'<span style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.5)">'+fLabel+'</span>'
        +'<span style="font-family:DM Mono,monospace;font-size:13px;font-weight:500;color:'+col+'">'+(tipo==='egreso'?'−':'+')+'\u00a0'+fmtN(it.monto)+'</span></div>';
    });
    h += '</div>'; return h;
  }
  hg.innerHTML = hacBox(hac.compras,'▼ Egresos — Compra de Hacienda','egreso') + hacBox(hac.ventas,'▲ Ingresos — Venta de Hacienda','ingreso');
  s3.appendChild(hg);

  // ── 4. Darwash ──
  if (dw.length) {
    var s4 = sec('Sección 4 · Cuenta Corriente Darwash');
    var dwNeto = dw.reduce(function(a,s){return a+s.items.reduce(function(b,i){return b+i.monto;},0);},0);
    var dwIng  = dw.reduce(function(a,s){return a+s.items.filter(function(i){return i.monto>0;}).reduce(function(b,i){return b+i.monto;},0);},0);
    var dwEgr  = Math.abs(dw.reduce(function(a,s){return a+s.items.filter(function(i){return i.monto<0;}).reduce(function(b,i){return b+i.monto;},0);},0));
    s4.innerHTML += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">'
      + card('Ingresos Darwash', fmtN(dwIng), 'Total flujos positivos', 'var(--green)')
      + card('Egresos Darwash', fmtN(dwEgr), 'Total flujos negativos', 'var(--red)')
      + card('Posición Neta', fmtN(Math.abs(dwNeto)), dwNeto>=0?'A favor':'En contra', dwNeto>=0?'var(--green)':'var(--red)')
      + '</div>';
    var dg = document.createElement('div');
    dg.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px';
    dw.forEach(function(s) {
      var tot = s.items.reduce(function(a,i){return a+i.monto;},0);
      var col = tot>=0?'var(--green)':'var(--red)';
      dg.innerHTML += '<div style="background:#fff;border:1px solid var(--border);border-left:3px solid '+col+';border-radius:2px;padding:16px 20px">'
        +'<div style="font-size:13px;color:rgba(26,22,18,.55);margin-bottom:6px">'+s.nombre+'</div>'
        +'<div style="font-family:Playfair Display,serif;font-size:17px;font-weight:700;color:'+col+'">'+fmtN(Math.abs(tot))+'</div>'
        +'<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.4);margin-top:3px">'+(tot>=0?'▲ ingreso neto':'▼ egreso neto')+'</div></div>';
    });
    s4.appendChild(dg);
  }

  // ── 5. Gastos ──
  if (gv.length) {
    var s5 = sec('Sección 5 · Egresos Proyectados');
    var cats = {}, catOrd = [];
    gv.forEach(function(g){if(!cats[g.categoria]){cats[g.categoria]=0;catOrd.push(g.categoria);}cats[g.categoria]+=g.monto_total;});
    var maxGasto = Math.max.apply(null,Object.values(cats))||1;
    var CAT_COLS = {'Egresos Extraordinarios':'#c0392b','Egresos Ordinarios':'#b8922a','Pagos De Feedlot':'#b8922a','Pagos De Administracio':'#1a4f7a','Pago Impuestos':'#7b3f2a','Pago Felete':'#27613d','Pago Agricultura':'#2e6b6b'};
    var totalGastos = gv.reduce(function(a,g){return a+g.monto_total;},0);
    s5.innerHTML += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">';
    // Barras por categoría
    var pilas = '<div style="display:flex;flex-direction:column;gap:10px">';
    catOrd.forEach(function(cat){
      var m=cats[cat], col=CAT_COLS[cat]||'#666', pct=(m/maxGasto*100).toFixed(1);
      pilas += '<div style="background:#fff;border:1px solid var(--border);border-radius:2px;padding:12px 16px">'
        +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:4px">'+cat+'</div>'
        +'<div style="font-family:Playfair Display,serif;font-size:15px;font-weight:700;color:'+col+'">'+fmtN(m)+'</div>'
        +'<div style="margin-top:8px;background:rgba(26,22,18,.07);height:4px;border-radius:2px"><div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:2px"></div></div></div>';
    });
    pilas += '<div style="background:var(--amber);color:#fff;border-radius:2px;padding:14px 16px">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.8;margin-bottom:4px">TOTAL EGRESOS</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:18px;font-weight:700">'+fmtN(totalGastos)+'</div></div>';
    pilas += '</div>';
    // Tabla detalle
    var tblG = '<div><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'
      +'<th style="font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(26,22,18,.4);padding:8px 10px;text-align:left;background:rgba(26,22,18,.025);border-bottom:2px solid rgba(26,22,18,.1)">Concepto</th>'
      +'<th style="font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(26,22,18,.4);padding:8px 10px;text-align:right;background:rgba(26,22,18,.025);border-bottom:2px solid rgba(26,22,18,.1)">Monto</th>'
      +'<th style="font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(26,22,18,.4);padding:8px 10px;text-align:right;background:rgba(26,22,18,.025);border-bottom:2px solid rgba(26,22,18,.1)">Freq</th>'
      +'</tr></thead><tbody>';
    var lastCat2 = '';
    gv.forEach(function(g){
      if(g.categoria!==lastCat2){
        tblG += '<tr><td colspan="3" style="background:rgba(26,22,18,.05);font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.5);padding:5px 10px">'+g.categoria+'</td></tr>';
        lastCat2=g.categoria;
      }
      var fqCol={'mensual':'rgba(26,79,122,.1)','semanal':'rgba(184,146,42,.1)','quincenal':'rgba(39,97,61,.1)'}[g.frecuencia]||'rgba(26,22,18,.06)';
      var fqTxt={'mensual':'var(--blue)','semanal':'var(--gold)','quincenal':'var(--green)'}[g.frecuencia]||'rgba(26,22,18,.5)';
      tblG += '<tr><td style="padding:8px 10px;border-bottom:1px solid rgba(26,22,18,.05);color:rgba(26,22,18,.7)">'+g.concepto+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(26,22,18,.05);text-align:right;font-family:DM Mono,monospace">'+fmtN(g.monto_total)+'</td>'
        +'<td style="padding:8px 10px;border-bottom:1px solid rgba(26,22,18,.05);text-align:right">'
        +'<span style="font-family:DM Mono,monospace;font-size:11px;padding:2px 6px;border-radius:2px;background:'+fqCol+';color:'+fqTxt+'">'+g.frecuencia+'</span></td></tr>';
    });
    tblG += '</tbody></table></div>';
    s5.innerHTML += pilas + tblG + '</div>';
  }

  // ── 6. Cuadro Acumulado ──
  var s6 = sec('Sección 6 · Cobertura Financiera Proyectada');
  // Toggle semanal/mensual
  var toggleBar = document.createElement('div');
  toggleBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:20px';
  toggleBar.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45)">Saldo inicial: <strong style="color:var(--ink)">'+fmtN(flujo.saldo_inicial||pos.saldo_disponibilidades)+'</strong></div>'
    +'<div style="display:flex;background:rgba(26,22,18,.08);border-radius:2px;padding:3px;gap:3px">'
    +'<button id="tes-tog-sem" onclick="tesSwitchVista(\'semanal\')" style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;border:none;border-radius:1px;cursor:pointer;background:var(--ink);color:var(--gold-l)">Semanal</button>'
    +'<button id="tes-tog-mes" onclick="tesSwitchVista(\'mensual\')" style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;border:none;border-radius:1px;cursor:pointer;background:transparent;color:rgba(26,22,18,.45)">Mensual</button>'
    +'</div>';
  s6.appendChild(toggleBar);
  var coberturaCard = document.createElement('div');
  coberturaCard.id = 'tes-cobertura-card';
  coberturaCard.style.cssText = 'margin-bottom:18px';
  s6.appendChild(coberturaCard);
  var tblAcum = document.createElement('div');
  tblAcum.style.cssText = 'overflow-x:auto;border:1px solid var(--border);border-radius:2px;background:#fff;margin-bottom:20px';
  tblAcum.innerHTML = '<table id="tes-tbl-acum" style="width:100%;border-collapse:collapse;font-size:13px;min-width:900px"></table>';
  s6.appendChild(tblAcum);
  var svgBox = document.createElement('div');
  svgBox.style.cssText = 'background:#fff;border:1px solid var(--border);border-radius:2px;padding:22px 26px';
  svgBox.innerHTML = '<div id="tes-chart-lbl" style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:14px">Cobertura financiera proyectada — saldo acumulado semana a semana</div>'
    +'<svg id="tes-svg-acum" viewBox="0 0 900 200" preserveAspectRatio="none" style="width:100%;height:200px;overflow:visible;display:block"></svg>';
  s6.appendChild(svgBox);

  // Renderizar tabla acumulado
  tesSwitchVista('semanal');
}

function tesSwitchVista(v) {
  _tesVista = v;
  ['sem','mes'].forEach(function(x){
    var b=document.getElementById('tes-tog-'+x);
    if(!b)return;
    var on=(x==='sem'&&v==='semanal')||(x==='mes'&&v==='mensual');
    b.style.background=on?'var(--ink)':'transparent';
    b.style.color=on?'var(--gold-l)':'rgba(26,22,18,.45)';
  });
  var lbl=document.getElementById('tes-chart-lbl');
  if(lbl) lbl.textContent='Cobertura financiera proyectada \u2014 saldo acumulado '+(v==='mensual'?'mes a mes':'semana a semana');
  if(_tesData) tesRenderAcum(_tesData.flujo||{});
}

function tesRenderAcum(flujo) {
  var sems   = flujo.semanas||[];
  var series = flujo.series||{};
  var N = Math.min(sems.length, _tesVista==='mensual'?12:12);

  // ── Cobertura financiera: hasta qué semana el saldo se mantiene positivo ──
  // "Cobertura hasta X" = X es la primera semana donde el saldo cruza a negativo
  var serieAcum  = series.saldo_acumulado || [];
  var saldoIni   = flujo.saldo_inicial || 0;
  var primeraNeg = -1;
  for(var ci=0; ci<serieAcum.length; ci++){
    if(serieAcum[ci] < 0){ primeraNeg = ci; break; }
  }
  var cardEl = document.getElementById('tes-cobertura-card');
  if(cardEl){
    var cardCss = 'border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:14px';
    var lblCss  = 'font-family:DM Sans,sans-serif;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;color:rgba(26,22,18,.45)';
    var valCss  = 'font-family:DM Sans,sans-serif;font-size:18px;font-weight:700';
    var hintCss = 'font-family:DM Sans,sans-serif;font-size:12px;margin-top:2px;color:rgba(26,22,18,.5)';
    var html;
    if(primeraNeg === -1){
      html = '<div style="background:rgba(30,158,90,.08);border:1px solid rgba(30,158,90,.25);border-left:4px solid #1e9e5a;'+cardCss+'">'
        +'<div style="font-size:22px;color:#1e9e5a">●</div>'
        +'<div><div style="'+lblCss+'">Cobertura financiera</div>'
        +'<div style="'+valCss+';color:#1e9e5a">Cobertura completa hasta el horizonte proyectado</div>'
        +'<div style="'+hintCss+'">Saldo acumulado positivo en todo el período</div></div></div>';
    } else if(primeraNeg === 0 && saldoIni < 0){
      html = '<div style="background:rgba(209,67,67,.08);border:1px solid rgba(209,67,67,.25);border-left:4px solid #d14343;'+cardCss+'">'
        +'<div style="font-size:22px;color:#d14343">●</div>'
        +'<div><div style="'+lblCss+'">Cobertura financiera</div>'
        +'<div style="'+valCss+';color:#d14343">Sin cobertura — saldo en rojo desde el inicio</div></div></div>';
    } else {
      var fechaCob = sems[primeraNeg] || '—';
      html = '<div style="background:rgba(43,111,214,.08);border:1px solid rgba(43,111,214,.25);border-left:4px solid #2b6fd6;'+cardCss+'">'
        +'<div style="font-size:22px;color:#2b6fd6">●</div>'
        +'<div><div style="'+lblCss+'">Cobertura financiera</div>'
        +'<div style="'+valCss+';color:#0f1e38">Tenemos cobertura hasta la <span style="color:#2b6fd6">semana del '+fechaCob+'</span></div>'
        +'<div style="'+hintCss+'">El saldo acumulado se vuelve negativo a partir de esa semana</div></div></div>';
    }
    cardEl.innerHTML = html;
  }

  // Agrupar por mes si corresponde
  var periodos;
  if (_tesVista==='mensual') {
    var meses={},orden=[];
    sems.forEach(function(s,i){
      var p=s.split('/'),mk=p[1];
      var mn={'01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun','07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic'};
      var lbl=(mn[mk]||mk);
      if(!meses[mk]){meses[mk]={label:lbl,idxs:[]};orden.push(mk);}
      meses[mk].idxs.push(i);
    });
    periodos=orden.map(function(mk){
      var idxs=meses[mk].idxs,row={label:meses[mk].label};
      Object.keys(series).forEach(function(k){
        if(k==='saldo_acumulado'){var last=0;idxs.forEach(function(i){if(series[k][i]!==0)last=series[k][i];});row[k]=last;}
        else{row[k]=idxs.reduce(function(a,i){return a+(series[k][i]||0);},0);}
      });
      return row;
    });
  } else {
    periodos=sems.slice(0,N).map(function(s,i){
      var row={label:s};
      Object.keys(series).forEach(function(k){row[k]=series[k][i]||0;});
      return row;
    });
  }
  N=periodos.length;

  function fC(v){
    if(!v&&v!==0)return'<span style="color:rgba(26,22,18,.2)">—</span>';
    var col=v>=0?'var(--green)':'var(--red)';
    return '<span style="font-family:DM Mono,monospace;color:'+col+'">'+(v>=0?'+':'−')+'\u00a0$\u00a0'+Math.round(Math.abs(v)).toLocaleString('es-AR')+'</span>';
  }
  function fA(v){
    var col=v>=0?'#7ecf9c':'#f09090';
    return '<span style="font-family:DM Mono,monospace;font-weight:700;color:'+col+'">'+(v>=0?'+':'−')+'\u00a0$\u00a0'+Math.round(Math.abs(v)).toLocaleString('es-AR')+'</span>';
  }
  var TH='font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(26,22,18,.4);padding:9px 11px;text-align:right;font-weight:400;background:rgba(26,22,18,.025);white-space:nowrap;border-bottom:2px solid rgba(26,22,18,.1)';
  var TD='padding:8px 11px;border-bottom:1px solid rgba(26,22,18,.05);text-align:right;white-space:nowrap';

  var h='<thead><tr><th style="'+TH+';text-align:left;min-width:200px">Concepto</th>';
  periodos.forEach(function(p){h+='<th style="'+TH+'">'+p.label+'</th>';});
  h+='</tr></thead><tbody>';

  function secH(lbl,bg){return'<tr><td colspan="'+(N+1)+'" style="background:'+bg+';font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;padding:6px 11px;font-weight:500;border-bottom:1px solid rgba(26,22,18,.07)">'+lbl+'</td></tr>';}
  function detR(lbl,key,indent){var tr='<tr><td style="'+TD+';text-align:left;'+(indent?'padding-left:20px;':'')+';color:rgba(26,22,18,.55);font-size:13px">'+lbl+'</td>';periodos.forEach(function(p){tr+='<td style="'+TD+'">'+fC(p[key]||0)+'</td>';});return tr+'</tr>';}
  function totR(lbl,key,bg,col){var tr='<tr style="background:'+bg+'"><td style="'+TD+';text-align:left;font-weight:600;color:'+col+'">'+lbl+'</td>';periodos.forEach(function(p){tr+='<td style="'+TD+';font-weight:600;color:'+col+'">'+fC(p[key]||0)+'</td>';});return tr+'</tr>';}

  h+=secH('▲ INGRESOS','rgba(39,97,61,.06)');
  h+=detR('Cobros venta hacienda','venta_hacienda',true);
  h+=detR('Hotelería y alimentación feedlot','hoteleria',true);
  h+=totR('Total ingresos','total_ingresos','rgba(39,97,61,.06)','var(--green)');
  h+=secH('▼ EGRESOS','rgba(192,57,43,.06)');
  h+=detR('Cheques diferidos (débitos)','cheques_cobro',true);
  h+=detR('Pagos feedlot','pagos_feedlot',true);
  h+=detR('Pagos administración','pagos_admin',true);
  h+=detR('Impuestos','pago_impuestos',true);
  h+=detR('Fletes','pago_flete',true);
  h+=detR('Agricultura','pago_agricultura',true);
  h+=totR('Total egresos','total_egresos','rgba(192,57,43,.06)','var(--red)');
  h+=detR('Darwash (neto semanal)','darwash',false);
  h+='<tr style="background:rgba(26,22,18,.04)"><td style="'+TD+';text-align:left;font-weight:600;font-size:13px">Flujo neto '+(_tesVista==='mensual'?'mensual':'semanal')+'</td>';
  periodos.forEach(function(p){h+='<td style="'+TD+';font-weight:600">'+fC(p.saldo_semanal||0)+'</td>';});
  h+='</tr>';
  h+='<tr style="background:var(--ink)"><td style="'+TD+';text-align:left;color:var(--gold-l);font-weight:700;font-size:13px;font-family:DM Mono,monospace;letter-spacing:.04em">SALDO ACUMULADO AL CIERRE</td>';
  periodos.forEach(function(p){h+='<td style="'+TD+'">'+fA(p.saldo_acumulado||0)+'</td>';});
  h+='</tr></tbody>';

  var tbl=document.getElementById('tes-tbl-acum');
  if(tbl)tbl.innerHTML=h;

  // SVG
  var sv=document.getElementById('tes-svg-acum');
  if(!sv)return;
  var W=900,H=200,vals=[flujo.saldo_inicial||0].concat(periodos.map(function(p){return p.saldo_acumulado||0;}));
  var lbls=['Hoy'].concat(periodos.map(function(p){return p.label;}));
  var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),pd=Math.max(Math.abs(mx-mn)*.12,5e7);
  mn-=pd;mx+=pd;var rng=mx-mn,xs=W/Math.max(vals.length-1,1);
  function tx(i){return i*xs;}
  function ty(v){return H-(v-mn)/rng*(H-40)-20;}
  var svg='';
  if(mn<0&&mx>0){var y0=ty(0);svg+='<line x1="0" y1="'+y0+'" x2="'+W+'" y2="'+y0+'" stroke="rgba(26,22,18,.2)" stroke-width="1" stroke-dasharray="5,3"/><text x="4" y="'+(y0-4)+'" font-size="8" font-family="DM Mono,monospace" fill="rgba(26,22,18,.35)">$0</text>';}
  vals.forEach(function(_,i){svg+='<line x1="'+tx(i)+'" y1="0" x2="'+tx(i)+'" y2="'+H+'" stroke="rgba(26,22,18,.04)" stroke-width="1"/><text x="'+tx(i)+'" y="'+(H+14)+'" text-anchor="middle" font-size="8" font-family="DM Mono,monospace" fill="rgba(26,22,18,.35)">'+lbls[i]+'</text>';});
  var area='M '+tx(0)+','+ty(0)+' L '+tx(0)+','+ty(vals[0]);
  vals.forEach(function(v,i){if(i>0)area+=' L '+tx(i)+','+ty(v);});
  area+=' L '+tx(vals.length-1)+','+ty(0)+' Z';
  svg+='<path d="'+area+'" fill="rgba(184,146,42,.07)"/>';
  for(var i=1;i<vals.length;i++){var col2=vals[i]>=0?'#27613d':'#c0392b';svg+='<line x1="'+tx(i-1)+'" y1="'+ty(vals[i-1])+'" x2="'+tx(i)+'" y2="'+ty(vals[i])+'" stroke="'+col2+'" stroke-width="2.5"/>';}
  vals.forEach(function(v,i){var col2=v>=0?'#27613d':'#c0392b',lb=(v>=0?'+':'\u2212')+'$\u00a0'+Math.round(Math.abs(v)).toLocaleString('es-AR');svg+='<circle cx="'+tx(i)+'" cy="'+ty(v)+'" r="'+(i===0?5:4)+'" fill="'+col2+'" stroke="white" stroke-width="2"/><text x="'+tx(i)+'" y="'+(ty(v)-8)+'" text-anchor="'+(i===0?'start':i===vals.length-1?'end':'middle')+'" font-size="9" font-family="DM Mono,monospace" fill="'+col2+'" font-weight="600">'+lb+'</text>';});
  sv.innerHTML=svg;
}

// ══════════════════════════════════════════════
//  TESORERÍA — Módulo 06
// ══════════════════════════════════════════════
var _tesData = null;
var _tesHistFinData = null;   // financiero_historico.json para comparar cortes
var _tesVista = 'semanal';
var _tesAcumChart = null;     // instancia Chart.js del gráfico acumulado

function initTesoreria() {
  if (_tesData) { _renderTesUI(_tesData); return; }
  cargarTesoreria();
}

function recargarTesoreria() {
  _tesData = null;
  document.getElementById('tesData').style.display = 'none';
  document.getElementById('tesError').style.display = 'none';
  document.getElementById('tesLoading').style.display = 'block';
  cargarTesoreria();
}

async function cargarTesoreria() {
  try {
    var results = await Promise.all([
      fetch(STOCK_SB + '/tesoreria_ultimo.json'),
      fetch(STOCK_SB + '/financiero_historico.json').catch(function(){ return null; })
    ]);
    var resp = results[0];
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _tesData = await resp.json();
    if (results[1] && results[1].ok) {
      _tesHistFinData = await results[1].json();
    }
    document.getElementById('tesLoading').style.display = 'none';
    document.getElementById('tesError').style.display = 'none';
    document.getElementById('tesData').style.display = 'block';
    _renderTesUI(_tesData);
  } catch(e) {
    document.getElementById('tesLoading').style.display = 'none';
    document.getElementById('tesError').style.display = 'block';
    document.getElementById('tesSyncStatus').textContent = '⚠ Sin datos';
  }
}

function _renderTesUI(d) {
  var pos   = d.posicion   || {};
  var cheq  = d.cheques    || {};
  var hac   = d.hacienda   || {};
  var gv    = d.gastos     || [];
  var dw    = d.darwash    || [];
  var flujo = d.flujo      || {};

  // KPIs del header
  var totalDisp = pos.saldo_disponibilidades || 0;
  document.getElementById('tes-kpi-disp').textContent  = _tesFmt(totalDisp);
  document.getElementById('tes-kpi-cheq').textContent  = _tesFmt(cheq.total_cartera || 0);
  document.getElementById('tes-kpi-usd').textContent   = _tesFmt(pos.usd_ars || 0);
  document.getElementById('tes-kpi-fecha').textContent = (d.fecha_corte||'').split('-').reverse().join('/');
  document.getElementById('tesSyncStatus').textContent = '✓ Actualizado ' + (d.fecha_corte||'');

  var el = document.getElementById('tesData');
  el.innerHTML = '';

  function _sec(lbl) {
    var s = document.createElement('div');
    s.style.cssText = 'margin-bottom:36px';
    s.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:6px">'+lbl+'</div>';
    el.appendChild(s); return s;
  }
  function _card(lbl,val,sub,col) {
    return '<div style="background:#fff;border:1px solid rgba(26,22,18,.12);border-radius:2px;padding:18px 22px;border-left:4px solid '+col+'">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:7px">'+lbl+'</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:20px;font-weight:700;color:'+col+'">'+val+'</div>'
      +(sub?'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:4px">'+sub+'</div>':'')
      +'</div>';
  }

  // ── 1. Posición Bancaria ──
  var s1 = _sec('Sección 1 · Posición Bancaria');
  var tPeg  = (pos.bancos_peg||[]).reduce(function(a,b){return a+b.saldo;},0);
  var tBull = (pos.bancos_bull||[]).reduce(function(a,b){return a+b.saldo;},0);
  var tBancos = tPeg + tBull;
  var efectivo = pos.efectivo || 0;
  var becerra  = pos.becerra  || 0;
  var fimaBull = pos.fima_bull || 0;
  var fimaPeg  = pos.fima_peg  || 0;
  var echeq    = pos.echeq    || 0;
  s1.innerHTML += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px">'
    +_card('Total Disponibilidades',_tesFmt(totalDisp),'Bancos + efectivo + FCI + ECheq','var(--gold)')
    +_card('Bancos',_tesFmt(tBancos),'Pecuaria + Bulltrade','var(--green)')
    +_card('Inversiones (FCI)',_tesFmt(becerra+fimaBull+fimaPeg),'Becerra + FIMA Galicia','var(--blue)')
    +_card('Efectivo + ECheq',_tesFmt(efectivo+echeq),'Caja + eCheqs al cobro','var(--amber)')
    +'</div>';
  var bg = document.createElement('div');
  bg.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:18px';
  function _bancoList(arr,titulo) {
    var h='<div><div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(26,22,18,.1)">'+titulo+'</div>';
    (arr||[]).forEach(function(b){var bCol=(b.saldo||0)<0?'var(--red)':'var(--green)';h+='<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(26,22,18,.05)"><span style="font-size:13px">'+b.nombre+'</span><span style="font-family:DM Mono,monospace;font-size:13px;font-weight:500;color:'+bCol+'">'+_tesFmt(b.saldo)+'</span></div>';});
    return h+'</div>';
  }
  bg.innerHTML = _bancoList(pos.bancos_peg,'Pecuaria El Garabí SA') + _bancoList(pos.bancos_bull,'Bulltrade SRL');
  s1.appendChild(bg);

  // Efectivo + Inversiones + ECheq
  var inv = document.createElement('div');
  inv.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px';
  function _invBox(titulo, items, total) {
    var h = '<div style="background:#fff;border:1px solid rgba(26,22,18,.12);border-radius:2px;padding:16px 20px">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(26,22,18,.1)">'+titulo+'</div>';
    items.forEach(function(it){
      if (!it.saldo) return;
      h+='<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(26,22,18,.05)">'
        +'<span style="font-size:13px;color:rgba(26,22,18,.6)">'+it.nombre+'</span>'
        +'<span style="font-family:DM Mono,monospace;font-size:13px;font-weight:500;color:var(--blue)">'+_tesFmt(it.saldo)+'</span></div>';
    });
    if (items.length > 1) {
      h+='<div style="display:flex;justify-content:space-between;padding:8px 0 0;margin-top:2px">'
        +'<span style="font-family:DM Mono,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:rgba(26,22,18,.4)">Total</span>'
        +'<span style="font-family:Playfair Display,serif;font-size:14px;font-weight:700;color:var(--blue)">'+_tesFmt(total)+'</span></div>';
    }
    return h+'</div>';
  }
  inv.innerHTML =
    _invBox('Inversiones (FCI / Bursátil)', [
      {nombre:'Becerra Bursátil',  saldo: becerra},
      {nombre:'FIMA Galicia Bulltrade', saldo: fimaBull},
      {nombre:'FIMA Galicia Pecuaria',  saldo: fimaPeg},
    ], becerra+fimaBull+fimaPeg)
    + _invBox('Efectivo', [
      {nombre:'Caja Bulltrade', saldo: efectivo},
    ], efectivo)
    + _invBox('ECheqs al Cobro', [
      {nombre:'eCheqs presentados', saldo: echeq},
    ], echeq);
  s1.appendChild(inv);
  if (pos.usd_ars) {
    var usdEl = document.createElement('div');
    usdEl.style.cssText = 'background:var(--ink);color:#fff;border-radius:2px;padding:14px 22px;display:flex;gap:28px;align-items:center';
    usdEl.innerHTML = '<div><div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:3px">Posición USD</div><div style="font-family:Playfair Display,serif;font-size:18px;font-weight:700;color:var(--gold-l)">'+_tesFmt(pos.usd_ars)+'</div></div><div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(255,255,255,.3)">Posición en dólares valuada en ARS</div>';
    s1.appendChild(usdEl);
  }

  // ── 2. Cheques ──
  var s2 = _sec('Sección 2 · Cheques Diferidos — Egresos Futuros');
  var pb = cheq.por_vencimiento || [];
  var t7 = (pb.find(function(b){return b.bucket==='0-7 días';})||{}).monto||0;
  s2.innerHTML += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px">'
    +_card('Total Compromisos',_tesFmt(cheq.total_cartera||0),'Total compromisos futuros','var(--red)')
    +_card('Vence Esta Semana',_tesFmt(t7),'0–7 días — debitar esta semana','var(--red)')
    +_card('Vence Próx. 30 días',_tesFmt(pb.slice(0,3).reduce(function(a,b){return a+(b.monto||0);},0)),'Buckets 0–30 días','var(--gold)')
    +'</div>';
  var tl = document.createElement('div');
  tl.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:10px';
  var mx = Math.max.apply(null,pb.map(function(b){return b.monto||0;}))||1;
  pb.forEach(function(b){
    var pct=((b.monto||0)/mx*100).toFixed(1);
    var col=b.bucket==='0-7 días'?'var(--green)':b.bucket==='+60 días'?'rgba(26,22,18,.3)':'var(--gold)';
    tl.innerHTML+='<div style="background:#fff;border:1px solid rgba(26,22,18,.12);border-radius:2px;padding:14px 16px;border-top:3px solid '+col+'">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.38);margin-bottom:5px">'+b.bucket+'</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:14px;font-weight:700;color:var(--green)">'+_tesFmt(b.monto||0)+'</div>'
      +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.4);margin-top:3px">'+Math.round(b.cantidad||0)+' cheques</div>'
      +'<div style="margin-top:8px;background:rgba(26,22,18,.07);height:3px;border-radius:2px"><div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:2px"></div></div></div>';
  });
  s2.appendChild(tl);

  // ── 3. Hacienda ──
  var s3 = _sec('Sección 3 · Vencimientos de Hacienda');
  var tC=(hac.compras||[]).reduce(function(a,h){return a+h.monto;},0);
  var tV=(hac.ventas||[]).reduce(function(a,h){return a+h.monto;},0);
  s3.innerHTML+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">'
    +_card('Total Compras',_tesFmt(tC),'Egresos programados','var(--red)')
    +_card('Total Ventas',_tesFmt(tV),'Ingresos programados','var(--green)')+'</div>';
  var hg=document.createElement('div'); hg.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:20px';
  function _hacBox(arr,titulo,tipo){
    var col=tipo==='egreso'?'var(--red)':'var(--green)';
    var h='<div style="background:#fff;border:1px solid rgba(26,22,18,.12);border-radius:2px;padding:18px">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:'+col+';margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(26,22,18,.08)">'+titulo+'</div>';
    if(!arr||!arr.length)h+='<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.35)">Sin vencimientos</div>';
    (arr||[]).forEach(function(it){
      var fp=it.fecha.split('-');
      var fLabel=fp[2]+'/'+fp[1]+'/'+fp[0];
      // Encabezado de fecha + total
      h+='<div style="padding:10px 0 6px;border-bottom:1px solid rgba(26,22,18,.08)">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">'
        +'<span style="font-family:DM Mono,monospace;font-size:13px;font-weight:600;color:rgba(26,22,18,.7)">'+fLabel+'</span>'
        +'<span style="font-family:DM Mono,monospace;font-size:13px;font-weight:700;color:'+col+'">'+(tipo==='egreso'?'−':'+')+'\u00a0'+_tesFmt(it.monto)+'</span>'
        +'</div>';
      // Detalle por empresa
      if(it.detalle&&it.detalle.length){
        it.detalle.forEach(function(d){
          h+='<div style="display:flex;justify-content:space-between;padding:3px 0 3px 12px">'
            +'<span style="font-size:13px;color:rgba(26,22,18,.5)">'+d.empresa+'</span>'
            +'<span style="font-family:DM Mono,monospace;font-size:13px;color:rgba(26,22,18,.55)">'+_tesFmt(d.monto)+'</span>'
            +'</div>';
        });
      }
      h+='</div>';
    });
    return h+'</div>';
  }
  hg.innerHTML=_hacBox(hac.compras,'▼ Egresos — Compra de Hacienda','egreso')+_hacBox(hac.ventas,'▲ Ingresos — Venta de Hacienda','ingreso');
  s3.appendChild(hg);

  // ── 4. Darwash ──
  if(dw.length){
    var s4=_sec('Sección 4 · Cuenta Corriente Darwash');
    var dwN=dw.reduce(function(a,s){return a+s.items.reduce(function(b,i){return b+i.monto;},0);},0);
    var dwI=dw.reduce(function(a,s){return a+s.items.filter(function(i){return i.monto>0;}).reduce(function(b,i){return b+i.monto;},0);},0);
    var dwE=Math.abs(dw.reduce(function(a,s){return a+s.items.filter(function(i){return i.monto<0;}).reduce(function(b,i){return b+i.monto;},0);},0));
    s4.innerHTML+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px">'
      +_card('Ingresos Darwash',_tesFmt(dwI),'Total flujos positivos','var(--green)')
      +_card('Egresos Darwash',_tesFmt(dwE),'Total flujos negativos','var(--red)')
      +_card('Posición Neta',_tesFmt(Math.abs(dwN)),dwN>=0?'A favor':'En contra',dwN>=0?'var(--green)':'var(--red)')+'</div>';
    var dg=document.createElement('div'); dg.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:12px';
    dw.forEach(function(s){var tot=s.items.reduce(function(a,i){return a+i.monto;},0);var col=tot>=0?'var(--green)':'var(--red)';dg.innerHTML+='<div style="background:#fff;border:1px solid rgba(26,22,18,.12);border-left:3px solid '+col+';border-radius:2px;padding:14px 18px"><div style="font-size:13px;color:rgba(26,22,18,.55);margin-bottom:5px">'+s.nombre+'</div><div style="font-family:Playfair Display,serif;font-size:16px;font-weight:700;color:'+col+'">'+_tesFmt(Math.abs(tot))+'</div><div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.4);margin-top:3px">'+(tot>=0?'▲ ingreso neto':'▼ egreso neto')+'</div></div>';});
    s4.appendChild(dg);
  }

  // ── 5. Gastos ──
  if(gv.length){
    var s5=_sec('Sección 5 · Egresos Proyectados — 6 Meses');
    var CAT_COLS2={'Egresos Extraordinarios':'#c0392b','Egresos Ordinarios':'#b8922a','Pagos De Feedlot':'#b8922a','Pagos De Administracio':'#1a4f7a','Pago Impuestos':'#7b3f2a','Pago Felete':'#27613d','Pago Agricultura':'#2e6b6b'};
    var MESES_AGRO2={'Picado de Maiz':[4,5,6,7],'Silobolsas':[4,5,6,7]};
    function mMens(g){if(g.frecuencia==='semanal')return g.monto_total*4.33;if(g.frecuencia==='quincenal')return g.monto_total*2;return g.monto_total;}
    var hoyM=new Date('2026-03-20'),mData=[],mLabels=[];
    for(var mi=0;mi<6;mi++){
      var dd=new Date(hoyM);dd.setMonth(dd.getMonth()+mi);
      var mn2=dd.getMonth()+1;
      var lbl2=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][mn2-1]+' '+String(dd.getFullYear()).slice(2);
      mLabels.push(lbl2);
      var det2=[];
      gv.forEach(function(g){if(!g.monto_total)return;var r=MESES_AGRO2[g.concepto];if(r&&r.indexOf(mn2)===-1)return;det2.push({categoria:g.categoria,concepto:g.concepto,monto:Math.round(mMens(g)),frecuencia:g.frecuencia});});
      mData.push({mes:lbl2,mes_num:mn2,total:det2.reduce(function(a,x){return a+x.monto;},0),detalle:det2});
    }
    var cats6={},catO6=[];
    mData.forEach(function(p){p.detalle.forEach(function(d){if(!cats6[d.categoria]){cats6[d.categoria]=0;catO6.push(d.categoria);}cats6[d.categoria]+=d.monto;});});
    catO6=catO6.filter(function(v,i,a){return a.indexOf(v)===i;});
    var tot6=Object.values(cats6).reduce(function(a,v){return a+v;},0);
    var maxC6=Math.max.apply(null,Object.values(cats6))||1;
    // Barras izquierda
    var pls='<div style="display:flex;flex-direction:column;gap:10px">';
    catO6.forEach(function(cat){var v=cats6[cat],col=CAT_COLS2[cat]||'#666',pct=(v/tot6*100).toFixed(1),bw=(v/maxC6*100).toFixed(1);
      pls+='<div style="background:#fff;border:1px solid rgba(26,22,18,.12);border-radius:2px;padding:13px 16px">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">'
        +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.38)">'+cat+'</div>'
        +'<div style="font-family:DM Mono,monospace;font-size:12px;font-weight:600;color:'+col+';background:'+col+'18;padding:2px 7px;border-radius:10px">'+pct+'%</div></div>'
        +'<div style="font-family:Playfair Display,serif;font-size:15px;font-weight:700;color:'+col+'">'+_tesFmt(v)+'</div>'
        +'<div style="margin-top:7px;background:rgba(26,22,18,.07);height:4px;border-radius:2px"><div style="width:'+bw+'%;height:100%;background:'+col+';border-radius:2px"></div></div></div>';
    });
    pls+='<div style="background:var(--ink);color:#fff;border-radius:2px;padding:14px 16px">'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:4px">TOTAL 6 MESES</div>'
      +'<div style="font-family:Playfair Display,serif;font-size:18px;font-weight:700;color:var(--gold-l)">'+_tesFmt(tot6)+'</div>'
      +'<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(255,255,255,.3);margin-top:3px">Prom. mensual: '+_tesFmt(Math.round(tot6/6))+'</div></div>';
    pls+='</div>';
    // Tabla derecha mes a mes
    var TH2='font-family:DM Mono,monospace;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,22,18,.4);padding:7px 9px;text-align:right;font-weight:400;background:rgba(26,22,18,.025);border-bottom:2px solid rgba(26,22,18,.1);white-space:nowrap';
    var TD2='padding:6px 9px;border-bottom:1px solid rgba(26,22,18,.05);text-align:right;font-family:DM Mono,monospace;font-size:10.5px;white-space:nowrap';
    var tG2='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid rgba(26,22,18,.12);border-radius:2px"><thead><tr>'
      +'<th style="'+TH2+';text-align:left;min-width:170px">Concepto</th>'
      +'<th style="'+TH2+';text-align:center;min-width:70px">Freq</th>';
    mLabels.forEach(function(l){tG2+='<th style="'+TH2+'">'+l+'</th>';});
    tG2+='<th style="'+TH2+';background:rgba(26,22,18,.06)">6 Meses</th><th style="'+TH2+';background:rgba(26,22,18,.06)">Part.</th></tr></thead><tbody>';
    var catCons={};
    gv.forEach(function(g){if(!g.monto_total)return;if(!catCons[g.categoria])catCons[g.categoria]=[];catCons[g.categoria].push(g);});
    catO6.forEach(function(cat){
      if(!catCons[cat])return;
      var col=CAT_COLS2[cat]||'#666';
      tG2+='<tr><td colspan="'+(6+3)+'" style="background:rgba(26,22,18,.05);font-family:DM Mono,monospace;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:'+col+';padding:5px 9px;font-weight:600">'+cat+'</td></tr>';
      catCons[cat].forEach(function(g){
        var tc=0,fq={'mensual':'var(--blue)','semanal':'var(--gold)','quincenal':'var(--green)'}[g.frecuencia]||'rgba(26,22,18,.5)';
        var fqBg={'mensual':'rgba(26,79,122,.08)','semanal':'rgba(184,146,42,.08)','quincenal':'rgba(39,97,61,.08)'}[g.frecuencia]||'rgba(26,22,18,.04)';
        tG2+='<tr><td style="'+TD2+';text-align:left;color:rgba(26,22,18,.7)">'+g.concepto+'</td>'
          +'<td style="'+TD2+';text-align:center"><span style="font-size:8.5px;padding:2px 5px;border-radius:2px;background:'+fqBg+';color:'+fq+'">'+g.frecuencia+'</span></td>';
        mData.forEach(function(p){var f=p.detalle.filter(function(d){return d.concepto===g.concepto;});var v=f.length?f[0].monto:0;tc+=v;tG2+='<td style="'+TD2+'">'+(v?_tesFmt(v):'<span style="color:rgba(26,22,18,.25)">—</span>')+'</td>';});
        var pcc=tot6>0?(tc/tot6*100).toFixed(1)+'%':'—';
        tG2+='<td style="'+TD2+';background:rgba(26,22,18,.03);font-weight:600">'+_tesFmt(tc)+'</td>'
          +'<td style="'+TD2+';background:rgba(26,22,18,.03);color:rgba(26,22,18,.5)">'+pcc+'</td></tr>';
      });
      var subt=mData.reduce(function(a,p){return a+p.detalle.filter(function(d){return d.categoria===cat;}).reduce(function(b,d){return b+d.monto;},0);},0);
      tG2+='<tr style="background:rgba(26,22,18,.04)"><td style="'+TD2+';text-align:left;font-weight:600;color:'+col+'">Subtotal</td><td style="'+TD2+'"></td>';
      mData.forEach(function(p){var v=p.detalle.filter(function(d){return d.categoria===cat;}).reduce(function(b,d){return b+d.monto;},0);tG2+='<td style="'+TD2+';font-weight:600;color:'+col+'">'+(v?_tesFmt(v):'—')+'</td>';});
      tG2+='<td style="'+TD2+';font-weight:700;color:'+col+';background:rgba(26,22,18,.05)">'+_tesFmt(subt)+'</td>'
        +'<td style="'+TD2+';font-weight:600;color:'+col+';background:rgba(26,22,18,.05)">'+(tot6?(subt/tot6*100).toFixed(1):0)+'%</td></tr>';
    });
    tG2+='<tr style="background:var(--ink)"><td style="'+TD2+';text-align:left;font-weight:700;font-family:DM Mono,monospace;color:var(--gold-l);letter-spacing:.04em">TOTAL EGRESOS</td><td style="'+TD2+'"></td>';
    mData.forEach(function(p){tG2+='<td style="'+TD2+';font-weight:700;color:var(--gold-l)">'+_tesFmt(p.total)+'</td>';});
    tG2+='<td style="'+TD2+';font-weight:700;color:var(--gold-l)">'+_tesFmt(tot6)+'</td><td style="'+TD2+';color:rgba(255,255,255,.4)">100%</td></tr>';
    tG2+='</tbody></table></div>';
    s5.innerHTML+='<div style="display:grid;grid-template-columns:260px 1fr;gap:20px">'+pls+tG2+'</div>';
  }

  // ── 6. Cuadro Acumulado ──
  var s6=_sec('Sección 6 · Cobertura Financiera Proyectada');
  var togBar=document.createElement('div');
  togBar.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px';
  togBar.innerHTML='<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45)">Saldo inicial: <strong style="color:var(--ink)">'+_tesFmt(flujo.saldo_inicial||pos.saldo_disponibilidades||0)+'</strong></div>'
    +'<div style="display:flex;background:rgba(26,22,18,.08);border-radius:2px;padding:3px;gap:3px">'
    +'<button id="tes-tog-sem" onclick="tesSwitchVista(\'semanal\')" style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;border:none;border-radius:1px;cursor:pointer;background:var(--ink);color:var(--gold-l)">Semanal</button>'
    +'<button id="tes-tog-mes" onclick="tesSwitchVista(\'mensual\')" style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;border:none;border-radius:1px;cursor:pointer;background:transparent;color:rgba(26,22,18,.45)">Mensual</button>'
    +'</div>';
  s6.appendChild(togBar);
  var coberturaCard2=document.createElement('div');
  coberturaCard2.id='tes-cobertura-card';
  coberturaCard2.style.cssText='margin-bottom:18px';
  s6.appendChild(coberturaCard2);
  var tblAcum=document.createElement('div');
  tblAcum.style.cssText='overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:18px';
  tblAcum.innerHTML='<table id="tes-tbl-acum" style="width:100%;border-collapse:collapse;font-size:13px;min-width:900px"></table>';
  s6.appendChild(tblAcum);
  var svgBox=document.createElement('div');
  svgBox.style.cssText='background:#fff;border:1px solid rgba(26,22,18,.12);border-radius:2px;padding:20px 24px';
  svgBox.innerHTML='<div id="tes-chart-lbl" style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,22,18,.4);margin-bottom:14px">Cobertura financiera proyectada — saldo acumulado semana a semana</div><div style="position:relative;height:260px"><canvas id="tes-canvas-acum"></canvas></div>';
  s6.appendChild(svgBox);
  tesSwitchVista('semanal');

  // ── 7. Variaciones entre cortes ──
  if (_tesHistFinData && (_tesHistFinData.cortes||[]).length >= 2) {
    _renderTesVariaciones(_tesHistFinData, d);
  }
}

function _tesFmt(n){
  if(n==null)return'—';
  var neg = n < 0;
  return (neg ? '−\u00a0' : '') + '$\u00a0' + Math.round(Math.abs(n)).toLocaleString('es-AR');
}

function tesSwitchVista(v){
  _tesVista=v;
  ['sem','mes'].forEach(function(x){var b=document.getElementById('tes-tog-'+x);if(!b)return;var on=(x==='sem'&&v==='semanal')||(x==='mes'&&v==='mensual');b.style.background=on?'var(--ink)':'transparent';b.style.color=on?'var(--gold-l)':'rgba(26,22,18,.45)';});
  var lbl=document.getElementById('tes-chart-lbl');
  if(lbl)lbl.textContent='Cobertura financiera proyectada \u2014 saldo acumulado '+(v==='mensual'?'mes a mes':'semana a semana');
  if(_tesData)_tesRenderAcum(_tesData.flujo||{});
}

function _tesRenderAcum(flujo){
  var sems=flujo.semanas||[],series=flujo.series||{};

  // \u2500\u2500 Cobertura financiera: hasta qu\u00e9 semana el saldo se mantiene positivo \u2500\u2500
  var serieAcum2  = series.saldo_acumulado || [];
  var saldoIni2   = flujo.saldo_inicial || 0;
  var primeraNeg2 = -1;
  for(var ci2=0; ci2<serieAcum2.length; ci2++){
    if(serieAcum2[ci2] < 0){ primeraNeg2 = ci2; break; }
  }
  var cardEl2 = document.getElementById('tes-cobertura-card');
  if(cardEl2){
    var cardCss2 = 'border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:14px';
    var lblCss2  = 'font-family:DM Sans,sans-serif;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;color:rgba(26,22,18,.45)';
    var valCss2  = 'font-family:DM Sans,sans-serif;font-size:18px;font-weight:700';
    var hintCss2 = 'font-family:DM Sans,sans-serif;font-size:12px;margin-top:2px;color:rgba(26,22,18,.5)';
    var html2;
    if(primeraNeg2 === -1){
      html2 = '<div style="background:rgba(30,158,90,.08);border:1px solid rgba(30,158,90,.25);border-left:4px solid #1e9e5a;'+cardCss2+'">'
        +'<div style="font-size:22px;color:#1e9e5a">\u25cf</div>'
        +'<div><div style="'+lblCss2+'">Cobertura financiera</div>'
        +'<div style="'+valCss2+';color:#1e9e5a">Cobertura completa hasta el horizonte proyectado</div>'
        +'<div style="'+hintCss2+'">Saldo acumulado positivo en todo el per\u00edodo</div></div></div>';
    } else if(primeraNeg2 === 0 && saldoIni2 < 0){
      html2 = '<div style="background:rgba(209,67,67,.08);border:1px solid rgba(209,67,67,.25);border-left:4px solid #d14343;'+cardCss2+'">'
        +'<div style="font-size:22px;color:#d14343">\u25cf</div>'
        +'<div><div style="'+lblCss2+'">Cobertura financiera</div>'
        +'<div style="'+valCss2+';color:#d14343">Sin cobertura \u2014 saldo en rojo desde el inicio</div></div></div>';
    } else {
      var fechaCob2 = sems[primeraNeg2] || '\u2014';
      html2 = '<div style="background:rgba(43,111,214,.08);border:1px solid rgba(43,111,214,.25);border-left:4px solid #2b6fd6;'+cardCss2+'">'
        +'<div style="font-size:22px;color:#2b6fd6">\u25cf</div>'
        +'<div><div style="'+lblCss2+'">Cobertura financiera</div>'
        +'<div style="'+valCss2+';color:#0f1e38">Tenemos cobertura hasta la <span style="color:#2b6fd6">semana del '+fechaCob2+'</span></div>'
        +'<div style="'+hintCss2+'">El saldo acumulado se vuelve negativo a partir de esa semana</div></div></div>';
    }
    cardEl2.innerHTML = html2;
  }

  var periodos;
  if(_tesVista==='mensual'){
    var meses={},orden=[];
    sems.forEach(function(s,i){var p=s.split('/'),mk=p[1];var mn={'01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun','07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic'};if(!meses[mk]){meses[mk]={label:(mn[mk]||mk),idxs:[]};orden.push(mk);}meses[mk].idxs.push(i);});
    periodos=orden.map(function(mk){var idxs=meses[mk].idxs,row={label:meses[mk].label};Object.keys(series).forEach(function(k){if(k==='saldo_acumulado'){var last=0;idxs.forEach(function(i){if(series[k][i]!==0)last=series[k][i];});row[k]=last;}else{row[k]=idxs.reduce(function(a,i){return a+(series[k][i]||0);},0);}});return row;});
  }else{
    periodos=sems.slice(0,12).map(function(s,i){var row={label:s};Object.keys(series).forEach(function(k){row[k]=series[k][i]||0;});return row;});
  }
  var N=periodos.length;
  function fC(v){if(!v&&v!==0)return'<span style="color:rgba(26,22,18,.2)">—</span>';var col=v>=0?'var(--green)':'var(--red)';return'<span style="font-family:DM Mono,monospace;color:'+col+'">'+(v>=0?'+':'−')+' $ '+Math.round(Math.abs(v)).toLocaleString('es-AR')+'</span>';}
  function fA(v){var col=v>=0?'#7ecf9c':'#f09090';return'<span style="font-family:DM Mono,monospace;font-weight:700;color:'+col+'">'+(v>=0?'+':'−')+' $ '+Math.round(Math.abs(v)).toLocaleString('es-AR')+'</span>';}
  var TH='font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(26,22,18,.4);padding:9px 11px;text-align:right;font-weight:400;background:rgba(26,22,18,.025);white-space:nowrap;border-bottom:2px solid rgba(26,22,18,.1)';
  var TD='padding:8px 11px;border-bottom:1px solid rgba(26,22,18,.05);text-align:right;white-space:nowrap';
  var h='<thead><tr><th style="'+TH+';text-align:left;min-width:200px">Concepto</th>';
  periodos.forEach(function(p){h+='<th style="'+TH+'">'+p.label+'</th>';});
  h+='</tr></thead><tbody>';
  function secH(lbl,bg){return'<tr><td colspan="'+(N+1)+'" style="background:'+bg+';font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;padding:6px 11px;font-weight:500;border-bottom:1px solid rgba(26,22,18,.07)">'+lbl+'</td></tr>';}
  function detR(lbl,key,ind){var tr='<tr><td style="'+TD+';text-align:left;'+(ind?'padding-left:20px;':'')+';color:rgba(26,22,18,.55);font-size:13px">'+lbl+'</td>';periodos.forEach(function(p){tr+='<td style="'+TD+'">'+fC(p[key]||0)+'</td>';});return tr+'</tr>';}
  function totR(lbl,key,bg2,col){var tr='<tr style="background:'+bg2+'"><td style="'+TD+';text-align:left;font-weight:600;color:'+col+'">'+lbl+'</td>';periodos.forEach(function(p){tr+='<td style="'+TD+';font-weight:600;color:'+col+'">'+fC(p[key]||0)+'</td>';});return tr+'</tr>';}
  h+=secH('▲ INGRESOS','rgba(39,97,61,.06)');
  h+=detR('Cobros venta hacienda','venta_hacienda',true);
  h+=detR('Hotelería y alimentación feedlot','hoteleria',true);
  h+=totR('Total ingresos','total_ingresos','rgba(39,97,61,.06)','var(--green)');
  h+=secH('▼ EGRESOS','rgba(192,57,43,.06)');
  h+=detR('Cheques diferidos (débitos)','cheques_cobro',true);
  h+=detR('Pagos feedlot','pagos_feedlot',true);
  h+=detR('Pagos administración','pagos_admin',true);
  h+=detR('Impuestos','pago_impuestos',true);
  h+=detR('Fletes','pago_flete',true);
  h+=detR('Agricultura','pago_agricultura',true);
  h+=totR('Total egresos','total_egresos','rgba(192,57,43,.06)','var(--red)');
  h+=detR('Darwash (neto)','darwash',false);
  h+='<tr style="background:rgba(26,22,18,.04)"><td style="'+TD+';text-align:left;font-weight:600;font-size:13px">Flujo neto '+(_tesVista==='mensual'?'mensual':'semanal')+'</td>';
  periodos.forEach(function(p){h+='<td style="'+TD+';font-weight:600">'+fC(p.saldo_semanal||0)+'</td>';});
  h+='</tr><tr style="background:var(--ink)"><td style="'+TD+';text-align:left;color:var(--gold-l);font-weight:700;font-size:13px;font-family:DM Mono,monospace;letter-spacing:.04em">SALDO ACUMULADO AL CIERRE</td>';
  periodos.forEach(function(p){h+='<td style="'+TD+'">'+fA(p.saldo_acumulado||0)+'</td>';});
  h+='</tr></tbody>';
  var tbl=document.getElementById('tes-tbl-acum');
  if(tbl)tbl.innerHTML=h;

  // ── Chart.js — gráfico saldo acumulado ──
  var canvas=document.getElementById('tes-canvas-acum');
  if(!canvas)return;
  if(_tesAcumChart){_tesAcumChart.destroy();_tesAcumChart=null;}
  var vals=[flujo.saldo_inicial||0].concat(periodos.map(function(p){return p.saldo_acumulado||0;}));
  var lbls2=['Hoy'].concat(periodos.map(function(p){return p.label;}));
  function fM(v){var a=Math.abs(v),s=(a/1e6).toFixed(1).replace('.',',')+' M';return(v>=0?'+':'-')+'$'+s;}
  var ptColors=vals.map(function(v){return v>=0?'#27613d':'#c0392b';});
  // Inline plugin to draw value labels above/below each point
  var _labelsPlugin={
    id:'tesPointLabels',
    afterDatasetsDraw:function(chart){
      var ctx=chart.ctx,ds=chart.data.datasets[0],meta=chart.getDatasetMeta(0);
      ctx.save();
      ctx.font='700 11px DM Mono,monospace';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      meta.data.forEach(function(pt,i){
        var v=ds.data[i];
        if(v==null)return;
        var col=v>=0?'#27613d':'#c0392b';
        ctx.fillStyle=col;
        var yOff=v>=0?-16:16;
        ctx.fillText(fM(v),pt.x,pt.y+yOff);
      });
      ctx.restore();
    }
  };
  _tesAcumChart=new Chart(canvas,{
    type:'line',
    data:{
      labels:lbls2,
      datasets:[{
        data:vals,
        segment:{
          borderColor:function(ctx){
            var v=vals[ctx.p1DataIndex]||0;return v>=0?'#27613d':'#c0392b';
          }
        },
        pointBackgroundColor:ptColors,
        pointBorderColor:'#fff',
        pointBorderWidth:2,
        pointRadius:5,
        pointHoverRadius:8,
        fill:{target:'origin',above:'rgba(39,97,61,.08)',below:'rgba(192,57,43,.08)'},
        tension:0.2,
        borderWidth:2.5
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{padding:{top:30,bottom:4}},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'rgba(26,22,18,.93)',
          titleFont:{family:'\'DM Mono\',monospace',size:10},
          bodyFont:{family:'\'DM Mono\',monospace',size:11},
          padding:10,
          callbacks:{
            title:function(items){return items[0].label;},
            label:function(item){
              var v=item.raw,sign=v>=0?'+':'−';
              return '  Saldo: '+sign+' $ '+Math.round(Math.abs(v)).toLocaleString('es-AR');
            },
            labelColor:function(item){
              var c=item.raw>=0?'#27613d':'#c0392b';return{borderColor:c,backgroundColor:c};
            }
          }
        }
      },
      scales:{
        x:{
          ticks:{font:{family:'\'DM Mono\',monospace',size:9},color:'rgba(26,22,18,.45)',maxRotation:0},
          grid:{color:'rgba(26,22,18,.04)'},
          border:{color:'rgba(26,22,18,.1)'}
        },
        y:{
          ticks:{
            font:{family:'\'DM Mono\',monospace',size:9},
            color:'rgba(26,22,18,.45)',
            callback:function(v){return fM(v);}
          },
          grid:{color:'rgba(26,22,18,.06)'},
          border:{dash:[4,4],color:'transparent'}
        }
      }
    },
    plugins:[_labelsPlugin]
  });
}

// ── Variaciones entre cortes financieros ──────────────────────────────
function _renderTesVariaciones(histFin, currentTes) {
  var cortes = (histFin.cortes || []).slice().sort(function(a,b){ return a.fecha_corte < b.fecha_corte ? -1 : 1; });
  if (cortes.length < 2) return;
  var prev = cortes[cortes.length - 2];
  var curr = cortes[cortes.length - 1];
  var el   = document.getElementById('tesData');

  // helpers
  function posSum(pos, key) {
    return (pos[key] || []).reduce(function(a,b){ return a + (b.saldo||0); }, 0);
  }
  function posVal(pos, key) { return pos[key] || 0; }
  function fmt(v) {
    return (v >= 0 ? '+' : '−') + ' $ ' + Math.round(Math.abs(v)).toLocaleString('es-AR');
  }
  function fmtAbs(v) {
    var neg = v < 0;
    return (neg ? '− ' : '') + '$ ' + Math.round(Math.abs(v)).toLocaleString('es-AR');
  }
  function fmtAbsCol(v) { return v < 0 ? 'color:#c0392b' : ''; }
  function pct(delta, base) {
    if (!base) return '—';
    var p = (delta / Math.abs(base)) * 100;
    return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
  }
  var pPos = prev.posicion || {};
  var cPos = curr.posicion || {};
  var pCheq = (prev.cheques || {}).total_cartera || 0;
  var cCheq = (curr.cheques || {}).total_cartera || 0;

  // Build rows: [label, prev, curr, delta, sign, note]
  function mkRows() {
    var rows = [];
    function add(lbl, pv, cv, note, indent) {
      var d = cv - pv;
      rows.push({ lbl: lbl, pv: pv, cv: cv, d: d, note: note || '', indent: !!indent });
    }
    // DISPONIBILIDADES
    rows.push({ header: true, lbl: 'DISPONIBILIDADES' });
    var pBancPeg = posSum(pPos,'bancos_peg'), cBancPeg = posSum(cPos,'bancos_peg');
    var pBancBull = posSum(pPos,'bancos_bull'), cBancBull = posSum(cPos,'bancos_bull');
    add('Bancos Pecuaria', pBancPeg, cBancPeg, 'Saldo neto cuentas bancarias PEGSA', true);
    add('Bancos Bulltrade', pBancBull, cBancBull, 'Saldo neto cuentas bancarias BULL', true);
    var pFCI = posVal(pPos,'fci'), cFCI = posVal(cPos,'fci');
    add('Inversiones (FCI / Bursátil)', pFCI, cFCI, 'Becerra + FIMA rescates/suscripciones', true);
    var pEcheq = posVal(pPos,'echeq'), cEcheq = posVal(cPos,'echeq');
    add('ECheqs al cobro', pEcheq, cEcheq, 'Cheques presentados al cobro', true);
    var pDisp = posVal(pPos,'saldo_disponibilidades'), cDisp = posVal(cPos,'saldo_disponibilidades');
    add('TOTAL DISPONIBLE', pDisp, cDisp, '');

    // OBLIGACIONES
    rows.push({ header: true, lbl: 'OBLIGACIONES DE PAGO' });
    add('Cartera de cheques emitidos', pCheq, cCheq, 'Compromisos diferidos totales');
    // Darwash debits
    var pDwEg = 0, cDwEg = 0, pDwIng = 0, cDwIng = 0;
    (prev.darwash || []).forEach(function(dw){
      (dw.items||[]).forEach(function(it){ if(it.tipo==='egreso') pDwEg += Math.abs(it.monto||0); else pDwIng += it.monto||0; });
    });
    (curr.darwash || []).forEach(function(dw){
      (dw.items||[]).forEach(function(it){ if(it.tipo==='egreso') cDwEg += Math.abs(it.monto||0); else cDwIng += it.monto||0; });
    });
    add('Obligaciones Darwash (hacienda egresos)', pDwEg, cDwEg, 'Total compromisos de pago Darwash', true);
    add('Cobros Darwash (hacienda ingresos)', pDwIng, cDwIng, 'Total cobros esperados Darwash', true);

    // COBROS PENDIENTES
    rows.push({ header: true, lbl: 'COBROS DE HACIENDA PENDIENTES' });
    var pVentas = 0, cVentas = 0;
    ((prev.hacienda||{}).ventas||[]).forEach(function(v){ pVentas += v.monto||0; });
    ((curr.hacienda||{}).ventas||[]).forEach(function(v){ cVentas += v.monto||0; });
    add('Ventas de hacienda a cobrar', pVentas, cVentas, 'Facturas emitidas pendientes de cobro');
    var pCompras = 0, cCompras = 0;
    ((prev.hacienda||{}).compras||[]).forEach(function(v){ pCompras += v.monto||0; });
    ((curr.hacienda||{}).compras||[]).forEach(function(v){ cCompras += v.monto||0; });
    if (pCompras || cCompras) add('Compras de hacienda a pagar', pCompras, cCompras, 'Hacienda comprada pendiente de pago');

    // USD
    rows.push({ header: true, lbl: 'POSICIÓN USD' });
    add('Dólares en ARS equivalente', posVal(pPos,'usd_ars'), posVal(cPos,'usd_ars'),
        posVal(cPos,'usd_cant').toLocaleString('es-AR') + ' USD valuados a tipo de cambio');

    return rows;
  }

  var rows = mkRows();
  var TH = 'font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.42);padding:9px 14px;background:rgba(26,22,18,.03);border-bottom:2px solid rgba(26,22,18,.1);white-space:nowrap;text-align:right;font-weight:400';
  var TD = 'padding:8px 14px;border-bottom:1px solid rgba(26,22,18,.06);vertical-align:middle';

  var fechaPrev = (prev.fecha_corte||'').split('-').reverse().join('/');
  var fechaCurr = (curr.fecha_corte||'').split('-').reverse().join('/');

  var html = '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Sección 7 · Variaciones entre Cortes</div>'
    +'<div style="font-family:DM Mono,monospace;font-size:12px;color:rgba(26,22,18,.45);margin-bottom:16px">Comparación <strong style="color:var(--ink)">' + fechaPrev + '</strong> → <strong style="color:var(--ink)">' + fechaCurr + '</strong> · Los cambios explican el movimiento del saldo acumulado al cierre.</div>';

  html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:8px"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:640px">';
  html += '<thead><tr>'
    +'<th style="'+TH+';text-align:left;min-width:220px">Concepto</th>'
    +'<th style="'+TH+'">'+fechaPrev+'</th>'
    +'<th style="'+TH+'">'+fechaCurr+'</th>'
    +'<th style="'+TH+'">Variación $</th>'
    +'<th style="'+TH+'">%</th>'
    +'<th style="'+TH+';text-align:left">Nota</th>'
    +'</tr></thead><tbody>';

  rows.forEach(function(row) {
    if (row.header) {
      html += '<tr><td colspan="6" style="background:rgba(26,22,18,.04);font-family:DM Mono,monospace;font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;padding:7px 14px;border-bottom:1px solid rgba(26,22,18,.08);color:rgba(26,22,18,.5);font-weight:500">'+row.lbl+'</td></tr>';
      return;
    }
    var isTotal = row.lbl.indexOf('TOTAL') === 0;
    var dCol = row.d > 0 ? 'var(--green)' : row.d < 0 ? 'var(--red)' : 'rgba(26,22,18,.4)';
    var rowBg = isTotal ? 'background:rgba(26,22,18,.03);' : '';
    var lpad = row.indent ? 'padding-left:24px;' : '';
    var pvNeg = fmtAbsCol(row.pv), cvNeg = fmtAbsCol(row.cv);
    html += '<tr style="'+rowBg+'">'
      +'<td style="'+TD+';text-align:left;'+lpad+(isTotal?'font-weight:600;':'color:rgba(26,22,18,.7);')+'">'+row.lbl+'</td>'
      +'<td style="'+TD+';text-align:right;font-family:DM Mono,monospace;color:rgba(26,22,18,.5);'+pvNeg+'">'+fmtAbs(row.pv)+'</td>'
      +'<td style="'+TD+';text-align:right;font-family:DM Mono,monospace;color:var(--ink)'+(isTotal?';font-weight:600':'')+(cvNeg?';'+cvNeg:'')+'">'+fmtAbs(row.cv)+'</td>'
      +'<td style="'+TD+';text-align:right;font-family:DM Mono,monospace;font-weight:600;color:'+dCol+'">'+(row.d!==0?fmt(row.d):'—')+'</td>'
      +'<td style="'+TD+';text-align:right;font-family:DM Mono,monospace;font-size:12px;color:'+dCol+'">'+pct(row.d,row.pv)+'</td>'
      +'<td style="'+TD+';text-align:left;font-size:12px;color:rgba(26,22,18,.4)">'+row.note+'</td>'
      +'</tr>';
  });

  html += '</tbody></table></div>';
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.35);line-height:1.7;margin-top:4px">'
    +'✦ Verde = mejora la posición líquida &nbsp;·&nbsp; Rojo = consume posición líquida &nbsp;·&nbsp; '
    +'Darwash son compensaciones de hacienda entre PEGSA y BULL.'
    +'</div>';

  var sec7 = document.createElement('div');
  sec7.style.cssText = 'margin-bottom:36px';
  sec7.innerHTML = html;
  el.appendChild(sec7);
}
