# Shopify → OMS: Reliable "Never Drop an Order" Flow Body

The OMS importer in this project is now intentionally tolerant:
- Missing phone does NOT reject the order.
- Missing/incomplete address does NOT reject the order.
- Missing customer name does NOT reject the order.
- Missing/invalid line-item payload does NOT reject the order; OMS creates a review placeholder item.
- Duplicate Flow retries are safe and return success.
- Shopify total can be supplied as `totalAmount` so the OMS order total remains correct even if item data is incomplete.

## IMPORTANT: Update Shopify Flow Body

Keep your existing endpoint:

https://glossandglows.com/api/integrations/china-to-bd-web/orders

Header:

Content-Type=application/json

Use this body (replace YOUR_OMS_API_KEY):

```liquid
{
  "apiKey": "YOUR_OMS_API_KEY",
  "externalOrderId": "{{ order.name }}",
  "invoiceId": "{{ order.name }}",

  "customerName": "{{ order.customer.firstName }} {{ order.customer.lastName }}",
  "phone": "{{ order.phone }}",
  "address": "{{ order.shippingAddress.address1 }}, {{ order.shippingAddress.address2 }}, {{ order.shippingAddress.city }}, {{ order.shippingAddress.province }}, {{ order.shippingAddress.country }}",

  "shippingPhone": "{{ order.shippingAddress.phone }}",
  "shippingCustomerName": "{{ order.shippingAddress.firstName }} {{ order.shippingAddress.lastName }}",
  "shippingFirstName": "{{ order.shippingAddress.firstName }}",
  "shippingLastName": "{{ order.shippingAddress.lastName }}",
  "shippingAddress1": "{{ order.shippingAddress.address1 }}",
  "shippingAddress2": "{{ order.shippingAddress.address2 }}",
  "shippingCity": "{{ order.shippingAddress.city }}",
  "shippingProvince": "{{ order.shippingAddress.province }}",
  "shippingZip": "{{ order.shippingAddress.zip }}",
  "shippingCountry": "{{ order.shippingAddress.country }}",
  "email": "{{ order.email }}",

  "deliveryCharge": {{ order.totalShippingPriceSet.shopMoney.amount | default: 0 }},
  "discount": {{ order.totalDiscountsSet.shopMoney.amount | default: 0 }},
  "advance": 0,
  "totalAmount": {{ order.totalPriceSet.shopMoney.amount | default: 0 }},
  "note": "{{ order.note }}",

  "items": [
    {% for item in order.lineItems %}
    {
      "sku": "{{ item.sku }}",
      "name": "{{ item.name }}",
      "quantity": {{ item.quantity }},
      "price": {{ item.originalUnitPriceSet.shopMoney.amount | default: 0 }}
    }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]
}
```

## Why these extra fields matter

Some Shopify COD apps do not populate `order.phone` or `order.customer` consistently.
They may only populate `order.shippingAddress.phone` / shipping name fields.
Sending BOTH lets OMS choose the first available value.

## OMS behavior after this upgrade

The OMS only rejects an authenticated request when it has no stable order identity
(`externalOrderId`/`invoiceId`) or the integration/API key itself is invalid.

If customer details are incomplete, the order still enters Calling Panel and the existing
red incomplete-address warning lets the agent correct it.

If Shopify Flow retries the same order, OMS treats it as duplicate success, not a failed order.
