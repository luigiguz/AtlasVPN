import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ChevronsUp,
  Copy,
  GripVertical,
  Minus,
  Move,
  PanelBottomOpen,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";

import { getAccessToken, wsUrl } from "./apiClient";

export type SshWebSession = { id: string; site: string; minimized: boolean };

type DockProps = {
  sessions: SshWebSession[];
  activeId: string | null;
  setSessions: Dispatch<SetStateAction<SshWebSession[]>>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
};

type PaneProps = {
  site: string;
  sessionId: string;
  visible: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onSshSessionEnd?: () => void;
};

function SshSessionPane({
  site,
  sessionId,
  visible,
  onClose,
  onMinimize,
  onSshSessionEnd,
}: PaneProps): ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const [cmd, setCmd] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; canCopy: boolean } | null>(null);
  const sshEndedRef = useRef(false);
  const onSshEndRef = useRef(onSshSessionEnd);
  onSshEndRef.current = onSshSessionEnd;

  const refit = useCallback(() => {
    const t = termRef.current;
    const fit = fitRef.current;
    const el = wrapRef.current;
    if (!t || !fit || !el || !visibleRef.current) return;
    try {
      fit.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: t.cols, rows: t.rows }));
      }
    } catch {
      /* layout aún sin medidas */
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => {
      refit();
      termRef.current?.scrollToBottom();
    });
    return () => cancelAnimationFrame(id);
  }, [visible, refit]);

  useEffect(() => {
    if (!visible) setCtxMenu(null);
  }, [visible]);

  useEffect(() => {
    if (!ctxMenu) return;
    const dismissMouse = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-ssh-ctx-menu]")) return;
      setCtxMenu(null);
    };
    const dismissScroll = () => setCtxMenu(null);
    window.addEventListener("mousedown", dismissMouse, true);
    window.addEventListener("scroll", dismissScroll, true);
    return () => {
      window.removeEventListener("mousedown", dismissMouse, true);
      window.removeEventListener("scroll", dismissScroll, true);
    };
  }, [ctxMenu]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setFatal("No hay token de sesión. Vuelve a iniciar sesión.");
      return;
    }

    const q = new URLSearchParams({ site, token });
    const ws = new WebSocket(`${wsUrl("/api/ws/ssh-terminal")}?${q.toString()}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      scrollback: 50_000,
      windowsMode: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      theme: {
        background: "#0a0a0b",
        foreground: "#e4e4e7",
        cursor: "#fafafa",
        black: "#18181b",
        brightBlack: "#52525b",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#fafafa",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde047",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#ffffff",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    const enc = new TextEncoder();
    const dec = new TextDecoder("utf-8", { fatal: false });

    let scrollRaf = 0;
    const scrollBottom = () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        term.scrollToBottom();
      });
    };

    const pasteFromClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && ws.readyState === WebSocket.OPEN) term.paste(text);
      } catch {
        setBanner("No se pudo leer el portapapeles (permiso del navegador).");
      }
    };

    const copySelection = async () => {
      const s = term.getSelection();
      if (!s) return;
      try {
        await navigator.clipboard.writeText(s);
        setBanner("Selección copiada.");
      } catch {
        setBanner("No se pudo copiar al portapapeles.");
      }
    };

    sshEndedRef.current = false;

    term.attachCustomKeyEventHandler((ev: KeyboardEvent) => {
      if (ev.type !== "keydown") return true;
      const mod = ev.ctrlKey || ev.metaKey;
      const key = ev.key;
      /* Ctrl/Cmd+C con selección → copiar; sin selección → Ctrl+C al shell (SIGINT) */
      if (mod && (key === "c" || key === "C")) {
        if (term.hasSelection()) {
          void copySelection();
          return false;
        }
        return true;
      }
      /* Ctrl/Cmd+V → pegar desde el portapapeles */
      if (mod && (key === "v" || key === "V")) {
        void pasteFromClipboard();
        return false;
      }
      if (ev.shiftKey && ev.key === "Insert") {
        void pasteFromClipboard();
        return false;
      }
      return true;
    });

    const el = wrapRef.current;
    if (!el) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
      setFatal("No se pudo inicializar el contenedor del terminal.");
      return;
    }

    term.open(el);
    const termEl = term.element;
    if (!termEl) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
      setFatal("No se pudo crear la superficie del terminal.");
      return;
    }
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain");
      if (text && ws.readyState === WebSocket.OPEN) term.paste(text);
    };
    termEl.addEventListener("paste", onPaste);

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const pad = 8;
      const mw = 168;
      const mh = 80;
      let x = Math.min(e.clientX, window.innerWidth - mw - pad);
      let y = Math.min(e.clientY, window.innerHeight - mh - pad);
      x = Math.max(pad, x);
      y = Math.max(pad, y);
      setCtxMenu({
        x,
        y,
        canCopy: term.getSelection().length > 0,
      });
    };
    termEl.addEventListener("contextmenu", onContextMenu);

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      refit();
    });
    ro.observe(el);

    term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(enc.encode(d));
    });

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          const j = JSON.parse(ev.data) as { type?: string; message?: string; command?: string };
          if (j.type === "ssh_exit") {
            sshEndedRef.current = true;
            setCtxMenu(null);
            onSshEndRef.current?.();
            return;
          }
          if (j.type === "error") setFatal(j.message || "Error del servidor");
          if (j.type === "auth_hint" && j.message) setBanner(j.message);
          if (j.type === "ready" && j.command) setCmd(j.command);
        } catch {
          /* ignore */
        }
        return;
      }
      if (ev.data instanceof ArrayBuffer) {
        term.write(dec.decode(new Uint8Array(ev.data)));
        scrollBottom();
      }
    };

    ws.onerror = () => {
      if (!sshEndedRef.current) setBanner("Error de red en el WebSocket.");
    };
    ws.onclose = () => {
      if (sshEndedRef.current) return;
      setBanner((b) => b || "Conexión cerrada.");
    };

    const onWinResize = () => refit();
    window.addEventListener("resize", onWinResize);
    refit();

    return () => {
      window.removeEventListener("resize", onWinResize);
      ro.disconnect();
      termEl.removeEventListener("paste", onPaste);
      termEl.removeEventListener("contextmenu", onContextMenu);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [site, sessionId, refit]);

  useEffect(() => {
    if (visible) termRef.current?.focus();
  }, [visible]);

  const copyCmd = async () => {
    if (!cmd || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setBanner("Comando copiado al portapapeles.");
    } catch {
      setBanner("No se pudo copiar (permisos del navegador).");
    }
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${visible ? "flex" : "hidden"}`}
      aria-hidden={!visible}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TerminalIcon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <span className="truncate font-mono text-xs text-emerald-300">{site}</span>
        </div>
        <div className="flex items-center gap-1">
          {cmd ? (
            <button
              type="button"
              onClick={() => void copyCmd()}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 ring-1 ring-zinc-600 hover:bg-zinc-700"
            >
              <Copy className="h-3 w-3" />
              Comando
            </button>
          ) : null}
          <button
            type="button"
            title="Minimizar esta sesión (sigue en segundo plano)"
            onClick={onMinimize}
            className="inline-flex items-center rounded-md bg-zinc-800 p-1.5 text-zinc-200 ring-1 ring-zinc-600 hover:bg-zinc-700"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Cerrar sesión SSH"
            onClick={onClose}
            className="inline-flex items-center rounded-md bg-zinc-800 p-1.5 text-rose-200 ring-1 ring-zinc-600 hover:bg-rose-950/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      {banner && !fatal ? (
        <div className="shrink-0 border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">{banner}</div>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden p-1">
        {fatal ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0a0a0b]/95 px-3">
            <p className="max-w-sm text-center text-sm text-rose-100">{fatal}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 ring-1 ring-zinc-600"
            >
              Cerrar
            </button>
          </div>
        ) : null}
        <div ref={wrapRef} className="h-full min-h-[200px] w-full" />
      </div>
      {!fatal ? (
        <p className="shrink-0 border-t border-zinc-800 px-2 py-1 text-[10px] leading-snug text-zinc-500">
          Copiar/pegar: clic derecho en el terminal · <kbd className="rounded bg-zinc-800 px-0.5">Ctrl+C</kbd> con texto
          seleccionado · <kbd className="rounded bg-zinc-800 px-0.5">Ctrl+V</kbd> /{" "}
          <kbd className="rounded bg-zinc-800 px-0.5">Shift+Insert</kbd>. Sin selección,{" "}
          <kbd className="rounded bg-zinc-800 px-0.5">Ctrl+C</kbd> envía interrumpir al servidor.
        </p>
      ) : null}
      {ctxMenu
        ? createPortal(
            <div
              role="menu"
              data-ssh-ctx-menu
              className="fixed z-[9999] min-w-[10.5rem] overflow-hidden rounded-lg border border-zinc-600 bg-zinc-900 py-1 text-sm shadow-2xl ring-1 ring-black/50"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
            >
              <button
                type="button"
                disabled={!ctxMenu.canCopy}
                className="block w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={async () => {
                  const t = termRef.current;
                  const sel = t?.getSelection() ?? "";
                  if (!sel) return;
                  try {
                    await navigator.clipboard.writeText(sel);
                    setBanner("Selección copiada.");
                  } catch {
                    setBanner("No se pudo copiar.");
                  }
                  setCtxMenu(null);
                  t?.focus();
                }}
              >
                Copiar
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const t = termRef.current;
                    const ws = wsRef.current;
                    if (text && ws && ws.readyState === WebSocket.OPEN) t?.paste(text);
                  } catch {
                    setBanner("No se pudo leer el portapapeles.");
                  }
                  setCtxMenu(null);
                  termRef.current?.focus();
                }}
              >
                Pegar
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function WebSshSessionsDock({
  sessions,
  activeId,
  setSessions,
  setActiveId,
}: DockProps): ReactElement {
  const allMinimized = sessions.length > 0 && sessions.every((s) => s.minimized);
  const [dockMaximized, setDockMaximized] = useState(false);
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const defaultDockHeight = useCallback(
    () =>
      typeof window === "undefined"
        ? 420
        : Math.max(280, Math.min(Math.round(window.innerHeight * 0.58), 580)),
    [],
  );
  const [dockHeightPx, setDockHeightPx] = useState(defaultDockHeight);
  const [dockGeom, setDockGeom] = useState<{
    bottom: number;
    left: number | null;
    width: number | null;
  }>({ bottom: 0, left: null, width: null });
  const [isDockDragging, setIsDockDragging] = useState(false);
  const [isDockResizing, setIsDockResizing] = useState(false);
  const dockMoveRef = useRef<{
    startX: number;
    startY: number;
    baseLeft: number;
    baseBottom: number;
    baseWidth: number;
  } | null>(null);
  const dockResizeRef = useRef<{ startY: number; startH: number } | null>(null);

  const moveTab = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSessions((prev) => {
      const i = prev.findIndex((s) => s.id === fromId);
      const j = prev.findIndex((s) => s.id === toId);
      if (i < 0 || j < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next;
    });
  }, [setSessions]);

  useEffect(() => {
    if (!isDockDragging || !dockMoveRef.current) return;
    const onMove = (ev: PointerEvent) => {
      const m = dockMoveRef.current;
      if (!m) return;
      const nl = Math.round(
        Math.min(Math.max(8, m.baseLeft + (ev.clientX - m.startX)), window.innerWidth - m.baseWidth - 8),
      );
      const nb = Math.round(Math.min(Math.max(0, m.baseBottom - (ev.clientY - m.startY)), 200));
      setDockGeom((g) => ({ ...g, left: nl, bottom: nb, width: m.baseWidth }));
    };
    const onUp = () => {
      dockMoveRef.current = null;
      setIsDockDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDockDragging]);

  useEffect(() => {
    if (!isDockResizing || !dockResizeRef.current) return;
    const onMove = (ev: PointerEvent) => {
      const r = dockResizeRef.current;
      if (!r) return;
      const maxH = Math.min(Math.round(window.innerHeight * 0.92), window.innerHeight - 48);
      const dy = r.startY - ev.clientY;
      setDockHeightPx(Math.max(280, Math.min(maxH, r.startH + dy)));
    };
    const onUp = () => {
      dockResizeRef.current = null;
      setIsDockResizing(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDockResizing]);

  useEffect(() => {
    if (dockMaximized) {
      setIsDockDragging(false);
      setIsDockResizing(false);
      dockMoveRef.current = null;
      dockResizeRef.current = null;
    }
  }, [dockMaximized]);

  useEffect(() => {
    const onWin = () => {
      setDockGeom((g) => {
        if (g.width == null || g.left == null) return g;
        const w = Math.min(g.width, window.innerWidth - 16);
        const l = Math.min(Math.max(8, g.left), window.innerWidth - w - 8);
        return { ...g, width: w, left: l };
      });
      setDockHeightPx((h) =>
        Math.max(280, Math.min(h, Math.min(Math.round(window.innerHeight * 0.92), window.innerHeight - 48))),
      );
    };
    window.addEventListener("resize", onWin);
    return () => window.removeEventListener("resize", onWin);
  }, []);

  useEffect(() => {
    if (!dockMaximized || allMinimized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDockMaximized(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [dockMaximized, allMinimized]);

  const closeSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        queueMicrotask(() => {
          setActiveId((cur) => (cur === id ? next[0]?.id ?? null : cur));
        });
        return next;
      });
    },
    [setSessions, setActiveId]
  );

  const minimizeSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, minimized: true } : s));
        queueMicrotask(() => {
          setActiveId((cur) => {
            if (cur !== id) return cur;
            return next.find((s) => !s.minimized)?.id ?? cur;
          });
        });
        return next;
      });
    },
    [setSessions, setActiveId]
  );

  const activateTab = useCallback(
    (id: string) => {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, minimized: false } : s)));
      setActiveId(id);
    },
    [setSessions, setActiveId]
  );

  const restoreAll = useCallback(() => {
    setDockMaximized(false);
    setSessions((prev) => prev.map((s) => ({ ...s, minimized: false })));
  }, [setSessions]);

  if (sessions.length === 0) {
    return <></>;
  }

  const minimizedSessions = useMemo(() => sessions.filter((s) => s.minimized), [sessions]);

  const isFloating = dockGeom.width != null && dockGeom.left != null;

  let dockShellClass = "";
  let dockShellStyle: CSSProperties | undefined;
  if (!allMinimized && dockMaximized) {
    dockShellClass =
      "fixed inset-0 z-[95] min-h-0 max-h-none h-dvh border border-cf-line bg-[#070708]/98 shadow-2xl backdrop-blur-md";
  } else if (!allMinimized && !dockMaximized) {
    dockShellClass = isFloating
      ? "fixed z-[85] min-h-0 rounded-t-xl border border-cf-line bg-[#070708]/98 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
      : "fixed inset-x-0 bottom-0 z-[85] min-h-0 border-t border-cf-line bg-[#070708]/98 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md";
    dockShellStyle = {
      height: dockHeightPx,
      maxHeight: "min(92vh, calc(100dvh - 24px))",
      minHeight: 280,
      bottom: dockGeom.bottom,
      ...(isFloating
        ? { left: dockGeom.left ?? 8, width: dockGeom.width ?? 400, right: "auto" }
        : { left: 0, right: 0, width: "auto" }),
    };
  }

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`pointer-events-auto flex min-h-0 flex-col ${
        allMinimized
          ? "fixed inset-x-0 bottom-0 z-[92] border-t-2 border-cf-orange/60 bg-zinc-950/98 pb-3 shadow-[0_-8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
          : dockShellClass
      } ${!allMinimized && !dockMaximized && isDockResizing ? "ring-1 ring-cf-orange/35" : ""} ${
        !allMinimized && !dockMaximized && isDockDragging
          ? "z-[96] scale-[1.02] shadow-[0_28px_56px_rgba(0,0,0,0.55)] ring-1 ring-cf-orange/25 transition-[transform,box-shadow] duration-200 ease-out"
          : "transition-[transform,box-shadow] duration-200 ease-out"
      }`}
      style={allMinimized || dockMaximized ? undefined : dockShellStyle}
    >
      {!allMinimized ? (
        <>
          {!dockMaximized ? (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Arrastra para cambiar la altura del panel"
              title="Redimensionar altura"
              className="group relative z-20 flex h-2 shrink-0 cursor-ns-resize items-center justify-center border-b border-zinc-800/60 bg-zinc-900/80 hover:bg-cf-orange/20"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                dockResizeRef.current = { startY: e.clientY, startH: dockHeightPx };
                setIsDockResizing(true);
              }}
            >
              <span className="pointer-events-none h-1 w-14 rounded-full bg-zinc-600 group-hover:bg-cf-orange/80" />
            </div>
          ) : null}
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-900/90 px-2 py-1">
            {sessions.map((s) => {
              const active = s.id === activeId;
              return (
                <div
                  key={s.id}
                  className={`flex shrink-0 items-center gap-0.5 rounded-lg ring-1 ${
                    active ? "bg-cf-orange/20 ring-cf-orange/50" : "bg-zinc-800/80 ring-zinc-600"
                  } ${dragOverTabId === s.id && dragTabId && dragTabId !== s.id ? "ring-2 ring-cf-orange ring-offset-1 ring-offset-zinc-950" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragTabId && dragTabId !== s.id) setDragOverTabId(s.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from =
                      e.dataTransfer.getData("application/x-atlasvpn-tab") || e.dataTransfer.getData("text/plain");
                    if (from) moveTab(from, s.id);
                    setDragTabId(null);
                    setDragOverTabId(null);
                  }}
                >
                  <span
                    title="Arrastrar para reordenar pestañas"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-atlasvpn-tab", s.id);
                      e.dataTransfer.setData("text/plain", s.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragTabId(s.id);
                    }}
                    onDragEnd={() => {
                      setDragTabId(null);
                      setDragOverTabId(null);
                    }}
                    className={`cursor-grab rounded px-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 active:cursor-grabbing ${
                      dragTabId === s.id ? "opacity-60" : ""
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <button
                    type="button"
                    onClick={() => activateTab(s.id)}
                    className={`max-w-[10rem] truncate px-2 py-1.5 text-left text-xs font-medium ${
                      active ? "text-cf-orange" : "text-zinc-300"
                    }`}
                  >
                    {s.site}
                    {s.minimized ? " · ○" : ""}
                  </button>
                  <button
                    type="button"
                    title="Minimizar"
                    onClick={() => minimizeSession(s.id)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Cerrar"
                    onClick={() => closeSession(s.id)}
                    className="rounded p-1 text-zinc-400 hover:bg-rose-950/60 hover:text-rose-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {!dockMaximized ? (
              <div
                role="button"
                tabIndex={0}
                title="Arrastra para mover el panel"
                className={`mx-1 flex min-h-[32px] min-w-[48px] flex-1 cursor-grab items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-700/80 bg-zinc-900/40 px-2 hover:border-cf-orange/40 hover:bg-zinc-800/50 sm:min-w-[72px] ${isDockDragging ? "cursor-grabbing border-cf-orange/50 bg-zinc-800/50" : ""}`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  const bw = dockGeom.width ?? Math.min(960, window.innerWidth - 32);
                  const bl = dockGeom.left ?? Math.max(8, Math.round((window.innerWidth - bw) / 2));
                  dockMoveRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    baseLeft: dockGeom.left ?? bl,
                    baseBottom: dockGeom.bottom,
                    baseWidth: bw,
                  };
                  if (dockGeom.width == null || dockGeom.left == null) {
                    setDockGeom({ bottom: dockGeom.bottom, left: bl, width: bw });
                  }
                  setIsDockDragging(true);
                }}
              >
                <Move className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                <span className="hidden select-none text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:inline">
                  Mover
                </span>
              </div>
            ) : (
              <div className="min-w-2 flex-1" aria-hidden />
            )}
            <button
              type="button"
              title={
                dockMaximized
                  ? "Salir de pantalla completa (también Esc). Clic con Ctrl: minimizar todas las sesiones."
                  : "Pantalla completa del terminal. Clic con Ctrl: minimizar todas las sesiones."
              }
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  setDockMaximized(false);
                  setSessions((prev) => prev.map((s) => ({ ...s, minimized: true })));
                  return;
                }
                setDockMaximized((v) => !v);
              }}
              className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 ring-1 ring-zinc-600 hover:bg-zinc-700 hover:text-cf-orange"
            >
              {dockMaximized ? "Minimizar" : "Maximizar"}
            </button>
          </div>
          {minimizedSessions.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-zinc-800/90 bg-zinc-950/90 px-2 py-1.5">
              <TerminalIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Minimizadas
              </span>
              {minimizedSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={`Abrir ${s.site}`}
                  onClick={() => activateTab(s.id)}
                  className="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-cf-orange/15 px-2.5 py-1 text-xs font-medium text-cf-orange ring-1 ring-cf-orange/45 hover:bg-cf-orange/25"
                >
                  <ChevronsUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{s.site}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex w-full flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <PanelBottomOpen className="h-5 w-5 shrink-0 text-cf-orange" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100">Terminal web en segundo plano</p>
              <p className="truncate text-[11px] text-zinc-500">
                {sessions.length} sesión{sessions.length === 1 ? "" : "es"} minimizada
                {sessions.length === 1 ? "" : "s"} — pulsa un sitio para abrirlo o «Todas» para el panel completo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => activateTab(s.id)}
                className="inline-flex max-w-[10rem] items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700 hover:ring-cf-orange/50"
              >
                <ChevronsUp className="h-3.5 w-3.5 shrink-0 text-cf-orange" aria-hidden />
                <span className="truncate">{s.site}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={restoreAll}
              className="rounded-lg bg-cf-orange px-3 py-1.5 text-xs font-semibold text-black shadow-md hover:brightness-110"
            >
              Mostrar todas
            </button>
          </div>
        </div>
      )}

      <div
        className={
          allMinimized
            ? "pointer-events-none fixed -left-[10000px] top-0 z-0 h-[400px] w-[min(900px,100vw)] overflow-hidden opacity-0"
            : "relative min-h-0 flex-1 overflow-hidden"
        }
      >
        {sessions.map((s) => {
          const paneVisible = !allMinimized && s.id === activeId && !s.minimized;
          return (
            <div
              key={s.id}
              className={`absolute inset-0 flex min-h-0 flex-col ${paneVisible ? "z-10" : "z-0"}`}
              style={{ display: paneVisible ? "flex" : "none" }}
            >
              <SshSessionPane
                site={s.site}
                sessionId={s.id}
                visible={paneVisible}
                onClose={() => closeSession(s.id)}
                onMinimize={() => minimizeSession(s.id)}
                onSshSessionEnd={() => closeSession(s.id)}
              />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
