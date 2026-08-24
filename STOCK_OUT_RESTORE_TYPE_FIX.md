# Stock Out Restore TypeScript Fix

The migration `20260824201500_stock_out_restore_import` was already applied successfully.

The TypeScript errors came from `ReviewRow` intersecting `StockOutPreviewRow`
while redefining its `items` property. TypeScript continued to expose
`row.items` as the original `StockOutPreviewItem[]` in several callbacks.

Fixed by:
- introducing `ReviewItem`
- defining `ReviewRow` as `Omit<StockOutPreviewRow, "items">`
- replacing `items` with `ReviewItem[]`

No new Prisma migration is required.

Run:
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
