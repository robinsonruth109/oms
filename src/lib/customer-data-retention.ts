export const CUSTOMER_DATA_RETENTION_DAYS = 90;
export const DELETED_CUSTOMER_NAME = "[deleted after retention period]";
export const DELETED_PHONE = "[deleted]";
export const DELETED_ADDRESS = "[deleted after retention period]";

export function getCustomerDataRetentionCutoff(
  now = new Date()
): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(
    cutoff.getUTCDate() - CUSTOMER_DATA_RETENTION_DAYS
  );
  return cutoff;
}

export function getEligibleCustomerDataWhere(
  cutoff = getCustomerDataRetentionCutoff()
) {
  return {
    createdAt: {
      lt: cutoff,
    },
    phone: {
      not: DELETED_PHONE,
    },
  };
}
