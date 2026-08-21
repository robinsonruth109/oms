# Railway Auth / Prisma Build Fix

Root cause:
`src/lib/auth.ts` imported `prisma` at module scope. Every page/API route importing `authOptions`
therefore initialized the MariaDB adapter while Next.js was collecting route data during `next build`.
That produced:

`TypeError: Cannot read properties of undefined (reading 'prepareCacheLength')`

Fix:
- Removed top-level `import { prisma } from "@/lib/prisma"`.
- Prisma is now loaded lazily only inside the Credentials `authorize()` request handler:
  `const { prisma } = await import("@/lib/prisma");`

This is a global fix for protected pages/routes that import `authOptions`, including:
- /dashboard/call
- /api/ready-to-ship/csv-batch/[batchId]
- other authenticated dashboard/API routes

No Prisma migration is required for this fix.
