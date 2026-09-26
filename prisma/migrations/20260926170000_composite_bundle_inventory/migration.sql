ALTER TABLE \`Product\` ADD COLUMN \`inventoryKind\` ENUM('PHYSICAL','BUNDLE') NOT NULL DEFAULT 'PHYSICAL';
CREATE TABLE \`ProductBundleComponent\` (
 \`id\` VARCHAR(191) NOT NULL,
 \`bundleProductId\` VARCHAR(191) NOT NULL,
 \`componentProductId\` VARCHAR(191) NOT NULL,
 \`units\` INTEGER NOT NULL,
 UNIQUE INDEX \`ProductBundleComponent_bundleProductId_componentProductId_key\`(\`bundleProductId\`,\`componentProductId\`),
 INDEX \`ProductBundleComponent_componentProductId_idx\`(\`componentProductId\`),
 PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE \`ProductBundleComponent\` ADD CONSTRAINT \`ProductBundleComponent_bundleProductId_fkey\` FOREIGN KEY (\`bundleProductId\`) REFERENCES \`Product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \`ProductBundleComponent\` ADD CONSTRAINT \`ProductBundleComponent_componentProductId_fkey\` FOREIGN KEY (\`componentProductId\`) REFERENCES \`Product\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE \`OrderItemStockAllocation\` (
 \`id\` VARCHAR(191) NOT NULL,
 \`orderItemId\` VARCHAR(191) NOT NULL,
 \`ownerType\` ENUM('PRODUCT','PRODUCT_PARENT') NOT NULL,
 \`ownerId\` VARCHAR(191) NOT NULL,
 \`ownerSkuSnapshot\` VARCHAR(191) NOT NULL,
 \`unitsPerSale\` INTEGER NOT NULL,
 \`deductedUnits\` INTEGER NOT NULL,
 \`restoredUnits\` INTEGER NOT NULL DEFAULT 0,
 \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX \`OrderItemStockAllocation_orderItemId_ownerType_ownerId_key\`(\`orderItemId\`,\`ownerType\`,\`ownerId\`),
 INDEX \`OrderItemStockAllocation_ownerType_ownerId_idx\`(\`ownerType\`,\`ownerId\`),
 PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE \`OrderItemStockAllocation\` ADD CONSTRAINT \`OrderItemStockAllocation_orderItemId_fkey\` FOREIGN KEY (\`orderItemId\`) REFERENCES \`OrderItem\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \`ProductDamageEntry\` ADD COLUMN \`componentBreakdown\` TEXT NULL;
ALTER TABLE \`ProductStockAdjustment\` ADD COLUMN \`componentBreakdown\` TEXT NULL;
ALTER TABLE \`PathaoReturnItem\` ADD COLUMN \`stockBreakdown\` TEXT NULL;
