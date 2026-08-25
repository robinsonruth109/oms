# Live Call Report

New route:

`/dashboard/live-call-report`

Access:
- ADMIN
- AGENT

## Date rule

This report is intentionally based on:

`Order.calledAt`

It does **not** use:
- Order.createdAt / import date
- readyToShipAt

Date filtering is Bangladesh business time (`Asia/Dhaka`).

Example:
- Imported: 25 Aug 2026, 12:30 PM
- Called At: 25 Aug 2026, 12:32 PM

The order belongs to the Live Call Report for 25 Aug because its `calledAt`
falls on 25 Aug Bangladesh time.

## Access behavior

ADMIN:
- Can see all active AGENT users.
- Can filter one agent or all agents.

AGENT:
- Can open the report.
- Can only see their own call performance.
- Cannot switch to another agent.

NOTE_AGENT / PACKAGING_AGENT:
- No access.

## Metrics

- Total Called
- Ready to Ship
- No Answer
- Phone Off
- Stock Out
- Cancelled
- Pending
- Conversion = Ready to Ship / Total Called

The outcome is the order's current OMS status, while inclusion in the date range
is based only on `calledAt`.

## Live behavior

The report refreshes automatically every 30 seconds and also has a manual
Live/Refresh button.

No Prisma migration is required.

Validation:

npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
