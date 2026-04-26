/* modulo-07-simulador.js — Simulador Feedlot (terneros, terneras, vacas, invernada) · 2026-04-26 */

// ── SIMULADOR FEEDLOT ─────────────────────────────────────────
var SIM_ACTIVE_TAB = 'terneros';
var SIM_INITED = false;

function simTab(tab, el){
  document.querySelectorAll('#screenSimulador .nav-tab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  SIM_ACTIVE_TAB = tab;
  ['terneros','terneras','vacas','invernada'].forEach(function(t){
    document.getElementById('panelSim'+t.charAt(0).toUpperCase()+t.slice(1)).style.display = t===tab?'block':'none';
  });
  calcSim(tab);
}

function f2(n){ return Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function fp(n){ return (Number(n||0)*100).toFixed(1)+'%'; }

// ── Tablas de lookup (desde hoja 'tabla' del Excel) ──────────────────
// "Tabla de nico Engordes": % engorde según tipo y peso de ENTRADA
// ADP (kg/día) = pesoPromedio × _simAdpPct(tipo, pesoE) / 100
// Machos (terneros): ternero <250kg → 39% | novillito 250-350 → 37% | novillo ≥350 → 34%
// Hembras (terneras): 38% en todo el rango (ternera y vaquillona coinciden)
// Vacas: 32%   Invernada: 27%
function _simAdpPct(tipo, pesoE){
  if(tipo === 'terneros'){
    if(pesoE <  250) return 0.39;   // ternero
    if(pesoE <  350) return 0.37;   // novillito
    return 0.34;                     // novillo ≥ 350 kg
  }
  if(tipo === 'terneras') return 0.38;  // ternera / vaquillona
  if(tipo === 'vacas')    return 0.32;
  return 0.27; // invernada (manual)
}
// Tabla de referencia (para mostrar sub-categoría en UI)
function _simSubcat(tipo, pesoE){
  if(tipo === 'terneros'){
    if(pesoE <  250) return 'Ternero';
    if(pesoE <  350) return 'Novillito';
    return 'Novillo';
  }
  if(tipo === 'terneras'){
    return pesoE < 250 ? 'Ternera' : 'Vaquillona';
  }
  return '';
}

// MS% por ingrediente (materia seca / tal cual): maíz, silo, gluten, núcleo, germen
var SIM_MS_INGR = [0.88, 0.37, 0.42, 0.975, 0.98];

// Sistema de 3 etapas de dieta por categoría (extraído de las hojas de simulación del Excel)
// comp=[maíz%,silo%,gluten%,núcleo%,germen%]; dias=días fijos (null=todos los restantes)
// Lookup MS/PV se hace con PESO AL FINAL de cada etapa; consumo diario usa peso PROMEDIO etapa
var SIM_ETAPAS = {
  terneros: [                              // hoja 'simulacion terneros (2)'
    {comp:[37,20,31,4,8],   dias:10},      // Etapa 1: adaptación 10 días (fijos)
    {comp:[35,22,31,4,8],   dias:60},      // Etapa 2: desarrollo máx 60 días  ← fórmula Excel: IF(dias-10<60, dias-10, 60)
    {comp:[36,22,30,4,8],   dias:null}     // Etapa 3: terminación (días restantes si estadía > 70 días)
  ],
  terneras: [                              // hoja 'simulacion terneras (3)'
    {comp:[38,23,26,4,9],   dias:10},      // Etapa 1: adaptación 10 días
    {comp:[37,21,30,4,8],   dias:30},      // Etapa 2: crecimiento 30 días
    {comp:[37,21,30,4,8],   dias:null}     // Etapa 3: terminación (días restantes)
  ],
  vacas: [                                 // hoja 'vacas'
    {comp:[50,50,0,0,0],    dias:5},       // Etapa 1: adaptación 5 días (solo maíz+silo)
    {comp:[32,21,31,4,12],  dias:30},      // Etapa 2: desarrollo 30 días
    {comp:[33,20,31,4,12],  dias:null}     // Etapa 3: terminación (días restantes)
  ]
};

// Composición dieta promedio ponderada (columna "Total" del Excel) — solo para referencia/calcRacion
var SIM_DIETA = {
  terneros: [35.27343, 21.72657, 31.00000, 4.00000,  8.00000],
  terneras: [37.05847, 21.11693, 29.76614, 4.00000,  8.05847],
  vacas:    [33.54376, 21.81818, 29.44212, 3.79898, 11.39695],
  invernada:[100,      0,        0,        0,         0      ]
};
// Flete local fijo para calcular maíz neto en feedlot:
// maíz_neto = pizarra − contraflete(37000) + flete_local(15000)
var SIM_MAIZ_CONTRAFLETE = 37000;
var SIM_MAIZ_FLETE_LOCAL = 15000;

// Tabla MS/Peso Vivo para machos/hembras (MACHOS-HEMBRAS de 'tabla')
var SIM_MS_TABLE_GEN = [
  [0,80,0.03089],[80,100,0.03115],[100,150,0.02913],[150,200,0.0275],
  [200,250,0.02862],[250,300,0.0306],[300,350,0.0269],[350,9999,0.0245]
];
// Tabla MS/Peso Vivo para VACAS
var SIM_MS_TABLE_VAC = [[0,380,0.0293],[380,9999,0.0273]];
// Ratio MS/TC (materia seca / tal cual) por categoría
var SIM_MSTC = {terneros:0.6384, terneras:0.6472, vacas:0.6483, invernada:0.6384};

function simLookupMS(table, avgW){
  for(var i=0;i<table.length;i++){
    if(avgW>=table[i][0] && avgW<table[i][1]) return table[i][2];
  }
  return table[table.length-1][2];
}

function calcRacion(pfx, tipo){
  function gv(id){ var el=document.getElementById(pfx+'-'+id); return el ? (parseFloat(el.value)||0) : 0; }
  var maiz_pizarra = gv('maiz');
  var gluten = gv('gluten');
  var nucleo = gv('nucleo');
  var germen = gv('germen');
  var silo   = gv('silo');
  // Precio neto del maíz en feedlot: pizarra - contraflete + flete_local
  var maiz_neto = Math.max(0, maiz_pizarra - SIM_MAIZ_CONTRAFLETE + SIM_MAIZ_FLETE_LOCAL);
  // Composición según categoría (% del total de ración, base tal-cual)
  var comp = SIM_DIETA[tipo] || SIM_DIETA['terneros'];
  // costo $/kgTC = Σ(proporción_i × precio_i_tn / 1000)
  var cRaw = (comp[0]*maiz_neto + comp[1]*silo + comp[2]*gluten + comp[3]*nucleo + comp[4]*germen) / 100 / 1000;
  return cRaw * 1.15; // factor IVA agropecuario
}

function calcSim(tipo){
  var pfx = tipo==='terneros'?'tn': tipo==='terneras'?'ta': tipo==='vacas'?'va':'in';
  var G = function(id){ var el=document.getElementById(pfx+'-'+id); return el ? (parseFloat(el.value)||0) : 0; };

  // ── Auto-update ración from ingredient prices ─────────────────────
  var racEl = document.getElementById(pfx+'-racion');
  if(racEl){
    var racVal;
    if(tipo === 'invernada'){
      // Invernada: solo suplemento maíz → costo = precio maíz $/tn ÷ 1000
      var mzEl = document.getElementById(pfx+'-maiz');
      racVal = Math.round((parseFloat((mzEl||{}).value)||0) / 1000);
    } else {
      racVal = Math.round(calcRacion(pfx, tipo));
    }
    racEl.value = racVal;
  }

  var pesoE  = G('pe');
  var pesoS  = G('ps');
  var mort   = G('mort')/100;
  var pc     = G('pc');
  var kmo    = G('kmo');
  var kmd    = G('kmd');
  var pflete = G('pflete');
  var comC   = G('ccom')/100;
  var comV   = G('cvta')/100;
  var guias  = G('guias');
  var racion = parseFloat(document.getElementById(pfx+'-racion').value)||0;
  var hotel  = G('hotel');
  var sanidad = G('sanidad');
  var pcarne = tipo!=='invernada' ? G('pcarne') : 0;
  var rend   = tipo!=='invernada' ? G('rend')/100 : 0;
  var decomiso = G('decomiso')/100;

  if(!pesoE||!pesoS) return;

  var pesoPromedio = (pesoE + pesoS) / 2;

  // ── Auto-calc ADP de tablas ────────────────────────────────────────
  // (consumo TC y racion se calculan en el bloque de etapas más abajo)
  var aumento, consumoPct;
  if(tipo === 'invernada'){
    aumento    = G('ad');
    consumoPct = G('consumo')/100;
  } else {
    aumento = pesoPromedio * _simAdpPct(tipo, pesoE) / 100;
    // consumoPct se calculará por etapas; esto es solo fallback
    var msTable = tipo==='vacas' ? SIM_MS_TABLE_VAC : SIM_MS_TABLE_GEN;
    var msPct   = simLookupMS(msTable, pesoPromedio);
    consumoPct  = msPct / SIM_MSTC[tipo];
  }

  // ── Auto-calc Precio Venta from pcarne × rendimiento ─────────────
  var pv;
  if(tipo !== 'invernada' && pcarne && rend){
    pv = pcarne * rend;
    var pvEl = document.getElementById(pfx+'-pv');
    if(pvEl) pvEl.value = Math.round(pv);
  } else {
    pv = G('pv');
  }

  if(!aumento) return;
  if(pesoE >= pesoS) return;

  var dias = (pesoS - pesoE) / aumento;
  var kgsProducidos = pesoS - pesoE;

  // ── Cálculo de alimentación por etapas (3-stage diet system) ─────────────────
  var consumoDiario, alimentacion;
  var stageResults = []; // para el cuadro de dieta
  if(tipo !== 'invernada'){
    var etapas3 = SIM_ETAPAS[tipo];
    var gvP = function(id){ var el=document.getElementById(pfx+'-'+id); return el?(parseFloat(el.value)||0):0; };
    var maiz_neto3 = Math.max(0, gvP('maiz') - SIM_MAIZ_CONTRAFLETE + SIM_MAIZ_FLETE_LOCAL);
    var silo3=gvP('silo'), gluten3=gvP('gluten'), nucleo3=gvP('nucleo'), germen3=gvP('germen');
    var msT3 = tipo==='vacas' ? SIM_MS_TABLE_VAC : SIM_MS_TABLE_GEN;
    var wNow=pesoE, dLeft=dias, totTC=0, totAlim=0;
    for(var ei=0; ei<etapas3.length; ei++){
      var et3=etapas3[ei];
      var sd = et3.dias!==null ? Math.min(et3.dias, dLeft) : dLeft;
      // Leer composición desde los inputs del cuadro de dieta
      var sn=ei+1;
      var gd=function(ingr,sn2){ var el=document.getElementById(pfx+'-d'+sn2+'-'+ingr); return el?(parseFloat(el.value)||0):0; };
      var c3=[gd('maiz',sn), gd('silo',sn), gd('gluten',sn), gd('nucleo',sn), gd('germen',sn)];
      if(sd<=0){
        stageResults.push({sd:0, wEnd:wNow, msTC:0, msPV:0, tcPV:0, cdS:0, stTC:0, stRac:0, stAlim:0, comp:c3});
        continue;
      }
      var wEnd = wNow + aumento*sd;
      var wAvg = (wNow+wEnd)/2;
      // MS/TC de esta etapa = suma(comp_i × MS_ingr_i) / 100
      var msTC3=(c3[0]*SIM_MS_INGR[0]+c3[1]*SIM_MS_INGR[1]+c3[2]*SIM_MS_INGR[2]+c3[3]*SIM_MS_INGR[3]+c3[4]*SIM_MS_INGR[4])/100;
      // MS/PV lookup con PESO FIN etapa
      var msPV3=simLookupMS(msT3, wEnd);
      // Consumo diario TC = (MS/PV ÷ MS/TC) × peso_promedio_etapa
      var tcPV3 = msTC3>0 ? msPV3/msTC3 : 0;
      var cdS=(tcPV3)*wAvg;
      var stTC=cdS*sd;
      // Costo ración esta etapa ($/kgTC c/IVA)
      var stRac=(c3[0]*maiz_neto3+c3[1]*silo3+c3[2]*gluten3+c3[3]*nucleo3+c3[4]*germen3)/100/1000*1.15;
      totTC+=stTC; totAlim+=stRac*stTC;
      stageResults.push({sd:sd, wEnd:wEnd, wAvg:wAvg, msTC:msTC3, msPV:msPV3, tcPV:tcPV3, cdS:cdS, stTC:stTC, stRac:stRac, stAlim:stRac*stTC, comp:c3});
      wNow=wEnd; dLeft-=sd;
    }
    consumoDiario = totTC/dias;
    alimentacion  = totAlim;
    // Ración ponderada = costo total / TC total
    racion = totTC>0 ? totAlim/totTC : racion;
    if(racEl) racEl.value = Math.round(racion);
    var tcEl2=document.getElementById(pfx+'-consumo');
    if(tcEl2) tcEl2.value=(consumoDiario/pesoPromedio*100).toFixed(3);
    var adEl2=document.getElementById(pfx+'-ad');
    if(adEl2) adEl2.value=aumento.toFixed(3);
    var subcatEl=document.getElementById(pfx+'-subcat');
    if(subcatEl){ var sc=_simSubcat(tipo,pesoE); subcatEl.textContent=sc?'· '+sc:''; }
    // ── Actualizar cuadro de dieta ─────────────────────────────────────────────
    var ingrs=['maiz','silo','gluten','nucleo','germen'];
    // Sumas por columna y ponderados
    for(var ii=0;ii<etapas3.length;ii++){
      var sr=stageResults[ii]||{comp:[0,0,0,0,0]};
      var sumCol=sr.comp.reduce(function(a,b){return a+b;},0);
      var sumEl=document.getElementById(pfx+'-dsum'+(ii+1));
      if(sumEl){sumEl.textContent=sumCol.toFixed(0)+'%'; sumEl.className=Math.abs(sumCol-100)>0.5?'sdt-warn':'';}
    }
    // Columna ponderada por ingrediente
    for(var ii2=0;ii2<ingrs.length;ii2++){
      var wsum=0;
      for(var jj=0;jj<stageResults.length;jj++) wsum+=(stageResults[jj].comp[ii2]||0)*(stageResults[jj].stTC||0);
      var wEl=document.getElementById(pfx+'-dw-'+ingrs[ii2]);
      if(wEl) wEl.textContent=(totTC>0?(wsum/totTC).toFixed(1):'—')+'%';
    }
    // Métricas calculadas (tbody dinámico)
    var db=document.getElementById('simDieta-'+tipo);
    if(db){
      var labels=['E1','E2','E3']; var nc=etapas3.length; var rows='';
      var fn1=function(v){return v>0?v.toFixed(1):'—';};
      var fn2=function(v){return v>0?v.toFixed(2):'—';};
      var fn3=function(v){return v>0?(v*100).toFixed(2)+'%':'—';};
      var fnm=function(v){return v>0?'$'+Math.round(v).toLocaleString('es-AR'):'—';};
      rows+='<tr class="sdt-calc"><td>Días etapa</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]?fn1(stageResults[i].sd):'—')+'</td>';
      rows+='<td><b>'+fn1(dias)+'</b></td></tr>';
      rows+='<tr class="sdt-calc"><td>MS dieta (%)</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]&&stageResults[i].sd>0?(stageResults[i].msTC*100).toFixed(2)+'%':'—')+'</td>';
      rows+='<td>'+(totTC>0?(stageResults.reduce(function(a,s){return a+(s.msTC*s.stTC);},0)/totTC*100).toFixed(2)+'%':'—')+'</td></tr>';
      rows+='<tr class="sdt-calc"><td>MS/PV</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]&&stageResults[i].sd>0?stageResults[i].msPV.toFixed(4):'—')+'</td>';
      rows+='<td>—</td></tr>';
      rows+='<tr class="sdt-calc"><td>TC/PV (%)</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]&&stageResults[i].sd>0?fn3(stageResults[i].tcPV):'—')+'</td>';
      rows+='<td>'+(totTC>0&&dias>0?fn3(consumoDiario/pesoPromedio):'—')+'</td></tr>';
      rows+='<tr class="sdt-calc"><td>kg TC/día</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]&&stageResults[i].sd>0?fn1(stageResults[i].cdS):'—')+'</td>';
      rows+='<td>'+fn1(consumoDiario)+'</td></tr>';
      rows+='<tr class="sdt-total"><td>Total TC (cab)</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]?fn1(stageResults[i].stTC):'—')+'</td>';
      rows+='<td><b>'+fn1(totTC)+'</b></td></tr>';
      rows+='<tr class="sdt-calc"><td>$/kg TC c/IVA</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]&&stageResults[i].sd>0?'$'+stageResults[i].stRac.toFixed(1):'—')+'</td>';
      rows+='<td>$'+(totTC>0?(totAlim/totTC).toFixed(1):'—')+'</td></tr>';
      rows+='<tr class="sdt-alim"><td>Alimentación ($)</td>';
      for(var i=0;i<nc;i++) rows+='<td>'+(stageResults[i]?fnm(stageResults[i].stAlim):'—')+'</td>';
      rows+='<td><b>'+fnm(totAlim)+'</b></td></tr>';
      db.innerHTML=rows;
    }
  } else {
    consumoDiario = consumoPct * pesoPromedio;
    alimentacion  = racion * consumoDiario * dias;
  }

  // ── Compra neta (por cab) ─────────────────────────────────────────
  // Flete compra: fórmula por categoría (extraída de hojas Excel individuales)
  //   terneros:  (km×flete)/12000          — sin cargo fijo
  //   terneras:  (km×flete+110000)/12000   — con cargo fijo 110,000
  //   vacas:     (km×flete+11000)/13950    — camión ~14tn (13,950 kg cap.)
  var fleteC;
  if(tipo === 'vacas')       fleteC = (kmo * pflete + 11000) / 13950;
  else if(tipo === 'terneras') fleteC = (kmo * pflete + 110000) / 12000;
  else                         fleteC = (kmo * pflete) / 12000;  // terneros + invernada
  var gastoC = fleteC + pc * comC;
  var compraNeta    = (pc + gastoC) * pesoE;
  var compraNeta_kg = compraNeta / pesoE;  // $/kg pie neto c/gastos
  var hoteleriaTotal = hotel * dias;
  var totalCostos   = alimentacion + hoteleriaTotal + sanidad;
  var costoPorKg    = kgsProducidos > 0 ? totalCostos / kgsProducidos : 0;

  // ── Venta neta (por cab) ──────────────────────────────────────────
  // Camión 19tn para faena (igual para todas las categorías)
  var fleteV = (kmd * pflete) / 19000; // $/kg pie
  var gastoVkgPie = fleteV + pv * comV + (pesoS > 0 ? guias/pesoS : 0) + pv * decomiso;
  var ventaNetaPorKg = pv - gastoVkgPie;
  var ingresoVenta   = ventaNetaPorKg * pesoS;  // Excel: venta plena s/descuento mort

  // ── Mortandad (Excel: costo separado, no descuento sobre venta) ───
  // mort = tasa mensual (G('mort')/100); mortTotal = fracción real del lote perdida
  var mortTotal = dias > 0 ? mort * dias / 30 : 0;
  // Costo mort = peso_promedio × pct_perdido × precio_promedio (compra+venta)/2
  var mortCost  = (pesoE + pesoS) / 2 * mortTotal * (ventaNetaPorKg + compraNeta_kg) / 2;

  // ── Resultado (por cab) ───────────────────────────────────────────
  var resEco     = ingresoVenta - compraNeta - mortCost - totalCostos;
  var resPorKg   = kgsProducidos > 0 ? resEco / kgsProducidos : 0;
  // Resultado Comercial = pesoE × (venta_neta_kg − compra_neta_kg)  [Excel K16 = J6*(L5−L6)]
  var resComercial  = pesoE * (ventaNetaPorKg - compraNeta_kg);
  var resProduccion = resEco - resComercial;

  // ── Puntos de Equilibrio (fórmulas exactas del Excel) ────────────
  // pvInd (pie) = ((costos+compra)/pesoS + fleteV + guias/pesoS) / (1−comV)  [Excel C35]
  var pvIndiferencia  = pesoS > 0 ? ((totalCostos + compraNeta) / pesoS + fleteV + guias/pesoS) / (1 - comV) : 0;
  // pcInd           = ((venta − costos) / pesoE − fleteC) / (1+comC)         [Excel C36]
  var pcIndiferencia  = pesoE > 0 ? ((ingresoVenta - totalCostos) / pesoE - fleteC) / (1 + comC) : 0;
  // racInd          = (saldo_cv − hotel − san) / totalTC                     [Excel C37 = (K8−K11−K12)/J10]
  var racIndiferencia = consumoDiario*dias > 0 ? (ingresoVenta - compraNeta - mortCost - hoteleriaTotal - sanidad) / (consumoDiario*dias) : 0;

  // ── Análisis Financiero ───────────────────────────────────────────
  var capital  = compraNeta + totalCostos;
  var roi      = capital > 0 ? resEco / capital : 0;
  var tirAnual = dias > 0 ? roi * (365 / dias) : 0;

  // Relación compra/venta
  var rcv      = pc > 0 ? pv / pc : 0;
  var rcvCarne = pc > 0 && rend > 0 ? (pv / rend) / pc : 0;
  var ciclos   = dias > 0 ? 365 / dias : 0;

  var isPos    = resEco >= 0;
  var resColor = isPos ? 'sim-res-pos' : 'sim-res-neg';
  var tirColor = tirAnual >= 0 ? 'sim-res-pos' : 'sim-res-neg';
  var rcPos    = resComercial >= 0 ? 'sim-res-pos' : 'sim-res-neg';
  var rpPos    = resProduccion >= 0 ? 'sim-res-pos' : 'sim-res-neg';

  var html = '<table class="sim-res-table">';
  html += '<tr><td colspan="2" class="sim-section">Productivo</td></tr>';
  html += '<tr><td>Días en engorde</td><td><b>'+Math.round(dias)+'</b> días · '+ciclos.toFixed(2)+' ciclos/año</td></tr>';
  html += '<tr><td>Kgs a producir / cab</td><td>'+f2(kgsProducidos)+' kg</td></tr>';
  var subcatLabel = _simSubcat(tipo, pesoE);
  html += '<tr><td>ADP (Aumento Diario de Peso)</td><td>'+aumento.toFixed(3)+' kg/día'+(subcatLabel?' <span style="color:rgba(26,22,18,.45);font-size:0.88em">· '+subcatLabel+'</span>':'')+'</td></tr>';
  html += '<tr><td>Consumo diario TC</td><td>'+consumoDiario.toFixed(1)+' kg/día · total '+f2(consumoDiario*dias)+' kgTC/cab</td></tr>';

  html += '<tr><td colspan="2" class="sim-section">Costos de Producción</td></tr>';
  html += '<tr><td>Costo Ración ($/kgTC)</td><td>$'+racion.toFixed(1)+'</td></tr>';
  html += '<tr><td>Alimentación</td><td>$'+f2(alimentacion)+' / cab</td></tr>';
  html += '<tr><td>Hotelería ('+Math.round(dias)+' días × $'+f2(hotel)+')</td><td>$'+f2(hoteleriaTotal)+' / cab</td></tr>';
  html += '<tr><td>Sanidad</td><td>$'+f2(sanidad)+' / cab</td></tr>';
  html += '<tr class="sim-total"><td>TOTAL COSTOS PRODUCTIVOS</td><td>$'+f2(totalCostos)+' / cab &nbsp;·&nbsp; <b>$'+f2(costoPorKg)+' / kg</b></td></tr>';

  html += '<tr><td colspan="2" class="sim-section">Compra</td></tr>';
  html += '<tr><td>Flete compra ('+f2(kmo)+' km)</td><td>$'+fleteC.toFixed(1)+' / kg</td></tr>';
  html += '<tr><td>Precio compra neto (c/gastos)</td><td>$'+f2(compraNeta_kg)+' / kg &nbsp;·&nbsp; $'+f2(compraNeta)+' / cab</td></tr>';

  html += '<tr><td colspan="2" class="sim-section">Venta</td></tr>';
  html += '<tr><td>Precio venta bruto ($/kg pie)</td><td>$'+f2(pv)+'</td></tr>';
  html += '<tr><td>Flete venta ('+f2(kmd)+' km, camión 19tn)</td><td>$'+fleteV.toFixed(1)+' / kg</td></tr>';
  if(decomiso>0) html += '<tr><td>Decomiso ('+G('decomiso').toFixed(2)+'%)</td><td>$'+f2(pv*decomiso)+' / kg</td></tr>';
  html += '<tr><td>Precio venta neto (c/gastos)</td><td>$'+f2(ventaNetaPorKg)+' / kg</td></tr>';
  if(mortTotal>0){
    html += '<tr><td>Importe venta bruto / cab</td><td>$'+f2(ingresoVenta)+'</td></tr>';
    html += '<tr><td>Mortandad ('+fp(mortTotal)+' total · '+fp(mort)+'/mes)</td><td>−$'+f2(mortCost)+'</td></tr>';
    html += '<tr><td><b>Importe venta neto / cab</b></td><td><b>$'+f2(ingresoVenta-mortCost)+'</b></td></tr>';
  } else {
    html += '<tr><td>Importe venta neto / cab</td><td>$'+f2(ingresoVenta)+'</td></tr>';
  }
  if(pcarne>0) html += '<tr><td>Relación compra/venta bruta</td><td>'+rcv.toFixed(3)+'x &nbsp;|&nbsp; carne: '+rcvCarne.toFixed(3)+'x</td></tr>';

  html += '<tr><td colspan="2" class="sim-section">Resultado Económico</td></tr>';
  html += '<tr><td>Resultado Comercial <span style="font-size:11px;opacity:.6">(delta precio × kg entrada)</span></td><td class="'+rcPos+'">$'+f2(resComercial)+' / cab</td></tr>';
  html += '<tr><td>Resultado Producción <span style="font-size:11px;opacity:.6">(valor producido − costos)</span></td><td class="'+rpPos+'">$'+f2(resProduccion)+' / cab</td></tr>';
  html += '<tr class="sim-total"><td>RESULTADO ECONÓMICO TOTAL</td><td class="'+resColor+'">$'+f2(resEco)+' / cab &nbsp;·&nbsp; $'+f2(resPorKg)+' / kg</td></tr>';

  html += '<tr><td colspan="2" class="sim-section">Análisis Financiero</td></tr>';
  html += '<tr><td>Capital empleado total</td><td>$'+f2(capital)+' / cab</td></tr>';
  html += '<tr><td>Retorno sobre inversión</td><td class="'+resColor+'">'+fp(roi)+'</td></tr>';
  html += '<tr class="sim-total"><td>TIR ANUAL EQUIVALENTE</td><td class="'+tirColor+'">'+fp(tirAnual)+'</td></tr>';

  html += '<tr><td colspan="2" class="sim-section">Puntos de Equilibrio</td></tr>';
  html += '<tr><td>Precio venta indiferencia (en pie)</td><td>$'+f2(pvIndiferencia)+' / kg &nbsp;<span class="'+(pv>=pvIndiferencia?'sim-res-pos':'sim-res-neg')+'">('+(pv>=pvIndiferencia?'+':'')+f2(pv-pvIndiferencia)+')</span></td></tr>';
  html += '<tr><td>Precio compra indiferencia (en pie)</td><td>$'+f2(pcIndiferencia)+' / kg &nbsp;<span class="'+(pc<=pcIndiferencia?'sim-res-pos':'sim-res-neg')+'">('+(pc<=pcIndiferencia?'+':'')+f2(pc-pcIndiferencia)+')</span></td></tr>';
  html += '<tr><td>Precio ración indiferencia</td><td>$'+f2(racIndiferencia)+' / kgTC</td></tr>';

  // ── Impositivo + Costo Financiero (informativo) ───────────────────────────
  if(tipo !== 'invernada'){
    // Inputs CF
    var tcf     = (G('tcf') || 32) / 100;           // tasa anual CF (default 32%)
    var pcfCom  = G('pcf-com') || 30;                // plazo cobro compra
    var pcfVta  = G('pcf-vta') || 30;                // plazo cobro venta

    // Días financiamiento (Excel: K33 = C7 - I33 + J33)
    var diasFin     = Math.max(0, dias - pcfCom + pcfVta);
    var tasaAplicar = tcf / 365 * diasFin;

    // Costo financiero
    var cfHacienda = tasaAplicar * compraNeta;       // Excel: L33 × K6 (compra neta importe)
    var cfAlimento = tasaAplicar * totalCostos;      // Excel: L34 × K14 (total costos productivos)
    var cfTotal    = cfHacienda + cfAlimento;

    // Impositivo (ganadería, sin ahorros CF propios)
    // Ret. Ganancias: -2% sobre ingreso venta neto (Excel K19 ≈ -2% × K5)
    var retGcias = -0.02 * ingresoVenta;
    // IVA ganadería (simplificado desde fórmula Excel K20):
    //   Débito:  venta_bruta × 10.5%
    //   Crédito: comVta × venta × 10.5% + compra_bruta × 10.5% + fleteC × 21% + fleteV × 21% + alimentacion × 10.5% + hoteleria × 21% + sanidad × 21%
    var ventaBruta  = pv * pesoS;
    var compraBruta = pc * (1 + comC) * pesoE;
    var ivaDebito   = ventaBruta * 0.105;
    var ivaCredito  = (comV * ventaBruta * 0.105)
                    + (compraBruta * 0.105)
                    + (fleteC * pesoE * 0.21)
                    + (fleteV * pesoS * 0.21)
                    + (alimentacion * 0.105)
                    + (hoteleriaTotal * 0.21)
                    + (sanidad * 0.21);
    var ivaNeto     = ivaDebito - ivaCredito;
    var impNeto     = retGcias + ivaNeto;             // total impositivo neto

    // Resultados finales
    var resConImp   = resEco + impNeto;               // res económico + efecto impositivo (sin CF)
    var resConCF    = resEco - cfTotal;               // res económico - CF (antes de impuestos) [Excel M37]
    var resFinal    = resEco + impNeto - cfTotal;     // resultado final completo [Excel M39]

    var impColor  = impNeto  >= 0 ? 'sim-res-pos' : 'sim-res-neg';
    var rciColor  = resConImp >= 0 ? 'sim-res-pos' : 'sim-res-neg';
    var rccColor  = resConCF  >= 0 ? 'sim-res-pos' : 'sim-res-neg';
    var rfColor   = resFinal  >= 0 ? 'sim-res-pos' : 'sim-res-neg';

    html += '<tr><td colspan="2" class="sim-section" style="opacity:.7;font-style:italic">Impositivo · solo informativo</td></tr>';
    html += '<tr style="opacity:.85"><td>Ret. Ganancias <span style="font-size:11px;opacity:.6">(2% s/venta neta)</span></td><td class="sim-res-neg">$'+f2(retGcias)+' / cab</td></tr>';
    html += '<tr style="opacity:.85"><td>IVA neto ganadería <span style="font-size:11px;opacity:.6">(débito 10.5% − créditos)</span></td><td class="'+(ivaNeto>=0?'sim-res-pos':'sim-res-neg')+'">$'+f2(ivaNeto)+' / cab</td></tr>';
    html += '<tr style="opacity:.85"><td>Impositivo neto ganadería</td><td class="'+impColor+'">$'+f2(impNeto)+' / cab</td></tr>';
    html += '<tr class="sim-total" style="opacity:.85"><td>RESULTADO CON IMPUESTOS <span style="font-size:11px;font-weight:normal;opacity:.6">(sin CF)</span></td><td class="'+rciColor+'">$'+f2(resConImp)+' / cab</td></tr>';

    html += '<tr><td colspan="2" class="sim-section" style="opacity:.7;font-style:italic">Costo Financiero · solo informativo</td></tr>';
    html += '<tr style="opacity:.85"><td>Tasa anual / días fin. <span style="font-size:11px;opacity:.6">('+Math.round(diasFin)+' días = '+Math.round(dias)+' eng. − '+Math.round(pcfCom)+' com. + '+Math.round(pcfVta)+' vta.)</span></td><td>'+(tcf*100).toFixed(1)+'% → '+(tasaAplicar*100).toFixed(2)+'% período</td></tr>';
    html += '<tr style="opacity:.85"><td>CF hacienda</td><td>$'+f2(cfHacienda)+' / cab</td></tr>';
    html += '<tr style="opacity:.85"><td>CF alimento + hotelería + sanidad</td><td>$'+f2(cfAlimento)+' / cab</td></tr>';
    html += '<tr style="opacity:.85"><td>CF total</td><td class="sim-res-neg">$'+f2(cfTotal)+' / cab</td></tr>';
    html += '<tr class="sim-total" style="opacity:.85"><td>RESULTADO CON CF <span style="font-size:11px;font-weight:normal;opacity:.6">(antes impuestos)</span></td><td class="'+rccColor+'">$'+f2(resConCF)+' / cab</td></tr>';
    html += '<tr class="sim-total" style="background:rgba(26,22,18,.06)"><td><b>RESULTADO FINAL</b> <span style="font-size:11px;font-weight:normal;opacity:.6">(con impuestos y CF)</span></td><td class="'+rfColor+'"><b>$'+f2(resFinal)+' / cab</b></td></tr>';
  }

  html += '</table>';

  document.getElementById('simRes-'+tipo).innerHTML = html;
  _simSave(); // persistir valores del usuario

  // Update global KPI strip
  if(tipo === SIM_ACTIVE_TAB){
    document.getElementById('skpi-dias').textContent = Math.round(dias);
    document.getElementById('skpi-costo').textContent = '$'+f2(costoPorKg);
    var el = document.getElementById('skpi-resultado');
    el.textContent = '$'+f2(resEco);
    el.style.color = isPos ? '#6bc47a' : '#e74c3c';
    var elTir = document.getElementById('skpi-tir');
    elTir.textContent = fp(tirAnual);
    elTir.style.color = tirAnual >= 0 ? '#6bc47a' : '#e74c3c';
  }
}

// Restaurar composición de dieta a los valores default del Excel
function resetDieta(tipo){
  var pfx=tipo==='terneros'?'tn':tipo==='terneras'?'ta':'va';
  var def=SIM_ETAPAS[tipo];
  if(!def) return;
  var ingrs=['maiz','silo','gluten','nucleo','germen'];
  for(var si=0;si<def.length;si++){
    for(var ii=0;ii<ingrs.length;ii++){
      var el=document.getElementById(pfx+'-d'+(si+1)+'-'+ingrs[ii]);
      if(el) el.value=def[si].comp[ii];
    }
  }
  calcSim(tipo);
}

// ── Persistencia de preferencias del simulador ────────────────────────────
// Maíz y Silo vienen del mercado (se actualizan solos).
// Gluten, Germen, Núcleo y el resto de los parámetros se guardan en localStorage
// para que no se reseteen al recargar el portal.
var SIM_PREFS_KEY = 'pegsa_sim_prefs_v2';
var SIM_MARKET_CAMPOS = ['maiz','silo']; // maiz viene del JSON; silo se calcula del maíz

function _simSave(){
  try{
    var prefs = {};
    // Todos los inputs del simulador que NO son readonly y NO son de mercado
    var inputs = document.querySelectorAll('.sim-input:not([readonly]), .sim-diet-input:not([readonly])');
    inputs.forEach(function(el){
      if(!el.id) return;
      // No guardar maíz ni silo (vienen del mercado)
      var campo = el.id.split('-').slice(1).join('-');
      if(SIM_MARKET_CAMPOS.indexOf(campo) >= 0) return;
      prefs[el.id] = el.value;
    });
    localStorage.setItem(SIM_PREFS_KEY, JSON.stringify(prefs));
  } catch(e){}
}

function _simLoad(){
  try{
    var prefs = JSON.parse(localStorage.getItem(SIM_PREFS_KEY) || '{}');
    Object.keys(prefs).forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el.readOnly && prefs[id] !== '') el.value = prefs[id];
    });
  } catch(e){}
}

