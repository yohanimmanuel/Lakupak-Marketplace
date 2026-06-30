import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Clock, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RecentSearchesSkeleton } from '../SkeletonLoader';

interface RecentSearchesProps {
  searches: string[];
  onSearchPress: (query: string) => void;
  onRemoveSearch: (query: string) => void;
  onClearAll: () => void;
  isLoading?: boolean;
}

export default function RecentSearches({
  searches,
  onSearchPress,
  onRemoveSearch,
  onClearAll,
  isLoading = false,
}: RecentSearchesProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('search.recentSearches.title')}</Text>
          <Pressable onPress={onClearAll} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>{t('search.recentSearches.clearAll')}</Text>
          </Pressable>
        </View>
        <View style={styles.searchList}>
          <RecentSearchesSkeleton />
        </View>
      </View>
    );
  }

  if (searches.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('search.recentSearches.title')}</Text>
        <Pressable onPress={onClearAll} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>{t('search.recentSearches.clearAll')}</Text>
        </Pressable>
      </View>

      <View style={styles.searchList}>
        {searches.map((query, index) => (
          <View key={index} style={styles.searchItem}>
            <Pressable
              style={styles.searchItemContent}
              onPress={() => onSearchPress(query)}
            >
              <Clock size={18} color="#6B7280" style={styles.clockIcon} />
              <Text style={styles.searchItemText} numberOfLines={1}>
                {query}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRemoveSearch(query)}
              style={styles.removeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color="#6B7280" />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#0a61d7',
    fontWeight: '500',
  },
  searchList: {
    flex: 1,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockIcon: {
    marginRight: 12,
  },
  searchItemText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

