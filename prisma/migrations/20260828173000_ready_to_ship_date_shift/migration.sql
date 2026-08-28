-- Ready-to-Ship date shifting with persistent action-level logs and order snapshots.
CREATE TABLE `ReadyToShipDateShift` (
  `id` VARCHAR(191) NOT NULL,
  `sourceDate` VARCHAR(191) NULL,
  `targetDate` VARCHAR(191) NOT NULL,
  `method` VARCHAR(191) NOT NULL,
  `totalOrders` INTEGER NOT NULL,
  `uploadedFileName` VARCHAR(191) NULL,
  `performedByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ReadyToShipDateShift_sourceDate_idx`(`sourceDate`),
  INDEX `ReadyToShipDateShift_targetDate_idx`(`targetDate`),
  INDEX `ReadyToShipDateShift_method_idx`(`method`),
  INDEX `ReadyToShipDateShift_performedByUserId_idx`(`performedByUserId`),
  INDEX `ReadyToShipDateShift_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReadyToShipDateShift_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReadyToShipDateShiftItem` (
  `id` VARCHAR(191) NOT NULL,
  `shiftId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `invoiceIdSnapshot` VARCHAR(191) NULL,
  `fromReadyToShipAt` DATETIME(3) NOT NULL,
  `toReadyToShipAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ReadyToShipDateShiftItem_shiftId_orderId_key`(`shiftId`, `orderId`),
  INDEX `ReadyToShipDateShiftItem_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReadyToShipDateShiftItem_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `ReadyToShipDateShift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReadyToShipDateShiftItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
