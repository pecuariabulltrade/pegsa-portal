# PEGSA Portal - GitHub Pages

Versión simple del portal para publicar **solo con GitHub Pages**.

## Cómo funciona

- `index.html` es el portal público.
- `actualizar_datos.py` se ejecuta **en tu PC/servidor interno** con acceso a SQL Server.
- Ese script genera los archivos `*.json` **directamente dentro de esta carpeta del repo**.
- Después hacés `git push` y GitHub Pages publica la web actualizada.

## Importante

Este repo **no** usa Railway, ngrok ni servidor web Python para producción.
La web publicada lee los JSON del mismo repositorio.

## Archivos principales

- `index.html` -> portal público
- `actualizar_datos.py` -> genera y actualiza los JSON
- `config.example.ini` -> ejemplo de configuración
- `5_ACTUALIZAR_Y_PUBLICAR_GITHUB.bat` -> actualiza datos y hace push
- `.nojekyll` -> evita procesamiento extra de GitHub Pages

## Preparación inicial

### 1) Clonar el repo en la PC que ya actualiza datos

```bash
git clone TU_REPO_GITHUB
cd pegsa-portal
```

### 2) Instalar dependencias

Ejecutá:

```bash
1_INSTALAR.bat
```

### 3) Crear `config.ini`

Copiá `config.example.ini` a `config.ini` y completá credenciales reales.

### 4) Configurar la carpeta destino

En `config.ini`, dentro de `[ONEDRIVE]`, poné la ruta local de **este mismo repo**.

Ejemplo:

```ini
[ONEDRIVE]
carpeta = C:\Users\Nicolas\Documents\pegsa-portal
```

Aunque el bloque se llame `ONEDRIVE`, en esta versión solo se usa como **carpeta destino local**.

## Publicar en GitHub Pages

En GitHub:

- Settings
- Pages
- Build and deployment
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

La URL queda así:

```text
https://TUUSUARIO.github.io/TU_REPO/
```

## Actualización diaria

Tu sistema actual ya se actualiza todos los días desde el servidor externo.
En esta versión, lo correcto es que la tarea diaria haga dos pasos:

1. ejecutar `actualizar_datos.py`
2. ejecutar `5_ACTUALIZAR_Y_PUBLICAR_GITHUB.bat`

O directamente programar **solo** `5_ACTUALIZAR_Y_PUBLICAR_GITHUB.bat`, porque ese archivo ya corre la actualización y luego publica a GitHub.

## JSON esperados

El portal usa, entre otros, estos archivos:

- `stock_kpis_2025.json`
- `stock_prop_*_2025.json`
- `productivo_2025.json`
- `consumo_2025.json`
- `indicadores_2025.json`
- `movimientos_2025.json`
- `muertes_2025.json`
- `muertes_30d_2025.json`
- `stock_insumos_2025.json`
- `tesoreria_ultimo.json`
- `ultima_actualizacion.json`

## Qué no subir

- `config.ini`
- credenciales SQL
- archivos temporales o logs

## Siguiente paso recomendado

1. subir esta carpeta a un repo nuevo y limpio
2. activar GitHub Pages
3. probar una corrida manual con `5_ACTUALIZAR_Y_PUBLICAR_GITHUB.bat`
4. dejar esa misma tarea programada todos los días
