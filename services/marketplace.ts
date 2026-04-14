// Marketplace API service
import { graphqlRequest } from './graphql';
import { API_BASE_URL } from './config';

/** Homepage sale banner + detail (Laku Admin → Offers). */
export type MarketplaceHomeOfferPayload = {
  id: number;
  title: string;
  subtitle: string;
  discountText: string;
  endDateText: string;
  backgroundColor: string;
  textColor: string;
  detailsBody: string;
  bannerImageUrl: string | null;
  /** Full designed asset for home; when set, home card shows image only. */
  customBannerImageUrl: string | null;
  rightIconKey: string;
  discountIconKey: string;
  publishedAt: string | null;
};

// Interface for raw product data from API
interface RawProductData {
  [key: string]: unknown;
  sellingPrice?: string | number;
  price?: string | number;
  originalSellingPrice?: string | number;
  originalPrice?: string | number;
  offerBadge?: string;
  hasActiveOffer?: boolean;
  offerId?: string;
  offerName?: string;
  promotionDetails?: {
    minQuantity: number;
    freeQuantity: number;
    description: string;
  };
}

// Product variant for actual variations (color, size, flavor)
export interface ProductVariant {
  id: number;
  variantName: string;
  variantType?: string;
  sku?: string;
  purchasePrice: number;
  sellingPrice: number;
  originalSellingPrice: number | null;
  moq?: number; // Minimum Order Quantity in pieces (variant-level)
  stockQuantity?: number; // Stock quantity in pieces (variant-level)
  lowStockThreshold?: number; // Low stock threshold in pieces (variant-level)
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock'; // Stock status (variant-level)
  attributes?: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
}

export interface MarketplaceProduct {
  id: string;
  name: string;
  description: string;
  // Optional distributor owner id (when provided by API)
  userId?: number;
  sellingPrice: number;
  originalSellingPrice: number;
  discount: number;
  // Offer integration
  offerBadge?: 'Discount' | 'Promotion' | 'All Offers' | 'Offer';
  hasActiveOffer?: boolean;
  offerId?: string;
  offerName?: string;
  discountType?: 'percentage' | 'fixed' | 'buy_x_get_y';
  discountValue?: number;
  promotionDetails?: {
    minQuantity: number; // in pieces
    freeQuantity: number; // in pieces
    description: string;
  };
  rating: number;
  reviewCount: number;
  soldCount: string;
  // Stock management at product level (piece-based)
  stock: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  images: string[];
  category: string;
  productCategory: string;
  /** Retail / Wholesale / Both (from distributor; filter UI uses Retail + Wholesale multi-select). */
  salesChannel?: string;
  brand: string;
  unit: string;
  // Default package for display
  packageType: string;
  piecesPerPackage: number;
  seller: {
    name: string;
    avatar: string;
    rating: number;
    reviewCount: number;
    isOfficial: boolean;
    responseTime: string;
    deliverySpeed: string;
    returnPolicy: string;
    company?: {
      name: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
    industryType?: string;
    businessDescription?: string;
    yearsInOperation?: string;
    pickupAddress?: string;
      logo?: string;
      bannerImage?: string;
    };
  };
  shipping: {
    preferences: string[];
    selfPickup: { available: boolean; minDays?: number | null; maxDays?: number | null };
    sellerDelivery: { available: boolean; minDays?: number | null; maxDays?: number | null };
    buyerCourier: { available: boolean; minDays?: number | null; maxDays?: number | null };
    leadTimeMinDays?: number | null;
    leadTimeMaxDays?: number | null;
  };
  assurance: {
    halalCertified: boolean;
    bpomApproved: boolean;
    returnPolicyDays: number;
    originalProduct: boolean;
  };
  reviews: {
    overallRating: number;
    totalReviews: number;
    breakdown: { [key: number]: number };
    sampleReview: {
      user: string;
      avatar: string;
      rating: number;
      comment: string;
      date: string;
    };
  };
  badges?: string[];
  isPreferred?: boolean;
  paymentOptions?: string;
  shippingInfo?: {
    days: string;
    location: string;
  };
  // Product variants for actual variations (color, size, flavor)
  variants?: ProductVariant[];
  // Variant definitions and options (for component compatibility)
  variantOptions?: Array<{
    id: number;
    sku: string;
    purchasePrice: number;
    sellingPrice: number;
    originalSellingPrice?: number;
    moq: number;
    stockQuantity: number;
    lowStockThreshold: number;
    stockStatus: string;
    attributes: Record<string, string>;
    isDefault: boolean;
    isActive: boolean;
  }>;
}

