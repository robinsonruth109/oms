# Ready to Ship Date Shift

## Purpose

The new `/dashboard/ready-date-shift` page lets ADMIN and PACKAGING_AGENT users move **non-invoiced** `READY_TO_SHIP` orders to another Bangladesh business date when packaging cannot finish the day's workload.

## Date-filter workflow

1. Open **Order Management → Ready Date Shift**.
2. Choose the existing Ready to Ship date and optionally a courier.
3. Click **Load Non-Invoiced Orders**.
4. Select one, many, or all eligible orders.
5. Choose the new Ready to Ship date.
6. Click **Shift Selected** and confirm.

The moved orders disappear from the old Ready to Ship date and become available on the target date.

## CSV workflow

1. Open the **CSV Upload** tab.
2. Upload a `.csv` file where column A contains invoice IDs.
3. An optional first-row header such as `Invoice ID` is supported.
4. Click **Upload & Preview**.
5. Valid non-invoiced `READY_TO_SHIP` matches are selected automatically.
6. Review any missing/ineligible rows, choose the new date, and click **Shift Selected**.

Up to 2,000 invoice IDs/orders can be handled in one action.

## Safety rules

- Only `READY_TO_SHIP` orders can be moved.
- Orders with `invoiceDownloaded = true` are blocked.
- The server rechecks eligibility inside the database transaction before changing dates.
- Orders already on the chosen target date are skipped.
- Every shifted order also receives an `OrderAuditEvent` entry so the change is visible in order history.

## Shift log

Every action creates one persistent shift log with:

- original date (or `Multiple dates` for a mixed CSV)
- new target date
- number of shifted orders
- method (`Date Filter` or `CSV Upload`)
- uploaded CSV filename when applicable
- user who performed the action
- exact Bangladesh date/time
- invoice ID snapshots

Example display:

`16 orders shifted from 28-08-2026 to 29-08-2026 by Default Admin at 28 Aug 2026, 10:32:20 pm`

## Database migration

This upgrade adds:

- `ReadyToShipDateShift`
- `ReadyToShipDateShiftItem`

Run after deploying/pulling the upgrade:

```bash
npx prisma migrate deploy
npx prisma generate
```

Then restart/redeploy the application.
