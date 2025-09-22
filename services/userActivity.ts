import { MarketplaceProduct } from './marketplace';

// For mobile development, use your computer's IP address instead of localhost
// You can find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)
const getApiBaseUrl = () => {
  // For development, replace with your actual IP address
  // Your IP address: 192.168.0.134
  return 'http://192.168.0.134:3000';
};

const API_BASE_URL = getApiBaseUrl();

export interface UserActivity {
  id: number;
  userId: number;
  productId: string;
  productData: MarketplaceProduct;
  activityType: 'favorite' | 'viewed' | 'purchased';
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface UserActivityResponse {
  success: boolean;
  activities?: UserActivity[];
  activity?: UserActivity;
  action?: 'created' | 'updated';
  deletedCount?: number;
  error?: string;
}

class UserActivityService {
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<UserActivityResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      // Return empty response instead of throwing to prevent app crashes
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed',
        activities: []
      };
    }
  }

  // Get user activities by type
  async getActivities(userId: number, type: 'favorite' | 'viewed' | 'purchased'): Promise<UserActivity[]> {
    const response = await this.makeRequest(
      `/api/mobile/user-activity?userId=${userId}&type=${type}`
    );
    return response.activities || [];
  }

  // Add or update user activity
  async addActivity(
    userId: number,
    productId: string,
    productData: MarketplaceProduct,
    activityType: 'favorite' | 'viewed' | 'purchased',
    metadata?: any
  ): Promise<UserActivity> {
    const response = await this.makeRequest('/api/mobile/user-activity', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        productId,
        productData,
        activityType,
        metadata
      }),
    });
    return response.activity!;
  }

  // Remove user activity
  async removeActivity(
    userId: number,
    productId: string,
    activityType: 'favorite' | 'viewed' | 'purchased'
  ): Promise<boolean> {
    const response = await this.makeRequest(
      `/api/mobile/user-activity?userId=${userId}&productId=${productId}&type=${activityType}`,
      { method: 'DELETE' }
    );
    return response.success;
  }

  // Toggle favorite (add if not exists, remove if exists)
  async toggleFavorite(
    userId: number,
    productId: string,
    productData: MarketplaceProduct
  ): Promise<{ isFavorite: boolean; activity?: UserActivity }> {
    try {
      // Check if already favorited
      const existingFavorites = await this.getActivities(userId, 'favorite');
      const isCurrentlyFavorite = existingFavorites.some(
        activity => activity.productId === productId
      );

      if (isCurrentlyFavorite) {
        // Remove from favorites
        await this.removeActivity(userId, productId, 'favorite');
        return { isFavorite: false };
      } else {
        // Add to favorites
        const activity = await this.addActivity(userId, productId, productData, 'favorite');
        return { isFavorite: true, activity };
      }
    } catch (error) {
      throw error;
    }
  }

  // Add viewed product
  async addViewed(
    userId: number,
    productId: string,
    productData: MarketplaceProduct
  ): Promise<UserActivity> {
    return this.addActivity(userId, productId, productData, 'viewed');
  }

  // Add purchased product
  async addPurchased(
    userId: number,
    productId: string,
    productData: MarketplaceProduct,
    metadata?: any
  ): Promise<UserActivity> {
    return this.addActivity(userId, productId, productData, 'purchased', metadata);
  }
}

export const userActivityService = new UserActivityService();
