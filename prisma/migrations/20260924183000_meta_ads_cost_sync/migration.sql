CREATE TABLE `MetaAdsConnection` (
  `id` VARCHAR(191) NOT NULL,
  `metaUserId` VARCHAR(191) NOT NULL,
  `metaUserName` VARCHAR(191) NULL,
  `accessTokenEncrypted` LONGTEXT NOT NULL,
  `accessTokenIv` VARCHAR(191) NOT NULL,
  `accessTokenTag` VARCHAR(191) NOT NULL,
  `tokenExpiresAt` DATETIME(3) NULL,
  `status` BOOLEAN NOT NULL DEFAULT true,
  `lastSyncAt` DATETIME(3) NULL,
  `lastSyncStatus` VARCHAR(191) NULL,
  `lastSyncMessage` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MetaAdsConnection_metaUserId_key`(`metaUserId`),
  INDEX `MetaAdsConnection_status_idx`(`status`),
  INDEX `MetaAdsConnection_lastSyncAt_idx`(`lastSyncAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MetaAdAccount` (
  `id` VARCHAR(191) NOT NULL,
  `connectionId` VARCHAR(191) NOT NULL,
  `metaAccountId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
  `timezoneName` VARCHAR(191) NULL,
  `accountStatus` INTEGER NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `lastSyncAt` DATETIME(3) NULL,
  `lastSyncStatus` VARCHAR(191) NULL,
  `lastSyncMessage` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MetaAdAccount_metaAccountId_key`(`metaAccountId`),
  INDEX `MetaAdAccount_connectionId_idx`(`connectionId`),
  INDEX `MetaAdAccount_enabled_idx`(`enabled`),
  INDEX `MetaAdAccount_lastSyncAt_idx`(`lastSyncAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MetaCampaign` (
  `id` VARCHAR(191) NOT NULL,
  `adAccountId` VARCHAR(191) NOT NULL,
  `metaCampaignId` VARCHAR(191) NOT NULL,
  `campaignName` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NULL,
  `lastSeenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MetaCampaign_adAccountId_metaCampaignId_key`(`adAccountId`, `metaCampaignId`),
  INDEX `MetaCampaign_campaignName_idx`(`campaignName`),
  INDEX `MetaCampaign_lastSeenAt_idx`(`lastSeenAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MetaCampaignMapping` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `productParentId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MetaCampaignMapping_campaignId_key`(`campaignId`),
  INDEX `MetaCampaignMapping_productParentId_idx`(`productParentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MetaCampaignSource` (
  `id` VARCHAR(191) NOT NULL,
  `mappingId` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MetaCampaignSource_mappingId_sourceId_key`(`mappingId`, `sourceId`),
  INDEX `MetaCampaignSource_sourceId_idx`(`sourceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MetaDailySpend` (
  `id` VARCHAR(191) NOT NULL,
  `adAccountId` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `spendDate` DATETIME(3) NOT NULL,
  `amountSpent` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `campaignNameSnapshot` VARCHAR(191) NOT NULL,
  `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MetaDailySpend_adAccountId_campaignId_spendDate_key`(`adAccountId`, `campaignId`, `spendDate`),
  INDEX `MetaDailySpend_campaignId_idx`(`campaignId`),
  INDEX `MetaDailySpend_spendDate_idx`(`spendDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MetaAdsSyncRun` (
  `id` VARCHAR(191) NOT NULL,
  `adAccountId` VARCHAR(191) NULL,
  `mode` VARCHAR(191) NOT NULL,
  `fromDate` VARCHAR(191) NOT NULL,
  `toDate` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `campaignsSeen` INTEGER NOT NULL DEFAULT 0,
  `rowsSynced` INTEGER NOT NULL DEFAULT 0,
  `message` LONGTEXT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  INDEX `MetaAdsSyncRun_adAccountId_idx`(`adAccountId`),
  INDEX `MetaAdsSyncRun_mode_idx`(`mode`),
  INDEX `MetaAdsSyncRun_toDate_idx`(`toDate`),
  INDEX `MetaAdsSyncRun_startedAt_idx`(`startedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MetaAdAccount`
  ADD CONSTRAINT `MetaAdAccount_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `MetaAdsConnection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MetaCampaign`
  ADD CONSTRAINT `MetaCampaign_adAccountId_fkey` FOREIGN KEY (`adAccountId`) REFERENCES `MetaAdAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MetaCampaignMapping`
  ADD CONSTRAINT `MetaCampaignMapping_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `MetaCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `MetaCampaignMapping_productParentId_fkey` FOREIGN KEY (`productParentId`) REFERENCES `ProductParent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MetaCampaignSource`
  ADD CONSTRAINT `MetaCampaignSource_mappingId_fkey` FOREIGN KEY (`mappingId`) REFERENCES `MetaCampaignMapping`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `MetaCampaignSource_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `OrderSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MetaDailySpend`
  ADD CONSTRAINT `MetaDailySpend_adAccountId_fkey` FOREIGN KEY (`adAccountId`) REFERENCES `MetaAdAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `MetaDailySpend_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `MetaCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MetaAdsSyncRun`
  ADD CONSTRAINT `MetaAdsSyncRun_adAccountId_fkey` FOREIGN KEY (`adAccountId`) REFERENCES `MetaAdAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
