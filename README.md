# PEGSA & BULLTRADE — Portal de Datos

Portal de gestión para Pecuaria El Garabí SA & Bulltrade SRL.
Datos en vivo desde WinCampo (SQL Server) vía OneDrive.

---

## Arquitectura

```
PC servidor (empresa, siempre encendida)
  ├── actualizar_datos.py   → extrae datos de WinCampo → genera JSONs
  ├── servidor.py           → sirve los JSONs en localhost:8765
  └── ngrok                 → expone :8765 como URL pública HTTPS

GitHub → Railway
  └── servidor_railway.py  → sirve el portal HTML
      └── portal pide JSONs → URL de ngrok → servidor PC empresa
```

## Setup en la PC de la empresa

### 1. Instalar dependencias
```
1_INSTALAR.bat
```

### 2. Configurar config.ini
```ini
[ONEDRIVE]
carpeta = C:\Users\TU_USUARIO\OneDrive - pecuaria el garabi sa\PEGSA_Portal\datos
```

### 3. Instalar y configurar ngrok
1. Descargar ngrok: https://ngrok.com/download
2. Crear cuenta gratuita en ngrok.com → obtener authtoken
3. Configurar: `ngrok config add-authtoken TU_TOKEN`
4. Iniciar: `ngrok http 8765`

### 4. Actualizar URL en Railway
Después de iniciar ngrok:
```
python actualizar_ngrok.py
```
Copiar la URL que aparece y configurarla en Railway como variable de entorno `NGROK_URL`.

### 5. Actualización automática diaria
El bat `2_EJECUTAR_AHORA.bat` corre todos los días a las 7:00 AM via Tarea Programada de Windows.

---

## Deploy en Railway

1. Fork este repositorio
2. Conectar en Railway → New Project → Deploy from GitHub
3. Configurar variable de entorno: `NGROK_URL=https://xxxx.ngrok.io`
4. Railway usa el `Procfile` automáticamente

---

## Archivos clave

| Archivo | Descripción |
|---------|-------------|
| `pegsa_bull_portal.html` | Portal completo (HTML + CSS + JS) |
| `actualizar_datos.py` | Extrae datos de WinCampo → genera JSONs |
| `servidor.py` | Servidor local (PC empresa) |
| `servidor_railway.py` | Servidor Railway (sirve HTML) |
| `config.ini` | Configuración local (NO subir con credenciales) |
| `Procfile` | Instrucción de inicio para Railway |

---

## Módulos del portal

- **Stock de Hacienda** — KPIs, por categoría, por establecimiento, por propietario
- **Stock de Insumos** — Stock en kg con días restantes
- **Movimientos** — Ingresos y egresos productivos
- **Muertes** — Tasa de mortandad por grupo
- **Productivo** — ADP, estadía, consumo, indicadores de eficiencia
- **Tesorería** — Posición bancaria, cheques, hacienda, Darwash, flujo acumulado 6 meses

---

*PEGSA & BULLTRADE · Sistema de Gestión · 2026*
