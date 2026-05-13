#!/usr/bin/env python3
"""Compatibilidad: abre AtlasVPN (antes tunnel_gui)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from atlasvpn.__main__ import main

if __name__ == "__main__":
    main()
