import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { useCartStore } from '../stores/cartStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { marketplaceService, MarketplaceProduct } from '../services/marketplace';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../utils/searchStorage';
import { generateDynamicCategories } from '../utils/categoryUtils';
import RecentSearches from './components/searchengine/RecentSearches';
import PopularCategories from './components/searchengine/PopularCategories';
import SearchResults from './components/searchengine/SearchResults';
import SearchSuggestions from './components/searchengine/SearchSuggestions';
import { Product } from '../data/sampleProducts';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const token = useAuthStore(s => s.token);
  const { addItem } = useCartStore();
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);

  // Get all products for categories
  const { products: allProducts } = useDataStore();
  const dynamicCategories = useMemo(
    () => generateDynamicCategories(allProducts),
    [allProducts]
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
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

  const loadRecentSearches = useCallback(async () => {
    const searches = await getRecentSearches();
    setRecentSearches(searches);
  }, []);

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

      // Sort results based on selected sort option
      let sortedProducts = [...result.products];
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

      setTotalCount(result.pagination.totalCount);
      setCurrentPage(page);
      setHasMore(page < result.pagination.totalPages);
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
      if (page === 1) {
        await addRecentSearch(query.trim());
        await loadRecentSearches();
      }

      // Update URL params
      if (page === 1) {
        router.setParams({ q: query.trim() });
      }
    } catch (error) {
      setSearchResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, selectedSort, token, loadRecentSearches, router]);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  // Handle initial query from URL params
  useEffect(() => {
    if (params.q && typeof params.q === 'string') {
      setSearchQuery(params.q);
      setActiveQuery(params.q);
      performSearch(params.q, 'All', 'relevance', 1);
    }
  }, [params.q]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSearchChange = (text: string) => {
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
    }
    // Don't perform search here - only show suggestions
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      // Clear previous results and show loading immediately
      setSearchResults([]);
      setTotalCount(0);
      setLoading(true);
      performSearch(searchQuery.trim(), selectedCategory, selectedSort, 1);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setSearchQuery(suggestion);
    setSearchResults([]);
    setTotalCount(0);
    setLoading(true);
    performSearch(suggestion, selectedCategory, selectedSort, 1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveQuery('');
    setSearchResults([]);
    setTotalCount(0);
    setSelectedCategory('All');
    setSelectedSort('relevance');
    router.setParams({ q: undefined });
    inputRef.current?.focus();
  };

  const handleRecentSearchPress = (query: string) => {
    setSearchQuery(query);
    setSearchResults([]);
    setTotalCount(0);
    setLoading(true);
    performSearch(query, selectedCategory, selectedSort, 1);
  };

  const handleRemoveRecentSearch = async (query: string) => {
    await removeRecentSearch(query);
    await loadRecentSearches();
  };

  const handleClearAllRecentSearches = async () => {
    await clearRecentSearches();
    await loadRecentSearches();
  };

  const handleCategoryPress = (categoryName: string) => {
    setSearchQuery(categoryName);
    setSearchResults([]);
    setTotalCount(0);
    setLoading(true);
    performSearch(categoryName, 'All', selectedSort, 1);
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

  const showInitialState = !searchQuery.trim() && !activeQuery && searchResults.length === 0;
  const showSuggestions = searchQuery.trim() && !activeQuery && searchResults.length === 0;
  const showResults = activeQuery || searchResults.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
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

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={{ flex: 1 }}>
            {/* Content */}
            {showInitialState ? (
              <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
              <RecentSearches
                searches={recentSearches}
                onSearchPress={handleRecentSearchPress}
                onRemoveSearch={handleRemoveRecentSearch}
                onClearAll={handleClearAllRecentSearches}
              />
              <PopularCategories
                categories={dynamicCategories}
                onCategoryPress={handleCategoryPress}
              />
            </ScrollView>
          ) : showSuggestions ? (
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
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
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
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
  },
});

