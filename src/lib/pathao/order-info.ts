type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findRecursive(
  value: unknown,
  wanted: Set<string>,
  depth = 0
): unknown {
  if (depth > 7) return undefined;

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(key.toLowerCase())) return child;
    }

    for (const child of Object.values(value)) {
      const found = findRecursive(child, wanted, depth + 1);
      if (found !== undefined) return found;
    }
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findRecursive(child, wanted, depth + 1);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

export function extractPathaoAmountToCollect(payload: unknown) {
  const raw = findRecursive(
    payload,
    new Set([
      "amount_to_collect",
      "amounttocollect",
      "cod_amount",
      "codamount",
      "collection_amount",
      "collectionamount",
    ])
  );

  if (raw === null || raw === undefined || raw === "") return null;

  const normalized =
    typeof raw === "string"
      ? raw.replace(/[^\d.-]/g, "")
      : raw;

  const amount = Number(normalized);

  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100) / 100
    : null;
}
