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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Star, MessageSquare, Package, Camera, ImagePlus, X } from 'lucide-react-native';
import { API_BASE_URL } from '../../../services/config';
import { pickImage, pickMultipleImages, takePhoto } from '../../../services/imagePicker';
import { useAuthStore } from '../../../stores/authStore';
import { useTranslation } from 'react-i18next';

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
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();
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

  // Prefill existing reviews (1 buyer = 1 review per product per order)
  useEffect(() => {
    let cancelled = false;
    const loadExisting = async () => {
      if (!token || !orderId || typeof orderId !== 'string' || !orderId.trim()) return;
      if (!items.length) return;
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/mobile/reviews/order?orderId=${encodeURIComponent(orderId.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const json = (await res.json().catch(() => null)) as
          | {
              productReviews?: Array<{
                productId: string;
                rating: number;
                title?: string | null;
                comment?: string | null;
                imageUrls?: string[];
              }>;
              deliveryReview?: { deliveryRating?: number | null; deliveryComment?: string | null } | null;
            }
          | null;
        if (!res.ok || !json) return;
        if (cancelled) return;

        type ExistingProductReview = {
          productId: string;
          rating: number;
          title?: string | null;
          comment?: string | null;
          imageUrls?: string[];
        };
        const byProductId = new Map<string, ExistingProductReview>();
        for (const r of json.productReviews ?? []) {
          if (r?.productId) byProductId.set(String(r.productId), r);
        }

        setProductReviews((prev) =>
          items.map((it, idx) => {
            const existing = byProductId.get(String(it.productId));
            if (!existing) return prev[idx] ?? defaultReviewState();
            return {
              rating: Number(existing.rating) || 0,
              title: typeof existing.title === 'string' ? existing.title : '',
              comment: typeof existing.comment === 'string' ? existing.comment : '',
              images: Array.isArray(existing.imageUrls)
                ? existing.imageUrls.filter((u: unknown): u is string => typeof u === 'string')
                : [],
            };
          }),
        );

        if (json.deliveryReview) {
          const dr = json.deliveryReview.deliveryRating;
          const dc = json.deliveryReview.deliveryComment;
          setDeliveryRating(typeof dr === 'number' ? dr : 0);
          setDeliveryComment(typeof dc === 'string' ? dc : '');
        }
      } catch {
        // best-effort only
      }
    };

    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [token, orderId, itemsKey, items.length]);

  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';

  const allProductRatingsFilled = items.length > 0 && productReviews.every((r) => r.rating > 0);
  const canSubmit = allProductRatingsFilled && !isSubmitting && uploadingPhotoIndex === null;

  const handleSubmit = async () => {
    if (uploadingPhotoIndex !== null) {
      Alert.alert(
        t('productReview.alerts.pleaseWaitTitle'),
        t('productReview.alerts.pleaseWaitBody')
      );
      return;
    }
    if (!allProductRatingsFilled) {
      Alert.alert(
        t('productReview.alerts.ratingRequiredTitle'),
        items.length > 1
          ? t('productReview.alerts.ratingRequiredAllProducts')
          : t('productReview.alerts.ratingRequiredSingle')
      );
      return;
    }

    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      Alert.alert(t('productReview.alerts.errorTitle'), t('productReview.alerts.missingOrder'));
      return;
    }

    if (!token) {
      Alert.alert(t('productReview.alerts.signInRequiredTitle'), t('productReview.alerts.signInRequiredBody'));
      return;
    }

    try {
      setIsSubmitting(true);

      const productReviewsPayload = items.map((item, i) => ({
        productId: item.productId,
        rating: productReviews[i]?.rating ?? 0,
        title: productReviews[i]?.title?.trim() || undefined,
        comment: productReviews[i]?.comment?.trim() || undefined,
        imageUrls: (productReviews[i]?.images ?? []).slice(0, MAX_PHOTOS_PER_PRODUCT),
      }));

      const body = {
        orderId: orderId.trim(),
        productReviews: productReviewsPayload,
        deliveryRating: deliveryRating > 0 ? deliveryRating : undefined,
        deliveryComment: deliveryComment.trim() || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/mobile/reviews/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = (data?.error as string) || `Request failed (${response.status})`;
        throw new Error(message);
      }

      Alert.alert(t('productReview.alerts.thankYouTitle'), t('productReview.alerts.submittedBody'), [
        {
          text: t('productReview.alerts.ok'),
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert(t('productReview.alerts.errorTitle'), t('productReview.alerts.failedGeneric'), [{ text: t('productReview.alerts.ok') }]);
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

  const appendReviewPhotoUrl = (productIndex: number, url: string) => {
    setProductReviews((prev) => {
      const next = [...prev];
      const row = next[productIndex] ?? defaultReviewState();
      const combined = [...(row.images ?? []), url].slice(0, MAX_PHOTOS_PER_PRODUCT);
      next[productIndex] = { ...row, images: combined };
      return next;
    });
  };

  const addReviewPhotoFromCamera = async (productIndex: number) => {
    const review = productReviews[productIndex];
    const currentCount = review?.images?.length ?? 0;
    if (!review || currentCount >= MAX_PHOTOS_PER_PRODUCT) return;
    try {
      setUploadingPhotoIndex(productIndex);
      const url = await takePhoto({ folder: 'reviews', allowsEditing: false });
      if (url) appendReviewPhotoUrl(productIndex, url);
    } catch {
      Alert.alert(
        t('productReview.alerts.uploadFailedTitle'),
        t('productReview.alerts.uploadFailedBody')
      );
    } finally {
      setUploadingPhotoIndex(null);
    }
  };

  const addReviewPhotoFromGallery = async (productIndex: number) => {
    const review = productReviews[productIndex];
    const currentCount = review?.images?.length ?? 0;
    if (!review || currentCount >= MAX_PHOTOS_PER_PRODUCT) return;
    const remaining = Math.max(0, MAX_PHOTOS_PER_PRODUCT - currentCount);
    if (remaining === 0) return;
    try {
      setUploadingPhotoIndex(productIndex);
      const urls = await pickMultipleImages({ folder: 'reviews', selectionLimit: remaining });
      if (urls.length > 0) {
        setProductReviews((prev) => {
          const next = [...prev];
          const row = next[productIndex] ?? defaultReviewState();
          const combined = [...(row.images ?? []), ...urls].slice(0, MAX_PHOTOS_PER_PRODUCT);
          next[productIndex] = { ...row, images: combined };
          return next;
        });
      }
    } catch {
      Alert.alert(
        t('productReview.alerts.uploadFailedTitle'),
        t('productReview.alerts.uploadFailedBody')
      );
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
                    accessibilityLabel={t('productReview.a11y.back')}
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
                    {t('productReview.titles.rateOrder')}
                  </Text>
                </View>
              </View>
            ),
          }}
        />
        <View style={styles.emptyState}>
          <Package color={iconGray} size={48} />
          <Text style={styles.emptyStateText}>{t('productReview.empty.noProducts')}</Text>
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
                  accessibilityLabel={t('productReview.a11y.goBack')}
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
                  {items.length > 1 ? t('productReview.titles.rateOrderLower') : t('productReview.titles.rateProduct')}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 40) : 0}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentCard}>
          {orderId ? (
            <View style={[styles.sectionCard, styles.orderIdSection]}>
              <View style={styles.orderIdRow}>
                <Text style={styles.orderIdLabel}>{t('productReview.order.label')}</Text>
                <Text style={styles.orderIdValue}>{orderId}</Text>
              </View>
            </View>
          ) : null}

          {items.map((item, index) => {
            const review = productReviews[index] ?? defaultReviewState();
            const imgUri = normalizeUrl(item.image);
            const isMulti = items.length > 1;
            return (
              <View key={`${item.productId}-${index}`} style={styles.productBlock}>
                <View style={styles.sectionCard}>
                  {isMulti && (
                    <Text style={styles.productBlockLabel}>
                      {t('productReview.order.productXofY', { index: index + 1, total: items.length })}
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
                    <Text style={styles.sectionTitle}>{t('productReview.sections.productLikeTitle')}</Text>
                    <Text style={styles.sectionSubtitle}>
                      {t('productReview.sections.productLikeSubtitle')}
                    </Text>
                    {renderStars(review.rating, (val) => updateProductReview(index, 'rating', val))}
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.inputLabel}>{t('productReview.sections.reviewTitleLabel')}</Text>
                    <TextInput
                      style={styles.textInput}
                      value={review.title}
                      onChangeText={(t) => updateProductReview(index, 'title', t)}
                      placeholder={t('productReview.sections.reviewTitlePlaceholder')}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <MessageSquare color={iconGray} size={18} />
                      <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                        {t('productReview.sections.detailedTitle')}
                      </Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      {t('productReview.sections.detailedSubtitle')}
                    </Text>
                    <TextInput
                      style={styles.textArea}
                      value={review.comment}
                      onChangeText={(c) => updateProductReview(index, 'comment', c)}
                      placeholder={t('productReview.sections.detailedPlaceholder')}
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.photoEvidenceSection}>
                    <Text style={styles.photoEvidenceTitle}>
                      {t('productReview.sections.photosLabel', { max: MAX_PHOTOS_PER_PRODUCT })}
                    </Text>
                    <Text style={styles.photoEvidenceHint}>
                      {t('productReview.sections.photosSubtitle')}
                    </Text>
                    <View style={styles.photoRow}>
                      {(review.images ?? []).map((uri, imgIdx) => (
                        <View key={imgIdx} style={styles.photoThumbWrap}>
                          <Image source={{ uri }} style={styles.photoThumb} />
                          <TouchableOpacity
                            style={styles.photoRemove}
                            onPress={() => removeReviewPhoto(index, imgIdx)}
                            accessibilityLabel={t('productReview.a11y.removePhoto')}
                            accessibilityRole="button"
                          >
                            <X size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {(review.images?.length ?? 0) < MAX_PHOTOS_PER_PRODUCT && (
                        <View style={styles.photoActionsRow}>
                          <TouchableOpacity
                            style={styles.photoAdd}
                            onPress={() => addReviewPhotoFromCamera(index)}
                            disabled={uploadingPhotoIndex === index}
                            accessibilityLabel={t('productReview.a11y.camera')}
                            accessibilityRole="button"
                          >
                            {uploadingPhotoIndex === index ? (
                              <ActivityIndicator size="small" color={primaryBlue} />
                            ) : (
                              <Camera size={22} color={iconGray} />
                            )}
                            <Text style={styles.photoAddText}>{t('productReview.photos.camera')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoAdd}
                            onPress={() => addReviewPhotoFromGallery(index)}
                            disabled={uploadingPhotoIndex === index}
                            accessibilityLabel={t('productReview.a11y.gallery')}
                            accessibilityRole="button"
                          >
                            {uploadingPhotoIndex === index ? (
                              <ActivityIndicator size="small" color={primaryBlue} />
                            ) : (
                              <ImagePlus size={22} color={iconGray} />
                            )}
                            <Text style={styles.photoAddText}>{t('productReview.photos.gallery')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={[styles.sectionCard]}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('productReview.sections.deliveryTitle')}</Text>
              <Text style={styles.sectionSubtitle}>
                {t('productReview.sections.deliverySubtitle')}
              </Text>
              {renderStars(deliveryRating, setDeliveryRating)}
            </View>

            <View style={[styles.section, { marginBottom: 0 }]}>
              <View style={styles.sectionHeaderRow}>
                <MessageSquare color={iconGray} size={18} />
                <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                  {t('productReview.sections.deliveryFeedbackTitle')}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {t('productReview.sections.deliverySubtitle')}
              </Text>
              <TextInput
                style={styles.textArea}
                value={deliveryComment}
                onChangeText={setDeliveryComment}
                placeholder={t('productReview.sections.deliveryFeedbackPlaceholder')}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>
      </ScrollView>

        <View
          style={[
            styles.bottomContainer,
            { paddingBottom: insets.bottom },
          ]}
        >
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityLabel={isSubmitting ? t('productReview.submit.submittingA11y') : t('productReview.submit.submitA11y')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            <Text
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              {isSubmitting ? t('productReview.submit.submitting') : t('productReview.submit.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { flex: 1 },
  contentCard: {
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 24,
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
  orderIdSection: {
    marginBottom: 8,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingBottom: 0,
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
  },
  productBlockLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 16,
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
  sectionCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
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
  photoEvidenceSection: {
    marginTop: 8,
    marginBottom: 24,
    padding: 0,
  },
  photoEvidenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  photoEvidenceHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
    lineHeight: 16,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
    backgroundColor: '#f3f4f6',
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
    bottom: -11,
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
    paddingVertical: 13,
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

