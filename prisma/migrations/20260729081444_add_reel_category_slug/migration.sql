/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `ReelCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `ReelCategory` ADD COLUMN `slug` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ReelCategory_slug_key` ON `ReelCategory`(`slug`);

-- CreateIndex
CREATE INDEX `ReelCategory_slug_idx` ON `ReelCategory`(`slug`);
