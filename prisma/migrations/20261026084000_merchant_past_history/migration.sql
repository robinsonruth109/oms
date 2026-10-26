ALTER TABLE `Merchant`
  ADD COLUMN `omsAccountingStartDate` DATETIME(3) NULL;

CREATE TABLE `MerchantPastHistory` (
  `id` VARCHAR(191) NOT NULL,
  `merchantId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NOT NULL,
  `historyMonth` DATETIME(3) NOT NULL,
  `courierSendQty` INTEGER NOT NULL DEFAULT 0,
  `returnReceivedQty` INTEGER NOT NULL DEFAULT 0,
  `adsCostBdt` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `returnCost` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `discount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `profit` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MPH_merchant_parent_month_uq`(`merchantId`, `parentId`, `historyMonth`),
  INDEX `MPH_merchant_month_idx`(`merchantId`, `historyMonth`),
  INDEX `MPH_parent_month_idx`(`parentId`, `historyMonth`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MerchantPastHistory`
  ADD CONSTRAINT `MPH_merchant_fk`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `MerchantPastHistory`
  ADD CONSTRAINT `MPH_parent_fk`
  FOREIGN KEY (`parentId`) REFERENCES `ProductParent`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
