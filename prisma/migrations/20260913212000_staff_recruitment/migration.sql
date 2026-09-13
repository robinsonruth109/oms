CREATE TABLE `StaffEmploymentProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `fatherName` VARCHAR(191) NOT NULL,
  `address` LONGTEXT NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `designation` VARCHAR(191) NOT NULL,
  `nidEncrypted` LONGTEXT NOT NULL,
  `nidIv` VARCHAR(191) NOT NULL,
  `nidTag` VARCHAR(191) NOT NULL,
  `nidHash` VARCHAR(191) NOT NULL,
  `nidLast4` VARCHAR(191) NOT NULL,
  `baseSalary` DECIMAL(12,2) NOT NULL,
  `probationCompensation` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `probationStartDate` DATETIME(3) NOT NULL,
  `probationEndDate` DATETIME(3) NOT NULL,
  `dutyStartTime` VARCHAR(191) NOT NULL DEFAULT '09:00',
  `workOffDeadline` VARCHAR(191) NOT NULL DEFAULT '22:00',
  `eveningBreakMinutes` INTEGER NOT NULL DEFAULT 30,
  `employmentStatus` ENUM('PROBATION','PERMANENT','TERMINATED') NOT NULL DEFAULT 'PROBATION',
  `permanentJoinDate` DATETIME(3) NULL,
  `agreementStartDate` DATETIME(3) NULL,
  `agreementEndDate` DATETIME(3) NULL,
  `earlyExitSettlementLimit` DECIMAL(12,2) NOT NULL DEFAULT 10000,
  `terminationDate` DATETIME(3) NULL,
  `terminationReason` LONGTEXT NULL,
  `permanentApprovedByUserId` VARCHAR(191) NULL,
  `terminatedByUserId` VARCHAR(191) NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `StaffEmploymentProfile_userId_key`(`userId`),
  UNIQUE INDEX `StaffEmploymentProfile_nidHash_key`(`nidHash`),
  INDEX `StaffEmploymentProfile_employmentStatus_idx`(`employmentStatus`),
  INDEX `StaffEmploymentProfile_phone_idx`(`phone`),
  INDEX `StaffEmploymentProfile_probationEndDate_idx`(`probationEndDate`),
  INDEX `StaffEmploymentProfile_agreementEndDate_idx`(`agreementEndDate`),
  INDEX `StaffEmploymentProfile_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StaffEmploymentEvent` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `type` ENUM('PROFILE_CREATED','PROFILE_UPDATED','PROBATION_STARTED','PERMANENT_RECRUITED','TERMINATED') NOT NULL,
  `note` LONGTEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `StaffEmploymentEvent_profileId_idx`(`profileId`),
  INDEX `StaffEmploymentEvent_type_idx`(`type`),
  INDEX `StaffEmploymentEvent_createdByUserId_idx`(`createdByUserId`),
  INDEX `StaffEmploymentEvent_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StaffEmploymentProfile`
  ADD CONSTRAINT `StaffEmploymentProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StaffEmploymentProfile_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StaffEmploymentEvent`
  ADD CONSTRAINT `StaffEmploymentEvent_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `StaffEmploymentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `StaffEmploymentEvent_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
