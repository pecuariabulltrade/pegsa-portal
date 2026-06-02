# v14.3 — Precios Inferencia mobile: enteros sin "k" + % con un decimal

Estoy en `C:\Users\USER\Documents\GitHub\pegsa-portal`. Necesito cambiar el formato de 3 campos en las **tarjetas expandibles de Precios de Inferencia** del mobile:

- `Precio venta` → mostrar entero completo (`$ 7.300/kg`) en vez de abreviado (`$ 7,3k/kg`)
- `Costo prod` → mostrar entero completo (`$ 3.400`) en vez de abreviado (`$ 3,4k`)
- `Rinde` → mostrar con un decimal (`53,0 %`) en vez de redondeado (`53 %`)

El resto de los formateadores y el resto de las pantallas no se tocan — `fmtCompactMoney` se sigue usando para el margen y otras métricas, no la borres.

## Rutas

- Repo: `C:\Users\USER\Documents\GitHub\pegsa-portal`
- Espejo OneDrive: `C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal`

Editar en AMBAS y copiar al final, sino el bot AUTO al próximo tick `:04` pisa la versión vieja.

---

## Cambio 1 — `mobile-data.js` (3 líneas, dentro del map de PRECIOS_INFERENCIA)

Buscá este bloque (alrededor de línea 862-869):

```javascript
          precioVenta:    pv,
          precioVentaFmt: pv != null ? fmtCompactMoney(pv) + "/kg" : "—",
          rinde:          ri,
          rindeFmt:       ri != null ? Math.round(ri * 100) + " %" : "—",
          costoKgProd:    ck,
          costoKgProdFmt: ck != null ? fmtCompactMoney(ck) : "—",
          diasFeed:       df,
          diasFeedFmt:    df != null ? Math.round(df) + " d" : "—",
```

Y reemplazá las 3 líneas `*Fmt` específicas (las otras NO se tocan):

```javascript
          precioVenta:    pv,
          precioVentaFmt: pv != null ? "$ " + Math.round(pv).toLocaleString("es-AR") + "/kg" : "—",
          rinde:          ri,
          rindeFmt:       ri != null ? (ri * 100).toFixed(1).replace(".", ",") + " %" : "—",
          costoKgProd:    ck,
          costoKgProdFmt: ck != null ? "$ " + Math.round(ck).toLocaleString("es-AR") : "—",
          diasFeed:       df,
          diasFeedFmt:    df != null ? Math.round(df) + " d" : "—",
```

Lo que cambia, fila por fila:
- `precioVentaFmt`: `fmtCompactMoney(pv) + "/kg"` → `"$ " + Math.round(pv).toLocaleString("es-AR") + "/kg"`
- `rindeFmt`: `Math.round(ri * 100) + " %"` → `(ri * 100).toFixed(1).replace(".", ",") + " %"`
- `costoKgProdFmt`: `fmtCompactMoney(ck)` → `"$ " + Math.round(ck).toLocaleString("es-AR")`

Eso es todo el cambio de lógica. `toLocaleString("es-AR")` ya pone el separador de miles correcto (`$ 7.300`, `$ 8.000`).

---

## Cambio 2 — `mobile.html` (cache-buster)

Buscá las 4 líneas con `?v=141` y reemplazalas por `?v=142`:

```
<link rel="stylesheet" href="mobile.css?v=141">
...
<script src="data.js?v=141"></script>
<script src="mobile-data.js?v=141"></script>
<script type="text/babel" data-presets="env,react" src="mobile.jsx?v=141"></script>
```

Quedan:

```
<link rel="stylesheet" href="mobile.css?v=142">
...
<script src="data.js?v=142"></script>
<script src="mobile-data.js?v=142"></script>
<script type="text/babel" data-presets="env,react" src="mobile.jsx?v=142"></script>
```

(También actualizar el comentario `v12.2: cache-buster ?v=141` a `?v=142` si querés, opcional.)

---

## Después de aplicar

1. Copiar al espejo OneDrive:
   ```powershell
   $repo = "C:\Users\USER\Documents\GitHub\pegsa-portal"
   $od   = "C:\Users\USER\OneDrive - pecuaria el garabi sa\PEGSA_Portal"
   Copy-Item "$repo\mobile-data.js" "$od\mobile-data.js" -Force
   Copy-Item "$repo\mobile.html" "$od\mobile.html" -Force
   ```

2. Commit + push:
   ```
   cd C:\Users\USER\Documents\GitHub\pegsa-portal
   git add mobile-data.js mobile.html
   git commit -m "v14.3: Precios Inferencia mobile - enteros sin 'k' + Rinde con un decimal

   - precioVentaFmt: \$7.300/kg en vez de \$7,3k/kg
   - costoKgProdFmt: \$3.400 en vez de \$3,4k
   - rindeFmt: 53,0 % en vez de 53 % (un decimal con coma es-AR)
   - mobile.html cache-buster ?v=141 -> ?v=142

   fmtCompactMoney se mantiene para margen y otras metricas."
   git fetch origin && git rebase origin/main && git push origin main
   ```

3. Reportame: hash pusheado y confirmación de que los 2 archivos quedaron iguales en OneDrive (mtime/size).

---

## Verificación visual (opcional)

Después del push, hard refresh (Ctrl+Shift+R) en `mobile.html` y abrir cualquier tarjeta de Precios Inferencia. Las 3 tarjetas (Vaca, Vaquillona, Novillo, etc.) deberían mostrar Precio venta como `$ 7.300/kg`, Costo prod como `$ 3.400`, y Rinde como `53,0 %` (con coma y un decimal).
