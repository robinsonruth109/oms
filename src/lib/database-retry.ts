const RETRY_DELAYS_MS = [350, 900, 1_800] as const;

export function isTransientDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return /pool timeout|connection timeout|failed to create socket|unable to start a transaction|P2028|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE/i.test(
    message
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientDatabaseError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }

      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}
