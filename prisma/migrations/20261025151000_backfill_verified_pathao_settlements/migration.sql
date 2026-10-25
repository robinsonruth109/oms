UPDATE `Order` AS o
JOIN (
  SELECT
    `orderId`,
    SUM(`collectedAmount`) AS collectedAmount,
    SUM(`deliveryFee`) AS deliveryFee,
    SUM(`codFee`) AS codFee,
    SUM(`totalFee`) AS totalFee,
    MAX(`updatedAt`) AS verifiedAt
  FROM `PathaoSettlement`
  WHERE `orderId` IS NOT NULL
  GROUP BY `orderId`
) AS s ON s.`orderId` = o.`id`
SET
  o.`pathaoPaymentStatus` = 'PAYMENT_DONE',
  o.`pathaoPaymentVerifiedAt` = s.`verifiedAt`,
  o.`pathaoSettlementCollectedAmount` = s.`collectedAmount`,
  o.`pathaoSettlementDeliveryFee` = s.`deliveryFee`,
  o.`pathaoSettlementCodFee` = s.`codFee`,
  o.`pathaoSettlementTotalFee` = s.`totalFee`;
