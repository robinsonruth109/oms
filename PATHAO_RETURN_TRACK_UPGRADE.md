# Pathao Return Track Upgrade

## Access
- ADMIN
- PACKAGING_AGENT
- Sidebar: Pathao -> Pathao Return Track
- URL: `/dashboard/pathao-return-track`

## Return scan workflow
1. Scan or type the Pathao return consignment ID and press Enter.
2. OMS checks every active courier where Pathao API is enabled, in parallel.
3. OMS reads Pathao `merchant_order_id` (with `invoice_id` fallback) and matches it to `Order.invoiceId`.
4. The original outbound consignment ID is rejected if scanned by mistake.
5. One item with quantity 1 is processed immediately.
6. If the invoice has multiple products or any product quantity greater than 1, the agent must select the physically returned product quantities.
7. OMS stores an idempotent return log, restores selected Product Master quantity, writes an Order Audit Event, and updates OMS order status.

## Full vs partial return
- A partial return sets OMS order status to `PARTIAL_RETURN`.
- The system remembers cumulative returned quantity per order item.
- A later return consignment for the same invoice can return the remaining products.
- Once all ordered quantities have been returned, OMS status becomes `RETURNED`.
- An order already in `RETURNED` is blocked and stock is not changed.

## Duplicate protection
`PathaoReturnTrack.returnConsignmentId` is unique. Re-scanning the same return consignment cannot restore stock twice.

In addition, cumulative return quantities are capped at the original ordered quantities, so multiple return consignments cannot restore more units than the order contained.

## Stock audit
Each returned item stores:
- Product/SKU snapshot
- ordered quantity
- quantity returned in this scan
- stock quantity before restore
- stock quantity after restore

## Daily list
The page defaults to today's Bangladesh date and can filter by date. It shows:
- OMS invoice ID
- return consignment ID
- original outbound consignment ID
- Pathao courier account
- customer
- returned items and quantities
- full/partial return type
- previous and new OMS status
- Pathao status captured at scan time
- restored quantity
- processing agent
- Bangladesh date/time

## Database migration
Run before production build:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run build
```

Migration:
`prisma/migrations/20260829233500_pathao_return_track/migration.sql`

## Important inventory note
This return workflow increments `Product.quantity` exactly by the physically selected returned quantity and records before/after stock values. Verify that your operational outbound workflow reduces the same Product Master quantity when parcels leave stock; otherwise any automatic return increment would increase inventory without a matching outbound deduction.
