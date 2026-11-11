/* comun.js — v15.95: helpers compartidos que vivían en modulo-01-resultados.js
   (Estado de Resultados, retirado). Copiados tal cual. Se carga antes que
   los demás módulos. */
const GREEN = '#27613d'; const RED = '#c0392b'; const GOLD = '#b8922a';

function fmt(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v/1e9).toFixed(2).replace('.',',') + ' M';
  if (abs >= 1e6) return (v/1e6).toFixed(1).replace('.',',') + ' K';
  return v.toLocaleString('es-AR');
}
