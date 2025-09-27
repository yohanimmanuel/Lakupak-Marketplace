import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ScrollView, Animated, Easing, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { requestOtp, verifyOtp, signupStep1, signupStep2, signupStep3 } from '../../../services/auth';
// import { signUpWithGoogle } from '../../../services/auth'; // Temporarily disabled for future development
import { useAuthStore } from '../../../stores/authStore';
import { ArrowLeft, Fingerprint } from 'lucide-react-native';
import { COUNTRIES, getFlagEmoji } from '../../../constants/countries';

export default function AccountCreationModal() {
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
  const [devCode, setDevCode] = useState<string | null>(null);
  
  // Combined signup state - 4 steps total
  const [signupStep, setSignupStep] = useState(1);
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
        presentation: 'modal',
        headerShown: false,
      }} />
      
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        {/* Top Navigation Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <Pressable 
            onPress={() => router.replace('/(tabs)/account' as any)} 
            style={{ padding: 8 }}
          >
            <ArrowLeft color='#111827' size={24} />
          </Pressable>
          
          <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600' }}>Create Account</Text>
          
          <Pressable style={{ padding: 8 }} onPress={openMenu}>
            <Text style={{ color: '#111827', fontSize: 16 }}>⋯</Text>
          </Pressable>
        </View>

        {/* Main Content */}
        <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>


            {/* Step Indicator */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              {[1, 2, 3, 4].map((step) => (
                <View key={step} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: signupStep > step ? '#10b981' : signupStep >= step ? '#0a61d7' : '#e5e7eb',
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
                      backgroundColor: signupStep > step ? '#10b981' : signupStep >= step ? '#0a61d7' : '#e5e7eb',
                      marginHorizontal: 4
                    }} />
                  )}
                </View>
              ))}
            </View>

            {/* Step 1: Name & Email */}
            {signupStep === 1 && (
              <View>
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={signupData.name}
                    onChangeText={(text) => setSignupData(prev => ({ ...prev, name: text }))}
                    placeholder="Full Name"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={signupData.email}
                    onChangeText={(text) => setSignupData(prev => ({ ...prev, email: text }))}
                    placeholder="Email Address"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
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
                    } catch (error: any) {
                      Alert.alert('Signup Failed', error.message || 'Something went wrong');
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Continue</Text>
                </Pressable>
              </View>
            )}

            {/* Step 2: Store Name & Bio */}
            {signupStep === 2 && (
              <View>
                
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={signupData.storeName}
                    onChangeText={(text) => setSignupData(prev => ({ ...prev, storeName: text }))}
                    placeholder="Store Name"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={signupData.bio}
                    onChangeText={(text) => setSignupData(prev => ({ ...prev, bio: text }))}
                    placeholder="Bio (Optional)"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827', minHeight: 60 }}
                    multiline
                    textAlignVertical="top"
                  />
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
                    } catch (error: any) {
                      Alert.alert('Signup Failed', error.message || 'Something went wrong');
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Continue</Text>
                </Pressable>
              </View>
            )}

            {/* Step 3: Username & Password */}
            {signupStep === 3 && (
              <View>
                
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={signupData.username}
                    onChangeText={(text) => setSignupData(prev => ({ ...prev, username: text }))}
                    placeholder="Username"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={signupData.password}
                    onChangeText={(text) => setSignupData(prev => ({ ...prev, password: text }))}
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={signupData.confirmPassword}
                    onChangeText={(text) => setSignupData(prev => ({ ...prev, confirmPassword: text }))}
                    placeholder="Confirm Password"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
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
                      await signupStep3(signupData.username.trim(), signupData.password);
                      setSignupStep(4);
                    } catch (error: any) {
                      Alert.alert('Signup Failed', error.message || 'Something went wrong');
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Continue to Phone Verification</Text>
                </Pressable>

                {/* Skip Phone Verification Option */}
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
                      router.replace('/(tabs)/account' as any);
                    } catch (error: any) {
                      Alert.alert('Signup Failed', error.message || 'Something went wrong');
                    }
                  }}
                  style={{ backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Skip Phone Verification</Text>
                </Pressable>
                
                <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
                  Phone number is optional. You can add your phone number later in account settings
                </Text>
              </View>
            )}

            {/* Step 4: Phone Verification */}
            {signupStep === 4 && (
              <View>
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Text style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 10 }}>
                    We'll send a verification code via WhatsApp
                  </Text>
                </View>

                {/* Phone Number Input */}
                {!isVerifying && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Pressable onPress={openCountryPicker} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginRight: 8 }}>
                      <Text style={{ fontSize: 16, marginRight: 8 }}>{signupData.countryFlag}</Text>
                      <Text style={{ color: '#111827', fontSize: 16 }}>{signupData.countryDialCode}</Text>
                    </Pressable>
                    <View style={{ width: 1, height: 20, backgroundColor: '#e5e7eb', marginRight: 8 }} />
                    <TextInput
                      value={signupData.phone}
                      onChangeText={(text) => setSignupData(prev => ({ ...prev, phone: text }))}
                      placeholder="Mobile number"
                      placeholderTextColor="#9ca3af"
                      style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                      keyboardType="phone-pad"
                    />
                  </View>
                )}

                {/* Send Code / Verify Flow */}
                {!isVerifying && (
                  <Pressable
                    onPress={async () => {
                      if (!signupData.phone.trim()) {
                        Alert.alert('Missing Information', 'Please enter your mobile number.');
                        return;
                      }
                      
                      // Advance UI immediately; fire request in background
                      setIsVerifying(true);
                      setVerificationCode('');
                      try {
                        const fullPhone = `${signupData.countryDialCode}${signupData.phone.trim().replace(/\s+/g, '').replace(/^0+/, '')}`;
                        await requestOtp(fullPhone, signupData.countryCode, 'whatsapp');
                      } catch (e: any) {
                        Alert.alert('Send failed', 'Could not request WhatsApp OTP. Check network/backend.');
                      }
                    }}
                    style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                      Send code via WhatsApp
                    </Text>
                  </Pressable>
                )}
                {isVerifying && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: '#111827', fontSize: 16, marginBottom: 8 }}>We sent a code to</Text>
                    <Text style={{ color: '#0a61d7', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{signupData.countryDialCode} {signupData.phone}</Text>
                    <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 }}>
                      <TextInput
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        placeholder="Enter 6-digit code"
                        placeholderTextColor="#9ca3af"
                        style={{ paddingVertical: 16, fontSize: 18, color: '#111827', letterSpacing: 6, textAlign: 'center' }}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <Pressable
                      onPress={async () => {
                        if (verificationCode.trim().length < 4) return;
                        try {
                          const fullPhone = `${signupData.countryDialCode}${signupData.phone.trim().replace(/\s+/g, '').replace(/^0+/, '')}`;
                          
                          const res = await verifyOtp({ 
                            phone: fullPhone, 
                            countryCode: signupData.countryCode, 
                            code: verificationCode.trim(), 
                            profile: {
                              name: signupData.name,
                              email: signupData.email,
                              storeName: signupData.storeName,
                              bio: signupData.bio,
                              username: signupData.username,
                              password: signupData.password
                            },
                            mode: 'signup' 
                          } as any);
                          
                          await setToken(res.token);
                          setUser(res.user);
                          router.replace('/(tabs)/account' as any);
                        } catch (e: any) {
                          Alert.alert('Verification failed', e.message || 'Invalid code or network/backend issue.');
                        }
                      }}
                      style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Complete Registration</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* Google Signup Section - Temporarily Disabled for Future Development */}
            {/* {signupStep === 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
                <Text style={{ color: '#6b7280', fontSize: 14, marginHorizontal: 12 }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
              </View>
            )}

            {signupStep === 1 && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 100 }}>
                <Pressable 
                  onPress={async () => {
                    setIsGoogleLoading(true);
                    try {
                      const result = await signUpWithGoogle();
                      await setToken(result.token);
                      setUser(result.user);
                      router.replace('/(tabs)/account' as any);
                    } catch (error: any) {
                      Alert.alert('Google Sign-up Failed', error.message || 'Something went wrong');
                    } finally {
                      setIsGoogleLoading(false);
                    }
                  }}
                  disabled={isGoogleLoading}
                  style={{ 
                    backgroundColor: isGoogleLoading ? '#e5e7eb' : '#f3f4f6', 
                    borderRadius: 12, 
                    paddingVertical: 16, 
                    flex: 1, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                >
                  <Image source={require('../../../assets/images/google.png')} style={{ width: 18, height: 18 }} />
                </Pressable>
              </View>
            )} */}

        </ScrollView>

        {/* Footer */}
        <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => router.push('/useraccounts/loginsignup/loginmodal')}>
                <Text style={{ color: '#0a61d7', fontSize: 16, fontWeight: '500' }}>Login Now</Text>
              </Pressable>
              <Text style={{ color: '#6b7280', fontSize: 16, marginHorizontal: 8 }}>•</Text>
              <Text style={{ color: '#0a61d7', fontSize: 16, fontWeight: '500' }}>Trouble signing in?</Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>
              By registration, you agree to our{' '}
              <Text onPress={() => router.push('/useraccounts/consent/security-privacy' as any)} style={{ color: '#0a61d7', textDecorationLine: 'underline' }}>Security and Privacy</Text>.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Fingerprint color='#0a61d7' size={16} style={{ marginRight: 8 }} />
            <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500' }}>Enable Fingerprint Authentication</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setFingerEnabled(v => !v)}>
              <Animated.View
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                  backgroundColor: fingerKnobAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#e5e7eb', '#0a61d7'],
                  }) as any,
                }}
              >
                <Animated.View
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: '#ffffff',
                    borderRadius: 10,
                    transform: [
                      {
                        translateX: fingerKnobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) as any,
                      },
                    ],
                  }}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>
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
            <Pressable onPress={() => { closeMenu(); router.push('/useraccounts/consent/security-privacy' as any); }} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ color: '#111827', fontSize: 14 }}>Security & Privacy</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 }} />
            <Pressable onPress={() => { closeMenu(); router.push('/useraccounts/consent/helpcenter' as any); }} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
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
