/* ════════════════════════════════════════════════════════════════════════
   data.js — Data loader real para Panel Principal PEGSA & BULLTRADE
   ────────────────────────────────────────────────────────────────────────
   Reemplaza el data.js de demo. Lee los JSON reales del repo y expone
   `window.D` con la misma estructura que consume `app.jsx` / `shell.jsx`
   / `charts.jsx`.

   Filosofía:
   - Carga TODO en paralelo
   - Espera con `window.dataReady` (Promise) que el panel chequea antes de montar
   - Fallbacks razonables (`—`, `0`, []) si un JSON falla a cargar
   ════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ───────────────────────── helpers ─────────────────────────────── */
  const fetchJson = (name) =>
    fetch(name).then(r => r.ok ? r.json() : null).catch(() => null);

  // Helper: convierte cualquier cosa a array. Si recibe objeto, lo transforma
  // en array de {clave + props del valor}. Si recibe array, lo devuelve tal cual.
  // Si recibe null/undefined/otra cosa, devuelve [].
  const asArray = (x, keyName = 'cat') => {
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') {
      return Object.entries(x).map(([k, v]) => {
        if (v && typeof v === 'object') return { [keyName]: k, ...v };
        return { [keyName]: k, valor: v };
      });
    }
    return [];
  };

  const fmtAR = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-AR');
  const money = (n) => n == null || isNaN(n) ? '—' : '$ ' + Math.round(n).toLocaleString('es-AR');
  const usd   = (n) => n == null || isNaN(n) ? '—' : 'U$S ' + Math.round(n).toLocaleString('es-AR');
  const pct   = (n, sign = true) => {
    if (n == null || isNaN(n)) return '—';
    const s = n > 0 && sign ? '+' : n < 0 ? '−' : '';
    return s + Math.abs(n).toFixed(1).replace('.', ',') + '%';
  };

  /* devuelve el último día del mes en curso en formato corto es-AR */
  const lastDayOfMonth = () => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return last.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  /* ───────────────────────── boot ────────────────────────────────── */
  window.dataReady = (async function () {

    /* Carga paralela */
    const [
      stockKpis, stockDiario, stockInsumos,
      mercado, tesoreria, indicadores, financierohist, negocios
    ] = await Promise.all([
      fetchJson('stock_kpis_2025.json'),
      fetchJson('stock_diario.json'),
      fetchJson('stock_insumos_2025.json'),
      fetchJson('mercado_precios.json'),
      fetchJson('tesoreria_ultimo.json'),
      fetchJson('indicadores_2025.json'),
      fetchJson('financiero_historico.json'),
      fetchJson('negocios_resumen.json'),
    ]);

    /* ─────────────── HERO META ───────────────────────────────────── */
    const updateLabel = (() => {
      const iso = stockKpis?.meta?.generado;
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d)) return '—';
      const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
      const hora  = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      return `${fecha} · ${hora}`;
    })();

    /* ─────────────── ALERTAS ─────────────────────────────────────── */
    const insumoCritico = asArray(stockInsumos?.insumos, "nombre")
      .filter(i => i.dias_restantes != null && i.dias_restantes >= 0)
      .sort((a, b) => a.dias_restantes - b.dias_restantes)[0];

    const alertas = [
      insumoCritico ? {
        tipo: 'warn',
        tag: 'STOCK',
        texto: `${insumoCritico.nombre} con ${insumoCritico.dias_restantes.toFixed(1).replace('.', ',')} días restantes — revisar reposición esta semana`,
      } : null,
      {
        tipo: 'info',
        tag: 'CIERRE',
        texto: `Cierre de mes ${lastDayOfMonth()} · Pendiente conciliación bancaria y carga de movimientos`,
      },
    ].filter(Boolean);

    /* ─────────────── TIER 1 · STOCK ──────────────────────────────── */
    const kp = stockKpis?.kpis || {};
    const peg = kp.por_propietario?.PEGSA || {};

    const sparklinePegsa = asArray(stockDiario?.snapshots).slice(-30)
      .map(s => s.hacienda?.por_propietario?.PEGSA?.cabezas)
      .filter(v => v != null);

    const sparklineTotal = asArray(stockDiario?.snapshots).slice(-30)
      .map(s => s.hacienda?.total_cabezas)
      .filter(v => v != null);

    const tierStock = {
      pegsa: {
        cabezas: peg.cabezas,
        kg: peg.kg_estimado,
        kgPorCab: peg.kg_estimado && peg.cabezas ? peg.kg_estimado / peg.cabezas : null,
        sparkline: sparklinePegsa,
      },
      total: {
        cabezas: kp.total_cabezas,
        kg: kp.total_kg_estimado_hoy,
        propietarios: kp.total_propietarios,
        establecimientos: kp.total_establecimientos,
        sparkline: sparklineTotal,
      },
    };

    /* ─────────────── TIER 2 · ACTIVO + TESORERÍA + RENT ──────────── */
    const pos = tesoreria?.posicion || {};
    const totalARS =
      asArray(pos.bancos_peg).reduce((s, b) => s + (b.saldo || 0), 0) +
      asArray(pos.bancos_bull).reduce((s, b) => s + (b.saldo || 0), 0) +
      (pos.efectivo || 0) + (pos.becerra || 0) +
      (pos.fima_peg || 0) + (pos.fima_bull || 0) +
      (pos.fci || 0) + (pos.echeq || 0);

    /* Última semana donde el saldo acumulado es positivo */
    const ser = tesoreria?.flujo?.series?.saldo_acumulado || [];
    const sem = tesoreria?.flujo?.semanas || [];
    let lastPosIdx = -1;
    for (let i = 0; i < ser.length; i++) if (ser[i] >= 0) lastPosIdx = i;
    const ultimoPositivo = lastPosIdx >= 0 ? sem[lastPosIdx] : '—';

    const tc = pos.usd_ars && pos.usd_cant ? pos.usd_ars / pos.usd_cant : null;

    /* Rentabilidad acumulada */
    const ind = indicadores?.indicadores || {};
    const rent = ind.rentabilidad_acumulada
              ?? ind.roe
              ?? ind.rentabilidad_neta
              ?? null;

    const tierActivo = {
      ars: {
        valor: totalARS,
        deltaPct: ind.activo_corriente?.var_trimestre ?? null,
      },
      usd: {
        valor: pos.usd_cant,
        tc,
      },
      tesoreria: {
        ultimoPositivo,
        disponible: pos.saldo_disponibilidades || totalARS,
      },
      rentabilidad: {
        valor: rent,
      },
    };

    /* ─────────────── TIER 3 · MERCADO ────────────────────────────── */
    const findIn = (arr, ...keys) => {
      if (!arr) return null;
      for (const item of arr) {
        const blob = JSON.stringify(item).toLowerCase();
        if (keys.every(k => blob.includes(k.toLowerCase()))) return item;
      }
      return null;
    };

    const novillo = findIn(mercado?.hacienda, '461/490');
    const vaca    = findIn(mercado?.hacienda, 'vaca') || findIn(mercado?.hacienda, 'vacas buenas');
    const maiz    = findIn(mercado?.commodities, 'maíz') || findIn(mercado?.commodities, 'maiz');
    const soja    = findIn(mercado?.commodities, 'soja');
    const ter330  = findIn(mercado?.terneros_esyc, '330') || findIn(mercado?.terneros, '330');
    const dolar   = (mercado?.insumos && (mercado.insumos.dolar || findIn(mercado.insumos, 'mep')))
                    ?? null;

    const variacionPct = (item) => {
      if (!item || item.precio == null) return null;
      if (item.variacion != null && item.precio) {
        return (item.variacion / item.precio) * 100;
      }
      return null;
    };

    const tierMercado = [
      { id: 'novillo', label: 'Novillo 461/490', precio: novillo?.precio, unidad: '/kg', delta: variacionPct(novillo) },
      { id: 'vaca',    label: 'Vaca buena',      precio: vaca?.precio,    unidad: '/kg', delta: variacionPct(vaca) },
      { id: 'maiz',    label: 'Maíz BCR',        precio: maiz?.precio,    unidad: '/tn', delta: variacionPct(maiz) },
      { id: 'soja',    label: 'Soja BCR',        precio: soja?.precio,    unidad: '/tn', delta: variacionPct(soja) },
      { id: 'ter330',  label: 'Ternero 330',     precio: ter330?.precio,  unidad: '/kg', delta: variacionPct(ter330) },
      { id: 'mep',     label: 'Dólar MEP',       precio: typeof dolar === 'number' ? dolar : dolar?.precio, unidad: '$/USD', delta: null },
    ];

    /* ─────────────── EVOLUCIÓN PATRIMONIAL ───────────────────────── */
    const evolucion = asArray(financierohist?.cortes, "fecha").map(c => ({
      fecha: c.fecha || c.periodo,
      ars: c.activo_corriente_ars || c.activo_ars || c.ars,
      usd: c.activo_corriente_usd || c.activo_usd || c.usd,
    })).filter(p => p.ars != null);

    /* ─────────────── COMPOSICIÓN DEL RESULTADO (donut) ───────────── */
    const composicion = asArray(negocios?.resumen_cat, "cat").map(c => ({
      label: c.cat || c.categoria,
      value: c.total ?? ((c.ventas || 0) - (c.compras || 0)),
    })).filter(c => c.value > 0);

    /* ─────────────── MÓDULOS DEL HOME ────────────────────────────── */
    const modulos = [
      { id: 'resultados',  num: '01', titulo: 'Estado de Resultados', desc: 'Operativo y tenencia · por centro de negocio', kpi: rent != null ? pct(rent) : '', kpiLbl: 'ROE acum.' },
      { id: 'flujo',       num: '02', titulo: 'Flujo de Fondos',       desc: 'Ingresos, egresos y saldo proyectado',         kpi: sem.length ? `${sem.length} sem` : '', kpiLbl: 'horizonte' },
      { id: 'stock',       num: '03', titulo: 'Stock & Masa',          desc: 'Cabezas, kilogramos y composición',            kpi: kp.total_cabezas ? fmtAR(kp.total_cabezas) : '', kpiLbl: 'cabezas' },
      { id: 'insumos',     num: '04', titulo: 'Stock de Insumos',      desc: 'Días de cobertura · alertas críticas',         kpi: insumoCritico ? `${insumoCritico.dias_restantes.toFixed(1).replace('.',',')} d` : '', kpiLbl: 'crítico' },
      { id: 'mercado',     num: '05', titulo: 'Mercado',               desc: 'Cañuelas, BCR y precios invernada',            kpi: novillo?.precio ? '$ ' + fmtAR(novillo.precio) : '', kpiLbl: 'novillo' },
      { id: 'tesoreria',   num: '06', titulo: 'Tesorería',             desc: 'Bancos, cheques y flujo proyectado',           kpi: pos.saldo_disponibilidades ? '$ ' + Math.round(pos.saldo_disponibilidades / 1e6) + 'M' : '', kpiLbl: 'disponible' },
      { id: 'simulador',   num: '07', titulo: 'Simulador',             desc: 'Proyección económica what-if',                 kpi: '', kpiLbl: '' },
      { id: 'historico',   num: '08', titulo: 'Histórico',             desc: 'Comportamiento de stock y financiero',         kpi: '', kpiLbl: '' },
    ];

    /* ─────────────── window.D — interfaz pública ─────────────────── */
    window.D = {
      hero: {
        eyebrow: 'PERÍODO ENERO – DICIEMBRE 2025',
        titulo: 'PECUARIA EL GARABÍ SA',
        tituloEm: '& BULLTRADE SRL',
        subtitulo: 'Sistema integrado de gestión · Resumen ejecutivo y acceso a los 8 módulos del portal',
        actualizado: updateLabel,
      },
      alertas,
      tierStock,
      tierActivo,
      tierMercado,
      evolucion,
      composicion,
      modulos,

      /* helpers expuestos para componentes */
      fmt: { fmtAR, money, usd, pct },
    };

    /* Notifica que los datos están listos */
    window.dispatchEvent(new CustomEvent('panel:data-ready', { detail: window.D }));

    return window.D;
  })();
})();
