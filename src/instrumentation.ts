export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV !== "production"
  ) {
    return;
  }

  // Load sequentially. Instrumentation is a special Next.js server bundle,
  // and sequential imports avoid loader races during startup.
  const { startReadyOrderSheetScheduler } = await import(
    "@/lib/google-sheets/scheduler"
  );
  startReadyOrderSheetScheduler();

  const { startMetaAdsScheduler } = await import(
    "@/lib/meta-ads/scheduler"
  );
  startMetaAdsScheduler();
}
