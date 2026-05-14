import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Cloud,
  Database,
  Loader2,
  LogOut,
  Pencil,
  PlusCircle,
  RefreshCw,
  Shield,
  Store,
  Terminal,
  Trash2,
  Users,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { API_BASE, api, apiUrl, bearerHeaders, setAccessToken } from "./apiClient";
import { WebSshSessionsDock, type SshWebSession } from "./WebSshSessionsDock";

type SiteRow = {
  id: string;
  name: string;
  ssh?: { hostname: string; local_port: number } | null;
  db?: { hostname: string; local_port: number } | null;
  sshStatus: string;
  dbStatus: string;
  posliteUrls?: { url: string; suffix?: string | null; port?: number | null }[];
};

type SitesResponse = { configPath: string; domainSuffix?: string; sites: SiteRow[] };

type AuthUser = { username: string; role: "admin" | "operator" | "viewer" };

type AuthStatusResponse = {
  authenticated: boolean;
  user?: { username: string; role: string };
};

/** Resumen por sitio: prioriza caídos, luego activos, luego reposo. */
function siteTunnelSummary(s: SiteRow): {
  tone: "up" | "down" | "idle";
  label: string;
  hint: string;
} {
  const dead = (s.sshStatus === "dead" ? 1 : 0) + (s.dbStatus === "dead" ? 1 : 0);
  const active = (s.sshStatus === "active" ? 1 : 0) + (s.dbStatus === "active" ? 1 : 0);
  if (dead > 0) {
    return { tone: "down", label: "DOWN", hint: "SSH o BD caído en este sitio" };
  }
  if (active > 0) {
    return { tone: "up", label: "UP", hint: "Al menos un túnel (SSH o BD) activo" };
  }
  return { tone: "idle", label: "—", hint: "Sin túneles activos" };
}

function siteTunnelRailClass(tone: "up" | "down" | "idle"): string {
  if (tone === "up") {
    return "bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[inset_-1px_0_0_rgba(0,0,0,0.2)]";
  }
  if (tone === "down") {
    return "bg-gradient-to-b from-rose-400 to-rose-700 shadow-[inset_-1px_0_0_rgba(0,0,0,0.25)]";
  }
  return "bg-zinc-600/90";
}

function siteTunnelDotClass(tone: "up" | "down" | "idle"): string {
  if (tone === "up") {
    return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)] animate-pulse";
  }
  if (tone === "down") {
    return "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.55)]";
  }
  return "bg-zinc-500";
}

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.06 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 28 },
  },
};

function StatusPill({ kind }: { kind: string }) {
  const active = kind === "active";
  return (
    <span
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 bg-emerald-500/15 text-emerald-300 ring-emerald-500/40 animate-pulse-ring"
          : kind === "dead"
            ? "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 bg-rose-500/15 text-rose-300 ring-rose-500/35"
            : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 bg-zinc-500/15 text-zinc-400 ring-zinc-600/50"
      }
    >
      {active ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      ) : null}
      {active ? "Activo" : kind === "dead" ? "Muerto" : "—"}
    </span>
  );
}

