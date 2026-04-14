import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// no header actions; close via outside press / filter icon toggle
import { ChevronDown } from 'lucide-react-native';

export type ShippingOptionKey = 'selfPickup' | 'sellerDelivery' | 'buyerCourier';

export type SearchFilters = {
  shippedFrom: string[]; // multi-select locations; empty = no filter
  shippingOption: ShippingOptionKey[]; // multi-select; empty = no filter
  salesChannel: string[]; // multi-select: Retail / Wholesale; empty = no filter
  minPrice: string; // numeric string
  maxPrice: string; // numeric string
  category: string[]; // multi-select category labels; empty = no filter
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  onReset: () => void;
  initialFilters: SearchFilters;
  shippedFromOptions: string[]; // location labels (no 'All' required)
  shippingOptions: Array<{ key: ShippingOptionKey; label: string }>;
  salesChannelOptions: string[]; // e.g. Retail, Wholesale
  categoryOptions: string[]; // category labels (no 'All' required)
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
  salesChannelOptions,
  categoryOptions,
  topOffset,
}: Props) {
  const OPEN_MS = 170;
  const CLOSE_MS = 140;
  const MAX_PILLS_COLLAPSED = 4;
  const [local, setLocal] = useState<SearchFilters>(initialFilters);
  const [closing, setClosing] = useState(false);
  const availableHeight = Math.max(0, screenHeight - Math.max(0, topOffset));
  const [measuredContentHeight, setMeasuredContentHeight] = useState(0);
  const [measuredFooterHeight, setMeasuredFooterHeight] = useState(0);
  const sheetHeight = Math.min(
    availableHeight,
    Math.max(0, measuredContentHeight + measuredFooterHeight),
  );
  // Give the dropdown more presence even when content is short.
  const minSheetHeight = Math.min(availableHeight, Math.round(availableHeight * 0.61));
  const desiredSheetHeight = Math.min(availableHeight, Math.max(sheetHeight, minSheetHeight));
  // Smooth native-driver animation (better than animating height).
  const translateAnim = useRef(new Animated.Value(-12)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setLocal(initialFilters);
  }, [visible, initialFilters]);

  useEffect(() => {
    if (!visible) return;
    // Only run the opening animation once per open.
    // Avoid depending on measured height; expanding "Show more" should not restart animation.
    setClosing(false);
    openedAtRef.current = Date.now();
    translateAnim.setValue(-12);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateAnim, opacityAnim]);

  // No height animation: we only update measured heights for layout.

  const closeAnimated = () => {
    if (closing) return;
    setClosing(true);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: -12,
        duration: CLOSE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
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
    return shippingOptions;
  }, [shippingOptions]);

  const [showMore, setShowMore] = useState({
    shippedFrom: false,
    shippingOption: false,
    category: false,
  });

  useEffect(() => {
    if (!visible) return;
    setShowMore({ shippedFrom: false, shippingOption: false, category: false });
  }, [visible]);

  const shippedFromShown = useMemo(() => {
    if (showMore.shippedFrom) return shippedFromOptions;
    return shippedFromOptions.slice(0, MAX_PILLS_COLLAPSED);
  }, [shippedFromOptions, showMore.shippedFrom]);

  const shippingOptionShown = useMemo(() => {
    if (showMore.shippingOption) return shippingOptionButtons;
    return shippingOptionButtons.slice(0, MAX_PILLS_COLLAPSED);
  }, [shippingOptionButtons, showMore.shippingOption]);

  const categoryShown = useMemo(() => {
    if (showMore.category) return categoryOptions;
    return categoryOptions.slice(0, MAX_PILLS_COLLAPSED);
  }, [categoryOptions, showMore.category]);

  const ShowMoreButton = ({
    expanded,
    onPress,
  }: {
    expanded: boolean;
    onPress: () => void;
  }) => (
    <Pressable onPress={onPress} style={styles.showMoreBtn} accessibilityRole="button">
      <Text style={styles.showMoreText}>{expanded ? 'Show less' : 'Show more'}</Text>
      <ChevronDown
        size={16}
        color="#6b7280"
        style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
      />
    </Pressable>
  );

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
              height: desiredSheetHeight,
              maxHeight: availableHeight,
              opacity: opacityAnim,
              transform: [{ translateY: translateAnim }],
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
              {shippedFromShown.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={local.shippedFrom.includes(opt)}
                  onPress={() =>
                    setLocal((p) => {
                      const next = new Set(p.shippedFrom);
                      if (next.has(opt)) next.delete(opt);
                      else next.add(opt);
                      return { ...p, shippedFrom: Array.from(next) };
                    })
                  }
                />
              ))}
            </View>
            {shippedFromOptions.length > MAX_PILLS_COLLAPSED ? (
              <ShowMoreButton
                expanded={showMore.shippedFrom}
                onPress={() => setShowMore((p) => ({ ...p, shippedFrom: !p.shippedFrom }))}
              />
            ) : null}

            <Text style={styles.sectionTitle}>Shipping Option</Text>
            <View style={styles.chipGrid}>
              {shippingOptionShown.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  selected={local.shippingOption.includes(opt.key)}
                  onPress={() =>
                    setLocal((p) => {
                      const next = new Set(p.shippingOption);
                      if (next.has(opt.key)) next.delete(opt.key);
                      else next.add(opt.key);
                      return { ...p, shippingOption: Array.from(next) };
                    })
                  }
                />
              ))}
            </View>
            {shippingOptionButtons.length > MAX_PILLS_COLLAPSED ? (
              <ShowMoreButton
                expanded={showMore.shippingOption}
                onPress={() => setShowMore((p) => ({ ...p, shippingOption: !p.shippingOption }))}
              />
            ) : null}

            <Text style={styles.sectionTitle}>Sales Channel</Text>
            <View style={styles.chipGrid}>
              {salesChannelOptions.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={local.salesChannel.includes(opt)}
                  onPress={() =>
                    setLocal((p) => {
                      const next = new Set(p.salesChannel);
                      if (next.has(opt)) next.delete(opt);
                      else next.add(opt);
                      return { ...p, salesChannel: Array.from(next) };
                    })
                  }
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
              {categoryShown.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={local.category.includes(opt)}
                  onPress={() =>
                    setLocal((p) => {
                      const next = new Set(p.category);
                      if (next.has(opt)) next.delete(opt);
                      else next.add(opt);
                      return { ...p, category: Array.from(next) };
                    })
                  }
                />
              ))}
            </View>
            {categoryOptions.length > MAX_PILLS_COLLAPSED ? (
              <ShowMoreButton
                expanded={showMore.category}
                onPress={() => setShowMore((p) => ({ ...p, category: !p.category }))}
              />
            ) : null}

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
  showMoreBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
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

