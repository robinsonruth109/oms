# Ready to Ship - Today's Invoice Only

The **Create Invoice Batch + Download PDF** action is now restricted to the
current Bangladesh business date.

Example:

If Bangladesh today is `2026-08-25`:

Allowed:
- From Date = 2026-08-25
- To Date = 2026-08-25

Blocked:
- empty date filters
- any previous date
- any future date
- a range that includes today plus another date
- From/To values that are different from each other

## Protection

The rule is enforced twice.

### UI
The button is disabled unless:
`from === BangladeshToday && to === BangladeshToday`

A warning explains why the button is disabled.

### Server
`createInvoiceBatch()` independently verifies:
1. `fromDate` and `toDate` both equal today's Bangladesh date.
2. Every selected order has `readyToShipAt` inside today's Bangladesh day.
3. Every order is still READY_TO_SHIP and non-invoiced.
4. Courier still matches the selected filter when provided.

Therefore changing HTML/hidden fields manually cannot create an invoice batch
for a future memo.

## Not changed

- CSV / Pathao batch behavior is unchanged.
- Ready to Ship filtering is unchanged.
- Old invoice batch history remains downloadable.
- No Prisma migration is required.

Validation commands:

npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
