-- Upgrade Daily Costing into a Joma/Khoroch cash book.
-- Existing FinanceDailyCost rows are preserved and treated as KHOROCH.
ALTER TABLE `FinanceDailyCost`
  ADD COLUMN `entryType` ENUM('JOMA', 'KHOROCH') NOT NULL DEFAULT 'KHOROCH' AFTER `costDate`;

CREATE INDEX `FinanceDailyCost_entryType_idx` ON `FinanceDailyCost`(`entryType`);
