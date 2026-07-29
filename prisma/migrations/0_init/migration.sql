-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'AGENT') NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Page` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `prefixCode` VARCHAR(191) NOT NULL,
    `lastInvoiceSerial` INTEGER NOT NULL DEFAULT 0,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Page_name_key`(`name`),
    UNIQUE INDEX `Page_prefixCode_key`(`prefixCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderSource` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('SHOPIFY', 'LARAVEL', 'MANUAL') NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrderSource_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReelCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReelCategory_name_key`(`name`),
    INDEX `ReelCategory_sourceId_idx`(`sourceId`),
    INDEX `ReelCategory_pageId_idx`(`pageId`),
    INDEX `ReelCategory_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Integration` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `platform` ENUM('SHOPIFY', 'LARAVEL') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `webhookSecret` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Integration_slug_key`(`slug`),
    UNIQUE INDEX `Integration_apiKey_key`(`apiKey`),
    INDEX `Integration_platform_idx`(`platform`),
    INDEX `Integration_sourceId_idx`(`sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductParent` (
    `id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductParent_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Courier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Courier_name_key`(`name`),
    UNIQUE INDEX `Courier_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `purchasePrice` DECIMAL(10, 2) NOT NULL,
    `sellingPrice` DECIMAL(10, 2) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `integrationId` VARCHAR(191) NULL,
    `externalOrderId` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `advance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `deliveryCharge` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `orderStatus` ENUM('PENDING_CONFIRMATION', 'READY_TO_SHIP', 'NO_ANSWER', 'PHONE_OFF', 'CANCELLED', 'DOUBLE_ORDER', 'STOCK_OUT', 'RETURNED') NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    `courier` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `calledByUserId` VARCHAR(191) NULL,
    `calledAt` DATETIME(3) NULL,
    `invoiceDownloaded` BOOLEAN NOT NULL DEFAULT false,
    `csvDownloaded` BOOLEAN NOT NULL DEFAULT false,
    `readyToShipAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderId_key`(`orderId`),
    UNIQUE INDEX `Order_invoiceId_key`(`invoiceId`),
    INDEX `Order_integrationId_idx`(`integrationId`),
    INDEX `Order_externalOrderId_idx`(`externalOrderId`),
    INDEX `Order_sourceId_idx`(`sourceId`),
    INDEX `Order_pageId_idx`(`pageId`),
    INDEX `Order_orderStatus_idx`(`orderStatus`),
    INDEX `Order_calledByUserId_idx`(`calledByUserId`),
    UNIQUE INDEX `Order_integrationId_externalOrderId_key`(`integrationId`, `externalOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdsCostUpload` (
    `id` VARCHAR(191) NOT NULL,
    `uploadDate` DATETIME(3) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdsCostUpload_uploadDate_idx`(`uploadDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdsCostItem` (
    `id` VARCHAR(191) NOT NULL,
    `uploadId` VARCHAR(191) NOT NULL,
    `campaignName` VARCHAR(191) NOT NULL,
    `amountSpent` DECIMAL(10, 2) NOT NULL,
    `productParentId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdsCostItem_uploadId_idx`(`uploadId`),
    INDEX `AdsCostItem_productParentId_idx`(`productParentId`),
    INDEX `AdsCostItem_sourceId_idx`(`sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `productSku` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `lineTotal` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    INDEX `OrderItem_productId_idx`(`productId`),
    INDEX `OrderItem_productSku_idx`(`productSku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceBatch` (
    `id` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NOT NULL,
    `courier` VARCHAR(191) NOT NULL,
    `totalOrders` INTEGER NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InvoiceBatch_batchNo_key`(`batchNo`),
    INDEX `InvoiceBatch_createdByUserId_idx`(`createdByUserId`),
    INDEX `InvoiceBatch_courier_idx`(`courier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceBatchItem` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,

    INDEX `InvoiceBatchItem_orderId_idx`(`orderId`),
    UNIQUE INDEX `InvoiceBatchItem_batchId_orderId_key`(`batchId`, `orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CsvBatch` (
    `id` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NOT NULL,
    `courier` VARCHAR(191) NOT NULL,
    `totalOrders` INTEGER NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CsvBatch_batchNo_key`(`batchNo`),
    INDEX `CsvBatch_createdByUserId_idx`(`createdByUserId`),
    INDEX `CsvBatch_courier_idx`(`courier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNo` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productSku` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `parentSku` VARCHAR(191) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `quantityType` VARCHAR(191) NOT NULL,
    `productImage` VARCHAR(191) NULL,
    `unitPriceUsd` DECIMAL(10, 2) NOT NULL,
    `platformChargeUsd` DECIMAL(10, 2) NOT NULL,
    `shippingUsd` DECIMAL(10, 2) NOT NULL,
    `subtotalUsd` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_invoiceNo_key`(`invoiceNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchasePayment` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `paymentType` VARCHAR(191) NOT NULL,
    `amountUsd` DECIMAL(10, 2) NOT NULL,
    `usdRate` DECIMAL(10, 2) NOT NULL,
    `amountBdt` DECIMAL(10, 2) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseReceivedOrder` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `receiveDate` DATETIME(3) NOT NULL,
    `receivedQty` INTEGER NOT NULL,
    `packageWeight` DECIMAL(10, 2) NOT NULL,
    `cnfRatePerKg` DECIMAL(10, 2) NOT NULL,
    `totalCnfCharge` DECIMAL(10, 2) NOT NULL,
    `otherCostBdt` DECIMAL(10, 2) NOT NULL,
    `paidAmountBdt` DECIMAL(10, 2) NOT NULL,
    `grandTotalBdt` DECIMAL(10, 2) NOT NULL,
    `unitOriginalCost` DECIMAL(10, 2) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PurchaseReceivedOrder_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyDollarRate` (
    `id` VARCHAR(191) NOT NULL,
    `rateDate` DATETIME(3) NOT NULL,
    `usdAmount` DECIMAL(10, 2) NOT NULL,
    `bdtAmount` DECIMAL(10, 2) NOT NULL,
    `usdRate` DECIMAL(10, 2) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailyDollarRate_rateDate_idx`(`rateDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CsvBatchItem` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,

    INDEX `CsvBatchItem_orderId_idx`(`orderId`),
    UNIQUE INDEX `CsvBatchItem_batchId_orderId_key`(`batchId`, `orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `attendanceDate` DATETIME(3) NOT NULL,
    `attendAt` DATETIME(3) NULL,
    `workOffAt` DATETIME(3) NULL,
    `status` ENUM('ON_TIME', 'LATE', 'ABSENT') NOT NULL DEFAULT 'ON_TIME',
    `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attendance_userId_idx`(`userId`),
    INDEX `Attendance_attendanceDate_idx`(`attendanceDate`),
    UNIQUE INDEX `Attendance_userId_attendanceDate_key`(`userId`, `attendanceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceEvent` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('ATTEND', 'BREAK_START', 'BREAK_END', 'EVENING_BREAK_START', 'EVENING_BREAK_END', 'WORK_OFF') NOT NULL,
    `eventTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `durationMinutes` INTEGER NULL,
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttendanceEvent_attendanceId_idx`(`attendanceId`),
    INDEX `AttendanceEvent_userId_idx`(`userId`),
    INDEX `AttendanceEvent_eventTime_idx`(`eventTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceViolation` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `violationType` ENUM('LATE_ATTENDANCE', 'BREAK_OVERSTAY', 'EVENING_BREAK_OVERSTAY', 'MISSING_WORK_OFF') NOT NULL,
    `violationTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `minutes` INTEGER NOT NULL DEFAULT 0,
    `message` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttendanceViolation_attendanceId_idx`(`attendanceId`),
    INDEX `AttendanceViolation_userId_idx`(`userId`),
    INDEX `AttendanceViolation_violationTime_idx`(`violationTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReelProduct` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `caption` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `videoUrl` TEXT NOT NULL,
    `videoPublicId` VARCHAR(191) NOT NULL,
    `thumbnailUrl` TEXT NULL,
    `thumbnailPublicId` VARCHAR(191) NULL,
    `videoDuration` DECIMAL(10, 2) NULL,
    `videoWidth` INTEGER NULL,
    `videoHeight` INTEGER NULL,
    `videoFormat` VARCHAR(191) NULL,
    `videoBytes` INTEGER NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReelProduct_videoPublicId_key`(`videoPublicId`),
    UNIQUE INDEX `ReelProduct_thumbnailPublicId_key`(`thumbnailPublicId`),
    INDEX `ReelProduct_productId_idx`(`productId`),
    INDEX `ReelProduct_categoryId_idx`(`categoryId`),
    INDEX `ReelProduct_status_idx`(`status`),
    INDEX `ReelProduct_displayOrder_idx`(`displayOrder`),
    INDEX `ReelProduct_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ReelProduct_productId_categoryId_key`(`productId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReelCategory` ADD CONSTRAINT `ReelCategory_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `OrderSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReelCategory` ADD CONSTRAINT `ReelCategory_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Integration` ADD CONSTRAINT `Integration_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `OrderSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProductParent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `OrderSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_calledByUserId_fkey` FOREIGN KEY (`calledByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdsCostItem` ADD CONSTRAINT `AdsCostItem_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `AdsCostUpload`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdsCostItem` ADD CONSTRAINT `AdsCostItem_productParentId_fkey` FOREIGN KEY (`productParentId`) REFERENCES `ProductParent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdsCostItem` ADD CONSTRAINT `AdsCostItem_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `OrderSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceBatch` ADD CONSTRAINT `InvoiceBatch_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceBatchItem` ADD CONSTRAINT `InvoiceBatchItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `InvoiceBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceBatchItem` ADD CONSTRAINT `InvoiceBatchItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CsvBatch` ADD CONSTRAINT `CsvBatch_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchasePayment` ADD CONSTRAINT `PurchasePayment_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseReceivedOrder` ADD CONSTRAINT `PurchaseReceivedOrder_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CsvBatchItem` ADD CONSTRAINT `CsvBatchItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `CsvBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CsvBatchItem` ADD CONSTRAINT `CsvBatchItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEvent` ADD CONSTRAINT `AttendanceEvent_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `Attendance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEvent` ADD CONSTRAINT `AttendanceEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceViolation` ADD CONSTRAINT `AttendanceViolation_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `Attendance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceViolation` ADD CONSTRAINT `AttendanceViolation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReelProduct` ADD CONSTRAINT `ReelProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReelProduct` ADD CONSTRAINT `ReelProduct_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ReelCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

