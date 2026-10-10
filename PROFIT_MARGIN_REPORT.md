# Profit Margin Report

Route: `/dashboard/profit-margin`

Access: Admin only. The page exposes company-wide salary and advertising cost.

## Date basis

The report uses one Bangladesh calendar range for all sections.

- Pathao sales/return activity: verified, processed webhook `receivedAt`.
- Meta ads: `MetaDailySpend.spendDate`.
- Daily/Office costing: `FinanceDailyCost.costDate`.
- Salary: monthly salary expense accrued proportionally by calendar days that overlap the selected range.

Source and Courier filters apply directly to order revenue, COGS and Pathao courier costs. Salary and daily operating costs are company overhead, so filtered views allocate those shared costs by the selected slice's share of company Delivered revenue during the same dates. Meta Ads follows campaign Source mapping first; only its Courier slice uses Delivered-revenue share. The unfiltered report deducts 100% of company costs.

## Revenue

Revenue is realized only when a verified Pathao `order.delivered` webhook is present inside the selected period and no later return event in the same period supersedes it.

Realized revenue has two parts:

1. **COD / amount due:** Delivered webhook `collected_amount` / `amount_collected` / `amount_to_collect` / `cod_amount`; fallback to saved Pathao amount, approved COD override, then OMS `totalAmount`.
2. **Customer advance:** OMS `Order.advance`, added back exactly once after delivery.

This is required because OMS calculates `totalAmount = subtotal + deliveryCharge - discount - advance`. Without adding the already-received advance back, delivered revenue and profit would be understated.

`order.partial-delivery` is not included in realized P&L yet because OMS has no authoritative item-level accepted quantity/amount. It is surfaced as a warning.

## Product COGS

Delivered order items use Product Master physical buying cost:

- Variation Stock: child `purchasePrice × sold qty`.
- Parent Stock: parent `purchasePrice × unitsPerSale × sold qty`.
- Virtual Bundle: sum of component `purchasePrice × component units × sold bundle qty`.

An unlinked/missing/zero-cost item is treated as BDT 0 COGS and produces an overstatement warning.

Product Gross Margin uses order line totals for merchandise sales. Final company Net Profit uses actual Pathao realized revenue.

## Pathao courier cost

- Delivery expense: Delivered webhook `delivery_fee`, otherwise saved `Order.pathaoDeliveryFee`.
- Return expense: `order.paid-return` webhook `collected_amount` (or explicit return fee fields if Pathao sends them).
- Repeated webhook callbacks for the same order do not add return fee repeatedly; the period evaluation keeps one order outcome.

A returned parcel without a Paid Return charge is shown as a data-gap warning.

## Meta ads

Meta synced daily spend is converted to BDT:

- BDT/TK/TAKA: direct.
- USD: weighted Daily Dollar Rate for that Bangladesh date.
- Missing USD rate: BDT 0 for that spend and a warning.
- Other currencies: BDT 0 and a warning until a conversion rule exists.

When a **Source** filter is applied, Meta spend follows the saved campaign-to-Source mapping from Ads Cost Sync. If one campaign maps to multiple Sources, its spend is split by delivered order count for that mapped parent product during the report period; if no matching delivered orders exist, it is split equally across its mapped Sources.

Meta has no courier dimension. When a **Courier** filter is applied, the already Source-attributed spend is allocated by that courier's Delivered-revenue share.

## Salary

Salary expense uses Salary Management snapshots when available, otherwise the active Salary Profile from the profile creation month forward.

Monthly expense basis:

`Salary Due + Liability`

Salary Due already includes Base + Increment + Bonus - Fine. Advance/Partial/Full Salary payments are cash settlement, not a second expense.

For a partial date range, monthly salary is prorated by calendar days in the month.

## Daily Costing duplicate protection

Only KHOROCH is an expense. JOMA is cash movement and is not business revenue here.

The following categories remain visible in the cash book but are excluded from P&L to avoid double counting:

- Salary
- Salary Advance
- Product Purchase / Product Purches / Product Purchases

Salary is already deducted from Salary Management. Product Purchase is already recognized through delivered Product COGS.

Other Daily and Office Daily Costing categories remain operating expenses, including rent, meals, utilities, accessories purchases and Gari Vara.

## Net formula

`Net Profit = Realized Revenue - Product COGS - Pathao Delivery Fee - Pathao Return Fee - Meta Ads - Salary - Daily Costing - Office Daily Costing`

`Net Margin % = Net Profit / Realized Revenue × 100`

## Sections

- Main Revenue / COGS / Operating Cost / Net Profit cards.
- COD collected and Customer Advance are shown separately inside the full P&L calculation.
- Full P&L calculation card.
- Salary date-range card.
- Daily Costing short list.
- Office Daily Costing short list.
- Meta Ads date-range card and campaign shortlist.
- Pathao Delivery / Paid Return cost card.
- Parent Product Gross Margin table.
- Source-wise direct delivery economics.
- Courier-wise direct delivery economics.
- Pathao webhook activity cards.
- Data/accounting warnings.

No database migration is required.
