"""Punto de entrada: python -m atlasvpn"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
_scripts = _ROOT / "scripts"
if str(_scripts) not in sys.path:
    sys.path.insert(0, str(_scripts))


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description=(
            "AtlasVPN: por defecto abre una ventana de escritorio Windows (WebView2 + React), "
            "sin abrir Chrome/Edge como navegador."
        )
    )
    parser.add_argument(
        "--tk",
        action="store_true",
        help="Interfaz CustomTkinter (sin React)",
    )
    ui = parser.add_mutually_exclusive_group()
    ui.add_argument(
        "--browser",
        action="store_true",
        help="Abrir la UI en Chrome/Edge como navegador (no usar ventana integrada)",
    )
    ui.add_argument(
        "--no-browser",
        action="store_true",
        help="Solo servidor local en consola (sin ventana integrada ni abrir navegador)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8765,
        metavar="N",
        help="Puerto del servidor local (default 8765)",
    )
    args = parser.parse_args()
    if args.tk:
        from atlasvpn.gui_main import run_app

        run_app()
    elif args.browser:
        from atlasvpn.web_server import run_web_server

        run_web_server(open_browser=True, port=args.port)
    elif args.no_browser:
        from atlasvpn.web_server import run_web_server

        run_web_server(open_browser=False, port=args.port)
    else:
        from atlasvpn.web_server import run_web_desktop

        run_web_desktop(port=args.port)


if __name__ == "__main__":
    main()
