"""Usuarios web AtlasVPN (SQLite + Argon2id)."""

from __future__ import annotations

import re
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from atlasvpn.paths import ATLAS_DATA_DIR

_db_lock = threading.Lock()
_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)

USER_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
ROLES = frozenset({"admin", "operator", "viewer"})


def users_db_path() -> Path:
    ATLAS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    return ATLAS_DATA_DIR / "users.db"


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(str(users_db_path()), timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _db_lock, _conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin','operator','viewer')),
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_web (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts INTEGER NOT NULL,
                username TEXT,
                event TEXT NOT NULL,
                detail TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_web(ts);
            """
        )


def count_users() -> int:
    init_db()
    with _db_lock, _conn() as c:
        row = c.execute("SELECT COUNT(*) AS n FROM users").fetchone()
        return int(row["n"]) if row else 0


def audit(event: str, username: str | None = None, detail: str = "") -> None:
    try:
        with _db_lock, _conn() as c:
            c.execute(
                "INSERT INTO audit_web (ts, username, event, detail) VALUES (?,?,?,?)",
                (int(time.time()), username or "", event, detail[:2000]),
            )
    except Exception:
        pass


def create_user(username: str, password: str, role: str) -> None:
    if role not in ROLES:
        raise ValueError("Rol inválido.")
    u = username.strip()
    if not USER_RE.match(u):
        raise ValueError("Usuario: 3-32 caracteres, solo letras, números y guión bajo.")
    if len(password) < 12:
        raise ValueError("La contraseña debe tener al menos 12 caracteres.")
    h = _ph.hash(password)
    key = u.lower()
    with _db_lock, _conn() as c:
        try:
            c.execute(
                "INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)",
                (key, h, role, int(time.time())),
            )
        except sqlite3.IntegrityError as e:
            raise ValueError("Ese nombre de usuario ya existe.") from e
    audit("user_created", key, role)


def verify_login(username: str, password: str) -> dict[str, Any] | None:
    init_db()
    key = username.strip().lower()
    with _db_lock, _conn() as c:
        row = c.execute(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            (key,),
        ).fetchone()
    if not row:
        time.sleep(0.55)
        return None
    try:
        _ph.verify(row["password_hash"], password)
        if _ph.check_needs_rehash(row["password_hash"]):
            new_h = _ph.hash(password)
            with _db_lock, _conn() as c2:
                c2.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    (new_h, row["id"]),
                )
    except (VerifyMismatchError, InvalidHashError):
        time.sleep(0.55)
        return None
    return {"id": int(row["id"]), "username": row["username"], "role": row["role"]}
