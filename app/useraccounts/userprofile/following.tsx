import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function FollowingModal() {
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
                <Pressable 
                  onPress={() => router.back()} 
                  hitSlop={10}
                  accessibilityLabel={t('profile.common.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('profile.social.followingTitle')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 16 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: '#111827' }}>{t('profile.social.followingTitle')}</Text>
        <Text style={{ color: '#6B7280', marginTop: 8 }}>{t('profile.social.comingSoon')}</Text>
      </View>
    </>
  );
}


