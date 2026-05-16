"""Router FastAPI de Atlas Rancher (próximamente)."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/atlas-rancher", tags=["atlas-rancher"])


@router.get("/health")
def rancher_health() -> dict[str, str]:
    return {"module": "atlas-rancher", "status": "not_implemented"}
