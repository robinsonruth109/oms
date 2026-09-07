-- Finance daily costing and employee salary/payroll module.
CREATE TABLE `FinanceDailyCost` (
  `id` VARCHAR(191) NOT NULL,
  `costDate` DATETIME(3) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `paymentMethod` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `FinanceDailyCost_costDate_idx`(`costDate`),
  INDEX `FinanceDailyCost_category_idx`(`category`),
  INDEX `FinanceDailyCost_createdByUserId_idx`(`createdByUserId`),
  INDEX `FinanceDailyCost_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalaryProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `baseSalary` DECIMAL(12, 2) NOT NULL,
  `incrementAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `SalaryProfile_userId_key`(`userId`),
  INDEX `SalaryProfile_enabled_idx`(`enabled`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalaryMonth` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `salaryProfileId` VARCHAR(191) NULL,
  `monthDate` DATETIME(3) NOT NULL,
  `baseSalary` DECIMAL(12, 2) NOT NULL,
  `incrementAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `SalaryMonth_userId_monthDate_key`(`userId`, `monthDate`),
  INDEX `SalaryMonth_monthDate_idx`(`monthDate`),
  INDEX `SalaryMonth_salaryProfileId_idx`(`salaryProfileId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalaryTransaction` (
  `id` VARCHAR(191) NOT NULL,
  `salaryMonthId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` ENUM('BONUS', 'ADVANCE_SALARY', 'LIABILITY_ADD', 'LIABILITY_PAYMENT', 'FINE', 'PARTIAL_SALARY', 'FULL_SALARY') NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `transactionDate` DATETIME(3) NOT NULL,
  `note` TEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `SalaryTransaction_salaryMonthId_idx`(`salaryMonthId`),
  INDEX `SalaryTransaction_userId_idx`(`userId`),
  INDEX `SalaryTransaction_type_idx`(`type`),
  INDEX `SalaryTransaction_transactionDate_idx`(`transactionDate`),
  INDEX `SalaryTransaction_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FinanceDailyCost`
  ADD CONSTRAINT `FinanceDailyCost_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SalaryProfile`
  ADD CONSTRAINT `SalaryProfile_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SalaryMonth`
  ADD CONSTRAINT `SalaryMonth_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalaryMonth_salaryProfileId_fkey`
  FOREIGN KEY (`salaryProfileId`) REFERENCES `SalaryProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SalaryTransaction`
  ADD CONSTRAINT `SalaryTransaction_salaryMonthId_fkey`
  FOREIGN KEY (`salaryMonthId`) REFERENCES `SalaryMonth`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalaryTransaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SalaryTransaction_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
