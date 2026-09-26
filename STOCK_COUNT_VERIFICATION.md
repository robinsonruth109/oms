# Verified Stock Valuation

## Purpose

Existing Product Master balances are legacy reference data until a staff member
physically counts the inventory. The old balances **must not** contribute to
Stock Valuation, even when the recorded quantity is a positive number such as 1.

The migration adds `Product.stockVerifiedAt` and
`ProductParent.stockVerifiedAt`, both nullable and initially NULL for every
existing row. It does not delete, zero, or change any existing stock quantity.

## What the reports include

- **Variation Stock:** a physical child SKU is counted once only when its
  `stockVerifiedAt` is set.
- **Parent Stock:** the shared parent's physical stock is counted once only
  when `ProductParent.stockVerifiedAt` is set. Count physical parent units,
  never the number of selling sets.
- **Virtual bundles:** not physical assets. Bundle availability is considered
  verified in the Stock Valuation display only if every physical component
  SKU has a verified count. The bundle itself is never added to valuation.
- An unverified stock owner is listed with its historical reference quantity,
  marked **Needs count**, and contributes **0** physical units and **0 BDT**
  to valuation.
- Subsequent order dispatch, Pathao returns, damage, and regular Add/Reduce
  stock movements do not automatically turn an unverified balance into a
  verified physical count. The business can continue fulfilling orders.

## How to verify an existing SKU

1. Open **Stock Adjustment** (Admin and Manager) and search a physical SKU
   or parent code. For an unverified physical SKU, the form defaults to
   **Set Physical Count**.
2. Physically count the actual units. Enter that exact total; 0 is valid.
   For a parent-stock SKU, enter actual **parent physical units**, not
   sales/bundle quantities.
3. Submit **Verify Physical Count**. A SET_COUNT adjustment is saved with
   previous quantity, new quantity, date and staff identity. The physical
   owner is marked verified and starts contributing to Stock Valuation.
4. Alternatively, Admin can use **Product Master → Edit**, enter a physical
   count, check the explicit confirmation box, and save. Simply editing a
   name or price does not verify or overwrite a legacy stock balance.
5. If old quantity is already correct, verify that same quantity with
   Set Physical Count. There need not be a quantity difference.

## Other inventory safeguards

- Regular **Add** and **Reduce** maintain their existing stock semantics but
  do not certify an old, unverified count. Use Set Physical Count first.
- Product Master CSV imports do not certify legacy balances. They preserve
  any previously verified quantity instead of overwriting it with a CSV
  placeholder.
- Newly created manual physical inventory can start verified with its
  explicitly entered initial count. New CSV-imported inventory remains
  unverified until counted.
- Stock movement quantities and original stock-owner snapshots for shipment
  and return processing remain intact.
- The Railway Dockerfile already runs `npx prisma migrate deploy` before
  launching the server. Apply the schema migration before the new pages
  are served, and take a database backup first.

## Expected sample outcomes

| Operation | Raw stock | Verified? | Valued units |
| --- | ---: | --- | ---: |
| Existing legacy row (cost BDT 120) | 1 | No | 0 |
| Confirm actual physical count = 1 | 1 | Yes | 1 |
| Count stock again as 20 | 20 | Yes | 20 |
| Count stock as 0 | 0 | Yes | 0 |
| Legacy 1 + ordinary Add 5 without count | 6 | No | 0 |
| Verify after physical recount to 5 | 5 | Yes | 5 |

## Release checklist

- Back up production MySQL before deploying the migration.
- Run `npx prisma generate`, `npx prisma migrate deploy` and
  `npm run build` in your regular release process.
- Confirm historical unverified rows display Needs count and zero valuation.
- Confirm a Set Physical Count of 0 verifies a SKU with zero value.
- Confirm a Parent Stock count verifies the parent exactly once.
- Confirm first-count bundle components unlock verified possible-set display.
- Confirm order dispatch and Pathao returns continue to work without
  automatically verifying legacy balances.
- Confirm imported old CSV rows stay unverified and CSV does not overwrite
  previously verified stock.

**Note:** This release does not automatically reconcile old stock values.
Physical counts are a deliberate human action.
