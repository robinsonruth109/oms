ALTER TABLE `Product`
  ADD COLUMN `slug` VARCHAR(191) NULL;

UPDATE `Product`
SET `slug` = LOWER(`sku`)
WHERE `slug` IS NULL;

CREATE UNIQUE INDEX `Product_slug_key` ON `Product`(`slug`);
