import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { Search, Clock } from 'lucide-react-native';
import { MarketplaceProduct } from '../../../services/marketplace';
import { API_BASE_URL } from '../../../services/config';
import { useTranslation } from 'react-i18next';
import { translateProductType } from '../../../utils/translateProductType';
import { productTypeMatchesQuery } from '../../../utils/resolveSearchQuery';

interface SearchSuggestionsProps {
  query: string;
  recentSearches: string[];
  products: MarketplaceProduct[];
  onSuggestionPress: (suggestion: string) => void;
}

// Normalize relative image paths to absolute URLs
const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function SearchSuggestions({
  query,
  recentSearches,
  products,
  onSuggestionPress,
}: SearchSuggestionsProps) {
  const { t } = useTranslation();
  const queryLower = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!queryLower) return [];

    const suggestionSet = new Set<string>();
    const suggestionsWithType: Array<{ 
      text: string; 
      type: 'recent' | 'product' | 'brand' | 'category';
      imageUrl?: string;
    }> = [];

    // Add matching recent searches (highest priority)
    recentSearches.forEach(search => {
      if (search.toLowerCase().includes(queryLower) && !suggestionSet.has(search)) {
        suggestionSet.add(search);
        suggestionsWithType.push({ text: search, type: 'recent' });
      }
    });

    // Extract suggestions from products
    products.forEach(product => {
      // Product names
      if (product.name && product.name.toLowerCase().includes(queryLower)) {
        const name = product.name.trim();
        if (!suggestionSet.has(name) && suggestionsWithType.length < 8) {
          suggestionSet.add(name);
          const imageUrl = product.images && product.images.length > 0 
            ? normalizeUrl(product.images[0]) 
            : undefined;
          suggestionsWithType.push({ text: name, type: 'product', imageUrl });
        }
      }

      // Brands
      if (product.brand && product.brand.toLowerCase().includes(queryLower)) {
        const brand = product.brand.trim();
        if (!suggestionSet.has(brand) && suggestionsWithType.length < 8) {
          suggestionSet.add(brand);
          suggestionsWithType.push({ text: brand, type: 'brand' });
        }
      }

      // Categories (match English DB value or localized label, e.g. "Makanan" → Food & Beverage)
      if (product.category) {
        const category = product.category.trim();
        if (productTypeMatchesQuery(category, queryLower) && !suggestionSet.has(category) && suggestionsWithType.length < 8) {
          suggestionSet.add(category);
          suggestionsWithType.push({ text: category, type: 'category' });
        }
      }
    });

    // Limit to 8 suggestions total
    return suggestionsWithType.slice(0, 8);  }, [queryLower, recentSearches, products]);

  if (suggestions.length === 0) {
    return null;
  }

  const renderIconOrImage = (suggestion: { text: string; type: 'recent' | 'product' | 'brand' | 'category'; imageUrl?: string }) => {
    if (suggestion.type === 'product' && suggestion.imageUrl) {
      return (
        <View style={styles.squareContainer}>
          <Image 
            source={{ uri: suggestion.imageUrl }} 
            style={styles.productImage}
            resizeMode="cover"
          />
        </View>
      );
    }

    switch (suggestion.type) {
      case 'recent':
        return (
          <View style={styles.squareContainer}>
            <Clock size={18} color="#6B7280" />
          </View>
        );
      case 'brand':
      case 'category':
      default:
        return (
          <View style={styles.squareContainer}>
            <Search size={18} color="#6B7280" />
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('search.suggestions.title')}</Text>
      <View style={styles.suggestionsList}>
        {suggestions.map((suggestion, index) => (
          <Pressable
            key={`${suggestion.text}-${index}`}
            style={styles.suggestionItem}
            onPress={() => onSuggestionPress(suggestion.text)}
          >
            {renderIconOrImage(suggestion)}
            <Text style={styles.suggestionText} numberOfLines={1}>
              {suggestion.type === 'category' ? translateProductType(suggestion.text) : suggestion.text}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  suggestionsList: {
    gap: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  squareContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: -12,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
});

