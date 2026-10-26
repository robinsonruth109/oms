-- CreateTable
CREATE TABLE `MetaCampaignMerchantAllocation` (
    `id` VARCHAR(191) NOT NULL,
    `mappingId` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `fromDate` VARCHAR(10) NOT NULL,
    `toDate` VARCHAR(10) NOT NULL,
    `amountUsd` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MetaCampaignMerchantAllocation_mappingId_merchantId_fromDate_toDate_key`(`mappingId`, `merchantId`, `fromDate`, `toDate`),
    INDEX `MetaCampaignMerchantAllocation_mappingId_fromDate_toDate_idx`(`mappingId`, `fromDate`, `toDate`),
    INDEX `MetaCampaignMerchantAllocation_merchantId_fromDate_toDate_idx`(`merchantId`, `fromDate`, `toDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MetaCampaignMerchantAllocation` ADD CONSTRAINT `MetaCampaignMerchantAllocation_mappingId_fkey` FOREIGN KEY (`mappingId`) REFERENCES `MetaCampaignMapping`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetaCampaignMerchantAllocation` ADD CONSTRAINT `MetaCampaignMerchantAllocation_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
