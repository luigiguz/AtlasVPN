# AtlasVPN

Aplicación para levantar en tu PC túneles **Cloudflare Access TCP** (`cloudflared access tcp`) hacia **SSH** y **bases de datos** publicadas detrás de Zero Trust (por ejemplo en Raspberry Pi con `*.asptienda.com`).

Por defecto AtlasVPN abre una **ventana de escritorio de Windows** con la UI React dentro del control **WebView2** (el mismo motor que usa Edge, pero **no** se abre Microsoft Edge ni Google Chrome como navegador independiente: es una ventana de aplicación, como muchas apps modernas de Windows). Opcional: `python -m atlasvpn --browser` si quieres usar el navegador instalado, o `--tk` para la interfaz CustomTkinter sin HTML. Incluye **sincronización** desde la **API de Cloudflare** hacia `scripts/tunnels.json`.

## Requisitos

- **Python 3.10+**
- **Node.js 18+** y `npm` (solo para compilar la UI web en `ui/`; una vez hecho `npm run build`, no hace falta Node en el PC de destino si ya incluyes la carpeta `atlasvpn/static/web/`).
- En Windows, la ventana integrada usa **WebView2** (suele venir con el sistema; si falla, instala [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)).
- **`cloudflared`** instalado y en el `PATH` (el mismo que usas en consola).
- Cuenta Cloudflare con **Zero Trust / Access** y aplicaciones publicadas cuyo dominio siga el patrón `NOMBRE-ssh.TUDOMINIO` y `NOMBRE-bd.TUDOMINIO` (por ejemplo `laarena-ssh.asptienda.com` y `laarena-bd.asptienda.com`, sitio agrupado `laarena`).

## Instalación

Desde la raíz del repositorio:

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

La carpeta generada `atlasvpn/static/web/` está en `.gitignore`; sin el `npm run build` la app web no arrancará (el programa mostrará un mensaje indicando compilar la UI).

## Uso rápido

### Interfaz web (recomendado)

```powershell
python -m atlasvpn
```

Se abre una **ventana propia** con la UI (misma URL interna `http://127.0.0.1:8765/`). **Navegador externo:** `python -m atlasvpn --browser`. **Solo API en consola** (tú abres la URL si quieres): `python -m atlasvpn --no-browser`. **Otro puerto:** `python -m atlasvpn --port 9000`.

O en Windows, doble clic en `scripts\launch_atlas_vpn.bat` (debe existir `python` en el PATH).

1. Pestaña **Cloudflare**: introduce **Account ID**, **API Token**, **sufijo** y opcionalmente **Zone ID**. **Guardar** y **Sincronizar** para generar/actualizar `scripts/tunnels.json`.
2. Pestaña **Conexiones**: elige un sitio, **Iniciar SSH** / **BD** / **ambos**, o **Terminal SSH** (usuario fijo `admin@localhost` y el puerto del JSON).

### Interfaz de escritorio (CustomTkinter)

```powershell
python -m atlasvpn --tk
```

1. Pestaña **Cloudflare**: introduce **Account ID**, **API Token** (solo lectura recomendada; ver abajo) y el **sufijo de dominio** (p. ej. `asptienda.com`). Pulsa **Guardar** y luego **Sincronizar ahora** para generar/actualizar `scripts/tunnels.json`.
2. Pestaña **Conexiones**: selecciona un sitio, **Iniciar SSH** / **BD** / **ambos**, y conéctate como siempre (`ssh usuario@localhost -p …` o cliente SQL al puerto local).

### CLI (sin UI)

Sigue disponible `scripts/tunnel_manager.py` (mismo `tunnels.json` y mismo estado en `.cloudflared-tunnels/state.json`).

```powershell
python scripts\tunnel_manager.py list-sites
python scripts\tunnel_manager.py start laarena --services both
python scripts\tunnel_manager.py stop --site laarena
```

## API Token de Cloudflare

