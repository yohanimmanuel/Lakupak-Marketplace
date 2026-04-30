import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function HelpCenter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>
                  {t('support.helpCenter.title')}
                </Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
            {t('support.helpCenter.faqTitle')}
          </Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
              {t('support.helpCenter.faqs.verifyPhone.q')}
            </Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              {t('support.helpCenter.faqs.verifyPhone.a')}
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
              {t('support.helpCenter.faqs.googleLogin.q')}
            </Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              {t('support.helpCenter.faqs.googleLogin.a')}
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
              {t('support.helpCenter.faqs.whereIsMyOrder.q')}
            </Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              {t('support.helpCenter.faqs.whereIsMyOrder.a')}
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
              {t('support.helpCenter.faqs.walletRefunds.q')}
            </Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              {t('support.helpCenter.faqs.walletRefunds.a')}
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
              {t('support.helpCenter.faqs.contactSupport.q')}
            </Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              {t('support.helpCenter.faqs.contactSupport.a')}
            </Text>
          </View>
        </ScrollView>
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              {t('support.helpCenter.done')}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}


