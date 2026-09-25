# Inventory Stock Ledger Upgrade

## Purpose

This upgrade separates product definition from real inventory.

Existing `Product.quantity` values are treated as legacy/assumed data only. They are **not** copied into live stock and are **not** used as Units per Sale.

A new nullable `Product.unitsPerSale` field defines physical stock consumption, while `InventoryStock` stores the real current balance.

No existing product is stock-tracked automatically.

## Inventory modes

### Shared Parent Stock

Use when all child SKUs consume the same physical item stock.

Example:

- Parent A opening stock: 500 physical pcs
- Average cost: BDT 100 / physical pc
- A-1 Units per Sale: 1
- A-2 Units per Sale: 2
- A-3 Units per Sale: 5

Selling A-3 x 1 deducts 5 physical pcs from Parent A.

### Variant / Child Stock

Use when each child variation has independent stock and cost.

Example:

- B-Large: 100 pcs, avg cost BDT 200, sell BDT 400
- B-Medium: 200 pcs, avg cost BDT 150, sell BDT 300
- B-Small: 300 pcs, avg cost BDT 100, sell BDT 200

Each child has its own `InventoryStock`.

## Activation cutoff

Live inventory starts only when an Admin opens:

`Products & Content -> Stock Control & Valuation`

and saves the first real physical count.

The first save creates:

- `InventoryStock`
- `OPENING_STOCK` movement
- `activatedAt`

Historical orders, old assumed quantities, old purchases and old returns are not backfilled.

## Stock movements after activation

### Sale / issue

Stock is deducted only after Pathao accepts the order and OMS successfully marks the order as CSV/submitted through:

- Create CSV Batch + Download CSV
- Push All to Couriers

Movement: `SALE_CSV`

Deduction:

`ordered quantity x Units per Sale`

A unique ledger key prevents the same order from deducting the same stock target twice.

### Purchase received

A Purchase Received entry adds physical units only if its stock target has already been activated.

Movement: `PURCHASE_RECEIVED`

Purchase quantity is physical quantity and is **not multiplied** by Units per Sale.

Weighted average:

`new average = (old positive stock value + incoming landed value) / total positive units`

If existing quantity is zero/negative, the new received landed unit cost becomes the new average-cost basis.

Partial receipts allocate purchase payment value proportionally to the received quantity before adding batch CNF and other costs.

### Pathao return

A Pathao return restores:

`returned order quantity x Units per Sale`

Movement: `PATHAO_RETURN`

Return does not change weighted-average cost.

### Manual stock count

After activation, entering a new actual count creates a `MANUAL_ADJUSTMENT` movement instead of rewriting history silently.

## Zero and negative stock

Zero/negative stock never blocks:

- customer order creation
- Ready-to-Ship
- Create CSV Batch
- Push All
- Pathao return flow

It is displayed as a warning and remains visible in Stock Control / Product Master.

Public storefront checkout remains orderable; low/negative tracked inventory is treated as requiring stock confirmation rather than disabling the order button.

## Valuation

Stock valuation is calculated from live inventory only:

`current physical quantity x moving weighted-average landed cost`

Stock Control shows:

- tracked stock targets
- current physical units
- total valuation
- zero/negative targets
- target-level valuation
- recent stock ledger movements

## Safe existing-product rollout

For each existing Parent:

1. Search it in Stock Control & Valuation.
2. Choose Shared Parent or Variant mode.
3. Explicitly confirm Units per Sale.
4. Enter the actual physical stock count.
5. Enter current average physical unit cost.
6. Click Activate Stock Tracking.

Only events after activation affect that target.

## Suggested acceptance test

### Shared Parent A

1. Create/choose A-1, A-2, A-3.
2. Activate A as Shared Parent with:
   - stock 500
   - cost 100
   - A-1 = 1
   - A-2 = 2
   - A-3 = 5
3. Push one order containing A-3 x 1 through CSV.
4. Expected stock: 495.
5. Process its Pathao return.
6. Expected stock: 500.

### Variant Parent B

1. Activate B-Large stock 100 cost 200, Units/Sale 1.
2. Activate B-Medium stock 200 cost 150, Units/Sale 1.
3. Activate B-Small stock 300 cost 100, Units/Sale 1.
4. CSV one B-Large order x 1.
5. Expected:
   - Large 99
   - Medium 200
   - Small 300

### Weighted average

With A at 500 pcs @ BDT 100, receive 100 physical pcs @ landed BDT 120.

Expected:

- Qty 600
- Average cost BDT 103.3333
- Value about BDT 62,000

### Negative stock

Set stock to 3, then CSV one A-3 order.

Expected:

- balance -2
- warning shown
- CSV/Pathao submission still succeeds
