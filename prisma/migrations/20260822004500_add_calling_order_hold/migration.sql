-- AlterTable
ALTER TABLE `Order`
    ADD COLUMN `holdByUserId` VARCHAR(191) NULL,
    ADD COLUMN `holdAt` DATETIME(3) NULL,
    ADD COLUMN `holdUntil` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Order_holdByUserId_idx` ON `Order`(`holdByUserId`);

-- CreateIndex
CREATE INDEX `Order_holdUntil_idx` ON `Order`(`holdUntil`);

-- AddForeignKey
ALTER TABLE `Order`
    ADD CONSTRAINT `Order_holdByUserId_fkey`
    FOREIGN KEY (`holdByUserId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
