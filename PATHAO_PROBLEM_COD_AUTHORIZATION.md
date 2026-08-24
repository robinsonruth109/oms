# Pathao Problem / COD Authorization

New page:
`/dashboard/pathao-problem`

Access:
- ADMIN
- NOTE_AGENT

## Purpose

Delivery agents may call staff because the customer wants to pay a lower COD
amount than the original OMS total.

Example:
- Original OMS total: ৳1000
- Customer agrees with delivery agent: ৳950
- Note Agent records an authorization of ৳950 inside OMS
- Agent opens the parcel in Pathao and manually changes Amount to Collect
- Agent clicks Refresh Pathao Amount
- Courier Amount Report confirms whether actual Pathao COD matches the
  authorized OMS COD.

## Accounting safety

`Order.totalAmount` is NOT overwritten.

The original OMS total is preserved for normal sales/reports. Pathao-specific
authorization uses separate fields:
- `pathaoAuthorizedCodAmount`
- `pathaoCodAdjustmentReason`
- `pathaoCodApprovedByUserId`
- `pathaoCodApprovedAt`

Every approval is permanently copied to `PathaoCodAuthorization`.

## Courier Amount Report logic

Expected COD:
`pathaoAuthorizedCodAmount ?? totalAmount`

Classification:
- GOOD: Pathao amount = original OMS total
- AUTHORIZED: Pathao amount differs from original, but equals authorized COD
- UNAUTHORIZED DIFFERENCE: Pathao differs and there is no OMS authorization
- AUTHORIZED BUT PATHAO MISMATCH: an authorization exists but Pathao has a
  different amount
- NEEDS SYNC: OMS has not yet received/read Pathao Amount to Collect

The visible report intentionally hides GOOD rows and focuses on changed/problem
COD amounts.

## Search

Search supports:
- phone
- invoice ID
- OMS order ID / external order ID
- Pathao consignment ID

## Pathao updates

The provided Pathao API contract does not document an endpoint for editing an
existing parcel COD. Therefore OMS records the authorization and provides
`Open in Pathao` for the actual merchant-side change.

`Refresh Pathao Amount` uses the existing Pathao Order Info API to synchronize
Amount to Collect when the API includes that field.

## Migration

`20260824190000_pathao_problem_cod_authorization`

Run:
1. `npx prisma migrate deploy`
2. `npx prisma generate`
3. `npx eslint .`
4. `npx tsc --noEmit`
5. `npm run build`
