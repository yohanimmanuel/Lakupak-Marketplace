import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCartStore } from '../../stores/cartStore';

interface CartBadgeProps {
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export default function CartBadge({ 
  size = 16, 
  color = '#ffffff', 
  backgroundColor = '#EF4444' 
}: CartBadgeProps) {
  const { getItemCount } = useCartStore();
  const itemCount = getItemCount();

  if (itemCount === 0) {
    return null;
  }

  return (
    <View style={[styles.badge, { backgroundColor, minWidth: size, height: size }]}>
      <Text style={[styles.badgeText, { color, fontSize: size * 0.6 }]}>
        {itemCount > 99 ? '99+' : itemCount.toString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    minWidth: 16,
    height: 16,
  },
  badgeText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
