export function safeNextPath(requestedNext: string | null, origin: string): string {
  if (!requestedNext) return "/home";

  try {
    const requestedUrl = new URL(requestedNext, origin);
    if (requestedUrl.origin !== origin) return "/home";
    return `${requestedUrl.pathname}${requestedUrl.search}`;
  } catch {
    return "/home";
  }
}

export function publicRequestOrigin(
  requestUrl: string,
  configuredOrigin?: string
): string {
  const fallbackOrigin = new URL(requestUrl).origin;
  if (!configuredOrigin) return fallbackOrigin;

  try {
    const publicUrl = new URL(configuredOrigin);
    if (
      !["http:", "https:"].includes(publicUrl.protocol) ||
      publicUrl.username ||
      publicUrl.password ||
      publicUrl.pathname !== "/" ||
      publicUrl.search ||
      publicUrl.hash
    ) {
      return fallbackOrigin;
    }
    return publicUrl.origin;
  } catch {
    return fallbackOrigin;
  }
}
