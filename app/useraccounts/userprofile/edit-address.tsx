import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, Text, Alert, ScrollView, Switch } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import {
  updateMe,
  getMarketplaceAddresses,
  createMarketplaceAddress as createAddress,
  updateMarketplaceAddress as updateAddress,
} from '../../../services/user';
import { useTranslation } from 'react-i18next';

type AddressLabel = 'work' | 'store' | 'home';

const normalizeLabel = (value?: string | null): AddressLabel => {
  if (value === 'work' || value === 'store' || value === 'home') {
    return value
  }
  return 'home'
}

export default function EditAddress() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token) as string | null;
  const setUser = useAuthStore(s => s.setUser);
  const params = useLocalSearchParams<{ id?: string }>();
  const [id, setId] = useState<number | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [label, setLabel] = useState<AddressLabel>('home');

  useEffect(() => {
    if (params.id) {
      const n = Number(params.id)
      if (!Number.isNaN(n)) setId(n)
    }
  }, [params])

  // Prefill when editing existing address
  useEffect(() => {
    const load = async () => {
      if (!token || !id) return
      try {
        const list = await getMarketplaceAddresses(token)
        const cur = list.find(a => a.id === id)
        if (cur) {
          setFullName(cur.fullName ?? '')
          setPhone(cur.phone ?? '')
          setAddress(cur.address ?? '')
          setIsDefault(Boolean(cur.isDefault))
          setLabel(normalizeLabel(cur.label))
        }
      } catch {}
    }
    load()
  }, [id, token])

  const onSave = async () => {
    try {
      if (!token) return Alert.alert(t('profile.common.unauthorized'));
      if (id) {
        await updateAddress(token, id, { fullName, phone, address, isDefault, label })
      } else {
        await createAddress(token, { fullName, phone, address, isDefault, label })
      }
      const updated = await updateMe(token, { name: fullName, phone, chosenAddress: isDefault ? address : undefined });
      setUser(updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert(t('profile.common.errorTitle'), t('profile.common.failedToUpdate'));
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
                <Pressable onPress={() => router.back()} hitSlop={10}
                  accessibilityLabel={t('profile.common.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>
                  {id ? t('profile.editAddress.editTitle') : t('profile.editAddress.newTitle')}
                </Text>
              </View>
            </View>
          ),
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: '#6B7280', marginBottom: 8 }}>{t('profile.editAddress.sectionTitle')}</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder={t('profile.editAddress.fullName')}
        placeholderTextColor="#9CA3AF"
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, color: '#111827' }}
      />
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder={t('profile.editAddress.phone')}
        keyboardType="phone-pad"
        placeholderTextColor="#9CA3AF"
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, color: '#111827' }}
      />
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder={t('profile.editAddress.address')}
        multiline
        numberOfLines={3}
        placeholderTextColor="#9CA3AF"
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, minHeight: 90, color: '#111827' }}
      />
      <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#111827' }}>{t('profile.editAddress.setDefault')}</Text>
          <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: '#0a61d733', false: '#e5e7eb' }} thumbColor={isDefault ? '#0a61d7' : '#f3f4f6'} />
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: '#111827', marginBottom: 8 }}>{t('profile.editAddress.labelAs')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['work','store','home'] as const).map(l => (
              <Pressable key={l} onPress={() => setLabel(l)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: label===l ? '#0a61d7' : '#e5e7eb', backgroundColor: label===l ? '#0a61d71a' : '#ffffff' }}>
                <Text style={{ textAlign: 'center', color: label===l ? '#0a61d7' : '#111827', fontWeight: '600' }}>
                  {t(`profile.editAddress.labels.${l}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={{ height: 16 }} />
      <Pressable onPress={onSave} style={{ backgroundColor: '#0a61d7', paddingVertical: 12, borderRadius: 8 }}>
        <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>{t('profile.common.save')}</Text>
      </Pressable>
    </ScrollView>
    </>
  );
}


