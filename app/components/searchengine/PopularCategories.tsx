import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { DynamicCategory } from '../../../utils/categoryUtils';
import CategoryBadge from '../CategoryBadge';

interface PopularCategoriesProps {
  categories: DynamicCategory[];
  onCategoryPress: (categoryName: string) => void;
}

export default function PopularCategories({
  categories,
  onCategoryPress,
}: PopularCategoriesProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Popular Categories</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((category, index) => (
          <CategoryBadge
            key={index}
            name={category.name}
            icon={category.icon}
            onPress={() => onCategoryPress(category.name)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
});

