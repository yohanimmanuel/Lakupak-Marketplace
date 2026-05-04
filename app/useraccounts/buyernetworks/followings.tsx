import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Store } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { listFollowedDistributors, type FollowedDistributor } from '../../../services/distributorFollowing';
import { API_BASE_URL } from '../../../services/config';
import { useTranslation } from 'react-i18next';

const primaryBlue = '#0a61d7';

const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function FollowingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();

  const [items, setItems] = useState<FollowedDistributor[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = !!token;

  const load = useCallback(
    async (silent = false) => {
      if (!token) {
        setItems([]);
        return;
      }
      if (!silent) setError(null);
      try {
        const data = await listFollowedDistributors(token);
        setItems(data);
        setError(null);
      } catch {
        setError(t('followingsPage.errors.failedToLoad'));
      }
    },
    [token, t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const title = useMemo(() => t('followingsPage.title'), [t]);

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
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('followingsPage.a11y.back')}
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{title}</Text>
              </View>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: Math.max(24, insets.bottom + 18) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {!canLoad ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('followingsPage.states.loginRequiredTitle')}</Text>
            <Text style={styles.emptyText}>{t('followingsPage.states.loginRequiredBody')}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('followingsPage.states.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('followingsPage.states.emptyBody')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((it) => {
              const logo = normalizeUrl(it.logo);
              return (
                <Pressable
                  key={it.distributorId}
                  onPress={() =>
                    router.push({
                      pathname: '/useraccounts/buyernetworks/distributor-information',
                      params: { id: String(it.distributorId), name: it.name },
                    })
                  }
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={t('followingsPage.a11y.openStore', { name: it.name })}
                >
                  <View style={styles.avatar}>
                    {logo ? <Image source={{ uri: logo }} style={styles.avatarImg} /> : <Store size={22} color={primaryBlue} />}
                  </View>
                  <View style={styles.rowTextCol}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {t('followingsPage.row.followed')}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#9ca3af" />
                </Pressable>
              );
            })}
          </View>
        )}

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.inlineRetryBtn} accessibilityRole="button">
              <Text style={styles.inlineRetryText}>{t('followingsPage.errors.retry')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  body: { flex: 1, backgroundColor: '#f9fafb' },

  list: { paddingHorizontal: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44 },
  rowTextCol: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowSub: { marginTop: 4, fontSize: 12, color: '#6b7280' },

  empty: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  emptyText: { marginTop: 6, fontSize: 12, color: '#6b7280', textAlign: 'center' },

  inlineError: { marginTop: 12, marginHorizontal: 16, padding: 12, borderRadius: 12, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecaca' },
  inlineErrorText: { fontSize: 12, color: '#7f1d1d' },
  inlineRetryBtn: { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#ef4444' },
  inlineRetryText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
});

