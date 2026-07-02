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

export function buildOrderItemDisplayLines(
  items: OrderItemDisplaySource[],
  nameFallback: string,
): Array<{ name: string; orderedQuantity: number; freePieces: number }> {
  const grouped = new Map<string, { name: string; orderedQuantity: number; freePieces: number }>();

  items.forEach((item, index) => {
    const productId = item.productId?.trim();
    const key = productId || `__no_product_id__${index}`;
    const name = getOrderItemDisplayName(item, nameFallback);
    const orderedQuantity = getOrderItemOrderedQuantity(item);
    const freePieces = getOrderItemPromotionFreePieces(item);

    const existing = grouped.get(key);
    if (existing) {
      existing.orderedQuantity += orderedQuantity;
      existing.freePieces += freePieces;
      return;
    }

    grouped.set(key, { name, orderedQuantity, freePieces });
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
