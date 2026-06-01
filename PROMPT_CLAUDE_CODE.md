# v14.1 — Costo del kg producido en panel Indiferencia (Novillo / Vaquillona / Vaca)

Estoy en `C:\Users\USER\Documents\GitHub\pegsa-portal`. Necesito que apliques estos 3 cambios **tanto en el repo Github como en el espejo OneDrive**, y después pushees a GitHub. La VM de Cowork dejó el repo con un lock y el bot AUTO pisó la copia local — por las dudas tratá los archivos como si NO tuvieran ningún cambio v14.1 todavía y aplicalos desde cero. Si ya están, no rompe nada.

## Rutas

- Repo (lo que sube a GitHub Pages): `C:\Users\USER\Documents\GitHub\pegsa-portal`
- Espejo OneDrive (lo que lee el bot AUTO y desde donde se pisa el repo cada hora): `C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal`

**CRÍTICO**: los archivos que voy a modificar existen en AMBAS rutas. Si solo lo cambiás en una, el bot AUTO al próximo tick (`:04` de cada hora) pisa con la versión vieja. Editar ambas o editar el repo y copiar a OneDrive después.

## Posibles locks de git colgados

Antes de tocar nada, limpiá si existen:
- `C:\Users\USER\Documents\GitHub\pegsa-portal\.git\HEAD.lock`
- `C:\Users\USER\Documents\GitHub\pegsa-portal\.git\index.lock`

Si el `git status` falla con "bad signature 0x00000000" en el index, borrá `.git\index` y corré `git reset HEAD` para regenerarlo desde HEAD.

---

## Cambio 1 — `js/modulo-07-simulador.js`

Función `calcSim(tipo)`. Buscá el bloque que **actualmente termina así** (cerca de línea 464-478):

```javascript
  document.getElementById('simRes-'+tipo).innerHTML = html;
  _simSave(); // persistir valores del usuario

  // Update global KPI strip
  if(tipo === SIM_ACTIVE_TAB){
    document.getElementById('skpi-dias').textContent = Math.round(dias);
    document.getElementById('skpi-costo').textContent = '$'+f2(costoPorKg);
    var el = document.getElementById('skpi-resultado');
    el.textContent = '$'+f2(resEco);
    el.style.color = isPos ? '#6bc47a' : '#e74c3c';
    var elTir = document.getElementById('skpi-tir');
    elTir.textContent = fp(tirAnual);
    elTir.style.color = tirAnual >= 0 ? '#6bc47a' : '#e74c3c';
  }
}
```

Y reemplazalo por (inserta el bloque `// v14.1` entre `_simSave()` y `// Update global KPI strip`):

```javascript
  document.getElementById('simRes-'+tipo).innerHTML = html;
  _simSave(); // persistir valores del usuario

  // v14.1: Exportar resultados del simulador para que otros módulos los lean
  // (p.ej. panel Indiferencia muestra costoPorKg por categoría)
  window.SIM_LAST_RESULTS = window.SIM_LAST_RESULTS || {};
  window.SIM_LAST_RESULTS[tipo] = {
    costoPorKg: costoPorKg,
    totalCostos: totalCostos,
    kgsProducidos: kgsProducidos,
    dias: dias,
    alimentacion: alimentacion,
    racion: racion,
    pesoE: pesoE,
    pesoS: pesoS
  };
  // Notificar a panel Indiferencia si está abierto
  if(typeof _refreshIndiferenciaCostos === 'function') _refreshIndiferenciaCostos();

  // Update global KPI strip
  if(tipo === SIM_ACTIVE_TAB){
    document.getElementById('skpi-dias').textContent = Math.round(dias);
    document.getElementById('skpi-costo').textContent = '$'+f2(costoPorKg);
    var el = document.getElementById('skpi-resultado');
    el.textContent = '$'+f2(resEco);
    el.style.color = isPos ? '#6bc47a' : '#e74c3c';
    var elTir = document.getElementById('skpi-tir');
    elTir.textContent = fp(tirAnual);
    elTir.style.color = tirAnual >= 0 ? '#6bc47a' : '#e74c3c';
  }
}
```

