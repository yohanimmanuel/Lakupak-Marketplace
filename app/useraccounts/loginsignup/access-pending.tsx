import React, { useEffect } from 'react';
import { View, Text, Pressable, StatusBar, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  ensureMembershipPendingInbox,
  MEMBERSHIP_ACCESS_EVENT,
} from '../../../services/membershipPendingNotify';
import { useAuthStore } from '../../../stores/authStore';

export default function AccessPendingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    void ensureMembershipPendingInbox({
      userId,
      title: t('tabsNotifications.membershipPending.title'),
      body: t('tabsNotifications.membershipPending.body'),
    });
  }, [userId, t]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      MEMBERSHIP_ACCESS_EVENT,
      (payload: { status?: string } | undefined) => {
        if (payload?.status === 'active') {
          router.replace('/(tabs)/home');
        }
      },
    );
    return () => sub.remove();
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fffbeb' }} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fffbeb" />
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48, justifyContent: 'center' }}>
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#fde68a',
              backgroundColor: '#fffbeb',
              padding: 24,
            }}
          >
            <Text style={{ color: '#78350f', fontSize: 24, fontWeight: '700', marginBottom: 12 }}>
              {t('auth.membership.pendingTitle')}
            </Text>
            <Text style={{ color: '#92400e', fontSize: 15, lineHeight: 22 }}>
              {t('auth.membership.pendingBody')}
            </Text>
            <Pressable
              onPress={() => router.replace('/(tabs)/notifications')}
              style={{
                marginTop: 24,
                height: 48,
                borderRadius: 12,
                backgroundColor: '#0a61d7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
                {t('auth.membership.viewNotifications')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/(tabs)/home')}
              style={{
                marginTop: 12,
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#fde68a',
                backgroundColor: '#fffbeb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#92400e', fontSize: 15, fontWeight: '600' }}>
                {t('auth.membership.backHome')}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
