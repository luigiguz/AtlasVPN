"""Configuración Cloudflare (token API, cuenta, sufijo de dominio)."""

from __future__ import annotations

import json
from pathlib import Path

from atlasvpn.cf_credentials import normalize_account_id, normalize_api_token
from atlasvpn.paths import ATLAS_DATA_DIR, SETTINGS_FILE


def load_settings() -> dict:
    if not SETTINGS_FILE.is_file():
        return {
            "account_id": "",
            "api_token": "",
            "domain_suffix": "asptienda.com",
            "zone_id": "",
        }
    with SETTINGS_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return {
        "account_id": normalize_account_id(str(data.get("account_id", ""))),
        "api_token": normalize_api_token(str(data.get("api_token", ""))),
        "domain_suffix": str(data.get("domain_suffix", "asptienda.com")).strip() or "asptienda.com",
        "zone_id": normalize_account_id(str(data.get("zone_id", ""))),
    }


def save_settings(
    account_id: str, api_token: str, domain_suffix: str, zone_id: str = ""
) -> None:
    ATLAS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    blob = {
        "account_id": normalize_account_id(account_id),
        "api_token": normalize_api_token(api_token),
        "domain_suffix": (domain_suffix or "asptienda.com").strip(),
        "zone_id": normalize_account_id(zone_id),
    }
    with SETTINGS_FILE.open("w", encoding="utf-8") as f:
        json.dump(blob, f, indent=2)
