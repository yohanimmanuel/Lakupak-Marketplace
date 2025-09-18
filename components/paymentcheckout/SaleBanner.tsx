import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Removed theme color imports - using explicit colors

const { width: screenWidth } = Dimensions.get('window');

interface SaleBannerProps {
  title?: string;
  subtitle?: string;
  discountText?: string;
  endDate?: string;
  onPress?: () => void;
  backgroundColor?: string;
  textColor?: string;
}

export default function SaleBanner({
  title = "🎉 MEGA SALE 2025",
  subtitle = "Up to 90% OFF Everything!",
  discountText = "Flash Sale Ends Soon",
  endDate = "Sale ends in 2 days",
  onPress,
  backgroundColor = '#0a61d7',
  textColor = '#FFFFFF',
}: SaleBannerProps) {
  // Using explicit colors instead of theme colors

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* Background Pattern */}
      <View style={styles.backgroundPattern}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Text style={[styles.title, { color: textColor }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            {subtitle}
          </Text>
          <View style={styles.discountContainer}>
            <View style={styles.discountBadge}>
              <Ionicons name="flash" size={16} color={backgroundColor} />
              <Text style={[styles.discountText, { color: backgroundColor }]}>
                {discountText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rightSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="gift" size={32} color={textColor} />
          </View>
          <Text style={[styles.endDate, { color: textColor }]}>
            {endDate}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 50,
  },
  circle1: {
    width: 80,
    height: 80,
    top: -20,
    right: -20,
  },
  circle2: {
    width: 60,
    height: 60,
    bottom: -15,
    left: -15,
  },
  circle3: {
    width: 40,
    height: 40,
    top: 20,
    right: 60,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    minHeight: 100,
  },
  leftSection: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.9,
  },
  discountContainer: {
    marginTop: 4,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  endDate: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.9,
  },
});
