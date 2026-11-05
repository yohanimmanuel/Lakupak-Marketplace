import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Filter, ChevronDown } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { useCartStore } from '../stores/cartStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { marketplaceService, MarketplaceProduct } from '../services/marketplace';
import { searchHistoryService } from '../services/searchHistory';
import {
  canonicalizeCategory,
  buildCategoryDirectory,
  generateTopBrands,
  generateTopDistributors,
  PREDEFINED_CATEGORY_NAMES,
} from '../utils/categoryUtils';
import RecentSearches from './components/searchengine/RecentSearches';
import PopularCategories from './components/searchengine/PopularCategories';
import TopBrands from './components/searchengine/TopBrands';
import TopDistributors from './components/searchengine/TopDistributors';
import SearchResults from './components/searchengine/SearchResults';
import SearchInputBar, { type SearchInputBarHandle } from './components/searchengine/SearchInputBar';
import SearchSuggestions from './components/searchengine/SearchSuggestions';
import SearchFilterSheet, { type SearchFilters, type ShippingOptionKey } from './components/searchengine/SearchFilterSheet';
import QuickFilterPanel, { type QuickFilterSection } from './components/searchengine/QuickFilterPanel';
import { Product } from '../data/sampleProducts';
import { useTranslation } from 'react-i18next';
import { translateProductType } from '../utils/translateProductType';
import {
  productTypeMatchesQuery,
  resolveSearchQuery,
  resolveProductTypeKey,
} from '../utils/resolveSearchQuery';

