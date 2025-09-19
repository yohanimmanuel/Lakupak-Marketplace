import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, TextInput, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { requestOtp, verifyOtp, loginWithCredentials } from '../../../services/auth';
// import { signInWithGoogle } from '../../../services/auth'; // Temporarily disabled
import { useAuthStore } from '../../../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Fingerprint, Phone, Search, User } from 'lucide-react-native';
import { COUNTRIES, getFlagEmoji } from '../../../constants/countries';

export default function LoginModal() {
  const router = useRouter();
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
  const [fingerEnabled, setFingerEnabled] = useState(false);
  const knobAnim = useRef(new Animated.Value(0)).current; // 0 off, 1 on
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [showUsernameLogin, setShowUsernameLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // WhatsApp only
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string; dialCode: string; flag: string }>(
    { code: 'SG', name: 'Singapore', dialCode: '+65', flag: getFlagEmoji('SG') }
  );
  const [countrySearch, setCountrySearch] = useState('');
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible
  const backdropAnim = useRef(new Animated.Value(0)).current; // 0 transparent, 1 opaque
  const [isVerifying, setIsVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    Animated.timing(knobAnim, {
      toValue: fingerEnabled ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [fingerEnabled, knobAnim]);

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
  const openCountryPicker = () => { setIsCountryPickerOpen(true); };
  const closeCountryPicker = () => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setIsCountryPickerOpen(false));
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
  const filteredCountries = useMemo(() => {
    const keyword = countrySearch.trim().toLowerCase();
    if (!keyword) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(keyword) || c.code.toLowerCase().includes(keyword) || c.dialCode.includes(keyword));
  }, [countrySearch]);

  return (
    <>
      <Stack.Screen options={{
        presentation: 'modal',
        headerShown: false,
      }} />
      
      <LinearGradient
        colors={['#0a61d7', '#4293fc']}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingTop: 50 }}>
          {/* Section 1: Top Navigation Bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
            <Pressable 
              onPress={() => router.replace('/(tabs)/account' as any)} 
              style={{ padding: 8 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>✕</Text>
            </Pressable>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image 
                source={require('../../../assets/images/LakuMobileLogoWhite.png')} 
                style={{ width: 28, height: 28, marginRight: 8 }} 
                resizeMode="contain"
              />
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>Laku-Laku</Text>
            </View>
            
            <Pressable style={{ padding: 8 }} onPress={openMenu}>
              <Text style={{ color: '#ffffff', fontSize: 16 }}>⋯</Text>
            </Pressable>
          </View>

          {/* Section 2: Voucher Section */}
          <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 20 }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '600', marginBottom: 20 }}>
              Use your $8.00 Voucher Soon!
            </Text>
            
            <View style={{ position: 'relative', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 20, marginHorizontal: 40, position: 'relative' }}>
                <View style={{ position: 'absolute', top: -8, left: '50%', marginLeft: -20, backgroundColor: '#0a61d7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>🎁</Text>
                </View>
                <Text style={{ color: '#0a61d7', fontSize: 32, fontWeight: '700', textAlign: 'center' }}>$8.00</Text>
                <Text style={{ color: '#0a61d7', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>
                  Only For First Order
                </Text>
              </View>
              
              {/* Decorative stars */}
              <Text style={{ position: 'absolute', top: -10, left: 20, color: '#ffffff', fontSize: 16 }}>✨</Text>
              <Text style={{ position: 'absolute', top: 20, right: 10, color: '#ffffff', fontSize: 12 }}>⭐</Text>
              <Text style={{ position: 'absolute', bottom: 10, left: 30, color: '#ffffff', fontSize: 14 }}>✨</Text>
            </View>
          </View>

          {/* Section 3: Login Options */}
          <View style={{ backgroundColor: '#ffffff', flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 30, paddingBottom: 140 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <View style={{ backgroundColor: '#F5E6B3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#8B7355', fontSize: 12, marginRight: 6 }}>🛡️</Text>
                <Text style={{ color: '#8B7355', fontSize: 12, fontWeight: '500' }}>Privacy Protection & Secure Payment</Text>
              </View>
            </View>

            {/* Google Login Button - Temporarily Disabled */}
            {/* {!showPhoneLogin && (
              <Pressable 
                onPress={async () => {
                  setIsGoogleLoading(true);
                  try {
                    const result = await signInWithGoogle();
                    await setToken(result.token);
                    setUser(result.user);
                    router.replace('/(tabs)/account' as any);
                  } catch (error: any) {
                    Alert.alert('Google Sign-in Failed', error.message || 'Something went wrong');
                  } finally {
                    setIsGoogleLoading(false);
                  }
                }}
                disabled={isGoogleLoading}
                style={{ 
                  backgroundColor: isGoogleLoading ? '#e5e7eb' : '#f3f4f6', 
                  borderRadius: 12, 
                  paddingVertical: 16, 
                  paddingHorizontal: 20, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginBottom: 10 
                }}
              >
                <Image source={require('../../../assets/images/google.png')} style={{ width: 18, height: 18, marginRight: 12 }} />
                <Text style={{ color: isGoogleLoading ? '#6b7280' : '#111827', fontSize: 16, fontWeight: '500' }}>
                  {isGoogleLoading ? 'Signing in...' : 'Log in with Google'}
                </Text>
              </Pressable>
            )} */}
 
            {!showPhoneLogin && !showUsernameLogin && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
                <Pressable onPress={() => setShowPhoneLogin(true)} style={{ flexDirection: 'row', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Phone color='#0a61d7' size={14} style={{ marginRight: 8 }} />
                  <Text style={{ color: '#0a61d7', fontSize: 14, fontWeight: '500' }}>Mobile Number</Text>
                </Pressable>
                <Pressable onPress={() => setShowUsernameLogin(true)} style={{ flexDirection: 'row', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <User color='#0a61d7' size={14} style={{ marginRight: 8 }} />
                  <Text style={{ color: '#0a61d7', fontSize: 14, fontWeight: '500' }}>Username</Text>
                </Pressable>
              </View>
            )}

            {showPhoneLogin && (
              <View>
                {/* WhatsApp only */}
                <View style={{ flexDirection: 'row', marginBottom: 10, borderBottomWidth: 2, borderBottomColor: '#0a61d7' }}>
                  <View style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#0a61d7', fontSize: 16, fontWeight: '600' }}>WhatsApp</Text>
                  </View>
                </View>
                {/* Centered back below tabs */}
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Pressable onPress={() => (isVerifying ? setIsVerifying(false) : setShowPhoneLogin(false))} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                    <ArrowLeft color='#0a61d7' size={16} style={{ marginRight: 6 }} />
                    <Text style={{ color: '#0a61d7', fontSize: 14, fontWeight: '500' }}>Back</Text>
                  </Pressable>
                </View>
                {/* Phase 1: Enter phone */}
                {!isVerifying && (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                      <Pressable onPress={openCountryPicker} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginRight: 8 }}>
                        <Text style={{ fontSize: 16, marginRight: 8 }}>{selectedCountry.flag}</Text>
                        <Text style={{ color: '#111827', fontSize: 16 }}>{selectedCountry.dialCode}</Text>
                      </Pressable>
                      <View style={{ width: 1, height: 20, backgroundColor: '#e5e7eb', marginRight: 8 }} />
                      <TextInput
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="Mobile number"
                        placeholderTextColor="#9ca3af"
                        style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <Pressable
                      onPress={async () => {
                        // Advance UI immediately; fire request in background
                        setIsVerifying(true);
                        setCode('');
                        if (!phoneNumber.trim()) return;
                        try {
                          const fullPhone = `${selectedCountry.dialCode}${phoneNumber.trim().replace(/\s+/g, '').replace(/^0+/, '')}`;
                          await requestOtp(fullPhone, selectedCountry.code, 'whatsapp');
                        } catch (e: any) {
                          Alert.alert('Send failed', 'Could not request WhatsApp OTP. Check network/backend.');
                        }
                      }}
                      style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Send code via WhatsApp</Text>
                    </Pressable>
                  </View>
                )}

                {/* Phase 2: Verify code */}
                {isVerifying && (
                  <View>
                    
                    <Text style={{ color: '#111827', fontSize: 16, marginBottom: 8 }}>We sent a code to</Text>
                    <Text style={{ color: '#0a61d7', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{selectedCountry.dialCode} {phoneNumber}</Text>
                    <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 }}>
                      <TextInput
                        value={code}
                        onChangeText={setCode}
                        placeholder="Enter 6-digit code"
                        placeholderTextColor="#9ca3af"
                        style={{ paddingVertical: 16, fontSize: 18, color: '#111827', letterSpacing: 6, textAlign: 'center' }}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <Pressable
                      onPress={async () => {
                        if (code.trim().length < 4) return;
                        try {
                          const fullPhone = `${selectedCountry.dialCode}${phoneNumber.trim().replace(/\s+/g, '').replace(/^0+/, '')}`;
                          const res = await verifyOtp({ phone: fullPhone, countryCode: selectedCountry.code, code: code.trim(), profile: undefined, mode: 'login' } as any);
                          await setToken(res.token);
                          setUser(res.user);
                          router.replace('/(tabs)/account' as any);
                        } catch (e: any) {
                          // Handle specific error cases for phone login
                          if (e.message.includes('User not found') || e.message.includes('No account found')) {
                            Alert.alert(
                              'Account Not Found', 
                              'No account found with this phone number. Please sign up first.',
                              [
                                { text: 'OK', style: 'default' },
                                { text: 'Sign Up', style: 'default', onPress: () => router.push('/useraccounts/loginsignup/signupmodal') }
                              ]
                            );
                          } else if (e.message.includes('Invalid code')) {
                            Alert.alert('Invalid Code', 'The verification code is incorrect. Please try again.');
                          } else {
                            Alert.alert('Verification Failed', e.message || 'Invalid code or network issue. Please try again.');
                          }
                        }
                      }}
                      style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Verify</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {showUsernameLogin && (
              <View>
                {/* Username/Password Login */}
                <View style={{ flexDirection: 'row', marginBottom: 10, borderBottomWidth: 2, borderBottomColor: '#0a61d7' }}>
                  <View style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#0a61d7', fontSize: 16, fontWeight: '600' }}>Username & Password</Text>
                  </View>
                </View>
                
                {/* Centered back below tabs */}
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Pressable onPress={() => setShowUsernameLogin(false)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                    <ArrowLeft color='#0a61d7' size={16} style={{ marginRight: 6 }} />
                    <Text style={{ color: '#0a61d7', fontSize: 14, fontWeight: '500' }}>Back</Text>
                  </Pressable>
                </View>

                {/* Username Input */}
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Username or Email"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Password Input */}
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                    style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Login Button */}
                <Pressable
                  onPress={async () => {
                    if (!username.trim() || !password.trim()) {
                      Alert.alert('Missing Information', 'Please enter both username and password.');
                      return;
                    }
                    
                    try {
                      const result = await loginWithCredentials(username.trim(), password);
                      await setToken(result.token);
                      setUser(result.user);
                      router.replace('/(tabs)/account' as any);
                    } catch (error: any) {
                      // Handle specific error cases
                      if (error.message.includes('User not found') || error.message.includes('Please sign up first')) {
                        Alert.alert(
                          'Account Not Found', 
                          'No account found with this username/email. Please sign up first.',
                          [
                            { text: 'OK', style: 'default' },
                            { text: 'Sign Up', style: 'default', onPress: () => router.push('/useraccounts/loginsignup/signupmodal') }
                          ]
                        );
                      } else if (error.message.includes('Invalid username or password')) {
                        Alert.alert('Invalid Credentials', 'The username/email or password is incorrect. Please try again.');
                      } else {
                        Alert.alert('Login Failed', error.message || 'Something went wrong. Please try again.');
                      }
                    }
                  }}
                  style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Log In</Text>
                </Pressable>
              </View>
            )}

            {/* Sticky area removed from here; handled in footer */}
          </View>
        </View>
      </LinearGradient>
      {/* Sticky Footer */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', paddingHorizontal: 30, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.push('/useraccounts/loginsignup/signupmodal')}>
              <Text style={{ color: '#0a61d7', fontSize: 16, fontWeight: '500' }}>Sign up Now</Text>
            </Pressable>
            <Text style={{ color: '#6b7280', fontSize: 16, marginHorizontal: 8 }}>•</Text>
            <Text style={{ color: '#0a61d7', fontSize: 16, fontWeight: '500' }}>Trouble signing in?</Text>
          </View>
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
                backgroundColor: knobAnim.interpolate({
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
                      translateX: knobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) as any,
                    },
                  ],
                }}
              />
            </Animated.View>
          </Pressable>
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
                    setSelectedCountry({ ...c, flag: getFlagEmoji(c.code) });
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
