import { calculateOrderItemPromotion } from './promotionUtils';

export type OrderItemDisplaySource = {
  productId?: string | null;
  productName?: string | null;
  productNameSnapshot?: string | null;
  packageQuantity?: number | null;
  piecesPerPackage?: number | null;
  promotionDetailsSnapshot?: string | null;
  moqSnapshot?: number | null;
};

export function resolveOrderItemMoq(item: OrderItemDisplaySource): number | null {
  if (item.moqSnapshot != null && item.moqSnapshot > 0) {
    return item.moqSnapshot;
  }

  if (!item.promotionDetailsSnapshot) return null;

  try {
    const parsed = JSON.parse(item.promotionDetailsSnapshot) as { moq?: number | null };
    return parsed.moq ?? null;
  } catch {
    return null;
  }
}

export function getOrderItemPromotionFreePieces(item: OrderItemDisplaySource): number {
  const packageQuantity = item.packageQuantity && item.packageQuantity > 0 ? item.packageQuantity : 1;
  const piecesPerPackage = item.piecesPerPackage && item.piecesPerPackage > 0 ? item.piecesPerPackage : 1;

  const promotionGift = calculateOrderItemPromotion(
    item.promotionDetailsSnapshot,
    packageQuantity,
    piecesPerPackage,
    resolveOrderItemMoq(item),
  );

  return promotionGift?.freeQty ?? 0;
}

export function getOrderItemOrderedQuantity(item: OrderItemDisplaySource): number {
  return item.packageQuantity && item.packageQuantity > 0 ? item.packageQuantity : 1;
}

export function getOrderItemDisplayName(item: OrderItemDisplaySource, fallback: string): string {
  return item.productName?.trim() || item.productNameSnapshot?.trim() || fallback;
}

export function readOrderItemPromoRule(
  snapshot:
    | string
    | { minQuantity?: number; buyQuantity?: number; freeQuantity?: number }
    | null
    | undefined,
): { buy: number; free: number } | null {
  if (!snapshot) return null;
  try {
    const parsed =
      typeof snapshot === 'string'
        ? (JSON.parse(snapshot) as {
            minQuantity?: number;
            buyQuantity?: number;
            freeQuantity?: number;
          })
        : snapshot;
    const buy = Number(parsed.minQuantity || parsed.buyQuantity || 0);
    const free = Number(parsed.freeQuantity || 0);
    if (!(buy > 0) || !(free > 0)) return null;
    return { buy, free };
  } catch {
    return null;
  }
}

export function getShownOrderDiscount(item: {
  piecesPerPackage?: number | null;
  packageQuantity?: number | null;
  quantity?: number | null;
  pricePerPackage?: number | null;
  unitPrice?: number | null;
  subtotal?: number | null;
  originalPriceSnapshot?: number | null;
  discountPercentage?: number | null;
  discountAmount?: number | null;
}): {
  show: boolean;
  originalLineTotal: number;
  percent: number | null;
  amount: number | null;
} {
  const pieces = Math.max(1, Number(item.piecesPerPackage) || 1);
  const qty = Math.max(1, Number(item.packageQuantity ?? item.quantity) || 1);
  const originalUnit = Number(item.originalPriceSnapshot) || 0;
  const originalLineTotal = originalUnit > 0 ? originalUnit * pieces * qty : 0;
  const subtotalValue = Number(item.subtotal);
  const hasSubtotal = item.subtotal != null && Number.isFinite(subtotalValue);
  const unitPrice = Number(item.unitPrice);
  const usePiecePrice =
    !hasSubtotal &&
    item.pricePerPackage == null &&
    Number.isFinite(unitPrice) &&
    unitPrice > 0;
  const currentLine = hasSubtotal
    ? subtotalValue
    : usePiecePrice
      ? unitPrice * pieces * qty
      : Math.max(0, Number(item.pricePerPackage ?? item.unitPrice) || 0) * qty;
  const show = originalLineTotal > currentLine + 0.01;
  const percent = Number(item.discountPercentage);
  const amount = Number(item.discountAmount);
  return {
    show,
    originalLineTotal,
    percent: show && Number.isFinite(percent) && percent > 0 ? percent : null,
    amount:
      show && !(Number.isFinite(percent) && percent > 0) && Number.isFinite(amount) && amount > 0
        ? amount
        : null,
  };
}

export function buildOrderItemDisplayLines(
  items: OrderItemDisplaySource[],
  nameFallback: string,
): Array<{
  name: string;
  orderedQuantity: number;
  freePieces: number;
  buy: number | null;
  free: number | null;
}> {
  const grouped = new Map<
    string,
    { name: string; orderedQuantity: number; freePieces: number; buy: number | null; free: number | null }
  >();

  items.forEach((item, index) => {
    const productId = item.productId?.trim();
    const name = getOrderItemDisplayName(item, nameFallback);
    const orderedQuantity = getOrderItemOrderedQuantity(item);
    const freePieces = getOrderItemPromotionFreePieces(item);
    const promo = readOrderItemPromoRule(item.promotionDetailsSnapshot);
    const promoKey = promo ? `${promo.buy}:${promo.free}` : 'none';
    const key = productId ? `${productId}::${promoKey}` : `__no_product_id__${index}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.orderedQuantity += orderedQuantity;
      existing.freePieces += freePieces;
      return;
    }

    grouped.set(key, {
      name,
      orderedQuantity,
      freePieces,
      buy: promo?.buy ?? null,
      free: promo?.free ?? null,
    });
  });

  return Array.from(grouped.values());
}

export function getOrderTotalOrderedPieces(items: OrderItemDisplaySource[]): number {
  if (items.length === 0) return 0;

  const total = items.reduce((sum, item) => {
    const packages = getOrderItemOrderedQuantity(item);
    const piecesPerPackage = item.piecesPerPackage && item.piecesPerPackage > 0 ? item.piecesPerPackage : 1;
    return sum + packages * piecesPerPackage;
  }, 0);

  return total > 0 ? total : items.length;
}

export function getOrderTotalFreePieces(items: OrderItemDisplaySource[]): number {
  return items.reduce((sum, item) => sum + getOrderItemPromotionFreePieces(item), 0);
}

export function getOrderItemCountSummary(items: OrderItemDisplaySource[]): {
  total: number;
  orderedPieces: number;
  freePieces: number;
} {
  const orderedPieces = getOrderTotalOrderedPieces(items);
  const freePieces = getOrderTotalFreePieces(items);

  return {
    orderedPieces,
    freePieces,
    total: orderedPieces + freePieces,
  };
}

/** Total pieces received (ordered + promotional free pieces). */
export function getOrderTotalItemCount(items: OrderItemDisplaySource[]): number {
  return getOrderItemCountSummary(items).total;
}
