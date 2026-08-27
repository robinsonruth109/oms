# Ready To Ship Date timezone fix

Ready To Ship Date is a Bangladesh business-calendar date.

Example:
- Selected: 2026-08-27
- Bangladesh midnight: 2026-08-27 00:00 Asia/Dhaka
- Stored UTC instant: 2026-08-26 18:00 UTC

The UTC storage is correct. The bug was reading that value back with
`toISOString().slice(0, 10)`, which returns the UTC calendar date (26) rather
than the Bangladesh calendar date (27).

This upgrade uses the project's Bangladesh-time helpers consistently:
- write business date: `bangladeshBusinessDateToUtc(...)`
- render business date: `getBangladeshDateInputValue(...)`

Updated:
- All Orders View/Edit
- All Orders update action
- Calling Panel list/detail
- Calling Panel date fallback
- Ready-to-Ship CSV date output

Manual Orders already used the Bangladesh business-date write helper.

No Prisma migration is required.

Validation:
```powershell
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
```
