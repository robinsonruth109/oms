ALTER TABLE `ShopSetting`
  ADD COLUMN `metaConversionsApiEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `metaTestEventCode` VARCHAR(191) NULL;
