# Bangladesh Timezone + Date Filter Rules

This upgrade makes OMS business dates independent from the Railway hosting region.

## Business timezone
All business reporting uses:
- `Asia/Dhaka`
- UTC+06:00
- Bangladesh calendar day from 00:00:00 through 23:59:59.999

Database timestamps remain UTC. We DO NOT manually add six hours to stored timestamps.

## Date filter rules

### Uses Order.createdAt (import/create date)
- Dashboard daily metrics
- Calling Panel imported-from / imported-to
- Daily Source Status Report
- Reports
- Product Report

This means an order imported on 22 Aug in Bangladesh belongs to the 22 Aug report
even if Railway is running in the USA.

### Uses Order.readyToShipAt
- Ready to Ship page ONLY

Ready-to-Ship filtering is therefore independent from the original import date.

## Display rules
- Calling Panel Imported / Called / Hold times render explicitly in Asia/Dhaka.
- Ready-to-Ship business date renders as date only (for example `29 Aug 2026`).
- Invoice/CSV batch creation timestamps render explicitly in Asia/Dhaka.

## Shared utility
`src/lib/bangladesh-time.ts`

Important helpers:
- `getBangladeshDateInputValue()`
- `bangladeshDateStartUtc()`
- `bangladeshDateEndUtc()`
- `getBangladeshTodayRange()`
- `bangladeshBusinessDateToUtc()`
- `formatBangladeshDateTime()`
- `formatBangladeshDate()`

No Prisma migration is required for this timezone/filter change.
