-- Add CLEANING_STAFF as an employee role while preserving all existing roles.
ALTER TABLE `User`
  MODIFY `role` ENUM(
    'ADMIN',
    'MANAGER',
    'MERCHANT',
    'AGENT',
    'NOTE_AGENT',
    'PACKAGING_AGENT',
    'CLEANING_STAFF'
  ) NOT NULL;
