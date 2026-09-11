# Calling Panel Customer Last Order + Bangladesh Date Guard

## Added

- Automatically checks the current calling-panel customer phone against previous OMS orders.
- Uses normalized Bangladesh phone matching so historical `+8801...`, `8801...`, and `01...` values can match.
- Shows the most recent previous order created before the current order.
- Shows the previous OMS status, including a strong warning when it was `CANCELLED`.
- Shows Pathao status when that previous order was submitted to Pathao, plus consignment ID/courier when available.
- Adds **View Last Order** to open the full OMS order history/detail page.
- If no prior order exists, the calling card says so.

## Ready To Ship date protection

- Calling-panel date input now has a minimum of the current Bangladesh business date.
- Existing old queued orders default to today if their stored Ready To Ship date is already in the past.
- Selecting/typing a past date shows a red warning.
- Client submit is blocked for a past Ready To Ship date.
- Server action independently blocks the same condition, so the rule cannot be bypassed from the browser.
- Full Calling Panel order edit page has the same protection.

## Database

No Prisma migration is required for this upgrade.
