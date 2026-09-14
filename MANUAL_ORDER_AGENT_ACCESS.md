# Manual Order Entry - Agent Access

## Update

The existing `/dashboard/orders` Manual Order Entry panel is now available to the standard `AGENT` role in addition to `ADMIN` and `NOTE_AGENT`.

## Access changes

- Sidebar `Orders` item: `ADMIN`, `AGENT`, `NOTE_AGENT`
- Orders page server-side authorization: `ADMIN`, `AGENT`, `NOTE_AGENT`
- Manual order creation server action: `ADMIN`, `AGENT`, `NOTE_AGENT`

`PACKAGING_AGENT` access is unchanged.

This preserves the existing manual-order workflow, phone validation, Page/Source/Courier selection, product selection, ready-to-ship processing, audit history and invoice serial generation.
