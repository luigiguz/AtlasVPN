---
name: atlasvpn
description: >-
  AtlasVPN: app local (CustomTkinter) y CLI para túneles Cloudflare Access TCP
  (cloudflared) a SSH/BD en RPI; sincroniza inventario desde la API Zero Trust
  Access Applications; login web con usuarios/roles (SQLite + sesión) y login
  local PBKDF2 en `.atlasvpn/auth.json` para la ventana `--tk`. Paleta ATLAS
  desde Logos/. UI React/Vite
  sin TanStack; política npm Verkku (Axios comprometidas conocidas). Use when
  the user mentions AtlasVPN, VPN-Poslite, cloudflared access tcp, sincronizar
  túneles Cloudflare, asptienda.com, o acceso SSH/BD vía Access.
disable-model-invocation: true
---

# AtlasVPN (VPN-Poslite)

## Qué es

- Herramienta **local** (no es VPN clásica): abre listeners TCP en `localhost` con `cloudflared access tcp` hacia aplicaciones **Cloudflare Access** publicadas (SSH y BD en RPI).
- **Nombre de producto**: AtlasVPN. Logos en `Logos/` (p. ej. `Logo ATLAS.png`). UI **web** en `ui/` (React + Vite + Tailwind) y opción **CustomTkinter** (`--tk`); paleta en `atlasvpn/theme.py` (azul marino #05193B, pizarra).

## Flujo principal

1. Instalar deps: `pip install -r requirements.txt`.
2. Ejecutar `python -m atlasvpn` o `scripts/launch_atlas_vpn.bat`.
3. **Login (UI web)**: el servidor crea un administrador inicial si la base `.atlasvpn/users.db` está vacía (usuario `ATLASVPN_DEFAULT_ADMIN_USERNAME` o `admin`, contraseña `ATLASVPN_DEFAULT_ADMIN_PASSWORD` o valor inicial documentado en compose). Sesión firmada (`ATLASVPN_SESSION_SECRET` o `.atlasvpn/session.secret`). Roles: `admin`, `operator`, `viewer`. Los administradores gestionan el resto de cuentas en la pestaña **Usuarios**.
4. **Login (`--tk`)**: primera vez contraseña local (PBKDF2 en `.atlasvpn/auth.json`); es independiente del login web hasta que se unifique.
5. Pestaña **Cloudflare**: Account ID, API Token (lectura Access/Zero Trust), sufijo de dominio → **Sincronizar** escribe `scripts/tunnels.json` agrupando dominios `*-ssh.<sufijo>` y `*-bd.<sufijo>`.
6. Pestaña **Conexiones**: iniciar/detener túneles; mismo backend que `scripts/tunnel_manager.py`.

## API y sincronización

- Los tokens **Account API** (`cfat_…`) se validan con `accounts/{id}/tokens/verify`, no con `user/tokens/verify` (evita 401 falsos).
- Cliente **`cloudflare`**: `zero_trust.access.applications.list` por `account_id` o por `zone_id` (campo opcional en la UI si 403 por account).
- Tras sync, `tunnels.json` incluye `meta` (fecha, cuenta, apps vistas). Sitios manuales previos se conservan si no entran en el patrón de descubrimiento.

## UI web (`ui/`)

- Stack actual: **React + Vite + Tailwind + framer-motion + lucide-react** (sin TanStack ni Axios en dependencias directas vigentes).
- Mantener la UI **ligera**; no introducir ecosistemas pesados salvo acuerdo explícito del equipo.

## Cadena de suministro npm (política Verkku)

Hubo un **ataque a la cadena de suministro npm** que comprometió publicaciones de varios mantenedores; entre los ecosistemas citados en comunicados están **TanStack**, paquetes de **Mistral AI**, **UiPath**, **OpenSearch** y **Axios** (versiones **1.14.1** y **0.30.4** mencionadas como afectadas en divulgaciones del incidente).

Reglas para este repo:

- **No usar TanStack** (`@tanstack/*`, p. ej. Query, Router, Table): no añadir estas dependencias salvo que el proyecto documente una excepción tras revisión de seguridad.
- **Axios**: no depender de las versiones **1.14.1** ni **0.30.4**; si en algún momento se añade Axios, fijar versión **fuera** de las filtradas en el advisory correspondiente y comprobar `npm audit` / lockfile.
- Antes de nuevas dependencias npm: preferir paquetes con pocos transitivos, revisar **npm advisory** / GitHub Security, y no actualizar a ciegas si el scope del cambio es solo cosmético.

## Reglas para el agente

- No inventar Account ID ni tokens; el usuario los obtiene del dashboard Cloudflare.
- No commitear `.atlasvpn/` ni `scripts/tunnels.json` con datos reales.
- Si falla un túnel, sugerir probar el comando `cloudflared access tcp ...` en terminal para ver errores de Access.
- Para patrones distintos a `*-ssh` / `*-bd`, ampliar regex en `cf_sync.py` con cuidado.
- Cumplir la sección **Cadena de suministro npm** al tocar `ui/package.json` o `package-lock.json`.

## CLI legacy

- `python scripts/tunnel_manager.py start|stop|status|list-sites|init-config`
- `scripts/tunnel_gui.py` redirige a la misma UI AtlasVPN.

## Referencia

- Documentación detallada: [README.md](../../../README.md) en la raíz del repo.
