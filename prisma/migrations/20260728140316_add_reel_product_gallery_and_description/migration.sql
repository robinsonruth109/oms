-- AlterTable
ALTER TABLE `ReelProduct` ADD COLUMN `descriptionHtml` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `ReelProductMedia` (
    `id` VARCHAR(191) NOT NULL,
    `reelProductId` VARCHAR(191) NOT NULL,
    `mediaType` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `url` TEXT NOT NULL,
    `publicId` VARCHAR(191) NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `format` VARCHAR(191) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration` DECIMAL(10, 2) NULL,
    `bytes` INTEGER NULL,
    `altText` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReelProductMedia_publicId_key`(`publicId`),
    INDEX `ReelProductMedia_reelProductId_idx`(`reelProductId`),
    INDEX `ReelProductMedia_mediaType_idx`(`mediaType`),
    INDEX `ReelProductMedia_displayOrder_idx`(`displayOrder`),
    INDEX `ReelProductMedia_isPrimary_idx`(`isPrimary`),
    INDEX `ReelProductMedia_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReelProductMedia` ADD CONSTRAINT `ReelProductMedia_reelProductId_fkey` FOREIGN KEY (`reelProductId`) REFERENCES `ReelProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