function AuthLoginPanel({ onDone }: { onDone: (u: AuthUser) => void }) {
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; user: { username: string; role: string }; access_token?: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ username: user.trim(), password: pw }),
        }
      );
      if (r.access_token) setAccessToken(r.access_token);
      else setAccessToken(null);
      onDone({ username: r.user.username, role: r.user.role as AuthUser["role"] });
    } catch (ex) {
      setErr(String(ex));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cf-ink px-4 text-zinc-100 vpn-grid-bg">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-cf-line bg-cf-card/90 p-8 ring-1 ring-white/5"
      >
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        <p className="text-sm text-zinc-400">Acceso a la consola AtlasVPN.</p>
        {err ? <p className="text-sm text-rose-300">{err}</p> : null}
        <input
          className="w-full rounded-lg border border-cf-line bg-black/30 px-3 py-2 text-sm outline-none ring-cf-orange/40 focus:ring-2"
          placeholder="Usuario"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          className="w-full rounded-lg border border-cf-line bg-black/30 px-3 py-2 text-sm outline-none ring-cf-orange/40 focus:ring-2"
          placeholder="Contraseña"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-cf-orange py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

type ListedUser = { id: number; username: string; role: string; created_at: number };

function UsersAdminPage({ me }: { me: AuthUser }) {
  const [rows, setRows] = useState<ListedUser[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "operator" | "viewer">("operator");
  const [editPw, setEditPw] = useState("");
  const [editErr, setEditErr] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [cuName, setCuName] = useState("");
  const [cuPw, setCuPw] = useState("");
  const [cuRole, setCuRole] = useState<"admin" | "operator" | "viewer">("operator");
  const [cuErr, setCuErr] = useState("");
  const [cuOk, setCuOk] = useState("");
  const [cuBusy, setCuBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoadErr("");
    try {
      const d = await api<{ users: ListedUser[] }>("/api/auth/users");
      setRows(d.users);
    } catch (e) {
      setLoadErr(String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startEdit = (u: ListedUser) => {
    setEditing(u.username);
    setEditRole(u.role as typeof editRole);
    setEditPw("");
    setEditErr("");
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editPw.trim() && editPw.trim().length < 12) {
      setEditErr("La contraseña debe tener al menos 12 caracteres.");
      return;
    }
    setEditErr("");
    setEditBusy(true);
    try {
      const body: { role: typeof editRole; password?: string } = { role: editRole };
      const p = editPw.trim();
      if (p) body.password = p;
      await api(`/api/auth/users/${encodeURIComponent(editing)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditing(null);
      await reload();
    } catch (ex) {
      setEditErr(String(ex));
    } finally {
      setEditBusy(false);
    }
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCuErr("");
    setCuOk("");
    if (cuPw.length < 12) {
      setCuErr("La contraseña debe tener al menos 12 caracteres.");
      return;
    }
    setCuBusy(true);
    try {
      await api("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({ username: cuName.trim(), password: cuPw, role: cuRole }),
      });
      setCuOk(`Usuario «${cuName.trim()}» creado.`);
      setCuName("");
      setCuPw("");
      setCuRole("operator");
      await reload();
    } catch (ex) {
      setCuErr(String(ex));
    } finally {
      setCuBusy(false);
    }
  };

  const doDelete = async (username: string) => {
    if (!window.confirm(`¿Eliminar al usuario «${username}»? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await api(`/api/auth/users/${encodeURIComponent(username)}`, { method: "DELETE" });
      if (editing === username) setEditing(null);
      await reload();
    } catch (ex) {
      window.alert(String(ex));
    }
  };

  const fmtDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString("es", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <motion.div
      key="users"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-3xl space-y-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Usuarios y roles</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Administradores gestionan cuentas: operador (túneles, sin credenciales Cloudflare), visor
          (solo estado) o administrador.
        </p>
      </div>

      <form
        onSubmit={(e) => void submitCreate(e)}
        className="space-y-3 rounded-2xl border border-cf-line bg-cf-card/90 p-5 ring-1 ring-white/[0.03]"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Nuevo usuario</p>
        {cuErr ? <p className="text-xs text-rose-300">{cuErr}</p> : null}
        {cuOk ? <p className="text-xs text-emerald-400">{cuOk}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border border-cf-line bg-cf-panel px-3 py-2 text-sm"
            placeholder="Nombre de usuario"
            value={cuName}
            onChange={(e) => setCuName(e.target.value)}
            autoComplete="off"
            required
          />
          <input
            className="rounded-lg border border-cf-line bg-cf-panel px-3 py-2 text-sm"
            placeholder="Contraseña (≥12)"
            type="password"
            value={cuPw}
            onChange={(e) => setCuPw(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="flex flex-col gap-3 pt-0.5 sm:flex-row sm:items-stretch sm:gap-4">
          <select
            className="min-h-[42px] w-full min-w-0 flex-1 rounded-lg border border-cf-line bg-cf-panel px-3 py-2 text-sm"
            value={cuRole}
            onChange={(e) => setCuRole(e.target.value as typeof cuRole)}
          >
            <option value="operator">Operador (túneles, sin credenciales Cloudflare)</option>
            <option value="viewer">Solo lectura</option>
            <option value="admin">Administrador</option>
          </select>
          <button
            type="submit"
            disabled={cuBusy}
            className="h-[42px] w-full shrink-0 rounded-lg bg-cf-orange px-5 text-xs font-semibold text-black disabled:opacity-50 sm:w-auto sm:self-center"
          >
            {cuBusy ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </form>

      {loadErr ? <p className="text-sm text-rose-300">{loadErr}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-cf-line bg-cf-card/90 ring-1 ring-white/[0.03]">
        <div className="border-b border-cf-line/80 bg-black/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Cuentas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-cf-line/60 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Alta</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-cf-line/40 last:border-0">
                  <td className="px-4 py-3 font-mono text-zinc-200">{u.username}</td>
                  <td className="px-4 py-3 text-zinc-300">{u.role}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 ring-1 ring-zinc-600 hover:bg-zinc-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={u.username === me.username}
                        title={u.username === me.username ? "No puedes eliminar tu propia sesión" : undefined}
                        onClick={() => void doDelete(u.username)}
                        className="rounded-lg bg-rose-950/80 px-2.5 py-1.5 text-xs font-medium text-rose-100 ring-1 ring-rose-500/40 hover:bg-rose-900/80 disabled:cursor-not-allowed disabled:bg-zinc-900/50 disabled:text-zinc-500 disabled:ring-zinc-600/60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <form
          onSubmit={(e) => void submitEdit(e)}
          className="space-y-3 rounded-2xl border border-cf-orange/30 bg-cf-orange/5 p-5 ring-1 ring-cf-orange/20"
        >
          <p className="text-sm font-medium text-zinc-100">
            Editar <span className="font-mono text-cf-orange">{editing}</span>
          </p>
          {editErr ? <p className="text-xs text-rose-300">{editErr}</p> : null}
          <label className="block text-xs text-zinc-500">Rol</label>
          <select
            className="w-full max-w-md rounded-lg border border-cf-line bg-cf-panel px-3 py-2 text-sm"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value as typeof editRole)}
          >
            <option value="operator">Operador</option>
            <option value="viewer">Solo lectura</option>
            <option value="admin">Administrador</option>
          </select>
          <label className="block text-xs text-zinc-500">Nueva contraseña (opcional, ≥12)</label>
          <input
            className="w-full max-w-md rounded-lg border border-cf-line bg-cf-panel px-3 py-2 text-sm"
            type="password"
            placeholder="Dejar vacío para no cambiar"
            value={editPw}
            onChange={(e) => setEditPw(e.target.value)}
            autoComplete="new-password"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={editBusy}
              className="rounded-lg bg-cf-orange px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            >
              {editBusy ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 ring-1 ring-zinc-600"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </motion.div>
  );
}

export default function App() {
  const [authPhase, setAuthPhase] = useState<"loading" | "login" | "app">("loading");
  const [me, setMe] = useState<AuthUser | null>(null);

  const [tab, setTab] = useState<"conn" | "cf" | "users" | "poslite" | "about">("conn");
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [configPath, setConfigPath] = useState("");
  /** Sitio con panel de acciones desplegado (acordeón). */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [sshWebSessions, setSshWebSessions] = useState<SshWebSession[]>([]);
  const [activeSshWebId, setActiveSshWebId] = useState<string | null>(null);

  const openSshWebSession = useCallback((site: string) => {
    const id = crypto.randomUUID();
    setSshWebSessions((prev) => [...prev, { id, site, minimized: false }]);
    setActiveSshWebId(id);
  }, []);
  const logRef = useRef<HTMLPreElement>(null);
  const autoSyncStarted = useRef(false);

  const [acc, setAcc] = useState("");
  const [tok, setTok] = useState("");
  const [suf, setSuf] = useState("asptienda.com");
  const [zone, setZone] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncOk, setSyncOk] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  /** Cloudflare: tras guardar, vista resumida para no editar Account ID por accidente. */
  const [cfCredentialsLocked, setCfCredentialsLocked] = useState(false);

  const appendLog = useCallback((lines: string[]) => {
    setLogs((prev) => [...prev, ...lines].slice(-200));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(apiUrl("/api/auth/status"), {
          credentials: API_BASE ? "omit" : "include",
          headers: { ...bearerHeaders() },
        });
        const s = (await r.json()) as AuthStatusResponse;
        if (s.authenticated && s.user) {
          setMe({
            username: s.user.username,
            role: s.user.role as AuthUser["role"],
          });
          setAuthPhase("app");
          return;
        }
        setAuthPhase("login");
      } catch {
        setAuthPhase("login");
      }
    })();
  }, []);

  useEffect(() => {
    const h = () => {
      autoSyncStarted.current = false;
      setAccessToken(null);
      setMe(null);
      setAuthPhase("login");
      setTab("conn");
      setSshWebSessions([]);
      setActiveSshWebId(null);
    };
    window.addEventListener("atlasvpn-unauthorized", h);
    return () => window.removeEventListener("atlasvpn-unauthorized", h);
  }, []);

  const doLogout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    autoSyncStarted.current = false;
    setMe(null);
    setAuthPhase("login");
    setTab("conn");
    setSshWebSessions([]);
    setActiveSshWebId(null);
  }, []);

  const loadSites = useCallback(async () => {
    try {
      const d = await api<SitesResponse>("/api/sites");
      setSites(d.sites);
      setConfigPath(d.configPath);
    } catch {
      setSites([]);
    }
  }, []);

  useEffect(() => {
    if (authPhase !== "app") return;
    void loadSites();
    const t = window.setInterval(() => void loadSites(), 3000);
    return () => window.clearInterval(t);
  }, [authPhase, loadSites]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (authPhase !== "app" || !me) return;
    void (async () => {
      try {
        const s = await api<{
          account_id: string;
          api_token: string;
          domain_suffix: string;
          zone_id: string;
        }>("/api/settings");
        setAcc(s.account_id);
        setTok(s.api_token);
        setSuf(s.domain_suffix || "asptienda.com");
        setZone(s.zone_id || "");
        setCfCredentialsLocked(
          Boolean((s.account_id || "").trim() && (s.api_token || "").trim())
        );
      } catch {
        /* ignore */
      }
    })();
  }, [authPhase, me]);

  useEffect(() => {
    if (authPhase !== "app" || me?.role !== "admin") return;
    if (autoSyncStarted.current) return;
    if (!acc.trim() || !tok.trim()) return;
    autoSyncStarted.current = true;
    void (async () => {
      setSyncing(true);
      setSyncOk(false);
      setSyncMsg("");
      try {
        const r = await api<{ ok: boolean; sitesCount: number; message: string }>("/api/sync", {
          method: "POST",
          body: JSON.stringify({
            account_id: acc,
            api_token: tok,
            domain_suffix: suf,
            zone_id: zone,
          }),
        });
        appendLog([`Sincronización automática: ${r.message}`]);
        setSyncOk(true);
        setSyncMsg(`${r.sitesCount} sitios`);
        setLastSyncAt(
          new Date().toLocaleString("es", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        );
        await loadSites();
      } catch (e) {
        appendLog([`Sincronización automática: ${String(e)}`]);
        setSyncOk(false);
        setSyncMsg("");
      } finally {
        setSyncing(false);
      }
    })();
  }, [authPhase, me, acc, tok, suf, zone, appendLog, loadSites]);

  useEffect(() => {
    if (me && me.role !== "admin" && (tab === "cf" || tab === "users")) setTab("conn");
  }, [me, tab]);

  const doStart = async (site: string, services: "ssh" | "db" | "both") => {
    try {
      const r = await api<{ ok: boolean; lines: string[] }>("/api/start", {
        method: "POST",
        body: JSON.stringify({ site, services }),
      });
      appendLog(r.lines);
      await loadSites();
    } catch (e) {
      appendLog([String(e)]);
    }
  };

  const doStop = async (site: string | null, label?: "ssh" | "db") => {
    try {
      const payload: { site: string | null; label?: string } = { site };
      if (label) payload.label = label;
      const r = await api<{ lines: string[] }>("/api/stop", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      appendLog(r.lines);
      await loadSites();
    } catch (e) {
      appendLog([String(e)]);
    }
  };

  const doOpenPgadmin = async (site: string) => {
    try {
      const r = await api<{ ok: boolean; executable: string; hint?: string | null }>(
        "/api/open-pgadmin",
        {
          method: "POST",
          body: JSON.stringify({ site }),
        }
      );
      const lines = [`PgAdmin: ${r.executable}`];
      if (r.hint) lines.push(r.hint);
      appendLog(lines);
    } catch (e) {
      appendLog([String(e)]);
    }
  };

  const doSaveSettings = async () => {
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          account_id: acc,
          api_token: tok,
          domain_suffix: suf,
          zone_id: zone,
        }),
      });
      appendLog(["Ajustes guardados en .atlasvpn/settings.json"]);
      setCfCredentialsLocked(true);
    } catch (e) {
      appendLog([String(e)]);
    }
  };

  const doSync = async () => {
    setSyncing(true);
    setSyncOk(false);
    setSyncMsg("");
    try {
      const r = await api<{ ok: boolean; sitesCount: number; message: string }>(
        "/api/sync",
        {
          method: "POST",
          body: JSON.stringify({
            account_id: acc,
            api_token: tok,
            domain_suffix: suf,
            zone_id: zone,
          }),
        }
      );
      appendLog([r.message]);
      setSyncOk(true);
      setSyncMsg(`${r.sitesCount} sitios`);
      setLastSyncAt(
        new Date().toLocaleString("es", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      await loadSites();
    } catch (e) {
      appendLog([`ERROR sync: ${String(e)}`]);
      setSyncOk(false);
      setSyncMsg("");
    } finally {
      setSyncing(false);
    }
  };

  const maskAccountId = (id: string) => {
    const t = id.trim();
    if (!t) return "—";
    if (t.length <= 10) return "••••••••";
    return `${t.slice(0, 6)}…${t.slice(-4)}`;
  };

  const maskZoneId = (z: string) => {
    const t = z.trim();
    if (!t) return "—";
    if (t.length <= 10) return "••••••••";
    return `${t.slice(0, 4)}…${t.slice(-4)}`;
  };

  const deleteCfCredentials = async () => {
    if (
      !window.confirm(
        "¿Eliminar las credenciales Cloudflare guardadas en este equipo (.atlasvpn/settings.json)?"
      )
    ) {
      return;
    }
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          account_id: "",
          api_token: "",
          domain_suffix: "asptienda.com",
          zone_id: "",
        }),
      });
      setAcc("");
      setTok("");
      setSuf("asptienda.com");
      setZone("");
      setCfCredentialsLocked(false);
      autoSyncStarted.current = false;
      setSyncOk(false);
      setSyncMsg("");
      appendLog(["Credenciales Cloudflare eliminadas del archivo local."]);
    } catch (e) {
      appendLog([String(e)]);
    }
  };

  const newCfConfigurationForm = () => {
    if (
      !window.confirm(
        "¿Vaciar el formulario para una configuración nueva? Los datos en disco no cambian hasta que pulses «Guardar»."
      )
    ) {
      return;
    }
    setAcc("");
    setTok("");
    setZone("");
    setSuf("asptienda.com");
    setCfCredentialsLocked(false);
  };

  if (authPhase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cf-ink text-zinc-400">
        <Loader2 className="h-10 w-10 animate-spin text-cf-orange" aria-hidden />
      </div>
    );
  }
  if (authPhase === "login") {
    return <AuthLoginPanel onDone={(u) => { setMe(u); setAuthPhase("app"); }} />;
  }
  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cf-ink text-zinc-400">
        <Loader2 className="h-10 w-10 animate-spin text-cf-orange" aria-hidden />
      </div>
    );
  }

  const canOperate = me.role !== "viewer";
  const canAdmin = me.role === "admin";

  type TabId = "conn" | "cf" | "users" | "poslite" | "about";
  const TabBtn = ({
    id,
    label,
    Icon,
  }: {
    id: TabId;
    label: string;
    Icon: typeof Shield;
  }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={
        tab === id
          ? "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all bg-cf-orange text-black shadow-lg shadow-cf-orange/25"
          : "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cf-ink text-zinc-100 vpn-grid-bg">
      {sshWebSessions.length > 0 ? (
        <WebSshSessionsDock
          sessions={sshWebSessions}
          activeId={activeSshWebId}
          setSessions={setSshWebSessions}
          setActiveId={setActiveSshWebId}
        />
      ) : null}
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-cf-orange/25 blur-[100px] animate-float" />
      <div className="pointer-events-none absolute -right-20 bottom-32 h-80 w-80 rounded-full bg-sky-500/15 blur-[110px] animate-float [animation-delay:-6s]" />

      <header className="relative z-10 border-b border-cf-line/80 glass">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <img
              src={apiUrl("/api/logo")}
              alt=""
              className="h-10 w-auto max-w-[160px] object-contain opacity-95"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                AtlasVPN
              </h1>
              <p className="truncate text-xs text-zinc-500 sm:text-sm">
                SSH y bases de datos · Cloudflare Access TCP
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 rounded-2xl bg-black/30 p-1 ring-1 ring-white/5 sm:gap-1.5">
            <TabBtn id="conn" label="Conexiones" Icon={Wifi} />
            <TabBtn id="poslite" label="Poslite" Icon={Store} />
            {canAdmin ? <TabBtn id="cf" label="Cloudflare" Icon={Cloud} /> : null}
            {canAdmin ? <TabBtn id="users" label="Usuarios" Icon={Users} /> : null}
            <TabBtn id="about" label="Acerca de" Icon={Shield} />
            <div className="mx-1 hidden h-8 w-px bg-white/10 sm:block" aria-hidden />
            <div className="flex items-center gap-2 rounded-xl px-2 py-1 text-xs text-zinc-400">
              <span className="max-w-[7rem] truncate font-medium text-zinc-200">{me.username}</span>
              <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-400">
                {me.role}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void doLogout()}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 ring-1 ring-transparent hover:bg-white/5 hover:text-zinc-200"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        {tab === "conn" && (
          <motion.div
            key="conn"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <p className="shrink-0 break-all font-mono text-xs text-zinc-500">{configPath}</p>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="show"
                className="grid min-h-0 flex-1 auto-rows-min gap-3 overflow-y-auto pb-1 sm:grid-cols-2 lg:grid-cols-3 [scrollbar-gutter:stable]"
              >
                {sites.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-dashed border-cf-line bg-cf-panel/50 p-10 text-center text-zinc-500">
                    No hay sitios en tunnels.json. Sincroniza desde Cloudflare o crea plantilla.
                  </div>
                )}
                {sites.map((s) => {
                  const open = expandedId === s.id;
                  const tun = siteTunnelSummary(s);
                  return (
                    <motion.div
                      key={s.id}
                      variants={rowVariants}
                      layout
                      className={
                        open
                          ? "group flex flex-row overflow-hidden rounded-2xl border border-cf-orange bg-cf-orange/10 shadow-lg shadow-cf-orange/10 ring-1 ring-cf-orange/40"
                          : "group flex flex-row overflow-hidden rounded-2xl border border-cf-line bg-cf-card/90 ring-1 ring-transparent hover:border-zinc-600 hover:bg-cf-card"
                      }
                      aria-label={`${s.name}: ${tun.hint}`}
                    >
                      <div
                        className={`w-2 shrink-0 self-stretch ${siteTunnelRailClass(tun.tone)}`}
                        title={tun.hint}
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-2 p-4 text-left"
                        onClick={() => setExpandedId(open ? null : s.id)}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className="flex shrink-0 flex-col items-center gap-1 border-r border-white/10 pr-3 pt-0.5"
                            title={tun.hint}
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${siteTunnelDotClass(tun.tone)}`}
                              aria-hidden
                            />
                            <span
                              className={`text-[9px] font-bold uppercase leading-none tracking-tight ${
                                tun.tone === "up"
                                  ? "text-emerald-400"
                                  : tun.tone === "down"
                                    ? "text-rose-300"
                                    : "text-zinc-500"
                              }`}
                            >
                              {tun.label}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                          <span className="font-semibold tracking-tight">{s.name}</span>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Pulsa para {open ? "ocultar" : "mostrar"} acciones
                          </p>
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 ${
                            open ? "rotate-180 text-cf-orange" : ""
                          }`}
                        />
                      </button>
                      <div className="border-t border-white/5 px-4 pb-3 pt-0">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-zinc-500">SSH</div>
                            <StatusPill kind={s.sshStatus} />
                          </div>
                          <div>
                            <div className="text-zinc-500">BD</div>
                            <StatusPill kind={s.dbStatus} />
                          </div>
                        </div>
                        {s.ssh ? (
                          <p className="mt-2 truncate font-mono text-[11px] text-zinc-500">
                            {s.ssh.hostname} → :{s.ssh.local_port}
                          </p>
                        ) : null}
                      </div>
                      <AnimatePresence initial={false}>
                        {open ? (
                          <motion.div
                            key={`panel-${s.id}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden border-t border-cf-line/80 bg-black/25"
                          >
                            <div className="flex flex-col gap-2 p-3">
                              {canOperate ? (
                                <>
                              <div className="flex flex-wrap gap-2">
                                {s.ssh ? (
                                  s.sshStatus === "active" ? (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => void doStop(s.id, "ssh")}
                                      className="rounded-lg bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/50 hover:bg-rose-900/90 sm:text-sm"
                                    >
                                      Detener SSH
                                    </motion.button>
                                  ) : (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => void doStart(s.id, "ssh")}
                                      className="rounded-lg bg-cf-panel px-3 py-2 text-xs font-medium text-zinc-200 ring-1 ring-cf-line hover:bg-zinc-800 sm:text-sm"
                                    >
                                      Iniciar SSH
                                    </motion.button>
                                  )
                                ) : null}
                                {s.db ? (
                                  s.dbStatus === "active" ? (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => void doStop(s.id, "db")}
                                      className="rounded-lg bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/50 hover:bg-rose-900/90 sm:text-sm"
                                    >
                                      Detener BD
                                    </motion.button>
                                  ) : (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => void doStart(s.id, "db")}
                                      className="rounded-lg bg-cf-panel px-3 py-2 text-xs font-medium text-zinc-200 ring-1 ring-cf-line hover:bg-zinc-800 sm:text-sm"
                                    >
                                      Iniciar BD
                                    </motion.button>
                                  )
                                ) : null}
                                {s.ssh && s.db ? (
                                  s.sshStatus === "active" && s.dbStatus === "active" ? (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => void doStop(s.id)}
                                      className="rounded-lg bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/50 hover:bg-rose-900/90 sm:text-sm"
                                    >
                                      Detener ambos
                                    </motion.button>
                                  ) : s.sshStatus === "active" || s.dbStatus === "active" ? (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => void doStop(s.id)}
                                      className="rounded-lg bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/50 hover:bg-rose-900/90 sm:text-sm"
                                    >
                                      Detener túneles activos
                                    </motion.button>
                                  ) : (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => void doStart(s.id, "both")}
                                      className="rounded-lg bg-cf-panel px-3 py-2 text-xs font-medium text-zinc-200 ring-1 ring-cf-line hover:bg-zinc-800 sm:text-sm"
                                    >
                                      Iniciar ambos
                                    </motion.button>
                                  )
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {s.ssh && s.sshStatus === "active" ? (
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => openSshWebSession(s.id)}
                                    className="flex items-center gap-2 rounded-lg bg-cf-orange px-3 py-2 text-xs font-semibold text-black shadow-md sm:text-sm"
                                  >
                                    <Terminal className="h-4 w-4" />
                                    Terminal web
                                  </motion.button>
                                ) : null}
                                {s.db ? (
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => void doOpenPgadmin(s.id)}
                                    className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-md ring-1 ring-sky-400/40 sm:text-sm"
                                  >
                                    <Database className="h-4 w-4" />
                                    PgAdmin
                                  </motion.button>
                                ) : null}
                              </div>
                                </>
                              ) : (
                                <p className="text-center text-xs text-zinc-500">
                                  Solo lectura: tu rol no permite iniciar o detener túneles.
                                </p>
                              )}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              <div className="shrink-0 rounded-xl border border-cf-line bg-cf-panel/95 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cf-line/60 px-3 py-2">
                  <span className="text-xs font-medium text-zinc-400">Barra rápida</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLogOpen((v) => !v)}
                      className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-zinc-600 hover:bg-zinc-700"
                    >
                      {logOpen ? "Ocultar registro" : "Mostrar registro"}
                    </button>
                    {canOperate ? (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (window.confirm("¿Detener todos los túneles?")) void doStop(null);
                      }}
                      className="rounded-lg bg-rose-600/90 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Detener todo
                    </motion.button>
                    ) : null}
                  </div>
                </div>
                {logOpen ? (
                  <div
                    className="overflow-hidden rounded-b-xl border-t border-transparent"
                    style={{ maxHeight: "min(28vh, 220px)" }}
                  >
                    <pre
                      ref={logRef}
                      className="max-h-[28vh] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-emerald-100/90 sm:max-h-[220px]"
                    >
                      {logs.join("\n")}
                    </pre>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}

        {canAdmin && tab === "cf" && (
          <motion.div
            key="cf"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-xl space-y-4"
          >
            <p className="text-sm text-zinc-400">Cuenta y dominio Cloudflare.</p>

            {cfCredentialsLocked ? (
              <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 ring-1 ring-emerald-500/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-zinc-100">Credenciales guardadas</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Los valores sensibles no se muestran completos para evitar cambios accidentales.
                    </p>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <dt className="text-zinc-500">Account ID</dt>
                        <dd className="font-mono text-zinc-200">{maskAccountId(acc)}</dd>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <dt className="text-zinc-500">API Token</dt>
                        <dd className="text-zinc-200">Guardado (oculto)</dd>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <dt className="text-zinc-500">Sufijo dominio</dt>
                        <dd className="font-mono text-zinc-200">{suf || "—"}</dd>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <dt className="text-zinc-500">Zone ID</dt>
                        <dd className="font-mono text-zinc-200">{zone.trim() ? maskZoneId(zone) : "—"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCfCredentialsLocked(false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-cf-orange px-4 py-2.5 text-sm font-semibold text-black"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void deleteCfCredentials()}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-950/80 px-4 py-2.5 text-sm font-medium text-rose-100 ring-1 ring-rose-500/40"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={newCfConfigurationForm}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-zinc-600"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Nueva configuración
                  </motion.button>
                </div>
              </div>
            ) : (
              <>
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Account ID
                </label>
                <input
                  value={acc}
                  onChange={(e) => setAcc(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-xl border border-cf-line bg-cf-panel px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cf-orange/40"
                />
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  API Token
                </label>
                <input
                  value={tok}
                  onChange={(e) => setTok(e.target.value)}
                  type="password"
                  autoComplete="off"
                  className="w-full rounded-xl border border-cf-line bg-cf-panel px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cf-orange/40"
                />
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Sufijo dominio
                </label>
                <input
                  value={suf}
                  onChange={(e) => setSuf(e.target.value)}
                  className="w-full rounded-xl border border-cf-line bg-cf-panel px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cf-orange/40"
                />
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Zone ID (opcional)
                </label>
                <input
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full rounded-xl border border-cf-line bg-cf-panel px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cf-orange/40"
                />
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <motion.button
                    type="button"
                    disabled={syncing}
                    whileHover={{ scale: syncing ? 1 : 1.02 }}
                    whileTap={{ scale: syncing ? 1 : 0.98 }}
                    onClick={() => void doSaveSettings()}
                    className="rounded-xl bg-zinc-800 px-5 py-3 text-sm font-medium ring-1 ring-zinc-600"
                  >
                    Guardar
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {canAdmin && tab === "users" && <UsersAdminPage me={me} />}

        {tab === "poslite" && (
          <motion.div
            key="poslite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-3xl space-y-4"
          >
            <p className="text-sm text-zinc-400">
              Accesos al portal Poslite por tienda.
            </p>
            {sites.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-cf-line bg-cf-panel/50 p-8 text-center text-zinc-500">
                No hay sitios. Sincroniza desde Cloudflare primero.
              </div>
            ) : (
              <div className="space-y-3">
                {sites.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    className="rounded-2xl border border-cf-line bg-cf-card/90 p-4 ring-1 ring-white/[0.03]"
                  >
                    <h3 className="font-semibold text-zinc-100">{s.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(s.posliteUrls ?? []).map((link) => {
                        const label =
                          link.suffix && String(link.suffix).trim()
                            ? String(link.suffix).trim().slice(0, 22)
                            : link.port != null
                              ? `:${link.port}`
                              : "·";
                        return (
                        <a
                          key={`${s.id}-${link.suffix ?? link.port ?? link.url}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-cf-orange ring-1 ring-zinc-600 hover:bg-zinc-700"
                        >
                          {label}
                        </a>
                        );
                      })}
                    </div>
                    <p className="mt-2 break-all font-mono text-[11px] text-zinc-500">
                      {(s.posliteUrls ?? []).map((l) => l.url).join(" · ")}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "about" && (
          <motion.div
            key="about"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {[
              {
                t: "Qué es",
                b: "Cliente para cloudflared access tcp hacia SSH y bases de datos detrás de Cloudflare Access. La sincronización rellena tunnels.json desde la API de Cloudflare.",
              },
              {
                t: "Requisitos",
                b: "cloudflared en PATH, login Access en el navegador cuando lo pida el túnel. «Terminal web» abre xterm en el navegador (WebSocket al API → SSH a 127.0.0.1 en el puerto del túnel); usuario SSH según tunnels.json (p. ej. admin@localhost).",
              },
            ].map((c, i) => (
              <motion.div
                key={c.t}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-cf-line bg-cf-card/80 p-6 ring-1 ring-white/[0.03]"
              >
                <h3 className="font-semibold text-cf-orange">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.b}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {canAdmin ? (
      <>
      {/* Sincronización Cloudflare: acceso fijo en esquina (solo administradores) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex max-w-[min(100vw-1.5rem,20rem)] flex-col items-end gap-1.5 sm:bottom-5 sm:right-5">
        <div className="pointer-events-auto flex flex-col gap-1.5 rounded-2xl border border-cf-line/90 bg-cf-panel/95 px-3 py-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {syncing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cf-orange" aria-hidden />
            ) : syncOk && syncMsg ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            ) : (
              <Cloud className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Cloudflare
              </p>
              <p className="truncate text-xs text-zinc-200">
                {syncing
                  ? "Sincronizando túneles…"
                  : syncOk && syncMsg
                    ? `Listo · ${syncMsg}`
                    : "Pulsa para sincronizar"}
              </p>
              {lastSyncAt && !syncing ? (
                <p className="truncate text-[10px] text-zinc-500">Última: {lastSyncAt}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => void doSync()}
              disabled={syncing || !acc.trim() || !tok.trim()}
              title={
                !acc.trim() || !tok.trim()
                  ? "Configura Account ID y API Token en la pestaña Cloudflare"
                  : "Sincronizar con Cloudflare"
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-cf-orange px-2.5 py-1.5 text-xs font-semibold text-black shadow-md shadow-cf-orange/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
            <button
              type="button"
              onClick={() => setTab("cf")}
              className="rounded-lg bg-zinc-800 px-2 py-1.5 text-[10px] font-medium text-zinc-300 ring-1 ring-zinc-600 hover:bg-zinc-700"
            >
              Ajustes
            </button>
          </div>
        </div>
      </div>
      </>
      ) : null}
    </div>
  );
}
