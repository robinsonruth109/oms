# Ready to Ship - Push All to Assigned Couriers

## Purpose
Adds a one-click **Push All to Couriers** action to the **Ready to Ship > Non CSV** tab.

## Behaviour
- Respects the current Ready to Ship filters:
  - Courier filter
  - From Date
  - To Date
- With **All Couriers** selected, OMS groups every matching Non CSV order by the courier already assigned on the order.
- With one courier selected, OMS only submits matching orders for that courier.
- The backend processes all matching orders from the database, not only the first 200 rendered in the table.
- Each courier group is submitted using that courier's own Pathao API credentials and Store ID.
- Large groups are split into conservative chunks of 50 orders.
- Successful orders are marked `csvDownloaded = true` and move to the **CSV Downloaded** tab.
- A CSV batch-history record is created for every successful courier/API chunk.
- An `OrderAuditEvent` with event type `PATHAO_PUSH_ALL` is recorded for every successfully pushed order.

## Safety
- Orders already submitted/being submitted to Pathao are skipped.
- Each order is claimed independently before the external API call to reduce duplicate submissions from simultaneous clicks/users.
- Invalid phone/name/address/invoice records remain in **Non CSV** with the validation error recorded.
- Couriers that are inactive, missing, or do not have Pathao API + Store ID configured are skipped; their orders remain retryable.
- Failed Pathao API chunks are returned to `FAILED`, not marked CSV-downloaded.
- The UI asks for confirmation before the operation begins.

## Database
No Prisma schema change or migration is required.
