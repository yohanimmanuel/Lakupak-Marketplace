import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { marketplaceService } from '../../../services/marketplace';
import { websocketService } from '../../../services/websocket';
import * as ScreenCapture from 'expo-screen-capture';
import { ArrowLeft, Building2, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

type SellerBankDetails = {
  companyName: string;
  billingBankName: string | null;
  billingBankAccountName: string | null;
  billingBankAccountNumber: string | null;
};

type OrderDetails = {
  id: string;
  orderId: string;
  paymentTerms?: string | null;
  userId?: number | null;
  sellerId?: number | null;
  distributorId?: number | null;
  sellerUserId?: number | null;
  storeName?: string;
  user?: {
    company?: {
      businessDescription?: string | null;
      pickupAddress?: string | null;
      businessAddress?: string | null;
    } | null;
  } | null;
};

export default function PayOrder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [bank, setBank] = useState<SellerBankDetails | null>(null);

  const apiBase = useMemo(() => (API_BASE_URL || '').replace(/\/$/, ''), []);

  const fetchOrder = useCallback(async (orderId: string) => {
    const res = await fetch(`${apiBase}/api/orders?id=${encodeURIComponent(orderId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as OrderDetails;
  }, [apiBase, token]);

  const reload = useCallback(async (orderId: string) => {
    const o = await fetchOrder(orderId);
    setOrder(o);

    const terms = (o?.paymentTerms ?? '').toString().toLowerCase();
    const cod = terms.includes('cod') || terms.includes('cash');
    if (cod) {
      setBank(null);
      return;
    }

    const sellerUserIdRaw =
      o?.userId ??
      o?.sellerId ??
      o?.distributorId ??
      o?.sellerUserId ??
      null;
    const sellerUserId = typeof sellerUserIdRaw === 'number' ? sellerUserIdRaw : null;
    if (sellerUserId && token) {
      const bankRes = await marketplaceService.getSellerBankDetails(sellerUserId, token, { fullAccountNumber: true });
      setBank({
        companyName: bankRes.companyName,
        billingBankName: bankRes.billingBankName,
        billingBankAccountName: bankRes.billingBankAccountName,
        billingBankAccountNumber: bankRes.billingBankAccountNumber,
      });
    } else {
      setBank(null);
    }
  }, [fetchOrder, token]);

  const isCod = useMemo(() => {
    const terms = (order?.paymentTerms ?? '').toString().toLowerCase();
    return terms.includes('cod') || terms.includes('cash');
  }, [order?.paymentTerms]);

  // Prevent screenshots / screen recording while bank details are visible.
  useEffect(() => {
    if (loading) return;
    if (isCod) return;
    (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch {
        // best-effort
      }
    })();
    return () => {
      (async () => {
        try {
          await ScreenCapture.allowScreenCaptureAsync();
        } catch {
          // best-effort
        }
      })();
    };
  }, [isCod, loading]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!params.orderId || typeof params.orderId !== 'string' || !token) {
        setLoading(false);
        return;
      }
      try {
        const o = await fetchOrder(params.orderId);
        if (cancelled) return;
        // Use reload() but avoid extra fetchOrder call
        setOrder(o);

        const terms = (o?.paymentTerms ?? '').toString().toLowerCase();
        const cod = terms.includes('cod') || terms.includes('cash');
        if (cod) {
          setBank(null);
          return;
        }

        const sellerUserIdRaw =
          o?.userId ??
          o?.sellerId ??
          o?.distributorId ??
          o?.sellerUserId ??
          null;
        const sellerUserId = typeof sellerUserIdRaw === 'number' ? sellerUserIdRaw : null;
        if (sellerUserId) {
          const bankRes = await marketplaceService.getSellerBankDetails(sellerUserId, token, { fullAccountNumber: true });
          if (cancelled) return;
          setBank({
            companyName: bankRes.companyName,
            billingBankName: bankRes.billingBankName,
            billingBankAccountName: bankRes.billingBankAccountName,
            billingBankAccountNumber: bankRes.billingBankAccountNumber,
          });
        } else {
          setBank(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [params.orderId, token, fetchOrder]);

  // Subscribe to WebSocket for real-time order updates (same pattern as OrderDetails)
  useEffect(() => {
    const orderId = params.orderId;
    if (!orderId || typeof orderId !== 'string') return;
    if (!token) return;

    const unsubscribe = websocketService.subscribe((message) => {
      if (message.type === 'order_updated' && message.orderIds?.includes(orderId)) {
        reload(orderId).catch(() => {
          // ignore
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [params.orderId, token, reload]);

  const distributorDescription = order?.user?.company?.businessDescription ?? null;
  const distributorAddress =
    order?.user?.company?.pickupAddress ??
    order?.user?.company?.businessAddress ??
    null;

  const distributorId: string | null = useMemo(() => {
    const raw =
      order?.userId ??
      order?.sellerId ??
      order?.distributorId ??
      order?.sellerUserId ??
      null;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' && raw > 0) return String(raw);
    return null;
  }, [order?.distributorId, order?.sellerId, order?.sellerUserId, order?.userId]);
  const primaryBlue = '#0a61d7';

  const payOrderHeader = () => (
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
        <Text style={styles.headerTitle}>{t('ordersFlow.payOrder.title')}</Text>
      </View>
    </View>
  );

  const payOrderScreenOptions = {
    presentation: 'modal' as const,
    header: payOrderHeader,
  };

  const handlePay = async () => {
    if (!token || !order?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/mobile/orders/${encodeURIComponent(order.id)}/pay-intent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Pay request failed (${res.status})`);
      }

      Alert.alert(
        t('ordersFlow.payOrder.alerts.paymentSentTitle'),
        t('ordersFlow.payOrder.alerts.paymentSentBody')
      );
      router.back();
    } catch (e) {
      Alert.alert(t('ordersFlow.payOrder.alerts.failedTitle'), t('ordersFlow.payOrder.alerts.failedBody'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={payOrderScreenOptions} />
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('ordersFlow.payOrder.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={payOrderScreenOptions} />
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <View style={styles.productCard}>
            <View style={styles.sectionTitleContainer}>
              <Building2 size={20} color={primaryBlue} />
              <Text style={styles.sectionTitle}>{t('ordersFlow.payOrder.sections.distributorInfoTitle')}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!distributorId) {
                    Alert.alert(t('ordersFlow.payOrder.alerts.unavailableTitle'), t('ordersFlow.payOrder.alerts.unavailableBody'));
                    return;
                  }
                  router.push({
                    pathname: '/useraccounts/buyernetworks/distributor-detail',
                    params: { id: distributorId },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={t('ordersFlow.payOrder.buttons.viewDistributorDetails')}
                style={[
                  styles.viewDistributorButton,
                  !distributorId && styles.viewDistributorButtonDisabled,
                ]}
                disabled={!distributorId}
              >
                <Text style={[styles.viewDistributorButtonText, !distributorId && styles.viewDistributorButtonTextDisabled]}>
                  {t('ordersFlow.payOrder.buttons.view')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.payOrder.labels.company')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueWide]}>
                {bank?.companyName || order?.storeName || '-'}
              </Text>
            </View>

            <View style={styles.infoRowTopAligned}>
              <Text style={styles.infoLabel}>{t('ordersFlow.payOrder.labels.description')}:</Text>
              <Text style={[styles.infoValueMultiline, styles.infoValueWide]}>
                {distributorDescription?.trim() ? distributorDescription : '-'}
              </Text>
            </View>

            <View style={styles.infoRowTopAligned}>
              <Text style={styles.infoLabel}>{t('ordersFlow.payOrder.labels.address')}:</Text>
              <Text style={[styles.infoValueMultiline, styles.infoValueWide]}>
                {distributorAddress?.trim() ? distributorAddress : '-'}
              </Text>
            </View>
          </View>
        </View>

        {isCod ? (
          <View style={styles.section}>
            <View style={styles.productCard}>
              <View style={styles.sectionTitleContainer}>
                <FileText size={20} color={primaryBlue} />
                <Text style={styles.sectionTitle}>{t('ordersFlow.payOrder.sections.paymentTitle')}</Text>
              </View>

              <View style={styles.infoRowTopAligned}>
                <Text style={styles.infoLabel}>{t('ordersFlow.payOrder.labels.method')}:</Text>
                <Text style={[styles.infoValueMultiline, styles.infoValueWide]}>{t('ordersFlow.payOrder.sections.codTitle')}</Text>
              </View>

              <Text style={styles.hintText}>
                {t('ordersFlow.payOrder.sections.codBody')}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.productCard}>
              <View style={styles.sectionTitleContainer}>
                <FileText size={20} color={primaryBlue} />
                <Text style={styles.sectionTitle}>{t('ordersFlow.payOrder.sections.bankTransferTitle')}</Text>
              </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.payOrder.labels.bank')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueWide]}>
                {bank?.billingBankName || '-'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.payOrder.labels.accountName')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueWide]}>
                {bank?.billingBankAccountName || '-'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.payOrder.labels.accountNumber')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueWide]}>
                {bank?.billingBankAccountNumber || '-'}
              </Text>
            </View>

              <Text style={styles.hintText}>
                {t('ordersFlow.payOrder.hints.bankPrivacy')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {isCod ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <TouchableOpacity style={styles.payButton} onPress={() => router.back()}>
            <Text style={styles.payButtonText}>{t('ordersFlow.payOrder.buttons.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <TouchableOpacity
            style={[styles.payButton, submitting ? styles.disabledButton : null]}
            disabled={submitting}
            onPress={handlePay}
          >
            <Text style={[styles.payButtonText, submitting ? styles.disabledButtonText : null]}>
              {submitting ? t('ordersFlow.payOrder.buttons.sending') : t('ordersFlow.payOrder.buttons.pay')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  viewDistributorButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  viewDistributorButtonDisabled: {
    opacity: 0.5,
  },
  viewDistributorButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a61d7',
  },
  viewDistributorButtonTextDisabled: {
    color: '#6B7280',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flexShrink: 0,
    marginRight: 20,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  infoRowTopAligned: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
    gap: 12,
  },
  infoValueMultiline: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  infoValueWide: {
    minWidth: 220,
    textAlign: 'right',
  },
  hintText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  payButton: {
    backgroundColor: '#0a61d7',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  payButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  disabledButton: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#ffffff',
    opacity: 0.7,
  },
});

