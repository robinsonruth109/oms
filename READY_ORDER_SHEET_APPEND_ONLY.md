# Ready Order Google Sheet - Append Only Protection

- Existing Google Sheet rows are never rewritten, reformatted, migrated, moved, or deleted.
- Existing row 1/header is also preserved.
- The new UUID + duplicated Invoice ID + 8 product-group format is used only for newly appended orders.
- If the target Google Sheet is completely blank, OMS creates the new header automatically.
- Existing ReadyOrderSheetSyncItem deduplication remains unchanged, so already-synced OMS orders are not appended again.
