-- Link salary cash payments to the General Daily Costing cash book.
ALTER TABLE `FinanceDailyCost`
  ADD COLUMN `salaryTransactionId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `FinanceDailyCost_salaryTransactionId_key`
  ON `FinanceDailyCost`(`salaryTransactionId`);

ALTER TABLE `FinanceDailyCost`
  ADD CONSTRAINT `FinanceDailyCost_salaryTransactionId_fkey`
  FOREIGN KEY (`salaryTransactionId`) REFERENCES `SalaryTransaction`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
