import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, user, isLoading, hasHydrated, suspension } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    // If account is suspended, keep the current screen so the modal can block and countdown.
    if (suspension?.active) {
      return;
    }
    const isAuthenticated = !!token && !!user;
    const isAuthRoute = segments[0] === 'useraccounts';

    if (!isAuthenticated && !isAuthRoute) {
      router.replace('/useraccounts/welcome');
    } else if (isAuthenticated && isAuthRoute && segments[0] !== 'useraccounts') {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, token, user, suspension.active, segments, router]);

  if (isLoading && !hasHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#ec4899" />
      </View>
    );
  }

  return <>{children}</>;
}

