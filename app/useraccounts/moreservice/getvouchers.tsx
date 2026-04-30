import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function GetVouchersModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('moreService.vouchers.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>{t('moreService.vouchers.headline')}</Text>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
          {t('moreService.vouchers.body')}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 }}>
            <Text style={{ color: '#0a61d7', fontWeight: '600' }}>{t('profile.common.close')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
