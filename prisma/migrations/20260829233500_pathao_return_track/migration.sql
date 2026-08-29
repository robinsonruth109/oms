-- Pathao return consignment tracking, partial-return support and idempotent stock restoration.
ALTER TABLE `Order`
  MODIFY `orderStatus` ENUM(
    'PENDING_CONFIRMATION',
    'READY_TO_SHIP',
    'NO_ANSWER',
    'PHONE_OFF',
    'CANCELLED',
    'DOUBLE_ORDER',
    'STOCK_OUT',
    'RETURNED',
    'PARTIAL_RETURN'
  ) NOT NULL DEFAULT 'PENDING_CONFIRMATION';

CREATE TABLE `PathaoReturnTrack` (
  `id` VARCHAR(191) NOT NULL,
  `returnConsignmentId` VARCHAR(191) NOT NULL,
  `outboundConsignmentId` VARCHAR(191) NULL,
  `merchantOrderId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `pathaoCourierId` VARCHAR(191) NOT NULL,
  `pathaoOrderStatus` VARCHAR(191) NULL,
  `pathaoOrderStatusSlug` VARCHAR(191) NULL,
  `previousOmsStatus` VARCHAR(191) NOT NULL,
  `newOmsStatus` VARCHAR(191) NOT NULL,
  `returnType` VARCHAR(191) NOT NULL,
  `totalRestoredQty` INTEGER NOT NULL,
  `processingMethod` VARCHAR(191) NOT NULL,
  `rawPathaoResponse` JSON NULL,
  `processedByUserId` VARCHAR(191) NOT NULL,
  `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PathaoReturnTrack_returnConsignmentId_key`(`returnConsignmentId`),
  INDEX `PathaoReturnTrack_merchantOrderId_idx`(`merchantOrderId`),
  INDEX `PathaoReturnTrack_orderId_idx`(`orderId`),
  INDEX `PathaoReturnTrack_pathaoCourierId_idx`(`pathaoCourierId`),
  INDEX `PathaoReturnTrack_processedByUserId_idx`(`processedByUserId`),
  INDEX `PathaoReturnTrack_processedAt_idx`(`processedAt`),
  INDEX `PathaoReturnTrack_returnType_idx`(`returnType`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PathaoReturnTrack_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PathaoReturnTrack_pathaoCourierId_fkey` FOREIGN KEY (`pathaoCourierId`) REFERENCES `Courier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PathaoReturnTrack_processedByUserId_fkey` FOREIGN KEY (`processedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PathaoReturnItem` (
  `id` VARCHAR(191) NOT NULL,
  `returnTrackId` VARCHAR(191) NOT NULL,
  `orderItemId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `productSkuSnapshot` VARCHAR(191) NOT NULL,
  `productNameSnapshot` VARCHAR(191) NOT NULL,
  `orderedQty` INTEGER NOT NULL,
  `returnedQty` INTEGER NOT NULL,
  `stockBefore` INTEGER NOT NULL,
  `stockAfter` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PathaoReturnItem_returnTrackId_orderItemId_key`(`returnTrackId`, `orderItemId`),
  INDEX `PathaoReturnItem_orderItemId_idx`(`orderItemId`),
  INDEX `PathaoReturnItem_productId_idx`(`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PathaoReturnItem_returnTrackId_fkey` FOREIGN KEY (`returnTrackId`) REFERENCES `PathaoReturnTrack`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PathaoReturnItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PathaoReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
