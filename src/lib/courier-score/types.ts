export const COURIER_PROVIDERS = ["PATHAO", "STEADFAST", "REDX"] as const;

export type CourierProvider = (typeof COURIER_PROVIDERS)[number];

export type CourierStats = {
  provider: CourierProvider;
  total: number;
  delivered: number;
  returned: number;
  successRate: number;
  available: boolean;
  error: string | null;
};

export type CustomerCourierScoreResult = {
  phone: string;
  totalOrders: number;
  delivered: number;
  returned: number;
  successRate: number;
  riskLevel: "NEW_CUSTOMER" | "LOW" | "MEDIUM" | "HIGH";
  couriers: CourierStats[];
  checkedAt: string;
  expiresAt: string;
};

export type CourierCredentialInput = {
  provider: CourierProvider;
  enabled: boolean;
  username?: string | null;
  password?: string | null;
};
