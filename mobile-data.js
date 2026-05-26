/* ============================================================
   mobile-data.js  -  Adaptador de datos REALES para la vista movil
   Lee window.PEGSA_DATA (cargado por data.js) y arma window.MOBILE_DATA
   con la estructura que consume mobile.jsx.
   Reacciona a 'panel:data-ready' para reconstruirse cuando llegan los JSONs.
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
  var fmtCompact = function (n) {
    if (n == null || isNaN(n)) return "—";
    var a = Math.abs(n);
    if (a >= 1000000) return (n / 1000000).toFixed(1).replace(".", ",") + "M";
    if (a >= 10000)    return Math.round(n / 1000) + "k";
    return fmt(n);
  };
  var deltaSerie = function (arr) {
    if (!Array.isArray(arr) || arr.length < 2) return null;
    var a = arr[arr.length - 2];
    var b = arr[arr.length - 1];
    if (!a) return null;
    return ((b - a) / a) * 100;
  };
  var deltaTotal = function (arr) {
    if (!Array.isArray(arr) || arr.length < 2) return null;
    var a = arr[0];
    var b = arr[arr.length - 1];
    if (!a) return null;
    return ((b - a) / a) * 100;
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

    var lastUpdate = D.lastUpdate || (new Date().toLocaleDateString("es-AR"));
    var nAlertas = (D.alertas || []).length;
    var nModulos = (D.modulos || []).filter(function (m) { return m.grupo !== "config"; }).length;

    var HEADER = {
      brand: "PEGSA & BULL",
      sub: "Dirección · " + lastUpdate,
      notifications: nAlertas
    };

    var SALUDO = {
      eyebrow: "PERÍODO " + (D.periodo || "-").toUpperCase(),
      h1Pre: "Buen día, ",
      h1Em: "dirección",
      h1Post: ".",
      sub: "Última act. " + lastUpdate +
           " · " + nAlertas + " alerta" + (nAlertas === 1 ? "" : "s") +
           " · " + nModulos + " módulos"
    };

    var sevMap = { warn: "warn", info: "info", bad: "bad", error: "bad", critico: "bad" };
    var ALERTAS = (D.alertas || []).map(function (a, i) {
      return { id: "a" + i, sev: sevMap[a.tipo] || "info", text: a.texto };
    });

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
      sub: "Grupo completo · " + (totalEst || "-") + " establecimientos",
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

    var M = D.mercado || {};
    function cot(key, label) {
      var m = M[key];
      if (!m) return { label: label, delta: null, value: "-", unit: "" };
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

    var stateMap = { bad: "bad", warn: "warn", ok: "ok", inconsistente: "warn" };
    var stateLabelMap = { bad: "Crítico", warn: "Atención", ok: "OK", inconsistente: "Revisar" };
    function fmtT(kg) {
      if (kg == null) return "-";
      var t = kg / 1000;
      return (t >= 100 ? Math.round(t) : t.toFixed(1).replace(".", ",")) + " t";
    }
    function fmtTDia(kg) {
      if (kg == null) return "-";
      var t = kg / 1000;
      return (t >= 10 ? Math.round(t) : t.toFixed(1).replace(".", ",")) + " t";
    }
    function fmtDias(n) {
      if (n == null || isNaN(n)) return "-";
      return Math.max(0, Math.round(n));
    }

    var INSUMOS = (D.insumosCriticos || []).slice(0, 2).map(function (it) {
      return {
        id: it.nombre,
        title: it.nombre,
        sub: it.descripcion || "-",
        state: stateMap[it.estado] || "warn",
        stateLabel: stateLabelMap[it.estado] || "Atención",
        dias: fmtDias(it.dias),
        rows: [
          { k: "Stock",         v: fmtT(it.stock_kg) },
          { k: "Consumo/día",  v: fmtTDia(it.consumo_kg_dia) },
          { k: it.fecha_ult_compra ? "Última compra" : "Reposición",
            v: it.fecha_ult_compra || "-" }
        ]
      };
    });

    if (INSUMOS.length === 0) {
      INSUMOS.push({
        id: "placeholder",
        title: "Cargando insumos...",
        sub: "Esperando datos",
        state: "warn",
        stateLabel: "...",
        dias: "-",
        rows: [
          { k: "Stock", v: "-" },
          { k: "Consumo/día", v: "-" },
          { k: "Reposición", v: "-" }
        ]
      });
    }

    var tes = D.tesoreria || {};
    var FLUJO_SEMANAL = {
      title: "Tesorería · posición",
      sub: tes.semana ? ("Sem. " + tes.semana + " · cartera + bancos") : "Semana actual",
      cerrada: {
        label: "CARTERA POSITIVA",
        range: "Cobranzas pendientes",
        value: tes.cartera ? Math.round(tes.cartera / 1000000) : null
      },
      proxima: {
        label: "DISPONIBLE EN BANCOS",
        range: "Saldos bancarios al cierre",
        value: tes.bancos ? Math.round(tes.bancos / 1000000) : null
      },
      bars: (function () {
        var s = D.sparks && D.sparks.patrimonioArs;
        if (!Array.isArray(s) || s.length < 6) return [];
        var last6 = s.slice(-6);
        var prev = s.length >= 7 ? s[s.length - 7] : last6[0];
        var labels = MESES.slice(-6);
        return last6.map(function (v, i) {
          var previo = i === 0 ? prev : last6[i - 1];
          var d = Math.round(v - previo);
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
        value: tes.usd_pos ? Math.round(tes.usd_pos / 1000000) : null
      }
    };

    var sparkUsd = (D.sparks && D.sparks.patrimonioUsd) || [];
    var usdPoints = sparkUsd.map(function (v, i) {
      return { x: MESES[i] || ("M" + (i + 1)), v: v };
    });
    var usdActual = usdPoints.length ? usdPoints[usdPoints.length - 1].v
      : (D.hero && D.hero.patrimonio && D.hero.patrimonio.usd ? D.hero.patrimonio.usd / 1000000 : null);

    var PATRIMONIO_USD = {
      title: "Patrimonio · USD",
      sub: usdActual != null ? ("U$S " + usdActual.toFixed(1).replace(".", ",") + " M") : "-",
      delta: deltaTotal(sparkUsd),
      yLabels: (function () {
        if (!usdPoints.length) return [16, 14, 12];
        var vs = usdPoints.map(function (p) { return p.v; });
        var max = Math.max.apply(null, vs);
        var min = Math.min.apply(null, vs);
        return [Math.round(max), Math.round((max + min) / 2), Math.round(min)];
      })(),
      xLabels: ["Ene", "Abr", "Ago", "Dic"],
      points: usdPoints.length ? usdPoints : [{ x: "-", v: 0 }],
      unit: "U$S",
      color: "primary"
    };

    var stockSpark = (D.sparks && D.sparks.stockKg) || [];
    var stockPoints = stockSpark.map(function (v, i) {
      return { x: MESES[i] || ("M" + (i + 1)), v: v };
    });
    var stockActual = stockPoints.length ? stockPoints[stockPoints.length - 1].v
      : (totalKg / 1000000);

    var STOCK_KILOS = {
      title: "Stock kilos · mensual",
      sub: (stockActual * 1000).toLocaleString("es-AR", { maximumFractionDigits: 0 }) + " t",
      delta: deltaTotal(stockSpark),
      yLabels: (function () {
        if (!stockPoints.length) return [];
        var vs = stockPoints.map(function (p) { return p.v; });
        var max = Math.max.apply(null, vs);
        var min = Math.min.apply(null, vs);
        return [
          max.toFixed(2).replace(".", ",") + "k t",
          ((max + min) / 2).toFixed(2).replace(".", ",") + "k t",
          min.toFixed(2).replace(".", ",") + "k t"
        ];
      })(),
      xLabels: ["Ene", "Abr", "Ago", "Dic"],
      points: stockPoints.length ? stockPoints : [{ x: "-", v: 0 }],
      unit: "kt",
      color: "pos"
    };

    var ledMap = { vivo: "vivo", acumulando: "acumulando", disponible: "disponible" };
    function kindByModulo(m) {
      if (m.id === "stock-insumos") return "neg";
      if (m.id === "historico" || m.id === "estado-resultados" ||
          m.id === "flujo-fondos" || m.id === "simulador") return "pos";
      return "primary";
    }
    var MODULOS = (D.modulos || [])
      .filter(function (m) { return m.grupo !== "config"; })
      .slice(0, 8)
      .map(function (m) {
        var kpi = m.kpi || "-";
        var unit = "";
        var matchUnit = kpi.match(/^(.+?)\s+([a-zA-ZÀ-ſ%]+)$/);
        if (matchUnit) { kpi = matchUnit[1]; unit = matchUnit[2]; }
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
