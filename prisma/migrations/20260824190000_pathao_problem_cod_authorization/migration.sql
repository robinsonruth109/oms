-- Pathao Problem / COD authorization audit.
ALTER TABLE `Order`
  ADD COLUMN `pathaoAmountToCollect` DECIMAL(10,2) NULL,
  ADD COLUMN `pathaoAuthorizedCodAmount` DECIMAL(10,2) NULL,
  ADD COLUMN `pathaoCodAdjustmentReason` TEXT NULL,
  ADD COLUMN `pathaoCodApprovedByUserId` VARCHAR(191) NULL,
  ADD COLUMN `pathaoCodApprovedAt` DATETIME(3) NULL;

CREATE INDEX `Order_pathaoCodApprovedByUserId_idx`
  ON `Order`(`pathaoCodApprovedByUserId`);

CREATE INDEX `Order_pathaoCodApprovedAt_idx`
  ON `Order`(`pathaoCodApprovedAt`);

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_pathaoCodApprovedByUserId_fkey`
  FOREIGN KEY (`pathaoCodApprovedByUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `PathaoCodAuthorization` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `originalOmsTotal` DECIMAL(10,2) NOT NULL,
  `previousAuthorizedAmount` DECIMAL(10,2) NULL,
  `authorizedAmount` DECIMAL(10,2) NOT NULL,
  `pathaoAmountAtApproval` DECIMAL(10,2) NULL,
  `reason` TEXT NOT NULL,
  `approvedByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `PathaoCodAuthorization_orderId_idx`(`orderId`),
  INDEX `PathaoCodAuthorization_approvedByUserId_idx`(`approvedByUserId`),
  INDEX `PathaoCodAuthorization_createdAt_idx`(`createdAt`),

  CONSTRAINT `PathaoCodAuthorization_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT `PathaoCodAuthorization_approvedByUserId_fkey`
    FOREIGN KEY (`approvedByUserId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
