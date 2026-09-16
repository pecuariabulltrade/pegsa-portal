/* compras-calc.js — v15.74.11 · La cuenta de una liquidación de compra + semáforo por tropa
   ────────────────────────────────────────────────────────────────
   UNA sola función hace toda la aritmética de una liquidación, y la misma
   cuenta existe en Python (`liq_calcular` en actualizar_datos.py) para poder
   reimportar y validar sin que las dos versiones se separen. Si se toca una,
   se toca la otra: los tests de las dos corren el mismo ejemplo de control.

   Todo SIN IVA, como el Excel que esto reemplaza.

   Vocabulario:
     · operación  = una liquidación = un archivo del consignatario. Puede
       abarcar varias tropas y varias categorías.
     · categoría  = una fila tropa × categoría dentro de esa operación.

   Las tres formas de cargar el precio (las tres existen en los archivos
   reales): por kg, por cabeza, o el monto total de la fila.

   La comisión puede venir como % sobre el importe o como monto de la
   operación; el monto se prorratea por kg. Los gastos generales SIEMPRE son
   un monto de la operación y SIEMPRE se prorratean por kg — son de la
   operación entera (flete, guías, sellados) y no cuelgan de ninguna
   categoría en particular.

   El desbaste se mide contra el kg de INGRESO de WinCampo, que es el kg de
   balanza del camión al llegar:
       desbaste % = (kg/cab liquidado − kg/cab que llegó) ÷ kg/cab liquidado
   Positivo = llegó con menos kilos de los que se pagaron, que es el caso
   normal (viaje + ayuno). Si diera sistemáticamente 0, no es que no haya
   desbaste: es que el kg del camión se está cargando copiando el de la
   liquidación, y eso es un problema de carga, no de cuenta.
*/

