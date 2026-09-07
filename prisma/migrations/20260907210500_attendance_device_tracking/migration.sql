-- Capture the browser/device used for each attendance action.
-- Existing AttendanceEvent rows remain NULL and will show as Unknown in reports.
ALTER TABLE `AttendanceEvent`
  ADD COLUMN `deviceType` VARCHAR(32) NULL,
  ADD COLUMN `deviceOs` VARCHAR(64) NULL,
  ADD COLUMN `deviceBrowser` VARCHAR(64) NULL,
  ADD COLUMN `userAgent` TEXT NULL;