/** Higher = better match. Weak matches stay included but sink to the bottom. */
function computeRelevanceScore(query: string, p: MarketplaceProduct): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = String(p.name ?? '').toLowerCase();
  const desc = String(p.description ?? '').toLowerCase();
  const brand = String(p.brand ?? '').toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  let score = 0;
  if (name.includes(q)) {
    score += 220;
  } else if (tokens.length > 0 && tokens.every((t) => name.includes(t))) {
    score += 180;
  } else if (tokens.length > 0) {
    const hits = tokens.filter((t) => name.includes(t)).length;
    score += hits * 40;
  }
  if (brand && tokens.some((t) => t.length >= 2 && brand.includes(t))) score += 45;
  if (productTypeMatchesQuery(p.category, q)) score += 55;
  const descHits = tokens.filter((t) => t.length >= 3 && desc.includes(t)).length;
  score += descHits * 10;
  if (score < 30 && desc.includes(q)) score += 22;
  return score;
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
    () => buildCategoryDirectory(allProducts),
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

  // composeQuery drives suggestions UI; input text lives inside SearchInputBar only.
  const [composeQuery, setComposeQuery] = useState('');
  const [inputSeed, setInputSeed] = useState('');
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
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  
  // Filter state
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSort, setSelectedSort] = useState('relevance');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersSection, setFiltersSection] = useState<import('./components/searchengine/SearchFilterSheet').SearchFilterSection>('all');
  const [quickFilterSection, setQuickFilterSection] = useState<QuickFilterSection | null>(null);
  // Used to anchor dropdowns/sheets under specific header rows.
  const [searchBarOffset, setSearchBarOffset] = useState(insets.top + 12);
  const [headerOffset, setHeaderOffset] = useState(insets.top + 12);
  const [filters, setFilters] = useState<SearchFilters>({
    shippedFrom: [],
    shippingOption: [],
    salesChannel: [],
    ratingMin: null,
    minPrice: '',
    maxPrice: '',
    category: [],
  });
  
  // Available locations for shipped-from filter (from current result set)
  const shippedFromOptions = useMemo(() => {
    const locations = Array.from(
      new Set(
        searchResults
          .map((p) => (p.shippingInfo?.location || '').trim())
          .filter(Boolean)
      )
    );
    locations.sort((a, b) => a.localeCompare(b));
    return locations;
  }, [searchResults]);

  const shippingOptions = useMemo(() => {
    const avail = {
      selfPickup: searchResults.some((p) => !!p.shipping?.selfPickup?.available),
      sellerDelivery: searchResults.some((p) => !!p.shipping?.sellerDelivery?.available),
      buyerCourier: searchResults.some((p) => !!p.shipping?.buyerCourier?.available),
    };

    const out: Array<{ key: ShippingOptionKey; label: string }> = [];
    if (avail.selfPickup) out.push({ key: 'selfPickup', label: t('search.shippingOption.selfPickup') });
    if (avail.sellerDelivery) out.push({ key: 'sellerDelivery', label: t('search.shippingOption.sellerDelivery') });
    if (avail.buyerCourier) out.push({ key: 'buyerCourier', label: t('search.shippingOption.buyerCourier') });
    return out;
  }, [searchResults, t]);

  const categoryOptions = useMemo(() => PREDEFINED_CATEGORY_NAMES, []);

  const filteredResults = useMemo(() => {
    const shippedFrom = filters.shippedFrom;
    const shipOpt = filters.shippingOption;
    const salesChannel = filters.salesChannel;
    const cat = filters.category;
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    const ratingMin = typeof filters.ratingMin === 'number' ? filters.ratingMin : null;

    return searchResults.filter((p) => {
      if (Array.isArray(cat) && cat.length > 0) {
        const selected = new Set(cat.map((c) => canonicalizeCategory(c)).filter(Boolean));
        const productType = canonicalizeCategory(p.category);
        if (!productType || !selected.has(productType)) return false;
      }
      if (Array.isArray(shippedFrom) && shippedFrom.length > 0) {
        const loc = (p.shippingInfo?.location || '').trim();
        if (!shippedFrom.includes(loc)) return false;
      }
      if (Array.isArray(shipOpt) && shipOpt.length > 0) {
        const anyAvailable = shipOpt.some((key) => !!p.shipping?.[key]?.available);
        if (!anyAvailable) return false;
      }
      if (Array.isArray(salesChannel) && salesChannel.length > 0) {
        const ch = String((p as unknown as { salesChannel?: string }).salesChannel || '').trim();
        if (!ch) return false;
        const matchesChannel =
          salesChannel.includes(ch) ||
          (ch === 'Both' &&
            (salesChannel.includes('Retail') || salesChannel.includes('Wholesale')));
        if (!matchesChannel) return false;
      }
      if (min !== null && Number.isFinite(min) && p.sellingPrice < min) return false;
      if (max !== null && Number.isFinite(max) && p.sellingPrice > max) return false;
      if (ratingMin !== null) {
        const shopRating = Number(
          (p as unknown as { seller?: { rating?: unknown } })?.seller?.rating ?? 0,
        );
        if (!Number.isFinite(shopRating) || shopRating < ratingMin) return false;
      }
      return true;
    });
  }, [searchResults, filters]);

  /** Relevance first (strong matches on top); other sorts keep API/client order from performSearch. */
  const displayedResults = useMemo(() => {
    if (selectedSort !== 'relevance' || !activeQuery.trim()) {
      return filteredResults;
    }
    const q = activeQuery.trim();
    const ranked = filteredResults.map((p) => ({
      p,
      s: computeRelevanceScore(q, p as MarketplaceProduct),
    }));
    ranked.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      return String(a.p.name ?? '').localeCompare(String(b.p.name ?? ''));
    });
    return ranked.map((x) => x.p);
  }, [filteredResults, selectedSort, activeQuery]);

  // Debounce timer
  const searchInputRef = useRef<SearchInputBarHandle>(null);
  const didBootstrapFromRouteRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const lastDidYouMeanAppliedFromQueryRef = useRef<string>('');

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

  const appendOrderId =
    typeof params.appendOrderId === 'string' ? params.appendOrderId.trim() : '';

  useEffect(() => {
    const cart = useCartStore.getState();
    if (appendOrderId) cart.beginEditOrder(appendOrderId);
    else cart.endEditOrder();
  }, [appendOrderId]);

  const openSearchPage = useCallback(
    (next: { q?: string; category?: string }) => {
      const q = next.q?.trim();
      if (!q && !next.category) return;

      Keyboard.dismiss();
      searchRequestIdRef.current += 1;

      router.push({
        pathname: '/search',
        params: {
          q: q || undefined,
          category: next.category && next.category !== 'All' ? next.category : undefined,
          ...(appendOrderId ? { appendOrderId } : {}),
        },
      });
    },
    [router, appendOrderId],
  );

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
      setDidYouMean(null);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    const { displayQuery, apiQuery, category: resolvedCategory } = resolveSearchQuery(query);
    const effectiveCategory =
      category !== 'All'
        ? (resolveProductTypeKey(category) ?? category)
        : resolvedCategory;

    try {
      if (page === 1) {
        setLoading(true);
      }

      const result = await marketplaceService.getProducts({
        search: apiQuery.trim() || undefined,
        category: effectiveCategory && effectiveCategory !== 'All' ? effectiveCategory : undefined,
        page,
        limit: 50,
        token: token || undefined,
      });

      // Drop stale responses from an older committed search.
      if (requestId !== searchRequestIdRef.current) return;
      // Filter results by company/distributor name if query matches a distributor name
      let filteredProducts = result.products;
      const queryLower = displayQuery.toLowerCase();
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
      if (!append && !matchingDistributor) {
        const suggestion = typeof result.didYouMean === 'string' ? result.didYouMean.trim() : '';
        const prevQ = String(lastDidYouMeanAppliedFromQueryRef.current || '').trim().toLowerCase();
        const curQ = displayQuery.toLowerCase();
        const sugQ = suggestion.trim().toLowerCase();
        // Suppress "reverse" suggestions (after applying didYouMean, don't suggest the original typo back).
        if (suggestion && sugQ !== curQ && (!prevQ || sugQ !== prevQ)) {
          setDidYouMean(suggestion);
        } else {
          setDidYouMean(null);
        }
      }
      setCurrentPage(page);
      setHasMore(matchingDistributor ? false : page < result.pagination.totalPages);
      setActiveQuery(displayQuery);

      // Save to recent searches (only on first page)
      if (page === 1 && userId) {
        await searchHistoryService.addRecentSearch(userId, displayQuery, token || undefined);
        await loadRecentSearches();
      }

      if (effectiveCategory) {
        setSelectedCategory(effectiveCategory);
      } else if (page === 1) {
        setSelectedCategory('All');
      }
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults([]);
      setTotalCount(0);
      setDidYouMean(null);
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedCategory, selectedSort, token, userId, loadRecentSearches, topDistributors, allProducts]);

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
  }, [userId]); // Only depend on userId - loadRecentSearches is stable and depends on userId/token

  // Seed this screen once from route params (new router.push entry). Never re-sync params → input while typing.
  useEffect(() => {
    if (didBootstrapFromRouteRef.current) return;
    didBootstrapFromRouteRef.current = true;

    const paramQ = typeof params.q === 'string' ? params.q.trim() : '';
    const paramCat = typeof params.category === 'string' ? params.category.trim() : '';
    if (!paramQ && !paramCat) return;

    if (paramCat) {
      const categoryKey = resolveProductTypeKey(paramCat) ?? paramCat;
      setSelectedCategory(categoryKey);
      setFilters((p) => ({ ...p, category: [categoryKey] }));
      const displayQ = paramQ || translateProductType(categoryKey);
      setInputSeed(displayQ);
      setComposeQuery(displayQ);
      setActiveQuery(displayQ);
      void performSearch(displayQ, categoryKey, 'relevance', 1);
      return;
    }

    setInputSeed(paramQ);
    setComposeQuery(paramQ);
    setActiveQuery(paramQ);
    void performSearch(paramQ, 'All', 'relevance', 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap for this stack entry
  }, []);


  const handleSearchFocus = useCallback(() => {
    searchRequestIdRef.current += 1;

    if (activeQuery || searchResults.length > 0) {
      setActiveQuery('');
      setSearchResults([]);
      setTotalCount(0);
      setDidYouMean(null);
      setLoading(false);
    }
  }, [activeQuery, searchResults.length]);

  const handleComposeChange = useCallback((text: string) => {
    setComposeQuery(text);

    if (!text.trim()) {
      setSearchResults([]);
      setTotalCount(0);
      setActiveQuery('');
      setLoading(false);
    } else if (activeQuery) {
      setActiveQuery('');
      setSearchResults([]);
      setTotalCount(0);
      setLoading(false);
    }
  }, [activeQuery]);

  const handleSearchSubmit = useCallback((text: string) => {
    const q = text.trim();
    if (!q) return;

    setSelectedCategory('All');
    openSearchPage({ q });
  }, [openSearchPage]);

  const handleSuggestionPress = (suggestion: string) => {
    const categoryKey = resolveProductTypeKey(suggestion);
    if (categoryKey) {
      openSearchPage({ q: translateProductType(categoryKey), category: categoryKey });
      return;
    }
    openSearchPage({ q: suggestion });
  };

  const handleRecentSearchPress = (query: string) => {
    openSearchPage({ q: query });
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
    const categoryKey = resolveProductTypeKey(categoryName) ?? categoryName;
    openSearchPage({
      q: translateProductType(categoryKey),
      category: categoryKey,
    });
  };

  const handleDistributorPress = (distributorName: string) => {
    openSearchPage({ q: distributorName });
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
        params: {
          productId: product.id,
          ...(appendOrderId ? { appendOrderId } : {}),
        },
      });
    },
    [router, appendOrderId]
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

  const showInitialState = !composeQuery.trim() && !activeQuery && searchResults.length === 0 && !loading;
  const showSuggestions = composeQuery.trim() && !activeQuery && searchResults.length === 0 && !loading;
  const showResults = activeQuery || searchResults.length > 0 || loading;
  const isPrice = selectedSort === 'price_low' || selectedSort === 'price_high';
  const priceAsc = selectedSort !== 'price_high';

  const quickFilterLabel = useMemo(() => {
    const ship = filters.shippingOption?.length
      ? t('search.chips.optionCount', { count: filters.shippingOption.length })
      : t('search.chips.shippingOption');
    const ch = filters.salesChannel?.length
      ? filters.salesChannel
          .map((x) =>
            x === 'Retail'
              ? t('search.salesChannel.retail')
              : x === 'Wholesale'
                ? t('search.salesChannel.wholesale')
                : x
          )
          .join(', ')
      : t('search.chips.salesChannel');
    const rating =
      typeof filters.ratingMin === 'number'
        ? `${t('search.chips.rating')} ${filters.ratingMin}+`
        : t('search.chips.rating');
    const price =
      filters.minPrice || filters.maxPrice
        ? `${t('search.filterSheet.price.min')} ${filters.minPrice || ''} - ${t('search.filterSheet.price.max')} ${filters.maxPrice || ''}`.trim()
        : t('search.chips.priceRange');
    const cat = filters.category?.length
      ? filters.category.length === 1
        ? translateProductType(filters.category[0])
        : `${t('search.chips.category')} (${filters.category.length})`
      : t('search.chips.category');
    return { ship, ch, rating, price, cat };
  }, [filters, t]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[styles.headerContainer, { paddingTop: insets.top }]}
        onLayout={(e) => setHeaderOffset(e.nativeEvent.layout.height)}
      >
        <View
          style={styles.header}
          onLayout={(e) => setSearchBarOffset(e.nativeEvent.layout.height + insets.top)}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#0a61d7" size={24} />
          </Pressable>

          <SearchInputBar
            ref={searchInputRef}
            seedText={inputSeed}
            placeholder={t('search.placeholder')}
            onChangeText={handleComposeChange}
            onFocus={handleSearchFocus}
            onSubmit={handleSearchSubmit}
          />

          {showResults ? (
            <Pressable
              onPress={() => {
                setFiltersSection('all');
                setQuickFilterSection(null);
                setFiltersOpen((v) => !v);
              }}
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
                <Text style={[styles.filterTabText, selectedSort === 'relevance' && styles.filterTabTextActive]}>
                  {t('search.sort.relevance')}
                </Text>
                {selectedSort === 'relevance' ? <View style={styles.filterUnderlineFull} /> : null}
              </Pressable>
              <Pressable onPress={() => handleSortChange('newest')} style={styles.filterTabBtn} accessibilityRole="button">
                <Text style={[styles.filterTabText, selectedSort === 'newest' && styles.filterTabTextActive]}>
                  {t('search.sort.latest')}
                </Text>
                {selectedSort === 'newest' ? <View style={styles.filterUnderlineFull} /> : null}
              </Pressable>
              <Pressable onPress={() => handleSortChange('top_sales')} style={styles.filterTabBtn} accessibilityRole="button">
                <Text style={[styles.filterTabText, selectedSort === 'top_sales' && styles.filterTabTextActive]}>
                  {t('search.sort.topSales')}
                </Text>
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
                  <Text style={[styles.filterTabText, isPrice && styles.filterTabTextActive]}>
                    {t('search.sort.price')}
                  </Text>
                  <ChevronDown
                    size={14}
                    color={isPrice ? '#0a61d7' : '#6b7280'}
                    style={{ transform: [{ rotate: isPrice && !priceAsc ? '180deg' : '0deg' }] }}
                  />
                </View>
                {isPrice ? <View style={styles.filterUnderlineFull} /> : null}
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickFiltersRow}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                onPress={() => {
                  setQuickFilterSection((prev) => (prev === 'salesChannel' ? null : 'salesChannel'));
                }}
                style={styles.quickFilterChip}
              >
                <Text style={styles.quickFilterText}>{quickFilterLabel.ch}</Text>
                <ChevronDown size={14} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setQuickFilterSection((prev) => (prev === 'shippingOption' ? null : 'shippingOption'));
                }}
                style={styles.quickFilterChip}
              >
                <Text style={styles.quickFilterText}>{quickFilterLabel.ship}</Text>
                <ChevronDown size={14} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setQuickFilterSection((prev) => (prev === 'rating' ? null : 'rating'));
                }}
                style={styles.quickFilterChip}
              >
                <Text style={styles.quickFilterText}>{quickFilterLabel.rating}</Text>
                <ChevronDown size={14} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setQuickFilterSection((prev) => (prev === 'price' ? null : 'price'));
                }}
                style={styles.quickFilterChip}
              >
                <Text style={styles.quickFilterText}>{quickFilterLabel.price}</Text>
                <ChevronDown size={14} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setQuickFilterSection((prev) => (prev === 'category' ? null : 'category'));
                }}
                style={styles.quickFilterChip}
              >
                <Text style={styles.quickFilterText}>{quickFilterLabel.cat}</Text>
                <ChevronDown size={14} color="#6b7280" />
              </Pressable>
            </ScrollView>
          </View>
        ) : null}
      </View>

      <QuickFilterPanel
        visible={!!quickFilterSection}
        section={quickFilterSection ?? 'shippingOption'}
        filters={filters}
        onChange={(next) => setFilters(next)}
        onClose={() => setQuickFilterSection(null)}
        shippingOptions={shippingOptions}
        salesChannelOptions={['Retail', 'Wholesale']}
        categoryOptions={categoryOptions}
        topOffset={headerOffset}
      />

      {/* Content. The search field sits above this list, so the list must not
          stay shrunk after the keyboard closes. */}
      <View style={styles.keyboardAvoidingView}>
        {appendOrderId ? (
          <Text style={styles.appendBanner}>
            {t('ordersFlow.orderDetails.sections2.addingToOrder', { orderId: appendOrderId })}
          </Text>
        ) : null}
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
            query={composeQuery}
            recentSearches={recentSearches}
            products={allProducts}
            onSuggestionPress={handleSuggestionPress}
          />
        </ScrollView>
      ) : showResults ? (
        <SearchResults
          query={activeQuery}
          products={displayedResults}
          loading={loading}
          refreshing={refreshing}
          hasMore={hasMore}
          didYouMean={didYouMean}
          onDidYouMeanPress={(suggestion) => {
            const nextQ = suggestion.trim();
            if (!nextQ) return;
            lastDidYouMeanAppliedFromQueryRef.current = (activeQuery || composeQuery || '').trim();
            openSearchPage({
              q: nextQ,
              category: selectedCategory && selectedCategory !== 'All' ? selectedCategory : undefined,
            });
          }}
          onProductPress={handleProductPress}
          onAddToCart={handleAddToCart}
          onToggleFavorite={handleToggleFavorite}
          favorites={likedProducts}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
        />
      ) : null}
      </View>

      <SearchFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        initialFilters={filters}
        shippedFromOptions={shippedFromOptions}
        shippingOptions={shippingOptions}
        salesChannelOptions={['Retail', 'Wholesale']}
        categoryOptions={categoryOptions}
        topOffset={searchBarOffset}
        section={filtersSection}
        onReset={() => {
          setFilters({
            shippedFrom: [],
            shippingOption: [],
            salesChannel: [],
            ratingMin: null,
            minPrice: '',
            maxPrice: '',
            category: [],
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
          // All filters are client-side now; no need to re-run the API search.
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
  appendBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#0a61d7',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
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
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  filterTabBtn: { paddingVertical: 12, paddingHorizontal: 5, position: 'relative', alignItems: 'center', flex: 1 },
  filterTabInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterTabText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  filterTabTextActive: { color: '#0a61d7' },
  filterUnderlineFull: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#0a61d7' },
  quickFiltersRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});

