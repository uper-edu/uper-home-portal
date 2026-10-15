// Only wrap the idempotent, autocommit lease-recovery UPDATE. Never retry a
// provider send or an arbitrary business transaction through this helper.
export async function retryLeaseRecovery<T>(
  statement: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await statement();
    } catch (error: any) {
      if (error?.code !== "ER_LOCK_DEADLOCK" || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 10));
    }
  }
}
