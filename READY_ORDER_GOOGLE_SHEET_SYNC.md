# Ready Order Google Sheet Sync

## Final scheduling design

There is **no Railway cron** and **no editable sync time**.

Automatic synchronization is fixed to:

**10:30 PM Bangladesh time (Asia/Dhaka) every day**

The Next.js OMS server starts an internal scheduler through
`src/instrumentation.ts`. It checks once per minute.

Once the Google Service Account credentials are saved:
- before 10:30 PM: nothing runs
- at/after 10:30 PM: today's READY_TO_SHIP orders are synced
- once today's automatic sync succeeds, it will not run a second time that day
- if Railway restarts after 10:30 PM before the daily sync completed, the
  scheduler catches up after startup

## Manual sync

Admin can also open:

`/dashboard/sheet-sync`

and use **Run Sync Now** for any selected Ready To Ship business date.

Duplicate protection remains enabled, so running the same date again does not
create duplicate order rows.

## Data selection

Orders are selected by:
- `orderStatus = READY_TO_SHIP`
- `readyToShipAt` within the selected Bangladesh business date

## Google Sheet

Default:
- Spreadsheet: Data Storage For OMS
- Sheet tab: Data

## Important deployment note

The automatic scheduler runs inside the OMS Railway application process.
Therefore the Railway service must remain running for the 10:30 PM automatic
trigger. The manual sync button remains available at all times.

No separate cron service, `SHEET_SYNC_CRON_URL`, or
`SHEET_SYNC_CRON_SECRET` is required.

## Validation

```powershell
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
```
