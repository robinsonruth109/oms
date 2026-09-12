# OMS Exchange Panel Upgrade

## What was added

- New **Order Management → Exchange Panel**.
- Access: `ADMIN`, `AGENT`, `NOTE_AGENT`, `PACKAGING_AGENT`.
- Search the historical/original OMS order by phone number or invoice code.
- Shows original OMS status, Pathao status, outbound consignment ID, courier and ordered items.
- Workflow is **manual Pathao first**: agent creates the exchange parcel in Pathao Merchant Panel, then records the Pathao Exchange Parcel/Consignment ID in OMS.
- Exchange creation never edits the original historical order. OMS creates a linked exchange memo such as:
  - `EX-GS118113-01`
  - `EX-GS118113-02`
- Agent can choose the product/quantity expected back from the customer.
- Agent can increase/decrease outgoing quantities, remove products, add a different SKU, and edit outgoing unit price.
- Exchange reason, note and exchange/delivery charge are supported.
- OMS calculates:
  - returned product credit
  - outgoing subtotal
  - delivery/exchange charge
  - amount to collect
  - customer credit if the return value is higher
- New exchange memo is created with:
  - `orderKind = EXCHANGE`
  - `orderStatus = READY_TO_SHIP`
  - `invoiceDownloaded = false` → appears under **Non Invoiced**
  - `csvDownloaded = true` → appears under **CSV Downloaded**
  - `pathaoSubmissionStatus = CONSIGNMENT_CREATED`
  - saved Pathao Exchange CID
- Because `csvDownloaded = true` and a Pathao CID is already attached, OMS will not submit the exchange parcel to Pathao a second time.
- Ready to Ship displays an **EXCHANGE** badge on exchange memos.
- Exchange history includes original invoice, customer, exchange CID, expected-return items, outgoing items, collection amount, OMS memo status and Pathao verification.
- Exchange detail page includes manual **Verify Exchange CID** against the Pathao order-info API.
- Pathao webhook events containing an exchange/exchanged lifecycle automatically mark the matching exchange case as verified / `PATHAO_EXCHANGED`.
- Stock is **not restored when exchange is issued**. Old product stock is restored only when the physical returned parcel is processed through the existing **Pathao Return Track** flow.
- Exchange detail calculates physical return progress from Pathao Return Track records created after the exchange case.

## Reporting protection

Exchange memos are real operational Order rows so Ready to Ship and invoice printing work without a second system. To prevent exchange memos from inflating ordinary sales/calling analytics, `orderKind = NORMAL` was added to key business reports:

- Main dashboard statistics
- Reports
- Product Report
- Daily Source Status
- Ads Cost Report
- Calling Panel previous-order lookup

All existing orders migrate as `NORMAL` automatically.

## Database migration

`prisma/migrations/20260912173000_exchange_panel/migration.sql`

Adds:

- `Order.orderKind`
- `ExchangeCase`
- `ExchangeCaseItem`
- Exchange enums and indexes

The project already starts Railway with `npx prisma migrate deploy`, so after a successful Docker build the production migration is applied automatically.

## Main files

- `src/app/dashboard/exchange/page.tsx`
- `src/app/dashboard/exchange/exchange-panel-client.tsx`
- `src/app/dashboard/exchange/actions.ts`
- `src/app/dashboard/exchange/[caseId]/page.tsx`
- `src/app/dashboard/exchange/[caseId]/exchange-verify-button.tsx`
- `src/app/api/webhooks/pathao/[courierId]/route.ts`
- `src/app/dashboard/ready-to-ship/page.tsx`
- `src/app/dashboard/ready-to-ship/ready-to-ship-client.tsx`
- `src/app/dashboard/dashboard-navigation.tsx`
- `src/proxy.ts`
- `prisma/schema.prisma`