export interface MarketplaceResponse {
  products: MarketplaceProduct[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  facets?: {
    productTypes: Array<{ value: string; count: number }>;
    productCategories: Array<{ value: string; count: number }>;
  };
}

interface GraphQLMarketplaceProduct {
  id: string;
  name: string;
  description: string;
  userId?: number;
  sellingPrice: number;
  originalSellingPrice?: number;
  price: number;
  originalPrice: number;
  offerBadge?: string;
  hasActiveOffer: boolean;
  offerId?: string;
  offerName?: string;
  discountType?: string;
  discountValue?: number;
  promotionDetails?: Record<string, unknown>;
  rating: number;
  reviewCount: number;
  soldCount: string;
  stock: number;
  stockStatus: string;
  images: string[];
  category: string;
  productCategory: string;
  salesChannel?: string;
  brand?: string;
  unit: string;
  sku: string;
  supplier?: string;
  publishedAt?: string;
  lastSyncAt?: string;
  piecesPerPackage: number;
  packageType: string;
  seller: Record<string, unknown>;
  shipping: Record<string, unknown>;
  shippingInfo?: { location: string };
  assurance: Record<string, unknown>;
  reviews: Record<string, unknown>;
  variants: Array<Record<string, unknown>>;
  variantOptions: Array<Record<string, unknown>>;
  variantOptionsFormatted: Array<Record<string, unknown>>;
}

interface MobileMarketplaceProductsResponse {
  mobileMarketplaceProducts: {
    nodes: GraphQLMarketplaceProduct[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
    facets: {
      productTypes: Array<{ value: string; count: number }>;
      productCategories: Array<{ value: string; count: number }>;
    };
  };
}

export const marketplaceService = {
  async getProducts(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    marketplaceUserId?: number;
    token?: string;
  }): Promise<MarketplaceResponse> {
    try {
      const query = `
        query GetMobileMarketplaceProducts(
          $page: Int
          $limit: Int
          $category: String
          $search: String
          $marketplaceUserId: Int
        ) {
          mobileMarketplaceProducts(
            page: $page
            limit: $limit
            category: $category
            search: $search
            marketplaceUserId: $marketplaceUserId
          ) {
      nodes {
        id
        name
        description
              userId
        sellingPrice
        originalSellingPrice
              price
              originalPrice
              offerBadge
        hasActiveOffer
        offerId
        offerName
        discountType
        discountValue
        promotionDetails
        rating
        reviewCount
              soldCount
              stock
              stockStatus
              images
              category
              productCategory
              salesChannel
              brand
              unit
              sku
              supplier
              publishedAt
              lastSyncAt
              piecesPerPackage
              packageType
        seller {
          name
          avatar
          rating
          reviewCount
          isOfficial
          responseTime
          deliverySpeed
          returnPolicy
          company {
            name
                  businessAddress
                  businessPhone
                  businessEmail
                  industryType
                  pickupAddress
            logo
                  bannerImage
          }
        }
              shipping {
                preferences
                selfPickup {
                  available
                  minDays
                  maxDays
                }
                sellerDelivery {
                  available
                  minDays
                  maxDays
                }
                buyerCourier {
                  available
                  minDays
                  maxDays
                }
                leadTimeMinDays
                leadTimeMaxDays
              }
              shippingInfo {
                location
              }
              assurance {
                halalCertified
                bpomApproved
                returnPolicyDays
                originalProduct
              }
              reviews {
                overallRating
                totalReviews
                breakdown
                sampleReview
                hasReviews
              }
              variants
              variantOptions
              variantOptionsFormatted
      }
      pagination {
        page
        limit
        totalCount
        totalPages
      }
      facets {
        productTypes { value count }
        productCategories { value count }
      }
    }
  }
`;

      const result = await graphqlRequest<MobileMarketplaceProductsResponse>(
        query,
        {
          page: params?.page || 1,
          limit: params?.limit || 20,
          category: params?.category,
          search: params?.search,
          marketplaceUserId: params?.marketplaceUserId,
        },
        params?.token
      );
      
      // Transform products to calculate discount and format variants
      const transformedProducts = result.mobileMarketplaceProducts.nodes.map((product: GraphQLMarketplaceProduct) => {
        const sellingPrice = Number(product.sellingPrice) || 0;
        const originalSellingPrice = Number(product.originalSellingPrice) || Number(product.originalPrice) || 0;
        const discount = originalSellingPrice > 0 
          ? ((originalSellingPrice - sellingPrice) / originalSellingPrice) * 100 
          : 0;
        
        // Transform variantOptionsFormatted to ProductVariant array for the variants property
        const variantOptionsFormatted = (product.variantOptionsFormatted || []) as Array<Record<string, unknown>>;
        const transformedVariants: ProductVariant[] = variantOptionsFormatted.map((v, idx) => ({
          id: Number(v.id) || idx,
          variantName: String(v.variantName || ''),
          variantType: v.variantType ? String(v.variantType) : undefined,
          sku: v.sku ? String(v.sku) : undefined,
          purchasePrice: Number(v.purchasePrice) || 0,
          sellingPrice: Number(v.sellingPrice) || 0,
          originalSellingPrice: v.originalSellingPrice ? Number(v.originalSellingPrice) : null,
          moq: v.moq ? Number(v.moq) : undefined,
          stockQuantity: v.stockQuantity ? Number(v.stockQuantity) : undefined,
          lowStockThreshold: v.lowStockThreshold ? Number(v.lowStockThreshold) : undefined,
          stockStatus: v.stockStatus ? String(v.stockStatus) as 'In Stock' | 'Low Stock' | 'Out of Stock' : undefined,
          attributes: v.attributes as Record<string, unknown> | undefined,
          isDefault: Boolean(v.isDefault),
          isActive: Boolean(v.isActive),
        }));

        // Keep original variants (definitions) and variantOptions (options) for component compatibility
        // Transform variantOptions to proper structure
        const variantOptions = (product.variantOptions || []) as Array<Record<string, unknown>>;
        const transformedVariantOptions = variantOptions.map((vo) => ({
          id: Number(vo.id) || 0,
          sku: String(vo.sku || ''),
          purchasePrice: Number(vo.purchasePrice) || 0,
          sellingPrice: Number(vo.sellingPrice) || 0,
          originalSellingPrice: vo.originalSellingPrice ? Number(vo.originalSellingPrice) : undefined,
          moq: Number(vo.moq) || 0,
          stockQuantity: Number(vo.stockQuantity) || 0,
          lowStockThreshold: Number(vo.lowStockThreshold) || 0,
          stockStatus: String(vo.stockStatus || 'In Stock'),
          attributes: vo.attributes as Record<string, string> || {},
          isDefault: Boolean(vo.isDefault),
          isActive: Boolean(vo.isActive),
        }));

        // Keep original variants (definitions) from GraphQL for component compatibility
        const originalVariants = (product.variants || []) as Array<Record<string, unknown>>;
        
        return {
          ...product,
          discount,
          variants: originalVariants as unknown as ProductVariant[], // Keep definitions structure for component, cast for interface
          variantOptions: transformedVariantOptions, // Keep for component
          seller: product.seller as MarketplaceProduct['seller'],
          shipping: product.shipping as MarketplaceProduct['shipping'],
          assurance: product.assurance as MarketplaceProduct['assurance'],
          reviews: product.reviews as MarketplaceProduct['reviews'],
          // Map shippingInfo location to days if needed
          shippingInfo: product.shippingInfo ? {
            location: product.shippingInfo.location || '',
            days: '', // Not available in GraphQL schema
          } : undefined,
        } as MarketplaceProduct;
      });
      
      return {
        products: transformedProducts,
        pagination: result.mobileMarketplaceProducts.pagination,
        facets: result.mobileMarketplaceProducts.facets,
      };
    } catch (error) {
      throw error;
    }
  },

