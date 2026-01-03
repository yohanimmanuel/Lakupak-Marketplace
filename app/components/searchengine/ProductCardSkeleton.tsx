import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 48) / 2; // 2 columns with padding

export default function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Image Container */}
      <View style={styles.imageContainer}>
        <View style={styles.imageSkeleton} />
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        {/* Product Name */}
        <View style={styles.titleRow}>
          <View style={styles.titleSkeleton1} />
          <View style={styles.titleSkeleton2} />
        </View>

        {/* Rating */}
        <View style={styles.ratingContainer}>
          <View style={styles.ratingSkeleton} />
          <View style={styles.ratingTextSkeleton} />
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          <View style={styles.priceSkeleton} />
        </View>

        {/* Sales Info */}
        <View style={styles.salesSkeleton} />

        {/* Stock Status */}
        <View style={styles.stockSkeleton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    height: 140,
    backgroundColor: '#F9FAFB',
  },
  imageSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  productInfo: {
    padding: 8,
  },
  titleRow: {
    marginBottom: 4,
  },
  titleSkeleton1: {
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 4,
    width: '90%',
  },
  titleSkeleton2: {
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    width: '60%',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingSkeleton: {
    width: 60,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  ratingTextSkeleton: {
    width: 20,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  priceContainer: {
    marginBottom: 2,
  },
  priceSkeleton: {
    width: 80,
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  salesSkeleton: {
    width: 50,
    height: 11,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 2,
  },
  stockSkeleton: {
    width: 60,
    height: 11,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
});

