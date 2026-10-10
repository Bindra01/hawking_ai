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