  async getProductById(productId: string, token?: string): Promise<MarketplaceProduct> {
    try {
      const query = `
        query GetMobileMarketplaceProduct($productId: String!) {
          mobileMarketplaceProducts(search: $productId, limit: 1) {
            nodes {
              id
              name
              description
              userId
              sellingPrice
              originalSellingPrice
              price
              originalPrice
              offerBadge
              hasActiveOffer
              offerId
              offerName
              discountType
              discountValue
              promotionDetails
              rating
              reviewCount
              soldCount
              stock
              stockStatus
              images
              category
              productCategory
              salesChannel
              brand
              unit
              sku
              supplier
              publishedAt
              lastSyncAt
              piecesPerPackage
              packageType
              seller {
                name
                avatar
                rating
                reviewCount
                isOfficial
                responseTime
                deliverySpeed
                returnPolicy
                company {
                  name
                  businessAddress
                  businessPhone
                  businessEmail
                  industryType
                  pickupAddress
                  logo
                  bannerImage
                }
              }
              shipping {
                preferences
                selfPickup {
                  available
                  minDays
                  maxDays
                }
                sellerDelivery {
                  available
                  minDays
                  maxDays
                }
                buyerCourier {
                  available
                  minDays
                  maxDays
                }
                leadTimeMinDays
                leadTimeMaxDays
              }
              shippingInfo {
                location
              }
              assurance {
                halalCertified
                bpomApproved
                returnPolicyDays
                originalProduct
              }
              reviews {
                overallRating
                totalReviews
                breakdown
                sampleReview
                hasReviews
              }
              variants
              variantOptions
              variantOptionsFormatted
            }
          }
        }
      `;
      
      const result = await graphqlRequest<MobileMarketplaceProductsResponse>(
        query,
        { productId },
        token
      );
      
      const rawProduct = result.mobileMarketplaceProducts.nodes.find(p => p.id === productId) as GraphQLMarketplaceProduct | undefined;
      if (!rawProduct) {
        throw new Error(`Product with id ${productId} not found`);
      }
      
      // Transform product to calculate discount and format variants
      const sellingPrice = Number(rawProduct.sellingPrice) || 0;
      const originalSellingPrice = Number(rawProduct.originalSellingPrice) || Number(rawProduct.originalPrice) || 0;
      const discount = originalSellingPrice > 0 
        ? ((originalSellingPrice - sellingPrice) / originalSellingPrice) * 100 
        : 0;
      
      // Transform variantOptionsFormatted to ProductVariant array for the variants property
      const variantOptionsFormatted = (rawProduct.variantOptionsFormatted || []) as Array<Record<string, unknown>>;
      const transformedVariants: ProductVariant[] = variantOptionsFormatted.map((v, idx) => ({
        id: Number(v.id) || idx,
        variantName: String(v.variantName || ''),
        variantType: v.variantType ? String(v.variantType) : undefined,
        sku: v.sku ? String(v.sku) : undefined,
        purchasePrice: Number(v.purchasePrice) || 0,
        sellingPrice: Number(v.sellingPrice) || 0,
        originalSellingPrice: v.originalSellingPrice ? Number(v.originalSellingPrice) : null,
        moq: v.moq ? Number(v.moq) : undefined,
        stockQuantity: v.stockQuantity ? Number(v.stockQuantity) : undefined,
        lowStockThreshold: v.lowStockThreshold ? Number(v.lowStockThreshold) : undefined,
        stockStatus: v.stockStatus ? String(v.stockStatus) as 'In Stock' | 'Low Stock' | 'Out of Stock' : undefined,
        attributes: v.attributes as Record<string, unknown> | undefined,
        isDefault: Boolean(v.isDefault),
        isActive: Boolean(v.isActive),
      }));

      // Keep original variants (definitions) and variantOptions (options) for component compatibility
      // Transform variantOptions to proper structure
      const variantOptions = (rawProduct.variantOptions || []) as Array<Record<string, unknown>>;
      const transformedVariantOptions = variantOptions.map((vo) => ({
        id: Number(vo.id) || 0,
        sku: String(vo.sku || ''),
        purchasePrice: Number(vo.purchasePrice) || 0,
        sellingPrice: Number(vo.sellingPrice) || 0,
        originalSellingPrice: vo.originalSellingPrice ? Number(vo.originalSellingPrice) : undefined,
        moq: Number(vo.moq) || 0,
        stockQuantity: Number(vo.stockQuantity) || 0,
        lowStockThreshold: Number(vo.lowStockThreshold) || 0,
        stockStatus: String(vo.stockStatus || 'In Stock'),
        attributes: vo.attributes as Record<string, string> || {},
        isDefault: Boolean(vo.isDefault),
        isActive: Boolean(vo.isActive),
      }));
      
      // Keep original variants (definitions) from GraphQL for component compatibility
      const originalVariants = (rawProduct.variants || []) as Array<Record<string, unknown>>;
      
      return {
        ...rawProduct,
        discount,
        variants: originalVariants as unknown as ProductVariant[], // Keep definitions structure for component, cast for interface
        variantOptions: transformedVariantOptions, // Keep for component
        seller: rawProduct.seller as MarketplaceProduct['seller'],
        shipping: rawProduct.shipping as MarketplaceProduct['shipping'],
        assurance: rawProduct.assurance as MarketplaceProduct['assurance'],
        reviews: rawProduct.reviews as MarketplaceProduct['reviews'],
        shippingInfo: rawProduct.shippingInfo ? {
          location: rawProduct.shippingInfo.location || '',
          days: '', // Not available in GraphQL schema
        } : undefined,
      } as MarketplaceProduct;
    } catch (error) {
      throw error;
    }
  },

