-- Ready-to-Ship Google Sheets daily trace sync.
CREATE TABLE `ReadyOrderSheetSetting` (
  `id` VARCHAR(191) NOT NULL DEFAULT 'default',
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `spreadsheetId` VARCHAR(191) NULL,
  `sheetName` VARCHAR(191) NOT NULL DEFAULT 'Data',
  `syncHour` INTEGER NOT NULL DEFAULT 22,
  `syncMinute` INTEGER NOT NULL DEFAULT 30,
  `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Dhaka',
  `serviceAccountEncrypted` LONGTEXT NULL,
  `serviceAccountIv` VARCHAR(191) NULL,
  `serviceAccountTag` VARCHAR(191) NULL,
  `serviceAccountEmail` VARCHAR(191) NULL,
  `lastSyncAt` DATETIME(3) NULL,
  `lastSyncBusinessDate` VARCHAR(191) NULL,
  `lastAutoSyncBusinessDate` VARCHAR(191) NULL,
  `lastSyncStatus` VARCHAR(191) NULL,
  `lastSyncMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReadyOrderSheetSyncItem` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `spreadsheetId` VARCHAR(191) NOT NULL,
  `sheetName` VARCHAR(191) NOT NULL,
  `businessDate` VARCHAR(191) NOT NULL,
  `sheetRowNumber` INTEGER NULL,
  `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ReadyOrderSheetSyncItem_orderId_spreadsheetId_sheetName_key`(`orderId`, `spreadsheetId`, `sheetName`),
  INDEX `ReadyOrderSheetSyncItem_businessDate_idx`(`businessDate`),
  INDEX `ReadyOrderSheetSyncItem_syncedAt_idx`(`syncedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReadyOrderSheetSyncItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReadyOrderSheetSyncRun` (
  `id` VARCHAR(191) NOT NULL,
  `businessDate` VARCHAR(191) NOT NULL,
  `mode` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `totalReadyOrders` INTEGER NOT NULL DEFAULT 0,
  `pendingOrders` INTEGER NOT NULL DEFAULT 0,
  `appendedOrders` INTEGER NOT NULL DEFAULT 0,
  `skippedOrders` INTEGER NOT NULL DEFAULT 0,
  `failedOrders` INTEGER NOT NULL DEFAULT 0,
  `message` TEXT NULL,
  `triggeredByUserId` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  INDEX `ReadyOrderSheetSyncRun_businessDate_idx`(`businessDate`),
  INDEX `ReadyOrderSheetSyncRun_mode_idx`(`mode`),
  INDEX `ReadyOrderSheetSyncRun_status_idx`(`status`),
  INDEX `ReadyOrderSheetSyncRun_triggeredByUserId_idx`(`triggeredByUserId`),
  INDEX `ReadyOrderSheetSyncRun_startedAt_idx`(`startedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReadyOrderSheetSyncRun_triggeredByUserId_fkey` FOREIGN KEY (`triggeredByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
