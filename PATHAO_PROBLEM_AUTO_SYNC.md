# Pathao Problem - Automatic Amount Sync

This update fixes the large `NEEDS SYNC` list on `/dashboard/pathao-problem`.

## Why old rows showed NEEDS SYNC

Those orders had:
- a Pathao consignment ID
- an OMS total
- but `Order.pathaoAmountToCollect = NULL`

Without Pathao's actual Amount to Collect, OMS could not classify the parcel as
GOOD / AUTHORIZED / UNAUTHORIZED.

## New behavior

### Automatic sync
When Pathao Problem is opened for a Ready to Ship date, the browser
automatically calls:

`POST /api/pathao/problem-sync`

Unsynced consignments are checked in safe batches:
- 20 orders per request
- 4 Pathao API calls concurrently
- up to 20 client rounds (400 parcels)

This prevents one very long Railway request.

### Manual button
A **Sync Pathao Amounts** button forces a fresh check.

### Classification after sync

- Pathao amount = original OMS total -> GOOD (hidden from problem list)
- Pathao amount = authorized COD -> AUTHORIZED
- Pathao amount differs with no authorization -> UNAUTHORIZED DIFFERENCE
- Pathao amount differs from authorized COD -> AUTHORIZED BUT PATHAO MISMATCH
- Pathao did not expose Amount to Collect -> NEEDS SYNC remains

### Retry safety
If Pathao responds but does not include Amount to Collect, or a request fails,
`pathaoLastSyncedAt` is updated. Automatic sync waits 10 minutes before retrying
that parcel. This prevents endless request loops.

### Future Pathao submissions
When OMS creates a Pathao parcel batch, it now immediately stores the exact
`amount_to_collect` sent to Pathao as `pathaoAmountToCollect`.

Therefore new parcels do not start as NEEDS SYNC. Later webhooks/manual syncs
can replace that value if the courier COD is changed.

## Security
Only:
- ADMIN
- NOTE_AGENT

can call the bulk sync endpoint, matching the Pathao Problem page permissions.

## Database
No Prisma migration is required. Existing fields are reused:
- pathaoAmountToCollect
- pathaoLastSyncedAt
- pathaoLastError
- pathaoRawResponse

## Validation

npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
