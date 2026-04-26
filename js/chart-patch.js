/* chart-patch.js — Chart.js auto-destroy global · 2026-04-25 */

/* Chart.js auto-destroy: soluciona "Canvas is already in use" */
(function(){
  if (typeof Chart === 'undefined' || Chart.__autoDestroy) return;
  var Real = Chart;
  function ChartAuto(item, config){
    try {
      var c = item;
      if (c && c.canvas) c = c.canvas;
      if (typeof c === 'string') c = document.getElementById(c);
      if (c instanceof HTMLCanvasElement && Real.getChart) {
        var prev = Real.getChart(c);
        if (prev) prev.destroy();
      }
    } catch(e){}
    return new Real(item, config);
  }
  Object.getOwnPropertyNames(Real).forEach(function(k){
    if (k === 'length' || k === 'name' || k === 'prototype') return;
    try { ChartAuto[k] = Real[k]; } catch(e){}
  });
  ChartAuto.prototype = Real.prototype;
  ChartAuto.__autoDestroy = true;
  window.Chart = ChartAuto;
})();
