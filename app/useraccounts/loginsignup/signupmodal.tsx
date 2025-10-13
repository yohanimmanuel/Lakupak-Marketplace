import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ScrollView, Animated, Easing, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// import { signUpWithGoogle } from '../../../services/auth'; // Temporarily disabled for future development
import { useAuthStore } from '../../../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Fingerprint } from 'lucide-react-native';

export default function SignUpModal() {
  const router = useRouter();
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
  const [fingerEnabled, setFingerEnabled] = useState(false);
  const fingerKnobAnim = useRef(new Animated.Value(0)).current; // 0 off, 1 on
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.timing(fingerKnobAnim, {
      toValue: fingerEnabled ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [fingerEnabled, fingerKnobAnim]);

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
              onPress={() => router.replace('/(tabs)/account')} 
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

          {/* Section 3: Sign Up Form */}
          <View style={{ backgroundColor: '#ffffff', flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 30, paddingBottom: 140 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <View style={{ backgroundColor: '#F5E6B3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#8B7355', fontSize: 12, marginRight: 6 }}>🛡️</Text>
                <Text style={{ color: '#8B7355', fontSize: 12, fontWeight: '500' }}>Privacy Protection & Secure Payment</Text>
              </View>
            </View>

            {/* Simple Signup Button */}
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
              <Pressable
                onPress={() => router.push('/useraccounts/loginsignup/accountcreationmodal')}
                style={{ 
                  backgroundColor: '#0a61d7', 
                  borderRadius: 12, 
                  paddingVertical: 16, 
                  paddingHorizontal: 40,
                  alignItems: 'center', 
                  justifyContent: 'center',
                  shadowColor: '#0a61d7',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>Create Account</Text>
              </Pressable>
              
              <Text style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 16, paddingHorizontal: 20 }}>
                Join thousands of sellers on Laku-Laku marketplace
              </Text>
            </View>

            {/* Google Signup Section - Temporarily Disabled for Future Development */}
            {/* <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
              <Text style={{ color: '#6b7280', fontSize: 14, marginHorizontal: 12 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 100 }}>
              <Pressable 
                onPress={async () => {
                  setIsGoogleLoading(true);
                  try {
                    const result = await signUpWithGoogle();
                    await setToken(result.token);
                    setUser(result.user);
                    router.replace('/(tabs)/account');
                  } catch (error: unknown) {
                    Alert.alert('Google Sign-up Failed', (error instanceof Error ? error.message : 'Something went wrong'));
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
            </View> */}


            {/* Consent moved to footer */}
          </View>
        </View>
      </LinearGradient>

      {/* Sticky Footer */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', paddingHorizontal: 30, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
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
            <Text onPress={() => router.push('/useraccounts/consent/security-privacy')} style={{ color: '#0a61d7', textDecorationLine: 'underline' }}>Security and Privacy</Text>.
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
                }),
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
                      translateX: fingerKnobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }),
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

    </>
  );
}
