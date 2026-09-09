export const DAILY_PAYMENT_METHODS = ["Cash", "Bank", "bKash"] as const;
export type DailyPaymentMethod = (typeof DAILY_PAYMENT_METHODS)[number];

export const DAILY_EXPENSE_TYPES = [
  "Salary",
  "Office Utensils",
  "Family Maintenance",
  "Salary Advance",
  "Office Rent",
  "Home Rent",
  "Office Meals",
  "Internet Bills",
  "Electricity Bills",
  "Phone Bills",
] as const;

export type DailyCashEntryLike = {
  entryType?: string | null;
  amount: unknown;
  paymentMethod?: string | null;
};

export type MethodBalance = {
  opening: number;
  joma: number;
  khoroch: number;
  closing: number;
};

export type DailyCashBookTotals = {
  openingBalance: number;
  totalJoma: number;
  totalKhoroch: number;
  closingBalance: number;
  byMethod: Record<string, MethodBalance>;
};

export function normalizeDailyPaymentMethod(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "cash") return "Cash";
  if (raw === "bank") return "Bank";
  if (raw === "bkash" || raw === "b-kash" || raw === "b_kash") return "bKash";
  return String(value || "").trim() || "Other";
}

function emptyMethodBalance(): MethodBalance {
  return { opening: 0, joma: 0, khoroch: 0, closing: 0 };
}

function applyOpening(target: Record<string, MethodBalance>, row: DailyCashEntryLike) {
  const method = normalizeDailyPaymentMethod(row.paymentMethod);
  if (!target[method]) target[method] = emptyMethodBalance();
  const amount = Number(row.amount || 0);
  if (String(row.entryType || "KHOROCH") === "JOMA") target[method].opening += amount;
  else target[method].opening -= amount;
}

function applyToday(target: Record<string, MethodBalance>, row: DailyCashEntryLike) {
  const method = normalizeDailyPaymentMethod(row.paymentMethod);
  if (!target[method]) target[method] = emptyMethodBalance();
  const amount = Number(row.amount || 0);
  if (String(row.entryType || "KHOROCH") === "JOMA") target[method].joma += amount;
  else target[method].khoroch += amount;
}

export function calculateDailyCashBook(
  priorEntries: DailyCashEntryLike[],
  todayEntries: DailyCashEntryLike[]
): DailyCashBookTotals {
  const byMethod: Record<string, MethodBalance> = {};
  for (const method of DAILY_PAYMENT_METHODS) byMethod[method] = emptyMethodBalance();

  priorEntries.forEach((row) => applyOpening(byMethod, row));
  todayEntries.forEach((row) => applyToday(byMethod, row));

  for (const balance of Object.values(byMethod)) {
    balance.closing = balance.opening + balance.joma - balance.khoroch;
  }

  const openingBalance = Object.values(byMethod).reduce((sum, row) => sum + row.opening, 0);
  const totalJoma = Object.values(byMethod).reduce((sum, row) => sum + row.joma, 0);
  const totalKhoroch = Object.values(byMethod).reduce((sum, row) => sum + row.khoroch, 0);

  return {
    openingBalance,
    totalJoma,
    totalKhoroch,
    closingBalance: openingBalance + totalJoma - totalKhoroch,
    byMethod,
  };
}
