"""Cliente HTTP para la API Steve / Rancher."""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from typing import Any

STEVE_CUSTOM_CLUSTER_PATHS = (
    "v1/provisioning.cattle.io.customclusters",
    "v1/provisioning.cattle.io.customcluster",
)
STEVE_PROVISIONING_CLUSTERS = "v1/provisioning.cattle.io.clusters"
RANCHER_HTTP_TIMEOUT_S = 12.0


class RancherConfigError(Exception):
    pass


class RancherApiError(Exception):
    def __init__(self, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def _ssl_context(insecure: bool) -> ssl.SSLContext:
    if insecure:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context()


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def rancher_get(
    url: str,
    token: str,
    path: str,
    *,
    insecure_tls: bool = False,
    timeout_s: float = RANCHER_HTTP_TIMEOUT_S,
) -> Any:
    if not url or not token:
        raise RancherConfigError("Configura la URL y el token de Rancher (Atlas Rancher o variables ATLAS_RANCHER_*).")
    full = f"{url.rstrip('/')}/{path.lstrip('/')}"
    req = urllib.request.Request(
        full,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s, context=_ssl_context(insecure_tls)) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")[:500]
        except OSError:
            pass
        raise RancherApiError(
            f"Rancher respondió HTTP {e.code} en {path}" + (f": {body}" if body else ""),
            status=e.code,
        ) from e
    except urllib.error.URLError as e:
        raise RancherApiError(f"No se pudo conectar con Rancher: {e.reason}") from e

    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise RancherApiError("La respuesta de Rancher no es JSON válido.") from e


def _collect_items(payload: Any) -> list[dict[str, Any]] | None:
    if not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if payload.get("type") and payload.get("id"):
        return [payload]
    return []


def _resource_kind(item: dict[str, Any]) -> str:
    kind = str(item.get("kind") or "").strip()
    if kind:
        return kind
    rtype = str(item.get("type") or "").strip()
    if "." in rtype:
        return rtype.rsplit(".", 1)[-1]
    return rtype


def _is_custom_cluster_resource(item: dict[str, Any]) -> bool:
    kind = _resource_kind(item).lower()
    if kind in ("customcluster", "customclusters"):
        return True
    rtype = str(item.get("type") or "").lower()
    return "customcluster" in rtype


def _is_provisioning_custom_cluster(item: dict[str, Any]) -> bool:
    if _is_custom_cluster_resource(item):
        return True
    spec = item.get("spec")
    if not isinstance(spec, dict):
        return False
    if spec.get("cloudCredentialSecretName"):
        return False
    rke = spec.get("rkeConfig")
    if isinstance(rke, dict):
        pools = rke.get("machinePools")
        if isinstance(pools, list) and len(pools) > 0:
            return False
    imported = spec.get("importedConfig")
    if isinstance(imported, dict) and imported:
        return False
    return bool(spec.get("kubernetesVersion") or rke)


def _condition_state(item: dict[str, Any]) -> str:
    status = item.get("status")
    if not isinstance(status, dict):
        return "unknown"
    for key in ("summary", "displayState", "state"):
        v = status.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    conditions = status.get("conditions")
    if isinstance(conditions, list):
        for c in conditions:
            if not isinstance(c, dict):
                continue
            if c.get("type") == "Ready" and c.get("status") == "True":
                return "ready"
            if c.get("type") == "Ready" and c.get("status") == "False":
                return str(c.get("reason") or c.get("message") or "not-ready")
    if status.get("ready") is True:
        return "ready"
    return "unknown"


def _normalize_cluster(item: dict[str, Any]) -> dict[str, Any]:
    meta = _as_dict(item.get("metadata"))
    spec = _as_dict(item.get("spec"))
    status = _as_dict(item.get("status"))
    annotations = _as_dict(meta.get("annotations"))
    labels = _as_dict(meta.get("labels"))
    name = str(meta.get("name") or item.get("name") or item.get("id") or "")
    namespace = str(meta.get("namespace") or item.get("namespaceId") or "fleet-default")
    k8s = str(spec.get("kubernetesVersion") or "")
    display = (
        annotations.get("provisioning.cattle.io/management-cluster-display-name")
        or labels.get("app.kubernetes.io/name")
        or name
    )
    ready: bool | None = None
    if "ready" in status:
        ready = bool(status.get("ready"))
    return {
        "id": str(item.get("id") or f"{namespace}/{name}"),
        "name": name,
        "namespace": namespace,
        "displayName": str(display),
        "state": _condition_state(item),
        "kubernetesVersion": k8s,
        "ready": ready,
        "kind": _resource_kind(item),
        "createdAt": meta.get("creationTimestamp"),
    }


def _is_connection_error(err: RancherApiError) -> bool:
    if err.status is not None:
        return False
    msg = str(err).lower()
    return "conectar" in msg or "timed out" in msg or "timeout" in msg


def list_custom_clusters(settings: dict[str, str]) -> tuple[str, list[dict[str, Any]]]:
    url = settings["url"]
    token = settings["token"]
    insecure = bool(settings.get("insecure_tls"))

    for path in STEVE_CUSTOM_CLUSTER_PATHS:
        try:
            payload = rancher_get(url, token, path, insecure_tls=insecure)
        except RancherApiError as e:
            if e.status == 404:
                continue
            if _is_connection_error(e):
                raise
            raise
        items = _collect_items(payload)
        if items is not None:
            normalized = [_normalize_cluster(i) for i in items if _is_custom_cluster_resource(i)]
            return path, normalized

    try:
        payload = rancher_get(url, token, STEVE_PROVISIONING_CLUSTERS, insecure_tls=insecure)
    except RancherApiError as e:
        if _is_connection_error(e):
            raise RancherApiError(
                f"No se pudo alcanzar Rancher en {url}. "
                "Comprueba URL, token, TLS (insecure) y que el servidor Atlas pueda salir a esa red."
            ) from e
        raise
    items = _collect_items(payload) or []
    filtered = [i for i in items if _is_provisioning_custom_cluster(i)]
    return f"{STEVE_PROVISIONING_CLUSTERS}?filter=custom", [_normalize_cluster(i) for i in filtered]
