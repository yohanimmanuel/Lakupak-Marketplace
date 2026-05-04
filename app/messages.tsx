import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User as UserIcon, ArrowLeft, ChevronRight, Store } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from 'react-i18next';
import { openWhatsApp } from '../utils/whatsapp';
import { listFollowedDistributors, type FollowedDistributor } from '../services/distributorFollowing';
import { API_BASE_URL } from '../services/config';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  const { t } = useTranslation();
  
  const isAuthenticated = !!token && !!authUser;
  const primaryBlue = '#0a61d7';

  const [items, setItems] = useState<FollowedDistributor[]>([]);
  const [phones, setPhones] = useState<Record<number, string | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const normalizeUrl = useCallback((url?: string | null): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = API_BASE_URL?.replace(/\/$/, '') || '';
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }, []);

  const loadPhones = useCallback(async (list: FollowedDistributor[]) => {
    const base = (API_BASE_URL || '').replace(/\/$/, '');
    const entries = await Promise.all(
      list.map(async (it) => {
        try {
          const res = await fetch(`${base}/api/mobile/distributor/${encodeURIComponent(String(it.distributorId))}`);
          if (!res.ok) return [it.distributorId, null] as const;
          const json = (await res.json()) as Record<string, unknown>;
          const phone =
            (typeof json.businessPhone === 'string' && json.businessPhone) ||
            (typeof json.phone === 'string' && json.phone) ||
            (typeof (json as any)?.company?.businessPhone === 'string' && (json as any).company.businessPhone) ||
            null;
          return [it.distributorId, phone] as const;
        } catch {
          return [it.distributorId, null] as const;
        }
      })
    );
    setPhones((prev) => {
      const next = { ...prev };
      for (const [id, phone] of entries) next[id] = phone;
      return next;
    });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!token) {
      setItems([]);
      setPhones({});
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const data = await listFollowedDistributors(token);
      setItems(data);
      setError(null);
      void loadPhones(data);
    } catch {
      setError(t('messages.errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [token, loadPhones, t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void load();
  }, [isAuthenticated, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const renderLoginPrompt = () => (
    <View style={styles.loginPromptContainer}>
      <View style={styles.loginPromptIcon}>
        <UserIcon color="#0a61d7" size={28} />
      </View>
      <Text style={styles.loginPromptTitle}>
        {t('tabsOrders.loginPrompt.title')}
      </Text>
      <View style={styles.loginPromptButtons}>
        <Link href="/useraccounts/loginsignup/loginmodal" asChild>
          <Pressable style={styles.loginButton}>
            <Text style={styles.loginButtonText}>{t('tabsOrders.loginPrompt.login')}</Text>
          </Pressable>
        </Link>
        <Link href="/useraccounts/loginsignup/signupmodal" asChild>
          <Pressable style={styles.signupButton}>
            <Text style={styles.signupButtonText}>{t('tabsOrders.loginPrompt.signup')}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('messages.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      {isAuthenticated ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: Math.max(24, insets.bottom + 18) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={primaryBlue} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('messages.list.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('messages.list.emptyBody')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((it) => {
                const logo = normalizeUrl(it.logo);
                const phone = phones[it.distributorId] ?? null;
                const disabled = !phone;
                return (
                  <Pressable
                    key={it.distributorId}
                    onPress={() => {
                      if (!phone) return;
                      openWhatsApp({
                        phone,
                        onErrorMessage: t('messages.errors.businessPhoneUnavailable'),
                      });
                    }}
                    style={[styles.row, disabled && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('messages.a11y.openChatWith', { name: it.name })}
                    disabled={disabled}
                  >
                    <View style={styles.avatar}>
                      {logo ? <Image source={{ uri: logo }} style={styles.avatarImg} /> : <Store size={22} color={primaryBlue} />}
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {it.name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {phone ? phone : t('messages.list.noBusinessPhone')}
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
                <Text style={styles.inlineRetryText}>{t('messages.actions.retry')}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        renderLoginPrompt()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  body: { flex: 1, backgroundColor: '#f9fafb' },

  loadingWrap: { paddingTop: 26, alignItems: 'center' },
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
  loginPromptContainer: {
    backgroundColor: '#ffffff',
    padding: 26,
    alignItems: 'center',
  },
  loginPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  loginPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  loginPromptButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  loginButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  signupButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a61d7',
    flex: 1,
  },
  signupButtonText: {
    color: '#0a61d7',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
