-- CreateTable
CREATE TABLE `MobileNotification` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('NEW_PRODUCT') NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `reelProductId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `imageUrl` TEXT NULL,
    `deeplink` TEXT NOT NULL,
    `topic` VARCHAR(191) NOT NULL DEFAULT 'new-products',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastAttemptAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MobileNotification_type_reelProductId_key`(`type`, `reelProductId`),
    INDEX `MobileNotification_reelProductId_idx`(`reelProductId`),
    INDEX `MobileNotification_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `MobileNotification_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MobileNotification`
ADD CONSTRAINT `MobileNotification_reelProductId_fkey`
FOREIGN KEY (`reelProductId`) REFERENCES `ReelProduct`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
