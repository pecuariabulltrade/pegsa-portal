/* ============================================================
   mobile-data.js  —  Adaptador de datos REALES para la vista mobile
   Lee window.PEGSA_DATA (data.js) y arma window.MOBILE_DATA.
   Re-construye al recibir 'panel:data-ready' (JSONs reales).

   Versiones:
   v3 (2026-05-27): auditoría aplicada — todos los datos vienen de
       PEGSA_DATA real, etiquetas dinámicas según frecuencia de serie,
       sanitización de fechas ISO en alertas, var12m / flujo semanal reales.
   v4 (2026-05-27): drill modal Stock con barras+donut SVG, sacar tabs
       superior, KPIs de módulos directos de m.kpi/m.kpiLabel (sin
       kpiOverrides ni recompactación de valor), fix defensivo del
       race var12m N/D.
   v5 (2026-05-27): drill Stock muestra PEGSA propio primero y Grupo
       después (categoriasPegsa nuevo). Sección nueva "Todos los insumos"
       con lista completa de stockInsumos (espejo del módulo Stock
       Insumos del desktop), incluye semaforización por días restantes
       y mini-bar del % del total.
   v6 (2026-05-28): "Todos los insumos" deja de ser card en el panel y
       pasa a vivir DENTRO del modal de Silo / Maíz (un tap desde el
       insumo crítico muestra detalle + resumen, sin ocupar lugar).
       Nueva sección "Productivos" (mobile + desktop) con 6 KPIs del
       feedlot: engorde diario, estadía, eficiencia % PV, consumo/cab,
       conversión y kg repartidos del último día de mixer. Datos
       calculados en data.js (D.productivos) — una sola fuente de verdad.
   v7 (2026-05-28): rediseño visual de Productivos según mockup del
       usuario. Las cards ahora tienen semáforo escalonado:
         |Δ| > 20%       → SEVERO: fondo coloreado + KPI coloreado
         10% ≤ |Δ| ≤ 20% → MODERADO: tarjeta blanca, chip coloreado
         |Δ| < 10%       → NEUTRO: todo gris
       cruzado con tone (good/bad/neutral) según mejorEs + signo del Δ.
       KPI grande en Playfair Display. mejorEs='rango' = siempre neutral.
   ============================================================ */
