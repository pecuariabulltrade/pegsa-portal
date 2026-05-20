/* ════════════════════════════════════════════════════════════════════════
   data.js — Panel Principal · Datos REALES desde JSONs del repo
   Estrategia: demo fallback + fetch async + re-mount via evento
   ════════════════════════════════════════════════════════════════════════ */

window.PEGSA_DATA = {
  periodo: "Enero – Diciembre 2025",
  empresa: "PECUARIA EL GARABÍ SA & BULLTRADE SRL",
  usuario: { nombre: "Miguel Acosta", rol: "Gerencia · 2025", iniciales: "MA" },
  hero: {
    patrimonio: { ars: 20640000000, usd: 14430000, mep: 1430 },
    resultado: { total: 9191348874, operativo: 2948959025, tenencia: 6242389849, ingresosBrutos: 42615291858, margenOp: 6.14, margenTotal: 18.97, rentabilidadAcum: 7.3 },
    stock: { pegsa: { cabezas: 8651, kg: 3626000 }, total: { cabezas: 9861, kg: 4324000, establecimientos: 3 } }
  },
  mercado: {
    novillo: { precio: 4557, label: "Novillo 461/490 kg", unidad: "$/kg vivo", fuente: "MAG", delta: 37 },
    vaca:    { precio: 3428, label: "Vaca buena",         unidad: "$/kg vivo", fuente: "MAG", delta: 21 },
    ternero: { precio: 5097, label: "Ternero 330–370 kg", unidad: "$/kg vivo", fuente: "E&C", delta: 64 },
    maiz:    { precio: 243150, label: "Maíz BCR",         unidad: "$/tn",      fuente: "BCR", delta: -2100 },
    soja:    { precio: 898987, label: "Soja BCR",         unidad: "$/tn",      fuente: "BCR", delta: 12500 },
    mep:     { precio: 1414,  label: "Tipo de Cambio MEP", unidad: "$/USD",    fuente: "BCR", delta: 4 }
  },
  tesoreria: { posicion: 1138000000, semana: "25/04", cartera: 1138000000, bancos: 463131340, usd_pos: 1907628109 },
  centros: [
    { id: "ganaderia",  nombre: "Ganadería",          ingresos: 27022, egresos: -25923, operativo: 1098,  tenencia: 5825, total: 6924, marginOp: 4.06,  marginTot: 25.62 },
    { id: "feedlot",    nombre: "Feedlot",            ingresos: 10911, egresos: -9004,  operativo: 1907,  tenencia: 0,    total: 1907, marginOp: 17.48, marginTot: 17.48 },
    { id: "consig",     nombre: "Consignataria Bull", ingresos: 748,   egresos: -352,   operativo: 396,   tenencia: 0,    total: 396,  marginOp: 52.96, marginTot: 52.96 },
    { id: "campos",     nombre: "Campos",             ingresos: 668,   egresos: -376,   operativo: 292,   tenencia: 0,    total: 292,  marginOp: 43.65, marginTot: 43.65 },
    { id: "transporte", nombre: "Transporte",         ingresos: 160,   egresos: -98,    operativo: 61,    tenencia: 0,    total: 61,   marginOp: 38.55, marginTot: 38.55 },
    { id: "agri",       nombre: "Agricultura 24/25",  ingresos: 2588,  egresos: -2415,  operativo: 10,    tenencia: 162,  total: 173,  marginOp: 0.40,  marginTot: 6.69 },
    { id: "donpedro",   nombre: "Don Pedro",          ingresos: 513,   egresos: -468,   operativo: -208,  tenencia: 254,  total: 45,   marginOp: -40.5, marginTot: 8.90 },
    { id: "equinos",    nombre: "Equinos",            ingresos: 0,     egresos: -0.9,   operativo: -0.9,  tenencia: 0,    total: -0.9, marginOp: 0,     marginTot: 0 },
    { id: "admin",      nombre: "Administración",     ingresos: 0,     egresos: -608,   operativo: -608,  tenencia: 0,    total: -608, marginOp: 0,     marginTot: 0 }
  ],
  stockCategorias: [
    { categoria: "Novillos terminación",     cabezas: 2470, kg: 1135000 },
    { categoria: "Novillitos / Vaquillonas", cabezas: 2890, kg: 1014000 },
    { categoria: "Terneros invernada",       cabezas: 1660, kg: 425000 },
    { categoria: "Vacas",                    cabezas: 1145, kg: 562000 },
    { categoria: "Vaquillonas reposición",   cabezas: 980,  kg: 318000 },
    { categoria: "Toros",                    cabezas: 75,   kg: 52000 },
    { categoria: "Terneras",                 cabezas: 641,  kg: 120000 }
  ],
  patrimonioMensual: [
    { mes: "Ene", ars: 16800, usd: 12100 }, { mes: "Feb", ars: 17200, usd: 12350 },
    { mes: "Mar", ars: 17900, usd: 12600 }, { mes: "Abr", ars: 18400, usd: 12900 },
    { mes: "May", ars: 18100, usd: 13050 }, { mes: "Jun", ars: 18950, usd: 13280 },
    { mes: "Jul", ars: 19400, usd: 13550 }, { mes: "Ago", ars: 19720, usd: 13700 },
    { mes: "Sep", ars: 19850, usd: 13880 }, { mes: "Oct", ars: 20100, usd: 14050 },
    { mes: "Nov", ars: 20400, usd: 14260 }, { mes: "Dic", ars: 20640, usd: 14430 }
  ],
  sparks: {
    patrimonioArs: [16.8,17.2,17.9,18.4,18.1,18.95,19.4,19.72,19.85,20.1,20.4,20.64],
    patrimonioUsd: [12.1,12.35,12.6,12.9,13.05,13.28,13.55,13.7,13.88,14.05,14.26,14.43],
    rentabilidad:  [4.2,4.6,5.1,5.4,5.9,6.1,6.3,6.5,6.8,7.0,7.15,7.3],
    stockKg:       [3.45,3.48,3.52,3.50,3.55,3.58,3.60,3.59,3.61,3.62,3.62,3.626],
    novillo:       [4180,4220,4260,4310,4350,4380,4400,4440,4460,4500,4520,4557],
    vaca:          [3120,3150,3180,3220,3260,3290,3310,3350,3370,3400,3410,3428],
    maiz:          [201000,208000,215000,220000,224000,230000,234000,237000,240000,242000,244500,243150],
    soja:          [820000,835000,850000,860000,868000,875000,880000,885000,890000,895000,901000,898987],
    mep:           [1280,1295,1310,1325,1338,1350,1362,1375,1390,1398,1408,1414]
  },
  heatmap: {
    meses: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
    centros: [
      { nombre: "Ganadería",   data: [420,510,480,590,615,580,650,690,660,620,580,530] },
      { nombre: "Feedlot",     data: [120,140,155,165,158,172,180,188,195,178,138,118] },
      { nombre: "Consig.Bull", data: [28,31,33,35,32,36,38,40,35,33,28,27] },
      { nombre: "Campos",      data: [22,23,24,25,25,26,26,26,25,24,23,23] },
      { nombre: "Agricultura", data: [-5,-8,5,12,18,22,28,38,42,28,18,15] },
      { nombre: "Transporte",  data: [4,5,5,5,5,5,5,5,6,6,5,5] },
      { nombre: "Don Pedro",   data: [-15,-18,-8,-2,5,12,18,22,18,8,4,-1] },
      { nombre: "Administr.",  data: [-48,-50,-51,-50,-52,-50,-51,-52,-51,-50,-52,-51] }
    ]
  },
  modulos: [
    // ── Operativos ─────────────────────────────────────────────
    { n: "01", grupo: "operativo", id: "stock-masa",        titulo: "Stock de Masa — Kilos",desc: "WinCampo · OneDrive · 07:00 AM",             estado: "vivo",       kpi: "9.861 cab",       kpiLabel: "4.324.000 kg estimados hoy" },
    { n: "02", grupo: "operativo", id: "stock-insumos",     titulo: "Stock de Insumos",     desc: "Diesel · maíz · soja · gluten · más",        estado: "vivo",       kpi: "12 ítems",        kpiLabel: "Diesel: 18 días restantes" },
    { n: "03", grupo: "operativo", id: "mercado",           titulo: "Mercado y Precios",    desc: "MAG · BCR · E&C",                            estado: "disponible", kpi: "$4.557",          kpiLabel: "Novillo 461/490 · MAG hoy" },
    { n: "04", grupo: "operativo", id: "tesoreria",         titulo: "Tesorería",            desc: "Saldos · cheques · USD · deuda",             estado: "vivo",       kpi: "$1.138.000.000",  kpiLabel: "Cartera positiva · sem. 25/04" },
    { n: "05", grupo: "operativo", id: "simulador",         titulo: "Simulador Feedlot",    desc: "Terneros · vacas · invernada",               estado: "disponible", kpi: "TIR ~38%",        kpiLabel: "Equiv. anual sandbox" },
    { n: "06", grupo: "operativo", id: "historico",         titulo: "Histórico & Evolución",desc: "Hasta 30 meses de historia",                 estado: "acumulando", kpi: "+22,8%",          kpiLabel: "Patrimonio USD vs ene-25" },
    // ── Análisis económico ─────────────────────────────────────
    { n: "07", grupo: "economico", id: "estado-resultados", titulo: "Estado de Resultados", desc: "Análisis por centro · operativo + tenencia", estado: "disponible", kpi: "+$9.191.348.874", kpiLabel: "Resultado neto del período" },
    { n: "08", grupo: "economico", id: "flujo-fondos",      titulo: "Flujo de Fondos",      desc: "Origen y aplicación · cobros y pagos",       estado: "disponible", kpi: "+$3.803.431.457", kpiLabel: "Superávit de caja operativo" },
    // ── Config (no se muestra en sidebar; se accede vía el Simulador) ──
    { n: "09", grupo: "config",    id: "parametros-base",   titulo: "Parámetros Base",      desc: "Configuración del simulador · Precios y rendimientos por categoría", estado: "disponible", kpi: "Config", kpiLabel: "Estimación de precios" }
  ],
  alertas: [
    { tipo: "warn", texto: "Diesel: 18 días de stock restantes" },
    { tipo: "info", texto: "Nuevo cierre mensual disponible · marzo 2026" }
  ]
};

