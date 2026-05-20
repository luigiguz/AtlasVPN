"""Normalización de labels Rancher (application, distro) para Atlas."""

from __future__ import annotations

DISTRO_CANONICAL: dict[str, str] = {
    "pam": "Pam",
    "horustech": "Horustech",
}

APPLICATION_CANONICAL: dict[str, str] = {
    "poslite": "Poslite",
}

# Distribuciones válidas cuando application=Poslite
POSLITE_DISTROS: frozenset[str] = frozenset({"Pam", "Horustech"})


def normalize_distro(raw: str) -> str:
    low = str(raw or "").strip().lower()
    if not low:
        return ""
    return DISTRO_CANONICAL.get(low, low[:1].upper() + low[1:])


def normalize_application(raw: str) -> str:
    low = str(raw or "").strip().lower()
    if not low:
        return ""
    return APPLICATION_CANONICAL.get(low, low[:1].upper() + low[1:])


def is_poslite_application(app: str) -> bool:
    return normalize_application(app) == "Poslite"


def is_valid_poslite_distro(distro: str) -> bool:
    return normalize_distro(distro) in POSLITE_DISTROS
