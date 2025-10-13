import React from 'react';
import { View, StyleSheet } from 'react-native';

export const SkeletonLoader = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[styles.container, style]}>
    {children}
  </View>
);

export const ProductSkeleton = () => (
  <View style={styles.productSkeleton}>
    <View style={styles.imageSkeleton} />
    <View style={styles.contentSkeleton}>
      <View style={styles.titleSkeleton} />
      <View style={styles.priceSkeleton} />
    </View>
  </View>
);

export const UserInfoSkeleton = () => (
  <View style={styles.userSkeleton}>
    <View style={styles.avatarSkeleton} />
    <View style={styles.userInfoSkeleton}>
      <View style={styles.nameSkeleton} />
      <View style={styles.emailSkeleton} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
  },
  productSkeleton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imageSkeleton: {
    width: '100%',
    height: 120,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    marginBottom: 8,
  },
  contentSkeleton: {
    paddingHorizontal: 4,
  },
  titleSkeleton: {
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 6,
  },
  priceSkeleton: {
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    width: '60%',
  },
  userSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  avatarSkeleton: {
    width: 40,
    height: 40,
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
    marginRight: 12,
  },
  userInfoSkeleton: {
    flex: 1,
  },
  nameSkeleton: {
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 4,
    width: '70%',
  },
  emailSkeleton: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    width: '50%',
  },
});

// Default export for Expo Router
export default function SkeletonLoaderComponent() {
  return null;
}
