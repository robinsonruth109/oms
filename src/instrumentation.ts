export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startReadyOrderSheetScheduler } = await import(
    "@/lib/google-sheets/scheduler"
  );

  startReadyOrderSheetScheduler();
}
