export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV !== "production"
  ) {
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
