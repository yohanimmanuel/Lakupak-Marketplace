import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { requestForgotPassword, resetPassword } from '../../../services/auth';

const PASSWORD_HINT =
  'At least 8 characters, with uppercase, lowercase, number, and special character.';

export default function ForgotPasswordModal() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onBack = () => {
    if (step === 2) {
      setStep(1);
      setVerificationCode('');
      setPassword('');
      setConfirmPassword('');
    } else {
      router.back();
    }
  };

  const handleStep1 = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      await requestForgotPassword(trimmed);
      setStep(2);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2 = async () => {
    const trimmed = email.trim();
    const code = verificationCode.trim();
    if (!code) {
      Alert.alert('Verification Code Required', 'Please enter the 6-digit code we sent to your email.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter a new password.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    const isStrongPassword = (pwd: string): boolean => {
  const minLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
  return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
};

    if (!isStrongPassword(password)) {
      Alert.alert('Weak Password', PASSWORD_HINT);
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(trimmed, code, password);
      Alert.alert(
        'Password Reset',
        'Your password has been reset. You can now log in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/useraccounts/loginsignup/loginmodal') }]
      );
    } catch (e) {
      const err = e as Error & { code?: string; response?: { data?: { code?: string } } };
      const code = err?.code ?? err?.response?.data?.code;
      const msg = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      const isInvalidOrExpiredCode =
        code === 'INVALID_OR_EXPIRED_CODE' ||
        code === 'EXPIRED_CODE' ||
        (!code && (msg.includes('Invalid') || msg.includes('expired') || msg.includes('Verification'))); // fallback for legacy
      if (isInvalidOrExpiredCode) {
        Alert.alert(
          'Invalid or Expired Code',
          'The verification code is invalid or has expired. Please request a new password reset and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 16,
                backgroundColor: '#ffffff',
              }}
            >
              <Pressable onPress={onBack} style={{ padding: 8 }}>
                <ArrowLeft color="#111827" size={24} />
              </Pressable>
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600' }}>
                Forgot Password
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={{ flex: 1, backgroundColor: '#ffffff' }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable onPress={() => router.push('/useraccounts/welcome')}>
                <Image
                  source={require('../../../assets/images/LakuLakuMobileIcon.png')}
                  style={{ width: 135, height: 90 }}
                />
              </Pressable>

              {step === 1 ? (
                <>
                  <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                      Reset your password
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                      Enter the email address you use to log in. We'll let you set a new password.
                    </Text>
                  </View>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      Your Email
                    </Text>
                    <View
                      style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                      }}
                    >
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Example@gmail.com"
                        placeholderTextColor="#9ca3af"
                        style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                    </View>
                  </View>
                  <Pressable
                    onPress={handleStep1}
                    disabled={isLoading}
                    style={{
                      backgroundColor: isLoading ? '#93c5fd' : '#0a61d7',
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      opacity: isLoading ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                      {isLoading ? 'Sending…' : 'Continue'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                      Create new password
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                      Enter the 6-digit code we sent to your email, then choose a new password.
                    </Text>
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      Verification Code
                    </Text>
                    <View
                      style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                      }}
                    >
                      <TextInput
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        placeholder="e.g. 123456"
                        placeholderTextColor="#9ca3af"
                        style={{ paddingVertical: 16, fontSize: 16, color: '#111827' }}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                    </View>
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      New Password
                    </Text>
                    <View
                      style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="New password"
                        placeholderTextColor="#9ca3af"
                        style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                      <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                        {showPassword ? (
                          <EyeOff color="#6b7280" size={20} />
                        ) : (
                          <Eye color="#6b7280" size={20} />
                        )}
                      </Pressable>
                    </View>
                  </View>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      Confirm Password
                    </Text>
                    <View
                      style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm new password"
                        placeholderTextColor="#9ca3af"
                        style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                      <Pressable
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ padding: 8 }}
                      >
                        {showConfirmPassword ? (
                          <EyeOff color="#6b7280" size={20} />
                        ) : (
                          <Eye color="#6b7280" size={20} />
                        )}
                      </Pressable>
                    </View>
                  </View>
                  <Pressable
                    onPress={handleStep2}
                    disabled={isLoading}
                    style={{
                      backgroundColor: isLoading ? '#93c5fd' : '#0a61d7',
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      opacity: isLoading ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                      {isLoading ? 'Resetting…' : 'Reset password'}
                    </Text>
                  </Pressable>
                </>
              )}

              <View style={{ alignItems: 'center', marginTop: 24 }}>
                <Pressable onPress={() => router.replace('/useraccounts/loginsignup/loginmodal')}>
                  <Text style={{ color: '#6b7280', fontSize: 14 }}>Back to Login</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
