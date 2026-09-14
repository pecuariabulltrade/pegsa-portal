/* compras-calc.js — v15.74.1 · La cuenta de una liquidación de compra
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

  root.liqCalcular = liqCalcular;
  root.liqId = liqId;
  // también como módulo, para poder correr los tests en node sin un DOM
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { liqCalcular: liqCalcular, liqId: liqId };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
