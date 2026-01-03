import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 10;

export interface RecentSearch {
  query: string;
  timestamp: number;
}

/**
 * Get recent searches from AsyncStorage
 */
export const getRecentSearches = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (data) {
      const searches: RecentSearch[] = JSON.parse(data);
      // Return only the query strings, sorted by timestamp (most recent first)
      return searches
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(s => s.query);
    }
    return [];
  } catch (error) {
    return [];
  }
};

/**
 * Add a search query to recent searches
 */
export const addRecentSearch = async (query: string): Promise<void> => {
  try {
    if (!query.trim()) return;

    const data = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    let searches: RecentSearch[] = data ? JSON.parse(data) : [];

    // Remove duplicate if exists
    searches = searches.filter(s => s.query.toLowerCase() !== query.toLowerCase());

    // Add new search at the beginning
    searches.unshift({
      query: query.trim(),
      timestamp: Date.now(),
    });

    // Keep only the most recent MAX_RECENT_SEARCHES
    searches = searches.slice(0, MAX_RECENT_SEARCHES);

    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    // Silently fail
  }
};

/**
 * Remove a specific search query from recent searches
 */
export const removeRecentSearch = async (query: string): Promise<void> => {
  try {
    const data = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (!data) return;

    let searches: RecentSearch[] = JSON.parse(data);
    searches = searches.filter(s => s.query.toLowerCase() !== query.toLowerCase());

    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    // Silently fail
  }
};
/**
 * Clear all recent searches
 */
export const clearRecentSearches = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (error) {
    // Silently fail
  }
};

