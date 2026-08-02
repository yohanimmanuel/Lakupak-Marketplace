import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { translateProductType } from '../../utils/translateProductType';
import { getCategoryImageSource } from '../../utils/categoryUtils';

interface CategoryBadgeProps {
  name: string;
  icon: string;
  onPress?: () => void;
}

/** Prefer a break after "&" / "," so long taxonomy labels stack tightly in 2 lines. */
export function formatStackedCategoryLabel(label: string): string {
  const text = label.trim().replace(/\s+/g, ' ');
  if (text.length <= 11) return text;

  const amp = text.indexOf(' & ');
  if (amp > 0) {
    return `${text.slice(0, amp + 2)}\n${text.slice(amp + 3)}`;
  }

  const comma = text.indexOf(', ');
  if (comma > 0 && comma < text.length - 3) {
    return `${text.slice(0, comma + 1)}\n${text.slice(comma + 2)}`;
  }

  const mid = Math.floor(text.length / 2);
  let best = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ' ') continue;
    if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
  }
  if (best > 0) return `${text.slice(0, best)}\n${text.slice(best + 1)}`;
  return text;
}

export default function CategoryBadge({ name, icon, onPress }: CategoryBadgeProps) {
  const { i18n } = useTranslation();
  const primaryBlue = '#0a61d7';
  const grayBg = '#f3f4f6';
  const imageSource = getCategoryImageSource(name);
  const label = useMemo(
    () => formatStackedCategoryLabel(translateProductType(name)),
    [name, i18n.language],
  );

  return (
    <TouchableOpacity style={styles.categoryItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.categoryIcon, { backgroundColor: grayBg }]}>
        {imageSource ? (
          <Image source={imageSource} style={styles.categoryImage} resizeMode="contain" />
        ) : (
          <Ionicons
            name={icon as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap}
            size={26}
            color={primaryBlue}
          />
        )}
      </View>
      <Text style={styles.categoryName} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  categoryItem: {
    alignItems: 'center',
    width: 72,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  categoryImage: {
    width: 44,
    height: 44,
  },
  categoryName: {
    width: '100%',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    textAlign: 'center',
    color: '#111827',
  },
});
