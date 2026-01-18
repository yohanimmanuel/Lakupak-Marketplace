import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { useCartStore } from '../stores/cartStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { marketplaceService, MarketplaceProduct } from '../services/marketplace';
import { searchHistoryService } from '../services/searchHistory';
import { generateDynamicCategories, generateTopBrands, generateTopDistributors } from '../utils/categoryUtils';
import RecentSearches from './components/searchengine/RecentSearches';
import PopularCategories from './components/searchengine/PopularCategories';
import TopBrands from './components/searchengine/TopBrands';
import TopDistributors from './components/searchengine/TopDistributors';
import SearchResults from './components/searchengine/SearchResults';
import SearchSuggestions from './components/searchengine/SearchSuggestions';
import { Product } from '../data/sampleProducts';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const userId = user?.id;
  const { addItem } = useCartStore();
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);

  // Get all products for categories and brands
  const { products: allProducts } = useDataStore();
  const dynamicCategories = useMemo(
    () => generateDynamicCategories(allProducts),
    [allProducts]
  );
  const topBrands = useMemo(
    () => generateTopBrands(allProducts),
    [allProducts]
  );
  const topDistributors = useMemo(
    () => generateTopDistributors(allProducts),
    [allProducts]
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoadingSearchHistory, setIsLoadingSearchHistory] = useState(false);
  
  // Results state
  const [searchResults, setSearchResults] = useState<MarketplaceProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter state
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSort, setSelectedSort] = useState('relevance');
  
  // Available categories from search results
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Debounce timer
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const isDistributorSearchRef = useRef(false);
  const isClearingRef = useRef(false);
  const isManualEditingRef = useRef(false);

  const loadRecentSearches = useCallback(async () => {
    if (!userId) {
      setRecentSearches([]);
      setIsLoadingSearchHistory(false);
      return;
    }
    
    setIsLoadingSearchHistory(true);
    try {
      const searches = await searchHistoryService.getRecentSearches(userId, 10, token || undefined);
      setRecentSearches(searches);
    } catch (error) {
      console.error('Error loading search history:', error);
      setRecentSearches([]);
    } finally {
      setIsLoadingSearchHistory(false);
    }
  }, [userId, token]);

  const performSearch = useCallback(async (
    query: string,
    category: string = selectedCategory,
    sort: string = selectedSort,
    page: number = 1,
    append: boolean = false
  ) => {
    if (!query.trim()) {
      setSearchResults([]);
      setTotalCount(0);
      setActiveQuery('');
      return;
    }

    try {
      if (page === 1) {
        setLoading(true);
      }

      const result = await marketplaceService.getProducts({
        search: query.trim(),
        category: category !== 'All' ? category : undefined,
        page,
        limit: 20,
        token: token || undefined,
      });

      // Filter results by company/distributor name if query matches a distributor name
      let filteredProducts = result.products;
      const queryLower = query.trim().toLowerCase();
      const matchingDistributor = topDistributors.find(d => d.name.toLowerCase().trim() === queryLower);
      
      if (matchingDistributor) {
        // If query matches a distributor name, filter by company name
        filteredProducts = result.products.filter(product => {
          const companyName = product.seller?.company?.name?.toLowerCase().trim();
          return companyName === queryLower;
        });
        
        // If no API results match, fall back to client-side filtering
        if (filteredProducts.length === 0) {
          filteredProducts = allProducts.filter(product => {
            const companyName = product.seller?.company?.name?.toLowerCase().trim();
            return companyName === queryLower;
          });
        }
      }

      // Sort results based on selected sort option
      let sortedProducts = [...filteredProducts];
      if (sort === 'price_low') {
        sortedProducts.sort((a, b) => a.sellingPrice - b.sellingPrice);
      } else if (sort === 'price_high') {
        sortedProducts.sort((a, b) => b.sellingPrice - a.sellingPrice);
      } else if (sort === 'newest') {
        sortedProducts.sort((a, b) => {
          // Assuming products have a createdAt or similar field
          return 0; // Keep API order for now
        });
      }

      if (append) {
        setSearchResults(prev => [...prev, ...sortedProducts]);
      } else {
        setSearchResults(sortedProducts);
      }

      // Use filtered count if we filtered by distributor
      const finalTotalCount = matchingDistributor ? sortedProducts.length : result.pagination.totalCount;
      setTotalCount(finalTotalCount);
      setCurrentPage(page);
      setHasMore(matchingDistributor ? false : page < result.pagination.totalPages);
      setActiveQuery(query);

      // Extract unique categories from results
      const newPageCategories = Array.from(
        new Set(sortedProducts.map(p => p.category).filter(Boolean))
      );
      
      if (append) {
        // Merge new categories with existing ones when paginating
        setAvailableCategories(prev => Array.from(new Set([...prev, ...newPageCategories])));
      } else {
        // Replace categories when starting a new search
        setAvailableCategories(newPageCategories);
      }

      // Save to recent searches (only on first page)
      if (page === 1 && userId) {
        await searchHistoryService.addRecentSearch(userId, query.trim(), token || undefined);
        await loadRecentSearches();
      }

      // Update URL params for both q and category
      if (page === 1) {
        const params: { q?: string; category?: string } = { q: query.trim() };
        // Clear category param if category is 'All' or not specified, otherwise set it
        if (category && category !== 'All') {
          params.category = category;
        } else {
          params.category = undefined; // Remove category param
        }
        router.setParams(params);
        // Also update selectedCategory state to match the category param
        if (category && category !== 'All') {
          setSelectedCategory(category);
        } else {
          setSelectedCategory('All');
        }
      }
    } catch (error) {
      setSearchResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, selectedSort, token, userId, loadRecentSearches, router, topDistributors, allProducts]);

  // Load recent searches on mount and when user changes
  // Clear immediately when userId changes, then load new data
  useEffect(() => {
    // Clear immediately to prevent showing old user's searches when switching accounts
    setRecentSearches([]);
    setIsLoadingSearchHistory(false);
    
    // Then load the new user's searches
    if (userId) {
      loadRecentSearches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Only depend on userId - loadRecentSearches is stable and depends on userId/token

  // Handle initial query and category from URL params
  useEffect(() => {
    // Don't process if we're in the middle of clearing
    if (isClearingRef.current) {
      return;
    }
    
    // Don't process if user is manually editing the search input
    if (isManualEditingRef.current) {
      return;
    }
    
    // Handle category parameter (for category filtering)
    if (params.category && typeof params.category === 'string') {
      const categoryName = params.category;
      setSelectedCategory(categoryName);
      setSearchQuery(categoryName);
      setActiveQuery(categoryName);
      performSearch(categoryName, categoryName, 'relevance', 1);
      return; // Category param takes precedence
    }
    
    // Only process if params.q exists and is different from current query
    if (params.q && typeof params.q === 'string' && !isDistributorSearchRef.current) {
      // Only update if the query actually changed
      if (params.q !== searchQuery) {
        setSearchQuery(params.q);
        setActiveQuery(params.q);
        performSearch(params.q, 'All', 'relevance', 1);
      }
    }
    // Don't auto-clear when params.q is undefined - only clear when explicitly cleared via handleClearSearch
    // Reset the flag after processing
    isDistributorSearchRef.current = false;
  }, [params.q, params.category, performSearch, searchQuery]);


  const handleSearchFocus = () => {
    // When search bar is focused, show suggestions (not results)
    // Clear activeQuery and results, but keep searchQuery
    if (activeQuery || searchResults.length > 0) {
      isManualEditingRef.current = true;
      setActiveQuery('');
      setSearchResults([]);
      setTotalCount(0);
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    // Mark that user is manually editing
    isManualEditingRef.current = true;
    
    setSearchQuery(text);

    // Clear any pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!text.trim()) {
      // Clear results if query is empty
      setSearchResults([]);
      setTotalCount(0);
      setActiveQuery('');
      setLoading(false);
      // Clear URL params to prevent useEffect from re-triggering
      router.setParams({ q: undefined });
      // Keep isManualEditingRef as true to prevent useEffect from restoring the query
    } else {
      // When typing, always show suggestions (clear active query if exists)
      if (activeQuery) {
        setActiveQuery('');
        setSearchResults([]);
        setTotalCount(0);
        setLoading(false);
      }
    }
    // Don't perform search here - only show suggestions
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      // Reset manual editing flag when search is submitted
      isManualEditingRef.current = false;
      
      // Clear category filter when user submits manual query
      setSelectedCategory('All');
      
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      // Clear previous results and show loading immediately
      setSearchResults([]);
      setTotalCount(0);
      setLoading(true);
      // Perform search with 'All' category (no category filter for manual queries)
      performSearch(searchQuery.trim(), 'All', selectedSort, 1);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    isManualEditingRef.current = false; // Reset manual editing flag when selecting suggestion
    setSearchQuery(suggestion);
    setSearchResults([]);
    setTotalCount(0);
    setLoading(true);
    performSearch(suggestion, selectedCategory, selectedSort, 1);
  };

  const handleClearSearch = () => {
    isClearingRef.current = true;
    isManualEditingRef.current = false; // Reset manual editing flag when clearing
    setSearchQuery('');
    setActiveQuery('');
    setSearchResults([]);
    setTotalCount(0);
    setSelectedCategory('All');
    setSelectedSort('relevance');
    // Clear both q and category URL params
    router.setParams({ q: undefined, category: undefined });
    inputRef.current?.focus();
    // Reset the flag after a short delay to allow URL params to update
    setTimeout(() => {
      isClearingRef.current = false;
    }, 200);
  };

  const handleRecentSearchPress = (query: string) => {
    Keyboard.dismiss();
    isManualEditingRef.current = false; // Reset manual editing flag when selecting recent search
    setSearchQuery(query);
    setActiveQuery(query); // Set immediately to prevent suggestions
    setSearchResults([]);
    setTotalCount(0);
    setLoading(true);
    performSearch(query, selectedCategory, selectedSort, 1);
  };

  const handleRemoveRecentSearch = async (query: string) => {
    if (!userId) return;
    // Optimistically update UI - remove from list immediately
    setRecentSearches(prev => prev.filter(s => s !== query));
    // Delete in background
    searchHistoryService.removeRecentSearch(userId, query, token || undefined).catch(error => {
      console.error('Error removing search history:', error);
      // Reload on error to sync with server
      loadRecentSearches();
    });
  };

  const handleClearAllRecentSearches = async () => {
    if (!userId) return;
    // Optimistically update UI - clear immediately
    setRecentSearches([]);
    // Clear in background
    searchHistoryService.clearRecentSearches(userId, token || undefined).catch(error => {
      console.error('Error clearing search history:', error);
      // Reload on error to sync with server
      loadRecentSearches();
    });
  };

  const handleCategoryPress = (categoryName: string) => {
    Keyboard.dismiss();
    isManualEditingRef.current = false; // Reset manual editing flag when selecting category
    setSearchQuery(categoryName);
    setActiveQuery(categoryName); // Set immediately to prevent suggestions
    setSearchResults([]);
    setTotalCount(0);
    setLoading(true);
    performSearch(categoryName, 'All', selectedSort, 1);
  };

  const handleDistributorPress = async (distributorName: string) => {
    Keyboard.dismiss();
    // Set flag to prevent useEffect from overwriting results
    isDistributorSearchRef.current = true;
    isManualEditingRef.current = false; // Reset manual editing flag when selecting distributor
    
    setSearchQuery(distributorName);
    setActiveQuery(distributorName); // Set immediately to prevent suggestions
    setSearchResults([]);
    setTotalCount(0);
    setLoading(true);
    
    try {
      // First, try API search
      const result = await marketplaceService.getProducts({
        search: distributorName.trim(),
        page: 1,
        limit: 20,
        token: token || undefined,
      });

      // Filter API results to match distributor exactly
      const filteredResults = result.products.filter(product => {
        const companyName = product.seller?.company?.name?.toLowerCase().trim();
        const searchName = distributorName.toLowerCase().trim();
        return companyName === searchName;
      });

      if (filteredResults.length > 0) {
        // Use filtered API results
        let sortedProducts = [...filteredResults];
        if (selectedSort === 'price_low') {
          sortedProducts.sort((a, b) => a.sellingPrice - b.sellingPrice);
        } else if (selectedSort === 'price_high') {
          sortedProducts.sort((a, b) => b.sellingPrice - a.sellingPrice);
        }

        setSearchResults(sortedProducts);
        setTotalCount(filteredResults.length);
        setAvailableCategories(Array.from(new Set(sortedProducts.map(p => p.category).filter(Boolean))));
        setCurrentPage(1);
        setHasMore(false);
      } else {
        // Fallback to client-side filtering from cached products
        const cachedFiltered = allProducts.filter(product => {
          const companyName = product.seller?.company?.name?.toLowerCase().trim();
          const searchName = distributorName.toLowerCase().trim();
          return companyName === searchName;
        });

        if (cachedFiltered.length > 0) {
          let sortedProducts = [...cachedFiltered];
          if (selectedSort === 'price_low') {
            sortedProducts.sort((a, b) => a.sellingPrice - b.sellingPrice);
          } else if (selectedSort === 'price_high') {
            sortedProducts.sort((a, b) => b.sellingPrice - a.sellingPrice);
          }

          setSearchResults(sortedProducts);
          setTotalCount(sortedProducts.length);
          setAvailableCategories(Array.from(new Set(sortedProducts.map(p => p.category).filter(Boolean))));
          setCurrentPage(1);
          setHasMore(false);
        } else {
          // No results found
          setSearchResults([]);
          setTotalCount(0);
          setAvailableCategories([]);
          setCurrentPage(1);
          setHasMore(false);
        }
      }

      // Save to recent searches
      if (userId) {
        await searchHistoryService.addRecentSearch(userId, distributorName.trim(), token || undefined);
        await loadRecentSearches();
      }

      // Update URL params to show distributor name in search bar
      // Do this after search completes to avoid triggering useEffect during search
      router.setParams({ q: distributorName.trim() });
      
      // Reset flag after a delay to allow URL params to update
      setTimeout(() => {
        isDistributorSearchRef.current = false;
      }, 100);
    } catch (error) {
      // On error, try client-side filtering
      const cachedFiltered = allProducts.filter(product => {
        const companyName = product.seller?.company?.name?.toLowerCase().trim();
        const searchName = distributorName.toLowerCase().trim();
        return companyName === searchName;
      });

      if (cachedFiltered.length > 0) {
        let sortedProducts = [...cachedFiltered];
        if (selectedSort === 'price_low') {
          sortedProducts.sort((a, b) => a.sellingPrice - b.sellingPrice);
        } else if (selectedSort === 'price_high') {
          sortedProducts.sort((a, b) => b.sellingPrice - a.sellingPrice);
        }

        setSearchResults(sortedProducts);
        setTotalCount(sortedProducts.length);
        setAvailableCategories(Array.from(new Set(sortedProducts.map(p => p.category).filter(Boolean))));
      } else {
        setSearchResults([]);
        setTotalCount(0);
        setAvailableCategories([]);
      }
      setCurrentPage(1);
      setHasMore(false);
      
      // Reset flag in case of error
      isDistributorSearchRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    if (activeQuery) {
      setSearchResults([]);
      setTotalCount(0);
      setLoading(true);
      performSearch(activeQuery, category, selectedSort, 1);
    }
  };

  const handleSortChange = (sort: string) => {
    setSelectedSort(sort);
    if (activeQuery) {
      setSearchResults([]);
      setTotalCount(0);
      setLoading(true);
      performSearch(activeQuery, selectedCategory, sort, 1);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await performSearch(activeQuery, selectedCategory, selectedSort, 1);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading && activeQuery) {
      performSearch(
        activeQuery,
        selectedCategory,
        selectedSort,
        currentPage + 1,
        true
      );
    }
  };

  const handleProductPress = useCallback(
    (product: Product) => {
      router.push({
        pathname: '/product',
        params: { productId: product.id },
      });
    },
    [router]
  );

  const handleAddToCart = useCallback(
    (product: Product) => {
      addItem(product as MarketplaceProduct, 1);
    },
    [addItem]
  );

  const handleToggleFavorite = useCallback(
    async (productId: string) => {
      const product = searchResults.find(p => p.id === productId);
      if (product) {
        await toggleLikedProduct(productId, product);
      }
    },
    [searchResults, toggleLikedProduct]
  );

  const showInitialState = !searchQuery.trim() && !activeQuery && searchResults.length === 0 && !loading;
  const showSuggestions = searchQuery.trim() && !activeQuery && searchResults.length === 0 && !loading;
  const showResults = activeQuery || searchResults.length > 0 || loading;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          header: () => (
            <View style={styles.headerContainer}>
              <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                  <ArrowLeft color="#0a61d7" size={24} />
                </Pressable>

                <View style={styles.searchBar}>
                  <SearchIcon color="#6B7280" size={20} />
                  <TextInput
                    ref={inputRef}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    onFocus={handleSearchFocus}
                    onSubmitEditing={handleSearchSubmit}
                    placeholder="Search for products..."
                    style={styles.searchInput}
                    placeholderTextColor="#6B7280"
                    returnKeyType="search"
                  />
                  {searchQuery ? (
                    <Pressable onPress={handleClearSearch} style={styles.clearButton}>
                      <X color="#6B7280" size={20} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ),
        }}
      />

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {showInitialState ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <RecentSearches
            searches={recentSearches}
            onSearchPress={handleRecentSearchPress}
            onRemoveSearch={handleRemoveRecentSearch}
            onClearAll={handleClearAllRecentSearches}
            isLoading={isLoadingSearchHistory}
          />
          <PopularCategories
            categories={dynamicCategories}
            onCategoryPress={handleCategoryPress}
          />
          <TopBrands
            brands={topBrands}
            onBrandPress={handleCategoryPress}
          />
          <TopDistributors
            distributors={topDistributors}
            onDistributorPress={handleDistributorPress}
          />
        </ScrollView>
      ) : showSuggestions ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <SearchSuggestions
            query={searchQuery}
            recentSearches={recentSearches}
            products={allProducts}
            onSuggestionPress={handleSuggestionPress}
          />
        </ScrollView>
      ) : showResults ? (
        <SearchResults
          query={activeQuery}
          products={searchResults}
          totalCount={totalCount}
          loading={loading}
          refreshing={refreshing}
          hasMore={hasMore}
          onProductPress={handleProductPress}
          onAddToCart={handleAddToCart}
          onToggleFavorite={handleToggleFavorite}
          favorites={likedProducts}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          onCategoryFilter={handleCategoryFilter}
          onSortChange={handleSortChange}
          selectedCategory={selectedCategory}
          selectedSort={selectedSort}
          availableCategories={availableCategories}
        />
      ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    paddingTop: 33,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
    marginLeft: -4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 40,
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});

