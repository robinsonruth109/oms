"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { encryptGoogleServiceAccount, decryptGoogleServiceAccount, DEFAULT_READY_ORDER_SHEET_NAME, DEFAULT_READY_ORDER_SPREADSHEET_ID } from "@/lib/google-sheets/settings";
import { testGoogleSheetConnection } from "@/lib/google-sheets/client";
import { runReadyOrderSheetSync } from "@/lib/google-sheets/sync";
import { inspectExistingReadyOrderSheetUpgrade, upgradeExistingReadyOrderSheet } from "@/lib/google-sheets/backfill";
import { getBangladeshDateInputValue } from "@/lib/bangladesh-time";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Unauthorized.");
  return session;
}

function resultRedirect(type: "success" | "error", message: string) {
  redirect(`/dashboard/sheet-sync?${type}=${encodeURIComponent(message)}`);
}

export async function saveSheetSyncSettings(formData: FormData) {
  await requireAdmin();
  const { prisma } = await import("@/lib/prisma");

  const spreadsheetId = String(
    formData.get("spreadsheetId") || DEFAULT_READY_ORDER_SPREADSHEET_ID
  ).trim();
  const sheetName = String(
    formData.get("sheetName") || DEFAULT_READY_ORDER_SHEET_NAME
  ).trim();
  const serviceAccountJson = String(
    formData.get("serviceAccountJson") || ""
  ).trim();

  if (!spreadsheetId || !sheetName) {
    resultRedirect("error", "Spreadsheet ID and Sheet Name are required.");
  }

  const current = await prisma.readyOrderSheetSetting.findUnique({
    where: { id: "default" },
  });

  let credentialUpdate = {};

  if (serviceAccountJson) {
    try {
      const encrypted = encryptGoogleServiceAccount(serviceAccountJson);
      credentialUpdate = {
        serviceAccountEncrypted: encrypted.encrypted,
        serviceAccountIv: encrypted.iv,
        serviceAccountTag: encrypted.tag,
        serviceAccountEmail: encrypted.email,
      };
    } catch (error) {
      resultRedirect(
        "error",
        error instanceof Error
          ? error.message
          : "Invalid Service Account JSON."
      );
    }
  } else if (!current?.serviceAccountEncrypted) {
    resultRedirect(
      "error",
      "Add Google Service Account JSON before saving Sheet sync settings."
    );
  }

  await prisma.readyOrderSheetSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled: true,
      spreadsheetId,
      sheetName,
      syncHour: 22,
      syncMinute: 30,
      timezone: "Asia/Dhaka",
      ...credentialUpdate,
    },
    update: {
      enabled: true,
      spreadsheetId,
      sheetName,
      syncHour: 22,
      syncMinute: 30,
      timezone: "Asia/Dhaka",
      ...credentialUpdate,
    },
  });

  resultRedirect(
    "success",
    "Google Sheet settings saved. Automatic sync is fixed at 10:30 PM Bangladesh time."
  );
}

export async function testSheetSyncConnection() {
  await requireAdmin();
  const { prisma } = await import("@/lib/prisma");
  let successMessage = "";
  let errorMessage = "";

  try {
    const setting = await prisma.readyOrderSheetSetting.findUnique({ where: { id: "default" } });
    if (!setting?.spreadsheetId) throw new Error("Save settings first.");
    const account = decryptGoogleServiceAccount(setting);
    await testGoogleSheetConnection({ account, spreadsheetId: setting.spreadsheetId, sheetName: setting.sheetName });
    successMessage = `Connection successful. Google Sheet is writable through ${account.client_email}.`;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Connection test failed.";
  }

  if (errorMessage) redirect(`/dashboard/sheet-sync?error=${encodeURIComponent(errorMessage)}`);
  redirect(`/dashboard/sheet-sync?success=${encodeURIComponent(successMessage)}`);
}

export async function runSheetSyncNow(formData: FormData) {
  const session = await requireAdmin();
  const businessDate = String(formData.get("businessDate") || getBangladeshDateInputValue()).trim();
  let successMessage = "";
  let errorMessage = "";

  try {
    const result = await runReadyOrderSheetSync({ businessDate, mode: "MANUAL", triggeredByUserId: session.user.id });
    successMessage = result.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Manual sync failed.";
  }

  if (errorMessage) redirect(`/dashboard/sheet-sync?error=${encodeURIComponent(errorMessage)}`);
  redirect(`/dashboard/sheet-sync?success=${encodeURIComponent(successMessage)}`);
}


export async function checkExistingSheetUpgrade() {
  await requireAdmin();
  let successMessage = "";
  let errorMessage = "";

  try {
    const result = await inspectExistingReadyOrderSheetUpgrade();
    if (result.unmatchedRows || result.tooManyProductRows) {
      const problems: string[] = [];
      if (result.unmatchedRows) {
        const samples = result.unmatchedSamples
          .map((item) => `row ${item.row} (${item.invoiceId})`)
          .join(", ");
        problems.push(`${result.unmatchedRows} unmatched row(s)${samples ? `: ${samples}` : ""}`);
      }
      if (result.tooManyProductRows) {
        const samples = result.tooManyProductSamples
          .map((item) => `row ${item.sheetRowNumber} (${item.invoiceId})`)
          .join(", ");
        problems.push(`${result.tooManyProductRows} row(s) with more than 8 product lines${samples ? `: ${samples}` : ""}`);
      }
      errorMessage = `Pre-check found ${result.dataRows} data row(s), ${result.matchedRows} matched. ${problems.join(". ")}. Nothing was changed.`;
    } else {
      successMessage = `Pre-check passed: ${result.dataRows} existing data row(s) matched to OMS. ${result.blankRows} blank row(s) will remain blank. Safe to run Backup & Upgrade.`;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Existing Sheet pre-check failed.";
  }

  if (errorMessage) redirect(`/dashboard/sheet-sync?error=${encodeURIComponent(errorMessage)}`);
  redirect(`/dashboard/sheet-sync?success=${encodeURIComponent(successMessage)}`);
}

export async function upgradeExistingSheetRows(formData: FormData) {
  await requireAdmin();
  const confirmed = String(formData.get("confirmExistingUpgrade") || "") === "YES";
  if (!confirmed) {
    redirect(`/dashboard/sheet-sync?error=${encodeURIComponent("Confirm the backup and historical rewrite checkbox before running the upgrade.")}`);
  }

  let successMessage = "";
  let errorMessage = "";

  try {
    const result = await upgradeExistingReadyOrderSheet();
    successMessage = `Historical Sheet upgrade completed. ${result.updatedRows} existing row(s) rebuilt in the new 46-column format. Backup tab: ${result.backupSheetName}.`;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Historical Sheet upgrade failed.";
  }

  if (errorMessage) redirect(`/dashboard/sheet-sync?error=${encodeURIComponent(errorMessage)}`);
  redirect(`/dashboard/sheet-sync?success=${encodeURIComponent(successMessage)}`);
}
