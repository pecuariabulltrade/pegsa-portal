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
// v15.97: fp() venía de modulo-07-simulador.js (borrado).
function fp(n){ return (Number(n||0)*100).toFixed(1)+'%'; }

/* v15.98: hora de la última consulta a WinCampo (ultima_actualizacion.json →
   wincampo.consultado, "dd/mm/aaaa hh:mm"). Desde v15.98 el bot publica un JSON
   sólo si cambió, así que su meta.generado deja de moverse en los ticks sin
   datos nuevos: las pantallas muestran esta hora y, si falta, caen al
   generado del archivo. cb(texto) se llama una vez con el valor sincrónico y
   otra si el fetch trae uno distinto. */
function _fmtDMYHM(iso){
  if(!iso) return null;
  var d = new Date(iso); if(isNaN(d.getTime())) return String(iso);
  var p = function(n){ return n<10 ? '0'+n : ''+n; };
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes());
}
var _wcConsultadoPromise = null;
function wincampoAlTexto(fallbackIso, cb){
  var pd = window.PEGSA_DATA || {};
  var ya = pd.wincampoConsultado || null;
  var txt = ya || _fmtDMYHM(fallbackIso) || '—';
  if(cb) cb(txt);
  if(ya || !cb) return txt;
  if(!_wcConsultadoPromise){
    _wcConsultadoPromise = fetch('./ultima_actualizacion.json?t='+Date.now())
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(u){ return (u && u.wincampo && u.wincampo.consultado) || null; })
      .catch(function(){ return null; });
  }
  _wcConsultadoPromise.then(function(c){ if(c && c!==txt) cb(c); });
  return txt;
}
