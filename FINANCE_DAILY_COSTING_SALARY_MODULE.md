# Finance - Daily Costing & Salary Module

## Access

- Daily Costing: ADMIN only
- Salary Management: ADMIN only
- My Salary: AGENT, NOTE_AGENT, PACKAGING_AGENT (read-only)
- Salary detail route: ADMIN can view every agent; non-admin users can only view themselves
- Salary Day PDF: ADMIN only

## Daily Costing

Route: `/dashboard/finance/daily-costing`

Fields: Bangladesh business date, category, description, amount, payment method, note, entered-by admin.

Daily PDF: `/api/finance/daily-costing/pdf?date=YYYY-MM-DD`

- Up to 10 entries: A5 portrait (half A4)
- More entries: A4 portrait
- Long reports paginate automatically

## Salary

Admin route: `/dashboard/finance/salary`
Agent route: `/dashboard/finance/my-salary`

A salary profile is created only when Admin explicitly sets a base salary. Only enabled salary profiles appear on the monthly Salary Day PDF.

Permanent profile fields:
- Base salary
- Increment

Monthly transaction types:
- Bonus
- Advance Salary
- Liability / Other Payable
- Liability Payment
- Fine
- Partial Salary
- Full Salary

Salary calculation:
- Salary due = Base + Increment + Bonus - Fine
- Salary paid = Advance + Partial + Full
- Salary balance = Salary due - Salary paid
- Liability balance = Liability added - Liability paid
- Total outstanding = Salary balance + Liability balance

Each salary month snapshots Base Salary and Increment when that month first becomes active. Later profile changes apply to later months and do not rewrite an existing month's historical snapshot.

## Salary Day PDF

Route: `/api/finance/salary-sheet/pdf?month=YYYY-MM`

A4 landscape office salary pad with:
- Trendy Deals BD
- 01712969880
- Auth by Abdullah al sabbir
- SL
- Agent Name
- Base Salary
- Increment
- Bonus
- Advance
- Liabilities (unpaid)
- Fines
- Net Payable
- Signature

Only enabled salary profiles are included.

## Migration

`prisma/migrations/20260907213000_finance_salary_module/migration.sql`
