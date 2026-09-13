import { decryptNid } from "@/lib/recruitment";
import type { EmploymentPdfProfile } from "@/lib/recruitment/pdf";

export async function loadEmploymentPdfProfile(userId: string): Promise<EmploymentPdfProfile | null> {
  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.staffEmploymentProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, username: true, role: true } } },
  });
  if (!profile) return null;

  let nidNumber = `••••${profile.nidLast4}`;
  try { nidNumber = decryptNid(profile); } catch {}

  return {
    user: profile.user,
    fatherName: profile.fatherName,
    address: profile.address,
    phone: profile.phone,
    nidNumber,
    designation: profile.designation,
    baseSalary: Number(profile.baseSalary),
    probationCompensation: Number(profile.probationCompensation),
    probationStartDate: profile.probationStartDate,
    probationEndDate: profile.probationEndDate,
    dutyStartTime: profile.dutyStartTime,
    workOffDeadline: profile.workOffDeadline,
    eveningBreakMinutes: profile.eveningBreakMinutes,
    permanentJoinDate: profile.permanentJoinDate,
    agreementStartDate: profile.agreementStartDate,
    agreementEndDate: profile.agreementEndDate,
    earlyExitSettlementLimit: Number(profile.earlyExitSettlementLimit),
    terminationDate: profile.terminationDate,
    terminationReason: profile.terminationReason,
  };
}
