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

  const [stockKpis, stockDiario, stockInsumos, mercado, tesoreria, financierohist, negocios, valuacionhist, stockPegsa, consumo, stockHistorico, ultimaAct, productivo, indicadores, eficienciaHist, comportamientoHist, preciosInf, preciosInfHist, tesoreriaDW, tesoreriaDWHist, stockEstHaras, stockEstCucuca, stockEstDescanso, stockEstPanchita] = await Promise.all([
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
    fetchJson('ultima_actualizacion.json'),
    fetchJson('productivo_2025.json'),
    fetchJson('indicadores_2025.json'),
    fetchJson('eficiencia_historico.json'),
    fetchJson('comportamiento_historico.json'),
    fetchJson('precios_inferencia.json'),
    fetchJson('precios_inferencia_historico.json'),
    fetchJson('tesoreria_darwash.json'),
    fetchJson('tesoreria_darwash_historico.json'),
    // v12.2: 4 establecimientos para desglose Stock terminados del PDF
    fetchJson('stock_est_El_Haras_2025.json'),
    fetchJson('stock_est_La_Cucuca_2025.json'),
    fetchJson('stock_est_El_Descanso_2025.json'),
    fetchJson('stock_est_La_Panchita_2025.json'),
  ]);

  // Última actualización del pipeline (Sprint 5 — B.2)
  if (ultimaAct?.generado) window.PEGSA_DATA.lastUpdate = ultimaAct.generado;

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

  // v12.2 · Stock por categoría · por establecimiento (para el PDF):
  //   - D.stockCategoriasHaras = directo del Haras (subset del Grupo)
  //   - D.stockCategoriasOtros = suma de Cucuca + Descanso + Panchita
  // El Haras suele concentrar la terminación pesada (Novillo>550 / Vaca>650).
  // "Otros" es residual: ad-hoc para distinguir lo que NO está en El Haras.
  function _extractCats(stockEst) {
    const pcf = stockEst?.kpis?.por_categoria_final;
    if (!pcf || typeof pcf !== 'object') return null;
    return Object.entries(pcf)
      .map(([n, d]) => ({
        categoria: n.charAt(0).toUpperCase() + n.slice(1),
        cabezas: Math.round(d?.cabezas || 0),
        kg: Math.round(d?.kg_estimado || 0),
      }))
      .filter(c => c.cabezas > 0)
      .sort((a, b) => b.kg - a.kg);
  }
  const catsHaras = _extractCats(stockEstHaras);
  if (catsHaras && catsHaras.length > 0) D.stockCategoriasHaras = catsHaras;

  // Suma Cucuca + Descanso + Panchita en un solo array. Acumula por
  // categoría (Map → array) para que el PDF muestre "OTROS" agregado.
  {
    const agg = new Map();
    [stockEstCucuca, stockEstDescanso, stockEstPanchita].forEach(est => {
      const cats = _extractCats(est);
      if (!cats) return;
      cats.forEach(c => {
        const key = c.categoria;
        const cur = agg.get(key) || { categoria: key, cabezas: 0, kg: 0 };
        cur.cabezas += c.cabezas;
        cur.kg      += c.kg;
        agg.set(key, cur);
      });
    });
    if (agg.size > 0) {
      D.stockCategoriasOtros = Array.from(agg.values())
        .filter(c => c.cabezas > 0)
        .sort((a, b) => b.kg - a.kg);
    }
  }

  // v12.4: totales del rodeo POR ORIGEN (no por categoría) para la
  // fila de mini-cards "Totales del rodeo" que el PDF dibuja en P1
  // arriba de Stock terminados. PEGSA viene de haciendaPegsaTotal (ya
  // armado más arriba). GRUPO viene de hero.stock.total. Falta exponer
  // El Haras (un solo establecimiento) y la suma de los 3 otros.
  if (stockEstHaras?.kpis) {
    D.haciendaHarasTotal = {
      cabezas: stockEstHaras.kpis.total_cabezas || 0,
      kg:      stockEstHaras.kpis.total_kg_estimado_hoy || 0,
    };
  }
  {
    const ests = [stockEstCucuca, stockEstDescanso, stockEstPanchita].filter(Boolean);
    if (ests.length) {
      D.haciendaOtrosTotal = {
        cabezas: ests.reduce((s, e) => s + (e.kpis?.total_cabezas || 0), 0),
        kg:      ests.reduce((s, e) => s + (e.kpis?.total_kg_estimado_hoy || 0), 0),
      };
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

  // v11: helper extraída de la lógica original de flujo semanal (Sprint
  // 2C). Recibe el snapshot completo (igual shape que tesoreria_ultimo.json
  // → fecha_corte + flujo {saldo_inicial, semanas, series.saldo_semanal,
  //   series.saldo_acumulado}) y devuelve el objeto que el panel/módulo
  // consumen para mostrar 6 barras (1 cerrada + 1 next + 4 proyectadas)
  // con sus cierres. Reusada por PEG-BULL (D.flujoSemanal) y DW
  // (D.flujoSemanalDW) — una sola fórmula.
  function armarFlujoSemanal(snap) {
    if (!snap || !snap.flujo || !Array.isArray(snap.flujo.semanas)) return null;
    const fl = snap.flujo;
    const fechaCorte = snap.fecha_corte || new Date().toISOString().slice(0, 10);
    const [anioCorte] = fechaCorte.split('-').map(Number);
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);

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

    const saldos     = (fl.series && fl.series.saldo_semanal)   || [];
    const saldosAcum = (fl.series && fl.series.saldo_acumulado) || [];
    const todas = fl.semanas.map((lbl, i) => {
      const ini = parseLabel(lbl);
      return {
        label: lbl,
        fechaIni: ini,
        rangoLabel: fmtRango(ini),
        saldoSemanal: saldos[i] || 0,
        saldoAcumulado: saldosAcum[i] || 0,
        estado: detectarEstado(ini),
      };
    });

    let nextIdx = todas.findIndex(s => s.estado === 'next');
    if (nextIdx < 0) nextIdx = todas.findIndex(s => s.estado === 'proj');
    if (nextIdx < 0) nextIdx = todas.length - 1;
    const doneIdx = Math.max(0, nextIdx - 1);
    const seis = todas.slice(doneIdx, doneIdx + 6);

    const signo = (v) => v >= 0 ? 'pos' : 'neg';
    const primera = seis[0] || null;
    const ultima  = seis[seis.length - 1] || null;

    return {
      fechaCorte: fechaCorte,
      semanaNumActual: semNumIso(hoy0),
      anioActual: hoy0.getFullYear(),
      saldoInicial: fl.saldo_inicial || 0,
      semanas: seis.map(s => ({
        label: s.label, estado: s.estado,
        saldoSemanal: s.saldoSemanal, saldoAcumulado: s.saldoAcumulado,
      })),
      cierrePrimera: primera ? {
        label: primera.label, rangoLabel: primera.rangoLabel,
        valor: primera.saldoAcumulado, signo: signo(primera.saldoAcumulado),
      } : null,
      cierreFinal: ultima ? {
        label: ultima.label, rangoLabel: ultima.rangoLabel,
        valor: ultima.saldoAcumulado, signo: signo(ultima.saldoAcumulado),
      } : null,
    };
  }

  // PEG-BULL · flujo semanal desde tesoreria_ultimo.json
  if (tesoreria?.flujo && Array.isArray(tesoreria.flujo.semanas)) {
    D.flujoSemanal = armarFlujoSemanal(tesoreria);
  }

  // v11 · Darwash · análisis financiero independiente.
  // tesoreria_darwash.json viene del pipeline Python que parsea el
  // XLSX semanal de `datos/financiero DW/`. Misma helper, misma forma
  // de derivar D.flujoSemanalDW — espejo automático mobile + desktop.
  if (tesoreriaDW?.flujo && Array.isArray(tesoreriaDW.flujo.semanas)) {
    D.tesoreriaDW     = tesoreriaDW;
    D.flujoSemanalDW  = armarFlujoSemanal(tesoreriaDW);
  }
  if (tesoreriaDWHist?.snapshots && Array.isArray(tesoreriaDWHist.snapshots)) {
    D.tesoreriaDWHist = tesoreriaDWHist.snapshots;
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

    // Lista completa (mobile v5 — sección "Todos los insumos" del panel
    // mobile, espejo del módulo Stock Insumos del desktop). Misma
    // semaforización que las cards desktop (<7 bad / 7-15 warn / ≥15 ok).
    const totalKgAbs = stockInsumos.insumos.reduce((s, i) => s + Math.max(0, i.stock_kg || 0), 0) || 1;
    D.stockInsumosTodos = {
      meta: {
        total_kg: stockInsumos.total_kg || null,
        count:    stockInsumos.insumos.length,
        generado: (stockInsumos.meta && stockInsumos.meta.generado) || null,
      },
      items: stockInsumos.insumos.map(i => {
        const stock = i.stock_kg;
        const dias  = i.dias_restantes;
        const isInconsistente = (stock != null && stock < 0) || (dias != null && dias < 0);
        const semaforo = dias == null ? null : (dias < 7 ? 'bad' : (dias < 15 ? 'warn' : 'ok'));
        const estado = isInconsistente
          ? 'inconsistente'
          : (dias == null ? 'ok' : (dias < 10 ? 'bad' : (dias < 30 ? 'warn' : 'ok')));
        const pctTotal = stock != null ? (stock / totalKgAbs) * 100 : null;
        return {
          nombre: INSUMO_DISPLAY_NAMES[i.nombre] || toTitle(i.nombre),
          nombre_raw: i.nombre,
          descripcion: INSUMO_DESCRIPCIONES[i.nombre] || null,
          stock_kg: stock,
          consumo_kg_dia: i.consumo_diario_tc,
          dias: dias,
          semaforo: semaforo,
          estado: estado,
          inconsistente: isInconsistente,
          pct_total: pctTotal,
        };
      }),
    };
  }

  // ============================================================
  // v6 · Productivos · 6 KPIs del feedlot (mobile + desktop)
  // Cada KPI: actual (último mes / hoy) vs histórico (anual / 60d).
  // Fuentes: productivo_2025.json (ADP, estadía), indicadores_2025.json
  // (% PV, consumo/cab, conversión instantáneos), eficiencia_historico.json
  // (promedios de los últimos N días), consumo_2025.json (último mixer).
  // El user pidió ESTAS métricas y los valores se exponen en D.productivos.
  // El componente desktop (ProductivosGrid en app.jsx) y el mobile
  // (mobile-data.js + mobile.jsx) leen el mismo objeto — una sola
  // fuente de verdad.
  // ============================================================
  D.productivos = {};

  // v10: Engorde diario (ADP × 1000 → g/día/cab)
  // El KPI grande es el ACTUAL (último mes cerrado), espejo del header
  // del módulo Stock·Producción "Eficiencia del Rodeo" que muestra
  // `fuentes.adp_promedio` = 1,03 kg/día (= 1030 g/día). El histórico
  // pasa a ser el promedio anual ponderado (productivo.general.adp_promedio,
  // = 1498 g/día), que el desktop muestra en la pestaña "Producción"
  // como "ADP Promedio". Revierte el swap incorrecto de v9.1.
  if (productivo?.general?.adp_promedio != null && productivo?.por_mes) {
    const mesesKeys = Object.keys(productivo.por_mes).sort();
    const ultKey = mesesKeys[mesesKeys.length - 1];
    const ult = productivo.por_mes[ultKey];
    const MESES_LAB = { '01':'ene','02':'feb','03':'mar','04':'abr','05':'may','06':'jun','07':'jul','08':'ago','09':'sep','10':'oct','11':'nov','12':'dic' };
    const ultLabel = ultKey ? (MESES_LAB[ultKey.slice(5,7)] || '') + " " + ultKey.slice(2,4) : 'últ. mes';

    // ADP del último mes — preferir fuentes.adp_promedio del módulo
    // (es el mismo que el header de "Eficiencia del Rodeo" muestra,
    // 1,03 kg/día → 1030 g/día). Cae a por_mes[ult].adp_promedio si no.
    const indFuen = (indicadores && indicadores.fuentes) || {};
    const adpActualKgDia = indFuen.adp_promedio != null
      ? indFuen.adp_promedio
      : (ult?.adp_promedio != null ? ult.adp_promedio : null);
    const adpActualMes = indFuen.adp_mes || ultKey || null;
    const adpActualLabel = adpActualMes
      ? (MESES_LAB[String(adpActualMes).slice(5,7)] || '') + " " + String(adpActualMes).slice(2,4)
      : ultLabel;

    D.productivos.engordeDiario = {
      actual:    { v: adpActualKgDia != null ? adpActualKgDia * 1000 : null,
                   unit: 'g/día', label: adpActualLabel, decimals: 0 },
      historico: { v: productivo.general.adp_promedio * 1000,
                   unit: 'g/día', label: 'anual', decimals: 0 },
      mejorEs: 'mayor',
      descripcion: 'ADP (engorde diario por cabeza). Último mes cerrado vs promedio anual ponderado. Espejo del header "Eficiencia del Rodeo" del módulo Stock·Producción.'
    };
    // 2. Estadía
    // El módulo no tiene una card de Estadía en "Eficiencia del Rodeo"
    // (sólo en la tab Producción anual). Mantenemos la convención:
    // actual = último mes, histórico = anual.
    D.productivos.estadia = {
      actual:    { v: ult?.estadia_promedio, unit: 'días', label: ultLabel, decimals: 0 },
      historico: { v: productivo.general.estadia_promedio, unit: 'días', label: 'anual', decimals: 0 },
      mejorEs: 'menor',
      descripcion: 'Días promedio entre entrada del animal y su venta. Último mes vs promedio anual. Menos días = más rotación.'
    };
  }

  // v7.2: Referencia anual real (la misma que muestra el desktop en el
  // bloque "REFERENCIA ANUAL · últimos 12 meses · PEGSA en El Haras ·
  // valores ponderados" del módulo Stock Insumos). Misma fórmula que
  // js/modulo-03-stock.js, líneas 833-863. Fuentes:
  //   - consumo_2025.json   → total kg MS y TC anuales (÷ 365 = por día)
  //   - comportamiento_historico.json → snapshots últimos 12 meses con
  //     hacienda_masa.pegsa.por_campo['El Haras'] (kg_proyectado y
  //     cabezas). Promedio simple de los 12 puntos.
  //   - productivo_2025.json → ADP por mes ponderado por cabezas.
  const anuales = (() => {
    const consAn = (consumo && consumo.anual) || {};
    const snaps  = (comportamientoHist && comportamientoHist.snapshots) || [];
    const prodMes = (productivo && productivo.por_mes) || {};

    const ult12 = snaps.slice(-12);
    let sumKg = 0, nKg = 0, sumCab = 0, nCab = 0;
    ult12.forEach(r => {
      const haras = r && r.hacienda_masa && r.hacienda_masa.pegsa
                 && r.hacienda_masa.pegsa.por_campo
                 && r.hacienda_masa.pegsa.por_campo['El Haras'];
      if (haras && haras.kg_proyectado) { sumKg  += haras.kg_proyectado; nKg++;  }
      if (haras && haras.cabezas)       { sumCab += haras.cabezas;       nCab++; }
    });
    const kgPVAnual = nKg  > 0 ? sumKg  / nKg  : 0;
    const cabAnual  = nCab > 0 ? sumCab / nCab : 0;

    let adpNum = 0, adpDen = 0;
    Object.keys(prodMes).sort().slice(-12).forEach(m => {
      const d = prodMes[m] || {};
      const c = d.cabezas || 0;
      const a = d.adp_promedio || 0;
      if (c > 0 && a > 0) { adpNum += a * c; adpDen += c; }
    });
    const adpAnual = adpDen > 0 ? adpNum / adpDen : 0;

    const msAnualDia  = (consAn.total_kg_ms || 0) / 365;
    const tcAnualDia  = (consAn.total_kg    || 0) / 365;
    const pctPV       = kgPVAnual > 0 ? (msAnualDia / kgPVAnual * 100) : null;
    const cabAnualDia = cabAnual  > 0 ? (tcAnualDia / cabAnual) : null;
    const msPorCabDia = cabAnual  > 0 ? (msAnualDia / cabAnual)  : null;
    const conversion  = (msPorCabDia != null && adpAnual > 0)
                      ? (msPorCabDia / adpAnual) : null;
    return {
      pctPV:            pctPV,                     // p.ej. 2.57
      consumoPorCabeza: cabAnualDia,               // p.ej. 17.8
      conversion:       conversion,                // p.ej. 7.9
      _detalle: {
        msAnualTotal: consAn.total_kg_ms, tcAnualTotal: consAn.total_kg,
        kgPVAnual: kgPVAnual, cabAnual: cabAnual,
        adpAnual: adpAnual, msPorCabDia: msPorCabDia
      }
    };
  })();

  // v10 · Eficiencia / Consumo / Conversión:
  // El KPI grande es el ACTUAL que muestra el módulo Stock·Producción
  // "Eficiencia del Rodeo" con TODAS sus transformaciones (no es el
  // valor crudo del JSON):
  //   - %PV actual = indicadores.pct_peso_vivo.valor / 0.92 (ajuste
  //     del módulo, lo lleva de ~2.0 a ~2.17)
  //   - Consumo/cab actual = indicadores.consumo_por_cabeza.valor_tc directo
  //   - Conversión actual = (pvAnual / 100) × kgCabHaras / adpUltMes
  //     (sobreescritura del módulo: NO usa indicadores.conversion_alimenticia.valor)
  // El histórico vuelve a ser el valor anual ponderado (la "REFERENCIA
  // ANUAL" del módulo Stock Insumos = 2,57 / 17,8 / 7,9).

  // 3. Eficiencia % PV (consumo MS como % del peso vivo · El Haras)
  if (indicadores?.indicadores?.pct_peso_vivo?.valor != null) {
    const pvActualAj = indicadores.indicadores.pct_peso_vivo.valor / 0.92;
    D.productivos.pctPV = {
      actual:    { v: pvActualAj,   unit: '%', label: 'hoy',   decimals: 2 },
      historico: { v: anuales.pctPV, unit: '%', label: 'anual', decimals: 2 },
      mejorEs: 'mayor',
      umbrales: { ref_min: 2.2, ref_opt: 2.4, ref_max: 2.7 },
      descripcion: 'Consumo MS como % del peso vivo (El Haras). Hoy = (kg MS/día ÷ kg PV El Haras × 100) ÷ 0,92 — ajuste del módulo. Rango óptimo 2,4-2,6.'
    };
  }

  // 4. Consumo por cabeza (kg TC/cab/día) — valor directo del JSON
  if (indicadores?.indicadores?.consumo_por_cabeza?.valor_tc != null) {
    D.productivos.consumoPorCabeza = {
      actual:    { v: indicadores.indicadores.consumo_por_cabeza.valor_tc, unit: 'kg/cab', label: 'hoy',   decimals: 1 },
      historico: { v: anuales.consumoPorCabeza,                            unit: 'kg/cab', label: 'anual', decimals: 1 },
      mejorEs: 'rango',
      umbrales: { ref_opt_min: 13, ref_opt_max: 15 },
      descripcion: 'Alimento TC por animal por día (El Haras). Hoy = kg TC/día ÷ cabezas El Haras. Rango óptimo 13-15 kg.'
    };
  }

  // 5. Conversión alimenticia (kg MS : kg ganancia)
  // SOBREESCRITA igual que el módulo: usa el %PV anual como factor
  // semi-fijo × peso por cab Haras actual ÷ ADP último mes cerrado.
  // NO se usa indicadores.conversion_alimenticia.valor.
  if (anuales.pctPV != null && indicadores?.fuentes) {
    const f = indicadores.fuentes;
    const kgCabHaras = (f.kg_stock_haras > 0 && f.cab_haras > 0)
      ? f.kg_stock_haras / f.cab_haras : 0;
    const adpUltMes = f.adp_promedio || 0;
    let convActual = null;
    if (kgCabHaras > 0 && adpUltMes > 0) {
      convActual = (anuales.pctPV / 100) * kgCabHaras / adpUltMes;
    }
    D.productivos.conversion = {
      actual:    { v: convActual,         unit: '', label: 'hoy',   decimals: 1 },
      historico: { v: anuales.conversion, unit: '', label: 'anual', decimals: 1 },
      mejorEs: 'menor', // menos kg consumo por kg ganado = mejor
      umbrales: { ref_opt_min: 5, ref_opt_max: 8 },
      descripcion: 'Hoy = (%PV anual × kg/cab Haras) ÷ ADP último mes (sobreescritura del módulo). Anual = MS/cab/día ÷ ADP anual ponderado. Menos = mejor (ref. 5-8).'
    };
  }

  // v8 · Precios de inferencia (4 cards + módulo Mercado tab)
  if (preciosInf && Array.isArray(preciosInf.items)) {
    D.preciosInferencia     = preciosInf.items;
    D.preciosInferenciaMeta = preciosInf.meta || {};
  }
  if (preciosInfHist && Array.isArray(preciosInfHist.semanas)) {
    D.preciosInferenciaHist = preciosInfHist.semanas;
  }

  // 6. Kg repartidos · último día de mixer
  if (Array.isArray(consumo?.diario?.dias) && consumo.diario.dias.length) {
    // Último día NO descartado
    const dias = consumo.diario.dias.slice().reverse();
    const ultimoOk = dias.find(d => !d.descartado);
    const avg3d = consumo.semanal?.promedio_diario_kg || null;
    if (ultimoOk) {
      const f = ultimoOk.fecha || '';
      const labFecha = f ? f.slice(8,10) + "/" + f.slice(5,7) : 'últ. día';
      D.productivos.kgRepartidos = {
        actual:    { v: ultimoOk.kg_total, unit: 'kg', label: labFecha },
        historico: { v: avg3d, unit: 'kg/día', label: 'prom 3 d' },
        mejorEs: 'rango',
        descripcion: 'Kg de alimento repartidos por el mixer el último día con registro completo, vs el promedio de los últimos 3 días.'
      };
    }
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
