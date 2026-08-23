# Pathao Upgrade Build Fix

This package contains the full Pathao API/Webhook upgrade plus the fixes for the reported local validation errors:

- `src/app/dashboard/couriers/actions.ts`
  - changed non-reassigned `selected` from `let` to `const`
- `src/app/dashboard/pathao-orders/page.tsx`
  - removed unused `Link` import
- `src/app/dashboard/ready-to-ship/actions.ts`
  - imported `PreparedPathaoOrder`
  - explicitly typed `prepared` as `PreparedPathaoOrder[]`

The previously-applied migration remains:
`20260823141000_pathao_api_webhook_control`

Do not create or apply a second migration for these build-only fixes.
