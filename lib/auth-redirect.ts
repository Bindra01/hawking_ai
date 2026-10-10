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

export function publicRequestOrigin(requestUrl: string, headers: Headers): string {
  const fallbackOrigin = new URL(requestUrl).origin;
  const forwardedHost = firstForwardedValue(headers.get("x-forwarded-host"));
  const host = forwardedHost ?? firstForwardedValue(headers.get("host"));

  if (!host) return fallbackOrigin;

  const fallbackProtocol = new URL(requestUrl).protocol.replace(":", "");
  const protocol =
    firstForwardedValue(headers.get("x-forwarded-proto")) ?? fallbackProtocol;

  if (protocol !== "http" && protocol !== "https") return fallbackOrigin;

  try {
    const publicUrl = new URL(`${protocol}://${host}`);
    if (publicUrl.username || publicUrl.password || publicUrl.pathname !== "/") {
      return fallbackOrigin;
    }
    return publicUrl.origin;
  } catch {
    return fallbackOrigin;
  }
}

function firstForwardedValue(value: string | null): string | null {
  const firstValue = value?.split(",", 1)[0]?.trim();
  return firstValue || null;
}
