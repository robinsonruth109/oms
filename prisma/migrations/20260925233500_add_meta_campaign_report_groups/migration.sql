ALTER TABLE `MetaDailySpend`
  ADD COLUMN `metaPurchases` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `amountSpent`;

CREATE TABLE `MetaCampaignReportGroup` (
  `id` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MetaCampaignMapping`
  ADD COLUMN `reportGroupId` VARCHAR(191) NULL;

CREATE INDEX `MetaCampaignMapping_reportGroupId_idx`
  ON `MetaCampaignMapping`(`reportGroupId`);

ALTER TABLE `MetaCampaignMapping`
  ADD CONSTRAINT `MetaCampaignMapping_reportGroupId_fkey`
  FOREIGN KEY (`reportGroupId`) REFERENCES `MetaCampaignReportGroup`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
