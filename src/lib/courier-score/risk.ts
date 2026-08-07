export type CourierRiskLevel = "NEW_CUSTOMER" | "LOW" | "MEDIUM" | "HIGH";

export function calculateSuccessRate(delivered: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.round((Math.max(0, delivered) / total) * 10_000) / 100;
}

export function calculateRiskLevel(total: number, successRate: number): CourierRiskLevel {
  if (total < 3) {
    return "NEW_CUSTOMER";
  }

  if (successRate >= 75) {
    return "LOW";
  }

  if (successRate >= 50) {
    return "MEDIUM";
  }

  return "HIGH";
}

export function getRiskLabel(level: CourierRiskLevel): string {
  switch (level) {
    case "LOW":
      return "কম ঝুঁকি";
    case "MEDIUM":
      return "মাঝারি ঝুঁকি";
    case "HIGH":
      return "উচ্চ ঝুঁকি";
    default:
      return "নতুন কাস্টমার";
  }
}
