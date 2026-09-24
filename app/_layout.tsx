import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from '../services/config';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { useCartStore } from '../stores/cartStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { pushNotificationService } from '../services/pushNotifications';
import { applyStoredUserPreferences } from '../utils/applyStoredUserPreferences';
import { getPreferredLanguage, getLanguageForPublicOrGuestSession } from '../utils/preferences';
import SuspendedAccountModal from '../components/SuspendedAccountModal';
import AuthGuard from '../components/AuthGuard';
import { logMobileEnvWarnings } from '../utils/validateEnv';

import i18n from '../i18n';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Removed unstable_settings - using index.tsx for routing

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    logMobileEnvWarnings('marketplace');
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Keep native splash visible to cover initialization
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 1000); // 1s splash like Shopee
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const router = useRouter();
  const { t } = useTranslation();
  const { hydrateFromStorage, token, user, hasHydrated } = useAuthStore();
  const preferenceUserId = user?.id ?? null;
  const { refreshAllData, startAutoRefresh, stopAutoRefresh } = useDataStore();
  const { initializeCart } = useCartStore();
  const { loadUserActivities } = useUserActivityStore();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const sessionStartedAt = useRef<string | null>(null);
  const sessionFlushId = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendSessionSample = useCallback(async (startedAt: string, endedAt: string) => {
    const durationSec = Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
    if (!Number.isFinite(durationSec) || durationSec <= 2) return;
    const t = useAuthStore.getState().token;
    if (!t) return;
    try {
      await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/mobile/telemetry/session`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ startedAt, endedAt, durationSec }),
      });
    } catch {
      // ignore
    }
  }, []);

  const startFlushTimer = useCallback(() => {
    if (sessionFlushId.current) return;
    sessionFlushId.current = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const startedAt = sessionStartedAt.current;
      if (!startedAt) return;
      const endedAt = new Date().toISOString();
      sessionStartedAt.current = endedAt;
      void sendSessionSample(startedAt, endedAt);
    }, 60_000);
  }, [sendSessionSample]);

  const stopFlushTimer = useCallback(() => {
    if (!sessionFlushId.current) return;
    clearInterval(sessionFlushId.current);
    sessionFlushId.current = null;
  }, []);

  const startSessionIfNeeded = useCallback(() => {
    if (!sessionStartedAt.current) sessionStartedAt.current = new Date().toISOString();
    startFlushTimer();
  }, [startFlushTimer]);

  const stopSessionAndFlush = useCallback(() => {
    stopFlushTimer();
    const startedAt = sessionStartedAt.current;
    sessionStartedAt.current = null;
    if (startedAt) {
      void sendSessionSample(startedAt, new Date().toISOString());
    }
  }, [sendSessionSample, stopFlushTimer]);

  useEffect(() => {
    const initializeApp = async () => {
      // Hydrate auth state first
      await hydrateFromStorage();

      // Get token and user after hydration
      const currentToken = useAuthStore.getState().token;
      const currentUser = useAuthStore.getState().user;
      
      // Load user activities (liked products, viewed products, etc.) if user is logged in
      if (currentUser?.id) {
        await loadUserActivities(currentUser.id);
      }
      
      // Preload all data immediately
      await refreshAllData(currentToken || undefined);
    };
    
    initializeApp();
  }, [hydrateFromStorage, refreshAllData, initializeCart, startAutoRefresh, loadUserActivities]);

  useEffect(() => {
    if (!hasHydrated) return;
    void applyStoredUserPreferences(preferenceUserId);
  }, [hasHydrated, preferenceUserId]);

  // Handle app state changes to pause/resume auto-refresh
  useEffect(() => {
    // Handle initial state (no transition event fired on mount)
    if (AppState.currentState === 'active') {
      startSessionIfNeeded();
      startAutoRefresh(useAuthStore.getState().token || undefined);
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        startSessionIfNeeded();
        // App is in foreground - start auto-refresh with WebSocket + polling fallback
        const currentToken = useAuthStore.getState().token;
        const currentUser = useAuthStore.getState().user;
        startAutoRefresh(currentToken || undefined);

        // Retry push registration if we still don't have a token (e.g. first run failed, permission granted later, FCM later available)
        if (currentUser?.id && currentToken && !pushNotificationService.getPushToken()) {
          try {
            const storedLang = await getPreferredLanguage(currentUser.id);
            const language = storedLang ?? 'id';
            const pushToken = await pushNotificationService.registerForPushNotifications();
            if (pushToken) {
              await pushNotificationService.savePushTokenToServer(
                currentUser.id,
                pushToken,
                currentToken,
                language,
              );
              await pushNotificationService.setMarketplaceUserPushLanguage(currentToken, language);
            }
          } catch {
            // Silently handle errors - will retry on next foreground
          }
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        stopSessionAndFlush();
        stopAutoRefresh();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      stopSessionAndFlush();
      stopAutoRefresh();
    };
  }, [startAutoRefresh, startSessionIfNeeded, stopAutoRefresh, stopSessionAndFlush]);

  // Reconnect WebSocket when token becomes available
  useEffect(() => {
    if (token) {
      if (AppState.currentState === 'active') startSessionIfNeeded();
      startAutoRefresh(token);
    }
  }, [token, startAutoRefresh, startSessionIfNeeded]);

  // Initialize push notifications
  useEffect(() => {
    const initializePushNotifications = async () => {
      const uid = user?.id ?? null;
      const stored =
        uid != null ? await getPreferredLanguage(uid) : await getLanguageForPublicOrGuestSession();
      const language = stored ?? 'id';

      const pushToken = await pushNotificationService.registerForPushNotifications();

      if (pushToken && user?.id && token && pushToken !== pushNotificationService.getLastSavedToken()) {
        await pushNotificationService.savePushTokenToServer(
          user.id,
          pushToken,
          token,
          language,
        );
      }
      if (token && user?.id) {
        await pushNotificationService.setMarketplaceUserPushLanguage(token, language);
      }
    };

    initializePushNotifications();

    // When a push arrives in foreground, show one in-app notification with same title/body (no default; dedup with WebSocket)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      if (AppState.currentState !== 'active') return;
      const trigger = notification.request.trigger as { type?: string } | null;
      const isRemote = trigger && trigger.type === 'push';
      if (!isRemote) return;
      const content = notification.request.content;
      const data = content.data as {
        type?: string;
        orderId?: string;
        orderStatus?: string;
        paymentStatus?: string;
        event?: string;
      } | undefined;
      if (data?.type === 'order' && data?.orderId) {
        const isPricingSent =
          data.event === 'pricing_sent' ||
          (data.orderStatus || '').toLowerCase() === 'pricing_sent';
        // Forward the server-supplied title/body so non-status pushes (e.g. return-refund
        // submitted, pricing_sent) don't get re-derived to the generic "Order <Status>"
        // copy from `getBuyerOrderNotificationStrings`.
        pushNotificationService.showOrderNotificationInApp(
          String(data.orderId),
          isPricingSent ? 'pricing_sent' : (data.orderStatus ?? ''),
          content.title ?? undefined,
          content.body ?? undefined,
        );
        if (isPricingSent) {
          void useDataStore.getState().loadOrdersData(true);
        }
        return;
      }

      // Payment notifications (e.g. "Your payment has been confirmed") should also show in foreground.
      if (data?.type === 'payment') {
        void pushNotificationService.scheduleLocalNotification(
          content.title ?? i18n.t('orderUpdates.payment.foregroundBannerTitle'),
          content.body ?? '',
          data as Record<string, unknown>,
          'orders'
        );
      }
    });

    // Listen for notification interactions (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        
        // Navigate based on notification type
        if (data?.type === 'order' && data?.orderId) {
          router.push({
            pathname: '/components/ordersshipment/OrderDetails',
            params: { orderId: String(data.orderId) },
          });
        }
        if (data?.type === 'payment' && data?.orderId) {
          router.push({
            pathname: '/components/ordersshipment/OrderDetails',
            params: { orderId: String(data.orderId) },
          });
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.id, token, router]);

  // Reload all data when user logs in or changes (after logout/login)
  useEffect(() => {
    const reloadUserData = async () => {
      if (!token || !user?.id) {
        stopAutoRefresh();
        if (hasHydrated) {
          useCartStore.getState().initializeCart();
        }
        return;
      }

      // User logged in or changed - reload everything immediately
      try {
        // Initialize cart for new user
        initializeCart();
        
        // Load user activities (liked products, etc.)
        await loadUserActivities(user.id);
        
        // Refresh all data (products, orders, user profile, address)
        await refreshAllData(token);
        
        // Start WebSocket/auto-refresh
        if (AppState.currentState === 'active') {
          startAutoRefresh(token);
        }
      } catch {
        // Silently handle errors
      }
    };

    reloadUserData();
  }, [user?.id, token, hasHydrated, initializeCart, loadUserActivities, refreshAllData, startAutoRefresh, stopAutoRefresh]);

  // Cart offline/online: mark online on launch and when app returns to foreground, then sync.
  useEffect(() => {
    const { setOnlineStatus } = useCartStore.getState();
    setOnlineStatus(true);

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setOnlineStatus(true);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <SuspendedAccountModal />
        <AuthGuard>
          <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { backgroundColor: '#f9fafb' } }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="useraccounts/welcome" options={{ headerShown: false }} />
        <Stack.Screen
          name="useraccounts/startdistributing"
          options={{
            presentation: 'modal',
            title: t('nav.welcomeToLaku'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        {/* Buyer Networks (My Networks) modal */}
        <Stack.Screen
          name="useraccounts/buyernetworks/mynetworks"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('nav.myNetworks'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827', fontWeight: '600' },
            headerTintColor: '#0a61d7',
          }}
        />
        {/* Distributor Detail modal */}
        <Stack.Screen
          name="useraccounts/buyernetworks/distributor-detail"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('nav.distributorDetails'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827', fontWeight: '600' },
            headerTintColor: '#0a61d7',
          }}
        />
        {/* Seller Information modal - same pattern as distributor-detail */}
        <Stack.Screen
          name="useraccounts/buyernetworks/seller-information"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('nav.sellerInformation'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827', fontWeight: '600' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/buyernetworks/distributor-information"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('nav.distributor'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827', fontWeight: '600' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/purchases/mypurchases"
          options={{
            presentation: 'modal',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="useraccounts/wallet/mywallet"
          options={{
            presentation: 'modal',
            title: t('nav.myWallet'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/wallet/bonuses"
          options={{
            presentation: 'modal',
            title: t('nav.bonuses'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/wallet/discounts"
          options={{
            presentation: 'modal',
            title: t('nav.discounts'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/wallet/lakupay"
          options={{
            presentation: 'modal',
            title: t('nav.lakupay'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/favourites"
          options={{
            presentation: 'modal',
            title: t('nav.favourites'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/recentlyviewed"
          options={{
            presentation: 'modal',
            title: t('nav.recentlyViewed'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/buyagain"
          options={{
            presentation: 'modal',
            title: t('nav.buyAgain'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/getvouchers"
          options={{
            presentation: 'modal',
            title: t('nav.getVouchers'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/loginsignup/loginmodal"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="useraccounts/loginsignup/signupmodal"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            contentStyle: { backgroundColor: '#ffffff', flex: 1 },
          }}
        />
        <Stack.Screen
          name="useraccounts/loginsignup/forgotpasswordmodal"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="useraccounts/userprofile/editprofile"
          options={{
            presentation: 'modal',
            title: t('nav.profile'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen name="useraccounts/userprofile/edit-username" options={{ presentation: 'modal', title: t('nav.editUsername'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-name" options={{ presentation: 'modal', title: t('nav.editName'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-bio" options={{ presentation: 'modal', title: t('nav.editBio'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-phone" options={{ presentation: 'modal', title: t('nav.editPhone'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-email" options={{ presentation: 'modal', title: t('nav.editEmail'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/addresses" options={{ presentation: 'modal', title: t('nav.myAddresses'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-address" options={{ presentation: 'modal', title: t('nav.newAddress'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-country" options={{ presentation: 'modal', title: t('nav.editCountry'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-store-name" options={{ presentation: 'modal', title: t('nav.editStoreName'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/followers" options={{ presentation: 'modal', title: t('nav.followers'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/following" options={{ presentation: 'modal', title: t('nav.following'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/consent/helpcenter" options={{ presentation: 'modal', title: t('nav.helpCenter'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/consent/security-privacy" options={{ presentation: 'modal', title: t('nav.securityPrivacy'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/consent/community-rules" options={{ presentation: 'modal', title: t('nav.communityRules'), headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        
        {/* Checkout Screen */}
        <Stack.Screen 
          name="components/productcatalog/checkout" 
          options={{ 
            presentation: 'modal',
            title: t('nav.checkout'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }} 
        />
        
        {/* Payment Success Screen */}
        <Stack.Screen 
          name="payment-success" 
          options={{ 
            presentation: 'modal',
            title: t('nav.paymentSuccess'),
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }} 
        />
        
        {/* Product Modal Screen */}
        <Stack.Screen 
          name="product" 
          options={{ 
            presentation: 'modal',
            headerShown: false,
          }} 
        />
        
        {/* Search Screen */}
        <Stack.Screen 
          name="search" 
          options={{ 
            headerShown: true,
            contentStyle: { backgroundColor: '#ffffff' }
          }} 
        />

        <Stack.Screen
          name="offers/index"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: '#f9fafb' },
          }}
        />
        <Stack.Screen
          name="offers/[id]"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#0a61d7',
            headerTitleStyle: { color: '#111827', fontWeight: '600' },
            contentStyle: { backgroundColor: '#f9fafb' },
          }}
        />

        <Stack.Screen
          name="order-notifications"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: '#f9fafb' },
          }}
        />
        <Stack.Screen
          name="components/notifications/latest-update/[id]"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('nav.latestUpdates'),
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#0a61d7',
            headerTitleStyle: {
              color: '#111827',
              fontWeight: '600',
            },
            contentStyle: { backgroundColor: '#f9fafb' },
          }}
        />
        
        {/* Order Details Modal Screen */}
        <Stack.Screen 
          name="components/ordersshipment/OrderDetails" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: t('nav.orderDetails'),
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#0a61d7',
            headerTitleStyle: {
              color: '#111827',
              fontWeight: '600',
            },
          }} 
        />
        
        <Stack.Screen 
          name="components/ordersshipment/DeliveryInformation" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: t('nav.deliveryInformation'),
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#0a61d7',
            headerTitleStyle: {
              color: '#111827',
              fontWeight: '600',
            },
          }} 
        />
        
        <Stack.Screen 
          name="components/ordersshipment/OrderCancelModal" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: t('nav.cancelOrder'),
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#0a61d7',
            headerTitleStyle: {
              color: '#111827',
              fontWeight: '600',
            },
          }} 
        />
        <Stack.Screen 
          name="components/ordersshipment/ReturnRefundModal" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: t('nav.returnRefund'),
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#0a61d7',
            headerTitleStyle: {
              color: '#111827',
              fontWeight: '600',
            },
          }} 
        />

        <Stack.Screen
          name="components/ordersshipment/PayOrder"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('nav.payOrder'),
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#0a61d7',
            headerTitleStyle: {
              color: '#111827',
              fontWeight: '600',
            },
            contentStyle: { backgroundColor: '#f9fafb' },
          }}
        />
        
          </Stack>
        </AuthGuard>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
