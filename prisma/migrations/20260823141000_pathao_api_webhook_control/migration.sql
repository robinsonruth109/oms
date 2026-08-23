-- Pathao courier API, webhook, order lifecycle and post-print audit.
ALTER TABLE `Courier`
  ADD COLUMN `pathaoEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `pathaoEnvironment` ENUM('SANDBOX','LIVE') NOT NULL DEFAULT 'LIVE',
  ADD COLUMN `pathaoCredentialsEncrypted` TEXT NULL,
  ADD COLUMN `pathaoCredentialsIv` VARCHAR(191) NULL,
  ADD COLUMN `pathaoCredentialsTag` VARCHAR(191) NULL,
  ADD COLUMN `pathaoTokenEncrypted` TEXT NULL,
  ADD COLUMN `pathaoTokenIv` VARCHAR(191) NULL,
  ADD COLUMN `pathaoTokenTag` VARCHAR(191) NULL,
  ADD COLUMN `pathaoTokenExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `pathaoStoreId` INTEGER NULL,
  ADD COLUMN `pathaoStoreName` VARCHAR(191) NULL,
  ADD COLUMN `pathaoStoreAddress` TEXT NULL,
  ADD COLUMN `pathaoWebhookSecretEncrypted` TEXT NULL,
  ADD COLUMN `pathaoWebhookSecretIv` VARCHAR(191) NULL,
  ADD COLUMN `pathaoWebhookSecretTag` VARCHAR(191) NULL,
  ADD COLUMN `pathaoLastTestedAt` DATETIME(3) NULL,
  ADD COLUMN `pathaoLastTestSuccess` BOOLEAN NULL,
  ADD COLUMN `pathaoLastTestMessage` TEXT NULL;

CREATE INDEX `Courier_status_idx` ON `Courier`(`status`);
CREATE INDEX `Courier_pathaoEnabled_idx` ON `Courier`(`pathaoEnabled`);
CREATE INDEX `Courier_pathaoStoreId_idx` ON `Courier`(`pathaoStoreId`);

ALTER TABLE `Order`
  ADD COLUMN `pathaoCourierId` VARCHAR(191) NULL,
  ADD COLUMN `pathaoConsignmentId` VARCHAR(191) NULL,
  ADD COLUMN `pathaoMerchantOrderId` VARCHAR(191) NULL,
  ADD COLUMN `pathaoSubmissionStatus` ENUM('NOT_SUBMITTED','SUBMITTING','SUBMITTED','CONSIGNMENT_CREATED','FAILED') NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN `pathaoOrderStatus` VARCHAR(191) NULL,
  ADD COLUMN `pathaoOrderStatusSlug` VARCHAR(191) NULL,
  ADD COLUMN `pathaoDeliveryFee` DECIMAL(10,2) NULL,
  ADD COLUMN `pathaoSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN `pathaoCreatedAt` DATETIME(3) NULL,
  ADD COLUMN `pathaoLastSyncedAt` DATETIME(3) NULL,
  ADD COLUMN `pathaoLastError` TEXT NULL,
  ADD COLUMN `pathaoRawResponse` LONGTEXT NULL;

CREATE UNIQUE INDEX `Order_pathaoConsignmentId_key` ON `Order`(`pathaoConsignmentId`);
CREATE INDEX `Order_pathaoCourierId_idx` ON `Order`(`pathaoCourierId`);
CREATE INDEX `Order_pathaoMerchantOrderId_idx` ON `Order`(`pathaoMerchantOrderId`);
CREATE INDEX `Order_pathaoSubmissionStatus_idx` ON `Order`(`pathaoSubmissionStatus`);
CREATE INDEX `Order_pathaoOrderStatusSlug_idx` ON `Order`(`pathaoOrderStatusSlug`);

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_pathaoCourierId_fkey`
  FOREIGN KEY (`pathaoCourierId`) REFERENCES `Courier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `PathaoWebhookEvent` (
  `id` VARCHAR(191) NOT NULL,
  `courierId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `eventName` VARCHAR(191) NOT NULL,
  `consignmentId` VARCHAR(191) NULL,
  `merchantOrderId` VARCHAR(191) NULL,
  `signatureValid` BOOLEAN NOT NULL DEFAULT false,
  `processed` BOOLEAN NOT NULL DEFAULT false,
  `processingNote` TEXT NULL,
  `rawPayload` JSON NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `PathaoWebhookEvent_courierId_idx`(`courierId`),
  INDEX `PathaoWebhookEvent_orderId_idx`(`orderId`),
  INDEX `PathaoWebhookEvent_eventName_idx`(`eventName`),
  INDEX `PathaoWebhookEvent_consignmentId_idx`(`consignmentId`),
  INDEX `PathaoWebhookEvent_merchantOrderId_idx`(`merchantOrderId`),
  INDEX `PathaoWebhookEvent_receivedAt_idx`(`receivedAt`),
  CONSTRAINT `PathaoWebhookEvent_courierId_fkey`
    FOREIGN KEY (`courierId`) REFERENCES `Courier`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PathaoWebhookEvent_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PostPrintActionLog` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `actionType` ENUM('STOCK_OUT','CANCELLED') NOT NULL,
  `actionMethod` ENUM('SINGLE','CSV') NOT NULL,
  `previousStatus` ENUM('PENDING_CONFIRMATION','READY_TO_SHIP','NO_ANSWER','PHONE_OFF','CANCELLED','DOUBLE_ORDER','STOCK_OUT','RETURNED') NOT NULL,
  `newStatus` ENUM('PENDING_CONFIRMATION','READY_TO_SHIP','NO_ANSWER','PHONE_OFF','CANCELLED','DOUBLE_ORDER','STOCK_OUT','RETURNED') NOT NULL,
  `performedByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `PostPrintActionLog_orderId_idx`(`orderId`),
  INDEX `PostPrintActionLog_invoiceId_idx`(`invoiceId`),
  INDEX `PostPrintActionLog_actionType_idx`(`actionType`),
  INDEX `PostPrintActionLog_actionMethod_idx`(`actionMethod`),
  INDEX `PostPrintActionLog_performedByUserId_idx`(`performedByUserId`),
  INDEX `PostPrintActionLog_createdAt_idx`(`createdAt`),
  CONSTRAINT `PostPrintActionLog_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PostPrintActionLog_performedByUserId_fkey`
    FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
