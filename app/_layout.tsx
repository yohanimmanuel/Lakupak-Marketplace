import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { useCartStore } from '../stores/cartStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { pushNotificationService } from '../services/pushNotifications';
import SuspendedAccountModal from '../components/SuspendedAccountModal';
import AuthGuard from '../components/AuthGuard';

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
  const { hydrateFromStorage, token, user } = useAuthStore();
  const { refreshAllData, startAutoRefresh, stopAutoRefresh } = useDataStore();
  const { initializeCart } = useCartStore();
  const { loadUserActivities } = useUserActivityStore();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      // Hydrate auth state first
      await hydrateFromStorage();
      
      // Get token and user after hydration
      const currentToken = useAuthStore.getState().token;
      const currentUser = useAuthStore.getState().user;
      
      // Initialize cart immediately after auth
      initializeCart();
      
      // Load user activities (liked products, viewed products, etc.) if user is logged in
      if (currentUser?.id) {
        await loadUserActivities(currentUser.id);
      }
      
      // Preload all data immediately
      await refreshAllData(currentToken || undefined);
      
      // Start WebSocket with token after everything is loaded
      if (AppState.currentState === 'active') {
        startAutoRefresh(currentToken || undefined);
      }
    };
    
    initializeApp();
  }, [hydrateFromStorage, refreshAllData, initializeCart, startAutoRefresh, loadUserActivities]);

  // Handle app state changes to pause/resume auto-refresh
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App is in foreground - start auto-refresh with WebSocket + polling fallback
        const currentToken = useAuthStore.getState().token;
        const currentUser = useAuthStore.getState().user;
        startAutoRefresh(currentToken || undefined);

        // Retry push registration if we still don't have a token (e.g. first run failed, permission granted later, FCM later available)
        if (currentUser?.id && currentToken && !pushNotificationService.getPushToken()) {
          try {
            const pushToken = await pushNotificationService.registerForPushNotifications();
            if (pushToken) {
              await pushNotificationService.savePushTokenToServer(currentUser.id, pushToken, currentToken);
            }
          } catch {
            // Silently handle errors - will retry on next foreground
          }
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        stopAutoRefresh();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      stopAutoRefresh();
    };
  }, [startAutoRefresh, stopAutoRefresh]);

  // Reconnect WebSocket when token becomes available
  useEffect(() => {
    if (token) {
      startAutoRefresh(token);
    }
  }, [token, startAutoRefresh]);

  // Initialize push notifications
  useEffect(() => {
    const initializePushNotifications = async () => {
      // Register for push notifications
      const pushToken = await pushNotificationService.registerForPushNotifications();
      
      // Save token to server if user is logged in (auth required by API)
      if (pushToken && user?.id && token) {
        await pushNotificationService.savePushTokenToServer(user.id, pushToken, token);
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
      const data = content.data as { type?: string; orderId?: string; orderStatus?: string } | undefined;
      if (data?.type === 'order' && data?.orderId) {
        pushNotificationService.showOrderNotificationInApp(
          String(data.orderId),
          data.orderStatus ?? '',
          content.title ?? undefined,
          content.body ?? undefined
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
        // User logged out - stop auto-refresh
        stopAutoRefresh();
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
  }, [user?.id, token, initializeCart, loadUserActivities, refreshAllData, startAutoRefresh, stopAutoRefresh]);

  return (
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
            title: 'Welcome to Laku!',
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
            title: 'My Networks',
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
            title: 'Distributor Details',
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
            title: 'Seller Information',
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
            title: 'Distributor',
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
            title: 'My Wallet',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/wallet/bonuses"
          options={{
            presentation: 'modal',
            title: 'Bonuses',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/wallet/discounts"
          options={{
            presentation: 'modal',
            title: 'Discounts',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/wallet/lakupay"
          options={{
            presentation: 'modal',
            title: 'LakuPay',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/favourites"
          options={{
            presentation: 'modal',
            title: 'Favourites',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/recentlyviewed"
          options={{
            presentation: 'modal',
            title: 'Recently Viewed',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/buyagain"
          options={{
            presentation: 'modal',
            title: 'Buy Again',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen
          name="useraccounts/moreservice/getvouchers"
          options={{
            presentation: 'modal',
            title: 'Get Vouchers',
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
            presentation: 'modal',
            headerShown: false,
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
            title: 'Profile',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#111827' },
            headerTintColor: '#0a61d7',
          }}
        />
        <Stack.Screen name="useraccounts/userprofile/edit-username" options={{ presentation: 'modal', title: 'Edit Username', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-name" options={{ presentation: 'modal', title: 'Edit Name', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-bio" options={{ presentation: 'modal', title: 'Edit Bio', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-phone" options={{ presentation: 'modal', title: 'Edit Phone', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-email" options={{ presentation: 'modal', title: 'Edit Email', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/addresses" options={{ presentation: 'modal', title: 'My Addresses', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-address" options={{ presentation: 'modal', title: 'New Address', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-country" options={{ presentation: 'modal', title: 'Edit Country', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/edit-store-name" options={{ presentation: 'modal', title: 'Edit Store Name', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/followers" options={{ presentation: 'modal', title: 'Followers', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/userprofile/following" options={{ presentation: 'modal', title: 'Following', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/consent/helpcenter" options={{ presentation: 'modal', title: 'Help Center', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/consent/security-privacy" options={{ presentation: 'modal', title: 'Security & Privacy', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        <Stack.Screen name="useraccounts/consent/community-rules" options={{ presentation: 'modal', title: 'Community Rules', headerStyle: { backgroundColor: '#ffffff' }, headerTitleStyle: { color: '#111827' }, headerTintColor: '#0a61d7' }} />
        
        {/* Checkout Screen */}
        <Stack.Screen 
          name="components/productcatalog/checkout" 
          options={{ 
            presentation: 'modal',
            title: 'Checkout',
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
            title: 'Payment Success',
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
            title: 'Latest updates',
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
            title: 'Order Details',
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
            title: 'Delivery Information',
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
            title: 'Cancel Order',
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
            title: 'Return / Refund',
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
        
        </Stack>
      </AuthGuard>
    </ThemeProvider>
  );
}
