export function isUnauthorizedSolveResponse(
  status: number,
  payload: { code?: unknown; error?: unknown } | null | undefined
): boolean {
  return status === 401 || payload?.code === "SESSION_EXPIRED" || payload?.error === "Unauthorized";
}
