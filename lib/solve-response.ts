export function isUnauthorizedSolveResponse(status: number, error: unknown): boolean {
  return status === 401 || error === "Unauthorized" || error === "SESSION_EXPIRED";
}
