# Finance Railway Prisma Build Fix

This patch removes eager `@/lib/prisma` imports from the Finance module. Prisma/MariaDB is now loaded only when a real request/action executes. This prevents `next build` page-data collection from initializing the MariaDB adapter and throwing `prepareCacheLength`.

Affected areas:
- Salary management pages
- Salary details page
- Daily costing page
- Finance server actions
- Salary helper functions
- Finance PDF API routes

The Docker startup command now runs:

```sh
npx prisma migrate deploy && exec node server.js
```

This means migrations run against Railway's runtime `DATABASE_URL` only after the image has built successfully.
