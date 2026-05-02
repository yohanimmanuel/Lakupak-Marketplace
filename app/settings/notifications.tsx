import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  getPushNotificationsEnabled,
  getPushOrdersEnabled,
  getPushLatestUpdatesEnabled,
  getPushPromotionsEnabled,
} from '../../utils/preferences';
import { pushNotificationService } from '../../services/pushNotifications';
import { useAuthStore } from '../../stores/authStore';
import type { PushNotificationCategory } from '../../utils/preferences';

const UPDATES_CATEGORIES: PushNotificationCategory[] = ['orders', 'latestUpdates'];
const PROMOTIONS_CATEGORIES: PushNotificationCategory[] = ['promotions'];

export default function NotificationSettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  const preferenceUserId = useAuthStore((s) => (s.user?.id != null ? s.user.id : null));

  const [masterOn, setMasterOn] = useState(true);
  const [ordersOn, setOrdersOn] = useState(true);
  const [latestOn, setLatestOn] = useState(true);
  const [promotionsOn, setPromotionsOn] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      pushNotificationService.setPreferenceUserScope(preferenceUserId);
      const [m, o, l, p] = await Promise.all([
        getPushNotificationsEnabled(preferenceUserId),
        getPushOrdersEnabled(preferenceUserId),
        getPushLatestUpdatesEnabled(preferenceUserId),
        getPushPromotionsEnabled(preferenceUserId),
      ]);
      if (!alive) return;
      setMasterOn(m);
      setOrdersOn(o);
      setLatestOn(l);
      setPromotionsOn(p);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [preferenceUserId]);

  const headerTitle = useMemo(() => t('settings.rows.notificationSettings'), [t]);

  const onToggleMaster = useCallback(async (enabled: boolean) => {
    setMasterOn(enabled);
    await pushNotificationService.setMasterEnabled(enabled);
  }, []);

  const setters = useMemo(
    () =>
      ({
        orders: setOrdersOn,
        latestUpdates: setLatestOn,
        promotions: setPromotionsOn,
      }) as const,
    [],
  );

  const values = useMemo(
    () =>
      ({
        orders: ordersOn,
        latestUpdates: latestOn,
        promotions: promotionsOn,
      }) as const,
    [ordersOn, latestOn, promotionsOn],
  );

  const onToggle = useCallback(
    async (category: PushNotificationCategory, enabled: boolean) => {
      setters[category](enabled);
      await pushNotificationService.setCategoryEnabled(category, enabled);
    },
    [setters],
  );

  const categoryControlsActive = hydrated && masterOn;

  const CategoryRow = ({
    category,
    isLastInGroup,
  }: {
    category: PushNotificationCategory;
    isLastInGroup: boolean;
  }) => {
    const labelKey = `settings.pages.notifications.categories.${category}.label`;
    const descKey = `settings.pages.notifications.categories.${category}.description`;
    const on = values[category];
    return (
      <View
        style={[
          styles.row,
          !masterOn && styles.rowMuted,
          isLastInGroup && styles.rowLastInGroup,
        ]}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{t(labelKey)}</Text>
          <Text style={styles.rowSubtitle}>{t(descKey)}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => void onToggle(category, v)}
          disabled={!categoryControlsActive}
          trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
          thumbColor={on ? '#0a61d7' : '#9CA3AF'}
        />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: StyleSheet.hairlineWidth }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>
                  {headerTitle}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.row, styles.rowMaster]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t('settings.pages.notifications.master.label')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.pages.notifications.master.description')}</Text>
          </View>
          <Switch
            value={masterOn}
            onValueChange={(v) => void onToggleMaster(v)}
            disabled={!hydrated}
            trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
            thumbColor={masterOn ? '#0a61d7' : '#9CA3AF'}
          />
        </View>

        <View style={styles.groupBar}>
          <Text style={styles.groupBarText}>{t('settings.pages.notifications.groups.updates')}</Text>
        </View>
        {UPDATES_CATEGORIES.map((c, i) => (
          <CategoryRow
            key={c}
            category={c}
            isLastInGroup={i === UPDATES_CATEGORIES.length - 1}
          />
        ))}

        <View style={styles.groupBar}>
          <Text style={styles.groupBarText}>{t('settings.pages.notifications.groups.promotions')}</Text>
        </View>
        {PROMOTIONS_CATEGORIES.map((c, i) => (
          <CategoryRow
            key={c}
            category={c}
            isLastInGroup={i === PROMOTIONS_CATEGORIES.length - 1}
          />
        ))}

        <Text style={styles.note}>{t('settings.pages.notifications.systemNote')}</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  groupBar: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 0,
  },
  groupBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  rowMaster: {
    marginTop: 4,
  },
  /** No hairline after last row before next gray bar — keeps sections visually grouped */
  rowLastInGroup: {
    borderBottomWidth: 0,
  },
  rowMuted: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  note: {
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 17,
  },
});
