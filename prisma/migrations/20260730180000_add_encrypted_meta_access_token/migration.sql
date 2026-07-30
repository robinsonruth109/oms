ALTER TABLE `ShopSetting`
  ADD COLUMN `metaConversionsAccessTokenEncrypted` TEXT NULL,
  ADD COLUMN `metaConversionsAccessTokenIv` VARCHAR(191) NULL,
  ADD COLUMN `metaConversionsAccessTokenTag` VARCHAR(191) NULL;
