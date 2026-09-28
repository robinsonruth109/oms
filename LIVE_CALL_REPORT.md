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

## Hourly calling chart

The chart appears below Agent Wise Live Performance and uses the **same**
`calledOrders` query, selected Bangladesh date range and agent filter.

- Bangladesh clock hour = `(calledAt.getUTCHours() + 6) % 24`.
  Dates continue to use the existing Bangladesh-day UTC range helpers.
- All Agents: a stacked hourly bar compares the selected active calling
  agents by their real `calledAt` time. Agent view: only their own data.
- Calls / Hour: raw number of calls for each local clock hour (00 to 23).
- Agent Share %: each agent's fraction of all calls in that *same clock
  hour*. Hover/select a bar to see individual counts and percentages.
- For multiple dates the graph combines corresponding clock hours from all
  selected dates (for example, every 10 AM–11 AM interval in the range).
- One order is counted once from its `calledAt`, independently of its later
  OMS order-status changes. Total hourly count equals Total Called above.
- Every chart bar is also keyboard-selectable, with agent breakdown shown
  in text below. It scrolls horizontally on narrow screens.
- Live Refresh already refreshes the server report approximately every
  30 seconds. The chart refreshes with the rest of the page.
- No schema migration or chart package is needed.

Recommended release checks:
1. Call at 09:59 Bangladesh time and at 10:00; confirm separate buckets.
2. Select one agent; confirm neither graph nor breakdown shows another agent.
3. Compare total of 24 hourly counts against Total Called.
4. Repeatedly open the report on a phone and use horizontal scrolling.
5. Confirm multiple-day totals are aggregated by local clock hour, not
   by UTC date or order-import date.
