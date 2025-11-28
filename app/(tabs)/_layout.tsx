import React, { useRef, useState, useEffect } from 'react';
import { Link, Tabs, usePathname } from 'expo-router';
import { Pressable, View, TextInput, Animated, Text, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useClientOnlyValue } from '../components/useClientOnlyValue';
import { Home as HomeIcon, Boxes, FileText, User, Bell, ShoppingCart, Search, Store, MessageSquare, MessageSquareText } from 'lucide-react-native';
import { Settings } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useHeaderScrollStore } from '../../stores/headerScrollStore';
import CartBadge from '../components/CartBadge';

export default function TabLayout() {
  const pathname = usePathname();
  const primaryBlue = '#0a61d7';
  const lightBlue = '#4293fc';
  const inactiveGrey = '#6B7280';
  const { user, isLoading } = useAuthStore();
  const { scrollY, setScrollY } = useHeaderScrollStore();

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const prevPathnameRef = useRef(pathname);

  // Reset scroll position when navigating away from or back to home
  useEffect(() => {
    const wasHome = prevPathnameRef.current === '/' || prevPathnameRef.current?.endsWith('/home') || prevPathnameRef.current === '/home';
    const isNowHome = (!pathname || pathname === '/' || pathname?.endsWith('/home') || pathname === '/home');
    
    // If navigating away from home or coming back to home, reset scroll
    if ((wasHome && !isNowHome) || (!wasHome && isNowHome)) {
      // Reset scroll position immediately
      scrollY.setValue(0);
      // Reset header height to initial state immediately
      setHeaderHeight(170);
      lastHeightRef.current = 170;
    }
    
    prevPathnameRef.current = pathname;
  }, [pathname, scrollY]);

  // Interpolate header translation based on scroll position
  const headerContentTranslateY = scrollY.interpolate({
    inputRange: [0, 55],
    outputRange: [0, -55],
    extrapolate: 'clamp',
  });

  // Interpolate address row opacity based on scroll position
  const addressOpacity = scrollY.interpolate({
    inputRange: [0, 55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Convert animated height to state for headerStyle (smooth interpolation)
  const [headerHeight, setHeaderHeight] = useState(170);
  const heightUpdateRef = useRef<number | null>(null);
  const lastHeightRef = useRef(170);
  
  useEffect(() => {
    // Update function
    const updateHeight = (value: number) => {
      // Cancel any pending update
      if (heightUpdateRef.current !== null) {
        cancelAnimationFrame(heightUpdateRef.current);
      }
      
      // Use requestAnimationFrame for smooth updates
      heightUpdateRef.current = requestAnimationFrame(() => {
        // Smooth interpolation: 170 at scroll 0, 115 at scroll 55
        const clampedValue = Math.min(55, Math.max(0, value));
        const newHeight = 170 - clampedValue;
        
        // Update height more frequently for smoother animation
        if (Math.abs(newHeight - lastHeightRef.current) >= 0.5) {
          lastHeightRef.current = newHeight;
          setHeaderHeight(newHeight);
        }
      });
    };
    
    // Listen for scroll changes
    const listenerId = scrollY.addListener(({ value }) => {
      updateHeight(value);
    });
    
    // Initialize height immediately
    updateHeight(0);
    
    return () => {
      if (heightUpdateRef.current !== null) {
        cancelAnimationFrame(heightUpdateRef.current);
      }
      scrollY.removeListener(listenerId);
    };
  }, [scrollY, setHeaderHeight]);

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

  const SearchPill = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12,
        height: 44, flexGrow: 1, flexBasis: 0, marginRight: 7, marginLeft: 16, minWidth: 280, borderWidth: 1, borderColor: '#e5e7eb',
      }}
    >
      <Search color="#6B7280" size={20} />
      <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search for products..."
          style={{ flex: 1, marginLeft: 8, color: '#111827', paddingVertical: 0 }}
          placeholderTextColor="#6B7280"
        />
      </View>
    </View>
  );

  const rightIconsBlue = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20 }}>
      <Link href="/messages" asChild>
        <ShrinkIcon style={{ marginLeft: 8, marginRight: 6, paddingHorizontal: 8 }}>
          <MessageSquareText color={inactiveGrey} size={22} />
        </ShrinkIcon>
      </Link>
      <Link href="/cart" asChild>
        <ShrinkIcon>
          <View style={{ position: 'relative' }}>
            <ShoppingCart color={inactiveGrey} size={22} />
            <CartBadge size={16} color="#ffffff" backgroundColor="#EF4444" />
          </View>
        </ShrinkIcon>
      </Link>
    </View>
  );

  function renderHeaderContent() {
    if (pathname?.endsWith('/categories') || pathname === '/categories') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, paddingLeft: 0, paddingRight: 20, paddingVertical: 16 }}>
          {SearchPill}
          {rightIconsBlue}
        </View>
      );
    }
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
                  {isLoading ? 'Loading...' : user?.storeName || 'My Store'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }} numberOfLines={1} ellipsizeMode="tail">
                  {isLoading ? 'Loading...' : user?.chosenAddress || 'Set your address'}
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
            paddingLeft: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Search color="#6B7280" size={20} />
              <TextInput placeholder="Search for products..." style={{ flex: 1, marginLeft: 8, color: '#111827', paddingVertical: 0 }} placeholderTextColor="#6B7280" />
            </View>
          </View>
        </Animated.View>
      );
    }
    if (pathname?.endsWith('/orders') || pathname === '/orders') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600' }}>Orders</Text>
        </View>
      );
    }
    if (pathname?.endsWith('/notifications') || pathname === '/notifications') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600' }}>Notifications</Text>
        </View>
      );
    }
    return <View style={{ height: 0 }} />;
  }

  const TabButton = (props: object) => (
    <Pressable {...props} style={({ pressed }: { pressed: boolean }) => [{ alignItems: 'center', justifyContent: 'center', borderRadius: 9999, paddingVertical: 6 }]} />
  );

  const isOrders = pathname?.endsWith('/orders') || pathname === '/orders';
  const isCategories = pathname?.endsWith('/categories') || pathname === '/categories';
  const isMessages = pathname?.endsWith('/notifications') || pathname === '/notifications';
  const isAccount = pathname?.endsWith('/account') || pathname === '/account';
  const isHome = (!isOrders && !isCategories && !isMessages && !isAccount) || pathname?.endsWith('/home') || pathname === '/home';
  const useWhiteHeader = isOrders || isCategories || isMessages;

  return (
    <>
      <StatusBar 
        barStyle={isHome || isAccount ? "light-content" : "dark-content"} 
        backgroundColor={isHome || isAccount ? primaryBlue : "#f9fafb"} 
        translucent={false}
      />
      <Tabs
        initialRouteName="home"
        screenOptions={{
        tabBarActiveTintColor: primaryBlue,
        tabBarInactiveTintColor: inactiveGrey,
        headerShown: true,
        sceneStyle: { backgroundColor: '#ffffff' },
        headerTitleAlign: 'left',
        headerLeft: () => (
          isAccount ? (
            <Link href="/useraccounts/startdistributing" asChild>
              <Pressable style={{ paddingLeft: 16 }}>
                {({ pressed }) => (
                  <View style={{ backgroundColor: '#ffffff', borderRadius: 9999, paddingVertical: 6, paddingHorizontal: 12, opacity: pressed ? 0.9 : 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Store color={primaryBlue} size={16} />
                    <Text style={{ color: primaryBlue, fontSize: 14, fontWeight: '700', marginLeft: 6 }}>Start Distributing!</Text>
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
          
          // Animate background gradient with scroll
          const backgroundTranslateY = scrollY.interpolate({
            inputRange: [0, 55],
            outputRange: [0, -55],
            extrapolate: 'clamp',
          });
          
          return (
            <Animated.View style={{ 
              flex: 1,
              transform: [{ translateY: backgroundTranslateY }],
              overflow: 'hidden',
            }}>
              <LinearGradient 
                colors={[primaryBlue, lightBlue]} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={{ 
                  flex: 1,
                  borderBottomLeftRadius: isHome ? 24 : 0, 
                  borderBottomRightRadius: isHome ? 24 : 0,
                }} 
              />
            </Animated.View>
          );
        },
        headerStyle: { backgroundColor: useWhiteHeader ? '#ffffff' : primaryBlue, height: isHome ? headerHeight : undefined },
        headerTitleContainerStyle: isHome ? { position: 'absolute', top: 0, left: -16, right: -16, bottom: 0, margin: 0, padding: 0 } : { flex: 1, width: '100%', maxWidth: '100%', alignItems: 'stretch', paddingBottom: 0, marginHorizontal: 0, left: 0, right: 0 },
        tabBarStyle: { backgroundColor: '#ffffff', borderTopWidth: 0, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 10 },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarButton: (props) => <TabButton {...props} />,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Home</Text> }} />
      <Tabs.Screen name="categories" options={{ title: 'Categories', tabBarIcon: ({ color }) => <Boxes color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Categories</Text> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color }) => <FileText color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Orders</Text> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', tabBarIcon: ({ color }) => <Bell color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Notifications</Text> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <User color={color} size={22} />, tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Account</Text> }} />
    </Tabs>
    </>
  );
}
