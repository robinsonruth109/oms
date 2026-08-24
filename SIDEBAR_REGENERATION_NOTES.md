# Professional Sidebar Regeneration

This rebuild fixes the previous navigation compile/lint issues:

- No component is declared inside `DashboardNavigation` render.
- No unsupported `<details defaultOpen>` prop is used.
- Collapsible groups now use React state.
- Mobile uses a full slide-in drawer with overlay.
- Desktop uses a fixed, independently scrollable sidebar.
- Active route group automatically opens.
- Role filtering remains centralized.

No database migration is required.

Run:

npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx eslint .
npx tsc --noEmit
npm run build
