"""Router FastAPI de Atlas Rancher."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from atlas_core.web_auth import current_user, require_roles
from atlas_rancher.client import (
    RancherApiError,
    RancherConfigError,
    list_custom_clusters,
)
from atlas_rancher.settings_store import load_rancher_settings, save_rancher_settings

router = APIRouter(prefix="/api/atlas-rancher", tags=["atlas-rancher"])


class RancherSettingsBody(BaseModel):
    url: str = ""
    token: str = ""
    insecure_tls: bool = False


@router.get("/health")
def rancher_health() -> dict[str, str]:
    return {"module": "atlas-rancher", "status": "ok"}


@router.get("/settings")
def get_rancher_settings(user: dict[str, Any] = Depends(require_roles("admin"))) -> dict[str, Any]:
    s = load_rancher_settings()
    return {
        "url": s["url"],
        "token": s["token"],
        "insecure_tls": s["insecure_tls"],
        "configured": bool(s["url"] and s["token"]),
    }


@router.post("/settings")
def post_rancher_settings(
    body: RancherSettingsBody,
    _admin: dict[str, Any] = Depends(require_roles("admin")),
) -> dict[str, bool]:
    if not body.url.strip() or not body.token.strip():
        raise HTTPException(400, "URL y token de Rancher son obligatorios.")
    save_rancher_settings(body.url, body.token, body.insecure_tls)
    return {"ok": True}


@router.get("/custom-clusters")
def get_custom_clusters(
    _user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    settings = load_rancher_settings()
    try:
        source, clusters = list_custom_clusters(settings)
    except RancherConfigError as e:
        raise HTTPException(400, str(e)) from e
    except RancherApiError as e:
        raise HTTPException(502, str(e)) from e
    return {
        "ok": True,
        "source": source,
        "rancherUrl": settings["url"],
        "count": len(clusters),
        "clusters": clusters,
    }
