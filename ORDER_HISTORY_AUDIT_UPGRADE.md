# All Order View / Edit - Order History Audit

New Order History section shows:
- Order created/imported by whom/source and time
- Called by whom and Called At
- Invoice batch printed/downloaded by whom, batch number and time
- Post-print cancellation/stock-out performer
- All future All Orders edits with the user and time
- Direct Calling Panel cancellation
- Calling submissions going forward

## Printed memo protection
If `invoiceDownloaded = true`:
- A large amber warning is shown on the edit page.
- Clicking Update Order displays a confirmation warning.
- Update is still allowed.
- Successful update says to contact the Packaging Section immediately.
- The update is recorded as `UPDATED_AFTER_PRINT`.

## Historical data
Existing invoice batch, calledBy/calledAt and post-print action records are shown immediately.
For old imported orders with no human creator audit, the integration/source is shown as the creator.
New manual orders record the actual creating user.

## Migration
`20260826011000_order_history_audit`

Run:
1. npx prisma migrate deploy
2. npx prisma generate
3. Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
4. npx eslint .
5. npx tsc --noEmit
6. npm run build
