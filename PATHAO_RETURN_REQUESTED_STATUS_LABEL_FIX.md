# Pathao Return Requested status-label fix

Pathao Merchant Panel names the actionable queue **Return Requested**, while the documented Pathao webhook event for a return-marked parcel is `order.returned`, and Pathao's official WooCommerce integration maps that event to the visible raw status `Return`.

The OMS Return Requested portal now:

- Displays **Return Requested** as the Merchant Panel status.
- Keeps the raw Pathao API status (for example `Return`) underneath for audit/debugging.
- Stops treating a generic `Returned` value as an actionable Return Requested state, to avoid confusing later completed-return states with the actionable queue.
- Continues to exclude return-leg lifecycle events such as `order.return-id-created`, `order.return-in-transit`, and `order.returned-to-merchant`.

No database migration is required.
