# Atlas

**Atlas** es la plataforma web de Verkku (consola con menú lateral, inicio y módulos). **Atlas VPN** es un módulo dentro de Atlas: túneles **Cloudflare Access TCP** (`cloudflared access tcp`) hacia **SSH** y **bases de datos** detrás de Zero Trust (por ejemplo `*.asptienda.com`).

Por defecto `python -m atlasvpn` abre **Atlas** en una ventana de escritorio Windows (**WebView2** + React), sin abrir Chrome/Edge como navegador aparte. Opcional: `--browser`, `--tk` (CustomTkinter legacy) o `--no-browser` (solo API). El módulo Atlas VPN incluye **sincronización** desde la API de Cloudflare hacia `scripts/tunnels.json`.

> El comando y el paquete Python siguen llamándose `atlasvpn` por compatibilidad; los datos locales viven en `.atlasvpn/`.

## Requisitos

- **Python 3.10+**
- **Node.js 18+** y `npm` (compilar la UI en `ui/` → `atlasvpn/static/web/`)
- **WebView2** en Windows (ventana integrada)
- **`cloudflared`** en el `PATH`
- Cloudflare **Zero Trust / Access** con apps `NOMBRE-ssh.TUDOMINIO` y `NOMBRE-bd.TUDOMINIO`

## Instalación

```powershell
cd "ruta\a\VPN-Poslite"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ui
npm install
npm run build
cd ..
```

## Uso rápido

### Interfaz web (recomendado)

```powershell
python -m atlasvpn
```

En la consola web: **Inicio** (resumen), menú **Atlas VPN → Conexiones / Poslite / Cloudflare** (admin).

1. **Atlas VPN → Cloudflare**: Account ID, API Token, sufijo, Zone ID opcional → **Guardar** y **Sincronizar**.
2. **Atlas VPN → Conexiones**: sitio, **Iniciar SSH** / **BD** / terminal web.

**Navegador externo:** `python -m atlasvpn --browser`. **Solo API:** `--no-browser`. **Puerto:** `--port 9000`.

### CustomTkinter (legacy)

```powershell
python -m atlasvpn --tk
```

### CLI

```powershell
python scripts\tunnel_manager.py list-sites
python scripts\tunnel_manager.py start laarena --services both
```

## API Token de Cloudflare

Permisos de lectura: **Zero Trust** y **Access Applications**. Los tokens `cfat_…` se validan con el account ID correcto.

Si falla la sync con 403: revisa permisos del token o usa **Zone ID** en Atlas VPN (Cloudflare → Overview de la zona).

## Archivos locales (no subir al git)

| Ruta | Contenido |
|------|-----------|
| `.atlasvpn/auth.json` | Hash de contraseña |
| `.atlasvpn/settings.json` | Credenciales Cloudflare |
| `scripts/tunnels.json` | Sitios y puertos |
| `.cloudflared-tunnels/state.json` | PIDs de `cloudflared` |

## Docker (desarrollo)

Contenedores `atlas-api` y `atlas-ui`. Ver `docker-compose.yml` y workflow `.github/workflows/atlas-dev-selfhosted.yml`.

## Seguridad

- Protege `.atlasvpn/` (tokens sensibles).
- Atlas VPN **no sustituye** Cloudflare Access: `cloudflared` y el navegador siguen pidiendo login cuando corresponda.

## Desarrollo

```powershell
python -m py_compile atlasvpn\web_server.py atlasvpn\cf_sync.py
cd ui && npm run build
```

## Licencia

Uso interno Verkku.
