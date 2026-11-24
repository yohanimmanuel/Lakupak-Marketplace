/**
 * Utility functions for promotion calculations that respect MOQ requirements
 */

export interface PromotionDetails {
  minQuantity: number;
  freeQuantity: number;
  /** Defaults to `after_moq` when omitted (legacy offers / order snapshots). */
  applyMode?: 'from_zero' | 'after_moq';
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

/**
 * Calculate promotion free items based on quantity and apply mode (PIECE-BASED SYSTEM)
 * @param promotionDetails - The promotion details (minQuantity, freeQuantity in pieces)
 * @param quantityInPieces - Current quantity ordered IN PIECES
 * @param moq - Minimum Order Quantity IN PIECES (null if no MOQ)
 * @returns PromotionGift object or null if no free items
 */
export function calculatePromotionGift(
  promotionDetails: PromotionDetails | null | undefined,
  quantityInPieces: number,
  moq: number | null | undefined
): PromotionGift | null {
  if (!promotionDetails) return null;
  
  const minQty = promotionDetails.minQuantity || 1;
  const freeQty = promotionDetails.freeQuantity || 0;
  const applyMode = normalizePromotionApplyMode(promotionDetails.applyMode);

  if (applyMode === 'from_zero' || moq === null || moq === undefined) {
    const completeSets = Math.floor(quantityInPieces / minQty);
    const totalFreeItems = completeSets * freeQty;
    
    if (totalFreeItems > 0) {
      return {
        freeQty: totalFreeItems,
        totalReceived: quantityInPieces + totalFreeItems
      };
    }
    return null;
  }
  
  // after_moq: MOQ satisfied when quantity >= moq (not strictly greater).
  if (quantityInPieces < moq) return null;
  
  const quantityAboveMOQ = quantityInPieces - moq;
  const completeSets = Math.floor(quantityAboveMOQ / minQty);
  const totalFreeItems = completeSets * freeQty;
  
  if (totalFreeItems > 0) {
    return {
      freeQty: totalFreeItems,
      totalReceived: quantityInPieces + totalFreeItems
    };
  }
  
  return null;
}

/**
 * Helper function to calculate promotion with package conversion
 * @param promotionDetails - The promotion details
 * @param quantityInPackages - Quantity in packages (cartons, boxes, etc.)
 * @param piecesPerPackage - How many pieces in one package
 * @param moq - Minimum Order Quantity IN PIECES
 * @returns PromotionGift object with freeQty in PACKAGES or null
 */
export function calculatePromotionGiftWithPackages(
  promotionDetails: PromotionDetails | null | undefined,
  quantityInPackages: number,
  piecesPerPackage: number,
  moq: number | null | undefined
): PromotionGift | null {
  // Convert to pieces
  const quantityInPieces = quantityInPackages * piecesPerPackage;
  
  // Calculate promotion in pieces
  const result = calculatePromotionGift(promotionDetails, quantityInPieces, moq);
  
  if (!result) return null;
  
  // Convert free items back to packages for display
  const freePackages = Math.floor(result.freeQty / piecesPerPackage);
  
  if (freePackages > 0) {
    return {
      freeQty: freePackages,
      totalReceived: quantityInPackages + freePackages
    };
  }
  
  return null;
}

/**
 * Promotion eligibility is determined by the distributor, not by public
 * product metadata. A caller may pass an APPROVED order-line promotion
 * snapshot, tied to its variant and stock level. Catalog/checkout calls that
 * only have a product must not expose or calculate private offers.
 */
export type ApprovedPromotionSnapshot = {
  promotionDetails: PromotionDetails | null;
  variantOptionId: number | null;
  eligibleStockLevels: string[] | null;
  stockLevelName: string;
  piecesPerPackage: number;
  moq: number | null;
};

export function calculateProductPromotion(
  product: ProductWithPromotion | null | undefined,
  quantityInPackages: number,
  variantName?: string | null,
  approved?: ApprovedPromotionSnapshot | null,
): PromotionGift | null {
  if (!product || !approved?.promotionDetails) return null;
  const selectedVariant = product.variantOptions?.find(option =>
    option.id === approved.variantOptionId
  );
  // Explicit variant targeting must match a real option. Whole-product
  // approved snapshots use null and apply to any variant.
  if (approved.variantOptionId != null &&
      (!selectedVariant || (variantName && variantName !== 'Default' &&
        !matchesApprovedVariant(product, selectedVariant.id, variantName)))) return null;
  if (approved.eligibleStockLevels !== null &&
      !approved.eligibleStockLevels.includes(approved.stockLevelName)) return null;
  const piecesPerPackage = Number(approved.piecesPerPackage);
  if (!Number.isFinite(piecesPerPackage) || piecesPerPackage <= 0) return null;
  return calculatePromotionGift(
    approved.promotionDetails,
    quantityInPackages * piecesPerPackage,
    approved.moq,
  );
}

function matchesApprovedVariant(
  product: ProductWithPromotion,
  optionId: number,
  variantName: string,
): boolean {
  const option = product.variantOptions?.find(value => value.id === optionId);
  const variant = product.variants?.find(value => value.id != null &&
    String(value.id) === String(optionId));
  return Boolean(option && (
    variantName === variant?.variantName ||
    variantName === String(optionId)
  ));
}

/**
 * HELPER FOR ORDER DETAILS: Calculate promotion from saved order item data
 * Use this for OrderDetails components where data comes from order history
 * 
 * @param promotionDetails - The saved promotion details
 * @param quantityInPackages - Quantity ordered in packages
 * @param piecesPerPackage - Pieces per package from order item
 * @param moq - MOQ from order item or fetched product data (in pieces)
 * @returns PromotionGift object or null if no free items
 */
export function calculateOrderItemPromotion(
  promotionDetails: PromotionDetails | string | null | undefined,
  quantityInPackages: number,
  piecesPerPackage: number,
  moq: number | null | undefined
): PromotionGift | null {
  // Parse promotion details if it's a string
  let parsedPromotionDetails: PromotionDetails | null = null;
  if (typeof promotionDetails === 'string') {
    try {
      parsedPromotionDetails = JSON.parse(promotionDetails);
    } catch (e) {
      return null;
    }
  } else if (promotionDetails && typeof promotionDetails === 'object') {
    parsedPromotionDetails = promotionDetails;
  }
  
  if (!parsedPromotionDetails) return null;
  
  // Calculate total pieces
  const totalPieces = quantityInPackages * piecesPerPackage;
  
  // Calculate promotion in pieces
  return calculatePromotionGift(
    parsedPromotionDetails,
    totalPieces,
    moq
  );
}
