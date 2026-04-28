// Datos reales extraídos del portal PEGSA & BULLTRADE
window.PEGSA_DATA = {
  periodo: "Enero – Diciembre 2025",
  empresa: "PECUARIA EL GARABÍ SA & BULLTRADE SRL",
  usuario: { nombre: "Miguel Acosta", rol: "Gerencia · 2025", iniciales: "MA" },

  // Hero KPIs
  hero: {
    patrimonio: { ars: 20_640_000_000, usd: 14_430_000, mep: 1430 },
    resultado: {
      total: 9_191_348_874,
      operativo: 2_948_959_025,
      tenencia: 6_242_389_849,
      ingresosBrutos: 42_615_291_858,
      margenOp: 6.14,
      margenTotal: 18.97,
      rentabilidadAcum: 7.3,
    },
    stock: {
      pegsa: { cabezas: 8651, kg: 3_626_000 },
      total: { cabezas: 9861, kg: 4_324_000, establecimientos: 3 },
    },
  },

  // Mercado
  mercado: {
    novillo: { precio: 4557, label: "Novillo 461/490 kg", unidad: "$/kg vivo", fuente: "MAG · 24/04", delta: 37 },
    vaca: { precio: 3428, label: "Vaca buena", unidad: "$/kg vivo", fuente: "MAG · 24/04", delta: 21 },
    ternero: { precio: 5097, label: "Ternero 330–370 kg", unidad: "$/kg vivo", fuente: "E&C", delta: 64 },
    maiz: { precio: 243150, label: "Maíz BCR", unidad: "$/tn", fuente: "BCR Cám. Arbitral", delta: -2100 },
    soja: { precio: 898987, label: "Soja BCR", unidad: "$/tn", fuente: "BCR Cám. Arbitral", delta: 12500 },
    mep: { precio: 1414, label: "Tipo de Cambio MEP", unidad: "$/USD", fuente: "BCR · hoy", delta: 4 },
  },

  // Tesorería
  tesoreria: {
    posicion: 1_138_000_000,
    semana: "25/04",
    cartera: 1_138_000_000,
    bancos: 463_131_340,
    usd_pos: 1_907_628_109,
  },

  // Centros de negocio (consolidado del período)
  centros: [
    { id: "ganaderia", nombre: "Ganadería", ingresos: 27022, egresos: -25923, operativo: 1098, tenencia: 5825, total: 6924, marginOp: 4.06, marginTot: 25.62 },
    { id: "feedlot", nombre: "Feedlot", ingresos: 10911, egresos: -9004, operativo: 1907, tenencia: 0, total: 1907, marginOp: 17.48, marginTot: 17.48 },
    { id: "consig", nombre: "Consignataria Bull", ingresos: 748, egresos: -352, operativo: 396, tenencia: 0, total: 396, marginOp: 52.96, marginTot: 52.96 },
    { id: "campos", nombre: "Campos", ingresos: 668, egresos: -376, operativo: 292, tenencia: 0, total: 292, marginOp: 43.65, marginTot: 43.65 },
    { id: "transporte", nombre: "Transporte", ingresos: 160, egresos: -98, operativo: 61, tenencia: 0, total: 61, marginOp: 38.55, marginTot: 38.55 },
    { id: "agri", nombre: "Agricultura 24/25", ingresos: 2588, egresos: -2415, operativo: 10, tenencia: 162, total: 173, marginOp: 0.40, marginTot: 6.69 },
    { id: "donpedro", nombre: "Don Pedro", ingresos: 513, egresos: -468, operativo: -208, tenencia: 254, total: 45, marginOp: -40.5, marginTot: 8.90 },
    { id: "equinos", nombre: "Equinos", ingresos: 0, egresos: -0.9, operativo: -0.9, tenencia: 0, total: -0.9, marginOp: 0, marginTot: 0 },
    { id: "admin", nombre: "Administración", ingresos: 0, egresos: -608, operativo: -608, tenencia: 0, total: -608, marginOp: 0, marginTot: 0 },
  ],

  // Stock por categoría (sintético en proporción al stock real)
  stockCategorias: [
    { categoria: "Novillos terminación", cabezas: 2470, kg: 1135000 },
    { categoria: "Novillitos / Vaquillonas", cabezas: 2890, kg: 1014000 },
    { categoria: "Terneros invernada", cabezas: 1660, kg: 425000 },
    { categoria: "Vacas", cabezas: 1145, kg: 562000 },
    { categoria: "Vaquillonas reposición", cabezas: 980, kg: 318000 },
    { categoria: "Toros", cabezas: 75, kg: 52000 },
    { categoria: "Terneras", cabezas: 641, kg: 120000 },
  ],

  // Patrimonio mensual (12 meses)
  patrimonioMensual: [
    { mes: "Ene", ars: 16800, usd: 12100 },
    { mes: "Feb", ars: 17200, usd: 12350 },
    { mes: "Mar", ars: 17900, usd: 12600 },
    { mes: "Abr", ars: 18400, usd: 12900 },
    { mes: "May", ars: 18100, usd: 13050 },
    { mes: "Jun", ars: 18950, usd: 13280 },
    { mes: "Jul", ars: 19400, usd: 13550 },
    { mes: "Ago", ars: 19720, usd: 13700 },
    { mes: "Sep", ars: 19850, usd: 13880 },
    { mes: "Oct", ars: 20100, usd: 14050 },
    { mes: "Nov", ars: 20400, usd: 14260 },
    { mes: "Dic", ars: 20640, usd: 14430 },
  ],

  // Sparklines KPIs (últimos 12 puntos relativos)
  sparks: {
    patrimonioArs: [16.8, 17.2, 17.9, 18.4, 18.1, 18.95, 19.4, 19.72, 19.85, 20.1, 20.4, 20.64],
    patrimonioUsd: [12.1, 12.35, 12.6, 12.9, 13.05, 13.28, 13.55, 13.7, 13.88, 14.05, 14.26, 14.43],
    rentabilidad: [4.2, 4.6, 5.1, 5.4, 5.9, 6.1, 6.3, 6.5, 6.8, 7.0, 7.15, 7.3],
    stockKg: [3.45, 3.48, 3.52, 3.50, 3.55, 3.58, 3.60, 3.59, 3.61, 3.62, 3.62, 3.626],
    novillo: [4180, 4220, 4260, 4310, 4350, 4380, 4400, 4440, 4460, 4500, 4520, 4557],
    vaca: [3120, 3150, 3180, 3220, 3260, 3290, 3310, 3350, 3370, 3400, 3410, 3428],
    maiz: [201000, 208000, 215000, 220000, 224000, 230000, 234000, 237000, 240000, 242000, 244500, 243150],
    soja: [820000, 835000, 850000, 860000, 868000, 875000, 880000, 885000, 890000, 895000, 901000, 898987],
    mep: [1280, 1295, 1310, 1325, 1338, 1350, 1362, 1375, 1390, 1398, 1408, 1414],
  },

  // Heatmap resultado mensual por centro (M$)
  heatmap: {
    meses: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    centros: [
      { nombre: "Ganadería",  data: [420, 510, 480, 590, 615, 580, 650, 690, 660, 620, 580, 530] },
      { nombre: "Feedlot",    data: [120, 140, 155, 165, 158, 172, 180, 188, 195, 178, 138, 118] },
      { nombre: "Consig.Bull",data: [28, 31, 33, 35, 32, 36, 38, 40, 35, 33, 28, 27] },
      { nombre: "Campos",     data: [22, 23, 24, 25, 25, 26, 26, 26, 25, 24, 23, 23] },
      { nombre: "Agricultura",data: [-5, -8, 5, 12, 18, 22, 28, 38, 42, 28, 18, 15] },
      { nombre: "Transporte", data: [4, 5, 5, 5, 5, 5, 5, 5, 6, 6, 5, 5] },
      { nombre: "Don Pedro",  data: [-15, -18, -8, -2, 5, 12, 18, 22, 18, 8, 4, -1] },
      { nombre: "Administr.", data: [-48, -50, -51, -50, -52, -50, -51, -52, -51, -50, -52, -51] },
    ],
  },

  // Módulos
  modulos: [
    { n: "01", id: "estado-resultados", titulo: "Estado de Resultados", desc: "Análisis por centro · operativo + tenencia", estado: "disponible", kpi: "+$9.191.348.874", kpiLabel: "Resultado neto del período" },
    { n: "02", id: "flujo-fondos", titulo: "Flujo de Fondos", desc: "Origen y aplicación · cobros y pagos", estado: "disponible", kpi: "+$3.803.431.457", kpiLabel: "Superávit de caja operativo" },
    { n: "03", id: "stock-masa", titulo: "Stock de Masa — Kilos", desc: "WinCampo · OneDrive · 07:00 AM", estado: "vivo", kpi: "9.861 cab", kpiLabel: "4.324.000 kg estimados hoy" },
    { n: "04", id: "stock-insumos", titulo: "Stock de Insumos", desc: "Diesel · maíz · soja · gluten · más", estado: "vivo", kpi: "12 ítems", kpiLabel: "Diesel: 18 días restantes" },
    { n: "05", id: "mercado", titulo: "Mercado y Precios", desc: "MAG · BCR · E&C", estado: "disponible", kpi: "$4.557", kpiLabel: "Novillo 461/490 · MAG hoy" },
    { n: "06", id: "tesoreria", titulo: "Tesorería", desc: "Saldos · cheques · USD · deuda", estado: "vivo", kpi: "$1.138.000.000", kpiLabel: "Cartera positiva · sem. 25/04" },
    { n: "07", id: "simulador", titulo: "Simulador Feedlot", desc: "Terneros · vacas · invernada", estado: "disponible", kpi: "TIR ~38%", kpiLabel: "Equiv. anual sandbox" },
    { n: "08", id: "historico", titulo: "Histórico & Evolución", desc: "Hasta 30 meses de historia", estado: "acumulando", kpi: "+22,8%", kpiLabel: "Patrimonio USD vs ene-25" },

    { n: "09", id: "parametros-base", titulo: "Parámetros Base", desc: "Configuración del simulador · Precios y rendimientos por categoría", estado: "disponible", kpi: "Config", kpiLabel: "Estimación de precios" },  ],

  // Alertas (pocas, relevantes)
  alertas: [
    { tipo: "warn", texto: "Diesel: 18 días de stock restantes" },
    { tipo: "info", texto: "Nuevo cierre mensual disponible · marzo 2026" },
  ],
};