function _applyInsumos(data){
  if(data && data.insumos){
    var ins = data.insumos;
    // Aplicar maíz desde el mercado; silo se calcula automáticamente del maíz
    ['tn','ta','va','in'].forEach(function(p){
      if(ins.maiz && document.getElementById(p+'-maiz')) document.getElementById(p+'-maiz').value = ins.maiz;
    });
    // Recalcular silo en todos los tabs feedlot
    if(ins.maiz){
      var siloAuto = _calcSiloFromMaiz(ins.maiz);
      ['tn','ta','va'].forEach(function(p){
        var el = document.getElementById(p+'-silo');
        if(el){ el.value = siloAuto; }
      });
    }
    var mzEl = document.getElementById('simPrecioMaiz');
    if(mzEl && ins.maiz) mzEl.textContent = 'Maíz ref: $'+Number(ins.maiz).toLocaleString('es-AR')+'/tn · '+(data.fecha||'');
  }
}

// Calcula el precio del silo a partir del maíz: (maiz × 0.86 × 7400) / 11640 × 1.15
function _calcSiloFromMaiz(maizVal){
  var mz = parseFloat(maizVal) || 0;
  return Math.round((mz * 0.86 * 7400) / 11640 * 1.15);
}

// Sincroniza un precio de insumo en todos los tabs y recalcula todo
function syncPrecios(campo, valor){
  ['tn','ta','va','in'].forEach(function(p){
    var el = document.getElementById(p+'-'+campo);
    if(el) el.value = valor;
  });
  // Si cambió el maíz, recalcular silo automáticamente
  if(campo === 'maiz'){
    var siloVal = _calcSiloFromMaiz(valor);
    ['tn','ta','va'].forEach(function(p){
      var el = document.getElementById(p+'-silo');
      if(el){ el.value = siloVal; }
    });
  }
  calcSim('terneros'); calcSim('terneras'); calcSim('vacas'); calcSim('invernada');
  _simSave();
}

