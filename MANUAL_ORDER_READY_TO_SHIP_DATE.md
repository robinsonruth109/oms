# Manual Order Ready to Ship Date

Updated `/dashboard/orders`.

Manual order entry now includes a required **Ready to Ship Date** field.

Behavior:
- Defaults to today's Bangladesh date (`Asia/Dhaka`).
- Admin/Note Agent can select another date before creating the order.
- The selected business date is converted with the existing
  `bangladeshBusinessDateToUtc()` helper.
- `Order.readyToShipAt` now uses the selected date instead of `new Date()`.
- No Prisma/database migration is required.
- Existing order creation, invoice serial generation, courier selection,
  products, pricing, and READY_TO_SHIP status are unchanged.

Validation:
- Missing date blocks order creation.
- Invalid date returns a user-friendly error.

Run:
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