(function (root) {
  "use strict";

  // ---------- Helpers ----------
  var fmt = function (n) { return Number(n).toLocaleString("es-AR"); };
  var fmtPct = function (n, dec) {
    if (n == null || isNaN(n)) return "—";
    var d = typeof dec === "number" ? dec : 1;
    var s = Math.abs(n).toFixed(d).replace(".", ",");
    return (n >= 0 ? "+" : "-") + s + "%";
  };
  var fmtMoney = function (n, suffix) {
    if (n == null || isNaN(n)) return "—";
    var sign = n < 0 ? "-" : (n > 0 ? "+" : "");
    var v = fmt(Math.abs(n));
    return sign + "$ " + v + (suffix ? " " + suffix : "");
  };
  // Compactar montos: 1.363.651.930 → "$1,4 MM", 352.200.997 → "$352 M"
  var fmtMoneyCompact = function (n) {
    if (n == null || isNaN(n)) return "—";
    var a = Math.abs(n);
    var sign = n < 0 ? "-" : "";
    if (a >= 1e9) return sign + "$ " + (a / 1e9).toFixed(2).replace(".", ",") + " MM";
    if (a >= 1e6) return sign + "$ " + Math.round(a / 1e6) + " M";
    if (a >= 1e3) return sign + "$ " + Math.round(a / 1e3) + " k";
    return sign + "$ " + fmt(a);
  };
  var fmtCompact = function (n) {
    if (n == null || isNaN(n)) return "—";
    var a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + "M";
    if (a >= 1e4) return Math.round(n / 1000) + "k";
    return fmt(n);
  };
  var deltaSerie = function (arr) {
    if (!Array.isArray(arr) || arr.length < 2) return null;
    var a = arr[arr.length - 2], b = arr[arr.length - 1];
    if (!a) return null;
    return ((b - a) / a) * 100;
  };
  var deltaTotal = function (arr) {
    if (!Array.isArray(arr) || arr.length < 2) return null;
    var a = arr[0], b = arr[arr.length - 1];
    if (!a) return null;
    return ((b - a) / a) * 100;
  };
  // Parsea ISO "2026-05-26T09:00:02.741905" → "26/05/26 09:00"
  var fmtFechaISO = function (s) {
    if (!s) return "";
    try {
      var d = new Date(s);
      if (isNaN(d.getTime())) return String(s).split("T")[0].split(" ")[0];
      var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
      return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + String(d.getFullYear()).slice(-2) +
             " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    } catch (e) { return String(s); }
  };
  var fmtFechaCorta = function (s) {
    if (!s) return "";
    try {
      var d = new Date(s);
      if (isNaN(d.getTime())) return String(s).split("T")[0];
      var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
      return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + String(d.getFullYear()).slice(-2);
    } catch (e) { return String(s); }
  };

  // Saludo dinámico según hora (6-12: día, 12-19: tardes, resto: noches)
  var getSaludo = function () {
    var h = new Date().getHours();
    if (h >= 6 && h < 12) return "Buen día";
    if (h >= 12 && h < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  // Sanitiza fechas ISO YYYY-MM-DD dentro de un texto → DD/MM
  var sanitizarFechas = function (s) {
    if (!s) return s;
    return String(s).replace(/(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+)?/g, function (_, _y, m, d) {
      return d + "/" + m;
    });
  };

  // Label dinámico de delta según N puntos y primer periodo de la serie
  // Para series mensuales (sparks de patrimonio): "vs MMM-YY"
  // Para series diarias (sparks de stock diario): "últ. N días"
  var buildDeltaLabel = function (kind, nPuntos, firstPeriodo) {
    if (!nPuntos || nPuntos < 2) return "";
    if (kind === "mensual" && firstPeriodo) {
      // firstPeriodo formato YYYY-MM
      var p = String(firstPeriodo).split("-");
      var MESES_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
      var mIdx = parseInt(p[1], 10) - 1;
      var yShort = (p[0] || "").slice(-2);
      if (mIdx >= 0 && mIdx < 12 && yShort) {
        return "vs " + MESES_SHORT[mIdx] + "-" + yShort;
      }
      return nPuntos + " m";
    }
    if (kind === "diario") return "últ. " + nPuntos + " días";
    if (kind === "diario-meses") return "últ. " + nPuntos + " m";
    return nPuntos + " p";
  };

  var MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  var TABS = ["Importante", "Insumos", "Sub-datos", "Módulos"];
  var BOTTOM_TABS = [
    { id: "panel",   label: "Panel",   icon: "home" },
    { id: "datos",   label: "Datos",   icon: "chart" },
    { id: "alertas", label: "Alertas", icon: "bell" },
    { id: "modulos", label: "Módulos", icon: "grid" }
  ];

  // Mapping mobile module id → portal module id (id que entiende openModule)
  // Espejo del _PANEL_TO_PORTAL_ID en app.jsx del desktop.
  var PANEL_TO_PORTAL_ID = {
    "stock-masa":        "stock",
    "stock-insumos":     "insumos",
    "mercado":           "mercado",
    "tesoreria":         "tesoreria",
    "simulador":         "simulador",
    "historico":         "historico",
    "estado-resultados": "resultados",
    "flujo-fondos":      "flujo",
    "parametros-base":   "baseparams"
  };

  // ---------- Builder ----------
  function buildMobileData() {
    var D = root.PEGSA_DATA || {};
    var lastUpdateFmt = fmtFechaISO(D.lastUpdate) || fmtFechaCorta(new Date().toISOString());

    var nAlertas = (D.alertas || []).length;
    var nModulos = (D.modulos || []).filter(function (m) { return m.grupo !== "config"; }).length;

    var HEADER = {
      brand: "PEGSA & BULL",
      sub: "Dirección · " + lastUpdateFmt,
      notifications: nAlertas
    };

    var SALUDO = {
      eyebrow: "PERÍODO " + (D.periodo || "—").toUpperCase(),
      h1Pre: getSaludo() + ", ",
      h1Em: "dirección",
      h1Post: ".",
      sub: "Última act. " + lastUpdateFmt +
           " · " + nAlertas + " alerta" + (nAlertas === 1 ? "" : "s") +
           " · " + nModulos + " módulos"
    };

    var sevMap = { warn: "warn", info: "info", bad: "bad", error: "bad", critico: "bad" };
    var ALERTAS = (D.alertas || []).map(function (a, i) {
      return {
        id: "a" + i,
        sev: sevMap[a.tipo] || "info",
        text: sanitizarFechas(a.texto),
        textRaw: a.texto || ""
      };
    });

    // ---------- Stock hero ----------
    var stockH = (D.hero && D.hero.stock) || { pegsa: {}, total: {} };
    var pegsaCab = (stockH.pegsa && stockH.pegsa.cabezas) || 0;
    var pegsaKg  = (stockH.pegsa && stockH.pegsa.kg) || 0;
    var totalCab = (stockH.total && stockH.total.cabezas) || 0;
    var totalKg  = (stockH.total && stockH.total.kg) || 0;
    var totalEst = (stockH.total && stockH.total.establecimientos) || 0;
    var hoteleros = (D.hoteleros && D.hoteleros.cabezas) || Math.max(0, totalCab - pegsaCab);

    // var12m REAL — viene de D.stockVar12m (Sprint 1, calculado desde
    // stock_historico.json con snapshots mensuales). Si no existe, "N/D".
    var var12mStock = (typeof D.stockVar12m === "number") ? D.stockVar12m : null;

    // pegsa.est REAL — desde D.haciendaPegsaPorEstab (Sprint 1) o null.
    var pegsaEst = (Array.isArray(D.haciendaPegsaPorEstab) && D.haciendaPegsaPorEstab.length)
                 ? D.haciendaPegsaPorEstab.length : null;

    var STOCK_HERO = {
      title: "Stock de hacienda",
      sub: "Grupo completo · " + (totalEst || "—") + " establecimientos",
      pegsa: {
        tag: "propio",
        cab: pegsaCab,
        t: Math.round(pegsaKg / 1000),
        kgCab: pegsaCab ? Math.round(pegsaKg / pegsaCab) : 0,
        est: pegsaEst
      },
      grupo: {
        tag: "total",
        cab: totalCab,
        t: Math.round(totalKg / 1000),
        kgCab: totalCab ? Math.round(totalKg / totalCab) : 0,
        est: totalEst
      },
      var12m: var12mStock,
      var12mLabel: "Variación 12 m",
      hoteleros: hoteleros,
      // Para el modal drill (espejo del desktop):
      //  - categoriasPegsa: barras por categoría de PEGSA propio
      //    (D.stockCategoriasPegsa, parsed en data.js desde
      //    stock_prop_PEGSA_2025.json.por_categoria_final).
      //  - categorias: barras por categoría del Grupo completo
      //    (D.stockCategorias, desde stock_kpis_2025.json).
      //  - detallePorEstab: torta por establecimiento PEGSA propio
      //    (D.haciendaPegsaPorEstab).
      // v5: ahora mostramos PEGSA primero, Grupo segundo (el desktop
      // expone ambos vía módulo Stock).
      categoriasPegsa: Array.isArray(D.stockCategoriasPegsa) ? D.stockCategoriasPegsa : [],
      categorias: Array.isArray(D.stockCategorias) ? D.stockCategorias : [],
      detallePorEstab: Array.isArray(D.haciendaPegsaPorEstab) ? D.haciendaPegsaPorEstab : []
    };

    // ---------- Mercado · cotizaciones ----------
    var M = D.mercado || {};
    var fechaMercado = M.fecha ? fmtFechaCorta(M.fecha) : null;

    function cot(key, label, fuente) {
      var m = M[key];
      if (!m) return { label: label, fuente: fuente, delta: null, value: "—", unit: "", deltaSrc: null };

      // Delta real: D.mercado[key].delta es diferencia absoluta en $ vs día anterior.
      // Convertimos a %: delta / (precio - delta) * 100. Si delta=null o precio<=0, null.
      var dAbs = (typeof m.delta === "number") ? m.delta : null;
      var pAct = m.precio || 0;
      var dPct = null;
      if (dAbs != null && pAct > 0) {
        var pPrev = pAct - dAbs;
        if (pPrev > 0) dPct = (dAbs / pPrev) * 100;
      }

      var value;
      if (key === "maiz" || key === "soja") value = "$ " + fmtCompact(pAct);
      else value = "$ " + fmt(pAct);

      return {
        label: label,
        fuente: fuente,
        delta: dPct,
        deltaAbs: dAbs,
        value: value,
        precio: pAct,
        unit: m.unidad || "",
        deltaSrc: dAbs != null ? "vs día anterior" : null
      };
    }
    var COTIZACIONES = {
      title: "Mercado · cotizaciones",
      sub: "MAG · BCR · E&C", // label fijo de fuentes (no es dato)
      fecha: fechaMercado,
      items: [
        cot("novillo", "Novillo MAG",  "MAG"),
        cot("vaca",    "Vaca MAG",     "MAG"),
        cot("ternero", "Ternero E&C",  "E&C"),
        cot("maiz",    "Maíz BCR",     "BCR"),
        cot("soja",    "Soja BCR",     "BCR"),
        cot("mep",     "Dólar MEP",    "BCR")
      ]
    };

    // ---------- Insumos críticos ----------
    var stateMap = { bad: "bad", warn: "warn", ok: "ok", inconsistente: "warn" };
    var stateLabelMap = { bad: "Crítico", warn: "Atención", ok: "OK", inconsistente: "Revisar" };
    function fmtT(kg) {
      if (kg == null) return "—";
      var t = kg / 1000;
      return (Math.abs(t) >= 100 ? Math.round(t) : t.toFixed(1).replace(".", ",")) + " t";
    }
    function fmtTDia(kg) {
      if (kg == null) return "—";
      var t = kg / 1000;
      return (Math.abs(t) >= 10 ? Math.round(t) : t.toFixed(1).replace(".", ",")) + " t";
    }
    function fmtDiasInsumo(it) {
      if (it.inconsistente) return "—";
      if (it.dias == null || isNaN(it.dias)) return "—";
      return Math.max(0, Math.round(it.dias));
    }

    var INSUMOS = (D.insumosCriticos || []).slice(0, 2).map(function (it) {
      var rows;
      if (it.inconsistente) {
        rows = [
          { k: "Estado", v: "Datos inconsistentes" },
          { k: "Stock",       v: fmtT(it.stock_kg) },
          { k: "Consumo/día", v: fmtTDia(it.consumo_kg_dia) }
        ];
      } else {
        rows = [
          { k: "Stock",       v: fmtT(it.stock_kg) },
          { k: "Consumo/día", v: fmtTDia(it.consumo_kg_dia) },
          { k: it.fecha_ult_compra ? "Últ. compra" : "Reposición",
            v: it.fecha_ult_compra ? fmtFechaCorta(it.fecha_ult_compra) : "N/D" }
        ];
      }
      return {
        id: it.nombre,
        title: it.nombre,
        sub: it.inconsistente ? "Revisar datos del pipeline" : (it.descripcion || "—"),
        state: stateMap[it.estado] || "warn",
        stateLabel: stateLabelMap[it.estado] || "Atención",
        dias: fmtDiasInsumo(it),
        diasRaw: it.dias,
        inconsistente: !!it.inconsistente,
        stockKg: it.stock_kg,
        consumoKgDia: it.consumo_kg_dia,
        ultCompra: it.fecha_ult_compra,
        rows: rows
      };
    });

    if (INSUMOS.length === 0) {
      INSUMOS.push({
        id: "placeholder",
        title: "Cargando insumos...",
        sub: "Esperando datos",
        state: "warn",
        stateLabel: "...",
        dias: "—",
        rows: [
          { k: "Stock", v: "—" },
          { k: "Consumo/día", v: "—" },
          { k: "Reposición", v: "—" }
        ]
      });
    }

    // ---------- v5 · Insumos · lista completa ----------
    // D.stockInsumosTodos viene de data.js poblado desde
    // stock_insumos_2025.json (todos los items + total + meta).
    // Se muestra en una sección nueva "Todos los insumos" en el panel
    // mobile, espejo del módulo Stock Insumos del desktop. Si no está
    // disponible (data.js viejo), INSUMOS_ALL queda vacío y la sección
    // no se renderiza.
    var INSUMOS_ALL = [];
    var INSUMOS_TOTAL = { totalKg: 0, count: 0, fecha: null };
    var stk = D.stockInsumosTodos;
    if (stk && Array.isArray(stk.items) && stk.items.length) {
      INSUMOS_TOTAL = {
        totalKg: (stk.meta && stk.meta.total_kg) || 0,
        count:   (stk.meta && stk.meta.count) || stk.items.length,
        fecha:   (stk.meta && stk.meta.generado) ? fmtFechaCorta(stk.meta.generado) : null
      };
      // Orden: críticos (bad) primero, luego warn, luego ok, luego sin dato.
      var ORD = { bad: 0, warn: 1, ok: 2, null: 3 };
      INSUMOS_ALL = stk.items
        .slice()
        .sort(function (a, b) {
          var oa = ORD[a.semaforo == null ? "null" : a.semaforo];
          var ob = ORD[b.semaforo == null ? "null" : b.semaforo];
          if (oa !== ob) return oa - ob;
          // dentro del mismo semáforo: menos días primero
          var da = a.dias == null ?  1e9 : a.dias;
          var db = b.dias == null ?  1e9 : b.dias;
          return da - db;
        })
        .map(function (it) {
          return {
            id:           it.nombre_raw || it.nombre,
            nombre:       it.nombre,
            descripcion:  it.descripcion,
            stockKg:      it.stock_kg,
            consumoKgDia: it.consumo_kg_dia,
            dias:         it.dias,
            diasFmt:      it.dias == null ? "—" : Number(it.dias).toFixed(1).replace(".", ","),
            semaforo:     it.semaforo,
            estado:       it.estado,
            inconsistente: it.inconsistente,
            pctTotal:     it.pct_total
          };
        });
    }

    // ---------- Financiero · saldo proyectado (Sprint 2C real) ----------
    var fs = D.flujoSemanal || null;
    var FLUJO_SEMANAL;
    if (fs) {
      // Datos REALES desde tesoreria_ultimo.json.flujo (Sprint 2C-fix-2)
      var primera = fs.cierrePrimera || {};
      var ultima  = fs.cierreFinal || {};
      var sems = Array.isArray(fs.semanas) ? fs.semanas : [];

      FLUJO_SEMANAL = {
        title: "Financiero · saldo proyectado",
        sub: "Sem " + (fs.semanaNumActual || "—") + " · " + (fs.anioActual || ""),
        cerrada: {
          label: "CIERRE",
          range: primera.rangoLabel || primera.label || "—",
          value: primera.valor != null ? primera.valor : null
        },
        proxima: {
          label: "SALDO PROYECTADO",
          range: "Cierre semana " + (ultima.label || "—"),
          value: ultima.valor != null ? ultima.valor : null
        },
        bars: sems.map(function (s, i) {
          return {
            label: s.label,
            v: s.saldoAcumulado != null ? s.saldoAcumulado : 0,
            kind: s.estado === "next" ? "next" : (s.estado === "done" ? "past" : "proj")
          };
        }),
        acumulado: {
          label: "Saldo de partida",
          sub: "Hoy",
          value: fs.saldoInicial != null ? fs.saldoInicial : null
        },
        fechaCorte: fs.fechaCorte
      };
    } else {
      // Fallback si no hay datos de flujo (improbable, pero no inventar)
      var tes = D.tesoreria || {};
      FLUJO_SEMANAL = {
        title: "Financiero · saldo proyectado",
        sub: "Sin datos de flujo semanal",
        cerrada: { label: "CARTERA", range: "Cobranzas pendientes", value: tes.cartera != null ? tes.cartera : null },
        proxima: { label: "BANCOS", range: "Saldos bancarios", value: tes.bancos != null ? tes.bancos : null },
        bars: [],
        acumulado: { label: "Posición USD", sub: "Inversiones + caja", value: tes.usd_pos != null ? tes.usd_pos : null }
      };
    }

    // ---------- Patrimonio USD (line chart) ----------
    // Sparks vienen de D.sparks.patrimonioUsd (rebuildeado en data.js desde
    // valuacion_historica.json, snapshots mensuales). Cantidad = 12 a 16 puntos.
    // patrimonioMensual tiene mes (string) y usd (en miles USD).
    var heroPatUsd = (D.hero && D.hero.patrimonio && D.hero.patrimonio.usd) || 0;
    var heroPatUsdM = heroPatUsd / 1e6;
    var patMensual = Array.isArray(D.patrimonioMensual) ? D.patrimonioMensual : [];
    var sparkUsd = (D.sparks && D.sparks.patrimonioUsd) || [];
    var usdPoints = sparkUsd.map(function (v, i) {
      var mes = patMensual[i] && patMensual[i].mes ? patMensual[i].mes : MESES[i % 12];
      return { x: mes, v: v };
    });
    // Label dinámico: si tenemos info del primer periodo, "vs mmm-yy"
    var firstPeriodoUsd = null;
    if (patMensual.length && patMensual[0].mes) {
      // patMensual[i].mes formato típico "Mar '25" — extraer
      var mm = String(patMensual[0].mes).match(/^([A-Za-z]+)\s*'?(\d{2,4})/);
      if (mm) {
        var MES_MAP = { Ene:"01", Feb:"02", Mar:"03", Abr:"04", May:"05", Jun:"06",
                        Jul:"07", Ago:"08", Sep:"09", Oct:"10", Nov:"11", Dic:"12" };
        var mNum = MES_MAP[mm[1]] || "01";
        var yFull = mm[2].length === 2 ? "20" + mm[2] : mm[2];
        firstPeriodoUsd = yFull + "-" + mNum;
      }
    }

    var PATRIMONIO_USD = {
      title: "Patrimonio · USD",
      sub: heroPatUsdM ? ("U$S " + heroPatUsdM.toFixed(2).replace(".", ",") + " M")
                       : (usdPoints.length ? "U$S " + usdPoints[usdPoints.length - 1].v.toFixed(1).replace(".", ",") : "—"),
      delta: deltaTotal(sparkUsd),
      deltaLabel: buildDeltaLabel("mensual", sparkUsd.length, firstPeriodoUsd),
      yLabels: (function () {
        if (!usdPoints.length) return [];
        var vs = usdPoints.map(function (p) { return p.v; });
        var max = Math.max.apply(null, vs);
        var min = Math.min.apply(null, vs);
        return [max.toFixed(0), Math.round((max + min) / 2), min.toFixed(0)];
      })(),
      xLabels: (function () {
        if (usdPoints.length === 0) return [];
        if (usdPoints.length <= 4) return usdPoints.map(function (p) { return p.x; });
        var step = Math.floor(usdPoints.length / 4);
        return [usdPoints[0].x, usdPoints[step].x, usdPoints[step * 2].x, usdPoints[usdPoints.length - 1].x];
      })(),
      points: usdPoints.length ? usdPoints : [{ x: "—", v: 0 }],
      unit: "U$S",
      color: "primary",
      // Para modal
      lastM: heroPatUsdM,
      firstPeriodo: firstPeriodoUsd,
      nPuntos: sparkUsd.length
    };

    // ---------- Stock kilos diario (line chart) ----------
    // sparks.stockKg viene de stockDiario.snapshots.slice(-12) — son últimos
    // 12 puntos DIARIOS (no mensuales). Valor en kg/1e6 (escalado).
    var stockKgTotal = totalKg;
    var stockSpark = (D.sparks && D.sparks.stockKg) || [];
    var stockPoints = stockSpark.map(function (v, i) {
      return { x: String(i + 1), v: v };
    });

    var STOCK_KILOS = {
      title: "Stock kilos · diario",
      sub: stockKgTotal ? (Math.round(stockKgTotal / 1000).toLocaleString("es-AR") + " t") : "—",
      delta: deltaTotal(stockSpark),
      deltaLabel: buildDeltaLabel("diario", stockSpark.length),
      yLabels: (function () {
        if (!stockPoints.length) return [];
        var vs = stockPoints.map(function (p) { return p.v; });
        var max = Math.max.apply(null, vs);
        var min = Math.min.apply(null, vs);
        return [
          max.toFixed(2).replace(".", ","),
          ((max + min) / 2).toFixed(2).replace(".", ","),
          min.toFixed(2).replace(".", ",")
        ];
      })(),
      xLabels: (function () {
        var n = stockPoints.length;
        if (n === 0) return [];
        if (n <= 4) return stockPoints.map(function (p) { return p.x; });
        return ["1", String(Math.floor(n / 3)), String(Math.floor(2 * n / 3)), String(n)];
      })(),
      points: stockPoints.length ? stockPoints : [{ x: "—", v: 0 }],
      unit: "t (M)",
      color: "pos",
      lastT: stockKgTotal ? Math.round(stockKgTotal / 1000) : null,
      nPuntos: stockSpark.length
    };

    // ---------- v6 · Productivos · 6 tarjetas ----------
    // Lee D.productivos poblado por data.js desde productivo_2025.json
    // + indicadores_2025.json + eficiencia_historico.json + consumo_2025.json.
    // Shape: { id: { actual:{v,unit,label}, historico:{v,unit,label},
    //          mejorEs:'mayor'|'menor'|'rango', descripcion } }
    // El componente <ProductivosGrid /> de mobile.jsx consume esto y lo
    // renderiza como 6 tarjetas con KPI grande + KPI comparativo + chip
    // ↑/↓ con el % de diferencia coloreado según `mejorEs`.
    var prod = D.productivos || {};
    function fmtProd(v, unit, decimals) {
      if (v == null || isNaN(v)) return { n: "—", u: unit || "" };
      var n;
      if (decimals != null) n = Number(v).toFixed(decimals).replace(".", ",");
      else if (Math.abs(v) >= 1000) n = Math.round(v).toLocaleString("es-AR");
      else if (Math.abs(v) >= 100) n = Math.round(v).toString();
      else if (Math.abs(v) >= 10) n = Number(v).toFixed(1).replace(".", ",");
      else n = Number(v).toFixed(2).replace(".", ",");
      return { n: n, u: unit || "" };
    }
    // v7: severidad escalonada según el mockup del usuario.
    //   |delta| > 20% → 'severo'  (tarjeta coloreada + KPI coloreado)
    //   10% ≤ |delta| ≤ 20% → 'moderado' (tarjeta blanca + chip coloreado)
    //   |delta| < 10% → 'neutro' (todo gris)
    // tone: 'good' / 'bad' / 'neutral' según mejorEs + signo del delta.
    function classifyProd(p, delta) {
      var tone = "neutral";
      if (p.mejorEs === "rango") tone = "neutral";
      else if (delta == null) tone = "neutral";
      else if (p.mejorEs === "menor") tone = delta < 0 ? "good" : (delta > 0 ? "bad" : "neutral");
      else /* mayor (default) */ tone = delta > 0 ? "good" : (delta < 0 ? "bad" : "neutral");

      var abs = delta == null ? 0 : Math.abs(delta);
      var severity = abs > 20 ? "severo" : (abs >= 10 ? "moderado" : "neutro");

      // chipTone: en severity neutro o rango, el chip es siempre gris.
      var chipTone = (severity === "neutro" || p.mejorEs === "rango") ? "neutral" : tone;
      // cardTone: la tarjeta sólo se colorea cuando es severa (sino blanca).
      var cardTone = (severity === "severo" && p.mejorEs !== "rango") ? tone : "neutral";
      return { tone: tone, severity: severity, chipTone: chipTone, cardTone: cardTone, deltaAbs: abs };
    }
    function mkProd(id, titulo) {
      var p = prod[id];
      if (!p || p.actual == null) {
        return { id: id, title: titulo, kpi: "—", unit: "", subVal: "N/D",
                 subLabel: "", delta: null, severity: "neutro",
                 tone: "neutral", chipTone: "neutral", cardTone: "neutral" };
      }
      var a = p.actual || {}, h = p.historico || {};
      var aFmt = fmtProd(a.v, a.unit, a.decimals);
      var hFmt = fmtProd(h.v, h.unit, h.decimals);
      var delta = null;
      if (a.v != null && h.v != null && h.v !== 0) {
        delta = ((a.v - h.v) / Math.abs(h.v)) * 100;
      }
      var c = classifyProd(p, delta);
      return {
        id: id,
        title: titulo,
        kpi: aFmt.n,
        unit: aFmt.u,
        subVal: hFmt.n + (hFmt.u ? " " + hFmt.u : ""),
        subLabel: "vs " + (h.label || "histórico"),
        actualLabel: a.label || "",
        delta: delta,
        deltaAbs: c.deltaAbs,
        deltaFmt: delta != null
          ? (delta >= 0 ? "+" : "−") + Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0).replace(".", ",") + "%"
          : null,
        // v7: clases nuevas para el rediseño escalonado.
        tone:      c.tone,         // good|bad|neutral según mejorEs + signo
        severity:  c.severity,     // severo|moderado|neutro según |delta|
        chipTone:  c.chipTone,     // qué color usa el chip
        cardTone:  c.cardTone,     // qué color usa el fondo de la tarjeta
        mejorEs:   p.mejorEs || "mayor",
        descripcion: p.descripcion || ""
      };
    }
    var PRODUCTIVOS = [
      mkProd("engordeDiario",    "Engorde diario"),
      mkProd("estadia",          "Estadía"),
      mkProd("pctPV",            "Eficiencia"),
      mkProd("consumoPorCabeza", "Consumo / cabeza"),
      mkProd("conversion",       "Conversión"),
      mkProd("kgRepartidos",     "Kg repartidos · últ. día")
    ];

    // ---------- Módulos ----------
    var ledMap = { vivo: "vivo", acumulando: "acumulando", disponible: "disponible" };
    function kindByModulo(m) {
      if (m.id === "stock-insumos") return "neg";
      if (m.id === "historico" || m.id === "estado-resultados" ||
          m.id === "flujo-fondos" || m.id === "simulador") return "pos";
      return "primary";
    }
    // v4 fix: NO hay kpiOverrides. Mobile muestra el m.kpi / m.kpiLabel
    // exactamente como vienen de D.modulos (poblado por data.js y
    // actualizado en runtime) — debe coincidir con el portal desktop.
    // Sólo se separa la unidad cuando aparece como sufijo (kg, t, %, etc.)
    // para que el layout pueda mostrar el número grande y la unidad chica.
    // NO se recompacta el valor numérico — eso cambiaría lo mostrado.
    var MODULOS = (D.modulos || [])
      .filter(function (m) { return m.grupo !== "config"; })
      .slice(0, 8)
      .map(function (m) {
        var kpi = m.kpi || "—";
        var unit = "";
        var matchUnit = kpi.match(/^(.+?)\s+([a-zA-ZÀ-ſ%]+)$/);
        if (matchUnit) { kpi = matchUnit[1]; unit = matchUnit[2]; }
        return {
          n: m.n,
          id: m.id,
          portalId: PANEL_TO_PORTAL_ID[m.id] || m.id,
          title: m.titulo,
          state: ledMap[m.estado] || "disponible",
          kind: kindByModulo(m),
          kpi: kpi,
          unit: unit,
          sub: m.kpiLabel || m.desc || ""
        };
      });

    return {
      HEADER: HEADER,
      SALUDO: SALUDO,
      ALERTAS: ALERTAS,
      STOCK_HERO: STOCK_HERO,
      COTIZACIONES: COTIZACIONES,
      INSUMOS: INSUMOS,
      INSUMOS_ALL: INSUMOS_ALL,
      INSUMOS_TOTAL: INSUMOS_TOTAL,
      FLUJO_SEMANAL: FLUJO_SEMANAL,
      PATRIMONIO_USD: PATRIMONIO_USD,
      STOCK_KILOS: STOCK_KILOS,
      PRODUCTIVOS: PRODUCTIVOS,
      MODULOS: MODULOS,
      TABS: TABS,
      BOTTOM_TABS: BOTTOM_TABS,
      // Helpers
      fmt: fmt,
      fmtPct: fmtPct,
      fmtMoney: fmtMoney,
      fmtMoneyCompact: fmtMoneyCompact,
      fmtCompact: fmtCompact,
      fmtFechaCorta: fmtFechaCorta,
      // Mapping para navegación
      PANEL_TO_PORTAL_ID: PANEL_TO_PORTAL_ID
    };
  }

  function rebuild() {
    root.MOBILE_DATA = buildMobileData();
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("mobile:data-ready", { detail: root.MOBILE_DATA }));
    }
  }

  rebuild();

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("panel:data-ready", rebuild);
  }
})(typeof window !== "undefined" ? window : globalThis);
