-- Product Master inventory model upgrade.
-- Existing products remain VARIANT_STOCK so current child stock values are preserved.
ALTER TABLE `ProductParent`
  ADD COLUMN `stockMode` ENUM('VARIANT_STOCK', 'PARENT_STOCK') NOT NULL DEFAULT 'VARIANT_STOCK',
  ADD COLUMN `stockQuantity` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `purchasePrice` DECIMAL(10, 2) NULL;

ALTER TABLE `Product`
  ADD COLUMN `unitsPerSale` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `OrderItem`
  ADD COLUMN `stockDeductedAt` DATETIME(3) NULL,
  ADD COLUMN `stockDeductionSource` VARCHAR(191) NULL,
  ADD COLUMN `stockOwnerType` ENUM('PRODUCT', 'PRODUCT_PARENT') NULL,
  ADD COLUMN `stockOwnerId` VARCHAR(191) NULL,
  ADD COLUMN `stockUnitsPerSale` INTEGER NULL,
  ADD COLUMN `stockDeductedUnits` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `OrderItem_stockDeductedAt_idx`
  ON `OrderItem`(`stockDeductedAt`);
