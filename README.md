# Atlas

**Atlas** es la plataforma web de Verkku (consola con menú lateral, inicio y módulos). **Atlas VPN** es un módulo dentro de Atlas: túneles **Cloudflare Access TCP** (`cloudflared access tcp`) hacia **SSH** y **bases de datos** detrás de Zero Trust (por ejemplo `*.asptienda.com`).

Por defecto `python -m atlas_api` abre **Atlas** en una ventana de escritorio Windows (**WebView2** + React), sin abrir Chrome/Edge como navegador aparte. Opcional: `--browser`, `--tk` (CustomTkinter legacy) o `--no-browser` (solo API). El módulo Atlas VPN incluye **sincronización** desde la API de Cloudflare hacia `scripts/tunnels.json`.

> Los datos locales viven en `.atlas/` (al arrancar se migra automáticamente desde `.atlasvpn/` si existía).

## Requisitos

- **Python 3.10+**
- **Node.js 18+** y `npm` (compilar la UI en `ui/` → `ui/dist/`)
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
python -m atlas_api
```

En la consola web: **Inicio** (resumen), menú **Atlas VPN → Conexiones / Poslite / Cloudflare** (admin).

1. **Atlas VPN → Cloudflare**: Account ID, API Token, sufijo, Zone ID opcional → **Guardar** y **Sincronizar**.
2. **Atlas VPN → Conexiones**: sitio, **Iniciar SSH** / **BD** / terminal web.

**Navegador externo:** `python -m atlas_api --browser`. **Solo API:** `--no-browser`. **Puerto:** `--port 9000`.

### CustomTkinter (legacy)

```powershell
python -m atlas_api --tk
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
| `.atlas/auth.json` | Hash de contraseña |
| `.atlas/settings.json` | Credenciales Cloudflare |
| `scripts/tunnels.json` | Sitios y puertos |
| `.cloudflared-tunnels/state.json` | PIDs de `cloudflared` |

## Docker (desarrollo)

Contenedores `atlas-api` y `atlas-ui`. Imágenes: `backend/Dockerfile` y `ui/Dockerfile` (contexto de build = raíz del repo). Ver `docker-compose.yml` y `.github/workflows/atlas-dev-selfhosted.yml`.

```powershell
docker compose build
docker compose up -d
```

Documentación interactiva del API (tras desplegar `atlas-api`): [https://api-atlas-vpn.verkku.com/swagger](https://api-atlas-vpn.verkku.com/swagger) · esquema OpenAPI en `/openapi.json`.

## Seguridad

- Protege `.atlas/` (tokens sensibles).
- Atlas VPN **no sustituye** Cloudflare Access: `cloudflared` y el navegador siguen pidiendo login cuando corresponda.

## Estructura del repositorio

| Carpeta | Rol |
|---------|-----|
| `backend/atlas_core/` | Auth, usuarios, rutas compartidas |
| `backend/atlas_vpn/` | Módulo Atlas VPN (Cloudflare, túneles, SSH) |
| `backend/atlas_rancher/` | Módulo Atlas Rancher (en preparación) |
| `backend/atlas_api/` | FastAPI + entrada CLI (`python -m atlas_api`) |
| `backend/Dockerfile` | Imagen Docker del API |
| `ui/` | Frontend React + `public/branding/` (logos) |
| `ui/Dockerfile` | Imagen Docker de la UI (nginx) |
| `ui/dist/` | Build de producción (generado) |
| `scripts/` | CLI `tunnel_manager` (cloudflared) |

Detalle: [backend/README.md](backend/README.md).

## Desarrollo

```powershell
python -m py_compile backend\atlas_api\app.py backend\atlas_vpn\cf_sync.py
cd ui && npm run build
```

## Licencia

Uso interno Verkku.
