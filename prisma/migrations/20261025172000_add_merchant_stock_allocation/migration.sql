CREATE TABLE `MerchantStockAllocation` (
  `id` VARCHAR(191) NOT NULL,
  `receiptNo` VARCHAR(191) NOT NULL,
  `merchantId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NOT NULL,
  `allocationDate` DATETIME(3) NOT NULL,
  `enteredQuantity` INTEGER NOT NULL,
  `unitsPerSale` INTEGER NOT NULL,
  `physicalUnits` INTEGER NOT NULL,
  `remainingPhysicalUnits` INTEGER NOT NULL,
  `stockOwnerType` ENUM('PRODUCT_PARENT', 'PRODUCT') NOT NULL,
  `stockOwnerId` VARCHAR(191) NOT NULL,
  `omsStockBefore` INTEGER NOT NULL,
  `omsStockAfter` INTEGER NOT NULL,
  `merchantStockBefore` INTEGER NOT NULL,
  `merchantStockAfter` INTEGER NOT NULL,
  `unitCost` DECIMAL(12,2) NOT NULL,
  `totalCost` DECIMAL(14,2) NOT NULL,
  `note` LONGTEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `MerchantStockAllocation_receiptNo_key`(`receiptNo`),
  INDEX `MerchantStockAllocation_merchantId_allocationDate_idx`(`merchantId`, `allocationDate`),
  INDEX `MerchantStockAllocation_merchantId_productId_idx`(`merchantId`, `productId`),
  INDEX `MerchantStockAllocation_productId_idx`(`productId`),
  INDEX `MerchantStockAllocation_parentId_idx`(`parentId`),
  INDEX `MerchantStockAllocation_stockOwnerType_stockOwnerId_idx`(`stockOwnerType`, `stockOwnerId`),
  INDEX `MerchantStockAllocation_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MerchantStockAllocation`
  ADD CONSTRAINT `MerchantStockAllocation_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantStockAllocation_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantStockAllocation_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `ProductParent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantStockAllocation_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
