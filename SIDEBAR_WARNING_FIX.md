# Sidebar ESLint warning cleanup

Removed three unused Lucide icon imports from:
`src/app/dashboard/dashboard-navigation.tsx`

- BadgeDollarSign
- History
- WalletCards

No functional behavior changed.
No Prisma migration is required.

Run:
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