  async getHomeOffer(token: string): Promise<MarketplaceHomeOfferPayload | null> {
    const list = await this.getHomeOffersList(token);
    return list.length > 0 ? list[0]! : null;
  },

  /** All published special offers (home carousel + list screen). */
  async getHomeOffersList(token: string): Promise<MarketplaceHomeOfferPayload[]> {
    const r = await fetch(`${API_BASE_URL}/api/mobile/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { offers?: Partial<MarketplaceHomeOfferPayload>[] };
    const raw = j.offers ?? [];
    return raw.map((o) => normalizeHomeOffer(o)).filter((x): x is MarketplaceHomeOfferPayload => x != null);
  },

  async getHomeOfferById(token: string, id: number): Promise<MarketplaceHomeOfferPayload | null> {
    const r = await fetch(`${API_BASE_URL}/api/mobile/offers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const j = (await r.json()) as { offer?: Partial<MarketplaceHomeOfferPayload> };
    return normalizeHomeOffer(j.offer);
  },
};

function normalizeHomeOffer(
  raw: Partial<MarketplaceHomeOfferPayload> | null | undefined
): MarketplaceHomeOfferPayload | null {
  if (!raw || raw.id == null) return null;
  return {
    id: raw.id,
    title: raw.title ?? '',
    subtitle: raw.subtitle ?? '',
    discountText: raw.discountText ?? '',
    endDateText: raw.endDateText ?? '',
    backgroundColor: raw.backgroundColor ?? '#0a61d7',
    textColor: raw.textColor ?? '#FFFFFF',
    detailsBody: raw.detailsBody ?? '',
    bannerImageUrl: raw.bannerImageUrl ?? null,
    customBannerImageUrl: raw.customBannerImageUrl ?? null,
    rightIconKey: raw.rightIconKey ?? 'gift',
    discountIconKey: raw.discountIconKey ?? 'flash',
    publishedAt: raw.publishedAt ?? null,
  };
}
