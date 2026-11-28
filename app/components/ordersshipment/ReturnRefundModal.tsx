import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, ArrowLeft, Camera, Check, ImagePlus, X } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { pickMultipleImages, takePhoto } from '../../../services/imagePicker';
import { marketplaceService } from '../../../services/marketplace';
import { useTranslation } from 'react-i18next';
import { ShimmerIcon } from '../SkeletonLoader';

const RETURN_REASON_IDS = [
  'wrong_item',
  'defective',
  'not_as_described',
  'changed_mind',
  'late_delivery',
  'other',
] as const;

const primaryBlue = '#0a61d7';

type StockLevelOption = { name: string; piecesPerUnit: number };

type ReturnOrderLine = {
  id: number;
  productName: string;
  variantNameSnapshot?: string | null;
  packageType?: string | null;
  packageQuantity: number;
  piecesPerPackage: number;
  stockLevels: StockLevelOption[];
};

function buildReturnStockLevels(
  orderedType: string | null | undefined,
  orderedPpp: number,
  productLevels?: Array<{ name: string; piecesPerUnit: number }> | null,
): StockLevelOption[] {
  const levels: StockLevelOption[] = [{ name: 'Pieces', piecesPerUnit: 1 }];
  const seen = new Set(['pieces|1']);
  const add = (name: string, piecesPerUnit: number) => {
    const key = `${name.toLocaleLowerCase()}|${piecesPerUnit}`;
    if (seen.has(key) || piecesPerUnit < 1) return;
    seen.add(key);
    levels.push({ name, piecesPerUnit });
  };
  for (const level of productLevels ?? []) {
    add(level.name, Math.max(1, Number(level.piecesPerUnit) || 1));
  }
  if (orderedPpp > 1 && orderedType?.trim()) {
    add(orderedType.trim(), orderedPpp);
  }
  return levels;
}

function maxReturnQty(orderedQty: number, orderedPpp: number, returnPpp: number): number {
  return Math.max(1, Math.floor((orderedQty * orderedPpp) / Math.max(1, returnPpp)));
}

/** 0 = unchecked; "" = checked while clearing input; 1..max = checked qty */
type QtyDraft = number | '';

function isReturnLineSelected(qty: QtyDraft | undefined): boolean {
  return qty === '' || (typeof qty === 'number' && qty > 0);
}

function parseReturnQtyDraft(raw: string, maxQty: number): QtyDraft {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits === '') return '';
  const next = Math.trunc(Number(digits));
  if (!Number.isFinite(next) || next < 1) return '';
  return Math.min(maxQty, next);
}

function clampReturnQty(qty: QtyDraft | undefined, maxQty: number): number {
  if (typeof qty === 'number' && qty > 0) return Math.min(maxQty, qty);
  return Math.min(maxQty, 1);
}