---

## Cambio 2 — `js/modulo-05-mercado.js`

### 2a — Inyectar las cards arriba de la tabla

En la función `renderIndiferencia()`, buscá:

```javascript
  var html = '';
  var fechaLeg = hoyKey.split('-').reverse().join('/');
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Resumen del día · '+fechaLeg+'</div>';
  html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:28px">';
```

Y reemplazalo por:

```javascript
  var html = '';
  var fechaLeg = hoyKey.split('-').reverse().join('/');

  // v14.1: Costo de Producción por categoría (en vivo desde el Simulador Feedlot)
  // Cards mostradas arriba de la tabla. El simulador escribe en
  // window.SIM_LAST_RESULTS al ejecutar calcSim() en cada tab.
  // Si todavía no se inicializó, lo gatillamos en background.
  html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Costo del kg producido · Simulador Feedlot</div>';
  html += '<div id="indiferenciaCostosSim" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">'
    + _indiferenciaCostoCardsHTML()
    + '</div>';

  html += '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Resumen del día · '+fechaLeg+'</div>';
  html += '<div style="overflow-x:auto;border:1px solid rgba(26,22,18,.12);border-radius:2px;background:#fff;margin-bottom:28px">';
```

### 2b — Helpers nuevos

Buscá la función `_setIndiferenciaPeriodo` (cerca de línea 1738):

```javascript
function _setIndiferenciaPeriodo(dias){
  _indiferenciaPeriodo = dias;
  renderIndiferencia();
}
```

Y **justo después de su llave de cierre**, insertá estas dos funciones nuevas (antes de `_renderIndiferenciaChart`):

```javascript

// v14.1: Costo del kg producido por categoría (Novillo / Vaquillona / Vaca)
// El número sale del Simulador Feedlot (modulo-07) en window.SIM_LAST_RESULTS.
// Si todavía no corrió, lo gatillamos en background con initSimulador().
function _indiferenciaCostoCardsHTML(){
  var R = window.SIM_LAST_RESULTS || {};
  var defs = [
    {tipo:'terneros', label:'Novillo',    sub:'Terneros · Novillos',     ico:'🐂', col:'#1a5276'},
    {tipo:'terneras', label:'Vaquillona', sub:'Terneras · Vaquillonas',  ico:'🐄', col:'#7d3c98'},
    {tipo:'vacas',    label:'Vaca',       sub:'Vacas de feedlot',         ico:'🐮', col:'#922b21'}
  ];
  // Si no hay datos del simulador todavía, lo arrancamos en background.
  // initSimulador() es idempotente (SIM_INITED flag).
  var pending = defs.some(function(d){ return !R[d.tipo] || !R[d.tipo].costoPorKg; });
  if(pending && typeof initSimulador === 'function'){
    setTimeout(function(){
      try { initSimulador(); } catch(e){}
    }, 0);
  }
  var out = '';
  defs.forEach(function(d){
    var r = R[d.tipo] || {};
    var c = r.costoPorKg;
    var dias = r.dias;
    var pe = r.pesoE, ps = r.pesoS;
    var hasData = c != null && c > 0;
    var valTxt = hasData ? '$'+Math.round(c).toLocaleString('es-AR') : '—';
    var hintTxt = hasData
      ? Math.round(dias)+' días · '+(pe||'?')+'→'+(ps||'?')+' kg'
      : 'Calculando…';
    out += '<div style="background:#fff;border:1px solid rgba(26,22,18,.12);border-left:3px solid '+d.col+';border-radius:2px;padding:14px 16px">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">'
        + '<div>'
          + '<div style="font-family:DM Mono,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,22,18,.55);font-weight:600">'+d.ico+' '+d.label+'</div>'
          + '<div style="font-family:DM Mono,monospace;font-size:10px;color:rgba(26,22,18,.4);margin-top:2px">'+d.sub+'</div>'
        + '</div>'
      + '</div>'
      + '<div style="font-family:DM Mono,monospace;font-size:22px;font-weight:700;color:'+d.col+';letter-spacing:-.01em">'+valTxt+'<span style="font-size:12px;font-weight:500;color:rgba(26,22,18,.5);margin-left:6px">/ kg producido</span></div>'
      + '<div style="font-family:DM Mono,monospace;font-size:11px;color:rgba(26,22,18,.5);margin-top:6px">'+hintTxt+'</div>'
      + '</div>';
  });
  return out;
}

// Refresh cards sin re-renderizar toda la tabla. Lo llama calcSim() del
// simulador cuando termina de calcular cada tab.
function _refreshIndiferenciaCostos(){
  var el = document.getElementById('indiferenciaCostosSim');
  if(el) el.innerHTML = _indiferenciaCostoCardsHTML();
}

```

