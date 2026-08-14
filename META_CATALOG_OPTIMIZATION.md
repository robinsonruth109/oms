# Meta Catalog Optimization Upgrade

## Meta identity rule
- `Product.id` UUID: database only.
- `Product.slug`: URL-friendly product field; existing rows are backfilled from lowercase SKU.
- `Product.sku`: Meta identity everywhere (`content_ids`, `contents[].id`, catalog `g:id`, `product:retailer_item_id`, JSON-LD `sku`/`productID`).
- `ProductParent.sku`: Meta/catalog item group ID.

## Public catalog feed
`/api/feed/facebook`

## Required environment variables
- `NEXT_PUBLIC_FB_PIXEL_ID`
- `META_CONVERSIONS_ACCESS_TOKEN` or encrypted token in Shop Settings
- `META_TEST_EVENT_CODE` (optional)
- `NEXT_PUBLIC_SITE_URL` or `SITE_URL`
- `FB_GRAPH_VERSION=v23.0` (reserved for new Graph integrations; Purchase source-of-truth remains pinned to v23.0)

## Purchase deduplication
New checkout orders persist `metaPurchaseEventId = checkoutRequestId`. Browser Purchase and CAPI Purchase use that same immutable event ID. CAPI `productId` is `Product.sku`.
