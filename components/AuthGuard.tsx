import React, { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, user, isLoading, suspension } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    // If account is suspended, keep the current screen so the modal can block and countdown.
    if (suspension.active) {
      return;
    }
    const isAuthenticated = !!token && !!user;
    const isAuthRoute = segments[0] === 'useraccounts';
    const authEntryScreens = new Set(['welcome', 'loginsignup']);
    const isAuthEntryScreen = isAuthRoute && authEntryScreens.has(String(segments[1] ?? ''));

    if (!isAuthenticated && !isAuthRoute) {
      router.replace('/useraccounts/welcome');
    } else if (isAuthenticated && isAuthEntryScreen) {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, token, user, suspension.active, segments, router]);

  return <>{children}</>;
}