function initSimulador(){
  if(!SIM_INITED){
    SIM_INITED = true;
    var _finInit = function(){
      // Restaurar preferencias guardadas (sobreescribe defaults EXCEPTO maiz/silo que vienen del mercado)
      _simLoad();
      bpRenderUI(); // Cargar parámetros base guardados
      ['terneros','terneras','vacas','invernada'].forEach(function(t){ calcSim(t); });
    };
    // Use cached data if already loaded from mercado module, else fetch
    if(MERCADO_DATA_CACHE){
      _applyInsumos(MERCADO_DATA_CACHE); // aplica solo maiz y silo del mercado
      _finInit();
    } else {
      fetch(STOCK_SB+'/mercado_precios.json',{})
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(data){
          MERCADO_DATA_CACHE = data;
          _applyInsumos(data); // aplica solo maiz y silo del mercado
          _finInit();
        })
        .catch(function(){ _finInit(); });
    }
  } else {
    calcSim(SIM_ACTIVE_TAB);
  }
}
// ── Parámetros Base (para cálculo automático Módulo 5) ────────────────────
var BP_KEY = 'pegsa_base_params_v1';
var BP_FIELDS = ['kmo','kmd','pflete','ccom','cvta','guias','hotel','sanidad','pcarne','rend','decomiso','mort'];
var BP_DEFAULTS = {
  terneros: {kmo:275, kmd:640, pflete:2750, ccom:3, cvta:3, guias:1725, hotel:310, sanidad:7500, pcarne:8100, rend:56, decomiso:0, mort:0},
  terneras: {kmo:275, kmd:640, pflete:2750, ccom:3, cvta:3, guias:1725, hotel:310, sanidad:7500, pcarne:7800, rend:54, decomiso:0, mort:0},
  vacas:    {kmo:275, kmd:640, pflete:2750, ccom:3, cvta:3, guias:1725, hotel:310, sanidad:7500, pcarne:7500, rend:52.5, decomiso:0.66, mort:0.54}
};

