import "server-only";

export function normalizeSkuForMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .toLocaleLowerCase("en-US");
}

function skuSearchPrefix(value: unknown) {
  const normalized = normalizeSkuForMatch(value);
  if (!normalized) return "";

  const parts = normalized.split("-").filter(Boolean);

  // Most OMS SKUs follow Code-GF-250..., Code-SP-110..., etc.
  // Searching by the first three segments keeps the candidate set small while
  // allowing harmless spacing differences later in the SKU text.
  if (parts.length >= 3) {
    return parts.slice(0, 3).join("-");
  }

  return normalized.length >= 8 ? normalized.slice(0, 24) : "";
}

export type FlexibleSkuMatch = {
  product: any | null;
  matchedBy: "EXACT" | "NORMALIZED" | "NONE" | "AMBIGUOUS";
  candidates: string[];
};

/**
 * Product SKUs are still exact identifiers. This helper only provides a
 * conservative fallback for historical/imported strings whose visible SKU is
 * identical except for harmless Unicode/whitespace around separators.
 *
 * It NEVER guesses when more than one Product Master SKU normalizes to the
 * same value.
 */
export async function findProductByFlexibleSku(
  db: any,
  rawSku: unknown
): Promise<FlexibleSkuMatch> {
  const sku = String(rawSku ?? "").trim();

  if (!sku) {
    return { product: null, matchedBy: "NONE", candidates: [] };
  }

  const exact = await db.product.findUnique({
    where: { sku },
    include: { parent: true },
  });

  if (exact) {
    return {
      product: exact,
      matchedBy: "EXACT",
      candidates: [exact.sku],
    };
  }

  const target = normalizeSkuForMatch(sku);
  const prefix = skuSearchPrefix(sku);

  if (!target || !prefix) {
    return { product: null, matchedBy: "NONE", candidates: [] };
  }

  const candidates = await db.product.findMany({
    where: {
      sku: {
        startsWith: prefix,
      },
    },
    include: { parent: true },
    take: 250,
  });

  const normalizedMatches = candidates.filter(
    (candidate: any) => normalizeSkuForMatch(candidate.sku) === target
  );

  if (normalizedMatches.length === 1) {
    return {
      product: normalizedMatches[0],
      matchedBy: "NORMALIZED",
      candidates: [normalizedMatches[0].sku],
    };
  }

  if (normalizedMatches.length > 1) {
    return {
      product: null,
      matchedBy: "AMBIGUOUS",
      candidates: normalizedMatches.map((candidate: any) => candidate.sku),
    };
  }

  return { product: null, matchedBy: "NONE", candidates: [] };
}
