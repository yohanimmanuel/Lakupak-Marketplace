import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Linking,
  StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import {
  fetchPublishedLatestUpdateById,
  markAnnouncementRead,
  type PlatformAnnouncement,
} from '../../../../services/latestUpdatesService';
import { useAuthStore } from '../../../../stores/authStore';
import { useDataStore } from '../../../../stores/dataStore';
import { decodeToken } from '../../../../services/graphql';
import { useTranslation } from 'react-i18next';
import { ArticleDetailSkeleton } from '../../SkeletonLoader';

const primaryBlue = '#0a61d7';

export default function LatestUpdateDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.toLowerCase().startsWith('id') ? 'id-ID' : 'en-US';
  const [item, setItem] = useState<PlatformAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const id = Number(idParam);
  /** Positive = platform announcement; negative = homepage offer (see Dashboard latest-updates API). */
  const validId = Number.isInteger(id) && id !== 0;

  useEffect(() => {
    if (!validId) {
      setLoading(false);
      setErr(t('latestUpdatesDetail.states.invalid'));
      return;
    }
    if (!hasHydrated) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const currentToken = useAuthStore.getState().token;
        useDataStore.getState().retainStorefront(currentToken);
        const distributorId = currentToken ? (decodeToken(currentToken).distributorId ?? null) : null;
        const a = await fetchPublishedLatestUpdateById(id, distributorId);
        if (cancelled) return;
        if (!a) {
          setErr(t('latestUpdatesDetail.states.noLongerAvailable'));
          setItem(null);
        } else {
          setErr(null);
          setItem(a);
          const uid = authUser?.id ?? null;
          // Fire-and-forget: marking read is non-critical
          markAnnouncementRead(a.id, uid).catch(() => {});
        }
      } catch {
        if (!cancelled) setErr(t('latestUpdatesDetail.states.failedToLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, validId, authUser?.id, token, hasHydrated, t]);

  const openLink = async () => {
    if (!item?.linkUrl?.trim()) return;
    const url = item.linkUrl.trim();
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel={t('latestUpdatesDetail.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('latestUpdatesDetail.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      {loading ? (
        <ArticleDetailSkeleton />
      ) : err || !item ? (
        <View style={styles.center}>
          <Text style={styles.err}>{err || t('latestUpdatesDetail.states.notFound')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.contentCard}>
            <Text style={styles.title}>{item.title}</Text>
            {(() => {
              const rawDate = item.publishedAt ?? item.createdAt;
              if (!rawDate) return null;
              const d = new Date(rawDate);
              if (!Number.isFinite(d.getTime())) return null;
              return (
                <Text style={styles.meta}>
                  {d.toLocaleString(locale, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              );
            })()}
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <Text style={styles.body}>{item.body}</Text>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.hero} resizeMode="cover" />
            ) : null}
            {item.linkUrl ? (
              <TouchableOpacity style={styles.linkBtn} onPress={openLink} activeOpacity={0.85}>
                <Text style={styles.linkBtnText}>{t('latestUpdatesDetail.actions.openLink')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  err: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 56,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  meta: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: primaryBlue,
    textTransform: 'capitalize',
  },
  body: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  hero: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginBottom: 16,
  },
  linkBtn: {
    backgroundColor: primaryBlue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  linkBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

