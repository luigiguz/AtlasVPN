"""Servidor local FastAPI + estáticos React para la UI web de AtlasVPN."""

from __future__ import annotations

import asyncio
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from atlasvpn.cf_sync import CfSyncError, sync_to_tunnels_json
from atlasvpn.constants import SSH_LOCAL_USER
from atlasvpn.pgadmin_launch import launch_pgadmin
from atlasvpn.poslite_urls import poslite_links_for_site
from atlasvpn.paths import PACKAGE_DIR, PROJECT_ROOT, resolve_logo_path
from atlasvpn.settings_store import load_settings, save_settings

_SCRIPTS = PROJECT_ROOT / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
import tunnel_manager as tm

STATIC_WEB = PACKAGE_DIR / "static" / "web"


def _wait_tcp(host: str, port: int, timeout: float = 20.0) -> None:
    deadline = time.monotonic() + timeout
    last_err: OSError | None = None
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return
        except OSError as e:
            last_err = e
            time.sleep(0.06)
    msg = f"No arrancó el servidor en http://{host}:{port}/"
    if last_err:
        msg += f" ({last_err})"
    raise RuntimeError(msg)


class StartBody(BaseModel):
    site: str
    services: Literal["ssh", "db", "both"] = "both"


class StopBody(BaseModel):
    site: str | None = None
    label: str | None = None


class SyncBody(BaseModel):
    account_id: str
    api_token: str
    domain_suffix: str = "asptienda.com"
    zone_id: str = ""


class SettingsBody(BaseModel):
    account_id: str = ""
    api_token: str = ""
    domain_suffix: str = "asptienda.com"
    zone_id: str = ""


class OpenSshBody(BaseModel):
    site: str


class OpenPgAdminBody(BaseModel):
    """Sitio opcional: si tiene BD en tunnels.json, se devuelve pista host/puerto local."""

    site: str = ""


def _proc_for_site_label(state: dict, site: str, label: str) -> dict | None:
    for row in state.get("processes", []):
        if row.get("site") == site and row.get("label") == label:
            return row
    return None


def _state_label(row: dict | None) -> str:
    if not row:
        return "idle"
    pid = int(row["pid"])
    return "active" if tm.pid_alive(pid) else "dead"


def _sites_payload(config_path: Path) -> dict[str, Any]:
    cfg = tm.load_config_optional(config_path)
    settings = load_settings()
    domain_suffix = str(settings.get("domain_suffix") or "asptienda.com").strip() or "asptienda.com"
    if not cfg:
        return {
            "configPath": str(config_path),
            "domainSuffix": domain_suffix,
            "sites": [],
        }
    state = tm.read_state()
    root_pd = (
        cfg.get("poslite_defaults")
        if isinstance(cfg.get("poslite_defaults"), dict)
        else None
    )
    sites_out: list[dict[str, Any]] = []
    for name in sorted((cfg.get("sites") or {}).keys()):
        e = (cfg.get("sites") or {})[name]
        if not isinstance(e, dict):
            continue
        ssh = e.get("ssh") if isinstance(e.get("ssh"), dict) else None
        db = e.get("db") if isinstance(e.get("db"), dict) else None
        pr_ssh = _proc_for_site_label(state, name, "ssh")
        pr_db = _proc_for_site_label(state, name, "db")
        portal_links = poslite_links_for_site(name, domain_suffix, e, root_pd)
        sites_out.append(
            {
                "id": name,
                "name": name,
                "ssh": ssh,
                "db": db,
                "sshStatus": _state_label(pr_ssh),
                "dbStatus": _state_label(pr_db),
                "posliteUrls": portal_links,
            }
        )
    return {
        "configPath": str(config_path),
        "domainSuffix": domain_suffix,
        "sites": sites_out,
    }


