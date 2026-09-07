# Ready Order Google Sheet - Existing Data Upgrade

This upgrade keeps the new Ready Order Google Sheet format for future syncs and
adds an ADMIN-only one-time migration tool for the existing historical rows.

## Location

Dashboard -> Ready Order Sheet Sync -> Upgrade Existing Sheet Data

## Required final columns

- A: UUID
- B: Invoice ID
- C: Invoice ID (intentional duplicate)
- D: Source Name
- E: Date
- F: Customer Name
- G: Phone Number
- H: Address
- I:AN: Product Parent Code / Product SKU / Product Price / QTY for product 1-8
- AO: DV Cost
- AP: Advance
- AQ: Discount
- AR: Grand Total
- AS: Note
- AT: Status

## Safety flow

1. Click **Check Existing Rows**.
2. OMS reads the existing Google Sheet and matches every non-empty row to an
   OMS order by UUID first and Invoice ID second.
3. If any row cannot be matched, the migration stops and changes nothing.
4. If an order has more than eight product lines, the migration stops and
   changes nothing.
5. Click **Backup & Upgrade Existing Rows** after the pre-check passes.
6. OMS duplicates the complete Data tab to a timestamped backup tab.
7. OMS rewrites the original Data tab in place, preserving row order and blank
   rows.

## Data source

The rebuilt values come from OMS so old spreadsheet formatting problems are
fixed:

- Phone is written as text with `RAW`, preserving the leading zero.
- Bangla names/addresses are written as Unicode.
- Product parent SKU, product SKU, order unit price and quantity are rebuilt
  from the OMS order items.
- The historical business date uses the original Ready Order sync date when it
  exists, otherwise the existing row date, then `readyToShipAt` as fallback.
- Status is written as `Ready` because each historical row represents a Ready
  to Ship storage event, even if the live OMS order status changed later.

## Future rows

Normal automatic/manual sync continues to append only new orders using the same
46-column format and duplicate protection.

## Database

No Prisma migration is required for this feature.
