-- CreateTable
CREATE TABLE `ShopSetting` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `insideDhakaDeliveryCharge` DECIMAL(10, 2) NOT NULL DEFAULT 70,
    `outsideDhakaDeliveryCharge` DECIMAL(10, 2) NOT NULL DEFAULT 150,
    `metaPixelId` VARCHAR(191) NULL,
    `metaPixelEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
