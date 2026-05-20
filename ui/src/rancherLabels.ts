/** Labels Rancher normalizados (debe coincidir con backend/atlas_rancher/labels.py). */

export const POSLITE_APPLICATION = "Poslite";

export const POSLITE_DISTROS = ["Horustech", "Pam"] as const;

const DISTRO_CANONICAL: Record<string, string> = {
  pam: "Pam",
  horustech: "Horustech",
};

const APPLICATION_CANONICAL: Record<string, string> = {
  poslite: "Poslite",
};

export function normalizeDistro(raw: string): string {
  const low = raw.trim().toLowerCase();
  if (!low) return "";
  return DISTRO_CANONICAL[low] ?? low.charAt(0).toUpperCase() + low.slice(1);
}

export function normalizeApplication(raw: string): string {
  const low = raw.trim().toLowerCase();
  if (!low) return "";
  return APPLICATION_CANONICAL[low] ?? low.charAt(0).toUpperCase() + low.slice(1);
}

export function isPosliteApplication(app: string): boolean {
  return normalizeApplication(app) === POSLITE_APPLICATION;
}

export function isValidPosliteDistro(distro: string): boolean {
  const d = normalizeDistro(distro);
  return (POSLITE_DISTROS as readonly string[]).includes(d);
}
