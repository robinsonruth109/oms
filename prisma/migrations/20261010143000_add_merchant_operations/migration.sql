-- Merchant operations foundation.
-- Existing data remains OMS-owned because merchantId is nullable and defaults to NULL.

ALTER TABLE `User`
  MODIFY `role` ENUM('ADMIN','MANAGER','MERCHANT','AGENT','NOTE_AGENT','PACKAGING_AGENT') NOT NULL;

CREATE TABLE `Merchant` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `address` TEXT NOT NULL,
  `status` BOOLEAN NOT NULL DEFAULT true,
  `userId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Merchant_phone_key`(`phone`),
  UNIQUE INDEX `Merchant_userId_key`(`userId`),
  INDEX `Merchant_status_idx`(`status`),
  INDEX `Merchant_name_idx`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductParent`
  ADD COLUMN `merchantId` VARCHAR(191) NULL,
  ADD COLUMN `omsOwnedStockQuantity` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `ProductParent_merchantId_idx` ON `ProductParent`(`merchantId`);

ALTER TABLE `Product`
  ADD COLUMN `omsOwnedStockQuantity` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `PurchaseOrder`
  ADD COLUMN `merchantId` VARCHAR(191) NULL;

CREATE INDEX `PurchaseOrder_merchantId_idx` ON `PurchaseOrder`(`merchantId`);

ALTER TABLE `MetaCampaignMapping`
  ADD COLUMN `merchantId` VARCHAR(191) NULL;

CREATE INDEX `MetaCampaignMapping_merchantId_idx` ON `MetaCampaignMapping`(`merchantId`);

CREATE TABLE `MerchantCourier` (
  `id` VARCHAR(191) NOT NULL,
  `merchantId` VARCHAR(191) NOT NULL,
  `courierId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MerchantCourier_merchantId_courierId_key`(`merchantId`, `courierId`),
  INDEX `MerchantCourier_courierId_idx`(`courierId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MerchantDollarRecharge` (
  `id` VARCHAR(191) NOT NULL,
  `merchantId` VARCHAR(191) NOT NULL,
  `rechargeDate` DATETIME(3) NOT NULL,
  `usdAmount` DECIMAL(12,2) NOT NULL,
  `bdtAmount` DECIMAL(14,2) NOT NULL,
  `usdRate` DECIMAL(12,4) NOT NULL,
  `note` TEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MerchantDollarRecharge_merchantId_rechargeDate_idx`(`merchantId`, `rechargeDate`),
  INDEX `MerchantDollarRecharge_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MerchantOperatingCost` (
  `id` VARCHAR(191) NOT NULL,
  `merchantId` VARCHAR(191) NOT NULL,
  `costMonth` DATETIME(3) NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `note` TEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MerchantOperatingCost_merchantId_costMonth_key`(`merchantId`, `costMonth`),
  INDEX `MerchantOperatingCost_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MerchantOmsPurchase` (
  `id` VARCHAR(191) NOT NULL,
  `merchantId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NOT NULL,
  `purchaseDate` DATETIME(3) NOT NULL,
  `enteredQuantity` INTEGER NOT NULL,
  `physicalUnits` INTEGER NOT NULL,
  `stockOwnerType` ENUM('PRODUCT','PRODUCT_PARENT') NOT NULL,
  `stockOwnerId` VARCHAR(191) NOT NULL,
  `stockBefore` INTEGER NOT NULL,
  `stockAfter` INTEGER NOT NULL,
  `unitCost` DECIMAL(12,2) NOT NULL,
  `totalCost` DECIMAL(14,2) NOT NULL,
  `note` TEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MerchantOmsPurchase_merchantId_purchaseDate_idx`(`merchantId`, `purchaseDate`),
  INDEX `MerchantOmsPurchase_productId_idx`(`productId`),
  INDEX `MerchantOmsPurchase_parentId_idx`(`parentId`),
  INDEX `MerchantOmsPurchase_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Merchant`
  ADD CONSTRAINT `Merchant_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProductParent`
  ADD CONSTRAINT `ProductParent_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PurchaseOrder`
  ADD CONSTRAINT `PurchaseOrder_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `MetaCampaignMapping`
  ADD CONSTRAINT `MetaCampaignMapping_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `MerchantCourier`
  ADD CONSTRAINT `MerchantCourier_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantCourier_courierId_fkey`
  FOREIGN KEY (`courierId`) REFERENCES `Courier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `MerchantDollarRecharge`
  ADD CONSTRAINT `MerchantDollarRecharge_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantDollarRecharge_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MerchantOperatingCost`
  ADD CONSTRAINT `MerchantOperatingCost_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantOperatingCost_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MerchantOmsPurchase`
  ADD CONSTRAINT `MerchantOmsPurchase_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantOmsPurchase_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantOmsPurchase_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `ProductParent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MerchantOmsPurchase_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
