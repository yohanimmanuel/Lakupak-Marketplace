import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getPushNotificationsEnabled } from '../../utils/preferences';
import { pushNotificationService } from '../../services/pushNotifications';
import { useAuthStore } from '../../stores/authStore';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  const preferenceUserId = useAuthStore((s) => (s.user?.id != null ? s.user.id : null));

  const [pushEnabled, setPushEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      pushNotificationService.setPreferenceUserScope(preferenceUserId);
      const enabled = await getPushNotificationsEnabled(preferenceUserId);
      if (!alive) return;
      setPushEnabled(enabled);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [preferenceUserId]);

  const headerTitle = useMemo(() => t('settings.rows.notificationSettings'), [t]);

  const onTogglePush = async (enabled: boolean) => {
    setPushEnabled(enabled);
    await pushNotificationService.setEnabled(enabled);
  };

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
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

      <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <View style={styles.card}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>{t('settings.pages.notifications.push.label')}</Text>
            <Text style={styles.desc}>{t('settings.pages.notifications.push.description')}</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={onTogglePush}
            disabled={!hydrated}
            trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
            thumbColor={pushEnabled ? '#0a61d7' : '#9CA3AF'}
          />
        </View>

        <Text style={styles.note}>{t('settings.pages.notifications.systemNote')}</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: { fontSize: 15, fontWeight: '800', color: '#111827' },
  desc: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  note: { paddingHorizontal: 16, marginTop: 10, fontSize: 12, color: '#6B7280' },
});

