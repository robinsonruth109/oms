# Prisma relation validation fix

The database migration `20260824190000_pathao_problem_cod_authorization`
was already applied successfully.

This package fixes only the Prisma schema relation metadata:

- `Order.pathaoCodApprovedByUser` now uses relation name
  `OrderPathaoCodApprovedBy`.
- `User.pathaoCodApprovedOrders` is the required opposite relation field.
- `User.pathaoCodAuthorizations` keeps the separate
  `PathaoCodApprovedBy` relation used by the permanent authorization history.

No new migration is required for this schema-only relation fix.

Run:

npx prisma generate
npx eslint .
npx tsc --noEmit
npm run build
