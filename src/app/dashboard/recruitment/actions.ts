"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role, StaffEmploymentStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { isValidBangladeshMobile } from "@/lib/phone-normalization";
import {
  STAFF_ROLES,
  addDaysToBusinessDate,
  addMonthsToBusinessDate,
  businessDate,
  encryptNid,
  hashNid,
  isValidNid,
  normalizeNid,
  normalizeStaffPhone,
} from "@/lib/recruitment";

export type RecruitmentActionState = {
  success: boolean;
  message: string;
};

const EMPTY_STATE: RecruitmentActionState = { success: false, message: "" };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

function numberField(formData: FormData, name: string, fallback = 0) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function isStaffRole(value: string): value is Role {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

function validateTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function statusFrom(value: string): StaffEmploymentStatus {
  return value === "PERMANENT" ? "PERMANENT" : "PROBATION";
}

export async function createStaffAction(
  _prevState: RecruitmentActionState = EMPTY_STATE,
  formData: FormData
): Promise<RecruitmentActionState> {
  const session = await requireAdmin();
  if (!session) return { success: false, message: "Unauthorized action." };

  const name = clean(formData.get("name"));
  const fatherName = clean(formData.get("fatherName"));
  const address = clean(formData.get("address"));
  const phone = normalizeStaffPhone(clean(formData.get("phone")));
  const nid = normalizeNid(clean(formData.get("nidNumber")));
  const roleValue = clean(formData.get("role"));
  const designation = clean(formData.get("designation"));
  const username = clean(formData.get("username"));
  const password = clean(formData.get("password"));
  const startDate = clean(formData.get("startDate")) || getBangladeshDateInputValue();
  const dutyStartTime = clean(formData.get("dutyStartTime")) || "09:00";
  const workOffDeadline = clean(formData.get("workOffDeadline")) || "22:00";
  const baseSalary = numberField(formData, "baseSalary");
  const probationCompensation = numberField(formData, "probationCompensation", 0);
  const earlyExitSettlementLimit = numberField(formData, "earlyExitSettlementLimit", 10000);

  if (!name || !fatherName || !address || !designation || !username || !password) {
    return { success: false, message: "All required fields must be completed." };
  }
  if (!isStaffRole(roleValue)) return { success: false, message: "Invalid staff role." };
  if (!isValidBangladeshMobile(phone)) return { success: false, message: "Phone number must be a valid 11-digit Bangladesh mobile number." };
  if (!isValidNid(nid)) return { success: false, message: "NID must contain 10, 13 or 17 English digits." };
  if (!Number.isFinite(baseSalary) || baseSalary <= 0) return { success: false, message: "Basic salary must be greater than zero." };
  if (!Number.isFinite(probationCompensation) || probationCompensation < 0) return { success: false, message: "Probation compensation cannot be negative." };
  if (!Number.isFinite(earlyExitSettlementLimit) || earlyExitSettlementLimit < 0) return { success: false, message: "Settlement limit cannot be negative." };
  if (!validateTime(dutyStartTime) || !validateTime(workOffDeadline)) return { success: false, message: "Duty / Work Off time is invalid." };

  let probationEnd: string;
  try {
    probationEnd = addDaysToBusinessDate(startDate, 14);
  } catch {
    return { success: false, message: "Invalid start date." };
  }

  const { prisma } = await import("@/lib/prisma");
  const [usernameExists, nidExists] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.staffEmploymentProfile.findUnique({ where: { nidHash: hashNid(nid) }, select: { id: true } }),
  ]);
  if (usernameExists) return { success: false, message: "Username already exists." };
  if (nidExists) return { success: false, message: "This NID is already attached to another staff record." };

  const passwordHash = await bcrypt.hash(password, 10);
  const nidData = encryptNid(nid);

  try {
    const profile = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, username, password: passwordHash, role: roleValue, status: true },
      });

      const created = await tx.staffEmploymentProfile.create({
        data: {
          userId: user.id,
          fatherName,
          address,
          phone,
          designation,
          ...nidData,
          baseSalary,
          probationCompensation,
          probationStartDate: businessDate(startDate),
          probationEndDate: businessDate(probationEnd),
          dutyStartTime,
          workOffDeadline,
          eveningBreakMinutes: 30,
          earlyExitSettlementLimit,
          employmentStatus: "PROBATION",
          createdByUserId: session.user.id,
        },
      });

      await tx.salaryProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          baseSalary,
          incrementAmount: 0,
          enabled: false,
          note: "Created from Staff Recruitment. Disabled during preliminary period.",
        },
        update: { baseSalary, enabled: false },
      });

      await tx.staffEmploymentEvent.createMany({
        data: [
          { profileId: created.id, type: "PROFILE_CREATED", note: "Staff account and employment profile created.", createdByUserId: session.user.id },
          { profileId: created.id, type: "PROBATION_STARTED", note: `15-day preliminary period: ${startDate} to ${probationEnd}.`, createdByUserId: session.user.id },
        ],
      });
      return created;
    });

    revalidatePath("/dashboard/recruitment");
    revalidatePath("/dashboard/users");
    return { success: true, message: `Staff created successfully. Recruitment ID: ${profile.id}` };
  } catch (error) {
    console.error("createStaffAction failed", error);
    return { success: false, message: "Unable to create staff record. Please check the information and try again." };
  }
}

