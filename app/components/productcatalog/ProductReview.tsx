import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Star, MessageSquare, Package, ImagePlus, X } from 'lucide-react-native';
import { API_BASE_URL } from '../../../services/config';
import { pickMultipleImages } from '../../../services/imagePicker';

export interface OrderReviewItem {
  productId: string;
  productName: string;
  image?: string;
}

interface ProductReviewParams {
  orderId?: string;
  productId?: string;
  productName?: string;
  image?: string;
  itemsJson?: string;
}

const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

const MAX_PHOTOS_PER_PRODUCT = 5;

interface ProductReviewState {
  rating: number;
  title: string;
  comment: string;
  images: string[];
}

const defaultReviewState = (): ProductReviewState => ({
  rating: 0,
  title: '',
  comment: '',
  images: [],
});

export default function ProductReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { orderId, productId, productName, image, itemsJson } = params as ProductReviewParams;

  const items = useMemo((): OrderReviewItem[] => {
    if (itemsJson && typeof itemsJson === 'string') {
      try {
        const parsed = JSON.parse(itemsJson) as OrderReviewItem[];
        return Array.isArray(parsed) && parsed.length > 0
          ? parsed.map((p) => ({
              productId: String(p.productId ?? ''),
              productName: String(p.productName ?? 'Product'),
              image: p.image,
            }))
          : [];
      } catch {
        return [];
      }
    }
    if (productId || productName) {
      return [
        {
          productId: String(productId ?? ''),
          productName: String(productName ?? 'Product'),
          image,
        },
      ];
    }
    return [];
  }, [itemsJson, productId, productName, image]);

  const itemsKey = useMemo(() => items.map((p) => p.productId).join(','), [items]);
  const [productReviews, setProductReviews] = useState<ProductReviewState[]>(() =>
    items.length > 0 ? items.map(() => defaultReviewState()) : [defaultReviewState()]
  );
  const [deliveryRating, setDeliveryRating] = useState<number>(0);
  const [deliveryComment, setDeliveryComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (items.length > 0) {
      setProductReviews((prev) =>
        items.map((_, i) => prev[i] ?? defaultReviewState())
      );
    }
  }, [items.length, itemsKey]);

  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';

  const allProductRatingsFilled = items.length > 0 && productReviews.every((r) => r.rating > 0);
  const canSubmit = allProductRatingsFilled && !isSubmitting;

  const handleSubmit = async () => {
    if (!allProductRatingsFilled) {
      Alert.alert(
        'Rating Required',
        items.length > 1
          ? 'Please rate every product before submitting.'
          : 'Please select a product rating before submitting.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      // TODO: Wire this up to your backend: send productReviews + deliveryRating + deliveryComment + orderId
      Alert.alert('Thank You', 'Your review has been submitted.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (value: number, onChange: (val: number) => void) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            activeOpacity={0.8}
          >
            <Star
              size={32}
              color={star <= value ? '#fbbf24' : '#d1d5db'}
              fill={star <= value ? '#fbbf24' : 'none'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const updateProductReview = (index: number, field: keyof ProductReviewState, value: number | string | string[]) => {
    setProductReviews((prev) => {
      const next = [...prev];
      if (!next[index]) next[index] = defaultReviewState();
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addReviewPhotos = async (productIndex: number) => {
    const review = productReviews[productIndex];
    const currentCount = review?.images?.length ?? 0;
    if (!review || currentCount >= MAX_PHOTOS_PER_PRODUCT) return;
    const remaining = MAX_PHOTOS_PER_PRODUCT - currentCount;
    try {
      setUploadingPhotoIndex(productIndex);
      const urls = await pickMultipleImages({
        folder: 'reviews',
        selectionLimit: remaining,
      });
      if (urls.length > 0) {
        const current = productReviews[productIndex]?.images ?? [];
        const combined = [...current, ...urls].slice(0, MAX_PHOTOS_PER_PRODUCT);
        updateProductReview(productIndex, 'images', combined);
      }
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not add photos.');
    } finally {
      setUploadingPhotoIndex(null);
    }
  };

  const removeReviewPhoto = (productIndex: number, imageIndex: number) => {
    const current = productReviews[productIndex]?.images ?? [];
    updateProductReview(productIndex, 'images', current.filter((_, i) => i !== imageIndex));
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen
          options={{
            presentation: 'modal',
            header: () => (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  paddingTop: Math.max(insets.top, 44) + 8,
                  borderBottomColor: '#e5e7eb',
                  borderBottomWidth: 1,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={10}
                    accessibilityLabel="Back"
                    accessibilityRole="button"
                  >
                    <ArrowLeft color={primaryBlue} size={24} />
                  </TouchableOpacity>
                  <Text
                    style={{
                      color: '#111827',
                      fontSize: 20,
                      fontWeight: '500',
                      flex: 1,
                      textAlign: 'left',
                      marginLeft: 35,
                    }}
                  >
                    Rate Order
                  </Text>
                </View>
              </View>
            ),
          }}
        />
        <View style={styles.emptyState}>
          <Package color={iconGray} size={48} />
          <Text style={styles.emptyStateText}>No products to review.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View
              style={{
                backgroundColor: '#ffffff',
                paddingTop: Math.max(insets.top, 44) + 8,
                borderBottomColor: '#e5e7eb',
                borderBottomWidth: 1,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingBottom: 20,
                }}
              >
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text
                  style={{
                    color: '#111827',
                    fontSize: 20,
                    fontWeight: '500',
                    flex: 1,
                    textAlign: 'left',
                    marginLeft: 35,
                  }}
                >
                  {items.length > 1 ? 'Rate order' : 'Rate product'}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentCard}>
          {orderId ? (
            <View style={styles.orderIdRow}>
              <Text style={styles.orderIdLabel}>Order</Text>
              <Text style={styles.orderIdValue}>{orderId}</Text>
            </View>
          ) : null}

          {items.map((item, index) => {
            const review = productReviews[index] ?? defaultReviewState();
            const imgUri = normalizeUrl(item.image);
            const isMulti = items.length > 1;
            return (
              <View key={`${item.productId}-${index}`} style={styles.productBlock}>
                {isMulti && (
                  <Text style={styles.productBlockLabel}>
                    Product {index + 1} of {items.length}
                  </Text>
                )}
                <View style={styles.headerSection}>
                  {imgUri ? (
                    <Image source={{ uri: imgUri }} style={styles.productImage} />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Text style={styles.productInitials}>
                        {(item.productName || 'P').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.productName || 'Product'}
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>How do you like this product?</Text>
                  <Text style={styles.sectionSubtitle}>
                    Tap to rate the quality and overall experience.
                  </Text>
                  {renderStars(review.rating, (val) => updateProductReview(index, 'rating', val))}
                </View>

                <View style={styles.section}>
                  <Text style={styles.inputLabel}>Review title (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={review.title}
                    onChangeText={(t) => updateProductReview(index, 'title', t)}
                    placeholder="e.g. Great quality and fast delivery"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <MessageSquare color={iconGray} size={18} />
                    <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                      Write your detailed product review
                    </Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Share what you liked, what could be better, and whether you would recommend it.
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    value={review.comment}
                    onChangeText={(c) => updateProductReview(index, 'comment', c)}
                    placeholder="Write your review here..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.inputLabel}>Review photos (optional, max {MAX_PHOTOS_PER_PRODUCT})</Text>
                  <Text style={styles.sectionSubtitle}>
                    Add clear photos of the product. You can select multiple at once.
                  </Text>
                  <View style={styles.photoRow}>
                    {(review.images ?? []).map((uri, imgIdx) => (
                      <View key={imgIdx} style={styles.photoThumbWrap}>
                        <Image source={{ uri }} style={styles.photoThumb} />
                        <TouchableOpacity
                          style={styles.photoRemove}
                          onPress={() => removeReviewPhoto(index, imgIdx)}
                          accessibilityLabel="Remove photo"
                          accessibilityRole="button"
                        >
                          <X size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {(review.images?.length ?? 0) < MAX_PHOTOS_PER_PRODUCT && (
                      <TouchableOpacity
                        style={styles.photoAdd}
                        onPress={() => addReviewPhotos(index)}
                        disabled={uploadingPhotoIndex === index}
                        accessibilityLabel="Add photos"
                        accessibilityRole="button"
                      >
                        {uploadingPhotoIndex === index ? (
                          <ActivityIndicator size="small" color={primaryBlue} />
                        ) : (
                          <ImagePlus size={24} color={iconGray} />
                        )}
                        <Text style={styles.photoAddText}>
                          Add {(review.images?.length ?? 0) > 0 ? 'more' : 'photos'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How was the delivery experience?</Text>
            <Text style={styles.sectionSubtitle}>
              Rate the shipping, delivery time, and condition of the package.
            </Text>
            {renderStars(deliveryRating, setDeliveryRating)}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <MessageSquare color={iconGray} size={18} />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                Delivery feedback (optional)
              </Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Tell us about the courier, delivery time, and overall experience receiving your order.
            </Text>
            <TextInput
              style={styles.textArea}
              value={deliveryComment}
              onChangeText={setDeliveryComment}
              placeholder="Write about the delivery here..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomContainer,
          { paddingBottom: 18 + insets.bottom },
        ]}
      >
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel={isSubmitting ? 'Submitting review' : 'Submit review'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
        >
          <Text
            style={[
              styles.submitButtonText,
              !canSubmit && styles.submitButtonTextDisabled,
            ]}
          >
            {isSubmitting ? 'Submitting...' : 'Submit review'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  contentCard: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a61d7',
  },
  productInfo: {
    marginLeft: 14,
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  productMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  orderIdLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderIdValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  productBlock: {
    marginBottom: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  productBlockLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deliveryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
    marginBottom: 8,
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 140,
    backgroundColor: '#f9fafb',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

