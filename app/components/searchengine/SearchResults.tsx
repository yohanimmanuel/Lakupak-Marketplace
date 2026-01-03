import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import ProductGrid from '../productcatalog/ProductGrid';
import ProductCardSkeleton from './ProductCardSkeleton';
import { Product } from '../../../data/sampleProducts';

interface SearchResultsProps {
  query: string;
  products: Product[];
  totalCount: number;
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  onProductPress: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  favorites: string[];
  onRefresh: () => Promise<void>;
  onLoadMore: () => void;
  onCategoryFilter: (category: string) => void;
  onSortChange: (sortBy: string) => void;
  selectedCategory: string;
  selectedSort: string;
  availableCategories: string[];
}

type SortOption = {
  value: string;
  label: string;
};

const sortOptions: SortOption[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
];

export default function SearchResults({
  query,
  products,
  totalCount,
  loading,
  refreshing,
  hasMore,
  onProductPress,
  onAddToCart,
  onToggleFavorite,
  favorites,
  onRefresh,
  onLoadMore,
  onCategoryFilter,
  onSortChange,
  selectedCategory,
  selectedSort,
  availableCategories,
}: SearchResultsProps) {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  const selectedSortLabel =
    sortOptions.find(opt => opt.value === selectedSort)?.label || 'Relevance';

  return (
    <View style={styles.container}>
      {/* Results Header */}
      <View style={styles.header}>
        <Text style={styles.resultCount}>
          {totalCount} {totalCount === 1 ? 'result' : 'results'} for "{query}"
        </Text>
      </View>

      {/* Filter and Sort Controls */}
      <View style={styles.controls}>
        {/* Category Filter */}
        <Pressable
          style={styles.filterButton}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {selectedCategory === 'All' ? 'Category' : selectedCategory}
          </Text>
          <ChevronDown size={18} color="#111827" />
        </Pressable>

        {/* Sort Options */}
        <Pressable
          style={styles.filterButton}
          onPress={() => setShowSortModal(true)}
        >
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {selectedSortLabel}
          </Text>
          <ChevronDown size={18} color="#111827" />
        </Pressable>
      </View>

      {/* Product Grid */}
      <View style={styles.productsSection}>
        {loading ? (
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonRow}>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </View>
            <View style={styles.skeletonRow}>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </View>
            <View style={styles.skeletonRow}>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </View>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search or filters
            </Text>
          </View>
        ) : (
          <ProductGrid
            products={products}
            onProductPress={onProductPress}
            onAddToCart={onAddToCart}
            onToggleFavorite={onToggleFavorite}
            favorites={favorites}
            onRefresh={onRefresh}
            onLoadMore={onLoadMore}
            loading={loading}
            refreshing={refreshing}
            hasMore={hasMore}
            emptyMessage="No products found"
                backgroundColor="#f9fafb"
          />
        )}
      </View>

      {/* Category Filter Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
            </View>
            <ScrollView style={styles.modalList}>
              <Pressable
                style={[
                  styles.modalOption,
                  selectedCategory === 'All' && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  onCategoryFilter('All');
                  setShowCategoryModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedCategory === 'All' && styles.modalOptionTextSelected,
                  ]}
                >
                  All Categories
                </Text>
              </Pressable>
              {availableCategories.map((category, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.modalOption,
                    selectedCategory === category && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onCategoryFilter(category);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedCategory === category &&
                        styles.modalOptionTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort by</Text>
            </View>
            <ScrollView style={styles.modalList}>
              {sortOptions.map((option, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.modalOption,
                    selectedSort === option.value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onSortChange(option.value);
                    setShowSortModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedSort === option.value &&
                        styles.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    marginRight: 4,
  },
  productsSection: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalList: {
    maxHeight: 400,
  },
  modalOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#111827',
  },
  modalOptionTextSelected: {
    color: '#0a61d7',
    fontWeight: '600',
  },
});

