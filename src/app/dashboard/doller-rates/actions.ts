"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionResult = {
  success: boolean;
  message: string;
};

type CreateDollarRateInput = {
  rateDate: string;
  usdAmount: number;
  bdtAmount: number;
  note?: string;
};

function toMoney(value: unknown) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? 0 : num;
}

export async function createDollarRate(
  payload: CreateDollarRateInput
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "AGENT"].includes(session.user.role)) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const rateDate = String(payload.rateDate || "").trim();
  const usdAmount = toMoney(payload.usdAmount);
  const bdtAmount = toMoney(payload.bdtAmount);
  const note = String(payload.note || "").trim();

  if (!rateDate) {
    return {
      success: false,
      message: "Date is required.",
    };
  }

  if (usdAmount <= 0 || bdtAmount <= 0) {
    return {
      success: false,
      message: "USD amount and BDT amount must be greater than 0.",
    };
  }

  const usdRate = bdtAmount / usdAmount;

  try {
    await prisma.dailyDollarRate.create({
      data: {
        rateDate: new Date(`${rateDate}T00:00:00`),
        usdAmount,
        bdtAmount,
        usdRate,
        note,
      },
    });

    revalidatePath("/dashboard/dollar-rates");

    return {
      success: true,
      message: "Dollar rate entry saved successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to save dollar rate.",
    };
  }
}

export async function deleteDollarRate(id: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  try {
    await prisma.dailyDollarRate.delete({
      where: { id },
    });

    revalidatePath("/dashboard/dollar-rates");

    return {
      success: true,
      message: "Dollar rate entry deleted successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete dollar rate.",
    };
  }
}