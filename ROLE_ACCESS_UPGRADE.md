# OMS Role Access Upgrade

Added two new user roles:

- NOTE_AGENT — can access only `/dashboard/orders`.
- PACKAGING_AGENT — can access only `/dashboard/ready-to-ship` and `/dashboard/post-print-actions`.

ADMIN remains full-access. Existing AGENT behavior remains unchanged.

## Security

Access is enforced in three layers:

1. `src/proxy.ts` redirects restricted roles away from unauthorized dashboard routes.
2. The allowed pages verify the current session role server-side.
3. Server actions/API downloads verify the role before writing or downloading data.

## Database migration

`prisma/migrations/20260822133000_add_note_packaging_roles/migration.sql`

## After replacing project files

```powershell
cd D:\oms\oms-app
npx prisma migrate deploy
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
npm run dev
```

Then create the new roles from Dashboard → Manage Users.
