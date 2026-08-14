ALTER TABLE `ReelCategory`
  ADD COLUMN `collectionVideoUrl` TEXT NULL,
  ADD COLUMN `collectionVideoPublicId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `ReelCategory_collectionVideoPublicId_key`
  ON `ReelCategory`(`collectionVideoPublicId`);
