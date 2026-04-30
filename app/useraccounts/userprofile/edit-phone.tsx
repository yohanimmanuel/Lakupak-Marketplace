import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { updateMe } from '../../../services/user';
import { useTranslation } from 'react-i18next';

export default function EditPhone() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token) as string | null;
  const setUser = useAuthStore(s => s.setUser);
  const [value, setValue] = useState<string>(user?.phone || '');

  const onSave = async () => {
    try {
      if (!token) return Alert.alert(t('profile.common.unauthorized'));
      const updated = await updateMe(token, { phone: value });
      setUser(updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert(t('profile.common.errorTitle'), (e instanceof Error ? e.message : t('profile.common.failedToUpdate')));
    }
  };

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
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('profile.editField.editPhone')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 16 }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={t('profile.editField.placeholders.phone')}
          keyboardType="phone-pad"
          placeholderTextColor="#9CA3AF"
          style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, color: '#111827' }}
        />
        <Pressable onPress={onSave} style={{ marginTop: 16, backgroundColor: '#0a61d7', paddingVertical: 12, borderRadius: 8 }}>
          <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>{t('profile.common.save')}</Text>
        </Pressable>
      </View>
    </>
  );
}


