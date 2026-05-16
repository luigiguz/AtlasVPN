import type { LucideIcon } from "lucide-react";
import { Cloud, Home, Info, Shield, Store, Users, Wifi } from "lucide-react";

/** Rutas de la consola web Atlas (plataforma). */
export type AtlasRouteId = "home" | "conn" | "poslite" | "cf" | "users" | "about";

export type AtlasNavLeaf = {
  kind: "leaf";
  id: string;
  route: AtlasRouteId;
  label: string;
  icon: LucideIcon;
  /** Solo administradores */
  adminOnly?: boolean;
  /** Visible pero deshabilitado (próximamente) */
  comingSoon?: boolean;
};

export type AtlasNavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: AtlasNavLeaf[];
};

export type AtlasNavEntry = AtlasNavLeaf | AtlasNavGroup;

/** Menú lateral: plataforma Atlas → productos → páginas. Ampliar `children` al añadir módulos. */
export function buildAtlasNav(canAdmin: boolean): AtlasNavEntry[] {
  const vpnChildren: AtlasNavLeaf[] = [
    { kind: "leaf", id: "vpn-conn", route: "conn", label: "Conexiones", icon: Wifi },
    { kind: "leaf", id: "vpn-poslite", route: "poslite", label: "Poslite", icon: Store },
    ...(canAdmin
      ? ([
          { kind: "leaf", id: "vpn-cf", route: "cf", label: "Cloudflare", icon: Cloud, adminOnly: true },
          { kind: "leaf", id: "vpn-users", route: "users", label: "Usuarios", icon: Users, adminOnly: true },
        ] satisfies AtlasNavLeaf[])
      : []),
  ];

  return [
    { kind: "leaf", id: "home", route: "home", label: "Inicio", icon: Home },
    {
      kind: "group",
      id: "atlas-vpn",
      label: "Atlas VPN",
      icon: Shield,
      defaultOpen: true,
      children: vpnChildren,
    },
    {
      kind: "group",
      id: "coming-soon",
      label: "Próximamente",
      icon: Info,
      defaultOpen: false,
      children: [
        {
          kind: "leaf",
          id: "future-rancher",
          route: "home",
          label: "Atlas Rancher",
          icon: Store,
          comingSoon: true,
        },
      ],
    },
    { kind: "leaf", id: "about", route: "about", label: "Acerca de", icon: Info },
  ];
}

export function routeMeta(route: AtlasRouteId): { title: string; breadcrumb: string[] } {
  switch (route) {
    case "home":
      return { title: "Inicio de la cuenta", breadcrumb: ["Atlas", "Inicio"] };
    case "conn":
      return { title: "Conexiones", breadcrumb: ["Atlas", "Atlas VPN", "Conexiones"] };
    case "poslite":
      return { title: "Poslite", breadcrumb: ["Atlas", "Atlas VPN", "Poslite"] };
    case "cf":
      return { title: "Cloudflare", breadcrumb: ["Atlas", "Atlas VPN", "Cloudflare"] };
    case "users":
      return { title: "Usuarios", breadcrumb: ["Atlas", "Atlas VPN", "Usuarios"] };
    case "about":
      return { title: "Acerca de", breadcrumb: ["Atlas", "Acerca de"] };
    default:
      return { title: "Atlas", breadcrumb: ["Atlas"] };
  }
}

export function flattenNavRoutes(entries: AtlasNavEntry[]): AtlasNavLeaf[] {
  const out: AtlasNavLeaf[] = [];
  for (const e of entries) {
    if (e.kind === "leaf") out.push(e);
    else out.push(...e.children);
  }
  return out;
}
