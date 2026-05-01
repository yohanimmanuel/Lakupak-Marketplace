import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from 'react-i18next';

const SUSPENSION_NOTICE_SECONDS = 60;

export default function SuspendedAccountModal() {
  const suspension = useAuthStore((s) => s.suspension);
  const setSuspension = useAuthStore((s) => s.setSuspension);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useTranslation();

  const startedAt = suspension.startedAt ?? null;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!suspension.active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [suspension.active]);

  const secondsLeft = useMemo(() => {
    if (!suspension.active || !startedAt) return 0;
    const elapsed = Math.floor((now - startedAt) / 1000);
    return Math.max(0, SUSPENSION_NOTICE_SECONDS - elapsed);
  }, [suspension.active, startedAt, now]);

  useEffect(() => {
    if (!suspension.active) return;
    if (secondsLeft > 0) return;
    // Auto-redirect after countdown
    // Clear auth state; AuthGuard will redirect to /useraccounts/welcome.
    logout()
      .catch((err) => console.error('Logout failed:', err))
      .finally(() => setSuspension(false));
  }, [secondsLeft, suspension.active, logout, setSuspension]);

  const goToLoginNow = () => {
    // Clear auth state; AuthGuard will redirect to /useraccounts/welcome.
    logout()
      .catch((err) => console.error('Logout failed:', err))
      .finally(() => setSuspension(false));
  };

  const reason = (suspension.reason ?? '').trim();

  return (
    <Modal visible={suspension.active} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 16, padding: 18 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{t('suspension.title')}</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: '#4b5563' }}>
            {t('suspension.body', { seconds: secondsLeft })}
          </Text>

          <View style={{ marginTop: 14, padding: 12, backgroundColor: '#fef2f2', borderRadius: 12 }}>
            <Text style={{ fontSize: 13, color: '#991b1b', lineHeight: 18 }}>
              {t('suspension.protectionNote')}
            </Text>
          </View>

          {reason ? (
            <View style={{ marginTop: 10, padding: 12, backgroundColor: '#fffbeb', borderRadius: 12 }}>
              <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 18 }}>
                {t('suspension.reasonLabel')}{' '}
                <Text style={{ fontWeight: '700' }}>{reason}</Text>
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={goToLoginNow}
              style={{
                flex: 1,
                backgroundColor: '#0a61d7',
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>{t('suspension.goToLogin')}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              // Keep modal visible; block access while suspended
            }}
            style={{ marginTop: 10, alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('suspension.notDismissible')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

