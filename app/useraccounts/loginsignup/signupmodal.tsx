import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Animated, Easing, Alert, KeyboardAvoidingView, Platform, Keyboard, StatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AUTH_ERROR_CODE, getAuthErrorCode, requestOtp, verifyOtp, signupStep1, signupStep2, signupStepAddress, signupStep3, registerAccount } from '../../../services/auth';
import AddressMapPreview from '../../components/address/AddressMapPreview';
import AddressLocationFields from '../../components/address/AddressLocationFields';
import AddressLabelOptions, { type AddressLabel } from '../../components/address/AddressLabelOptions';
import { useAuthStore } from '../../../stores/authStore';
import { useDataStore } from '../../../stores/dataStore';
import { useCartStore } from '../../../stores/cartStore';
import { ArrowLeft, Fingerprint, Shield, HelpCircle, X } from 'lucide-react-native';
import { COUNTRIES, getFlagEmoji } from '../../../constants/countries';
import { useTranslation } from 'react-i18next';

export default function SignUpModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [fingerEnabled, setFingerEnabled] = useState(false);
  const fingerKnobAnim = useRef(new Animated.Value(0)).current; // 0 off, 1 on
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  // Combined signup state - 0 = initial screen, 1-4 = signup steps
  const [signupStep, setSignupStep] = useState(0);
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    storeName: '',
    bio: '',
    address: '',
    deliveryFullName: '',
    deliveryPhone: '',
    addressIsDefault: true,
    addressLabel: 'home' as AddressLabel,
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    countryCode: 'ID',
    countryDialCode: '+62',
    countryFlag: getFlagEmoji('ID')
  });

  useEffect(() => {
    Animated.timing(fingerKnobAnim, {
      toValue: fingerEnabled ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [fingerEnabled, fingerKnobAnim]);

  // Keyboard visibility + height so ScrollView can scroll above the keyboard
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollBottomPadding = useMemo(() => {
    const base = Math.max(insets.bottom, 16) + 32;
    if (Platform.OS === 'android' && keyboardHeight > 0) {
      return base + keyboardHeight;
    }
    return base;
  }, [insets.bottom, keyboardHeight]);
  
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const backdropAnim = useRef(new Animated.Value(0)).current; // 0 transparent, 1 opaque

  // Simple step transition motion: fade + slide-in whenever the signup step changes.
  const stepAnim = useRef(new Animated.Value(1)).current; // 0 start, 1 settled
  useEffect(() => {
    if (signupStep > 0) {
      stepAnim.setValue(0);
      Animated.timing(stepAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [signupStep, stepAnim]);

  useEffect(() => {
    if (signupStep === 3) {
      setSignupData((prev) => ({
        ...prev,
        deliveryFullName: prev.deliveryFullName || prev.name,
      }));
    }
  }, [signupStep]);

  const stepMotionStyle = {
    opacity: stepAnim,
    transform: [
      { translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
    ],
  };

  const openCountryPicker = () => {
    setIsCountryPickerOpen(true);
  };

  const closeCountryPicker = () => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setIsCountryPickerOpen(false);
    });
  };

  useEffect(() => {
    if (isCountryPickerOpen) {
      sheetAnim.setValue(0);
      backdropAnim.setValue(0);
      Animated.parallel([
        Animated.timing(sheetAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [isCountryPickerOpen, sheetAnim, backdropAnim]);

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

  const filteredCountries = useMemo(() => {
    const keyword = countrySearch.trim().toLowerCase();
    if (!keyword) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(keyword) ||
      c.code.toLowerCase().includes(keyword) ||
      c.dialCode.includes(keyword)
    );
  }, [countrySearch]);

  return (
    <>
      <Stack.Screen options={{
        headerShown: false,
        presentation: 'fullScreenModal',
        contentStyle: { backgroundColor: '#ffffff', flex: 1 },
      }} />
      
      <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top }}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          {/* Top Navigation Bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#ffffff' }}>
            <Pressable 
              onPress={() => {
                if (signupStep > 0) {
                  setSignupStep(prev => prev - 1);
                } else {
                  router.back();
                }
              }} 
              style={{ padding: 8 }}
            >
              <ArrowLeft color='#111827' size={24} />
            </Pressable>
            
            <View style={{ flex: 1 }} />
            
            <Pressable style={{ padding: 8 }} onPress={openMenu}>
              <Text style={{ color: '#111827', fontSize: 16 }}>⋯</Text>
            </Pressable>
          </View>

          {/* Main Content */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
          <ScrollView 
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: scrollBottomPadding,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            automaticallyAdjustKeyboardInsets
            nestedScrollEnabled
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}
          >

            {/* Initial Welcome Screen */}
            {signupStep === 0 && (
              <View>
                 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Pressable onPress={() => router.push('/useraccounts/welcome')}>
                     <Image source={require('../../../assets/images/LakuLakuMobileIcon.png')} style={{ width: 135, height: 90 }} />
                  </Pressable>
                </View>
                <View style={{ marginBottom: 32 }}>
                  <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                    {t('auth.signup.title')}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                    {t('auth.signup.subtitle')}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setSignupStep(1)}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('auth.signup.ctaCreateAccount')}</Text>
                </Pressable>

                <View style={{ alignItems: 'center' }}>
                  <Pressable onPress={() => router.push('/useraccounts/loginsignup/loginmodal')}>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                      {t('auth.signup.alreadyHaveAccount')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Title and Subtitle - Show on steps 1-4 */}
            {signupStep > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                  {t('auth.signup.title')}
                </Text>
                <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                  {t('auth.signup.subtitle')}
                </Text>
              </View>
            )}

            {/* Step Indicator (hidden when keyboard open to preserve space) */}
            {signupStep > 0 && !isKeyboardVisible && (
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32, opacity: stepAnim }}>
              {[1, 2, 3, 4].map((step) => (
                <View key={step} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: signupStep > step ? '#16a34a' : signupStep >= step ? '#0a61d7' : '#e5e7eb',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginHorizontal: 4
                  }}>
                    {signupStep > step ? (
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>✓</Text>
                    ) : (
                      <Text style={{
                        color: signupStep >= step ? '#ffffff' : '#6b7280',
                        fontSize: 14,
                        fontWeight: '600'
                      }}>
                        {step}
                      </Text>
                    )}
                  </View>
                  {step < 4 && (
                    <View style={{
                      width: 20,
                      height: 2,
                      backgroundColor: signupStep > step ? '#16a34a' : signupStep >= step ? '#0a61d7' : '#e5e7eb',
                      marginHorizontal: 4
                    }} />
                  )}
                </View>
              ))}
            </Animated.View>
            )}

            {/* Step 1: Name & Email */}
            {signupStep === 1 && (
              <Animated.View style={stepMotionStyle}>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.steps.fullName')}
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.name}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, name: text }))}
                      placeholder={t('auth.signup.steps.fullNamePlaceholder')}
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.steps.email')}
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.email}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, email: text }))}
                      placeholder={t('auth.login.emailPlaceholder')}
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    if (!signupData.name.trim() || !signupData.email.trim()) {
                      Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingNameEmail'));
                      return;
                    }
                    
                    try {
                      await signupStep1(signupData.name.trim(), signupData.email.trim());
                      setSignupStep(2);
                    } catch (error: unknown) {
                      const code = getAuthErrorCode(error);
                      if (code === AUTH_ERROR_CODE.SIGNUP_INVALID_EMAIL) {
                        Alert.alert(t('auth.signup.alerts.invalidEmailTitle'), t('auth.signup.alerts.invalidEmailBody'));
                        return;
                      }
                      if (code === AUTH_ERROR_CODE.SIGNUP_MISSING_NAME_EMAIL) {
                        Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingNameEmail'));
                        return;
                      }
                      Alert.alert(t('auth.signup.alerts.failedTitle'), t('auth.signup.alerts.genericBody'));
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('auth.signup.steps.continue')}</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Step 2: Store Name & Bio */}
            {signupStep === 2 && (
              <Animated.View style={stepMotionStyle}>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.steps.storeName')}
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.storeName}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, storeName: text }))}
                      placeholder={t('auth.signup.steps.storeNamePlaceholder')}
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.steps.bioOptional')}
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.bio}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, bio: text }))}
                      placeholder={t('auth.signup.steps.bioPlaceholder')}
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827', minHeight: 60 }}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    if (!signupData.storeName.trim()) {
                      Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingStoreName'));
                      return;
                    }
                    
                    try {
                      await signupStep2(signupData.storeName.trim(), signupData.bio.trim());
                      setSignupStep(3);
                    } catch (error: unknown) {
                      if (getAuthErrorCode(error) === AUTH_ERROR_CODE.SIGNUP_MISSING_STORE) {
                        Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingStoreName'));
                        return;
                      }
                      Alert.alert(t('auth.signup.alerts.failedTitle'), t('auth.signup.alerts.genericBody'));
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('auth.signup.steps.continue')}</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Step 3: Delivery Address */}
            {signupStep === 3 && (
              <Animated.View style={stepMotionStyle}>
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                  {t('profile.editAddress.shippingAddress')}
                </Text>
                <AddressMapPreview
                  address={signupData.address}
                  onScrollInteractionChange={(active) => setScrollEnabled(!active)}
                />
                <AddressLocationFields
                  address={signupData.address}
                  fullName={signupData.deliveryFullName}
                  phone={signupData.deliveryPhone}
                  onAddressChange={(text) => setSignupData((prev) => ({ ...prev, address: text }))}
                  onFullNameChange={(text) => setSignupData((prev) => ({ ...prev, deliveryFullName: text }))}
                  onPhoneChange={(text) => setSignupData((prev) => ({ ...prev, deliveryPhone: text }))}
                />
                <AddressLabelOptions
                  isDefault={signupData.addressIsDefault}
                  label={signupData.addressLabel}
                  onDefaultChange={(value) => setSignupData((prev) => ({ ...prev, addressIsDefault: value }))}
                  onLabelChange={(label) => setSignupData((prev) => ({ ...prev, addressLabel: label }))}
                />
                <Pressable
                  onPress={async () => {
                    if (!signupData.address.trim()) {
                      Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingAddress'));
                      return;
                    }
                    if (!signupData.deliveryFullName.trim()) {
                      Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingFullName'));
                      return;
                    }
                    if (!signupData.deliveryPhone.trim()) {
                      Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingPhone'));
                      return;
                    }

                    try {
                      await signupStepAddress(signupData.address.trim());
                      setSignupStep(4);
                    } catch (error: unknown) {
                      if (getAuthErrorCode(error) === AUTH_ERROR_CODE.SIGNUP_MISSING_ADDRESS) {
                        Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingAddress'));
                        return;
                      }
                      Alert.alert(t('auth.signup.alerts.failedTitle'), t('auth.signup.alerts.genericBody'));
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('auth.signup.steps.continue')}</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Step 4: Username & Password */}
            {signupStep === 4 && (
              <Animated.View style={stepMotionStyle}>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.steps.username')}
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.username}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, username: text }))}
                      placeholder={t('auth.signup.steps.usernamePlaceholder')}
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.steps.password')}
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.password}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, password: text }))}
                      placeholder={t('auth.signup.steps.passwordPlaceholder')}
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      secureTextEntry={true}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.steps.confirmPassword')}
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.confirmPassword}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, confirmPassword: text }))}
                      placeholder={t('auth.signup.steps.confirmPasswordPlaceholder')}
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      secureTextEntry={true}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    if (isCreatingAccount) return;

                    if (!signupData.username.trim() || !signupData.password.trim() || !signupData.confirmPassword.trim()) {
                      Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingAllFields'));
                      return;
                    }
                    
                    if (signupData.password !== signupData.confirmPassword) {
                      Alert.alert(t('auth.signup.alerts.passwordMismatchTitle'), t('auth.signup.alerts.passwordMismatchBody'));
                      return;
                    }
                    
                    if (signupData.password.length < 6) {
                      Alert.alert(t('auth.signup.alerts.weakPasswordTitle'), t('auth.signup.alerts.weakPasswordBody'));
                      return;
                    }
                    
                    setIsCreatingAccount(true);
                    try {
                      await signupStep3(signupData.username.trim(), signupData.password);

                      const deliveryPhone = signupData.deliveryPhone.trim();
                      const result = await registerAccount({
                        name: signupData.name.trim(),
                        email: signupData.email.trim().toLowerCase(),
                        storeName: signupData.storeName.trim() || undefined,
                        bio: signupData.bio.trim() || undefined,
                        username: signupData.username.trim(),
                        password: signupData.password,
                        address: signupData.address.trim(),
                        addressFullName: signupData.deliveryFullName.trim(),
                        addressLabel: signupData.addressLabel,
                        addressIsDefault: signupData.addressIsDefault,
                        phone: deliveryPhone,
                        countryCode: signupData.countryCode,
                        countryDialCode: signupData.countryDialCode,
                      });
                      
                      await setToken(result.token);
                      await setUser(result.user);

                      const dataStore = useDataStore.getState();
                      const cartStore = useCartStore.getState();

                      dataStore.clearCache();
                      dataStore.forceRefreshProducts();

                      router.replace('/(tabs)/home');

                      setTimeout(async () => {
                        try {
                          await dataStore.loadUserData(result.token);
                          cartStore.setUserId(result.user.id);
                          await dataStore.loadOrdersData(true);
                          dataStore.startAutoRefresh(result.token);
                        } catch {
                          // Silently handle background loading errors
                        }
                      }, 200);

                      Alert.alert(t('auth.signup.accountCreatedTitle'), t('auth.signup.accountCreatedBody'));
                    } catch (error: unknown) {
                      setIsCreatingAccount(false);
                      const code = getAuthErrorCode(error);
                      if (code === AUTH_ERROR_CODE.RATE_LIMITED) {
                        Alert.alert(t('auth.login.alerts.rateLimitedTitle'), t('auth.login.alerts.rateLimitedBody'));
                        return;
                      }
                      if (code === AUTH_ERROR_CODE.SIGNUP_MISSING_CREDENTIALS) {
                        Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingAllFields'));
                        return;
                      }
                      if (code === AUTH_ERROR_CODE.SIGNUP_WEAK_PASSWORD) {
                        Alert.alert(t('auth.signup.alerts.weakPasswordTitle'), t('auth.signup.alerts.weakPasswordBody'));
                        return;
                      }
                      if (code === AUTH_ERROR_CODE.SIGNUP_EMAIL_TAKEN) {
                        Alert.alert(t('auth.signup.alerts.failedTitle'), t('auth.signup.alerts.emailTaken'));
                        return;
                      }
                      if (code === AUTH_ERROR_CODE.SIGNUP_USERNAME_TAKEN) {
                        Alert.alert(t('auth.signup.alerts.failedTitle'), t('auth.signup.alerts.usernameTaken'));
                        return;
                      }
                      if (code === AUTH_ERROR_CODE.SIGNUP_PHONE_TAKEN) {
                        Alert.alert(t('auth.signup.alerts.failedTitle'), t('auth.signup.alerts.phoneTaken'));
                        return;
                      }
                      if (code === AUTH_ERROR_CODE.SIGNUP_MISSING_PHONE) {
                        Alert.alert(t('auth.signup.alerts.missingTitle'), t('auth.signup.alerts.missingPhone'));
                        return;
                      }
                      Alert.alert(t('auth.signup.alerts.failedTitle'), t('auth.signup.alerts.genericBody'));
                    }
                  }}
                  disabled={isCreatingAccount}
                  style={{
                    backgroundColor: isCreatingAccount ? '#93c5fd' : '#0a61d7',
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                    marginBottom: 12,
                    opacity: isCreatingAccount ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                    {isCreatingAccount ? t('auth.signup.button.loading') : t('auth.signup.button.idle')}
                  </Text>
                </Pressable>

                {/* Add Phone Number Button - Commented Out */}
                {/* <Pressable
                  onPress={() => setSignupStep(4)}
                  style={{ backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 24 }}
                >
                  <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>{t('auth.signup.phoneOtp.addPhoneNumber')}</Text>
                </Pressable> */}
              </Animated.View>
            )}

            {/* Step 4: Phone Number - Commented Out */}
            {/* {signupStep === 4 && (
              <View>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    {t('auth.signup.phoneOtp.phoneNumberLabel')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable
                      onPress={openCountryPicker}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        backgroundColor: '#f9fafb', 
                        borderRadius: 12, 
                        paddingHorizontal: 12, 
                        paddingVertical: 16,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        marginRight: 8
                      }}
                    >
                      <Text style={{ fontSize: 20, marginRight: 8 }}>{signupData.countryFlag}</Text>
                      <Text style={{ color: '#111827', fontSize: 16 }}>{signupData.countryDialCode}</Text>
                    </Pressable>
                    <View style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                      <TextInput
                        value={signupData.phone}
                        onChangeText={(text) => setSignupData(prev => ({ ...prev, phone: text }))}
                        placeholder={t('auth.signup.phoneOtp.phonePlaceholder')}
                        placeholderTextColor="#9ca3af"
                        style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    if (!signupData.phone.trim()) {
                      Alert.alert(t('auth.signup.phoneOtp.alerts.missingTitle'), t('auth.signup.phoneOtp.alerts.missingBody'));
                      return;
                    }
                    try {
                      setIsVerifying(true);
                      await requestOtp(
                        `${signupData.countryDialCode}${signupData.phone}`,
                        signupData.countryCode,
                        'sms'
                      );
                      Alert.alert(t('auth.signup.phoneOtp.alerts.sentTitle'), t('auth.signup.phoneOtp.alerts.sentBody'));
                      // TODO: Add OTP verification step
                    } catch (error: unknown) {
                      if (getAuthErrorCode(error) === AUTH_ERROR_CODE.RATE_LIMITED) {
                        Alert.alert(t('auth.login.alerts.rateLimitedTitle'), t('auth.login.alerts.rateLimitedBody'));
                        return;
                      }
                      Alert.alert(t('auth.signup.phoneOtp.alerts.failedTitle'), t('auth.signup.phoneOtp.alerts.failedBody'));
                    } finally {
                      setIsVerifying(false);
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                    {isVerifying ? t('auth.signup.phoneOtp.sending') : t('auth.signup.phoneOtp.sendOtp')}
                  </Text>
                </Pressable>
              </View>
            )} */}

            {/* Social Login Options - Commented Out */}
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
                <Image source={require('../../../assets/images/google.png')} style={{ width: 18, height: 18, marginRight: 12 }} />
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '500' }}>
                  {t('auth.signup.social.google')}
                </Text>
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
                <Text style={{ fontSize: 18, marginRight: 12 }}></Text>
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '500' }}>
                  {t('auth.signup.social.apple')}
                </Text>
              </Pressable>
            </View> */}


            {/* Footer - Only show on step 0 */}
            {signupStep === 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>
                  {t('auth.signup.footer.byRegistering')}
                  <Text onPress={() => router.push('/useraccounts/consent/security-privacy')} style={{ color: '#0a61d7', textDecorationLine: 'underline' }}>
                    {t('auth.signup.footer.securityPrivacy')}
                  </Text>
                  {t('auth.signup.footer.dot')}
                </Text>
              </View>
            )}

        </ScrollView>
          </KeyboardAvoidingView>
      </View>

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
              <Text style={{ color: '#111827', fontSize: 14 }}>{t('auth.signup.menu.securityPrivacy')}</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 }} />
            <Pressable onPress={() => { closeMenu(); router.push('/useraccounts/consent/helpcenter'); }} style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HelpCircle size={18} color="#111827" />
              <Text style={{ color: '#111827', fontSize: 14 }}>{t('auth.signup.menu.helpCenter')}</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 }} />
            <Pressable onPress={closeMenu} style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <X size={18} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>{t('auth.signup.menu.close')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Country Picker Modal */}
      {isCountryPickerOpen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Animated.View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              opacity: backdropAnim,
              zIndex: 9999,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeCountryPicker} />
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              maxHeight: '70%',
              zIndex: 10000,
              transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
            }}
          >
            <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 }}>{t('auth.signup.countryPicker.title')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <TextInput
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder={t('auth.signup.countryPicker.searchPlaceholder')}
                  placeholderTextColor="#9ca3af"
                  style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: '#111827' }}
                />
              </View>
            </View>
            <ScrollView style={{ paddingVertical: 4 }}>
              {filteredCountries.map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => {
                    setSignupData(prev => ({ 
                      ...prev, 
                      countryCode: c.code,
                      countryDialCode: c.dialCode,
                      countryFlag: getFlagEmoji(c.code)
                    }));
                    closeCountryPicker();
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
                >
                  <Text style={{ fontSize: 18, marginRight: 12 }}>{getFlagEmoji(c.code)}</Text>
                  <Text style={{ fontSize: 16, color: '#111827', flex: 1 }}>{c.name}</Text>
                  <Text style={{ fontSize: 16, color: '#6b7280' }}>{c.dialCode}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </>
  );
}