Crea un token con permisos de **solo lectura** acordes a tu política, por ejemplo:

- **Account** → **Zero Trust** → **Read** (o permisos equivalentes que permitan listar **Access Applications**).

Al crear el token, en **Account resources** elige **Include** y selecciona **el mismo account** donde está configurado Zero Trust (no basta con permisos “globales” si el recurso no incluye esa cuenta).

**Tokens `cfat_…` (Account API Token):** Cloudflare los valida con `GET /accounts/{account_id}/tokens/verify`, no con `/user/tokens/verify`. AtlasVPN usa el endpoint correcto según el prefijo del token; el **Account ID** debe ser el del account asociado a ese token.

Si la **verificación** va bien pero al sincronizar aparece **403 / Authentication error**, el token **existe** pero no puede listar Access por account. Prueba en este orden: (1) permisos **Zero Trust → Read** y **Access: Apps and Policies → Read** en el token `cfat_`; (2) un **User API Token** (perfil → API Tokens) con los mismos permisos; (3) en AtlasVPN, campo **Zone ID** (Overview de la zona de `asptienda.com`) para listar con `…/zones/{zone_id}/access/apps`.

Si ves **401 Invalid API Token** con un token **sin** prefijo `cfat_`, suele ser token mal copiado, revocado o Global API Key en lugar de API Token.

El programa usa el **SDK oficial de Python** (`pip install cloudflare`): `zero_trust.access.applications.list` con `account_id` o, si indicas Zone ID, con `zone_id`.

`GET https://api.cloudflare.com/client/v4/accounts/{account_id}/access/apps`  
o `GET …/zones/{zone_id}/access/apps` cuando usas Zone ID en la app.

## Archivos locales (no subir al git)

| Ruta | Contenido |
|------|-----------|
| `.atlasvpn/auth.json` | Hash PBKDF2 de la contraseña de la app |
| `.atlasvpn/settings.json` | Account ID, API token, sufijo, Zone ID opcional |
| `scripts/tunnels.json` | Sitios, hostnames y puertos locales (generado o sincronizado) |
| `.cloudflared-tunnels/state.json` | PIDs de procesos `cloudflared` lanzados desde la app/CLI |

Están listados en `.gitignore`.

## Logos y marca

Coloca los PNG de marca en `Logos/` (por ejemplo `Logo ATLAS.png`). La UI los escala para la cabecera y aplica una paleta en tonos **azul marino / pizarra** alineada con esos activos.

## SSH y `known_hosts` (puertos locales)

Si al conectar con `ssh …@localhost -p 2222` ves **REMOTE HOST IDENTIFICATION HAS CHANGED**, suele ser porque **antes** ese mismo puerto apuntaba a **otro** servidor (otra RPi, reinstalación, u otro sitio en `tunnels.json`). OpenSSH compara la clave guardada en `C:\Users\<tu_usuario>\.ssh\known_hosts` con la actual y corta por seguridad.

**Arreglo recomendado** (borra solo la entrada de ese host:puerto):

```powershell
ssh-keygen -R "[localhost]:2222"
```

Luego vuelve a conectar; SSH pedirá confirmar la **nueva** huella la primera vez (léela si confías en la red/túnel). Si usas otros puertos (p. ej. 2224), cambia el número en el comando.

## Seguridad (resumen)

- Los ajustes en **`.atlasvpn/`** (token, IDs) son sensibles: protege el directorio del proyecto y usa **tokens de mínimo privilegio** y rotación periódica.
- AtlasVPN **no sustituye** a Cloudflare Access: el navegador o `cloudflared` seguirán pidiendo login de Access cuando corresponda.

## Desarrollo

```powershell
python -m py_compile atlasvpn\gui_main.py atlasvpn\cf_sync.py scripts\tunnel_manager.py
```

## Licencia

Uso interno del equipo / Verkku — ajusta según tu repositorio.
