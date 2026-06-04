/** Vite base URL — `/` in dev, `/apps/fretflow/` when mounted on Profolio. */
export const appBaseUrl = import.meta.env.BASE_URL;

export function assetUrl(path: string): string {
  const base = appBaseUrl.endsWith('/') ? appBaseUrl : `${appBaseUrl}/`;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${normalized}`;
}
