"""Rutas del proyecto AtlasVPN."""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_DIR.parent
LOGOS_DIR = PROJECT_ROOT / "Logos"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
TUNNELS_JSON = SCRIPTS_DIR / "tunnels.json"
ATLAS_DATA_DIR = PROJECT_ROOT / ".atlasvpn"
AUTH_FILE = ATLAS_DATA_DIR / "auth.json"
SETTINGS_FILE = ATLAS_DATA_DIR / "settings.json"

DEFAULT_LOGO_CANDIDATES = (
    "Logo ATLAS - Sin Fondi.png",
    "Logo ATLAS.png",
    "Logo Atlas Fondo.png",
    "Logo.png",
)


def resolve_logo_path() -> Path | None:
    for name in DEFAULT_LOGO_CANDIDATES:
        p = LOGOS_DIR / name
        if p.is_file():
            return p
    return None
