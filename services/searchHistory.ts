import { graphqlRequest } from './graphql';

export interface SearchHistory {
  id: number;
  userId: number;
  query: string;
  createdAt: string;
  updatedAt: string;
}

interface MobileSearchHistoryResponse {
  mobileSearchHistory: {
    success: boolean;
    searches: SearchHistory[];
  };
}

interface AddSearchHistoryResponse {
  addSearchHistory: {
    success: boolean;
    message: string;
    search: SearchHistory | null;
  };
}

interface RemoveSearchHistoryResponse {
  removeSearchHistory: {
    success: boolean;
    message: string;
    search: SearchHistory | null;
  };
}

interface ClearSearchHistoryResponse {
  clearSearchHistory: {
    success: boolean;
    message: string;
    search: SearchHistory | null;
  };
}

class SearchHistoryService {
  // Get recent searches for a user
  async getRecentSearches(
    userId: number,
    limit: number = 10,
    token?: string
  ): Promise<string[]> {
    try {
      const query = `
        query GetMobileSearchHistory($userId: Int!, $limit: Int) {
          mobileSearchHistory(userId: $userId, limit: $limit) {
            success
            searches {
              id
              userId
              query
              createdAt
              updatedAt
            }
          }
        }
      `;
      
      const result = await graphqlRequest<MobileSearchHistoryResponse>(
        query,
        { userId, limit },
        token
      );
      
      if (!result.mobileSearchHistory.success) {
        return [];
      }
      
      // Return only the query strings, sorted by createdAt (most recent first)
      return result.mobileSearchHistory.searches.map(s => s.query);
    } catch (error) {
      console.error('Error fetching search history:', error);
      return [];
    }
  }

  // Add a search query to history
  async addRecentSearch(
    userId: number,
    query: string,
    token?: string
  ): Promise<void> {
    try {
      if (!query.trim()) return;

      const mutation = `
        mutation AddSearchHistory($userId: Int!, $query: String!) {
          addSearchHistory(userId: $userId, query: $query) {
            success
            message
            search {
              id
              userId
              query
              createdAt
              updatedAt
            }
          }
        }
      `;
      
      await graphqlRequest<AddSearchHistoryResponse>(
        mutation,
        { userId, query: query.trim() },
        token
      );
    } catch (error) {
      console.error('Error adding search history:', error);
      // Silently fail - search history is not critical
    }
  }

  // Remove a specific search query
  async removeRecentSearch(
    userId: number,
    query: string,
    token?: string
  ): Promise<void> {
    try {
      const mutation = `
        mutation RemoveSearchHistory($userId: Int!, $query: String!) {
          removeSearchHistory(userId: $userId, query: $query) {
            success
            message
            search {
              id
              userId
              query
              createdAt
              updatedAt
            }
          }
        }
      `;
      
      await graphqlRequest<RemoveSearchHistoryResponse>(
        mutation,
        { userId, query: query.trim() },
        token
      );
    } catch (error) {
      console.error('Error removing search history:', error);
      // Silently fail
    }
  }

  // Clear all search history
  async clearRecentSearches(
    userId: number,
    token?: string
  ): Promise<void> {
    try {
      const mutation = `
        mutation ClearSearchHistory($userId: Int!) {
          clearSearchHistory(userId: $userId) {
            success
            message
            search {
              id
              userId
              query
              createdAt
              updatedAt
            }
          }
        }
      `;
      
      await graphqlRequest<ClearSearchHistoryResponse>(
        mutation,
        { userId },
        token
      );
    } catch (error) {
      console.error('Error clearing search history:', error);
      // Silently fail
    }
  }
}

export const searchHistoryService = new SearchHistoryService();
