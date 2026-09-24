# Meta Ads Cost Sync

Admin route: `/dashboard/ads-cost/sync`

## What it does

- Connects Meta/Facebook through OAuth with `ads_read`.
- Supports multiple Meta logins and multiple ad accounts.
- Syncs campaign-level daily spend from Meta Insights.
- Uses Meta Ad Account ID + Campaign ID as the stable campaign identity.
- Maps each campaign to one OMS Product Parent and one or more OMS Sources.
- **Does not split ad spend across Sources.** The campaign spend is stored exactly once.
- For performance, OMS merges orders from every mapped Source for the mapped Product Parent.
- Shows total orders, READY_TO_SHIP confirmed orders, cancelled, no-answer, phone-off, confirmation rate, cost per order, and cost per confirmed order.
- Manual sync supports up to 31 days.
- Automatic scheduler runs after 2:00 AM Asia/Dhaka and re-syncs the previous 3 completed days.
- Sync is idempotent for a date/account: current Meta rows replace that date range instead of duplicating spend.
- Existing CSV Ads Cost Upload remains unchanged as a fallback.

## Railway environment

Set:

```
META_ADS_APP_ID=
META_ADS_APP_SECRET=
META_ADS_GRAPH_VERSION=v26.0
META_ADS_REDIRECT_URI=
```

The access token is encrypted using the existing `SHOP_SETTINGS_ENCRYPTION_KEY`.

## Meta app callback

Add this Valid OAuth Redirect URI in the Meta app:

```
https://YOUR_OMS_DOMAIN/api/meta-ads/callback
```

If `META_ADS_REDIRECT_URI` is set, it must exactly match the URI configured in Meta.

## Example

Campaign spend: $100

Mapped Product Parent: Code-123

Mapped Sources:
- Gloss Page
- Gloss Web

Orders for the selected dates:
- Gloss Page confirmed: 4
- Gloss Web confirmed: 16
- Combined confirmed: 20

OMS calculation:

```
Confirmed Order Cost = $100 / 20 = $5
```

There is no $60/$40 split and no duplicated $100 per Source.
