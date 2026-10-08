export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productionVercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim()
    ?? process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const deploymentVercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ?? process.env.VERCEL_URL?.trim();
  const configuredIsLocal = configured ? isLocalUrl(configured) : false;
  const candidate = configured && !(configuredIsLocal && productionVercel)
    ? configured
    : productionVercel
      ? `https://${productionVercel}`
      : deploymentVercel
        ? `https://${deploymentVercel}`
        : "http://localhost:3000";
  try {
    const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

function isLocalUrl(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}