function bpLoad(){
  try{ var v=JSON.parse(localStorage.getItem(BP_KEY)||'null'); return v||null; }catch(e){ return null; }
}
function bpGet(){
  return bpLoad() || JSON.parse(JSON.stringify(BP_DEFAULTS));
}
function bpGuardar(){
  try{
    var saved = bpLoad() || JSON.parse(JSON.stringify(BP_DEFAULTS));
    ['terneros','terneras','vacas'].forEach(function(tipo){
      var pfx = tipo==='terneros'?'tn':tipo==='terneras'?'ta':'va';
      BP_FIELDS.forEach(function(f){
        var el = document.getElementById('bp-'+pfx+'-'+f);
        if(el) saved[tipo][f] = parseFloat(el.value)||0;
      });
    });
    localStorage.setItem(BP_KEY, JSON.stringify(saved));
    // Flash saved message
    var msg = document.getElementById('bpGuardadoMsg');
    if(msg){ msg.style.opacity='1'; setTimeout(function(){ msg.style.opacity='0'; },1500); }
  }catch(e){}
}
function bpRenderUI(){
  var params = bpGet();
  ['terneros','terneras','vacas'].forEach(function(tipo){
    var pfx = tipo==='terneros'?'tn':tipo==='terneras'?'ta':'va';
    var tipParams = params[tipo]||{};
    BP_FIELDS.forEach(function(f){
      var el = document.getElementById('bp-'+pfx+'-'+f);
      if(el && tipParams[f]!==undefined) el.value = tipParams[f];
    });
  });
}
function bpCargarDesdeSim(tipo){
  var pfx = tipo==='terneros'?'tn':tipo==='terneras'?'ta':'va';
  BP_FIELDS.forEach(function(f){
    var src = document.getElementById(pfx+'-'+f);
    var dst = document.getElementById('bp-'+pfx+'-'+f);
    if(src && dst) dst.value = src.value;
  });
  bpGuardar();
}
function bpRestaurarDefaults(){
  var def = JSON.parse(JSON.stringify(BP_DEFAULTS));
  localStorage.setItem(BP_KEY, JSON.stringify(def));
  bpRenderUI();
  var msg = document.getElementById('bpGuardadoMsg');
  if(msg){ msg.style.opacity='1'; setTimeout(function(){ msg.style.opacity='0'; },1500); }
}
// ── FIN SIMULADOR ─────────────────────────────────────────────
