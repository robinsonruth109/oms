ALTER TABLE `FinanceDailyCost`
  ADD COLUMN `bookType` ENUM('GENERAL','OFFICE') NOT NULL DEFAULT 'GENERAL' AFTER `costDate`;

CREATE INDEX `FinanceDailyCost_bookType_idx`
  ON `FinanceDailyCost`(`bookType`);