export default function ReturnRefundModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { token } = useAuthStore();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reasonDetail, setReasonDetail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [orderLines, setOrderLines] = useState<ReturnOrderLine[]>([]);
  const [selectedQty, setSelectedQty] = useState<Record<number, QtyDraft>>({});
  const [selectedStockType, setSelectedStockType] = useState<Record<number, string>>({});
  const [loadingOrder, setLoadingOrder] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    async function loadOrder() {
      if (!orderId || typeof orderId !== 'string' || !token) {
        setLoadingOrder(false);
        return;
      }
      try {
        setLoadingOrder(true);
        const response = await fetch(
          `${API_BASE_URL}/api/orders?id=${encodeURIComponent(orderId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) throw new Error('Failed to load order');
        const data = await response.json();
        const rawLines = (data.orderItems || []) as Array<Record<string, unknown>>;
        const productIds = Array.from(
          new Set(
            rawLines
              .map((item) => (typeof item.productId === 'string' ? item.productId.trim() : ''))
              .filter(Boolean),
          ),
        );
        const stockLevelsByProductId = new Map<string, StockLevelOption[] | null>();
        await Promise.all(
          productIds.map(async (productId) => {
            try {
              const product = await marketplaceService.getProductById(productId, token);
              stockLevelsByProductId.set(productId, product.stockLevels ?? null);
            } catch {
              stockLevelsByProductId.set(productId, null);
            }
          }),
        );

        const lines: ReturnOrderLine[] = rawLines
          .map((item) => {
            const piecesPerPackage = Math.max(1, Number(item.piecesPerPackage) || 1);
            const packageType =
              (typeof item.packageType === 'string' && item.packageType) ||
              (piecesPerPackage === 1 ? 'Pieces' : 'Package');
            const productId = typeof item.productId === 'string' ? item.productId : null;
            return {
              id: Number(item.id),
              productName: String(item.productName || item.productNameSnapshot || 'Product'),
              variantNameSnapshot: (item.variantNameSnapshot as string) || null,
              packageType,
              packageQuantity: Math.max(1, Number(item.packageQuantity) || 1),
              piecesPerPackage,
              stockLevels: buildReturnStockLevels(
                packageType,
                piecesPerPackage,
                productId ? stockLevelsByProductId.get(productId) : null,
              ),
            };
          })
          .filter((line) => Number.isInteger(line.id) && line.id > 0);
        if (!cancelled) {
          setOrderLines(lines);
          const initialQty: Record<number, QtyDraft> = {};
          const initialType: Record<number, string> = {};
          for (const line of lines) {
            initialQty[line.id] = 0;
            const preferred =
              line.stockLevels.find((level) => level.name === line.packageType) ??
              line.stockLevels[0];
            initialType[line.id] = preferred?.name || 'Pieces';
          }
          setSelectedQty(initialQty);
          setSelectedStockType(initialType);
        }
      } catch {
        if (!cancelled) setOrderLines([]);
      } finally {
        if (!cancelled) setLoadingOrder(false);
      }
    }
    void loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  const selectedItems = useMemo(
    () =>
      orderLines
        .filter((line) => {
          const qty = selectedQty[line.id];
          return typeof qty === 'number' && qty > 0;
        })
        .map((line) => {
          const selectedName = selectedStockType[line.id];
          const level =
            line.stockLevels.find((row) => row.name === selectedName) ??
            line.stockLevels[0] ?? {
              name: line.packageType || 'Pieces',
              piecesPerUnit: line.piecesPerPackage,
            };
          const qty = selectedQty[line.id];
          return {
            orderItemId: line.id,
            quantityReturned: typeof qty === 'number' ? qty : 0,
            packageType: level.name,
            piecesPerPackage: level.piecesPerUnit,
          };
        }),
    [orderLines, selectedQty, selectedStockType],
  );

  const scrollToInput = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleAddPhotoFromGallery = async () => {
    const remaining = 5 - imageUrls.length;
    if (remaining <= 0) return;
    try {
      setUploadingPhotos(true);
      const urls = await pickMultipleImages({ folder: 'returns', selectionLimit: remaining });
      if (urls.length > 0) {
        setImageUrls((prev) => [...prev, ...urls].slice(0, 5));
      }
    } catch {
      Alert.alert(
        t('ordersFlow.returnRefund.alerts.uploadFailedTitle'),
        t('ordersFlow.returnRefund.alerts.uploadFailedBody')
      );
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleTakePhoto = async () => {
    if (imageUrls.length >= 5) return;
    try {
      setUploadingPhotos(true);
      const url = await takePhoto({ folder: 'returns', allowsEditing: false });
      if (url) {
        setImageUrls((prev) => [...prev, url].slice(0, 5));
      }
    } catch {
      Alert.alert(
        t('ordersFlow.returnRefund.alerts.uploadFailedTitle'),
        t('ordersFlow.returnRefund.alerts.uploadFailedBody')
      );
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (uploadingPhotos) {
      Alert.alert(t('ordersFlow.returnRefund.alerts.pleaseWaitTitle'), t('ordersFlow.returnRefund.alerts.pleaseWaitBody'));
      return;
    }
    if (!selectedReason) {
      Alert.alert(t('ordersFlow.returnRefund.alerts.selectReasonTitle'), t('ordersFlow.returnRefund.alerts.selectReasonBody'));
      return;
    }
    if (selectedReason === 'other' && !reasonDetail.trim()) {
      Alert.alert(t('ordersFlow.returnRefund.alerts.provideDetailsTitle'), t('ordersFlow.returnRefund.alerts.provideDetailsBody'));
      return;
    }
    if (imageUrls.length === 0) {
      Alert.alert(
        t('ordersFlow.returnRefund.alerts.photosRequiredTitle'),
        t('ordersFlow.returnRefund.alerts.photosRequiredBody')
      );
      return;
    }
    if (selectedItems.length === 0) {
      Alert.alert(
        t('ordersFlow.returnRefund.alerts.selectItemsTitle'),
        t('ordersFlow.returnRefund.alerts.selectItemsBody')
      );
      return;
    }
    if (!token) {
      Alert.alert(t('ordersFlow.common.errors.sessionExpiredTitle'), t('ordersFlow.common.errors.sessionExpiredBody'));
      return;
    }
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      Alert.alert(t('ordersFlow.common.errors.errorTitle'), t('ordersFlow.returnRefund.alerts.missingOrderIdBody'));
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders/return-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: orderId.trim(),
          reason: selectedReason,
          reasonDetail: reasonDetail.trim() || undefined,
          imageUrls,
          items: selectedItems,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      Alert.alert(
        t('ordersFlow.returnRefund.alerts.submittedTitle'),
        t('ordersFlow.returnRefund.alerts.submittedBody'),
        [{ text: t('ordersFlow.common.buttons.ok'), onPress: () => router.back() }]
      );
    } catch {
      Alert.alert(
        t('ordersFlow.common.errors.errorTitle'),
        t('ordersFlow.returnRefund.alerts.failedBody'),
        [{ text: t('ordersFlow.common.buttons.ok') }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit =
    !!selectedReason &&
    (selectedReason !== 'other' || !!reasonDetail.trim()) &&
    imageUrls.length > 0 &&
    selectedItems.length > 0 &&
    !uploadingPhotos &&
    !isLoading &&
    !loadingOrder;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
          header: () => (
            <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel={t('ordersFlow.common.a11y.goBack')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('ordersFlow.returnRefund.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        style={styles.scrollWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 15 }}
        >
          <View style={styles.warningContainer}>
            <AlertCircle size={20} color="#f59e0b" />
            <Text style={styles.warningText}>
              {t('ordersFlow.returnRefund.warning')}
            </Text>
          </View>

          <View style={styles.orderInfoContainer}>
            <Text style={styles.orderIdLabel}>{t('ordersFlow.returnRefund.orderId')}</Text>
            <Text style={styles.orderIdValue}>{orderId}</Text>
          </View>

          <View style={styles.itemsContainer}>
            <Text style={styles.sectionTitle}>{t('ordersFlow.returnRefund.itemsTitle')}</Text>
            <Text style={styles.itemsHint}>{t('ordersFlow.returnRefund.itemsHint')}</Text>
            {loadingOrder ? (
              <ActivityIndicator color={primaryBlue} style={{ marginVertical: 12 }} />
            ) : orderLines.length === 0 ? (
              <Text style={styles.itemsHint}>{t('ordersFlow.returnRefund.itemsEmpty')}</Text>
            ) : (
              orderLines.map((line) => {
                const qty = selectedQty[line.id] ?? 0;
                const selected = isReturnLineSelected(qty);
                const selectedName = selectedStockType[line.id];
                const selectedLevel =
                  line.stockLevels.find((level) => level.name === selectedName) ??
                  line.stockLevels[0];
                const maxQty = maxReturnQty(
                  line.packageQuantity,
                  line.piecesPerPackage,
                  selectedLevel?.piecesPerUnit || 1,
                );
                return (
                  <View
                    key={line.id}
                    style={[styles.itemRow, selected && styles.itemRowSelected]}
                  >
                    <TouchableOpacity
                      style={styles.itemCheckRow}
                      onPress={() =>
                        setSelectedQty((prev) => ({
                          ...prev,
                          [line.id]: selected
                            ? 0
                            : Math.min(maxQty, Math.max(1, line.packageQuantity)),
                        }))
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Check size={12} color="#fff" /> : null}
                      </View>
                      <View style={styles.itemTextWrap}>
                        <Text style={styles.itemName}>{line.productName}</Text>
                        {line.variantNameSnapshot ? (
                          <Text style={styles.itemMeta}>{line.variantNameSnapshot}</Text>
                        ) : null}
                        <Text style={styles.itemMeta}>
                          {t('ordersFlow.returnRefund.orderedQty', {
                            qty: line.packageQuantity,
                            unit: line.packageType || 'pcs',
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {selected ? (
                      <View style={styles.returnControls}>
                        {line.stockLevels.length > 1 ? (
                          <View style={styles.stockTypeSection}>
                            <Text style={styles.qtyLabel}>
                              {t('ordersFlow.returnRefund.returnStockType')}
                            </Text>
                            <View style={styles.stockTypeRow}>
                              {line.stockLevels.map((level) => {
                                const active = selectedLevel?.name === level.name;
                                return (
                                  <TouchableOpacity
                                    key={`${level.name}-${level.piecesPerUnit}`}
                                    style={[
                                      styles.stockTypeChip,
                                      active && styles.stockTypeChipSelected,
                                    ]}
                                    onPress={() => {
                                      const nextMax = maxReturnQty(
                                        line.packageQuantity,
                                        line.piecesPerPackage,
                                        level.piecesPerUnit,
                                      );
                                      setSelectedStockType((prev) => ({
                                        ...prev,
                                        [line.id]: level.name,
                                      }));
                                      setSelectedQty((prev) => ({
                                        ...prev,
                                        [line.id]: clampReturnQty(prev[line.id], nextMax),
                                      }));
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.stockTypeChipText,
                                        active && styles.stockTypeChipTextSelected,
                                      ]}
                                    >
                                      {level.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                        <View style={styles.qtyRow}>
                          <Text style={styles.qtyLabel}>
                            {t('ordersFlow.returnRefund.returnQty')}
                            {selectedLevel ? ` (${selectedLevel.name})` : ''}
                          </Text>
                          <TextInput
                            style={styles.qtyInput}
                            keyboardType="number-pad"
                            value={qty === '' ? '' : String(qty)}
                            onChangeText={(text) => {
                              setSelectedQty((prev) => ({
                                ...prev,
                                [line.id]: parseReturnQtyDraft(text, maxQty),
                              }));
                            }}
                            onBlur={() => {
                              setSelectedQty((prev) => ({
                                ...prev,
                                [line.id]: clampReturnQty(prev[line.id], maxQty),
                              }));
                            }}
                          />
                          <Text style={styles.itemMeta}>
                            {t('ordersFlow.returnRefund.maxReturnQty', { max: maxQty })}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.reasonsContainer}>
            <Text style={styles.sectionTitle}>{t('ordersFlow.returnRefund.whyTitle')}</Text>
            {RETURN_REASON_IDS.map((reasonId) => (
              <TouchableOpacity
                key={reasonId}
                style={[styles.reasonItem, selectedReason === reasonId && styles.reasonItemSelected]}
                onPress={() => setSelectedReason(reasonId)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedReason === reasonId }}
                accessibilityLabel={`${t(`ordersFlow.returnRefund.reasons.${reasonId}.label`)}: ${t(`ordersFlow.returnRefund.reasons.${reasonId}.description`)}`}
              >
                <View style={styles.reasonContent}>
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reasonId && styles.reasonLabelSelected,
                    ]}
                  >
                    {t(`ordersFlow.returnRefund.reasons.${reasonId}.label`)}
                  </Text>
                  <Text
                    style={[
                      styles.reasonDescription,
                      selectedReason === reasonId && styles.reasonDescriptionSelected,
                    ]}
                  >
                    {t(`ordersFlow.returnRefund.reasons.${reasonId}.description`)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    selectedReason === reasonId && styles.radioButtonSelected,
                  ]}
                >
                  {selectedReason === reasonId && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {selectedReason === 'other' && (
            <View style={styles.customReasonContainer}>
              <Text style={styles.customReasonLabel}>{t('ordersFlow.returnRefund.detailsLabel')}</Text>
              <TextInput
                style={styles.customReasonInput}
                value={reasonDetail}
                onChangeText={setReasonDetail}
                placeholder={t('ordersFlow.returnRefund.detailsPlaceholder')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={scrollToInput}
              />
            </View>
          )}

          <View style={styles.photosSection}>
            <Text style={styles.photosLabel}>{t('ordersFlow.returnRefund.photosLabel', { max: 5 })}</Text>
            <Text style={styles.photosHint}>
              {t('ordersFlow.returnRefund.photosHint')}
            </Text>
            <View style={styles.photoRow}>
              {imageUrls.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => handleRemovePhoto(index)}
                    accessibilityLabel={t('ordersFlow.returnRefund.a11y.removePhoto')}
                    accessibilityRole="button"
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {imageUrls.length < 5 && (
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={styles.photoAdd}
                    onPress={handleTakePhoto}
                    disabled={uploadingPhotos}
                    accessibilityLabel={t('ordersFlow.returnRefund.a11y.camera')}
                    accessibilityRole="button"
                  >
                    {uploadingPhotos ? (
                      <ShimmerIcon size={22} />
                    ) : (
                      <Camera size={22} color="#6b7280" />
                    )}
                    <Text style={styles.photoAddText}>{t('ordersFlow.returnRefund.camera')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoAdd}
                    onPress={handleAddPhotoFromGallery}
                    disabled={uploadingPhotos}
                    accessibilityLabel={t('ordersFlow.returnRefund.a11y.gallery')}
                    accessibilityRole="button"
                  >
                    {uploadingPhotos ? (
                      <ShimmerIcon size={22} />
                    ) : (
                      <ImagePlus size={22} color="#6b7280" />
                    )}
                    <Text style={styles.photoAddText}>{t('ordersFlow.returnRefund.gallery')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.policyBlock}>
            <Text style={styles.policyText}>
              {t('ordersFlow.returnRefund.policyText')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              {isLoading ? t('ordersFlow.returnRefund.submitting') : t('ordersFlow.returnRefund.submit')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollWrapper: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
    marginLeft: 35,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
    marginBottom: 80,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    marginLeft: 12,
    lineHeight: 20,
  },
  orderInfoContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderIdLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  itemsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    paddingBottom: 8,
  },
  itemsHint: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingBottom: 8,
    lineHeight: 16,
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemRowSelected: {
    backgroundColor: '#eff6ff',
  },
  itemCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxSelected: {
    backgroundColor: primaryBlue,
    borderColor: primaryBlue,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  returnControls: {
    marginTop: 10,
    marginLeft: 32,
    gap: 10,
  },
  stockTypeSection: {
    gap: 6,
  },
  stockTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stockTypeChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stockTypeChipSelected: {
    borderColor: primaryBlue,
    backgroundColor: '#dbeafe',
  },
  stockTypeChipText: {
    color: '#111827',
    fontWeight: '500',
    fontSize: 13,
  },
  stockTypeChipTextSelected: {
    color: primaryBlue,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  qtyInput: {
    width: 72,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  reasonsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    padding: 16,
    paddingBottom: 12,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  reasonItemSelected: {
    backgroundColor: '#eff6ff',
  },
  reasonContent: {
    flex: 1,
    marginRight: 12,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  reasonLabelSelected: {
    color: primaryBlue,
  },
  reasonDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  reasonDescriptionSelected: {
    color: primaryBlue,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: primaryBlue,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: primaryBlue,
  },
  customReasonContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  customReasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
    minHeight: 100,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 6,
  },
  policyBlock: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  policyText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  photosSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  photosLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  photosHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 16,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitButton: {
    backgroundColor: primaryBlue,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#F3F4F6',
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
