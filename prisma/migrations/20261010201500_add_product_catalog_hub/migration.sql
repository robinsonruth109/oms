-- Product Master catalog hub foundation.
-- Existing inventory/order behavior is untouched. Existing integrations default
-- to SUBCATEGORY catalog mode and product sync remains disabled until configured.

ALTER TABLE `Integration`
  ADD COLUMN `catalogMode` ENUM('COLLECTION','SUBCATEGORY') NOT NULL DEFAULT 'SUBCATEGORY',
  ADD COLUMN `baseUrl` VARCHAR(191) NULL,
  ADD COLUMN `catalogApiToken` TEXT NULL,
  ADD COLUMN `productSyncEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lastTaxonomySyncAt` DATETIME(3) NULL,
  ADD COLUMN `lastCatalogSyncAt` DATETIME(3) NULL;

CREATE INDEX `Integration_catalogMode_idx` ON `Integration`(`catalogMode`);

CREATE TABLE `ProductCatalogContent` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `banglaName` TEXT NULL,
  `englishName` TEXT NULL,
  `productSlug` TEXT NULL,
  `shortDescriptionHtml` LONGTEXT NULL,
  `fullDescriptionHtml` LONGTEXT NULL,
  `oldPrice` DECIMAL(10,2) NULL,
  `featured` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `metaTitle` TEXT NULL,
  `metaDescription` TEXT NULL,
  `externalVideoUrl` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductCatalogContent_productId_key`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductMedia` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `kind` ENUM('IMAGE','VIDEO') NOT NULL,
  `objectKey` VARCHAR(768) NOT NULL,
  `originalFileName` TEXT NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `sizeBytes` BIGINT NOT NULL,
  `checksum` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductMedia_objectKey_key`(`objectKey`),
  INDEX `ProductMedia_productId_kind_sortOrder_idx`(`productId`, `kind`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductWebsiteTaxonomyTerm` (
  `id` VARCHAR(191) NOT NULL,
  `integrationId` VARCHAR(191) NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `type` ENUM('CATEGORY','SUBCATEGORY','COLLECTION') NOT NULL,
  `parentExternalId` VARCHAR(191) NULL,
  `name` TEXT NOT NULL,
  `slug` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductWebsiteTaxonomyTerm_integrationId_type_externalId_key`(`integrationId`, `type`, `externalId`),
  INDEX `ProductWebsiteTaxonomyTerm_integrationId_type_idx`(`integrationId`, `type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductWebsiteListing` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `integrationId` VARCHAR(191) NOT NULL,
  `productSlugOverride` TEXT NULL,
  `sellingPriceOverride` DECIMAL(10,2) NULL,
  `oldPriceOverride` DECIMAL(10,2) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `featuredOverride` BOOLEAN NULL,
  `remoteProductId` VARCHAR(191) NULL,
  `publicUrl` TEXT NULL,
  `syncStatus` ENUM('NOT_PUBLISHED','PENDING','SYNCING','SYNCED','FAILED') NOT NULL DEFAULT 'NOT_PUBLISHED',
  `lastSyncedAt` DATETIME(3) NULL,
  `lastSyncError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductWebsiteListing_productId_integrationId_key`(`productId`, `integrationId`),
  INDEX `ProductWebsiteListing_integrationId_syncStatus_idx`(`integrationId`, `syncStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductWebsiteTaxonomy` (
  `id` VARCHAR(191) NOT NULL,
  `listingId` VARCHAR(191) NOT NULL,
  `termId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ProductWebsiteTaxonomy_listingId_termId_key`(`listingId`, `termId`),
  INDEX `ProductWebsiteTaxonomy_termId_idx`(`termId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductSyncJob` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `integrationId` VARCHAR(191) NOT NULL,
  `listingId` VARCHAR(191) NULL,
  `operation` ENUM('FULL_UPSERT','STOCK_ONLY','UNPUBLISH') NOT NULL,
  `status` ENUM('PENDING','RUNNING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `payloadHash` VARCHAR(191) NULL,
  `lastError` TEXT NULL,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ProductSyncJob_status_availableAt_idx`(`status`, `availableAt`),
  INDEX `ProductSyncJob_productId_integrationId_idx`(`productId`, `integrationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductCatalogImportCandidate` (
  `id` VARCHAR(191) NOT NULL,
  `integrationId` VARCHAR(191) NOT NULL,
  `remoteProductId` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `status` ENUM('PENDING','MATCHED','IGNORED') NOT NULL DEFAULT 'PENDING',
  `matchedProductId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductCatalogImportCandidate_integrationId_remoteProductId_key`(`integrationId`, `remoteProductId`),
  INDEX `ProductCatalogImportCandidate_integrationId_sku_idx`(`integrationId`, `sku`),
  INDEX `ProductCatalogImportCandidate_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductCatalogContent`
  ADD CONSTRAINT `ProductCatalogContent_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductMedia`
  ADD CONSTRAINT `ProductMedia_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductWebsiteTaxonomyTerm`
  ADD CONSTRAINT `ProductWebsiteTaxonomyTerm_integrationId_fkey`
  FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductWebsiteListing`
  ADD CONSTRAINT `ProductWebsiteListing_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductWebsiteListing_integrationId_fkey`
  FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductWebsiteTaxonomy`
  ADD CONSTRAINT `ProductWebsiteTaxonomy_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `ProductWebsiteListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductWebsiteTaxonomy_termId_fkey`
  FOREIGN KEY (`termId`) REFERENCES `ProductWebsiteTaxonomyTerm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductSyncJob`
  ADD CONSTRAINT `ProductSyncJob_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductSyncJob_integrationId_fkey`
  FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductSyncJob_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `ProductWebsiteListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductCatalogImportCandidate`
  ADD CONSTRAINT `ProductCatalogImportCandidate_integrationId_fkey`
  FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductCatalogImportCandidate_matchedProductId_fkey`
  FOREIGN KEY (`matchedProductId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
