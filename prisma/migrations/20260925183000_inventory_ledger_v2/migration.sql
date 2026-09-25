ALTER TABLE `ProductParent`
  ADD COLUMN `inventoryMode` ENUM('LEGACY', 'SHARED_PARENT', 'CHILD_VARIANT') NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN `stockTrackingActive` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `stockActivatedAt` DATETIME(3) NULL,
  ADD COLUMN `stockQuantity` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `averageCost` DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE `Product`
  ADD COLUMN `stockQuantity` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `averageCost` DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE `StockMovement` (
  `id` VARCHAR(191) NOT NULL,
  `productParentId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NULL,
  `movementType` ENUM('OPENING', 'PURCHASE_RECEIVED', 'CSV_DISPATCH', 'PATHAO_RETURN', 'MANUAL_ADJUSTMENT') NOT NULL,
  `quantityDelta` INTEGER NOT NULL,
  `balanceBefore` INTEGER NOT NULL,
  `balanceAfter` INTEGER NOT NULL,
  `unitCost` DECIMAL(12,2) NULL,
  `averageCostBefore` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `averageCostAfter` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `stockValueAfter` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `referenceType` VARCHAR(191) NULL,
  `referenceId` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `note` LONGTEXT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `StockMovement_idempotencyKey_key`(`idempotencyKey`),
  INDEX `StockMovement_productParentId_idx`(`productParentId`),
  INDEX `StockMovement_productId_idx`(`productId`),
  INDEX `StockMovement_movementType_idx`(`movementType`),
  INDEX `StockMovement_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
  INDEX `StockMovement_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StockMovement`
  ADD CONSTRAINT `StockMovement_productParentId_fkey`
  FOREIGN KEY (`productParentId`) REFERENCES `ProductParent`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StockMovement`
  ADD CONSTRAINT `StockMovement_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
