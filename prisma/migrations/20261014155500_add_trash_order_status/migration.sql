-- Add TRASH order status for stock-out invoices that should be discarded without restocking.
ALTER TABLE `Order`
  MODIFY `orderStatus` ENUM(
    'PENDING_CONFIRMATION',
    'READY_TO_SHIP',
    'NO_ANSWER',
    'PHONE_OFF',
    'CANCELLED',
    'DOUBLE_ORDER',
    'STOCK_OUT',
    'TRASH',
    'RETURNED',
    'PARTIAL_RETURN'
  ) NOT NULL DEFAULT 'PENDING_CONFIRMATION';
