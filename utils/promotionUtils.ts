/**
 * Utility functions for promotion calculations that respect MOQ requirements
 */

import { resolveVariantMoq } from './variantRules';

export interface PromotionDetails {
  minQuantity: number;
  freeQuantity: number;
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

/**
 * Calculate promotion free items based on quantity ABOVE MOQ (PIECE-BASED SYSTEM)
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
  
  // If no MOQ is set, calculate from total quantity
  if (!moq) {
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
  
  // Only calculate free items if MOQ is met
  if (quantityInPieces < moq) return null;
  
  // Once MOQ is met, apply promotion only to quantity ABOVE MOQ
  // For example: MOQ = 4 pieces, buy 3 get 2
  // - Order 4 pieces: 0 above MOQ, 0 complete sets, 0 free items
  // - Order 7 pieces: 3 above MOQ, 1 complete set (3/3), 2 free items
  // - Order 10 pieces: 6 above MOQ, 2 complete sets (6/3), 4 free items
  const quantityAboveMOQ = quantityInPieces - moq;
  
  // Count how many complete sets of minQty we have in the quantity above MOQ
  const completeSets = Math.floor(quantityAboveMOQ / minQty);
  
  // For each complete set, give freeQty items
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
 * COMPREHENSIVE HELPER: Calculate promotion for a product with variant
 * This is the STANDARD function to use across all components (BuyNowModal, Cart, Checkout)
 * 
 * @param product - The product with promotion details and package info
 * @param quantityInPackages - Quantity ordered in packages (cartons, boxes, etc.)
 * @param variantName - The selected variant name (optional)
 * @returns PromotionGift object or null if no free items
 */
export function calculateProductPromotion(
  product: ProductWithPromotion | null | undefined,
  quantityInPackages: number,
  variantName?: string | null
): PromotionGift | null {
  if (!product?.promotionDetails) return null;
  
  // Get product-level package info (piece-based system)
  const piecesPerPackage = product.piecesPerPackage || 1;
  const totalPieces = quantityInPackages * piecesPerPackage;
  
  const moq =
    variantName && variantName !== 'Default' ? resolveVariantMoq(product, variantName) : null;

  return calculatePromotionGift(
    product.promotionDetails,
    totalPieces,
    moq
  );
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
