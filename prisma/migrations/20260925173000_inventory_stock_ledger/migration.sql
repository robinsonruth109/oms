-- Inventory stock ledger.
-- Existing Product.quantity is preserved and becomes "units per sale".
-- No existing product is activated automatically, so historical/assumed stock
-- is ignored until an admin initializes that product/parent from Stock Control.

ALTER TABLE `ProductParent`
  ADD COLUMN `inventoryMode` ENUM('SHARED_PARENT', 'VARIANT') NULL;

CREATE TABLE `InventoryStock` (
  `id` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `productId` VARCHAR(191) NULL,
  `quantity` INTEGER NOT NULL DEFAULT 0,
  `averageCost` DECIMAL(12,4) NOT NULL DEFAULT 0,
  `activatedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `InventoryStock_parentId_key`(`parentId`),
  UNIQUE INDEX `InventoryStock_productId_key`(`productId`),
  INDEX `InventoryStock_activatedAt_idx`(`activatedAt`),
  INDEX `InventoryStock_quantity_idx`(`quantity`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryMovement` (
  `id` VARCHAR(191) NOT NULL,
  `inventoryStockId` VARCHAR(191) NOT NULL,
  `movementType` ENUM('OPENING_STOCK', 'MANUAL_ADJUSTMENT', 'SALE_CSV', 'PURCHASE_RECEIVED', 'PATHAO_RETURN') NOT NULL,
  `quantityChange` INTEGER NOT NULL,
  `balanceBefore` INTEGER NOT NULL,
  `balanceAfter` INTEGER NOT NULL,
  `unitCost` DECIMAL(12,4) NULL,
  `averageCostBefore` DECIMAL(12,4) NOT NULL DEFAULT 0,
  `averageCostAfter` DECIMAL(12,4) NOT NULL DEFAULT 0,
  `orderId` VARCHAR(191) NULL,
  `purchaseReceivedOrderId` VARCHAR(191) NULL,
  `pathaoReturnTrackId` VARCHAR(191) NULL,
  `dedupeKey` VARCHAR(191) NOT NULL,
  `note` LONGTEXT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `InventoryMovement_dedupeKey_key`(`dedupeKey`),
  INDEX `InventoryMovement_inventoryStockId_idx`(`inventoryStockId`),
  INDEX `InventoryMovement_movementType_idx`(`movementType`),
  INDEX `InventoryMovement_orderId_idx`(`orderId`),
  INDEX `InventoryMovement_received_idx`(`purchaseReceivedOrderId`),
  INDEX `InventoryMovement_return_idx`(`pathaoReturnTrackId`),
  INDEX `InventoryMovement_user_idx`(`createdByUserId`),
  INDEX `InventoryMovement_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InventoryStock`
  ADD CONSTRAINT `InventoryStock_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `ProductParent`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryStock_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `InventoryMovement`
  ADD CONSTRAINT `InventoryMovement_stock_fkey`
    FOREIGN KEY (`inventoryStockId`) REFERENCES `InventoryStock`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryMovement_order_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryMovement_received_fkey`
    FOREIGN KEY (`purchaseReceivedOrderId`) REFERENCES `PurchaseReceivedOrder`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryMovement_return_fkey`
    FOREIGN KEY (`pathaoReturnTrackId`) REFERENCES `PathaoReturnTrack`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InventoryMovement_user_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
