/**
 * Utility functions for promotion calculations that respect MOQ requirements.
 * Keep in sync with Lakupak-Dashboard/src/utils/promotionUtils.ts piece-based rules.
 */

export interface PromotionDetails {
  /** Buy-X threshold in packages of the ordered stock level (converted to pieces at calc time). */
  minQuantity: number;
  /** Free-Y amount in packages of the ordered stock level (converted to pieces at calc time). */
  freeQuantity: number;
  /** Defaults to `after_moq` when omitted (legacy offers / order snapshots). */
  applyMode?: 'from_zero' | 'after_moq';
  /** Optional product MOQ already converted to pieces. */
  moq?: number | null;
}

export interface PromotionGift {
  freeQty: number;
  totalReceived: number;
}

export interface ProductVariant {
  id?: string | number;
  variantName?: string;
  moq?: number | null;
  sellingPrice?: number;
  originalSellingPrice?: number | null;
  variantType?: string;
  sku?: string;
  attributes?: unknown;
}

export interface ProductWithPromotion {
  id?: string | number;
  promotionDetails?: PromotionDetails | null;
  piecesPerPackage?: number;
  packageType?: string;
  variants?: ProductVariant[];
  variantOptions?: Array<{
    id: number;
    moq?: number | null;
    attributes: Record<string, string>;
  }>;
}

function normalizePromotionApplyMode(
  mode?: string | null,
): 'from_zero' | 'after_moq' {
  return mode === 'from_zero' ? 'from_zero' : 'after_moq';
}

/** Resolve product MOQ into pieces for the ordered stock level. */
export function resolveMoqInPieces(opts: {
  packageType?: string | null;
  piecesPerPackage: number;
  moqPieces?: number | null;
  moqByStockLevel?: Record<string, number> | null;
}): number | null {
  const piecesPerPackage = Math.max(1, Math.trunc(Number(opts.piecesPerPackage) || 1));
  const level = String(opts.packageType || '').trim();
  const byLevel = opts.moqByStockLevel;
  if (level && level.toLowerCase() !== 'pieces' && byLevel && typeof byLevel === 'object') {
    const levelMoq = Number(byLevel[level]);
    if (Number.isFinite(levelMoq) && levelMoq > 0) {
      return Math.trunc(levelMoq) * piecesPerPackage;
    }
  }
  const piecesMoq = opts.moqPieces;
  if (piecesMoq != null && Number.isFinite(Number(piecesMoq)) && Number(piecesMoq) > 0) {
    return Math.trunc(Number(piecesMoq));
  }
  return null;
}

/**
 * Calculate promotion free items (PIECE-BASED SYSTEM).
 * Callers must pass minQuantity / freeQuantity / moq already in pieces.
 */
export function calculatePromotionGift(
  promotionDetails: PromotionDetails | null | undefined,
  quantityInPieces: number,
  moq: number | null | undefined
): PromotionGift | null {
  if (!promotionDetails) return null;

  const minQty = Math.max(1, Math.trunc(promotionDetails.minQuantity || 1));
  const freeQty = Math.max(0, Math.trunc(promotionDetails.freeQuantity || 0));
  const applyMode = normalizePromotionApplyMode(promotionDetails.applyMode);
  const qty = Math.max(0, Math.trunc(quantityInPieces || 0));
  if (freeQty <= 0 || qty <= 0) return null;

  if (applyMode === 'from_zero' || moq === null || moq === undefined) {
    const completeSets = Math.floor(qty / minQty);
    const totalFreeItems = completeSets * freeQty;

    if (totalFreeItems > 0) {
      return {
        freeQty: totalFreeItems,
        totalReceived: qty + totalFreeItems
      };
    }
    return null;
  }

  const moqPieces = Math.max(0, Math.trunc(moq));
  if (qty < moqPieces) return null;

  const quantityAboveMOQ = qty - moqPieces;
  const completeSets = Math.floor(quantityAboveMOQ / minQty);
  const totalFreeItems = completeSets * freeQty;

  if (totalFreeItems > 0) {
    return {
      freeQty: totalFreeItems,
      totalReceived: qty + totalFreeItems
    };
  }

  return null;
}

