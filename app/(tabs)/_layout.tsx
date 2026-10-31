import React, { useRef } from 'react';
import { Link, Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, View, TextInput, Animated, Text, StatusBar } from 'react-native';
import { Home as HomeIcon, FileText, User, Bell, ShoppingCart, Search, Store, MessageSquareText } from 'lucide-react-native';
import { Settings } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useHeaderScrollStore } from '../../stores/headerScrollStore';
import CartBadge from '../components/CartBadge';
import { FloatingTabBar } from '../../components/FloatingTabBar';
import { useTranslation } from 'react-i18next';

// Constants for header animation
const MAX_HEADER_HEIGHT = 170;
const MIN_HEADER_HEIGHT = 115;
const SCROLL_DISTANCE = MAX_HEADER_HEIGHT - MIN_HEADER_HEIGHT; // 55

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const primaryBlue = '#0a61d7';
  const inactiveGrey = '#6B7280';
  const { user, isLoading } = useAuthStore();
  const { scrollY } = useHeaderScrollStore();
  const { t } = useTranslation();

  // Interpolate header translation based on scroll position
  const headerContentTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [0, -SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  // Interpolate address row opacity based on scroll position
  const addressOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const ShrinkIcon = ({ children, style, ...pressableProps }: { children: React.ReactNode; style?: object } & Omit<React.ComponentProps<typeof Pressable>, 'style'>) => {
    const s = useRef(new Animated.Value(1)).current;
    const onIn = () => Animated.spring(s, { toValue: 0.92, useNativeDriver: true, friction: 7, tension: 120 }).start();
    const onOut = () => Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 7, tension: 120 }).start();
    return (
      <Pressable onPressIn={onIn} onPressOut={onOut} style={[{ paddingHorizontal: 10 }, style]} {...pressableProps}>
        <Animated.View style={{ transform: [{ scale: s }] }}>
          {children}
        </Animated.View>
      </Pressable>
    );
  };

  function renderHeaderContent() {
    if (!pathname || pathname === '/' || pathname?.endsWith('/home') || pathname === '/home') {
      return (
        <Animated.View style={{ 
          flex: 1, 
          alignSelf: 'stretch', 
          paddingVertical: 16, 
          marginRight: -48,
          transform: [{ translateY: headerContentTranslateY }]
        }}>
          <Animated.View style={{ 
            width: '100%', 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            paddingLeft: 16,
            opacity: addressOpacity
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, flex: 1, marginRight: 8 }}>
              <Store color="#ffffff" size={24} />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }} numberOfLines={1} ellipsizeMode="tail">
                  {isLoading ? t('common.loading') : user?.storeName || t('header.myStore')}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }} numberOfLines={1} ellipsizeMode="tail">
                  {isLoading ? t('common.loading') : user?.chosenAddress || t('header.setAddress')}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Link href="/messages" asChild>
                <ShrinkIcon>
                  <MessageSquareText color="#ffffff" size={22} />
                </ShrinkIcon>
              </Link>
              <Link href="/cart" asChild>
                <ShrinkIcon style={{ marginRight: -2, marginLeft: 4 }}>
                  <View style={{ position: 'relative' }}>
                    <ShoppingCart color="#ffffff" size={22} />
                    <CartBadge size={16} color="#ffffff" backgroundColor="#EF4444" />
                  </View>
                </ShrinkIcon>
              </Link>
            </View>
          </Animated.View>
          <View style={{ 
            width: '100%', 
            marginTop: 18, 
            paddingLeft: 20,
            paddingRight: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 22, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Search color="#6B7280" size={20} />
              <TextInput placeholder={t('header.searchProducts')} style={{ flex: 1, marginLeft: 8, color: '#111827', paddingVertical: 0 }} placeholderTextColor="#6B7280" />
            </View>
          </View>
        </Animated.View>
      );
    }
    if (pathname?.endsWith('/orders') || pathname === '/orders') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600' }}>{t('header.orders')}</Text>
        </View>
      );
    }
    if (pathname?.endsWith('/notifications') || pathname === '/notifications') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600' }}>{t('header.notifications')}</Text>
        </View>
      );
    }
    return <View style={{ height: 0 }} />;
  }

  const isOrders = pathname?.endsWith('/orders') || pathname === '/orders';
  const isMessages = pathname?.endsWith('/notifications') || pathname === '/notifications';
  const isAccount = pathname?.endsWith('/account') || pathname === '/account';
  const isHome = (!isOrders && !isMessages && !isAccount) || pathname?.endsWith('/home') || pathname === '/home';
  const useWhiteHeader = isOrders || isMessages;

  return (
    <>
      <StatusBar 
        barStyle={isHome || isAccount ? "light-content" : "dark-content"} 
        backgroundColor={isHome || isAccount ? primaryBlue : "#f9fafb"} 
        translucent={false}
      />
      <Tabs
        initialRouteName="home"
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
        tabBarActiveTintColor: primaryBlue,
        tabBarInactiveTintColor: inactiveGrey,
        headerShown: true,
        // Use white so nothing gray shows behind the rounded blue header background
        sceneStyle: { backgroundColor: '#ffffff' },
        headerTitleAlign: 'left',
        headerLeft: () => (
          isAccount ? (
            <Link href="/useraccounts/startdistributing" asChild>
              <Pressable style={{ paddingLeft: 16 }}>
                {({ pressed }) => (
                  <View style={{ backgroundColor: '#ffffff', borderRadius: 9999, paddingVertical: 6, paddingHorizontal: 12, opacity: pressed ? 0.9 : 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Store color={primaryBlue} size={16} />
                    <Text style={{ color: primaryBlue, fontSize: 14, fontWeight: '700', marginLeft: 6 }}>
                      {t('startDistributing.badge')}
                    </Text>
                  </View>
                )}
              </Pressable>
            </Link>
          ) : null
        ),
        headerLeftContainerStyle: { width: isHome ? 0 : undefined, paddingVertical: isAccount ? 16 : undefined },
        headerRightContainerStyle: { width: isHome ? 0 : undefined, paddingVertical: isAccount ? 16 : undefined },
        headerTitle: () => (isAccount ? <View style={{ flex: 1 }} /> : renderHeaderContent()),
          headerRight: () => (
          isAccount ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12 }}>
              <Link href="/settings" asChild>
                <ShrinkIcon style={{ marginRight: 6}}>
                  <Settings color="#ffffff" size={22} />
                </ShrinkIcon>
              </Link>
              <Link href="/messages" asChild>
                <ShrinkIcon style={{ marginRight: 6}}>
                  <MessageSquareText color="#ffffff" size={22} />
                </ShrinkIcon>
              </Link>
              <Link href="/cart" asChild>
                <ShrinkIcon>
                  <View style={{ position: 'relative' }}>
                    <ShoppingCart color="#ffffff" size={22} />
                    <CartBadge size={16} color="#ffffff" backgroundColor="#EF4444" />
                  </View>
                </ShrinkIcon>
              </Link>
            </View>
          ) : null
        ),
        headerBackground: () => {
          if (useWhiteHeader) {
            return <View style={{ flex: 1, backgroundColor: '#ffffff', borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }} />;
          }
          
          // For account and home - solid primary blue
          return (
            <View style={{ flex: 1, backgroundColor: primaryBlue }} />
          );
        },
        headerStyle: { 
          backgroundColor: 'transparent', 
          height: isHome ? MAX_HEADER_HEIGHT : undefined,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleContainerStyle: isHome ? { position: 'absolute', top: 0, left: -16, right: -16, bottom: 0, margin: 0, padding: 0 } : { flex: 1, width: '100%', maxWidth: '100%', alignItems: 'stretch', paddingBottom: 0, marginHorizontal: 0, left: 0, right: 0 },
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
        },
        tabBarBackground: () => null,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), headerShown: false, tabBarIcon: ({ color }) => <HomeIcon color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>{t('tabs.home')}</Text> }} />
      <Tabs.Screen name="orders" options={{ title: t('tabs.orders'), tabBarIcon: ({ color }) => <FileText color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>{t('tabs.orders')}</Text> }} />
      <Tabs.Screen name="notifications" options={{ title: t('tabs.notifications'), tabBarIcon: ({ color }) => <Bell color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>{t('tabs.notifications')}</Text> }} />
      <Tabs.Screen name="account" options={{ title: t('tabs.account'), tabBarIcon: ({ color }) => <User color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>{t('tabs.account')}</Text> }} />
    </Tabs>
    </>
  );
}
