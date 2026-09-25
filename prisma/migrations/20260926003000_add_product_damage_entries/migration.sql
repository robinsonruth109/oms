CREATE TABLE `ProductDamageEntry` (
  `id` VARCHAR(191) NOT NULL,
  `damageDate` DATETIME(3) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NOT NULL,
  `skuSnapshot` VARCHAR(191) NOT NULL,
  `productNameSnapshot` VARCHAR(191) NOT NULL,
  `parentSkuSnapshot` VARCHAR(191) NOT NULL,
  `stockOwnerType` ENUM('PRODUCT','PRODUCT_PARENT') NOT NULL,
  `stockOwnerId` VARCHAR(191) NOT NULL,
  `enteredQuantity` INTEGER NOT NULL,
  `unitsPerSale` INTEGER NOT NULL,
  `damagedStockUnits` INTEGER NOT NULL,
  `unitCost` DECIMAL(10, 2) NOT NULL,
  `damageValue` DECIMAL(12, 2) NOT NULL,
  `stockBefore` INTEGER NOT NULL,
  `stockAfter` INTEGER NOT NULL,
  `note` TEXT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdByName` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ProductDamageEntry_damageDate_idx`(`damageDate`),
  INDEX `ProductDamageEntry_productId_idx`(`productId`),
  INDEX `ProductDamageEntry_parentId_idx`(`parentId`),
  INDEX `ProductDamageEntry_stockOwnerType_stockOwnerId_idx`(`stockOwnerType`, `stockOwnerId`),
  INDEX `ProductDamageEntry_createdByUserId_idx`(`createdByUserId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductDamageEntry`
  ADD CONSTRAINT `ProductDamageEntry_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductDamageEntry`
  ADD CONSTRAINT `ProductDamageEntry_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `ProductParent`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductDamageEntry`
  ADD CONSTRAINT `ProductDamageEntry_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