/**
 * Helper: package qty → pieces, then convert package-based X/Y to pieces.
 * Returns freeQty in pieces (same as calculateOrderItemPromotion).
 */
export function calculatePromotionGiftWithPackages(
  promotionDetails: PromotionDetails | null | undefined,
  quantityInPackages: number,
  piecesPerPackage: number,
  moq: number | null | undefined
): PromotionGift | null {
  return calculateOrderItemPromotion(
    promotionDetails,
    quantityInPackages,
    piecesPerPackage,
    moq,
  );
}

export type ApprovedPromotionSnapshot = {
  promotionDetails: PromotionDetails | null;
  variantOptionId: number | null;
  selectedVariantOptionId: number | null;
  eligibleStockLevels: string[] | null;
  stockLevelName: string;
  piecesPerPackage: number;
  moq: number | null;
};

export function calculateProductPromotion(
  product: ProductWithPromotion | null | undefined,
  quantityInPackages: number,
  _variantName?: string | null,
  approved?: ApprovedPromotionSnapshot | null,
): PromotionGift | null {
  if (!product || !approved?.promotionDetails) return null;
  const selectedVariant = product.variantOptions?.find(option =>
    option.id === approved.variantOptionId
  );
  if (approved.variantOptionId != null &&
      (!selectedVariant || approved.variantOptionId !== approved.selectedVariantOptionId)) return null;
  if (approved.eligibleStockLevels !== null &&
      !approved.eligibleStockLevels.includes(approved.stockLevelName)) return null;
  const piecesPerPackage = Number(approved.piecesPerPackage);
  if (!Number.isFinite(piecesPerPackage) || piecesPerPackage <= 0) return null;
  return calculateOrderItemPromotion(
    approved.promotionDetails,
    quantityInPackages,
    piecesPerPackage,
    approved.moq,
  );
}

/**
 * HELPER FOR ORDER DETAILS: Calculate promotion from saved order item data.
 * Offer X/Y are packages → convert to pieces using piecesPerPackage.
 */
export function calculateOrderItemPromotion(
  promotionDetails: PromotionDetails | string | null | undefined,
  quantityInPackages: number,
  piecesPerPackage: number,
  moq: number | null | undefined
): PromotionGift | null {
  let parsedPromotionDetails: PromotionDetails | null = null;
  if (typeof promotionDetails === 'string') {
    try {
      parsedPromotionDetails = JSON.parse(promotionDetails);
    } catch {
      return null;
    }
  } else if (promotionDetails && typeof promotionDetails === 'object') {
    parsedPromotionDetails = promotionDetails;
  }

  if (!parsedPromotionDetails) return null;

  const ppp = Math.max(1, Math.trunc(Number(piecesPerPackage) || 1));
  const packages = Math.max(0, Number(quantityInPackages) || 0);
  const totalPieces = Math.trunc(packages * ppp);

  const moqPieces =
    parsedPromotionDetails.moq != null && Number(parsedPromotionDetails.moq) > 0
      ? Math.trunc(Number(parsedPromotionDetails.moq))
      : moq != null && Number(moq) > 0
        ? Math.trunc(Number(moq))
        : null;

  const piecePromotion: PromotionDetails = {
    ...parsedPromotionDetails,
    minQuantity: Math.max(1, Math.trunc(parsedPromotionDetails.minQuantity || 1)) * ppp,
    freeQuantity: Math.max(0, Math.trunc(parsedPromotionDetails.freeQuantity || 0)) * ppp,
  };

  return calculatePromotionGift(
    piecePromotion,
    totalPieces,
    moqPieces
  );
}
