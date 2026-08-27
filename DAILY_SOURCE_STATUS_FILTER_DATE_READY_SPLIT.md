# Daily Source Status - Filter Date Ready Split

The Daily Source Status report remains filtered by order import/create date (`createdAt`).

For the filtered import-date cohort:

- `Ready` = current `READY_TO_SHIP` orders.
- `Today Ready` = those Ready orders whose `readyToShipAt` equals the report's selected filter date.
- `Date Memo` = those Ready orders whose `readyToShipAt` is after the report's selected filter date.

For the normal daily report where From Date = To Date (for example 2026-08-27):

- Ready = imported on 27 Aug + READY_TO_SHIP
- Today Ready = imported on 27 Aug + READY_TO_SHIP + Ready To Ship Date = 27 Aug
- Date Memo = imported on 27 Aug + READY_TO_SHIP + Ready To Ship Date > 27 Aug

The calculation no longer compares against the actual current date.

If a From/To range is used, the To Date is the Ready To Ship comparison/cutoff date.

No Prisma migration is required.
