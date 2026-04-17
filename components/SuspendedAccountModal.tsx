import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const SUSPENSION_NOTICE_SECONDS = 60;

export default function SuspendedAccountModal() {
  const router = useRouter();
  const suspension = useAuthStore((s) => s.suspension);
  const setSuspension = useAuthStore((s) => s.setSuspension);
  const logout = useAuthStore((s) => s.logout);
  const isRedirectingRef = useRef(false);

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
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;

    // Auto-redirect after countdown
    (async () => {
      // Clear auth state first (sync), then navigate. Avoid re-triggering suspension from in-flight requests.
      logout().catch(() => {});
      setSuspension(false);
      router.replace('/useraccounts/welcome');
    })();
  }, [secondsLeft, suspension.active, logout, router, setSuspension]);

  const goToLoginNow = async () => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    // Clear auth state first (sync), then navigate. Avoid re-triggering suspension from in-flight requests.
    logout().catch(() => {});
    setSuspension(false);
    router.replace('/useraccounts/welcome');
  };

  const reason = (suspension.reason ?? '').trim();

  return (
    <Modal visible={suspension.active} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 16, padding: 18 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Account suspended</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: '#4b5563' }}>
            Your account has been suspended for a moment. You will be redirected to the login screen in{' '}
            <Text style={{ fontWeight: '700', color: '#111827' }}>{secondsLeft}s</Text>.
          </Text>

          <View style={{ marginTop: 14, padding: 12, backgroundColor: '#fef2f2', borderRadius: 12 }}>
            <Text style={{ fontSize: 13, color: '#991b1b', lineHeight: 18 }}>
              This helps protect the platform from abusive traffic and unexpected API costs.
            </Text>
          </View>

          {reason ? (
            <View style={{ marginTop: 10, padding: 12, backgroundColor: '#fffbeb', borderRadius: 12 }}>
              <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 18 }}>
                Reason: <Text style={{ fontWeight: '700' }}>{reason}</Text>
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
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>Go to login</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              // Keep modal visible; block access while suspended
            }}
            style={{ marginTop: 10, alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 12, color: '#6b7280' }}>This notice can’t be dismissed.</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

