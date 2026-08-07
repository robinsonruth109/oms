# Courier Score — Phase 1 Foundation

This phase adds the secure database and TypeScript foundation for Pathao, Steadfast, and RedX customer delivery scoring.

## Added

- `CourierCredential`: encrypted courier username/password storage and connection-test status.
- `CustomerCourierScore`: 24-hour phone-based score cache.
- `CourierProvider` and `CourierRiskLevel` enums.
- Shared phone normalization, score calculation, credential encryption, and cache helpers.
- No courier password is exposed to the browser by these helpers.
- Existing `SHOP_SETTINGS_ENCRYPTION_KEY` is reused.

## Not included yet

- Shop Settings courier credential UI/API.
- Actual courier login/check adapters.
- Calling Panel score column and details modal.

Those are Phase 2 and Phase 3.

## Apply

```powershell
npx prisma migrate deploy
npx prisma generate
npx eslint .
npx tsc --noEmit
npm run build
```
