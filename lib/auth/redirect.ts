export function sanitizeNextPath(
  nextPath: string | null | undefined,
  fallback = "/app",
): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }

  return nextPath;
}

export function getSiteUrl(originHeader?: string | null): string {
  if (originHeader) {
    return originHeader.replace(/\/$/, "");
  }

  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envSiteUrl) {
    return envSiteUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
