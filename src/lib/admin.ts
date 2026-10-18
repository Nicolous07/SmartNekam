const STAFF_ROLES = ['moderator', 'super_admin', 'school_admin']

function configuredAdminEmails(): string[] {
  return (process.env.SMARTNEKAM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Runs on the server. When an explicit admin-email allowlist is configured,
 * only allowlisted accounts with the database super_admin role can access the
 * admin panel. Without the allowlist, legacy staff-role behavior is retained.
 */
export function isStaffUser(role: string | null | undefined, email?: string | null): boolean {
  const allowlist = configuredAdminEmails()
  const normalizedEmail = email?.trim().toLowerCase()

  if (allowlist.length > 0) {
    return Boolean(normalizedEmail && allowlist.includes(normalizedEmail) && role === 'super_admin')
  }

  return Boolean(role && STAFF_ROLES.includes(role))
}
