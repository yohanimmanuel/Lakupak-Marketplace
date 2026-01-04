import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TopBrand {
  name: string;
}

interface TopBrandsProps {
  brands: TopBrand[];
  onBrandPress: (brandName: string) => void;
}

export default function TopBrands({
  brands,
  onBrandPress,
}: TopBrandsProps) {
  if (brands.length === 0) {
    return null;
  }

  const primaryBlue = '#0a61d7';
  const grayBg = '#f3f4f6';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Top Brands</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.brandsContainer}
        keyboardShouldPersistTaps="handled"
      >
        {brands.map((brand, index) => (
          <TouchableOpacity
            key={index}
            style={styles.brandItem}
            onPress={() => onBrandPress(brand.name)}
          >
            <View style={[styles.brandIcon, { backgroundColor: grayBg }]}>
              <Ionicons 
                name="pricetags" 
                size={28} 
                color={primaryBlue} 
              />
            </View>
            <Text style={styles.brandName}>{brand.name}</Text>
          </TouchableOpacity>
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
  brandsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  brandItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    color: '#111827',
  },
});

