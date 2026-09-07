import type { SalaryTransactionType } from "@prisma/client";

import { bangladeshBusinessDateToUtc } from "@/lib/bangladesh-time";
import { prisma } from "@/lib/prisma";

export const SALARY_TRANSACTION_LABELS: Record<SalaryTransactionType, string> = {
  BONUS: "Bonus",
  ADVANCE_SALARY: "Advance Salary",
  LIABILITY_ADD: "Liability / Other Payable",
  LIABILITY_PAYMENT: "Liability Payment",
  FINE: "Fine",
  PARTIAL_SALARY: "Partial Salary",
  FULL_SALARY: "Full Salary",
};

export function normalizeSalaryMonth(value: string) {
  const month = String(value || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Invalid salary month.");
  }
  return month;
}

export function salaryMonthDate(value: string) {
  const month = normalizeSalaryMonth(value);
  return bangladeshBusinessDateToUtc(`${month}-01`);
}

export function money(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export type SalaryTotals = {
  baseSalary: number;
  increment: number;
  bonus: number;
  salaryGross: number;
  fine: number;
  salaryDue: number;
  advance: number;
  partialPaid: number;
  fullPaid: number;
  salaryPaid: number;
  salaryBalance: number;
  liability: number;
  liabilityPaid: number;
  liabilityBalance: number;
  totalOutstanding: number;
};

export function calculateSalaryTotals(input: {
  baseSalary: unknown;
  incrementAmount: unknown;
  transactions: Array<{ type: SalaryTransactionType; amount: unknown }>;
}): SalaryTotals {
  const baseSalary = money(input.baseSalary);
  const increment = money(input.incrementAmount);

  let bonus = 0;
  let fine = 0;
  let advance = 0;
  let partialPaid = 0;
  let fullPaid = 0;
  let liability = 0;
  let liabilityPaid = 0;

  for (const transaction of input.transactions) {
    const amount = money(transaction.amount);
    switch (transaction.type) {
      case "BONUS":
        bonus += amount;
        break;
      case "FINE":
        fine += amount;
        break;
      case "ADVANCE_SALARY":
        advance += amount;
        break;
      case "PARTIAL_SALARY":
        partialPaid += amount;
        break;
      case "FULL_SALARY":
        fullPaid += amount;
        break;
      case "LIABILITY_ADD":
        liability += amount;
        break;
      case "LIABILITY_PAYMENT":
        liabilityPaid += amount;
        break;
    }
  }

  const salaryGross = baseSalary + increment + bonus;
  const salaryDue = Math.max(0, salaryGross - fine);
  const salaryPaid = advance + partialPaid + fullPaid;
  const salaryBalance = Math.max(0, salaryDue - salaryPaid);
  const liabilityBalance = Math.max(0, liability - liabilityPaid);

  return {
    baseSalary,
    increment,
    bonus,
    salaryGross,
    fine,
    salaryDue,
    advance,
    partialPaid,
    fullPaid,
    salaryPaid,
    salaryBalance,
    liability,
    liabilityPaid,
    liabilityBalance,
    totalOutstanding: salaryBalance + liabilityBalance,
  };
}

export async function ensureSalaryMonth(userId: string, month: string) {
  const monthDate = salaryMonthDate(month);

  const existing = await prisma.salaryMonth.findUnique({
    where: {
      userId_monthDate: {
        userId,
        monthDate,
      },
    },
    include: {
      transactions: true,
    },
  });

  if (existing) return existing;

  const profile = await prisma.salaryProfile.findUnique({
    where: { userId },
  });

  if (!profile || !profile.enabled) {
    throw new Error("Salary is not configured for this employee.");
  }

  return prisma.salaryMonth.create({
    data: {
      userId,
      salaryProfileId: profile.id,
      monthDate,
      baseSalary: profile.baseSalary,
      incrementAmount: profile.incrementAmount,
    },
    include: {
      transactions: true,
    },
  });
}

export async function getSalaryMonthWithFallback(userId: string, month: string) {
  const monthDate = salaryMonthDate(month);

  const existing = await prisma.salaryMonth.findUnique({
    where: {
      userId_monthDate: {
        userId,
        monthDate,
      },
    },
    include: {
      transactions: {
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        include: {
          createdByUser: {
            select: { id: true, name: true, username: true },
          },
        },
      },
    },
  });

  if (existing) return existing;

  const profile = await prisma.salaryProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  return {
    id: "",
    userId,
    salaryProfileId: profile.id,
    monthDate,
    baseSalary: profile.baseSalary,
    incrementAmount: profile.incrementAmount,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    transactions: [],
  };
}
