# Daily Cash Book - Joma / Khoroch Upgrade

## What changed

The existing Finance > Daily Costing page is upgraded into a daily cash book while preserving existing finance and salary features.

### Daily formula

Opening / Existing Balance = all Joma - Khoroch before the selected Bangladesh date.

Today Lasting Balance = Existing Balance + Today Joma - Today Khoroch.

This means a date with no activity still carries forward the previous lasting balance correctly.

### New entry types

- JOMA - money received / cash in
- KHOROCH - money spent / cash out

All old FinanceDailyCost rows are preserved and automatically treated as KHOROCH by the migration.

### Allowed methods for new entries

- Cash
- Bank
- bKash

### Expense types

- Salary
- Office Utensils
- Family Maintenance
- Salary Advance
- Office Rent
- Home Rent
- Office Meals
- Internet Bills
- Electricity Bills
- Phone Bills

### Daily PDF

The PDF uses the Trendy Deals BD office-pad header and includes:

- Existing Balance
- Today Cash In / Joma list
- Total Joma
- Khoroch list with expense type, note, method and amount
- Total Khoroch
- Closing balance by Cash / Bank / bKash
- Today Lasting Balance

Small reports use half-A4 (A5). Larger reports use A4 and continue to extra A4 pages when required.

## Database migration

`prisma/migrations/20260909120000_daily_cash_book_joma_khoroch/migration.sql`

The production Docker startup already runs `npx prisma migrate deploy` before starting the server.
