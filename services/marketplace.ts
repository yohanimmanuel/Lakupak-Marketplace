// Marketplace API service
import { API_BASE_URL } from './config';

const MARKETPLACE_API_URL = `${API_BASE_URL}/api/marketplace`;

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
    standard: { price: number; free: boolean; available: boolean };
    express: { price: number; free: boolean; available: boolean };
    sameDay: { price: number; free: boolean; available: boolean };
    nextDay: { price: number; free: boolean; available: boolean };
    scheduled: { price: number; free: boolean; available: boolean };
    pickup: { price: number; free: boolean; available: boolean };
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
}

export interface MarketplaceResponse {
  products: MarketplaceProduct[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export const marketplaceService = {
  async getProducts(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    marketplaceUserId?: number;
  }): Promise<MarketplaceResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.category) searchParams.append('productType', params.category);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.marketplaceUserId) searchParams.append('marketplaceUserId', params.marketplaceUserId.toString());

    const url = `${MARKETPLACE_API_URL}?${searchParams.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format currency values for display and map offer fields
      if (data.products) {
        data.products = data.products.map((product: MarketplaceProduct) => ({
          ...product,
          // Map price fields (support both old and new field names)
          sellingPrice: parseFloat(String(product.sellingPrice)) || 0,
          originalSellingPrice: parseFloat(String(product.originalSellingPrice)) || 0,
          // Keep offer integration fields
          offerBadge: product.offerBadge,
          hasActiveOffer: product.hasActiveOffer,
          offerId: product.offerId,
          offerName: product.offerName,
          promotionDetails: product.promotionDetails,
        }));
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async getProductById(productId: string): Promise<MarketplaceProduct> {
    try {
      const response = await fetch(`${MARKETPLACE_API_URL}/${productId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Map price fields and offer integration
      return {
        ...data,
        sellingPrice: parseFloat(data.sellingPrice || data.price) || 0,
        originalSellingPrice: parseFloat(data.originalSellingPrice || data.originalPrice) || 0,
        offerBadge: data.offerBadge,
        hasActiveOffer: data.hasActiveOffer,
        offerId: data.offerId,
        offerName: data.offerName,
        promotionDetails: data.promotionDetails,
      };
    } catch (error) {
      throw error;
    }
  }
};
