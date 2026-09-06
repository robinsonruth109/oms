# Ready Order Google Sheet Format Upgrade

The Ready Order Google Sheet sync now exports exactly this structure:

- A: UUID
- B: Invoice ID
- C: Invoice ID (intentional duplicate)
- D: Source Name
- E: Date (DD/MM/YYYY, Bangladesh business date)
- F: Customer Name
- G: Phone Number
- H: Address
- I-L: Product 1 = Parent Code / SKU / Price / QTY
- M-P: Product 2
- Q-T: Product 3
- U-X: Product 4
- Y-AB: Product 5
- AC-AF: Product 6
- AG-AJ: Product 7
- AK-AN: Product 8
- AO: DV Cost
- AP: Advance
- AQ: Discount
- AR: Grand Total
- AS: Note
- AT: Status

## Important behavior

- Invoice ID is intentionally written twice in columns B and C.
- UUID is the OMS order UUID and is stored in column A.
- Phone Number is sent to Google Sheets using RAW input so leading zeroes are preserved and values such as `01812345678` are not converted to scientific notation.
- Bangla customer names and addresses are sent as native Unicode strings.
- Product Parent Code comes from the linked OMS Product Parent SKU.
- Product SKU comes from the Order Item SKU.
- Product Price is the order item's unit price, not the current product master price.
- Up to 8 order item lines are supported by this fixed layout. The sync stops with an explicit error instead of silently dropping products if an order contains more than 8 item lines.
- Status is exported as a readable label, for example `READY_TO_SHIP` -> `Ready`.

## Existing Google Sheet rows

The code changes the header and the format of newly appended rows. It does not destructively delete or rearrange old rows already stored in the Sheet. If the same tab already contains rows in the previous layout, use a new/blank Sheet tab for a completely uniform dataset, or perform a controlled one-time migration of the historical rows before mixing formats.
