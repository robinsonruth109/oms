# Pathao Return ID Mapping Fix

The standard Pathao `GET /orders/{consignment_id}/info` flow resolves the original outbound parcel, but a returned parcel can carry a separate return consignment ID. The Return Track scanner now resolves that return ID from verified Pathao webhook history first.

Changes:
- captures and stores `return_consignment_id` from Pathao webhooks;
- supports `order.return-id-created`, `order.return-in-transit`, and `order.returned-to-merchant`;
- searches historical raw webhook payloads so recent pre-upgrade returns can still match;
- recognizes linked return-leg webhook events even when Pathao puts the new barcode in `consignment_id`;
- prevents the original outbound consignment from being processed as a return;
- prevents return webhooks from overwriting the original OMS outbound consignment ID;
- repairs an already-overwritten outbound ID when verified webhook history provides the original;
- uses the same return-aware verification when an agent confirms a partial return.

Deploy with:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run build
```
