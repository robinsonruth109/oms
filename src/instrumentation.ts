export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const [{ startReadyOrderSheetScheduler }, { startMetaAdsScheduler }] =
    await Promise.all([
      import("@/lib/google-sheets/scheduler"),
      import("@/lib/meta-ads/scheduler"),
    ]);

  startReadyOrderSheetScheduler();
  startMetaAdsScheduler();
}
