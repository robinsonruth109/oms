-- Order history / audit timeline for All Order View / Edit.
CREATE TABLE `OrderAuditEvent` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `details` JSON NULL,
  `performedByUserId` VARCHAR(191) NULL,
  `actorLabel` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `OrderAuditEvent_orderId_idx`(`orderId`),
  INDEX `OrderAuditEvent_eventType_idx`(`eventType`),
  INDEX `OrderAuditEvent_performedByUserId_idx`(`performedByUserId`),
  INDEX `OrderAuditEvent_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrderAuditEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OrderAuditEvent_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
