export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ?? process.env.VERCEL_URL?.trim();
  const candidate = configured || (vercel ? `https://${vercel}` : "http://localhost:3000");
  try {
    const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}
