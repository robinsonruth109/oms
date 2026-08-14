# Reel Category + Collection Page Upgrade

## Added
- Every Reel Category now has two public routes: `/reels/[slug]` and `/collections/[slug]`.
- Category-level 16:9 Collection Hero Video upload via Cloudinary.
- Collection page uses the existing storefront product card and checkout system.
- `অর্ডার করুন` opens the existing popup checkout.
- `বিস্তারিত` opens `/product/[reelProductId]`.
- Existing Meta Pixel + server order/CAPI flow is reused.
- Collection products are cursor-paginated and restricted to the selected Reel Category.

## Migration
`20260813152000_add_reel_collection_page`

## Local verification
```powershell
npx prisma migrate deploy
npx prisma generate
npx eslint .
npx tsc --noEmit
npm run build
npm run dev
```
