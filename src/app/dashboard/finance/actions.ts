"use server";

import type { SalaryTransactionType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import {
  bangladeshBusinessDateToUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import {
  calculateSalaryTotals,
  ensureSalaryMonth,
  money,
  normalizeSalaryMonth,
} from "@/lib/finance/salary";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized.");
  }
  return session;
}

function requiredString(value: FormDataEntryValue | null, field: string) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`${field} is required.`);
  return result;
}

export async function createDailyCostAction(formData: FormData) {
  const session = await requireAdmin();
  const prisma = await getPrisma();

  const costDate = requiredString(formData.get("costDate"), "Date");
  const category = requiredString(formData.get("category"), "Category");
  const description = requiredString(formData.get("description"), "Description");
  const amount = money(formData.get("amount"));
  const paymentMethod = String(formData.get("paymentMethod") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  if (amount <= 0) throw new Error("Cost amount must be greater than 0.");

  await prisma.financeDailyCost.create({
    data: {
      costDate: bangladeshBusinessDateToUtc(costDate),
      category,
      description,
      amount,
      paymentMethod,
      note,
      createdByUserId: session.user.id,
    },
  });

  revalidatePath("/dashboard/finance/daily-costing");
}

export async function deleteDailyCostAction(formData: FormData) {
  await requireAdmin();
  const prisma = await getPrisma();
  const id = requiredString(formData.get("id"), "Cost ID");
  await prisma.financeDailyCost.delete({ where: { id } });
  revalidatePath("/dashboard/finance/daily-costing");
}

export async function saveSalaryProfileAction(formData: FormData) {
  await requireAdmin();
  const prisma = await getPrisma();

  const userId = requiredString(formData.get("userId"), "Employee");
  const baseSalary = money(formData.get("baseSalary"));
  const incrementAmount = money(formData.get("incrementAmount"));
  const note = String(formData.get("note") || "").trim() || null;

  if (baseSalary <= 0) throw new Error("Base salary must be greater than 0.");
  if (incrementAmount < 0) throw new Error("Increment cannot be negative.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "ADMIN") {
    throw new Error("Salary can only be configured for an agent user.");
  }

  await prisma.salaryProfile.upsert({
    where: { userId },
    create: {
      userId,
      baseSalary,
      incrementAmount,
      note,
      enabled: true,
    },
    update: {
      baseSalary,
      incrementAmount,
      note,
      enabled: true,
    },
  });

  revalidatePath("/dashboard/finance/salary");
  revalidatePath(`/dashboard/finance/salary/${userId}`);
}

export async function toggleSalaryProfileAction(formData: FormData) {
  await requireAdmin();
  const prisma = await getPrisma();
  const userId = requiredString(formData.get("userId"), "Employee");
  const enabled = String(formData.get("enabled") || "") === "true";

  await prisma.salaryProfile.update({
    where: { userId },
    data: { enabled },
  });

  revalidatePath("/dashboard/finance/salary");
  revalidatePath(`/dashboard/finance/salary/${userId}`);
}

const TRANSACTION_TYPES = new Set<SalaryTransactionType>([
  "BONUS",
  "ADVANCE_SALARY",
  "LIABILITY_ADD",
  "LIABILITY_PAYMENT",
  "FINE",
  "PARTIAL_SALARY",
  "FULL_SALARY",
]);

export async function addSalaryTransactionAction(formData: FormData) {
  const session = await requireAdmin();
  const prisma = await getPrisma();

  const userId = requiredString(formData.get("userId"), "Employee");
  const month = normalizeSalaryMonth(requiredString(formData.get("month"), "Month"));
  const rawType = requiredString(formData.get("type"), "Transaction type") as SalaryTransactionType;
  if (!TRANSACTION_TYPES.has(rawType)) throw new Error("Invalid salary transaction type.");

  const transactionDate = String(formData.get("transactionDate") || getBangladeshDateInputValue()).trim();
  const note = String(formData.get("note") || "").trim() || null;

  const salaryMonth = await ensureSalaryMonth(userId, month);
  const totals = calculateSalaryTotals({
    baseSalary: salaryMonth.baseSalary,
    incrementAmount: salaryMonth.incrementAmount,
    transactions: salaryMonth.transactions,
  });

  let amount = money(formData.get("amount"));

  if (rawType === "FULL_SALARY" && amount <= 0) {
    amount = totals.salaryBalance;
  }

  if (amount <= 0) throw new Error("Amount must be greater than 0.");

  if (["ADVANCE_SALARY", "PARTIAL_SALARY", "FULL_SALARY"].includes(rawType)) {
    if (totals.salaryBalance <= 0) throw new Error("This month's salary is already fully paid.");
    if (amount > totals.salaryBalance + 0.009) {
      throw new Error(`Payment cannot exceed salary balance of Tk ${totals.salaryBalance.toFixed(2)}.`);
    }
  }

  if (rawType === "LIABILITY_PAYMENT") {
    if (totals.liabilityBalance <= 0) throw new Error("There is no unpaid liability for this month.");
    if (amount > totals.liabilityBalance + 0.009) {
      throw new Error(`Liability payment cannot exceed Tk ${totals.liabilityBalance.toFixed(2)}.`);
    }
  }

  await prisma.salaryTransaction.create({
    data: {
      salaryMonthId: salaryMonth.id,
      userId,
      type: rawType,
      amount,
      transactionDate: bangladeshBusinessDateToUtc(transactionDate),
      note,
      createdByUserId: session.user.id,
    },
  });

  revalidatePath("/dashboard/finance/salary");
  revalidatePath(`/dashboard/finance/salary/${userId}`);
  revalidatePath("/dashboard/finance/my-salary");
}

export async function deleteSalaryTransactionAction(formData: FormData) {
  await requireAdmin();
  const prisma = await getPrisma();
  const id = requiredString(formData.get("id"), "Transaction ID");
  const userId = requiredString(formData.get("userId"), "Employee");

  await prisma.salaryTransaction.delete({ where: { id } });
  revalidatePath("/dashboard/finance/salary");
  revalidatePath(`/dashboard/finance/salary/${userId}`);
  revalidatePath("/dashboard/finance/my-salary");
}
