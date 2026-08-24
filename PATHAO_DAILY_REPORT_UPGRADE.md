# Pathao Daily Report Upgrade

New page:
`/dashboard/pathao-daily-report`

Access:
- ADMIN
- PACKAGING_AGENT

## Filter rule
The page date filter uses `Order.readyToShipAt` in Bangladesh (`Asia/Dhaka`) calendar time.

## Memo rule
Within the selected Ready-to-Ship date cohort, memo age is grouped by `Order.createdAt` (import/create date).

Example for a 24-08 Ready-to-Ship filter:
- Today Memo 24-08 = orders imported/created on 24-08
- 23-08 Memo = orders imported/created on 23-08
- 22-08 Memo = orders imported/created on 22-08

Columns are generated dynamically from the actual import dates found in the selected cohort.

## Courier report
Each courier row shows:
- Total memo
- Selected/today memo count
- Previous-date memo columns
- Stock-out count in that Ready-to-Ship cohort
- Pathao verified count
- Missing consignment-ID count
- Pathao match percentage

## Pathao verification
An OMS order is considered verified in Pathao when `pathaoConsignmentId` is present.
The detail table shows every order and includes a `View in Pathao` button when a consignment ID exists.

## Stock Out
Two values are surfaced:
- Stock-out orders inside the selected Ready-to-Ship cohort
- Stock-out actions actually performed on the selected Bangladesh date (from PostPrintActionLog)

No Prisma migration is required.
