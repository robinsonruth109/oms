ALTER TABLE `Order`
  ADD COLUMN `pathaoPaymentStatus` VARCHAR(191) NULL,
  ADD COLUMN `pathaoPaymentVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `pathaoSettlementCollectedAmount` DECIMAL(12,2) NULL,
  ADD COLUMN `pathaoSettlementDeliveryFee` DECIMAL(12,2) NULL,
  ADD COLUMN `pathaoSettlementCodFee` DECIMAL(12,2) NULL,
  ADD COLUMN `pathaoSettlementTotalFee` DECIMAL(12,2) NULL,
  ADD COLUMN `pathaoSettlementConsignmentId` VARCHAR(191) NULL,
  ADD COLUMN `pathaoSettlementUploadId` VARCHAR(191) NULL;

CREATE INDEX `Order_pathaoPaymentStatus_idx`
  ON `Order`(`pathaoPaymentStatus`);

CREATE INDEX `Order_pathaoPaymentVerifiedAt_idx`
  ON `Order`(`pathaoPaymentVerifiedAt`);

CREATE INDEX `Order_pathaoSettlementUploadId_idx`
  ON `Order`(`pathaoSettlementUploadId`);

ALTER TABLE `PathaoSettlementUpload`
  ADD COLUMN `courierId` VARCHAR(191) NULL,
  ADD COLUMN `courierName` VARCHAR(191) NULL;

CREATE INDEX `PathaoSettlementUpload_courierId_idx`
  ON `PathaoSettlementUpload`(`courierId`);
