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
import { ArrowLeft, Filter, Search as SearchIcon, X, ChevronDown } from 'lucide-react-native';
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
import SearchFilterSheet, { type SearchFilters, type ShippingOptionKey } from './components/searchengine/SearchFilterSheet';
import { Product } from '../data/sampleProducts';

export default function SearchScreen() {
  const HEADER_TOP_PADDING = 33;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchRowHeight, setSearchRowHeight] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({
    shippedFrom: 'All',
    shippingOption: 'All',
    minPrice: '',
    maxPrice: '',
    category: 'All',
  });
  
  // Available categories from search results
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  const shippedFromOptions = useMemo(() => {
    const locations = Array.from(
      new Set(
        searchResults
          .map((p) => (p.shippingInfo?.location || '').trim())
          .filter(Boolean)
      )
    );
    locations.sort((a, b) => a.localeCompare(b));
    return ['All', ...locations];
  }, [searchResults]);

  const shippingOptions = useMemo(() => {
    const avail = {
      selfPickup: searchResults.some((p) => !!p.shipping?.selfPickup?.available),
      sellerDelivery: searchResults.some((p) => !!p.shipping?.sellerDelivery?.available),
      buyerCourier: searchResults.some((p) => !!p.shipping?.buyerCourier?.available),
    };

    const out: Array<{ key: ShippingOptionKey; label: string }> = [];
    if (avail.selfPickup) out.push({ key: 'selfPickup', label: 'Self Collection' });
    if (avail.sellerDelivery) out.push({ key: 'sellerDelivery', label: 'Doorstep Delivery' });
    if (avail.buyerCourier) out.push({ key: 'buyerCourier', label: 'Buyer Courier' });
    return out;
  }, [searchResults]);

  const categoryOptions = useMemo(() => {
    const cats = (availableCategories.length > 0 ? availableCategories : dynamicCategories.map((c) => c.name))
      .map((c) => (c || '').trim())
      .filter(Boolean);
    const uniq = Array.from(new Set(cats));
    uniq.sort((a, b) => a.localeCompare(b));
    return ['All', ...uniq];
  }, [availableCategories, dynamicCategories]);

  const filteredResults = useMemo(() => {
    const shippedFrom = filters.shippedFrom;
    const shipOpt = filters.shippingOption;
    const cat = filters.category;
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;

    return searchResults.filter((p) => {
      if (cat !== 'All' && (p.category || '').trim() !== cat) return false;
      if (shippedFrom !== 'All') {
        const loc = (p.shippingInfo?.location || '').trim();
        if (loc !== shippedFrom) return false;
      }
      if (shipOpt !== 'All') {
        const key = shipOpt as ShippingOptionKey;
        if (!p.shipping?.[key]?.available) return false;
      }
      if (min !== null && Number.isFinite(min) && p.sellingPrice < min) return false;
      if (max !== null && Number.isFinite(max) && p.sellingPrice > max) return false;
      return true;
    });
  }, [searchResults, filters]);

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
      const parseSoldCount = (sold: unknown): number => {
        const s = String(sold ?? '').trim().toLowerCase();
        if (!s) return 0;
        const m = /^(\d+(?:\.\d+)?)(k|m)?\+?$/.exec(s.replace(/sold\/month|sold/g, '').trim());
        if (!m) {
          const n = Number(s.replace(/[^\d.]/g, ''));
          return Number.isFinite(n) ? n : 0;
        }
        const base = Number(m[1]);
        if (!Number.isFinite(base)) return 0;
        const mult = m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1;
        return base * mult;
      };
      if (sort === 'price_low') {
        sortedProducts.sort((a, b) => a.sellingPrice - b.sellingPrice);
      } else if (sort === 'price_high') {
        sortedProducts.sort((a, b) => b.sellingPrice - a.sellingPrice);
      } else if (sort === 'top_sales') {
        sortedProducts.sort((a, b) => parseSoldCount(b.soldCount) - parseSoldCount(a.soldCount));
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
    setFilters({
      shippedFrom: 'All',
      shippingOption: 'All',
      minPrice: '',
      maxPrice: '',
      category: 'All',
    });
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
  const isPrice = selectedSort === 'price_low' || selectedSort === 'price_high';
  const priceAsc = selectedSort !== 'price_high';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          header: () => (
            <View style={styles.headerContainer}>
              <View
                style={styles.header}
                onLayout={(e) => setSearchRowHeight(e.nativeEvent.layout.height + HEADER_TOP_PADDING)}
              >
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

                {showResults ? (
                  <Pressable
                    onPress={() => setFiltersOpen((v) => !v)}
                    style={styles.filterButton}
                    hitSlop={10}
                  >
                    <Filter color="#0a61d7" size={20} />
                  </Pressable>
                ) : null}
              </View>

              {showResults ? (
                <View style={styles.filterTabsWrap}>
                  <View style={styles.filterTabsRow}>
                    <Pressable onPress={() => handleSortChange('relevance')} style={styles.filterTabBtn} accessibilityRole="button">
                      <Text style={[styles.filterTabText, selectedSort === 'relevance' && styles.filterTabTextActive]}>Relevance</Text>
                      {selectedSort === 'relevance' ? <View style={styles.filterUnderlineFull} /> : null}
                    </Pressable>
                    <Pressable onPress={() => handleSortChange('newest')} style={styles.filterTabBtn} accessibilityRole="button">
                      <Text style={[styles.filterTabText, selectedSort === 'newest' && styles.filterTabTextActive]}>Latest</Text>
                      {selectedSort === 'newest' ? <View style={styles.filterUnderlineFull} /> : null}
                    </Pressable>
                    <Pressable onPress={() => handleSortChange('top_sales')} style={styles.filterTabBtn} accessibilityRole="button">
                      <Text style={[styles.filterTabText, selectedSort === 'top_sales' && styles.filterTabTextActive]}>Top Sales</Text>
                      {selectedSort === 'top_sales' ? <View style={styles.filterUnderlineFull} /> : null}
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (isPrice) {
                          handleSortChange(priceAsc ? 'price_high' : 'price_low');
                          return;
                        }
                        handleSortChange('price_low');
                      }}
                      style={styles.filterTabBtn}
                      accessibilityRole="button"
                    >
                      <View style={styles.filterTabInline}>
                        <Text style={[styles.filterTabText, isPrice && styles.filterTabTextActive]}>Price</Text>
                        <ChevronDown
                          size={14}
                          color={isPrice ? '#0a61d7' : '#6b7280'}
                          style={{ transform: [{ rotate: isPrice && !priceAsc ? '180deg' : '0deg' }] }}
                        />
                      </View>
                      {isPrice ? <View style={styles.filterUnderlineFull} /> : null}
                    </Pressable>
                  </View>
                </View>
              ) : null}
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
          products={filteredResults}
          totalCount={filteredResults.length}
          loading={loading}
          refreshing={refreshing}
          hasMore={hasMore}
          onProductPress={handleProductPress}
          onAddToCart={handleAddToCart}
          onToggleFavorite={handleToggleFavorite}
          favorites={likedProducts}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
        />
      ) : null}
      </KeyboardAvoidingView>

      <SearchFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        initialFilters={filters}
        shippedFromOptions={shippedFromOptions}
        shippingOptions={shippingOptions}
        categoryOptions={categoryOptions}
        topOffset={searchRowHeight}
        onReset={() => {
          setFilters({
            shippedFrom: 'All',
            shippingOption: 'All',
            minPrice: '',
            maxPrice: '',
            category: 'All',
          });
          setFiltersOpen(false);
          if (activeQuery) {
            setSearchResults([]);
            setTotalCount(0);
            setLoading(true);
            performSearch(activeQuery, 'All', selectedSort, 1);
          }
        }}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
          // Category affects API results; other filters are client-side.
          if (activeQuery) {
            setSearchResults([]);
            setTotalCount(0);
            setLoading(true);
            performSearch(activeQuery, next.category === 'All' ? 'All' : next.category, selectedSort, 1);
          }
        }}
      />
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
  filterButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  filterTabsWrap: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  filterTabBtn: { paddingVertical: 12, paddingHorizontal: 5, position: 'relative', alignItems: 'center', flex: 1 },
  filterTabInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterTabText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  filterTabTextActive: { color: '#0a61d7' },
  filterUnderlineFull: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#0a61d7' },
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

