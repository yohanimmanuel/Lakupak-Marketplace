import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// no header actions; close via outside press / filter icon toggle

export type ShippingOptionKey = 'selfPickup' | 'sellerDelivery' | 'buyerCourier';

export type SearchFilters = {
  shippedFrom: string; // 'All' or location label
  shippingOption: ShippingOptionKey | 'All';
  minPrice: string; // numeric string
  maxPrice: string; // numeric string
  category: string; // 'All' or category label
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  onReset: () => void;
  initialFilters: SearchFilters;
  shippedFromOptions: string[]; // include 'All'
  shippingOptions: Array<{ key: ShippingOptionKey; label: string }>;
  categoryOptions: string[]; // include 'All'
  topOffset: number; // pixels from top (height of search header)
};

const { height: screenHeight } = Dimensions.get('window');

export default function SearchFilterSheet({
  visible,
  onClose,
  onApply,
  onReset,
  initialFilters,
  shippedFromOptions,
  shippingOptions,
  categoryOptions,
  topOffset,
}: Props) {
  const OPEN_MS = 90;
  const CLOSE_MS = 90;
  const [local, setLocal] = useState<SearchFilters>(initialFilters);
  const [closing, setClosing] = useState(false);
  const availableHeight = Math.max(0, screenHeight - Math.max(0, topOffset));
  const [measuredContentHeight, setMeasuredContentHeight] = useState(0);
  const [measuredFooterHeight, setMeasuredFooterHeight] = useState(0);
  const sheetHeight = Math.min(
    availableHeight,
    Math.max(0, measuredContentHeight + measuredFooterHeight),
  );
  // Animate height from 0 -> sheetHeight so it "drops down" under the search bar.
  const heightAnim = useRef(new Animated.Value(0)).current;
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setLocal(initialFilters);
  }, [visible, initialFilters]);

  useEffect(() => {
    if (!visible) return;
    setClosing(false);
    openedAtRef.current = Date.now();
    heightAnim.setValue(0);
  }, [visible, heightAnim]);

  useEffect(() => {
    if (!visible) return;
    const target = Math.max(0, sheetHeight || availableHeight);
    if (target <= 0) return;

    // Avoid restarting the animation on every measurement tick.
    heightAnim.stopAnimation((current) => {
      const cur = typeof current === 'number' ? current : 0;
      if (cur >= target - 1) return;
      Animated.timing(heightAnim, {
        toValue: target,
        duration: OPEN_MS,
        useNativeDriver: false,
      }).start();
    });
  }, [visible, sheetHeight, availableHeight, heightAnim]);

  const closeAnimated = () => {
    if (closing) return;
    setClosing(true);
    Animated.timing(heightAnim, {
      toValue: 0,
      duration: CLOSE_MS,
      useNativeDriver: false,
    }).start(() => {
      setClosing(false);
      onClose();
    });
  };

  const handleOverlayPress = () => {
    // Prevent the same tap that opens the modal from instantly closing it.
    if (Date.now() - openedAtRef.current < 250) return;
    closeAnimated();
  };

  const shippingOptionButtons = useMemo(() => {
    const list = [{ key: 'All' as const, label: 'All' }, ...shippingOptions];
    return list;
  }, [shippingOptions]);

  const Chip = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected ? styles.chipSelected : null,
      ]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={closeAnimated}
    >
      <View style={styles.root} pointerEvents="box-none">
        {/* Modal blocks touches to underlying header. Provide a small hit-area over the header filter icon to close. */}
        <Pressable
          onPress={closeAnimated}
          style={[styles.headerFilterCloseHit, { height: Math.max(0, topOffset) }]}
          hitSlop={10}
        />
        <Pressable
          style={[styles.overlay, { top: topOffset }]}
          onPress={handleOverlayPress}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              top: topOffset,
              height: heightAnim,
              maxHeight: availableHeight,
            },
          ]}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={(_w, h) => setMeasuredContentHeight(h)}
          >
            <Text style={styles.sectionTitle}>Shipped From</Text>
            <View style={styles.chipGrid}>
              {shippedFromOptions.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={local.shippedFrom === opt}
                  onPress={() => setLocal((p) => ({ ...p, shippedFrom: opt }))}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Shipping Option</Text>
            <View style={styles.chipGrid}>
              {shippingOptionButtons.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  selected={local.shippingOption === opt.key}
                  onPress={() => setLocal((p) => ({ ...p, shippingOption: opt.key }))}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Price Range</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceLabel}>Min</Text>
                <TextInput
                  value={local.minPrice}
                  onChangeText={(t) => setLocal((p) => ({ ...p, minPrice: t.replace(/[^\d]/g, '') }))}
                  placeholder="0"
                  keyboardType="number-pad"
                  style={styles.priceInput}
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceLabel}>Max</Text>
                <TextInput
                  value={local.maxPrice}
                  onChangeText={(t) => setLocal((p) => ({ ...p, maxPrice: t.replace(/[^\d]/g, '') }))}
                  placeholder="∞"
                  keyboardType="number-pad"
                  style={styles.priceInput}
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.chipGrid}>
              {categoryOptions.map((opt) => (
                <Chip
                  key={opt}
                  label={opt === 'All' ? 'All Categories' : opt}
                  selected={local.category === opt}
                  onPress={() => setLocal((p) => ({ ...p, category: opt }))}
                />
              ))}
            </View>

          </ScrollView>

          <View style={styles.footer} onLayout={(e) => setMeasuredFooterHeight(e.nativeEvent.layout.height)}>
            <Pressable
              onPress={() => {
                onReset();
              }}
              style={[styles.footerBtn, styles.resetBtn]}
            >
              <Text style={[styles.footerBtnText, styles.resetText]}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => onApply(local)}
              style={[styles.footerBtn, styles.applyBtn]}
            >
              <Text style={[styles.footerBtnText, styles.applyText]}>Apply</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerFilterCloseHit: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 72,
    // height is set dynamically via topOffset
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    // height is set dynamically to wrap content; capped by available height
    backgroundColor: '#ffffff',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 16,
  },
  contentInner: {
    paddingVertical: 12,
    paddingBottom: 10,
  },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  chipSelected: {
    backgroundColor: '#e8f0ff',
    borderColor: '#0a61d7',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#0a61d7',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priceInputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  priceLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  priceInput: {
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    backgroundColor: '#ffffff',
  },
  footerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  resetBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  applyBtn: {
    backgroundColor: '#0a61d7',
    borderColor: '#0a61d7',
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  resetText: {
    color: '#111827',
  },
  applyText: {
    color: '#ffffff',
  },
});