/* ════════════════════════════ FETCH REAL DATA ═════════════════════════════ */
(async function loadRealData() {
  const fetchJson = (n) => fetch(n).then(r => r.ok ? r.json() : null).catch(() => null);
  const find = (arr, ...keys) => {
    if (!Array.isArray(arr)) return null;
    for (const it of arr) {
      const blob = JSON.stringify(it).toLowerCase();
      if (keys.every(k => blob.includes(k.toLowerCase()))) return it;
    }
    return null;
  };

  const [stockKpis, stockDiario, stockInsumos, mercado, tesoreria, financierohist, negocios, valuacionhist, stockPegsa, consumo, stockHistorico] = await Promise.all([
    fetchJson('stock_kpis_2025.json'),
    fetchJson('stock_diario.json'),
    fetchJson('stock_insumos_2025.json'),
    fetchJson('mercado_precios.json'),
    fetchJson('tesoreria_ultimo.json'),
    fetchJson('financiero_historico.json'),
    fetchJson('negocios_resumen.json'),
    fetchJson('valuacion_historica.json'),
    fetchJson('stock_prop_PEGSA_2025.json'),
    fetchJson('consumo_2025.json'),
    fetchJson('stock_historico.json'),
  ]);

  const D = window.PEGSA_DATA;

  // Stock real desde stock_kpis_2025.json
  if (stockKpis?.kpis) {
    const k = stockKpis.kpis;
    const peg = k.por_propietario?.PEGSA || {};
    if (peg.cabezas) D.hero.stock.pegsa.cabezas = peg.cabezas;
    if (peg.kg_estimado) D.hero.stock.pegsa.kg = peg.kg_estimado;
    if (k.total_cabezas) D.hero.stock.total.cabezas = k.total_cabezas;
    if (k.total_kg_estimado_hoy) D.hero.stock.total.kg = k.total_kg_estimado_hoy;
    if (k.total_establecimientos) D.hero.stock.total.establecimientos = k.total_establecimientos;
    if (k.total_propietarios) D.hero.stock.total.propietarios = k.total_propietarios;

    if (k.por_categoria_final && typeof k.por_categoria_final === 'object') {
      const cats = Object.entries(k.por_categoria_final)
        .map(([n, d]) => ({ categoria: n.charAt(0).toUpperCase() + n.slice(1), cabezas: d?.cabezas || 0, kg: Math.round(d?.kg_estimado || 0) }))
        .filter(c => c.cabezas > 0)
        .sort((a, b) => b.kg - a.kg);
      if (cats.length > 0) D.stockCategorias = cats;
    }
  }

  // Hoteleros: cabezas de terceros (Grupo - PEGSA)
  if (D.hero.stock.total.cabezas && D.hero.stock.pegsa.cabezas) {
    D.hoteleros = { cabezas: D.hero.stock.total.cabezas - D.hero.stock.pegsa.cabezas };
  }

  // Variación 12m de cabezas — desde stock_historico.json (snapshots mensuales)
  if (stockHistorico?.snapshots && stockHistorico.snapshots.length >= 13) {
    const snaps = stockHistorico.snapshots.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const last = snaps[snaps.length - 1]?.hacienda?.total_cabezas || 0;
    const first = snaps[snaps.length - 13]?.hacienda?.total_cabezas || 0;
    if (last && first) D.stockVar12m = (last - first) / first * 100;
  }

  // Hacienda PEGSA por establecimiento (filtrada solo a hacienda propia)
  if (stockPegsa?.kpis?.por_establecimiento) {
    const pe = stockPegsa.kpis.por_establecimiento;
    const arr = Object.entries(pe)
      .map(([nombre, d]) => ({
        nombre: nombre,
        cabezas: Math.round(d?.cabezas || 0),
        kg: Math.round(d?.kg_estimado || 0),
        kgPromedio: Math.round(d?.kg_promedio || 0),
      }))
      .filter(e => e.cabezas > 0)
      .sort((a, b) => b.cabezas - a.cabezas);
    if (arr.length > 0) {
      D.haciendaPegsaPorEstab = arr;
      D.haciendaPegsaTotal = {
        cabezas: stockPegsa.kpis.total_cabezas || arr.reduce((s, e) => s + e.cabezas, 0),
        kg: stockPegsa.kpis.total_kg_estimado_hoy || arr.reduce((s, e) => s + e.kg, 0),
      };
    }

    // Stock por categoría · solo PEGSA (para card PEGSA del drill stock-masa)
    if (stockPegsa.kpis.por_categoria_final && typeof stockPegsa.kpis.por_categoria_final === 'object') {
      const catsPeg = Object.entries(stockPegsa.kpis.por_categoria_final)
        .map(([n, d]) => ({ categoria: n.charAt(0).toUpperCase() + n.slice(1), cabezas: d?.cabezas || 0, kg: Math.round(d?.kg_estimado || 0) }))
        .filter(c => c.cabezas > 0)
        .sort((a, b) => b.kg - a.kg);
      if (catsPeg.length > 0) D.stockCategoriasPegsa = catsPeg;
    }
  }

  // Mercado real
  if (mercado) {
    const novillo = find(mercado.hacienda, '461/490') || find(mercado.hacienda, 'novillo');
    const vaca    = find(mercado.hacienda, 'vaca');
    const maiz    = find(mercado.commodities, 'maíz') || find(mercado.commodities, 'maiz');
    const soja    = find(mercado.commodities, 'soja');
    const ter330  = find(mercado.terneros_esyc, '330');
    const dolar   = mercado.insumos?.dolar || mercado.insumos?.mep;
    if (novillo?.precio) { D.mercado.novillo.precio = novillo.precio; D.mercado.novillo.delta = (novillo.variacion != null) ? novillo.variacion : null; }
    if (vaca?.precio)    { D.mercado.vaca.precio = vaca.precio; D.mercado.vaca.delta = (vaca.variacion != null) ? vaca.variacion : null; }
    if (maiz?.precio)    { D.mercado.maiz.precio = maiz.precio; D.mercado.maiz.delta = (maiz.variacion != null) ? maiz.variacion : null; }
    if (soja?.precio)    { D.mercado.soja.precio = soja.precio; D.mercado.soja.delta = (soja.variacion != null) ? soja.variacion : null; }
    if (ter330?.precio)  { D.mercado.ternero.precio = ter330.precio; D.mercado.ternero.delta = (ter330.variacion != null) ? ter330.variacion : null; }
    const mepP = typeof dolar === 'number' ? dolar : (dolar?.precio || dolar?.valor);
    if (mepP) D.mercado.mep.precio = mepP;
    if (mercado.fecha) D.mercado.fecha = mercado.fecha;
  }

  // Tesorería real
  if (tesoreria) {
    const pos = tesoreria.posicion || {};
    const cheq = tesoreria.cheques || {};
    const bancosT = (Array.isArray(pos.bancos_peg) ? pos.bancos_peg.reduce((s, b) => s + (b.saldo || 0), 0) : 0)
                  + (Array.isArray(pos.bancos_bull) ? pos.bancos_bull.reduce((s, b) => s + (b.saldo || 0), 0) : 0);
    if (bancosT) D.tesoreria.bancos = bancosT;
    if (cheq.total_cartera) D.tesoreria.cartera = cheq.total_cartera;
    if (pos.saldo_disponibilidades) D.tesoreria.posicion = pos.saldo_disponibilidades;
    if (pos.usd_ars) D.tesoreria.usd_pos = pos.usd_ars;
    if (tesoreria.fecha_corte) D.tesoreria.semana = tesoreria.fecha_corte.split('-').reverse().slice(0,2).join('/');

    const totalARS = bancosT + (pos.efectivo || 0) + (pos.becerra || 0) + (pos.fima_peg || 0) + (pos.fima_bull || 0) + (pos.fci || 0) + (pos.echeq || 0);
    if (totalARS > 0) D.hero.patrimonio.ars = totalARS;
    if (pos.usd_cant) D.hero.patrimonio.usd = pos.usd_cant;
    if (pos.usd_ars && pos.usd_cant) D.hero.patrimonio.mep = Math.round(pos.usd_ars / pos.usd_cant);
  }

  // Flujo semanal (Sprint 2C) — 1 cerrada + 1 next + 4 proyectadas desde tesoreria_ultimo.json.flujo
  if (tesoreria?.flujo && Array.isArray(tesoreria.flujo.semanas)) {
    const fl = tesoreria.flujo;
    const fechaCorte = tesoreria.fecha_corte || new Date().toISOString().slice(0, 10);
    const [anioCorte] = fechaCorte.split('-').map(Number);
    const hoy0 = new Date();
    hoy0.setHours(0, 0, 0, 0);

    const parseLabel = (lbl) => {
      const [d, m] = lbl.split('/').map(Number);
      return new Date(anioCorte, m - 1, d);
    };
    const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const fmtRango = (ini) => {
      const fin = new Date(ini); fin.setDate(fin.getDate() + 6);
      const mismoMes = ini.getMonth() === fin.getMonth();
      return mismoMes
        ? `${ini.getDate()} al ${fin.getDate()} ${MESES[ini.getMonth()]}`
        : `${ini.getDate()} ${MESES[ini.getMonth()]} al ${fin.getDate()} ${MESES[fin.getMonth()]}`;
    };
    const fmtDDMM = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    const semNumIso = (d) => {
      const tmp = new Date(d.getTime());
      tmp.setHours(0, 0, 0, 0);
      tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
      const yStart = new Date(tmp.getFullYear(), 0, 1);
      return Math.ceil((((tmp - yStart) / 86400000) + 1) / 7);
    };
    const detectarEstado = (ini) => {
      const fin = new Date(ini); fin.setDate(fin.getDate() + 6); fin.setHours(23, 59, 59, 999);
      if (fin < hoy0) return 'done';
      if (ini <= hoy0 && hoy0 <= fin) return 'next';
      return 'proj';
    };

    const saldos = (fl.series && fl.series.saldo_semanal) || [];
    const todasSemanas = fl.semanas.map((lbl, i) => {
      const fechaIni = parseLabel(lbl);
      return {
        label: lbl,
        fechaIni: fechaIni,
        rangoLabel: fmtRango(fechaIni),
        saldoSemanal: saldos[i] || 0,
        estado: detectarEstado(fechaIni),
      };
    });

    let nextIdx = todasSemanas.findIndex(s => s.estado === 'next');
    if (nextIdx < 0) nextIdx = todasSemanas.findIndex(s => s.estado === 'proj');
    if (nextIdx < 0) nextIdx = todasSemanas.length - 1;

    const doneIdx = Math.max(0, nextIdx - 1);
    const seis = todasSemanas.slice(doneIdx, doneIdx + 6);

    const cerrada = todasSemanas[nextIdx - 1] || null;
    const proxima = todasSemanas[nextIdx] || null;
    const proxs4 = todasSemanas.slice(nextIdx + 1, nextIdx + 5);
    const acumValor = proxs4.reduce((s, x) => s + x.saldoSemanal, 0);
    const acumFin = proxs4.length > 0
      ? new Date(proxs4[proxs4.length - 1].fechaIni.getTime() + 6 * 86400000)
      : null;

    const submet = (v) => v >= 0 ? 'Excedente de caja' : 'Necesidad de fondos';
    const signo = (v) => v >= 0 ? 'pos' : 'neg';

    D.flujoSemanal = {
      fechaCorte: fechaCorte,
      semanaNumActual: semNumIso(hoy0),
      anioActual: hoy0.getFullYear(),
      semanas: seis.map(s => ({ label: s.label, estado: s.estado, saldoSemanal: s.saldoSemanal })),
      cerrada: cerrada ? {
        label: cerrada.label, rangoLabel: cerrada.rangoLabel,
        valor: cerrada.saldoSemanal, subMetrica: submet(cerrada.saldoSemanal), signo: signo(cerrada.saldoSemanal),
      } : null,
      proxima: proxima ? {
        label: proxima.label, rangoLabel: proxima.rangoLabel,
        valor: proxima.saldoSemanal, subMetrica: submet(proxima.saldoSemanal), signo: signo(proxima.saldoSemanal),
      } : null,
      acumulado4w: proxs4.length > 0 ? {
        valor: acumValor,
        rangoLabel: proxs4[0].label + ' – ' + fmtDDMM(acumFin),
        signo: signo(acumValor),
      } : null,
    };
  }

  // Patrimonio histórico — usa valuacion_historica.json (patrimonio total mensual:
  // hacienda + insumos + financiero + USD). El TC USD MEP ya viene aplicado por el pipeline.
  if (valuacionhist?.snapshots && valuacionhist.snapshots.length > 0) {
    const snaps = valuacionhist.snapshots.slice().sort((a, b) => (a.periodo || '').localeCompare(b.periodo || ''));
    const MES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const patM = snaps.map(s => {
      const c = s.componentes || {};
      const periodo = s.periodo || '';
      const yr = (periodo.split('-')[0] || '').slice(2);
      const mn = periodo.split('-')[1] || '';
      const ml = MES_LBL[parseInt(mn) - 1] || mn;
      return {
        mes: ml + (yr ? " '" + yr : ''),
        ars: Math.round((c.total_pesos || 0) / 1e6),    // $M
        usd: Math.round((c.total_usd   || 0) / 1e3),    // U$S K
      };
    }).filter(p => p.ars > 0);
    if (patM.length >= 2) {
      D.patrimonioMensual = patM;
      D.sparks.patrimonioArs = patM.map(p => p.ars / 1000);
      D.sparks.patrimonioUsd = patM.map(p => p.usd / 100);
    }
  }

  // Sparks stock kg desde diario
  if (stockDiario?.snapshots) {
    const snaps = stockDiario.snapshots.slice(-12);
    const series = snaps.map(s => (s.hacienda?.total_kg_estimado_hoy || 0) / 1e6).filter(v => v > 0);
    if (series.length >= 3) D.sparks.stockKg = series;
  }

  // Patrimonio USD serie (Sprint 2C) — últimos 12 meses para chart Sección 3
  if (D.patrimonioMensual && D.patrimonioMensual.length > 0) {
    D.patrimonioUsdSerie = D.patrimonioMensual.slice(-12);
  }

  // Stock kilos diario serie (Sprint 2C) — últimos 90 puntos para chart Sección 3
  if (stockDiario?.snapshots && stockDiario.snapshots.length > 0) {
    D.stockKilosDiarioSerie = stockDiario.snapshots.slice(-90)
      .map(s => ({ fecha: s.fecha, kg: s.hacienda?.total_kg_estimado || 0 }))
      .filter(p => p.kg > 0);
  }

  // Mixer status — días de retraso del último día completo del Mixer
  if (consumo?.meta?.ultimo_completo) {
    const ult = new Date(consumo.meta.ultimo_completo + 'T00:00:00');
    const hoy0 = new Date();
    hoy0.setHours(0, 0, 0, 0);
    const diasRetraso = Math.max(0, Math.floor((hoy0 - ult) / 86400000));
    const nivel = diasRetraso >= 5 ? 'rojo' : (diasRetraso >= 3 ? 'amarillo' : 'verde');
    D.mixerStatus = {
      ultimo_completo: consumo.meta.ultimo_completo,
      dias_retraso:    diasRetraso,
      nivel:           nivel,
    };
  }

  // Alertas dinámicas
  const newAl = [];
  if (D.mixerStatus && D.mixerStatus.nivel !== 'verde') {
    newAl.push({
      tipo:   D.mixerStatus.nivel === 'rojo' ? 'critico' : 'warn',
      texto:  '⚠ Mixer desactualizado · última lectura ' + D.mixerStatus.ultimo_completo + ' · hace ' + D.mixerStatus.dias_retraso + ' días',
      action: 'open-stock-materiaseca',
    });
  }
  if (Array.isArray(stockInsumos?.insumos)) {
    const crit = stockInsumos.insumos.filter(i => i.dias_restantes != null && i.dias_restantes >= 0).sort((a, b) => a.dias_restantes - b.dias_restantes)[0];
    if (crit) newAl.push({ tipo: 'warn', texto: crit.nombre + ': ' + crit.dias_restantes.toFixed(0) + ' días de stock restantes' });
  }
  newAl.push({ tipo: 'info', texto: 'Cierre mensual: ' + (financierohist?.cortes?.length ? 'último corte ' + financierohist.cortes[financierohist.cortes.length - 1].fecha_corte : 'pendiente') });
  if (newAl.length > 0) D.alertas = newAl;

  // Insumos críticos (top 2 sin Diesel/Gasoil, dias > 0, ordenado ascendente)
  if (Array.isArray(stockInsumos?.insumos)) {
    const INSUMO_DISPLAY_NAMES = {
      'GLUTEN DE MAIZ': 'Gluten de maíz',
      'NUCLEO CONC 5% LDB': 'Núcleo concentrado 5%',
      'MAIZ GRANO': 'Maíz grano',
      'HARINA GERMEN': 'Harina de germen',
      'SILO DE MAIZ': 'Silo de maíz',
      'HOMINY FEED': 'Hominy feed',
      'ROLLO': 'Rollo',
      'SOJA': 'Soja',
      'DIESEL': 'Diesel',
    };
    const INSUMO_DESCRIPCIONES = {
      'GLUTEN DE MAIZ': 'Concentrado proteico',
      'NUCLEO CONC 5% LDB': 'Núcleo balanceado',
      'MAIZ GRANO': 'Concentrado energético',
      'HARINA GERMEN': 'Subproducto cerealero',
      'SILO DE MAIZ': 'Voluminoso fermentado',
      'HOMINY FEED': 'Subproducto maíz',
      'ROLLO': 'Voluminoso seco',
      'SOJA': 'Concentrado proteico',
      'DIESEL': 'Combustible',
    };
    const toTitle = (s) => s.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

    // Targets fijos: los 2 voluminosos base del feedlot (en este orden)
    const TARGETS = ['SILO DE MAIZ', 'MAIZ GRANO'];
    const byName = new Map();
    stockInsumos.insumos.forEach(i => byName.set(i.nombre, i));

    const criticos = TARGETS
      .map(name => {
        const i = byName.get(name);
        if (!i) return null;
        const stock = i.stock_kg;
        const dias = i.dias_restantes;
        const isInconsistente = (stock != null && stock < 0) || (dias != null && dias < 0);
        const estado = isInconsistente
          ? 'inconsistente'
          : (dias == null ? 'ok' : (dias < 10 ? 'bad' : (dias < 30 ? 'warn' : 'ok')));
        return {
          nombre: INSUMO_DISPLAY_NAMES[i.nombre] || toTitle(i.nombre),
          descripcion: INSUMO_DESCRIPCIONES[i.nombre] || null,
          stock_kg: stock,
          consumo_kg_dia: i.consumo_diario_tc,
          dias: dias,
          estado: estado,
          inconsistente: isInconsistente,
          fecha_ult_compra: null, // no disponible en stock_insumos_2025.json
        };
      })
      .filter(Boolean);

    if (criticos.length > 0) D.insumosCriticos = criticos;
  }

  // Módulos · KPIs dinámicos
  if (D.hero.stock.total.cabezas) {
    const m3 = D.modulos.find(m => m.id === 'stock-masa');
    if (m3) { m3.kpi = D.hero.stock.total.cabezas.toLocaleString('es-AR') + ' cab'; m3.kpiLabel = (D.hero.stock.total.kg || 0).toLocaleString('es-AR') + ' kg estimados hoy'; }
  }
  if (D.mercado.novillo.precio) {
    const m5 = D.modulos.find(m => m.id === 'mercado');
    if (m5) { m5.kpi = '$' + D.mercado.novillo.precio.toLocaleString('es-AR'); m5.kpiLabel = 'Novillo 461/490 · MAG hoy'; }
  }
  if (D.tesoreria.posicion) {
    const m6 = D.modulos.find(m => m.id === 'tesoreria');
    if (m6) { m6.kpi = '$' + D.tesoreria.posicion.toLocaleString('es-AR'); m6.kpiLabel = 'Cartera · sem. ' + (D.tesoreria.semana || ''); }
  }

  window.dispatchEvent(new CustomEvent('panel:data-ready', { detail: D }));
  console.log('[data.js] Datos reales cargados', D);
})();
