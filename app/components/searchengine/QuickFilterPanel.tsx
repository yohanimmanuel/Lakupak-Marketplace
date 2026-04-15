import React, { useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SearchFilters, ShippingOptionKey } from './SearchFilterSheet';

export type QuickFilterSection = 'shippingOption' | 'salesChannel' | 'rating' | 'price' | 'category';

type Props = {
  visible: boolean;
  section: QuickFilterSection;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onClose: () => void;
  shippingOptions: Array<{ key: ShippingOptionKey; label: string }>;
  salesChannelOptions: string[];
  categoryOptions: string[];
  topOffset: number; // header height (so panel starts below it)
};

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.chipCell}>
      <Pressable
        onPress={onPress}
        style={[styles.chip, selected ? styles.chipSelected : null]}
        accessibilityRole="button"
      >
        <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export default function QuickFilterPanel({
  visible,
  section,
  filters,
  onChange,
  onClose,
  shippingOptions,
  salesChannelOptions,
  categoryOptions,
  topOffset,
}: Props) {
  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);

  React.useEffect(() => {
    if (!visible) return;
    setMinPrice(filters.minPrice);
    setMaxPrice(filters.maxPrice);
  }, [filters.minPrice, filters.maxPrice, section, visible]);

  const { height: screenHeight } = Dimensions.get('window');
  const availableHeight = Math.max(0, screenHeight - Math.max(0, topOffset));
  const maxPanelHeight = Math.min(availableHeight, 320);

  const translateAnim = React.useRef(new Animated.Value(-10)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const openedAtRef = React.useRef(0);

  React.useEffect(() => {
    if (!visible) return;
    openedAtRef.current = Date.now();
    translateAnim.setValue(-10);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacityAnim, translateAnim]);

  const handleOverlayPress = () => {
    if (Date.now() - openedAtRef.current < 250) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={[styles.overlay, { top: topOffset }]} onPress={handleOverlayPress} />
        <Animated.View
          style={[
            styles.panel,
            {
              top: topOffset,
              maxHeight: maxPanelHeight,
              opacity: opacityAnim,
              transform: [{ translateY: translateAnim }],
            },
          ]}
        >
          {section === 'price' ? (
            <View style={styles.priceBody}>
          <View style={styles.priceRow}>
            <View style={styles.priceInputWrap}>
              <Text style={styles.priceLabel}>Min</Text>
              <TextInput
                value={minPrice}
                onChangeText={(t) => {
                  const v = t.replace(/[^\d]/g, '');
                  setMinPrice(v);
                  onChange({ ...filters, minPrice: v, maxPrice });
                }}
                placeholder="0"
                keyboardType="number-pad"
                style={styles.priceInput}
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.priceInputWrap}>
              <Text style={styles.priceLabel}>Max</Text>
              <TextInput
                value={maxPrice}
                onChangeText={(t) => {
                  const v = t.replace(/[^\d]/g, '');
                  setMaxPrice(v);
                  onChange({ ...filters, minPrice, maxPrice: v });
                }}
                placeholder="∞"
                keyboardType="number-pad"
                style={styles.priceInput}
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </View>
          ) : (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyInner}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.grid}>
                {section === 'shippingOption'
                  ? shippingOptions.map((opt) => (
                      <Chip
                        key={opt.key}
                        label={opt.label}
                        selected={filters.shippingOption.includes(opt.key)}
                        onPress={() => {
                          const next = new Set(filters.shippingOption);
                          if (next.has(opt.key)) next.delete(opt.key);
                          else next.add(opt.key);
                          onChange({ ...filters, shippingOption: Array.from(next) });
                        }}
                      />
                    ))
                  : section === 'salesChannel'
                    ? salesChannelOptions.map((opt) => (
                        <Chip
                          key={opt}
                          label={opt}
                          selected={filters.salesChannel.includes(opt)}
                          onPress={() => {
                            const next = new Set(filters.salesChannel);
                            if (next.has(opt)) next.delete(opt);
                            else next.add(opt);
                            onChange({ ...filters, salesChannel: Array.from(next) });
                          }}
                        />
                      ))
                    : section === 'rating'
                      ? [0, 1, 2, 3, 4, 5].map((n) => (
                          <Chip
                            key={n}
                            label={`${n}+`}
                            selected={filters.ratingMin === n}
                            onPress={() => onChange({ ...filters, ratingMin: filters.ratingMin === n ? null : n })}
                          />
                        ))
                      : categoryOptions.map((opt) => (
                          <Chip
                            key={opt}
                            label={opt}
                            selected={filters.category.includes(opt)}
                            onPress={() => {
                              const next = new Set(filters.category);
                              if (next.has(opt)) next.delete(opt);
                              else next.add(opt);
                              onChange({ ...filters, category: Array.from(next) });
                            }}
                          />
                        ))}
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    overflow: 'hidden',
  },
  body: { maxHeight: 320 },
  bodyInner: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  chipCell: { width: '48%' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  chipSelected: { backgroundColor: '#e8f0ff', borderColor: '#0a61d7' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '700' },
  chipTextSelected: { color: '#0a61d7' },
  priceBody: { paddingHorizontal: 16, paddingVertical: 12 },
  priceRow: { flexDirection: 'row', gap: 10 },
  priceInputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  priceLabel: { fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: '700' },
  priceInput: { fontSize: 14, color: '#111827', paddingVertical: 0 },
});

