import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'

interface SkeletonLoaderProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: any
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    )
    animation.start()

    return () => animation.stop()
  }, [animatedValue])

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#f3f4f6', '#e5e7eb'],
  })

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  )
}

export const ProductSkeleton = () => (
  <View style={styles.productSkeleton}>
    <SkeletonLoader width="100%" height={120} borderRadius={8} />
    <View style={styles.productSkeletonContent}>
      <SkeletonLoader width="80%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="60%" height={14} style={{ marginBottom: 4 }} />
      <SkeletonLoader width="40%" height={14} />
    </View>
  </View>
)

export const UserInfoSkeleton = () => (
  <View style={styles.userSkeleton}>
    <SkeletonLoader width={60} height={60} borderRadius={30} />
    <View style={styles.userSkeletonContent}>
      <SkeletonLoader width={120} height={18} style={{ marginBottom: 8 }} />
      <SkeletonLoader width={80} height={14} />
    </View>
  </View>
)

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#f3f4f6',
  },
  productSkeleton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productSkeletonContent: {
    marginTop: 12,
  },
  userSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
  },
  userSkeletonContent: {
    marginLeft: 12,
    flex: 1,
  },
})
