---
name: atlasvpn
description: >-
  AtlasVPN: app local (CustomTkinter) y CLI para túneles Cloudflare Access TCP
  (cloudflared) a SSH/BD en RPI; sincroniza inventario desde la API Zero Trust
  Access Applications; login PBKDF2 y paleta ATLAS desde Logos/. Use when the
  user mentions AtlasVPN, VPN-Poslite, cloudflared access tcp, sincronizar túneles
  Cloudflare, asptienda.com, o acceso SSH/BD vía Access.
disable-model-invocation: true
---

# AtlasVPN (VPN-Poslite)

## Qué es

- Herramienta **local** (no es VPN clásica): abre listeners TCP en `localhost` con `cloudflared access tcp` hacia aplicaciones **Cloudflare Access** publicadas (SSH y BD en RPI).
- **Nombre de producto**: AtlasVPN. Logos en `Logos/` (p. ej. `Logo ATLAS.png`). UI con **CustomTkinter** y colores en `atlasvpn/theme.py` (azul marino #05193B, pizarra).

## Flujo principal

1. Instalar deps: `pip install -r requirements.txt`.
2. Ejecutar `python -m atlasvpn` o `scripts/launch_atlas_vpn.bat`.
3. **Login**: primera vez crea contraseña local (hash en `.atlasvpn/auth.json`); luego solo verificación local.
4. Pestaña **Cloudflare**: Account ID, API Token (lectura Access/Zero Trust), sufijo de dominio → **Sincronizar** escribe `scripts/tunnels.json` agrupando dominios `*-ssh.<sufijo>` y `*-bd.<sufijo>`.
5. Pestaña **Conexiones**: iniciar/detener túneles; mismo backend que `scripts/tunnel_manager.py`.

## API y sincronización

- Los tokens **Account API** (`cfat_…`) se validan con `accounts/{id}/tokens/verify`, no con `user/tokens/verify` (evita 401 falsos).
- Cliente **`cloudflare`**: `zero_trust.access.applications.list` por `account_id` o por `zone_id` (campo opcional en la UI si 403 por account).
- Tras sync, `tunnels.json` incluye `meta` (fecha, cuenta, apps vistas). Sitios manuales previos se conservan si no entran en el patrón de descubrimiento.

## Reglas para el agente

- No inventar Account ID ni tokens; el usuario los obtiene del dashboard Cloudflare.
- No commitear `.atlasvpn/` ni `scripts/tunnels.json` con datos reales.
- Si falla un túnel, sugerir probar el comando `cloudflared access tcp ...` en terminal para ver errores de Access.
- Para patrones distintos a `*-ssh` / `*-bd`, ampliar regex en `cf_sync.py` con cuidado.

## CLI legacy

- `python scripts/tunnel_manager.py start|stop|status|list-sites|init-config`
- `scripts/tunnel_gui.py` redirige a la misma UI AtlasVPN.

## Referencia

- Documentación detallada: [README.md](../../../README.md) en la raíz del repo.
