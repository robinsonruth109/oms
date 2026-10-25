UPDATE `Order`
SET
  `pathaoPaymentStatus` = NULL,
  `pathaoPaymentVerifiedAt` = NULL,
  `pathaoSettlementCollectedAmount` = NULL,
  `pathaoSettlementDeliveryFee` = NULL,
  `pathaoSettlementCodFee` = NULL,
  `pathaoSettlementTotalFee` = NULL,
  `pathaoSettlementConsignmentId` = NULL
WHERE
  `pathaoPaymentStatus` = 'PAYMENT_DONE'
  AND `pathaoSettlementUploadId` IS NULL;