def create_app() -> FastAPI:
    app = FastAPI(title="AtlasVPN", version="1.0")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/logo")
    def logo() -> FileResponse:
        p = resolve_logo_path()
        if not p or not p.is_file():
            raise HTTPException(404, "Sin logo")
        return FileResponse(p, media_type="image/png")

    @app.get("/api/settings")
    def get_settings() -> dict[str, str]:
        s = load_settings()
        return {
            "account_id": s.get("account_id", ""),
            "api_token": s.get("api_token", ""),
            "domain_suffix": s.get("domain_suffix", "asptienda.com"),
            "zone_id": s.get("zone_id", ""),
        }

    @app.post("/api/settings")
    def post_settings(body: SettingsBody) -> dict[str, str]:
        save_settings(
            body.account_id,
            body.api_token,
            body.domain_suffix or "asptienda.com",
            body.zone_id,
        )
        return {"ok": "true"}

    @app.get("/api/sites")
    def get_sites() -> dict[str, Any]:
        return _sites_payload(tm.default_config_path())

    @app.post("/api/start")
    def post_start(body: StartBody) -> dict[str, Any]:
        ok, lines = tm.start_site_services(
            body.site, body.services, tm.default_config_path()
        )
        return {"ok": ok, "lines": lines}

    @app.post("/api/stop")
    def post_stop(body: StopBody) -> dict[str, Any]:
        if body.label and body.site is None:
            raise HTTPException(
                status_code=400,
                detail="Para detener solo SSH o BD indica también el sitio (site).",
            )
        if body.label is not None and body.label not in ("ssh", "db"):
            raise HTTPException(status_code=400, detail='label debe ser "ssh" o "db".')
        lines = tm.stop_tunnels(body.site, body.label)
        return {"ok": True, "lines": lines}

    @app.post("/api/sync")
    def post_sync(body: SyncBody) -> dict[str, Any]:
        try:
            n, msg = sync_to_tunnels_json(
                body.account_id,
                body.api_token,
                body.domain_suffix or "asptienda.com",
                tm.default_config_path(),
                zone_id=body.zone_id.strip(),
            )
            return {"ok": True, "sitesCount": n, "message": msg}
        except CfSyncError as e:
            return JSONResponse(
                status_code=400, content={"ok": False, "message": str(e)}
            )

    @app.post("/api/init-template")
    def post_init() -> dict[str, Any]:
        ok, msg = tm.init_config_from_example()
        return {"ok": ok, "message": msg}

    @app.post("/api/open-ssh-terminal")
    def post_open_ssh(body: OpenSshBody) -> dict[str, Any]:
        cfg = tm.load_config_optional(tm.default_config_path())
        if not cfg:
            raise HTTPException(400, "Sin tunnels.json")
        entry = (cfg.get("sites") or {}).get(body.site) or {}
        ssh = entry.get("ssh")
        if not isinstance(ssh, dict) or ssh.get("local_port") in (None, ""):
            raise HTTPException(400, "Sitio sin SSH")
        try:
            port = int(ssh["local_port"])
        except (TypeError, ValueError) as e:
            raise HTTPException(400, "Puerto inválido") from e
        user = SSH_LOCAL_USER
        try:
            if sys.platform == "win32":
                wt = shutil.which("wt")
                if wt:
                    subprocess.Popen(
                        [
                            wt,
                            "new-tab",
                            "--title",
                            f"SSH {body.site}",
                            "ssh",
                            f"{user}@localhost",
                            "-p",
                            str(port),
                        ],
                        cwd=str(Path.home()),
                    )
                else:
                    creationflags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
                    subprocess.Popen(
                        ["ssh", f"{user}@localhost", "-p", str(port)],
                        creationflags=creationflags,
                    )
            elif sys.platform == "darwin":
                cmd = f"ssh {user}@localhost -p {port}"
                subprocess.Popen(["osascript", "-e", f'tell app "Terminal" to do script "{cmd}"'])
            else:
                if shutil.which("gnome-terminal"):
                    subprocess.Popen(
                        ["gnome-terminal", "--", "ssh", f"{user}@localhost", "-p", str(port)]
                    )
                elif shutil.which("konsole"):
                    subprocess.Popen(
                        ["konsole", "-e", f"ssh {user}@localhost -p {port}"]
                    )
                elif shutil.which("x-terminal-emulator"):
                    subprocess.Popen(
                        ["x-terminal-emulator", "-e", f"ssh {user}@localhost -p {port}"]
                    )
                else:
                    raise HTTPException(500, "No hay terminal gráfica")
        except OSError as e:
            raise HTTPException(500, str(e)) from e
        return {"ok": True, "command": f"ssh {user}@localhost -p {port}"}

    @app.post("/api/open-pgadmin")
    def post_open_pgadmin(body: OpenPgAdminBody) -> dict[str, Any]:
        hint: str | None = None
        site = (body.site or "").strip()
        if site:
            cfg = tm.load_config_optional(tm.default_config_path())
            if cfg:
                entry = (cfg.get("sites") or {}).get(site) or {}
                db = entry.get("db")
                if isinstance(db, dict) and db.get("local_port") not in (None, ""):
                    try:
                        port = int(db["local_port"])
                    except (TypeError, ValueError):
                        pass
                    else:
                        hint = (
                            f"Conexión sugerida para «{site}»: host 127.0.0.1, puerto {port} "
                            "(con el túnel BD activo)."
                        )
        ok, msg = launch_pgadmin()
        if not ok:
            raise HTTPException(status_code=400, detail=msg)
        return {"ok": True, "executable": msg, "hint": hint}

    if STATIC_WEB.is_dir() and (STATIC_WEB / "index.html").is_file():
        assets_dir = STATIC_WEB / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/")
        def index() -> FileResponse:
            return FileResponse(STATIC_WEB / "index.html")

        @app.get("/favicon.ico")
        def fav() -> FileResponse:
            p = resolve_logo_path()
            if p and p.is_file():
                return FileResponse(p)
            raise HTTPException(404)

    return app