export async function attachExistingStaffAction(
  _prevState: RecruitmentActionState = EMPTY_STATE,
  formData: FormData
): Promise<RecruitmentActionState> {
  const session = await requireAdmin();
  if (!session) return { success: false, message: "Unauthorized action." };

  const userId = clean(formData.get("userId"));
  const fatherName = clean(formData.get("fatherName"));
  const address = clean(formData.get("address"));
  const phone = normalizeStaffPhone(clean(formData.get("phone")));
  const nid = normalizeNid(clean(formData.get("nidNumber")));
  const designation = clean(formData.get("designation"));
  const startDate = clean(formData.get("startDate")) || getBangladeshDateInputValue();
  const stage = statusFrom(clean(formData.get("stage")));
  const dutyStartTime = clean(formData.get("dutyStartTime")) || "09:00";
  const workOffDeadline = clean(formData.get("workOffDeadline")) || "22:00";
  const baseSalary = numberField(formData, "baseSalary");
  const probationCompensation = numberField(formData, "probationCompensation", 0);
  const earlyExitSettlementLimit = numberField(formData, "earlyExitSettlementLimit", 10000);

  if (!userId || !fatherName || !address || !designation) return { success: false, message: "All required fields must be completed." };
  if (!isValidBangladeshMobile(phone)) return { success: false, message: "Phone number must be a valid 11-digit Bangladesh mobile number." };
  if (!isValidNid(nid)) return { success: false, message: "NID must contain 10, 13 or 17 English digits." };
  if (!Number.isFinite(baseSalary) || baseSalary <= 0) return { success: false, message: "Basic salary must be greater than zero." };
  if (!validateTime(dutyStartTime) || !validateTime(workOffDeadline)) return { success: false, message: "Duty / Work Off time is invalid." };

  const probationEnd = addDaysToBusinessDate(startDate, 14);
  const agreementEnd = addMonthsToBusinessDate(startDate, 6);
  const nidData = encryptNid(nid);
  const { prisma } = await import("@/lib/prisma");

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { staffEmploymentProfile: true } });
  if (!user || !isStaffRole(user.role)) return { success: false, message: "Selected agent was not found." };
  if (user.staffEmploymentProfile) return { success: false, message: "This agent already has a recruitment profile." };
  const duplicateNid = await prisma.staffEmploymentProfile.findUnique({ where: { nidHash: nidData.nidHash }, select: { id: true } });
  if (duplicateNid) return { success: false, message: "This NID is already attached to another staff record." };

  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.staffEmploymentProfile.create({
        data: {
          userId,
          fatherName,
          address,
          phone,
          designation,
          ...nidData,
          baseSalary,
          probationCompensation,
          probationStartDate: businessDate(startDate),
          probationEndDate: businessDate(probationEnd),
          dutyStartTime,
          workOffDeadline,
          eveningBreakMinutes: 30,
          earlyExitSettlementLimit,
          employmentStatus: stage,
          permanentJoinDate: stage === "PERMANENT" ? businessDate(startDate) : null,
          agreementStartDate: stage === "PERMANENT" ? businessDate(startDate) : null,
          agreementEndDate: stage === "PERMANENT" ? businessDate(agreementEnd) : null,
          permanentApprovedByUserId: stage === "PERMANENT" ? session.user.id : null,
          createdByUserId: session.user.id,
        },
      });

      await tx.salaryProfile.upsert({
        where: { userId },
        create: { userId, baseSalary, incrementAmount: 0, enabled: stage === "PERMANENT", note: "Linked from Staff Recruitment." },
        update: { baseSalary, enabled: stage === "PERMANENT" },
      });

      await tx.staffEmploymentEvent.create({
        data: {
          profileId: profile.id,
          type: stage === "PERMANENT" ? "PERMANENT_RECRUITED" : "PROBATION_STARTED",
          note: stage === "PERMANENT" ? "Existing agent linked as permanent staff." : `Existing agent linked to 15-day preliminary period ending ${probationEnd}.`,
          createdByUserId: session.user.id,
        },
      });
    });
    revalidatePath("/dashboard/recruitment");
    return { success: true, message: "Existing agent added to Staff Recruitment successfully." };
  } catch (error) {
    console.error("attachExistingStaffAction failed", error);
    return { success: false, message: "Unable to attach existing agent." };
  }
}

