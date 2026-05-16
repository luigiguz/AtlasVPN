import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  buildAtlasNav,
  flattenNavRoutes,
  routeMeta,
  type AtlasNavEntry,
  type AtlasNavGroup,
  type AtlasNavLeaf,
  type AtlasRouteId,
} from "../atlasNav";
import { apiUrl } from "../apiClient";
import { PoweredByVerkkutech } from "./PoweredByVerkkutech";

type AuthUser = { username: string; role: "admin" | "operator" | "viewer" };

type Props = {
  route: AtlasRouteId;
  onNavigate: (r: AtlasRouteId) => void;
  user: AuthUser;
  canAdmin: boolean;
  onLogout: () => void;
  children: ReactNode;
};

function NavLeafButton({
  item,
  active,
  onPick,
  indent,
}: {
  item: AtlasNavLeaf;
  active: boolean;
  onPick: () => void;
  indent?: boolean;
}) {
  const Icon = item.icon;
  const disabled = item.comingSoon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={
        disabled
          ? "flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-600"
          : active
            ? "flex w-full items-center gap-2 rounded-lg bg-white/[0.08] px-2.5 py-2 text-left text-sm font-medium text-zinc-100 ring-1 ring-white/10"
            : `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 ${
                indent ? "pl-8" : ""
              }`
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {disabled ? (
        <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase text-zinc-500">Pronto</span>
      ) : null}
    </button>
  );
}

function NavGroupBlock({
  group,
  route,
  onNavigate,
  open,
  onToggle,
}: {
  group: AtlasNavGroup;
  route: AtlasRouteId;
  onNavigate: (r: AtlasRouteId) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = group.icon;
  const childActive = group.children.some((c) => !c.comingSoon && c.route === route);
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={
          childActive
            ? "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-zinc-100"
            : "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-white/[0.04]"
        }
      >
        <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden pl-1"
          >
            <motion.div layout className="ml-3 space-y-0.5 border-l border-white/[0.06] pl-1">
              {group.children.map((child) => (
                <NavLeafButton
                  key={child.id}
                  item={child}
                  indent
                  active={!child.comingSoon && child.route === route}
                  onPick={() => {
                    if (!child.comingSoon) onNavigate(child.route);
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarNav({
  entries,
  route,
  onNavigate,
  groupOpen,
  setGroupOpen,
}: {
  entries: AtlasNavEntry[];
  route: AtlasRouteId;
  onNavigate: (r: AtlasRouteId) => void;
  groupOpen: Record<string, boolean>;
  setGroupOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="Navegación Atlas">
      {entries.map((entry) => {
        if (entry.kind === "leaf") {
          return (
            <NavLeafButton
              key={entry.id}
              item={entry}
              active={!entry.comingSoon && entry.route === route}
              onPick={() => {
                if (!entry.comingSoon) onNavigate(entry.route);
              }}
            />
          );
        }
        return (
          <NavGroupBlock
            key={entry.id}
            group={entry}
            route={route}
            onNavigate={onNavigate}
            open={groupOpen[entry.id] ?? entry.defaultOpen ?? false}
            onToggle={() => setGroupOpen((o) => ({ ...o, [entry.id]: !(o[entry.id] ?? entry.defaultOpen) }))}
          />
        );
      })}
    </nav>
  );
}

export function AtlasShell({ route, onNavigate, user, canAdmin, onLogout, children }: Props): ReactNode {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const meta = routeMeta(route);
  const navEntries = useMemo(() => buildAtlasNav(canAdmin), [canAdmin]);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => ({
    "atlas-vpn": true,
    "atlas-admin": true,
    "coming-soon": false,
  }));

  const filteredEntries = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return navEntries;
    const leaves = flattenNavRoutes(navEntries).filter(
      (l) => l.label.toLowerCase().includes(q) || l.id.toLowerCase().includes(q),
    );
    const routeSet = new Set(leaves.map((l) => l.route));
    const out: AtlasNavEntry[] = [];
    for (const e of navEntries) {
      if (e.kind === "leaf") {
        if (e.label.toLowerCase().includes(q)) out.push(e);
        continue;
      }
      const kids = e.children.filter((c) => c.label.toLowerCase().includes(q) || routeSet.has(c.route));
      if (kids.length > 0 || e.label.toLowerCase().includes(q)) {
        out.push({ ...e, children: kids.length > 0 ? kids : e.children });
      }
    }
    return out;
  }, [navEntries, navQuery]);

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0f12]">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-3">
        <img
          src={apiUrl("/api/logo")}
          alt=""
          className="h-8 w-auto max-w-[120px] object-contain opacity-95"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-zinc-100">Atlas</p>
          <p className="truncate text-[10px] text-zinc-500">Plataforma Verkku</p>
        </div>
      </div>
      <div className="shrink-0 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" aria-hidden />
          <input
            type="search"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="Búsqueda rápida…"
            className="w-full rounded-lg border border-white/[0.06] bg-black/30 py-2 pl-8 pr-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-cf-orange/40 focus:ring-1 focus:ring-cf-orange/30"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav
          entries={filteredEntries}
          route={route}
          onNavigate={(r) => {
            onNavigate(r);
            setMobileOpen(false);
          }}
          groupOpen={groupOpen}
          setGroupOpen={setGroupOpen}
        />
      </div>
      <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-3">
        <PoweredByVerkkutech compact className="py-1" />
        <button
          type="button"
          onClick={() => onNavigate("about")}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        >
          Acerca de
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#0b0d10] text-zinc-100">
      <aside className="hidden w-[15.5rem] shrink-0 border-r border-white/[0.06] md:flex md:flex-col">{sidebar}</aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              aria-label="Cerrar menú"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-white/[0.06] shadow-2xl md:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.06] bg-[#0d0f12]/95 px-4 py-3 backdrop-blur-md">
          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-zinc-400 ring-1 ring-white/10 hover:bg-white/5 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <nav className="mb-0.5 flex flex-wrap items-center gap-1 text-[11px] text-zinc-500" aria-label="Ruta">
              {meta.breadcrumb.map((part, i) => (
                <span key={`${part}-${i}`} className="inline-flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="h-3 w-3 opacity-50" aria-hidden /> : null}
                  <span className={i === meta.breadcrumb.length - 1 ? "text-zinc-400" : ""}>{part}</span>
                </span>
              ))}
            </nav>
            <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">{meta.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right text-xs sm:block">
              <p className="font-medium text-zinc-200">{user.username}</p>
              <p className="font-mono text-[10px] uppercase text-zinc-500">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-3 py-2 text-sm text-zinc-300 ring-1 ring-white/10 hover:bg-zinc-700"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
