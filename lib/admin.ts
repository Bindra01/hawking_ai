/**
 * Admin access control.
 *
 * Set ADMIN_EMAILS in .env.local as a comma-separated list of email addresses
 * that are allowed to access admin routes. Example:
 *   ADMIN_EMAILS=alice@example.com,bob@example.com
 *
 * If ADMIN_EMAILS is not set, ALL authenticated users are treated as admins
 * (useful during development, but should be locked down in production).
 */
export function isAdmin(email: string | undefined): boolean {
  if (!email) return false;

  const allowlist = process.env.ADMIN_EMAILS;
  if (!allowlist) {
    // No allowlist configured — allow all authenticated users (dev mode)
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "ADMIN_EMAILS is not set — all authenticated users have admin access. " +
        "Set ADMIN_EMAILS in your environment to restrict admin access in production."
      );
    }
    return true;
  }

  const admins = allowlist.split(",").map((e) => e.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}
