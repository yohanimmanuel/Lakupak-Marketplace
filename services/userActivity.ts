import { MarketplaceProduct } from './marketplace';
import { graphqlRequest } from './graphql';

export interface UserActivity {
  id: number;
  userId: number;
  productId: string;
  productData: MarketplaceProduct;
  activityType: 'favorite' | 'viewed' | 'purchased';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface MobileUserActivityResponse {
  mobileUserActivity: {
    success: boolean;
    activities: UserActivity[];
  };
}

interface AddUserActivityResponse {
  addUserActivity: {
    success: boolean;
    activity: UserActivity;
    action: string;
  };
}

interface DeleteUserActivityResponse {
  deleteUserActivity: {
  success: boolean;
    deletedCount: number;
  };
}

class UserActivityService {
  // Get user activities by type
  async getActivities(
    userId: number,
    type: 'favorite' | 'viewed' | 'purchased',
    token?: string
  ): Promise<UserActivity[]> {
    try {
      const query = `
        query GetMobileUserActivity($userId: Int!, $type: ActivityType!) {
          mobileUserActivity(userId: $userId, type: $type) {
            success
            activities {
              id
              userId
              productId
              productData
              activityType
              metadata
              createdAt
              updatedAt
            }
          }
        }
      `;
      
      const result = await graphqlRequest<MobileUserActivityResponse>(
        query,
        { userId, type },
        token
      );
      
      return result.mobileUserActivity.activities || [];
    } catch (error) {
      return [];
    }
  }

  // Add or update user activity
  async addActivity(
    userId: number,
    productId: string,
    productData: MarketplaceProduct,
    activityType: 'favorite' | 'viewed' | 'purchased',
    metadata?: Record<string, unknown>,
    token?: string
  ): Promise<UserActivity> {
    try {
      const query = `
        mutation AddUserActivity(
          $userId: Int!
          $productId: String!
          $productData: JSONObject!
          $activityType: ActivityType!
          $metadata: JSONObject
        ) {
          addUserActivity(
            input: {
              userId: $userId
              productId: $productId
              productData: $productData
              activityType: $activityType
              metadata: $metadata
            }
          ) {
            success
            activity {
              id
              userId
              productId
              productData
              activityType
              metadata
              createdAt
              updatedAt
            }
            action
          }
        }
      `;
      
      const result = await graphqlRequest<AddUserActivityResponse>(
        query,
        {
        userId,
        productId,
        productData,
        activityType,
          metadata,
        },
        token
      );
      
      if (!result.addUserActivity.success || !result.addUserActivity.activity) {
        throw new Error('Failed to add user activity');
      }
      
      return result.addUserActivity.activity;
    } catch (error) {
      throw error;
    }
  }

  // Remove user activity
  async removeActivity(
    userId: number,
    productId: string,
    activityType: 'favorite' | 'viewed' | 'purchased',
    token?: string
  ): Promise<boolean> {
    try {
      const query = `
        mutation DeleteUserActivity(
          $userId: Int!
          $productId: String!
          $type: ActivityType!
        ) {
          deleteUserActivity(
            userId: $userId
            productId: $productId
            type: $type
          ) {
            success
            deletedCount
          }
        }
      `;
      
      const result = await graphqlRequest<DeleteUserActivityResponse>(
        query,
        { userId, productId, type: activityType },
        token
    );
      
      return result.deleteUserActivity.success;
    } catch (error) {
      return false;
    }
  }

  // Toggle favorite (add if not exists, remove if exists)
  async toggleFavorite(
    userId: number,
    productId: string,
    productData: MarketplaceProduct,
    token?: string
  ): Promise<{ isFavorite: boolean; activity?: UserActivity }> {
    try {
      // Check if already favorited
      const existingFavorites = await this.getActivities(userId, 'favorite', token);
      const isCurrentlyFavorite = existingFavorites.some(
        activity => activity.productId === productId
      );

      if (isCurrentlyFavorite) {
        // Remove from favorites
        await this.removeActivity(userId, productId, 'favorite', token);
        return { isFavorite: false };
      } else {
        // Add to favorites
        const activity = await this.addActivity(userId, productId, productData, 'favorite', undefined, token);
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
    productData: MarketplaceProduct,
    token?: string
  ): Promise<UserActivity> {
    return this.addActivity(userId, productId, productData, 'viewed', undefined, token);
  }

  // Add purchased product
  async addPurchased(
    userId: number,
    productId: string,
    productData: MarketplaceProduct,
    metadata?: Record<string, unknown>,
    token?: string
  ): Promise<UserActivity> {
    return this.addActivity(userId, productId, productData, 'purchased', metadata, token);
  }
}

export const userActivityService = new UserActivityService();
