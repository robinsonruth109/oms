-- Existing quantities remain untouched but are unverified until explicitly counted.
-- This prevents historical placeholder quantities (often 1) being valued as inventory.
ALTER TABLE `ProductParent` ADD COLUMN `stockVerifiedAt` DATETIME(3) NULL;
ALTER TABLE `Product` ADD COLUMN `stockVerifiedAt` DATETIME(3) NULL;
-- A physical stock count is a distinct audited operation from an increment/decrement.
ALTER TABLE `ProductStockAdjustment`
  MODIFY COLUMN `adjustmentType` ENUM('ADD', 'REDUCE', 'SET_COUNT') NOT NULL;
