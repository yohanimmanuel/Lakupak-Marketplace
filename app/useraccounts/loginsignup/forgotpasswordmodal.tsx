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
import { AUTH_ERROR_CODE, getAuthErrorCode, requestForgotPassword, verifyForgotPasswordCode, resetPassword } from '../../../services/auth';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onBack = () => {
    if (step === 3) {
      setStep(2);
      setPassword('');
      setConfirmPassword('');
    } else if (step === 2) {
      setStep(1);
      setVerificationCode('');
    } else {
      router.back();
    }
  };

  const handleStep1 = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert(t('auth.forgotPassword.alerts.requiredTitle'), t('auth.forgotPassword.alerts.enterEmailBody'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert(t('auth.forgotPassword.alerts.invalidEmailTitle'), t('auth.forgotPassword.alerts.invalidEmailBody'));
      return;
    }
    setIsLoading(true);
    try {
      await requestForgotPassword(trimmed);
      setStep(2);
    } catch (e) {
      if (getAuthErrorCode(e) === AUTH_ERROR_CODE.RATE_LIMITED) {
        Alert.alert(
          t('auth.forgotPassword.alerts.rateLimitedTitle'),
          t('auth.forgotPassword.alerts.rateLimitedBody'),
        );
        return;
      }
      Alert.alert(t('auth.forgotPassword.alerts.errorTitle'), t('auth.forgotPassword.alerts.genericErrorBody'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2 = async () => {
    const trimmed = email.trim();
    const code = verificationCode.trim();
    if (!code) {
      Alert.alert(t('auth.forgotPassword.alerts.codeRequiredTitle'), t('auth.forgotPassword.alerts.codeRequiredBody'));
      return;
    }
    setIsLoading(true);
    try {
      await verifyForgotPasswordCode(trimmed, code);
      setStep(3);
    } catch (e) {
      if (getAuthErrorCode(e) === AUTH_ERROR_CODE.RATE_LIMITED) {
        Alert.alert(
          t('auth.forgotPassword.alerts.rateLimitedTitle'),
          t('auth.forgotPassword.alerts.rateLimitedBody'),
        );
        return;
      }
      const err = e as Error & { code?: string; response?: { data?: { code?: string } } };
      const apiCode = getAuthErrorCode(e) ?? err?.code ?? err?.response?.data?.code;
      const isInvalidOrExpiredCode =
        apiCode === 'INVALID_OR_EXPIRED_CODE' ||
        apiCode === 'EXPIRED_CODE' ||
        apiCode === AUTH_ERROR_CODE.OTP_VERIFY_FAILED;
      if (isInvalidOrExpiredCode) {
        Alert.alert(
          t('auth.forgotPassword.alerts.invalidOrExpiredCodeTitle'),
          t('auth.forgotPassword.alerts.invalidOrExpiredCodeBody'),
          [{ text: t('auth.forgotPassword.alerts.ok') }],
        );
      } else {
        Alert.alert(t('auth.forgotPassword.alerts.errorTitle'), t('auth.forgotPassword.alerts.genericErrorBody'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep3 = async () => {
    const trimmed = email.trim();
    const code = verificationCode.trim();
    if (!code) {
      Alert.alert(t('auth.forgotPassword.alerts.codeRequiredTitle'), t('auth.forgotPassword.alerts.codeRequiredBody'));
      setStep(2);
      return;
    }
    if (!password.trim()) {
      Alert.alert(t('auth.forgotPassword.alerts.requiredTitle'), t('auth.forgotPassword.alerts.enterNewPasswordBody'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('auth.forgotPassword.alerts.mismatchTitle'), t('auth.forgotPassword.alerts.mismatchBody'));
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
      Alert.alert(t('auth.forgotPassword.alerts.weakPasswordTitle'), t('auth.forgotPassword.passwordHint'));
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(trimmed, code, password);
      Alert.alert(
        t('auth.forgotPassword.alerts.passwordResetTitle'),
        t('auth.forgotPassword.alerts.passwordResetBody'),
        [{ text: t('auth.forgotPassword.alerts.ok'), onPress: () => router.replace('/useraccounts/loginsignup/loginmodal') }]
      );
    } catch (e) {
      if (getAuthErrorCode(e) === AUTH_ERROR_CODE.RATE_LIMITED) {
        Alert.alert(
          t('auth.forgotPassword.alerts.rateLimitedTitle'),
          t('auth.forgotPassword.alerts.rateLimitedBody'),
        );
        return;
      }
      const code = getAuthErrorCode(e);
      if (code === AUTH_ERROR_CODE.VERIFICATION_CODE_REQUIRED) {
        Alert.alert(t('auth.forgotPassword.alerts.codeRequiredTitle'), t('auth.forgotPassword.alerts.codeRequiredBody'));
        return;
      }
      if (code === AUTH_ERROR_CODE.SIGNUP_WEAK_PASSWORD) {
        Alert.alert(t('auth.forgotPassword.alerts.weakPasswordTitle'), t('auth.forgotPassword.passwordHint'));
        return;
      }
      const err = e as Error & { code?: string; response?: { data?: { code?: string } } };
      const apiCode = err?.code ?? err?.response?.data?.code;
      const isInvalidOrExpiredCode =
        apiCode === 'INVALID_OR_EXPIRED_CODE' ||
        apiCode === 'EXPIRED_CODE' ||
        apiCode === AUTH_ERROR_CODE.OTP_VERIFY_FAILED;
      if (isInvalidOrExpiredCode) {
        Alert.alert(
          t('auth.forgotPassword.alerts.invalidOrExpiredCodeTitle'),
          t('auth.forgotPassword.alerts.invalidOrExpiredCodeBody'),
          [{ text: t('auth.forgotPassword.alerts.ok'), onPress: () => { setStep(2); setPassword(''); setConfirmPassword(''); } }],
        );
      } else {
        Alert.alert(t('auth.forgotPassword.alerts.errorTitle'), t('auth.forgotPassword.alerts.genericErrorBody'));
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
                {t('auth.forgotPassword.title')}
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
                  source={require('../../../assets/images/Lakupak!.png')}
                  style={{ width: 128, height: 32, marginBottom: 8 }}
                  resizeMode="contain"
                />
              </Pressable>

              {step === 1 && (
                <>
                  <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                      {t('auth.forgotPassword.step1.heading')}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                      {t('auth.forgotPassword.step1.subheading')}
                    </Text>
                  </View>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      {t('auth.forgotPassword.step1.emailLabel')}
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
                        placeholder={t('auth.forgotPassword.step1.emailPlaceholder')}
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
                      {isLoading ? t('auth.forgotPassword.step1.sending') : t('auth.forgotPassword.step1.continue')}
                    </Text>
                  </Pressable>
                </>
              )}

              {step === 2 && (
                <>
                  <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                      {t('auth.forgotPassword.step2.heading')}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                      {t('auth.forgotPassword.step2.subheading')}
                    </Text>
                  </View>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      {t('auth.forgotPassword.step2.codeLabel')}
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
                        placeholder={t('auth.forgotPassword.step2.codePlaceholder')}
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
                      {isLoading ? t('auth.forgotPassword.step2.verifying') : t('auth.forgotPassword.step2.continue')}
                    </Text>
                  </Pressable>
                </>
              )}

              {step === 3 && (
                <>
                  <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: '#111827', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
                      {t('auth.forgotPassword.step3.heading')}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                      {t('auth.forgotPassword.step3.subheading')}
                    </Text>
                  </View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      {t('auth.forgotPassword.step3.newPasswordLabel')}
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
                        placeholder={t('auth.forgotPassword.step3.newPasswordPlaceholder')}
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
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      {t('auth.forgotPassword.step3.confirmPasswordLabel')}
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
                        placeholder={t('auth.forgotPassword.step3.confirmPasswordPlaceholder')}
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
                  <Text style={{ color: '#9ca3af', fontSize: 12, lineHeight: 18, marginBottom: 24 }}>
                    {t('auth.forgotPassword.passwordHint')}
                  </Text>
                  <Pressable
                    onPress={handleStep3}
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
                      {isLoading ? t('auth.forgotPassword.step3.resetting') : t('auth.forgotPassword.step3.resetPassword')}
                    </Text>
                  </Pressable>
                </>
              )}

              <View style={{ alignItems: 'center', marginTop: 24 }}>
                <Pressable onPress={() => router.replace('/useraccounts/loginsignup/loginmodal')}>
                  <Text style={{ color: '#6b7280', fontSize: 14 }}>{t('auth.forgotPassword.backToLogin')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
