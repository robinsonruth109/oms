OMS Calling Panel Upgrade
=========================

This package contains FULL REPLACEABLE FILES for two requested upgrades:

1) Multi-agent order card locking
   - Clicking a Calling Panel card claims/holds the order for the current agent.
   - "Hold by: <agent>" is shown on the card.
   - Another agent cannot work on the held card.
   - Clicking another agent's card shows:
     "<Agent> is calling this order. Try another one."
   - Submit and Direct Cancel automatically release the hold.
   - Holds auto-expire after 10 minutes so abandoned cards do not stay locked forever.
   - Server-side atomic claim prevents two agents from successfully claiming the same order at the same time.

2) Incomplete address warning
   - Short/incomplete addresses get a red Address box.
   - A Bangla warning is shown below the field.
   - This is visual only and does not block Submit.

INSTALL
-------
Extract this ZIP into:
D:\oms\oms-app

Choose "Replace files in destination" when Windows asks.

Then run:

cd D:\oms\oms-app

npx prisma migrate deploy
npx prisma generate

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

npx eslint .
npx tsc --noEmit
npm run build
npm run dev

TEST MULTI-AGENT LOCK
---------------------
1. Login as Agent A in Browser/Profile A.
2. Login as Agent B in Browser/Profile B.
3. Both open /dashboard/call.
4. Agent A clicks an order card.
5. Agent A should see "Hold by: <Agent A>" / "Held by you".
6. Agent B clicks the same card.
7. Agent B should see the warning modal and cannot edit the card.
8. Agent A clicks Submit.
9. The hold is released.

DATABASE CHANGE
---------------
Order gets:
- holdByUserId
- holdAt
- holdUntil

User gets relation:
- heldOrders

The included migration is:
prisma/migrations/20260822004500_add_calling_order_hold/migration.sql
