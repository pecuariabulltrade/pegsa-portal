# v14.4 — Mismas tarjetas Precios Inferencia pero en el portal de PC (app.jsx)

Las 4 tarjetas (Vaca, Vaquillona, Novillo, etc.) que muestran "Precio venta", "Costo prod" y "Rinde" existen también en el portal de escritorio, en `app.jsx`. Necesito el mismo cambio de formato que ya hicimos en mobile (v14.3): enteros completos sin "k" y porcentaje con un decimal.

## Rutas

- Repo: `C:\Users\USER\Documents\GitHub\pegsa-portal`
- Espejo OneDrive: `C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal`

Editar en repo, copiar a OneDrive al final.

---

## Cambios en `app.jsx`

### Cambio 1 — Ajustar `fmtPct` (línea 375)

Buscá:

```javascript
  const fmtPct = (n) => n != null ? Math.round(n * 100) + " %" : "—";
```

Reemplazá por:

```javascript
  const fmtPct = (n) => n != null ? (n * 100).toFixed(1).replace(".", ",") + " %" : "—";
```

Esa función solo la usa el componente de Precios Inferencia, no hay riesgo de impactar otras pantallas.

### Cambio 2 — Reemplazar `fmtCompact` por `fmtMoney` en las 2 líneas de la grid (líneas 433 y 434)

`fmtMoney` ya está definida arriba (línea 366) y hace exactamente lo que queremos: `"$ " + Math.round(n).toLocaleString("es-AR")`. Sólo hay que sustituir las llamadas.

Buscá:

```javascript
                    <div><span>Precio venta</span><strong>{fmtCompact(it.precio_venta)}/kg</strong></div>
                    <div><span>Costo prod</span><strong>{fmtCompact(it.cost_kg_prod)}</strong></div>
```

Reemplazá por:

```javascript
                    <div><span>Precio venta</span><strong>{fmtMoney(it.precio_venta)}/kg</strong></div>
                    <div><span>Costo prod</span><strong>{fmtMoney(it.cost_kg_prod)}</strong></div>
```

`fmtCompact` se queda definida (todavía puede ser útil si en otro lado se referencia) — no la borres.

---

## Después de aplicar

1. Verificación rápida (3 greps):
   ```
   grep -n "fmtPct = " app.jsx           # debe mostrar la nueva con toFixed(1)
   grep -n "fmtCompact(it.precio_venta)" app.jsx  # debe NO encontrar
   grep -n "fmtMoney(it.precio_venta)"   app.jsx  # debe encontrar 1 vez
   ```

2. Copiar a OneDrive:
   ```powershell
   $repo = "C:\Users\USER\Documents\GitHub\pegsa-portal"
   $od   = "C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal"
   Copy-Item "$repo\app.jsx" "$od\app.jsx" -Force
   ```

3. Commit + push:
   ```
   cd C:\Users\USER\Documents\GitHub\pegsa-portal
   git add app.jsx
   git commit -m "v14.4: Precios Inferencia desktop - enteros sin 'k' + Rinde un decimal

   Mismo cambio que v14.3 pero en app.jsx (portal de escritorio). Las
   4 tarjetas de Precios de Inferencia ahora muestran:
   - Precio venta: \$7.300/kg en vez de \$7,3k/kg (fmtCompact -> fmtMoney)
   - Costo prod:   \$3.400 en vez de \$3,4k (fmtCompact -> fmtMoney)
   - Rinde:        53,0 % en vez de 53 % (un decimal con coma es-AR)

   fmtCompact se mantiene definido por si otras pantallas la usan."
   git fetch origin && git rebase origin/main && git push origin main
   ```

4. Reportame hash pusheado y parity OneDrive (mtime/size de app.jsx en ambas rutas).

---

## Verificación visual

Abrir el portal de escritorio → módulo Mercado y Precios → debería ver las 4 tarjetas en grid con el nuevo formato. Hard refresh (Ctrl+Shift+R) por las dudas, aunque `app.jsx` no tiene cache-buster — el navegador de PC suele tomar la versión nueva sin demora si forzás reload.

Si después del push y refresh seguís viendo `7,3k/kg`, abrí DevTools → Network → revisá si `app.jsx` se está cargando desde caché. En ese caso lo solucionamos en otro paso agregándole un `?v=X` igual que mobile.html.
