ALTER TABLE `Order`
  ADD COLUMN `checkoutRequestId` VARCHAR(191) NULL,
  ADD COLUMN `metaPurchaseEventId` VARCHAR(191) NULL,
  ADD COLUMN `metaPurchaseSentAt` DATETIME(3) NULL,
  ADD COLUMN `metaPurchaseStatus` VARCHAR(191) NULL,
  ADD COLUMN `metaPurchaseError` TEXT NULL,
  ADD COLUMN `metaPurchaseResponse` TEXT NULL;

CREATE UNIQUE INDEX `Order_checkoutRequestId_key` ON `Order`(`checkoutRequestId`);
CREATE UNIQUE INDEX `Order_metaPurchaseEventId_key` ON `Order`(`metaPurchaseEventId`);
