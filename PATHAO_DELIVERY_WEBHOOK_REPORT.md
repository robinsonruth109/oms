# Pathao Delivery Report: verified webhook data

Path: `/dashboard/pathao-delivery-report` (Admin and Manager).

## Data source

- Use the existing `PathaoWebhookEvent` log instead of the mutable
  `Order.pathaoOrderStatus` / `Order.pathaoOrderStatusSlug` snapshots.
- Include only events with a valid stored signature, `processed=true`, and a
  linked OMS order. A store webhook or unmapped return consignment cannot
  supply product/source quantities without an order mapping.
- The report reads only event metadata (event name, linked order, received
  time), not the raw webhook payload or webhook credentials.
- Keep the recorded OMS order item quantity separate from any component
  inventory multipliers. Product totals refer to sold items/sets.

## Date basis

- **Ready to Ship date** (default): select submitted Pathao orders by their RTS
  dates and inspect all verified webhooks received for those orders up to now.
  Submitted shipments with no linked webhook appear as *No Verified Webhook*.
- **Webhook received date**: select events received by OMS during the date
  range, then report the distinct linked orders they touched. Latest status
  in this mode means latest event **within that range**, not necessarily the
  parcel's all-time current state.
- Source and courier filters are applied to matching OMS orders / receiving
  courier accounts. Store-level events and unmatched parcels cannot be
  attributed to a product or source.

## Report view

- **Latest webhook per order** (default): each matched shipment appears under
  its most recently received verified event. Distinct order amounts,
  quantities, delivery charges and fees are counted once. The name describes
  the last webhook, not an inferred courier delivery outcome.
- **All webhook stages per order**: each order contributes its item quantities
  once to every *distinct* event type that it has received. Repeated delivery
  of the same webhook type for a single order is deduplicated in stage
  quantities. Stage columns must not be summed as unique inventory: e.g. a
  shipment of 2 pieces can contribute 2 to Delivered and 2 to Paid Return,
  while its unique product total remains 2.
- The **Verified Webhook Events** card shows the raw number of received,
  matched events, before the per-order/status deduplication.

## Pathao events

Recognizes the order-level webhook event names displayed in the merchant
panel, including Delivered (`order.delivered`), Return
(`order.returned`), Paid Return (`order.paid-return`), Return ID
Created, Return In Transit, Returned To Merchant, Order Updated, Pickup
Failed, Partial Delivery, On Hold, and the other shipment lifecycle events.
Unknown verified event names appear as additional status columns so that
Pathao API additions are not silently discarded.

Store Created / Store Updated are intentionally not included in the
product-delivery breakdown. They do not correspond to an order/item.

## Deployment / historical limitations

No schema migration is needed: the existing webhook receiver already records
signed events. The new report can show only webhooks stored by OMS. It cannot
reconstruct past event histories from the last saved Pathao order status.
Keep webhook delivery enabled for each Pathao account and monitor unmatched
merchant order IDs / return consignment IDs.

## Release verification

1. Test a shipment with Delivered followed by Paid Return: latest = Paid
   Return, history = Delivered and Paid Return, unique quantity unchanged.
2. Send the same event twice: raw event count rises, unique stage quantity
   stays the same.
3. Test filters on RTS date versus webhook-received date.
4. Confirm Source and courier filters respect order and event relationships.
5. Confirm a shipment without a verified callback shows No Verified Webhook.
6. Confirm an invalid-signature or unmatched payload does not affect
   per-product quantities.
