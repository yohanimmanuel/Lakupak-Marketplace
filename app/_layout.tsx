import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useColorScheme } from './components/useColorScheme';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { useCartStore } from '../stores/cartStore';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

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
      SplashScreen.hideAsync();
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
  const { refreshAllData } = useDataStore();
  const { initializeCart } = useCartStore();

  useEffect(() => {
    const initializeApp = async () => {
      // Hydrate auth state first
      await hydrateFromStorage();
      
      // Initialize cart immediately after auth
      initializeCart();
      
      // Preload all data immediately
      await refreshAllData(token || undefined);
    };
    
    initializeApp();
  }, [hydrateFromStorage, refreshAllData, token]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
