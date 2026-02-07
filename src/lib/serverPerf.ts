type PerfMeta = Record<string, unknown>;

function isPerfEnabled(): boolean {
  return process.env.GYMAPP_PERF_LOG === "1";
}

function stringifyMeta(meta?: PerfMeta): string {
  if (!meta) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " {\"meta\":\"unserializable\"}";
  }
}

export async function measureServer<T>(
  label: string,
  meta: PerfMeta | undefined,
  run: () => Promise<T>
): Promise<T> {
  if (!isPerfEnabled()) {
    return run();
  }

  const startedAt = process.hrtime.bigint();
  try {
    return await run();
  } finally {
    const endedAt = process.hrtime.bigint();
    const ms = Number(endedAt - startedAt) / 1_000_000;
    console.log(`[perf] ${label} ${ms.toFixed(1)}ms${stringifyMeta(meta)}`);
  }
}

