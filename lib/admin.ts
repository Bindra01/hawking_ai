/**
 * Admin access control.
 *
 * Set ADMIN_EMAILS in .env.local as a comma-separated list of email addresses
 * that are allowed to access admin routes. Example:
 *   ADMIN_EMAILS=alice@example.com,bob@example.com
 *
 * SECURITY: This check is fail-closed. If ADMIN_EMAILS is not set (or is empty),
 * NO user is treated as an admin — admin routes and the admin UI are locked for
 * everyone. This is intentional so that a missing/blank config never silently
 * grants admin access to all students.
 */
export function isAdmin(email: string | undefined): boolean {
  if (!email) return false;

  const allowlist = process.env.ADMIN_EMAILS;
  const admins = (allowlist ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (admins.length === 0) {
    // No admins configured — fail closed: nobody is an admin.
    console.warn(
      "ADMIN_EMAILS is not set — admin access is disabled for everyone. " +
      "Set ADMIN_EMAILS in your environment to grant admin access."
    );
    return false;
  }

  return admins.includes(email.toLowerCase());
}
