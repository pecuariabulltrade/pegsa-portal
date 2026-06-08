// ── Banner stale global (v15.12) ──
// Inyecta un banner sticky arriba de TODO el portal cuando los JSONs no están frescos
// o algún módulo del pipeline reporta .ok=false. Funciona en cualquier pantalla
// (Panel React del home + módulos vanilla + cualquier futura página) porque vive
// fuera de React, directo en el body.

(function() {
  'use strict';

  const DISMISS_KEY = 'staleBannerDismissUntil';
  const REVALIDATE_MS = 5 * 60 * 1000; // cada 5 min

  function isDismissed() {
    const until = localStorage.getItem(DISMISS_KEY);
    return until && Date.now() < parseInt(until, 10);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 60 * 60 * 1000));
    render(null);
  }

  function getRoot() {
    let root = document.getElementById('staleBannerRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'staleBannerRoot';
      root.style.cssText = 'position:sticky;top:0;z-index:9999;';
      // Inyectar como PRIMER hijo de body
      document.body.insertBefore(root, document.body.firstChild);
    }
    return root;
  }

  function render(status) {
    const root = getRoot();
    if (!status || status.level === 'ok' || isDismissed()) {
      root.innerHTML = '';
      return;
    }
    const colors = {
      warning:  { bg: '#FEF3C7', border: '#F59E0B', text: '#78350F' },
      critical: { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' },
      error:    { bg: '#E5E7EB', border: '#6B7280', text: '#1F2937' },
    }[status.level];
    root.innerHTML = `
      <div style="background:${colors.bg};border-bottom:2px solid ${colors.border};color:${colors.text};
                  padding:10px 20px;display:flex;align-items:center;justify-content:space-between;
                  font-family:inherit;font-size:14px;font-weight:500;">
        <span>⚠ ${status.text}</span>
        <button id="staleBannerDismiss" style="background:transparent;border:1px solid ${colors.border};
                color:${colors.text};padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;
                white-space:nowrap;margin-left:16px;">Ocultar 1h</button>
      </div>`;
    document.getElementById('staleBannerDismiss').onclick = dismiss;
  }

  async function check() {
    try {
      const r = await fetch('./ultima_actualizacion.json?t=' + Date.now());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const gen = new Date(d.generado);
      const hours = (Date.now() - gen.getTime()) / 3600000;
      const modulos = d.modulos || {};
      const modulosBad = Object.entries(modulos)
        .filter(([k, v]) => v && v.ok === false).map(([k]) => k);

      let level = 'ok';
      let text = `Última actualización: hace ${hours.toFixed(1)} h`;
      if (hours > 24) { level = 'critical'; text = `URGENTE: portal no actualizado en ${Math.round(hours)} h. El bot AUTO puede estar caído.`; }
      else if (hours > 6) { level = 'warning'; text = `Última actualización hace ${hours.toFixed(1)} h.`; }
      if (modulosBad.length > 0) {
        if (level === 'ok') level = 'warning';
        text += ` Módulos con error: ${modulosBad.join(', ')}.`;
      }
      render({ level, text });
    } catch (e) {
      render({ level: 'error', text: `No se pudo leer ultima_actualizacion.json: ${e.message}` });
    }
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { check(); setInterval(check, REVALIDATE_MS); });
  } else {
    check();
    setInterval(check, REVALIDATE_MS);
  }
})();
