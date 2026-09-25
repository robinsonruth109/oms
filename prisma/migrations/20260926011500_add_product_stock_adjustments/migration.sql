CREATE TABLE `ProductStockAdjustment` (
  `id` VARCHAR(191) NOT NULL,
  `adjustmentDate` DATETIME(3) NOT NULL,
  `adjustmentType` ENUM('ADD','REDUCE') NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NOT NULL,
  `skuSnapshot` VARCHAR(191) NOT NULL,
  `productNameSnapshot` VARCHAR(191) NOT NULL,
  `parentSkuSnapshot` VARCHAR(191) NOT NULL,
  `stockOwnerType` ENUM('PRODUCT','PRODUCT_PARENT') NOT NULL,
  `stockOwnerId` VARCHAR(191) NOT NULL,
  `enteredQuantity` INTEGER NOT NULL,
  `unitsPerSale` INTEGER NOT NULL,
  `adjustedStockUnits` INTEGER NOT NULL,
  `unitCost` DECIMAL(10, 2) NOT NULL,
  `adjustmentValue` DECIMAL(12, 2) NOT NULL,
  `stockBefore` INTEGER NOT NULL,
  `stockAfter` INTEGER NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `note` TEXT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdByName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ProductStockAdjustment_adjustmentDate_idx`(`adjustmentDate`),
  INDEX `ProductStockAdjustment_adjustmentType_idx`(`adjustmentType`),
  INDEX `ProductStockAdjustment_productId_idx`(`productId`),
  INDEX `ProductStockAdjustment_parentId_idx`(`parentId`),
  INDEX `ProductStockAdjustment_stockOwnerType_stockOwnerId_idx`(`stockOwnerType`, `stockOwnerId`),
  INDEX `ProductStockAdjustment_createdByUserId_idx`(`createdByUserId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductStockAdjustment`
  ADD CONSTRAINT `ProductStockAdjustment_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductStockAdjustment`
  ADD CONSTRAINT `ProductStockAdjustment_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `ProductParent`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductStockAdjustment`
  ADD CONSTRAINT `ProductStockAdjustment_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
