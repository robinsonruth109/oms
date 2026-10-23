CREATE TABLE `PathaoSettlementUpload` (
  `id` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `rowCount` INTEGER NOT NULL,
  `matchedCount` INTEGER NOT NULL,
  `unmatchedCount` INTEGER NOT NULL,
  `duplicateCount` INTEGER NOT NULL DEFAULT 0,
  `uploadedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `PathaoSettlementUpload_createdAt_idx`(`createdAt`),
  INDEX `PathaoSettlementUpload_uploadedByUserId_idx`(`uploadedByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PathaoSettlement` (
  `id` VARCHAR(191) NOT NULL,
  `consignmentId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `merchantOrderId` VARCHAR(191) NULL,
  `paymentStatus` VARCHAR(191) NULL,
  `orderStatus` VARCHAR(191) NULL,
  `storeName` VARCHAR(191) NULL,
  `orderType` VARCHAR(191) NULL,
  `itemType` VARCHAR(191) NULL,
  `collectibleAmount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `collectedAmount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `deliveryFee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `codFee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `totalFee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `orderCreatedAt` DATETIME(3) NULL,
  `rawRow` JSON NULL,
  `uploadId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PathaoSettlement_consignmentId_key`(`consignmentId`),
  INDEX `PathaoSettlement_orderId_idx`(`orderId`),
  INDEX `PathaoSettlement_merchantOrderId_idx`(`merchantOrderId`),
  INDEX `PathaoSettlement_orderStatus_idx`(`orderStatus`),
  INDEX `PathaoSettlement_paymentStatus_idx`(`paymentStatus`),
  INDEX `PathaoSettlement_uploadId_idx`(`uploadId`),
  INDEX `PathaoSettlement_orderCreatedAt_idx`(`orderCreatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PathaoSettlement`
  ADD CONSTRAINT `PathaoSettlement_uploadId_fkey`
  FOREIGN KEY (`uploadId`) REFERENCES `PathaoSettlementUpload`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
