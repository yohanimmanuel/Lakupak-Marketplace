// Marketplace API service
// For mobile development, use your computer's IP address instead of localhost
// You can find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)
const getApiBaseUrl = () => {
  // For development, replace with your actual IP address
  // Your IP address: 192.168.0.134
  return 'http://192.168.0.134:3000/api/marketplace';
};

const API_BASE_URL = getApiBaseUrl();

export interface MarketplaceProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviewCount: number;
  soldCount: string;
  stock: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  images: string[];
  category: string;
  brand: string;
  unit: string;
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
    pickupAddress?: string;
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
  }): Promise<MarketplaceResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.category) searchParams.append('category', params.category);
    if (params?.search) searchParams.append('search', params.search);

    const url = `${API_BASE_URL}?${searchParams.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format currency values for display
      if (data.products) {
        data.products = data.products.map((product: any) => ({
          ...product,
          price: parseFloat(product.price) || 0,
          originalPrice: parseFloat(product.originalPrice) || 0,
          // Keep the raw values for calculations, but ensure they're numbers
        }));
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  async getProductById(productId: string): Promise<MarketplaceProduct> {
    try {
      const response = await fetch(`${API_BASE_URL}/${productId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }
};
