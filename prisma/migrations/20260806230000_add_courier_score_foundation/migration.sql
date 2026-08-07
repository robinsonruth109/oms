-- CreateTable
CREATE TABLE `CourierCredential` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('PATHAO', 'STEADFAST', 'REDX') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `usernameEncrypted` TEXT NULL,
    `usernameIv` VARCHAR(191) NULL,
    `usernameTag` VARCHAR(191) NULL,
    `passwordEncrypted` TEXT NULL,
    `passwordIv` VARCHAR(191) NULL,
    `passwordTag` VARCHAR(191) NULL,
    `lastTestedAt` DATETIME(3) NULL,
    `lastTestSuccess` BOOLEAN NULL,
    `lastTestMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CourierCredential_provider_key`(`provider`),
    INDEX `CourierCredential_enabled_idx`(`enabled`),
    INDEX `CourierCredential_lastTestedAt_idx`(`lastTestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerCourierScore` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `delivered` INTEGER NOT NULL DEFAULT 0,
    `returned` INTEGER NOT NULL DEFAULT 0,
    `successRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `riskLevel` ENUM('NEW_CUSTOMER', 'LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'NEW_CUSTOMER',
    `courierData` JSON NOT NULL,
    `errors` JSON NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomerCourierScore_phone_key`(`phone`),
    INDEX `CustomerCourierScore_expiresAt_idx`(`expiresAt`),
    INDEX `CustomerCourierScore_riskLevel_idx`(`riskLevel`),
    INDEX `CustomerCourierScore_checkedAt_idx`(`checkedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