export async function updateStaffProfileAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session) redirect("/dashboard");

  const userId = clean(formData.get("userId"));
  const fatherName = clean(formData.get("fatherName"));
  const address = clean(formData.get("address"));
  const phone = normalizeStaffPhone(clean(formData.get("phone")));
  const designation = clean(formData.get("designation"));
  const dutyStartTime = clean(formData.get("dutyStartTime"));
  const workOffDeadline = clean(formData.get("workOffDeadline"));
  const baseSalary = numberField(formData, "baseSalary");
  const probationCompensation = numberField(formData, "probationCompensation", 0);
  const earlyExitSettlementLimit = numberField(formData, "earlyExitSettlementLimit", 10000);

  if (!userId || !fatherName || !address || !designation || !isValidBangladeshMobile(phone) || !validateTime(dutyStartTime) || !validateTime(workOffDeadline) || !Number.isFinite(baseSalary) || baseSalary <= 0) return;

  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.staffEmploymentProfile.update({
    where: { userId },
    data: { fatherName, address, phone, designation, dutyStartTime, workOffDeadline, baseSalary, probationCompensation, earlyExitSettlementLimit },
  });

  await prisma.salaryProfile.upsert({
    where: { userId },
    create: { userId, baseSalary, incrementAmount: 0, enabled: profile.employmentStatus === "PERMANENT", note: "Synced from Staff Recruitment." },
    update: { baseSalary },
  });
  await prisma.staffEmploymentEvent.create({ data: { profileId: profile.id, type: "PROFILE_UPDATED", note: "Employment profile details updated.", createdByUserId: session.user.id } });

  revalidatePath(`/dashboard/recruitment/${userId}`);
  revalidatePath("/dashboard/recruitment");
}

export async function recruitPermanentAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session) redirect("/dashboard");
  const userId = clean(formData.get("userId"));
  const joinDate = clean(formData.get("joinDate")) || getBangladeshDateInputValue();
  if (!userId) return;

  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.staffEmploymentProfile.findUnique({ where: { userId }, include: { user: true } });
  if (!profile || profile.employmentStatus !== "PROBATION") return;

  const today = getBangladeshDateInputValue();
  const probationEnd = getBangladeshDateInputValue(profile.probationEndDate);
  const permanentAvailableDate = addDaysToBusinessDate(probationEnd, 1);
  if (today < permanentAvailableDate) {
    return;
  }
  if (joinDate < permanentAvailableDate) {
    return;
  }

  const agreementEnd = addMonthsToBusinessDate(joinDate, 6);
  await prisma.$transaction(async (tx) => {
    await tx.staffEmploymentProfile.update({
      where: { userId },
      data: {
        employmentStatus: "PERMANENT",
        permanentJoinDate: businessDate(joinDate),
        agreementStartDate: businessDate(joinDate),
        agreementEndDate: businessDate(agreementEnd),
        permanentApprovedByUserId: session.user.id,
      },
    });
    await tx.user.update({ where: { id: userId }, data: { status: true } });
    await tx.salaryProfile.upsert({
      where: { userId },
      create: { userId, baseSalary: profile.baseSalary, incrementAmount: 0, enabled: true, note: "Activated after permanent recruitment." },
      update: { baseSalary: profile.baseSalary, enabled: true },
    });
    await tx.staffEmploymentEvent.create({ data: { profileId: profile.id, type: "PERMANENT_RECRUITED", note: `Permanent recruitment effective ${joinDate}; 6-month agreement ends ${agreementEnd}.`, createdByUserId: session.user.id } });
  });

  revalidatePath(`/dashboard/recruitment/${userId}`);
  revalidatePath("/dashboard/recruitment");
  revalidatePath("/dashboard/finance/salary");
}

export async function terminateStaffAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session) redirect("/dashboard");
  const userId = clean(formData.get("userId"));
  const reason = clean(formData.get("reason"));
  const terminationDate = clean(formData.get("terminationDate")) || getBangladeshDateInputValue();
  if (!userId || !reason) return;

  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.staffEmploymentProfile.findUnique({ where: { userId } });
  if (!profile || profile.employmentStatus === "TERMINATED") return;

  await prisma.$transaction(async (tx) => {
    await tx.staffEmploymentProfile.update({
      where: { userId },
      data: { employmentStatus: "TERMINATED", terminationDate: businessDate(terminationDate), terminationReason: reason, terminatedByUserId: session.user.id },
    });
    await tx.user.update({ where: { id: userId }, data: { status: false } });
    await tx.salaryProfile.updateMany({ where: { userId }, data: { enabled: false } });
    await tx.staffEmploymentEvent.create({ data: { profileId: profile.id, type: "TERMINATED", note: reason, createdByUserId: session.user.id } });
  });

  revalidatePath(`/dashboard/recruitment/${userId}`);
  revalidatePath("/dashboard/recruitment");
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/finance/salary");
}
