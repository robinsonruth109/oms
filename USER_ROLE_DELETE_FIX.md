# User Role Type + Delete User Fix

Updated:
- Fixed TypeScript Role error in src/app/dashboard/users/actions.ts.
- Added safe permanent Delete button on desktop/mobile user lists.
- Prevents deleting current logged-in admin.
- Prevents deleting last remaining ADMIN.
- Blocks deletion when protected invoice/CSV batch history exists.
- Uses lazy Prisma import in user actions.

No new Prisma migration required.
