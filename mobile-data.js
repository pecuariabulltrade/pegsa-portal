/* ============================================================
   mobile-data.js  —  Adaptador de datos REALES para la vista movil
   Lee window.PEGSA_DATA (data.js) y arma window.MOBILE_DATA.
   Re-construye al recibir 'panel:data-ready' (JSONs reales).
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
  // Compactar montos: 1.363.651.930 → "1,4 MM", 352.200.997 → "352 M"
  var fmtMoneyCompact = function (n) {
    if (n == null || isNaN(n)) return "—";
    var a = Math.abs(n);
    var sign = n < 0 ? "-" : "";
    if (a >= 1e9) return sign + "$ " + (n / 1e9).toFixed(2).replace(".", ",").replace("-", "") + " MM";
    if (a >= 1e6) return sign + "$ " + Math.round(Math.abs(n) / 1e6) + " M";
    if (a >= 1e3) return sign + "$ " + Math.round(Math.abs(n) / 1e3) + " k";
    return sign + "$ " + fmt(Math.abs(n));
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
      if (isNaN(d.getTime())) {
        // No es ISO válido — devolver primer fragmento legible
        return String(s).split("T")[0].split(" ")[0];
      }
      var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
      var dd = pad(d.getDate());
      var mm = pad(d.getMonth() + 1);
      var yy = String(d.getFullYear()).slice(-2);
      var hh = pad(d.getHours());
      var mi = pad(d.getMinutes());
      return dd + "/" + mm + "/" + yy + " " + hh + ":" + mi;
    } catch (e) {
      return String(s);
    }
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

  var MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  var TABS = ["Importante", "Insumos", "Sub-datos", "Módulos"];
  var BOTTOM_TABS = [
    { id: "panel",   label: "Panel",   icon: "home" },
    { id: "datos",   label: "Datos",   icon: "chart" },
    { id: "alertas", label: "Alertas", icon: "bell" },
    { id: "modulos", label: "Módulos", icon: "grid" }
  ];

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
      h1Pre: "Buen día, ",
      h1Em: "dirección",
      h1Post: ".",
      sub: "Última act. " + lastUpdateFmt +
           " · " + nAlertas + " alerta" + (nAlertas === 1 ? "" : "s") +
           " · " + nModulos + " módulos"
    };

    var sevMap = { warn: "warn", info: "info", bad: "bad", error: "bad", critico: "bad" };
    var ALERTAS = (D.alertas || []).map(function (a, i) {
      return { id: "a" + i, sev: sevMap[a.tipo] || "info", text: a.texto };
    });

    // ---------- Stock hero ----------
    var stockH = (D.hero && D.hero.stock) || { pegsa: {}, total: {} };
    var pegsaCab = (stockH.pegsa && stockH.pegsa.cabezas) || 0;
    var pegsaKg  = (stockH.pegsa && stockH.pegsa.kg) || 0;
    var totalCab = (stockH.total && stockH.total.cabezas) || 0;
    var totalKg  = (stockH.total && stockH.total.kg) || 0;
    var totalEst = (stockH.total && stockH.total.establecimientos) || 0;
    var hoteleros = (D.hoteleros && D.hoteleros.cabezas) || Math.max(0, totalCab - pegsaCab);
    var var12mStock = deltaTotal(D.sparks && D.sparks.stockKg);

    var STOCK_HERO = {
      title: "Stock de hacienda",
      sub: "Grupo completo · " + (totalEst || "—") + " establecimientos",
      pegsa: {
        tag: "propio",
        cab: pegsaCab,
        t: Math.round(pegsaKg / 1000),
        kgCab: pegsaCab ? Math.round(pegsaKg / pegsaCab) : 0,
        est: (stockH.pegsa && stockH.pegsa.establecimientos) || null
      },
      grupo: {
        tag: "total",
        cab: totalCab,
        t: Math.round(totalKg / 1000),
        kgCab: totalCab ? Math.round(totalKg / totalCab) : 0,
        est: totalEst
      },
      var12m: var12mStock,
      hoteleros: hoteleros
    };

    // ---------- Mercado · cotizaciones ----------
    var M = D.mercado || {};
    function cot(key, label) {
      var m = M[key];
      if (!m) return { label: label, delta: null, value: "—", unit: "" };
      var spark = D.sparks && D.sparks[key];
      var dPct = deltaSerie(spark);
      var value;
      if (key === "maiz" || key === "soja") value = "$ " + fmtCompact(m.precio);
      else value = "$ " + fmt(m.precio);
      return { label: label, delta: dPct, value: value, unit: m.unidad || "" };
    }
    var COTIZACIONES = {
      title: "Mercado · cotizaciones",
      sub: "MAG · BCR · E&C",
      items: [
        cot("novillo", "Novillo MAG"),
        cot("vaca",    "Vaca MAG"),
        cot("ternero", "Ternero E&C"),
        cot("maiz",    "Maíz BCR"),
        cot("soja",    "Soja BCR"),
        cot("mep",     "Dólar MEP")
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
            v: it.fecha_ult_compra ? fmtFechaCorta(it.fecha_ult_compra) : "—" }
        ];
      }
      return {
        id: it.nombre,
        title: it.nombre,
        sub: it.inconsistente ? "Revisar datos del pipeline" : (it.descripcion || "—"),
        state: stateMap[it.estado] || "warn",
        stateLabel: stateLabelMap[it.estado] || "Atención",
        dias: fmtDiasInsumo(it),
        inconsistente: !!it.inconsistente,
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

    // ---------- Tesorería · posición ----------
    var tes = D.tesoreria || {};
    var FLUJO_SEMANAL = {
      title: "Tesorería · posición",
      sub: tes.semana ? ("Sem. " + tes.semana + " · cartera + bancos") : "Semana actual",
      cerrada: {
        label: "CARTERA",
        range: "Cobranzas pendientes",
        // Compactamos en MM (miles de millones) para que entre
        value: tes.cartera
      },
      proxima: {
        label: "BANCOS",
        range: "Saldos bancarios al cierre",
        value: tes.bancos
      },
      bars: (function () {
        var s = D.sparks && D.sparks.patrimonioArs;
        if (!Array.isArray(s) || s.length < 6) return [];
        var last6 = s.slice(-6);
        var prev = s.length >= 7 ? s[s.length - 7] : last6[0];
        var labels = MESES.slice(-6);
        return last6.map(function (v, i) {
          var previo = i === 0 ? prev : last6[i - 1];
          var d = v - previo;
          return {
            label: labels[i],
            v: d,
            kind: i === last6.length - 1 ? "next" : (i < last6.length - 2 ? "past" : "proj")
          };
        });
      })(),
      acumulado: {
        label: "Posición USD",
        sub: "Inversiones + caja USD",
        value: tes.usd_pos
      }
    };

    // ---------- Patrimonio USD (line chart) ----------
    // El valor "verdad" viene del hero (en USD). El spark sirve solo para la
    // forma del chart (escala relativa, delta % válida).
    var heroPatUsd = (D.hero && D.hero.patrimonio && D.hero.patrimonio.usd) || 0;
    var heroPatUsdM = heroPatUsd / 1e6;
    var sparkUsd = (D.sparks && D.sparks.patrimonioUsd) || [];
    var usdPoints = sparkUsd.map(function (v, i) {
      return { x: MESES[i % 12], v: v };
    });

    var PATRIMONIO_USD = {
      title: "Patrimonio · USD",
      sub: heroPatUsdM ? ("U$S " + heroPatUsdM.toFixed(2).replace(".", ",") + " M")
                       : (usdPoints.length ? "U$S " + usdPoints[usdPoints.length - 1].v.toFixed(1).replace(".", ",") : "—"),
      delta: deltaTotal(sparkUsd),
      yLabels: (function () {
        if (!usdPoints.length) return [];
        var vs = usdPoints.map(function (p) { return p.v; });
        var max = Math.max.apply(null, vs);
        var min = Math.min.apply(null, vs);
        // Etiquetas como "min, mid, max" sin unidad — son referenciales
        return [max.toFixed(0), Math.round((max + min) / 2), min.toFixed(0)];
      })(),
      xLabels: ["Ene", "Abr", "Ago", "Dic"],
      points: usdPoints.length ? usdPoints : [{ x: "—", v: 0 }],
      unit: "",
      color: "primary"
    };

    // ---------- Stock kilos (line chart) ----------
    // Valor verdad: hero.stock.total.kg
    var stockKgTotal = totalKg;
    var stockSpark = (D.sparks && D.sparks.stockKg) || [];
    var stockPoints = stockSpark.map(function (v, i) {
      return { x: MESES[i % 12], v: v };
    });

    var STOCK_KILOS = {
      title: "Stock kilos · mensual",
      sub: stockKgTotal ? (Math.round(stockKgTotal / 1000).toLocaleString("es-AR") + " t") : "—",
      delta: deltaTotal(stockSpark),
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
      xLabels: ["Ene", "Abr", "Ago", "Dic"],
      points: stockPoints.length ? stockPoints : [{ x: "—", v: 0 }],
      unit: "",
      color: "pos"
    };

    // ---------- Módulos ----------
    var ledMap = { vivo: "vivo", acumulando: "acumulando", disponible: "disponible" };
    function kindByModulo(m) {
      if (m.id === "stock-insumos") return "neg";
      if (m.id === "historico" || m.id === "estado-resultados" ||
          m.id === "flujo-fondos" || m.id === "simulador") return "pos";
      return "primary";
    }
    // Override de KPIs: para algunos módulos usamos versión compactada legible
    var kpiOverrides = {
      "tesoreria": function () {
        if (tes.posicion == null) return null;
        return { kpi: fmtMoneyCompact(tes.posicion), unit: "", sub: "Posición · sem. " + (tes.semana || "—") };
      },
      "estado-resultados": function () {
        var r = D.hero && D.hero.resultado;
        if (!r) return null;
        return { kpi: (r.total >= 0 ? "+" : "") + fmtMoneyCompact(r.total).replace("$ ", "$"), unit: "", sub: "Resultado neto del período" };
      },
      "flujo-fondos": function () {
        return null; // mantener original o calcular si tenés cobros - pagos
      }
    };
    var MODULOS = (D.modulos || [])
      .filter(function (m) { return m.grupo !== "config"; })
      .slice(0, 8)
      .map(function (m) {
        var override = kpiOverrides[m.id] && kpiOverrides[m.id]();
        if (override && override.kpi != null) {
          return {
            n: m.n,
            title: m.titulo,
            state: ledMap[m.estado] || "disponible",
            kpi: override.kpi,
            unit: override.unit || "",
            sub: override.sub || m.kpiLabel || m.desc || "",
            kind: kindByModulo(m)
          };
        }
        // Default: separar KPI número y unidad
        var kpi = m.kpi || "—";
        var unit = "";
        var matchUnit = kpi.match(/^(.+?)\s+([a-zA-ZÀ-ſ%]+)$/);
        if (matchUnit) { kpi = matchUnit[1]; unit = matchUnit[2]; }
        // Compactar números > 1M en módulos
        var matchNum = kpi.match(/^([+-]?)\$([\d\.]+)$/);
        if (matchNum) {
          var raw = parseFloat(matchNum[2].replace(/\./g, ""));
          if (!isNaN(raw) && Math.abs(raw) >= 1e6) {
            kpi = matchNum[1] + fmtMoneyCompact(raw * (matchNum[1] === "-" ? -1 : 1));
            unit = "";
          }
        }
        return {
          n: m.n,
          title: m.titulo,
          state: ledMap[m.estado] || "disponible",
          kpi: kpi,
          unit: unit,
          sub: m.kpiLabel || m.desc || "",
          kind: kindByModulo(m)
        };
      });

    return {
      HEADER: HEADER,
      SALUDO: SALUDO,
      ALERTAS: ALERTAS,
      STOCK_HERO: STOCK_HERO,
      COTIZACIONES: COTIZACIONES,
      INSUMOS: INSUMOS,
      FLUJO_SEMANAL: FLUJO_SEMANAL,
      PATRIMONIO_USD: PATRIMONIO_USD,
      STOCK_KILOS: STOCK_KILOS,
      MODULOS: MODULOS,
      TABS: TABS,
      BOTTOM_TABS: BOTTOM_TABS,
      fmt: fmt,
      fmtPct: fmtPct,
      fmtMoney: fmtMoney,
      fmtMoneyCompact: fmtMoneyCompact,
      fmtCompact: fmtCompact
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
