# Pathao API + Webhook OMS Upgrade

This package implements the Pathao workflow requested for the OMS.

## Source contract
Implemented against the supplied Pathao Merchant API documentation:
- OAuth token endpoint `/aladdin/api/v1/issue-token`
- Stores `/aladdin/api/v1/stores`
- Bulk order creation `/aladdin/api/v1/orders/bulk`
- Order info `/aladdin/api/v1/orders/{consignment_id}/info`
- Webhook integration contract supplied by the merchant panel.

## Workflow
1. Calling Panel still confirms orders to Ready to Ship.
2. Manual Order Entry keeps its current normal OMS flow. It does NOT auto-create Pathao parcels.
3. Ready to Ship:
   - Select one courier in the Courier filter.
   - Select orders belonging to that courier.
   - `Create CSV Batch + Download CSV` validates the selected courier server-side.
   - Only that courier's orders are sent using that courier's Pathao API credentials/store.
   - Bulk API returns 202, so orders become `SUBMITTED`.
   - Webhook later stores `consignment_id` and Pathao order status.
4. Already-submitted/consignment-linked orders are never re-submitted.
5. Invalid recipient name/phone/address orders remain Non CSV with a visible Pathao error.
6. Pathao Order Control supports search by consignment ID, invoice/order ID and phone, Refresh Status, and View in Pathao.
7. Webhook raw JSON is stored for audit/future payload mapping.
8. Post Print Actions now create daily audit logs for Single/CSV Stock Out and Cancel actions.

## Webhook
Each courier has its own callback:
`{SITE_URL}/api/webhooks/pathao/{courierId}`

This allows each Pathao account to have its own webhook secret safely.

Integration verification:
- responds HTTP 202
- returns `X-Pathao-Merchant-Webhook-Integration-Secret`
- normal events validate `X-PATHAO-Signature`

## Important
`SHOP_SETTINGS_ENCRYPTION_KEY` must already be configured in Railway.
Pathao API credentials, OAuth tokens and webhook secrets are AES-256-GCM encrypted in the database.

## Migration
Run:
`npx prisma migrate deploy`
then:
`npx prisma generate`

Migration:
`20260823141000_pathao_api_webhook_control`
