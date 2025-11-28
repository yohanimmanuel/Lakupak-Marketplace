import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useColorScheme } from './components/useColorScheme';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { useCartStore } from '../stores/cartStore';
import { useUserActivityStore } from '../stores/userActivityStore';

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
  const colorScheme = useColorScheme();
  const { hydrateFromStorage, token } = useAuthStore();
  const { refreshAllData, startAutoRefresh, stopAutoRefresh } = useDataStore();
  const { initializeCart } = useCartStore();
  const { loadUserActivities } = useUserActivityStore();

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
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App is in foreground - start auto-refresh with WebSocket + polling fallback
        // Get fresh token from store
        const currentToken = useAuthStore.getState().token;
        startAutoRefresh(currentToken || undefined);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is in background - stop auto-refresh to save resources
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

  // Load user activities when user logs in or changes
  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.id && token) {
      loadUserActivities(currentUser.id);
    }
  }, [token, loadUserActivities]);

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="useraccounts/welcome" options={{ headerShown: false }} />
        <Stack.Screen
          name="useraccounts/startdistributing"
          options={{
            presentation: 'modal',
            title: 'Welcome to Laku-Laku!',
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
        
      </Stack>
    </ThemeProvider>
  );
}
