-- Historical stock-out CSV restore/import audit.
CREATE TABLE `StockOutRestoreBatch` (
  `id` VARCHAR(191) NOT NULL,
  `batchNo` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `totalRows` INTEGER NOT NULL,
  `importedCount` INTEGER NOT NULL DEFAULT 0,
  `restoredCount` INTEGER NOT NULL DEFAULT 0,
  `skippedCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `StockOutRestoreBatch_batchNo_key`(`batchNo`),
  INDEX `StockOutRestoreBatch_createdByUserId_idx`(`createdByUserId`),
  INDEX `StockOutRestoreBatch_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),

  CONSTRAINT `StockOutRestoreBatch_createdByUserId_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StockOutRestoreItem` (
  `id` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `rowNumber` INTEGER NOT NULL,
  `invoiceId` VARCHAR(191) NOT NULL,
  `resultStatus` VARCHAR(191) NOT NULL,
  `resultMessage` TEXT NULL,
  `orderId` VARCHAR(191) NULL,
  `rawData` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `StockOutRestoreItem_batchId_idx`(`batchId`),
  INDEX `StockOutRestoreItem_invoiceId_idx`(`invoiceId`),
  INDEX `StockOutRestoreItem_resultStatus_idx`(`resultStatus`),
  INDEX `StockOutRestoreItem_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),

  CONSTRAINT `StockOutRestoreItem_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `StockOutRestoreBatch`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
