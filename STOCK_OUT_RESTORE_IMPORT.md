# Stock Out Restore Import

New page:
`/dashboard/stock-out-import`

Access:
- ADMIN
- PACKAGING_AGENT

## Workflow

1. Upload historical Stock Out CSV.
2. OMS parses and previews every row. Nothing is saved yet.
3. OMS automatically attempts to match:
   - Page by normalized Page Name.
   - Source and Courier from an existing invoice, otherwise from the most
     recent historical OMS order for the matched page.
   - Product by exact SKU, normalized SKU, then unique Parent SKU.
4. Review screen lets staff manually select:
   - Page
   - Source
   - Courier
   - Product
   - Import date
   - Customer / phone / address
   - Product quantity / price
5. Bottom Send button only activates when every included row is valid.
6. Commit behavior:
   - Invoice does not exist: create historical order in READY_TO_SHIP.
   - Invoice exists with STOCK_OUT: restore/update that existing order to
     READY_TO_SHIP. No duplicate invoice.
   - Invoice exists with any other status: preview blocks the row.
7. New historical orders preserve the CSV Date as `Order.createdAt`.
8. All committed/restored orders get a fresh `readyToShipAt = now`, and:
   - invoiceDownloaded = false
   - csvDownloaded = false
   This makes them appear in Ready to Ship for invoice printing and the
   current Pathao courier workflow.

## Phone normalization

Historical numeric phone cells such as:
`1857377933`
are normalized to:
`01857377933`

Bangla digits are also converted to English using the existing shared phone
normalizer.

## Audit

Every run creates:
- StockOutRestoreBatch
- StockOutRestoreItem

The page shows the last 30 import batches with Imported / Restored / Skipped /
Failed counts.

## Migration

`20260824201500_stock_out_restore_import`

Run:
1. `npx prisma migrate deploy`
2. `npx prisma generate`
3. `npx eslint .`
4. `npx tsc --noEmit`
5. `npm run build`
