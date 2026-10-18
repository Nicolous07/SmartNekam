# SmartNekam Admin repair

## What this repair addresses
- Adds a guarded Supabase RPC to list registered users from `public.profiles` and their emails from `auth.users` without exposing `auth.users` directly to the browser.
- Makes `/admin/users` display real user rows (up to 100 recent records).
- Changes the overview cards to read their counts from an admin-only RPC that supports the existing `library_items` or `library_resources` table when present.
- Aligns SQL admin helper roles with `admin`, `super_admin`, and `moderator`, plus the current default admin email.

## Apply
1. Back up the Supabase database.
2. Open Supabase Dashboard → SQL Editor.
3. Run `supabase_admin_full_fix.sql` from this project. Review the email allowlist first. If you use `ADMIN_EMAILS` in `.env`, add those same authorized emails to the SQL function's allowlist; the server environment variable is not automatically visible to Postgres.
4. Deploy/run this updated project. Sign in using the authorized admin account and open `/admin/users`.
5. If you see `not_authorized`, the signed-in email/role is not on the SQL allowlist. If you see a missing-column error, compare your `profiles` columns with the fields used by the RPC before changing the schema.

## Important limitations
- This repair makes the user directory and overview counts real; it does not pretend all eight modules are fully implemented. Finance/payment provider integration, real moderation actions, role editing, certificate issuing, opportunity CRUD and comprehensive audit logging still need module-specific schema and audited server actions.
- Do not put the Supabase service-role key in client code or `NEXT_PUBLIC_*` variables.
- Test in staging before production. Admin email allowlists and role names must match your deployment.
