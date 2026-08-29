-- Persist Pathao return_consignment_id from return lifecycle webhooks so
-- separate return barcodes (commonly RG...) can map back to an OMS invoice.
ALTER TABLE `PathaoWebhookEvent`
  ADD COLUMN `returnConsignmentId` VARCHAR(191) NULL;

CREATE INDEX `PathaoWebhookEvent_returnConsignmentId_idx`
  ON `PathaoWebhookEvent`(`returnConsignmentId`);

-- Best-effort backfill for return webhooks received before this migration.
-- Runtime lookup also recursively inspects historical rawPayload JSON.
UPDATE `PathaoWebhookEvent`
SET `returnConsignmentId` = COALESCE(
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`rawPayload`, '$.return_consignment_id')), 'null'),
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`rawPayload`, '$.data.return_consignment_id')), 'null'),
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`rawPayload`, '$.payload.return_consignment_id')), 'null')
)
WHERE `returnConsignmentId` IS NULL
  AND (
    JSON_EXTRACT(`rawPayload`, '$.return_consignment_id') IS NOT NULL OR
    JSON_EXTRACT(`rawPayload`, '$.data.return_consignment_id') IS NOT NULL OR
    JSON_EXTRACT(`rawPayload`, '$.payload.return_consignment_id') IS NOT NULL
  );
