import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Animated, Easing, Alert, KeyboardAvoidingView, Platform, Keyboard, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { requestOtp, verifyOtp, signupStep1, signupStep2, signupStep3 } from '../../../services/auth';
import { useAuthStore } from '../../../stores/authStore';
import { ArrowLeft, Fingerprint } from 'lucide-react-native';
import { COUNTRIES, getFlagEmoji } from '../../../constants/countries';

export default function SignUpModal() {
  const router = useRouter();
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
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
  
  // Combined signup state - 0 = initial screen, 1-3 = signup steps
  const [signupStep, setSignupStep] = useState(0);
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    storeName: '',
    bio: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    countryCode: 'SG',
    countryDialCode: '+65',
    countryFlag: getFlagEmoji('SG')
  });

  useEffect(() => {
    Animated.timing(fingerKnobAnim, {
      toValue: fingerEnabled ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [fingerEnabled, fingerKnobAnim]);

  // Keyboard visibility listeners to collapse non-essential sections
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const backdropAnim = useRef(new Animated.Value(0)).current; // 0 transparent, 1 opaque

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
      }} />
      
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
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
          <ScrollView 
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >

            {/* Initial Welcome Screen */}
            {signupStep === 0 && (
              <View>
                <View style={{ marginBottom: 32 }}>
                  <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                    Create Account 👋
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                    Join Laku Marketplace and start your journey
                  </Text>
                </View>

                <Pressable
                  onPress={() => setSignupStep(1)}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Create Account</Text>
                </Pressable>

                <View style={{ alignItems: 'center' }}>
                  <Pressable onPress={() => router.push('/useraccounts/loginsignup/loginmodal')}>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                      Already have an account? Login
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Title and Subtitle - Show on steps 1-4 */}
            {signupStep > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                  Create Account 👋
                </Text>
                <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                  Join Laku Marketplace and start your journey
                </Text>
              </View>
            )}

            {/* Step Indicator (hidden when keyboard open to preserve space) */}
            {signupStep > 0 && !isKeyboardVisible && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
              {[1, 2, 3].map((step) => (
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
                  {step < 3 && (
                    <View style={{
                      width: 20,
                      height: 2,
                      backgroundColor: signupStep > step ? '#16a34a' : signupStep >= step ? '#0a61d7' : '#e5e7eb',
                      marginHorizontal: 4
                    }} />
                  )}
                </View>
              ))}
            </View>
            )}

            {/* Step 1: Name & Email */}
            {signupStep === 1 && (
              <View>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    Full Name
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.name}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, name: text }))}
                      placeholder="Enter your full name"
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    Email Address
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.email}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, email: text }))}
                      placeholder="Example@gmail.com"
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
                      Alert.alert('Missing Information', 'Please enter both name and email.');
                      return;
                    }
                    
                    try {
                      await signupStep1(signupData.name.trim(), signupData.email.trim());
                      setSignupStep(2);
                    } catch (error: unknown) {
                      Alert.alert('Signup Failed', (error instanceof Error ? error.message : 'Something went wrong'));
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Continue</Text>
                </Pressable>
              </View>
            )}

            {/* Step 2: Store Name & Bio */}
            {signupStep === 2 && (
              <View>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    Store Name
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.storeName}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, storeName: text }))}
                      placeholder="Enter your store name"
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    Bio (Optional)
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.bio}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, bio: text }))}
                      placeholder="Tell us about your store"
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
                      Alert.alert('Missing Information', 'Please enter a store name.');
                      return;
                    }
                    
                    try {
                      await signupStep2(signupData.storeName.trim(), signupData.bio.trim());
                      setSignupStep(3);
                    } catch (error: unknown) {
                      Alert.alert('Signup Failed', (error instanceof Error ? error.message : 'Something went wrong'));
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Continue</Text>
                </Pressable>
              </View>
            )}

            {/* Step 3: Username & Password */}
            {signupStep === 3 && (
              <View>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    Username
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.username}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, username: text }))}
                      placeholder="Choose a username"
                      placeholderTextColor="#9ca3af"
                      style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    Password
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.password}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, password: text }))}
                      placeholder="Create a password"
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
                    Confirm Password
                  </Text>
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <TextInput
                      value={signupData.confirmPassword}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, confirmPassword: text }))}
                      placeholder="Confirm your password"
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
                    if (!signupData.username.trim() || !signupData.password.trim() || !signupData.confirmPassword.trim()) {
                      Alert.alert('Missing Information', 'Please fill in all fields.');
                      return;
                    }
                    
                    if (signupData.password !== signupData.confirmPassword) {
                      Alert.alert('Password Mismatch', 'Passwords do not match.');
                      return;
                    }
                    
                    if (signupData.password.length < 6) {
                      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
                      return;
                    }
                    
                    try {
                      // Complete signup without phone verification
                      await signupStep3(signupData.username.trim(), signupData.password);
                      
                      // Create account directly with username/password (skip phone verification)
                      const { verifyOtp } = await import('../../../services/auth');
                      const result = await verifyOtp({
                        phone: '+0000000000', // Dummy phone for testing - will be replaced by backend
                        countryCode: 'US',
                        code: '000000', // Dummy OTP code
                        mode: 'signup',
                        profile: {
                          name: signupData.name,
                          email: signupData.email,
                          storeName: signupData.storeName,
                          bio: signupData.bio,
                          username: signupData.username,
                          password: signupData.password
                        }
                      });
                      
                      await setToken(result.token);
                      setUser(result.user);
                      Alert.alert('Account Created!', 'Your account has been created successfully.');
                      router.replace('/(tabs)/home');
                    } catch (error: unknown) {
                      Alert.alert('Signup Failed', (error instanceof Error ? error.message : 'Something went wrong'));
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Create Account</Text>
                </Pressable>

                {/* Add Phone Number Button - Commented Out */}
                {/* <Pressable
                  onPress={() => setSignupStep(4)}
                  style={{ backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 24 }}
                >
                  <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>Add Phone Number</Text>
                </Pressable> */}
              </View>
            )}

            {/* Step 4: Phone Number - Commented Out */}
            {/* {signupStep === 4 && (
              <View>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                    Phone Number
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
                        placeholder="Enter phone number"
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
                      Alert.alert('Missing Information', 'Please enter your phone number.');
                      return;
                    }
                    try {
                      setIsVerifying(true);
                      await requestOtp(
                        `${signupData.countryDialCode}${signupData.phone}`,
                        signupData.countryCode,
                        'sms'
                      );
                      Alert.alert('OTP Sent', 'Please check your phone for the verification code.');
                      // TODO: Add OTP verification step
                    } catch (error: unknown) {
                      Alert.alert('Failed', (error instanceof Error ? error.message : 'Something went wrong'));
                    } finally {
                      setIsVerifying(false);
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                    {isVerifying ? 'Sending...' : 'Send OTP'}
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
                  Sign up with Google
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
                <Text style={{ fontSize: 18, marginRight: 12 }}>🍎</Text>
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '500' }}>
                  Sign up with Apple Id
                </Text>
              </Pressable>
            </View> */}


            {/* Footer - Only show on step 0 */}
            {signupStep === 0 && (
              <View style={{ alignItems: 'center', marginTop: 24 }}>
                <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>
                  By registration, you agree to our{' '}
                  <Text onPress={() => router.push('/useraccounts/consent/security-privacy')} style={{ color: '#0a61d7', textDecorationLine: 'underline' }}>Security and Privacy</Text>.
                </Text>
              </View>
            )}

            {/* Footer - Show on steps 1-3 */}
            {signupStep > 0 && (
              <View style={{ alignItems: 'center', marginTop: 24 }}>
                <Pressable onPress={() => router.push('/useraccounts/loginsignup/loginmodal')}>
                  <Text style={{ color: '#6b7280', fontSize: 14 }}>
                    Already have an account? Login
                  </Text>
                </Pressable>
              </View>
            )}

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
            <Pressable onPress={() => { closeMenu(); router.push('/useraccounts/consent/security-privacy'); }} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ color: '#111827', fontSize: 14 }}>Security & Privacy</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 }} />
            <Pressable onPress={() => { closeMenu(); router.push('/useraccounts/consent/helpcenter'); }} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ color: '#111827', fontSize: 14 }}>Help Center</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 }} />
            <Pressable onPress={closeMenu} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Close</Text>
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
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Select country/region</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <TextInput
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder="Search country or code"
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
