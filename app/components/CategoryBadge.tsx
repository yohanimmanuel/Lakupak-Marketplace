import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { translateProductType } from '../../utils/translateProductType';

interface CategoryBadgeProps {
  name: string;
  icon: string;
  onPress?: () => void;
}

export default function CategoryBadge({ name, icon, onPress }: CategoryBadgeProps) {
  const primaryBlue = '#0a61d7';
  const grayBg = '#f3f4f6';

  return (
    <TouchableOpacity style={styles.categoryItem} onPress={onPress}>
      <View style={[styles.categoryIcon, { backgroundColor: grayBg }]}>
        <Ionicons 
          name={icon as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap} 
          size={28} 
          color={primaryBlue} 
        />
      </View>
      <Text style={styles.categoryName}>
        {translateProductType(name)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  categoryItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    color: '#111827',
  },
});

