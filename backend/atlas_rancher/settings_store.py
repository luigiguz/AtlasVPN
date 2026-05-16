"""Configuración de conexión a Rancher (URL + token API)."""

from __future__ import annotations

import json

from atlas_core.env import atlas_env
from atlas_core.paths import ATLAS_DATA_DIR, ensure_atlas_data_dir

RANCHER_SETTINGS_FILE = ATLAS_DATA_DIR / "rancher.json"


def load_rancher_settings() -> dict[str, str]:
    file_cfg = {
        "url": "",
        "token": "",
        "insecure_tls": False,
    }
    if RANCHER_SETTINGS_FILE.is_file():
        try:
            with RANCHER_SETTINGS_FILE.open(encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            data = {}
        file_cfg["url"] = str(data.get("url", "")).strip().rstrip("/")
        file_cfg["token"] = str(data.get("token", "")).strip()
        file_cfg["insecure_tls"] = bool(data.get("insecure_tls", False))

    url = atlas_env("RANCHER_URL") or file_cfg["url"]
    token = atlas_env("RANCHER_TOKEN") or file_cfg["token"]
    insecure = atlas_env("RANCHER_INSECURE_TLS").lower() in ("1", "true", "yes") or file_cfg["insecure_tls"]
    return {"url": url.strip().rstrip("/"), "token": token.strip(), "insecure_tls": insecure}


def save_rancher_settings(url: str, token: str, insecure_tls: bool = False) -> None:
    ensure_atlas_data_dir()
    blob = {
        "url": url.strip().rstrip("/"),
        "token": token.strip(),
        "insecure_tls": bool(insecure_tls),
    }
    with RANCHER_SETTINGS_FILE.open("w", encoding="utf-8") as f:
        json.dump(blob, f, indent=2)
