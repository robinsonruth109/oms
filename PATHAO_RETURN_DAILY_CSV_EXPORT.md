# Pathao Return Track - Daily CSV Export

Added a **Download CSV** button beside the Daily Return List date filter.

The export uses the selected Bangladesh date and includes every processed return for that day, not only the rows currently visible in the browser table.

CSV columns:
- Invoice ID
- Return Consignment ID
- Outbound Consignment ID
- Courier
- Customer
- Phone
- Returned Items
- Return Type
- Previous OMS Status
- Current OMS Status
- Pathao Status
- Pathao Status Slug
- Qty Restored
- Agent
- Processed Date / Time (Bangladesh)

The export endpoint is restricted to ADMIN and PACKAGING_AGENT and returns UTF-8 with BOM so Bangla text is readable in Microsoft Excel.
