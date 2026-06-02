export type VariantOptionLike = {
  id: number;
  sellingPrice?: number | string | null;
  originalSellingPrice?: number | string | null;
  moq?: number | null;
  attributes?: Record<string, string> | null;
  isDefault?: boolean;
};

export type ProductWithVariantOptions<T extends VariantOptionLike = VariantOptionLike> = {
  variantOptions?: T[] | null;
  piecesPerPackage?: number | null;
  originalSellingPrice?: number | string | null;
  sellingPrice?: number | null;
  variants?: Array<{
    variantName?: string | null;
    sellingPrice?: number | null;
    originalSellingPrice?: number | null;
  }> | null;
};

function toNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normKey(k: string): string {
  return String(k ?? '').trim().toLowerCase();
}

function normVal(v: string): string {
  return String(v ?? '').trim();
}

/** Parses "Color: Red, Size: L" into { Color: "Red", Size: "L" } */
export function parseVariantNameToAttributes(variantName: string | null | undefined): Record<string, string> {
  const raw = String(variantName ?? '').trim();
  if (!raw || raw.toLowerCase() === 'default') return {};
  const attrs: Record<string, string> = {};
  raw.split(',').forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const [key, ...valueParts] = p.split(':');
    const k = key?.trim();
    const v = valueParts.join(':').trim();
    if (!k || !v) return;
    attrs[k] = v;
  });
  return attrs;
}

export function matchesVariantAttributes(optionAttrs: Record<string, string> | null | undefined, selected: Record<string, string>): boolean {
  if (!optionAttrs) return false;

  const optionKeysNorm = Object.keys(optionAttrs).map(normKey);
  const selectedKeysNorm = Object.keys(selected).map(normKey);

  // Ensure exact combination match when user selected attributes.
  if (selectedKeysNorm.length > 0 && optionKeysNorm.length !== selectedKeysNorm.length) return false;

  return Object.entries(selected).every(([selKey, selVal]) => {
    const kNorm = normKey(selKey);
    const vNorm = normVal(selVal);

    // Exact key first
    const direct = optionAttrs[selKey];
    if (direct != null && normVal(direct) === vNorm) return true;

    // Trimmed/normalized key match (handles database keys like "Color ")
    const matchingKey = Object.keys(optionAttrs).find((k) => normKey(k) === kNorm);
    if (!matchingKey) return false;
    return normVal(optionAttrs[matchingKey]) === vNorm;
  });
}

export function selectVariantOptionByVariantName<T extends VariantOptionLike>(
  product: ProductWithVariantOptions<T>,
  variantName: string | null | undefined,
): T | null {
  const options = product.variantOptions ?? [];
  if (!Array.isArray(options) || options.length === 0) return null;

  const selected = parseVariantNameToAttributes(variantName);
  const matched =
    Object.keys(selected).length > 0
      ? options.find((o) => matchesVariantAttributes(o.attributes ?? null, selected)) ?? null
      : null;

  return matched || options.find((o) => o.isDefault) || options[0] || null;
}

export function variantUnitPrice(option: VariantOptionLike | null | undefined): number {
  if (!option) return 0;
  return toNumber(option.sellingPrice);
}

export function variantOriginalPrice(option: VariantOptionLike | null | undefined, fallbackUnit: number): number {
  if (!option) return fallbackUnit;
  const orig = toNumber(option.originalSellingPrice);
  return orig > 0 ? orig : fallbackUnit;
}

