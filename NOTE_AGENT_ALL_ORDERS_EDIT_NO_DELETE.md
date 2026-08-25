# Note Agent - All Orders Update Permission

Updated All Orders permissions.

## NOTE_AGENT

Allowed:
- Open `/dashboard/all-orders`
- Search orders
- Open `/dashboard/all-orders/[orderId]`
- Edit customer name
- Edit phone
- Edit address
- Change Page
- Change Ready To Ship Date
- Add / replace / remove products
- Change quantity
- Change discount / advance / delivery charge
- Change courier
- Change status
- Change note
- Click **Update Order**

Not allowed:
- Delete an order
- Bulk delete orders

## Security

Delete protection is enforced in two places:

1. UI:
   - Delete buttons are hidden for non-ADMIN users.
   - Bulk Delete and row-selection checkboxes are hidden for non-ADMIN users.

2. Server actions:
   - `deleteOrderAction` remains `ADMIN` only.
   - `bulkDeleteOrdersAction` remains `ADMIN` only.

`updateAllOrder` now allows:
- ADMIN
- AGENT
- NOTE_AGENT

No database / Prisma migration is required.

Run:
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
