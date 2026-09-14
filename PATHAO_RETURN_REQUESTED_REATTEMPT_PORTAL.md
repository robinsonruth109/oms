# Pathao Return Requested / Reattempt Portal

## Added

- New `/dashboard/pathao-return-requested` portal under the Pathao sidebar group.
- Access: ADMIN, AGENT, NOTE_AGENT and PACKAGING_AGENT.
- Filter by Pathao courier name.
- Search by OMS invoice/order ID, phone, customer name or Pathao consignment ID.
- Detects the current Pathao Return Requested window from stored Pathao order status plus webhook history.
- Excludes parcels once the reverse-return lifecycle has advanced to return ID created, return in transit or returned to merchant.
- Calculates the Pathao response deadline as 6:00 PM Bangladesh time on the following day.
- `Open in Pathao` button opens the Pathao parcel page for the consignment.
- `Mark Reattempt Done` writes an OMS audit event with the user/time so another agent can see that the action was already submitted manually.
- `Refresh Status` calls the documented Pathao order-info API and removes the parcel from the actionable list once Pathao changes its status.

## Why reattempt is manual

As of September 2026, Pathao publicly documents the Return Requested workflow and free reattempt action in the Merchant Panel, but its public Developer API documentation does not expose a documented reattempt endpoint. The OMS therefore does not call an undocumented internal Pathao endpoint.

This keeps the integration stable and avoids relying on private Merchant Panel APIs that Pathao may change without notice.
