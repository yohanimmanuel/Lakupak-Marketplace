import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';
import { API_BASE_URL } from '../../../services/config';
import { useTranslation } from 'react-i18next';
import { ProductReviewsListSkeleton } from '../../components/SkeletonLoader';

type DistributorReviewItem = {
  id: number;
  overallRating: number;
  comment?: string;
  createdAt: string;
  reviewerDisplayName: string;
  reviewerProfileImage?: string;
  wouldOrderAgain?: string;
};

type DistributorReviewsData = {
  distributorId: number;
  totalReviews: number;
  overallRating: number;
  breakdown: Record<number, number>;
  reviews: DistributorReviewItem[];
  page: number;
  limit: number;
  totalPages: number;
};

type Params = { distributorId?: string; distributorName?: string };

const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function DistributorReviewsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams() as Params;
  const distributorId =
    typeof params.distributorId === 'string' ? params.distributorId : '';
  const distributorName =
    typeof params.distributorName === 'string' ? params.distributorName : '';

  const primaryBlue = '#0a61d7';

  const [data, setData] = useState<DistributorReviewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (page: number): Promise<DistributorReviewsData> => {
      if (!distributorId) throw new Error('distributorId is required');
      const limit = 10;
      const res = await fetch(
        `${API_BASE_URL}/api/mobile/reviews/distributor?distributorId=${encodeURIComponent(distributorId)}&page=${page}&limit=${limit}`,
      );
      const json = (await res.json().catch(() => null)) as DistributorReviewsData | null;
      if (!res.ok || !json) {
        throw new Error(
          (json as unknown as { error?: string })?.error || 'Failed to load reviews',
        );
      }
      return {
        ...json,
        breakdown: json.breakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        page: json.page ?? page,
        limit: json.limit ?? limit,
        totalPages: json.totalPages ?? 1,
      };
    },
    [distributorId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!distributorId) return;
    setLoading(true);
    setError(null);
    setData(null);
    fetchPage(1)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reviews');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, distributorId]);

  const canLoadMore = useMemo(() => {
    if (!data) return false;
    return data.page < data.totalPages;
  }, [data]);

  const onEndReached = async () => {
    if (!data || loadingMore || loading || !canLoadMore) return;
    try {
      setLoadingMore(true);
      const next = await fetchPage(data.page + 1);
      if (!next) return;
      setData((prev) => {
        if (!prev) return next;
        return { ...next, reviews: [...prev.reviews, ...next.reviews] };
      });
    } catch {
      // ignore load-more errors
    } finally {
      setLoadingMore(false);
    }
  };

  const renderStars = (value: number, size: number) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          color={s <= value ? '#fbbf24' : '#d1d5db'}
          fill={s <= value ? '#fbbf24' : 'none'}
        />
      ))}
    </View>
  );

  const header = () => {
    if (!data) return null;
    const total = data.totalReviews ?? 0;
    const overall = data.overallRating ?? 0;
    const breakdown = data.breakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    return (
      <View style={styles.headerWrap}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {t('distributorReviewsList.sections.overall')}
          </Text>
          <View style={styles.overallRow}>
            <Text style={styles.overallNumber}>{overall.toFixed(1)}</Text>
            <View style={{ marginLeft: 10 }}>
              {renderStars(Math.round(overall), 16)}
              <Text style={styles.subtleText}>
                {total}{' '}
                {total === 1
                  ? t('buyerNetworks.sellerInformation.labels.review')
                  : t('buyerNetworks.sellerInformation.labels.reviews')}
              </Text>
            </View>
          </View>

          <View style={styles.breakdownWrap}>
            {[5, 4, 3, 2, 1].map((r) => {
              const count = breakdown[r] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <View key={r} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{r}★</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewCardHeaderText}>
            {t('distributorReviewsList.sections.latest')}
          </Text>
        </View>
      </View>
    );
  };

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
                  accessibilityRole="button"
                  accessibilityLabel={t('distributorReviewsList.a11y.back')}
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text
                  numberOfLines={1}
                  style={{
                    color: '#111827',
                    fontSize: 20,
                    fontWeight: '500',
                    flex: 1,
                    textAlign: 'left',
                    marginLeft: 35,
                  }}
                >
                  {distributorName
                    ? t('distributorReviewsList.titleWithName', {
                        name: distributorName,
                      })
                    : t('distributorReviewsList.title')}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      {loading ? (
        <ProductReviewsListSkeleton />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.centerText}>
            {t('distributorReviewsList.states.failed')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data?.reviews ?? []}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingTop: 16,
            paddingBottom: 24,
          }}
          ListHeaderComponent={header}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 14 }}>
                <ActivityIndicator color={primaryBlue} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.centerText}>
                {t('buyerNetworks.sellerInformation.labels.noReviewsYet')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const avatarUri = item.reviewerProfileImage
              ? normalizeUrl(item.reviewerProfileImage)
              : undefined;
            const isFirst = index === 0;
            const isLast =
              !!data?.reviews && index === data.reviews.length - 1;
            return (
              <View
                style={[
                  styles.reviewRow,
                  isFirst && styles.reviewRowFirst,
                  isLast && styles.reviewRowLast,
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.avatarWrap}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {(item.reviewerDisplayName || 'U').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {item.reviewerDisplayName}
                    </Text>
                    {renderStars(item.overallRating, 14)}
                  </View>
                </View>

                {item.comment ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.commentText}>{item.comment}</Text>
                    <Text style={styles.dateText}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.dateText}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  headerWrap: { paddingBottom: 0 },
  reviewCardHeader: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginTop: 0,
    marginBottom: 0,
  },
  reviewCardHeaderText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sectionCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  overallRow: { flexDirection: 'row', alignItems: 'center' },
  overallNumber: { fontSize: 34, fontWeight: '800', color: '#111827' },
  subtleText: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  breakdownWrap: { marginTop: 12, gap: 8 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  breakdownLabel: { width: 34, fontSize: 12, color: '#6b7280' },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#eef2f7',
    borderRadius: 8,
    overflow: 'hidden',
  },
  barFill: { height: 8, backgroundColor: '#FCD34D' },
  breakdownCount: {
    width: 30,
    textAlign: 'right',
    fontSize: 12,
    color: '#6b7280',
  },
  reviewRow: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  reviewRowFirst: { borderTopWidth: 0 },
  reviewRowLast: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginBottom: 8,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40 },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#0a61d7' },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  commentText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  dateText: { marginTop: 8, fontSize: 11, color: '#9ca3af' },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