(function (root) {
  'use strict';

  function _num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  /* Devuelve un objeto NUEVO con la operación calculada. No muta `op`.

     op = {
       comision_modo: 'pct' | 'monto',
       comision_valor: number,        // pct como fracción (0.03 = 3 %)
       gastos_monto: number,
       categorias: [{
         tropa, tropa_norm, hotelero, categoria,
         cabezas_wc, kg_wc,           // lo que dice WinCampo
         cabezas_liq, kg_liq,         // lo que se liquidó
         precio_modo: 'kg'|'cab'|'total', precio_valor
       }]
     }
  */
  function liqCalcular(op) {
    op = op || {};
    var cats = (op.categorias || []).map(function (c) {
      var o = {}; for (var k in c) o[k] = c[k];
      return o;
    });

    var comModo = op.comision_modo === 'monto' ? 'monto' : 'pct';
    var comVal  = _num(op.comision_valor) || 0;
    var gastos  = _num(op.gastos_monto) || 0;

    // 1ª pasada · precio por kg e importe de cada categoría
    var kgOp = 0, impOp = 0;
    cats.forEach(function (c) {
      var kg  = _num(c.kg_liq);
      var cab = _num(c.cabezas_liq);
      var val = _num(c.precio_valor);
      c.kg_liq_cab = (kg != null && cab) ? kg / cab : null;

      if (val == null || kg == null) {
        c.precio_kg = null; c.importe = null;
      } else if (c.precio_modo === 'cab') {
        // $/cabeza ÷ kg por cabeza = $/kg
        c.precio_kg = c.kg_liq_cab ? val / c.kg_liq_cab : null;
        c.importe   = c.precio_kg != null ? c.precio_kg * kg : null;
      } else if (c.precio_modo === 'total') {
        c.precio_kg = kg ? val / kg : null;
        c.importe   = val;
      } else {
        c.precio_kg = val;
        c.importe   = val * kg;
      }
      if (kg) kgOp += kg;
      if (c.importe) impOp += c.importe;
    });

    // 2ª pasada · comisión y gastos, que sólo se pueden repartir sabiendo
    // los kg de TODA la operación.
    var comOp = 0, gasOp = 0;
    cats.forEach(function (c) {
      var kg = _num(c.kg_liq) || 0;
      c.comision_cat = comModo === 'pct'
        ? (c.importe || 0) * comVal
        : (kgOp ? comVal * kg / kgOp : 0);
      c.gastos_cat = kgOp ? gastos * kg / kgOp : 0;
      c.importe_cg = (c.importe || 0) + c.comision_cat + c.gastos_cat;
      c.precio_kg_cg  = kg ? c.importe_cg / kg : null;
      var cab = _num(c.cabezas_liq);
      c.precio_cab_cg = cab ? c.importe_cg / cab : null;

      // desbaste contra el kg de balanza del camión
      var kgWc  = _num(c.kg_wc);
      var cabWc = _num(c.cabezas_wc);
      c.kg_wc_cab = (kgWc != null && cabWc) ? kgWc / cabWc : null;
      c.desbaste_pct = (c.kg_liq_cab && c.kg_wc_cab != null)
        ? (c.kg_liq_cab - c.kg_wc_cab) / c.kg_liq_cab * 100
        : null;

      comOp += c.comision_cat;
      gasOp += c.gastos_cat;
    });

    var cabOp = cats.reduce(function (a, c) { return a + (_num(c.cabezas_liq) || 0); }, 0);
    var cabWcOp = cats.reduce(function (a, c) { return a + (_num(c.cabezas_wc) || 0); }, 0);
    var kgWcOp  = cats.reduce(function (a, c) { return a + (_num(c.kg_wc) || 0); }, 0);
    var impCgOp = impOp + comOp + gasOp;

    return {
      categorias: cats,
      total: {
        cabezas_liq: cabOp, kg_liq: kgOp,
        cabezas_wc: cabWcOp, kg_wc: kgWcOp,
        importe: impOp, comision: comOp, gastos: gasOp, importe_cg: impCgOp,
        precio_kg:     kgOp ? impOp / kgOp : null,
        precio_kg_cg:  kgOp ? impCgOp / kgOp : null,
        precio_cab_cg: cabOp ? impCgOp / cabOp : null,
        // lo que el Excel llamaba "Precio c/gastos ÷ Precio s/gastos − 1"
        recargo_pct:   impOp ? (impCgOp / impOp - 1) * 100 : null,
        // desbaste ponderado por kg liquidado, sólo sobre las categorías que
        // tienen kg de WinCampo (las viejas no lo tienen y no deben diluirlo)
        desbaste_pct: (function () {
          var num = 0, den = 0;
          cats.forEach(function (c) {
            if (c.desbaste_pct == null) return;
            var kg = _num(c.kg_liq) || 0;
            num += c.desbaste_pct * kg; den += kg;
          });
          return den ? num / den : null;
        })(),
        cabezas_dif: cabWcOp - cabOp
      }
    };
  }

  /* Clave canónica de una liquidación: las tropas ordenadas + la fecha. La
     misma operación re-guardada actualiza en vez de duplicar. */
  function liqId(tropasNorm, fecha) {
    var t = (tropasNorm || []).slice().filter(Boolean).sort().join('-');
    return t + '_' + (fecha || '');
  }

  /* ── v15.74.5 · Semáforo por tropa ──────────────────────────────
     Decisión de Nicolás (15/09/2026): el emparejamiento WinCampo ↔ liquidación
     es ESTRICTO. Tiene que coincidir la categoría, las cabezas, y el kg por
     cabeza no puede diferir más de un 8 %. Lo que no cierra queda "a revisar"
     y se acomoda en el sub-portal hasta que dé verde. Nada de emparejar por
     total de cabezas.

     Misma función en Python (`liq_semaforo` en actualizar_datos.py): el
     pipeline publica el semáforo en compras_liquidaciones.json y el sub-portal
     lo recalcula en vivo al editar. Si se toca una, se toca la otra.

       gruposWc — [{categoria, cabezas, kg_ingreso}] de compras_ingresos.json
                  para ESA tropa (lo que WinCampo dice que entró).
       lineas   — [{categoria, cabezas_liq, kg_liq, estado_liq}] líneas de
                  liquidaciones ACTIVAS con esa tropa_norm (todas, de todas
                  las liquidaciones; si hay dos de la misma categoría se suman).
       opts     — {hotelero, tol_kg_pct, tol_cab}

     Devuelve {estado, motivos}:
       'ok'           verde  · todo coincide
       'revisar'      ámbar  · hay liquidación pero algo no cierra
       'sin_liquidar' rojo   · ninguna línea (tropa de PEGSA/Bulltrade)
       'terceros'     gris   · ninguna línea y el hotelero es un tercero: no es
                              tarea de PEGSA, va aparte para no ensuciar el rojo
     motivos = {categoria: ['sin_linea' | 'cat_sobrante' | 'cabezas_680≠580'
                | 'kg_12.7%' | 'estado_revisar']}, y '*': ['tropa_sin_ingreso']
     cuando la liquidación nombra una tropa que WinCampo no tiene.
  */
  var LIQ_TOL_KG_PCT = 8;   // |kg liq/cab − kg wc/cab| ÷ kg liq/cab, en %
  var LIQ_TOL_CAB    = 0;   // cabezas: tienen que ser las mismas
  var LIQ_ACEPT_TOL_KG = 0.1;   // el kg/cab guardado en la aceptación vs el de la línea

  /* v15.74.11 · ¿La aceptación de desbaste de una línea sigue valiendo? Vale
     si existe y el kg/cab que se aceptó es el kg/cab actual de la línea
     (±0,1 kg). Gemelo de liq_desbaste_vigente() en Python. */
  function liqDesbasteVigente(acept, kgLiq, cabLiq) {
    if (!acept || typeof acept !== 'object') return false;
    var kgAcept = _num(acept.kg_liq_cab);
    if (kgAcept == null || !cabLiq) return false;
    return Math.abs((kgLiq || 0) / cabLiq - kgAcept) <= LIQ_ACEPT_TOL_KG;
  }

  function liqEsTercero(hotelero) {
    var h = String(hotelero || '').toUpperCase();
    return !!h && h.indexOf('PEGSA') < 0 && h.indexOf('BULLTRADE') < 0;
  }

  /* v15.74.7 · `gruposWc` son las categorías EFECTIVAS de la tropa: las reales
     por caravana (stock + egresos por animal) cuando la cobertura llega al 90 %,
     si no las del remito. opts trae además fuente_categorias, cab_remito,
     cab_sin_caravana, cobertura_pct y remito_distinto. Con caravanas y animales
     sin caravana, una línea vale con real ≤ liq ≤ real + sin_caravana y la suma
     de la tropa tiene que dar el remito. `avisos` (remito_distinto,
     cobertura_x%) son informativos: no bajan el semáforo. */
  function liqSemaforo(gruposWc, lineas, opts) {
    opts = opts || {};
    gruposWc = gruposWc || []; lineas = lineas || [];
    var tolKg  = opts.tol_kg_pct != null ? opts.tol_kg_pct : LIQ_TOL_KG_PCT;
    var tolCab = opts.tol_cab != null ? opts.tol_cab : LIQ_TOL_CAB;
    var fuente = opts.fuente_categorias || 'remito';
    var cabSc  = fuente === 'caravanas' ? (_num(opts.cab_sin_caravana) || 0) : 0;
    var cabRem = _num(opts.cab_remito);
    var motivos = {}, avisos = [];
    function add(cat, m) { (motivos[cat] = motivos[cat] || []).push(m); }

    if (fuente === 'caravanas' && opts.remito_distinto) avisos.push('remito_distinto');
    if (fuente === 'remito' && opts.cobertura_pct != null) avisos.push('cobertura_' + String(_num(opts.cobertura_pct)) + '%');

    if (!lineas.length) {
      return {estado: liqEsTercero(opts.hotelero) ? 'terceros' : 'sin_liquidar', motivos: {}, avisos: avisos};
    }
    // lo liquidado, sumado por categoría
    var porCat = {};
    lineas.forEach(function (l) {
      var cat = l.categoria || '—';
      var a = porCat[cat] || (porCat[cat] = {cab: 0, kg: 0, revisar: false, aceptado: true});
      var cabL = _num(l.cabezas_liq) || 0, kgL = _num(l.kg_liq) || 0;
      a.cab += cabL;
      a.kg  += kgL;
      if (String(l.estado_liq || '').toLowerCase() === 'revisar') a.revisar = true;
      // v15.74.11 · "aceptar desbaste": vale sólo si TODAS las líneas de la
      // categoría lo tienen y el kg/cab aceptado sigue siendo el de la línea
      // (±0,1 kg): si se editan los kg, la aceptación caduca sola
      if (!liqDesbasteVigente(l.desbaste_aceptado, kgL, cabL)) a.aceptado = false;
    });

    var wcCats = {};
    if (!gruposWc.length) add('*', 'tropa_sin_ingreso');
    gruposWc.forEach(function (g) {
      var cat = g.categoria; wcCats[cat] = 1;
      var a = porCat[cat];
      if (!a) { add(cat, 'sin_linea'); return; }
      var cabWc = _num(g.cabezas) || 0;
      // v15.74.9 · a.cab es la SUMA de las líneas de todas las liquidaciones
      // activas: si no llega, es una liquidación parcial
      if (a.cab < cabWc - tolCab) {
        add(cat, 'parcial_' + String(a.cab) + '/' + String(cabWc));
        return;   // faltan animales: el kg/cab no es comparable
      }
      if (cabSc > 0) {
        // animales sin caravana: pueden estar en cualquier categoría
        if (a.cab > cabWc + cabSc + tolCab) { add(cat, 'cabezas_' + String(a.cab) + '≠' + String(cabWc) + '(+' + String(cabSc) + ' sc)'); return; }
      } else if (a.cab > cabWc + tolCab) {
        add(cat, 'cabezas_' + String(a.cab) + '≠' + String(cabWc));
        return;   // con cabezas distintas el kg/cab no es comparable
      }
      // kg/cab de la categoría: el real de los animales si viene (`kg_cab`),
      // si no el promedio del grupo del remito
      var kgWcCab  = _num(g.kg_cab) || (cabWc ? (_num(g.kg_ingreso) || 0) / cabWc : null);
      var kgLiqCab = a.cab ? a.kg / a.cab : null;
      if (kgWcCab && kgLiqCab) {
        var dif = Math.abs(kgLiqCab - kgWcCab) / kgLiqCab * 100;
        if (dif > tolKg + 1e-9) {
          if (a.aceptado) avisos.push('desbaste_aceptado_' + dif.toFixed(1) + '%');   // informativo: no baja el color
          else add(cat, 'kg_' + dif.toFixed(1) + '%');
        }
      }
    });
    if (cabSc > 0 && cabRem) {
      var tot = 0; Object.keys(porCat).forEach(function (c) { tot += porCat[c].cab; });
      if (tot < cabRem - tolCab) add('*', 'parcial_' + String(tot) + '/' + String(cabRem));   // los sin caravana sin liquidar
      else if (tot > cabRem + tolCab) add('*', 'total_' + String(tot) + '≠' + String(cabRem));
    }
    Object.keys(porCat).sort().forEach(function (cat) {
      if (gruposWc.length && !wcCats[cat]) add(cat, 'cat_sobrante');
      if (porCat[cat].revisar) add(cat, 'estado_revisar');
    });
    return {estado: Object.keys(motivos).length ? 'revisar' : 'ok', motivos: motivos, avisos: avisos};
  }

  /* Texto corto de los motivos, para tooltips: "Ternero: sin_linea · Novillito: cat_sobrante". */
  function liqMotivosTxt(motivos) {
    return Object.keys(motivos || {}).map(function (cat) {
      return cat + ': ' + motivos[cat].join(', ');
    }).join(' · ');
  }

  root.liqCalcular = liqCalcular;
  root.liqId = liqId;
  root.liqSemaforo = liqSemaforo;
  root.liqDesbasteVigente = liqDesbasteVigente;
  root.liqEsTercero = liqEsTercero;
  root.liqMotivosTxt = liqMotivosTxt;
  root.LIQ_TOL_KG_PCT = LIQ_TOL_KG_PCT;
  root.LIQ_TOL_CAB = LIQ_TOL_CAB;
  // también como módulo, para poder correr los tests en node sin un DOM
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { liqCalcular: liqCalcular, liqId: liqId, liqSemaforo: liqSemaforo,
                       liqDesbasteVigente: liqDesbasteVigente,
                       liqEsTercero: liqEsTercero, liqMotivosTxt: liqMotivosTxt,
                       LIQ_TOL_KG_PCT: LIQ_TOL_KG_PCT, LIQ_TOL_CAB: LIQ_TOL_CAB };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