def run_web_desktop(host: str = "127.0.0.1", port: int = 8765) -> None:
    """Ventana de escritorio (WebView2 / pywebview) con la misma UI React; sin navegador externo."""
    if not (STATIC_WEB / "index.html").is_file():
        print(
            "AtlasVPN (web): no se encontró la UI compilada.\n"
            f"  Esperado: {STATIC_WEB / 'index.html'}\n"
            "  Ejecuta en la carpeta ui/:  npm install && npm run build\n",
            file=sys.stderr,
        )
        sys.exit(2)
    try:
        import webview
    except ImportError as e:
        print(
            "Falta el paquete pywebview (ventana integrada).\n"
            "  pip install pywebview\n"
            "  O usa: python -m atlasvpn --browser\n",
            file=sys.stderr,
        )
        raise SystemExit(2) from e

    import uvicorn

    app = create_app()
    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)

    def _serve() -> None:
        asyncio.run(server.serve())

    thread = threading.Thread(target=_serve, daemon=True)
    thread.start()
    try:
        _wait_tcp(host, port)
    except RuntimeError as err:
        print(str(err), file=sys.stderr)
        server.should_exit = True
        thread.join(timeout=6.0)
        sys.exit(2)

    url = f"http://{host}:{port}/"
    webview.create_window(
        "AtlasVPN",
        url,
        width=1220,
        height=800,
        min_size=(720, 520),
        resizable=True,
    )
    print(
        "AtlasVPN: ventana de escritorio Windows (motor WebView2 integrado).\n"
        "         No se abre Chrome ni Edge como navegador; es una ventana propia de la app.\n"
        f"         Origen local: {url}"
    )
    try:
        if sys.platform == "win32":
            webview.start(debug=False, gui="edgechromium")
        else:
            webview.start(debug=False)
    except Exception as exc:
        print(
            f"Aviso: no se pudo usar WebView2 explícito ({exc}); probando interfaz gráfica por defecto.",
            file=sys.stderr,
        )
        webview.start(debug=False)
    server.should_exit = True
    thread.join(timeout=12.0)


def run_web_server(host: str = "127.0.0.1", port: int = 8765, open_browser: bool = True) -> None:
    if not (STATIC_WEB / "index.html").is_file():
        print(
            "AtlasVPN (web): no se encontró la UI compilada.\n"
            f"  Esperado: {STATIC_WEB / 'index.html'}\n"
            "  Ejecuta en la carpeta ui/:  npm install && npm run build\n",
            file=sys.stderr,
        )
        sys.exit(2)
    import uvicorn

    app = create_app()
    url = f"http://{host}:{port}/"
    if open_browser:

        def _open() -> None:
            webbrowser.open(url)

        threading.Timer(0.6, _open).start()
    print(f"AtlasVPN web: {url} (Ctrl+C para salir)")
    uvicorn.run(app, host=host, port=port, log_level="warning")