---

## Cambio 3 — `index.html`

Buscá las **3 ocurrencias** del siguiente texto y reemplazalas todas (es la nota de pie en cada solapa del simulador):

**Antes:**
```
Maíz neto feedlot = pizarra − 37.000 (contraflete) + 15.000 (flete local) · Composición y factor IVA 1,15 según Excel
```

**Después:**
```
Maíz neto feedlot = pizarra − 63.181 (contraflete) + 20.942 (flete local) · Composición y factor IVA 1,15 según Excel
```

Si las 3 ocurrencias ya tienen `63.181/20.942` no hagas nada (eso es de v14.2, ya aplicado anteriormente).

---

## Después de aplicar los 3 cambios

1. Verificá sintaxis: `node -c js/modulo-05-mercado.js` y `node -c js/modulo-07-simulador.js`
2. Verificá que las funciones nuevas estén:
   - `grep -c "_indiferenciaCostoCardsHTML" js/modulo-05-mercado.js` → debe ser ≥3 (definición + 2 llamadas)
   - `grep -c "SIM_LAST_RESULTS" js/modulo-07-simulador.js` → debe ser ≥2
3. Copiá los 3 archivos al espejo OneDrive (manteniendo estructura de carpetas):
   ```powershell
   $repo = "C:\Users\USER\Documents\GitHub\pegsa-portal"
   $od   = "C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal"
   Copy-Item "$repo\index.html" "$od\index.html" -Force
   Copy-Item "$repo\js\modulo-05-mercado.js" "$od\js\modulo-05-mercado.js" -Force
   Copy-Item "$repo\js\modulo-07-simulador.js" "$od\js\modulo-07-simulador.js" -Force
   ```
4. Commit + push:
   ```
   cd C:\Users\USER\Documents\GitHub\pegsa-portal
   git add index.html js/modulo-05-mercado.js js/modulo-07-simulador.js
   git commit -m "v14.1: Costo del kg producido en panel Indiferencia (Novillo/Vaquillona/Vaca)

   - modulo-07-simulador.js: exportar window.SIM_LAST_RESULTS al final de calcSim()
     con costoPorKg, dias, pesoE/pesoS por tipo. Notifica _refreshIndiferenciaCostos()
     para refresh en vivo del panel Indiferencia.
   - modulo-05-mercado.js: 3 tarjetas arriba de la tabla Indiferencia mostrando
     costo \$/kg producido para Novillo (terneros), Vaquillona (terneras), Vaca
     (vacas) leyendo de window.SIM_LAST_RESULTS. Si no hay datos, gatilla
     initSimulador() en background.
   - index.html: actualizar texto visible '37.000/15.000' a '63.181/20.942'
     (consistente con v14.2 si todavia no estaba)."
   git fetch origin
   git rebase origin/main
   git push origin main
   ```

5. Si quedaron cambios stasheados durante el proceso (JSONs del bot), hacé `git stash pop` al final.

## Reportame

- Qué hash quedó pusheado (`git log --oneline -3`)
- Si los 3 archivos quedaron actualizados en OneDrive (mostrame el size/mtime)
- Cualquier conflicto o error
