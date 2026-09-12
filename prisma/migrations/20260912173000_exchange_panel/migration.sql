-- Exchange order panel: keeps the historical/original order unchanged while
-- creating a linked ready-to-ship exchange memo that was already created in Pathao.

ALTER TABLE `Order`
  ADD COLUMN `orderKind` ENUM('NORMAL','EXCHANGE') NOT NULL DEFAULT 'NORMAL';

CREATE INDEX `Order_orderKind_idx` ON `Order`(`orderKind`);

CREATE TABLE `ExchangeCase` (
  `id` VARCHAR(191) NOT NULL,
  `exchangeCode` VARCHAR(191) NOT NULL,
  `sequenceNo` INTEGER NOT NULL,
  `originalOrderId` VARCHAR(191) NOT NULL,
  `exchangeOrderId` VARCHAR(191) NOT NULL,
  `originalPathaoConsignmentId` VARCHAR(191) NULL,
  `pathaoExchangeConsignmentId` VARCHAR(191) NOT NULL,
  `pathaoCourierIdSnapshot` VARCHAR(191) NULL,
  `pathaoCourierNameSnapshot` VARCHAR(191) NULL,
  `reason` TEXT NULL,
  `note` TEXT NULL,
  `returnedCredit` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `outgoingSubtotal` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `priceDifference` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `exchangeDeliveryCharge` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `amountToCollect` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `customerCredit` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `verificationStatus` ENUM('VERIFIED','PENDING','FAILED') NOT NULL DEFAULT 'PENDING',
  `verificationMessage` TEXT NULL,
  `pathaoOrderStatus` VARCHAR(191) NULL,
  `pathaoOrderStatusSlug` VARCHAR(191) NULL,
  `status` ENUM('ISSUED','PATHAO_EXCHANGED','CANCELLED') NOT NULL DEFAULT 'ISSUED',
  `completedAt` DATETIME(3) NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ExchangeCase_exchangeCode_key`(`exchangeCode`),
  UNIQUE INDEX `ExchangeCase_exchangeOrderId_key`(`exchangeOrderId`),
  UNIQUE INDEX `ExchangeCase_pathaoExchangeConsignmentId_key`(`pathaoExchangeConsignmentId`),
  UNIQUE INDEX `ExchangeCase_originalOrderId_sequenceNo_key`(`originalOrderId`, `sequenceNo`),
  INDEX `ExchangeCase_originalOrderId_idx`(`originalOrderId`),
  INDEX `ExchangeCase_exchangeOrderId_idx`(`exchangeOrderId`),
  INDEX `ExchangeCase_createdByUserId_idx`(`createdByUserId`),
  INDEX `ExchangeCase_status_idx`(`status`),
  INDEX `ExchangeCase_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ExchangeCase_originalOrderId_fkey` FOREIGN KEY (`originalOrderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ExchangeCase_exchangeOrderId_fkey` FOREIGN KEY (`exchangeOrderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ExchangeCase_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ExchangeCaseItem` (
  `id` VARCHAR(191) NOT NULL,
  `exchangeCaseId` VARCHAR(191) NOT NULL,
  `kind` ENUM('EXPECTED_RETURN','OUTGOING') NOT NULL,
  `originalOrderItemId` VARCHAR(191) NULL,
  `productId` VARCHAR(191) NULL,
  `productSkuSnapshot` VARCHAR(191) NOT NULL,
  `productNameSnapshot` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unitPrice` DECIMAL(10,2) NOT NULL,
  `lineTotal` DECIMAL(10,2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ExchangeCaseItem_exchangeCaseId_idx`(`exchangeCaseId`),
  INDEX `ExchangeCaseItem_kind_idx`(`kind`),
  INDEX `ExchangeCaseItem_originalOrderItemId_idx`(`originalOrderItemId`),
  INDEX `ExchangeCaseItem_productId_idx`(`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ExchangeCaseItem_exchangeCaseId_fkey` FOREIGN KEY (`exchangeCaseId`) REFERENCES `ExchangeCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ExchangeCaseItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
