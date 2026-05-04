import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AUTH_ERROR_CODE, getAuthErrorCode, loginWithCredentials } from '../../../services/auth';
// import { signInWithGoogle } from '../../../services/auth'; // Temporarily disabled
import { useAuthStore } from '../../../stores/authStore';
import { useDataStore } from '../../../stores/dataStore';
import { useCartStore } from '../../../stores/cartStore';
import { ArrowLeft, Eye, EyeOff, Info, Shield, HelpCircle, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function LoginModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);


  // (Keyboard listeners removed — state wasn't used)

  const openMenu = () => {
    setMenuOpen(true);
    menuOpacity.setValue(0);
    menuScale.setValue(0.95);
    Animated.parallel([
      Animated.timing(menuOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.spring(menuScale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }),
    ]).start();
  };
  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(menuScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  };

  return (
    <>
      <Stack.Screen options={{
        headerShown: false,
      }} />
      
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* Section 1: Top Navigation Bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#ffffff' }}>
            <Pressable 
              onPress={() => router.back()} 
              style={{ padding: 8 }}
            >
              <ArrowLeft color='#111827' size={24} />
            </Pressable>
            
            <View style={{ flex: 1 }} />
            
            <Pressable style={{ padding: 8 }} onPress={openMenu}>
              <Text style={{ color: '#111827', fontSize: 16 }}>⋯</Text>
            </Pressable>
          </View>

          {/* Section 2: Login Form */}
          <ScrollView 
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => router.push('/useraccounts/welcome')}>
                <Image source={require('../../../assets/images/LakuLakuMobileIcon.png')} style={{ width: 135, height: 90 }} />
              </Pressable>
            </View>
            {/* Welcome Title */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                {t('auth.login.title')} 👋
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                {t('auth.login.subtitle')}
              </Text>
            </View>

            {/* Email Input */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                {t('auth.login.emailLabel')}
              </Text>
              <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t('auth.login.emailPlaceholder')}
                  placeholderTextColor="#9ca3af"
                  style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                {t('auth.login.passwordLabel')}
              </Text>
              <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  placeholderTextColor="#9ca3af"
                  style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                  {showPassword ? (
                    <EyeOff color='#6b7280' size={20} />
                  ) : (
                    <Eye color='#6b7280' size={20} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Forgot Password */}
            <Pressable
              onPress={() => router.push('/useraccounts/loginsignup/forgotpasswordmodal')}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
            >
              <Info color='#0a61d7' size={16} style={{ marginRight: 6 }} />
              <Text style={{ color: '#0a61d7', fontSize: 14, fontWeight: '500' }}>
                {t('auth.login.forgotPassword')}
              </Text>
            </Pressable>

            {/* Login Button */}
            <Pressable
              onPress={async () => {
                if (!username.trim() || !password.trim()) {
                  Alert.alert(t('auth.login.alerts.missingTitle'), t('auth.login.alerts.missingBody'));
                  return;
                }
                
                setIsLoggingIn(true);
                try {
                  const result = await loginWithCredentials(username.trim(), password);
                  
                  // CRITICAL: Set token and user FIRST to ensure proper user isolation
                  await setToken(result.token);
                  await setUser(result.user);
                  
                  // Get store instances
                  const dataStore = useDataStore.getState();
                  const cartStore = useCartStore.getState();
                  
                  // Clear any stale data first
                  dataStore.clearCache();
                  
                  // Start loading products (non-blocking)
                  dataStore.forceRefreshProducts();
                  
                  // Navigate immediately while data loads
                  router.replace('/(tabs)/home');
                  
                  // Load all user-specific data in correct order
                  // Wait a bit to ensure navigation completes
                  setTimeout(async () => {
                    try {
                      // Load user profile
                      await dataStore.loadUserData(result.token);
                      
                      // Load cart for this user
                      cartStore.setUserId(result.user.id);
                      
                      // Load orders with force refresh (ensures correct user)
                      await dataStore.loadOrdersData(true);
                      
                      // Start auto-refresh
                      dataStore.startAutoRefresh(result.token);
                    } catch {
                      // Silently handle background loading errors
                    }
                  }, 200);
                } catch (error: unknown) {
                  setIsLoggingIn(false);
                  const code = getAuthErrorCode(error)
                  if (code === AUTH_ERROR_CODE.ACCOUNT_SUSPENDED) {
                    Alert.alert(t('auth.login.alerts.suspendedTitle'), t('auth.login.alerts.suspendedBody'));
                    return;
                  }
                  if (code === AUTH_ERROR_CODE.RATE_LIMITED) {
                    Alert.alert(t('auth.login.alerts.rateLimitedTitle'), t('auth.login.alerts.rateLimitedBody'));
                    return;
                  }
                  if (error instanceof Error && (error.message.includes('User not found') || error.message.includes('Please sign up first'))) {
                    Alert.alert(
                      t('auth.login.alerts.notFoundTitle'),
                      t('auth.login.alerts.notFoundBody'),
                      [
                        { text: t('auth.login.alerts.ok'), style: 'default' },
                        { text: t('auth.login.alerts.signUp'), style: 'default', onPress: () => router.push('/useraccounts/loginsignup/signupmodal') }
                      ]
                    );
                  } else if (error instanceof Error && error.message.includes('Invalid username or password')) {
                    Alert.alert(t('auth.login.alerts.invalidTitle'), t('auth.login.alerts.invalidBody'));
                  } else {
                    const fallback = t('auth.login.alerts.genericBody');
                    const errorMessage = error instanceof Error ? error.message : fallback;
                    Alert.alert(t('auth.login.alerts.failedTitle'), errorMessage);
                  }
                }
              }}
              disabled={isLoggingIn}
              style={{ 
                backgroundColor: isLoggingIn ? '#93c5fd' : '#0a61d7', 
                borderRadius: 12, 
                paddingVertical: 16, 
                alignItems: 'center', 
                marginBottom: 24,
                opacity: isLoggingIn ? 0.7 : 1
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                {isLoggingIn ? t('auth.login.button.loading') : t('auth.login.button.idle')}
              </Text>
            </Pressable>

            {/* Social Login Options */}
            {/* <View style={{ marginBottom: 24 }}>
              <Pressable
                style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: 12, 
                  paddingVertical: 14, 
                  paddingHorizontal: 20, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  marginBottom: 12
                }}
              >
              </Pressable>
              
              <Pressable
                style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: 12, 
                  paddingVertical: 14, 
                  paddingHorizontal: 20, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#e5e7eb'
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 12 }}>🍎</Text>
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '500' }}>
                  {t('auth.login.social.apple')}
                </Text>
              </Pressable>
            </View>

            {/* Create Account Link */}
            <View style={{ alignItems: 'center' }}>
              <Pressable onPress={() => router.push('/useraccounts/loginsignup/signupmodal')}>
                <Text style={{ color: '#6b7280', fontSize: 14 }}>
                  {t('auth.login.createAccount')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {menuOpen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Pressable style={{ flex: 1 }} onPress={closeMenu} />
          <Animated.View
            style={{
              position: 'absolute', top: 56, right: 12,
              backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 6,
              shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
              elevation: 6,
              opacity: menuOpacity,
              transform: [{ scale: menuScale }],
              width: 200,
            }}
          >
            <Pressable onPress={() => { closeMenu(); router.push('/useraccounts/consent/security-privacy'); }} style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Shield size={18} color="#111827" />
              <Text style={{ color: '#111827', fontSize: 14 }}>{t('auth.login.menu.securityPrivacy')}</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 }} />
            <Pressable onPress={() => { closeMenu(); router.push('/useraccounts/consent/helpcenter'); }} style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HelpCircle size={18} color="#111827" />
              <Text style={{ color: '#111827', fontSize: 14 }}>{t('auth.login.menu.helpCenter')}</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 }} />
            <Pressable onPress={closeMenu} style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <X size={18} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>{t('auth.login.menu.close')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </>
  );
}
