# Storefront scale upgrade

The homepage now loads reel products in cursor-paginated batches instead of sending the entire catalogue to the browser.

## Behaviour

- Initial homepage response: 12 products.
- Additional requests: 12 products per batch.
- Maximum API batch size: 24.
- Desktop: automatically loads near the end and also exposes a manual retry/load button.
- Mobile: loads the next batch when the visitor reaches the final four currently loaded reels.
- Only the active mobile video and its two nearest neighbours are mounted as video elements.
- Desktop cards use lazy-loaded poster/thumbnail images instead of creating a video element for every product.
- Delivery and Pixel settings use a short server cache.
- Temporary database connection failures are retried.
- A composite storefront index was added for active-product ordering.

## Required commands

```powershell
npx prisma migrate deploy
npx prisma generate
npx eslint .
npx tsc --noEmit
npm run build
```
