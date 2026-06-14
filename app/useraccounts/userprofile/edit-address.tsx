import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, Alert, ScrollView } from 'react-native';
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
import AddressMapPreview from '../../components/address/AddressMapPreview';
import AddressLocationFields from '../../components/address/AddressLocationFields';
import AddressLabelOptions, { type AddressLabel } from '../../components/address/AddressLabelOptions';

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

  const bottomBarPadding = Math.max(insets.bottom, 16);

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
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 + bottomBarPadding }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            {t('profile.editAddress.shippingAddress')}
          </Text>
          <AddressMapPreview address={address} height={200} />
          <AddressLocationFields
            address={address}
            fullName={fullName}
            phone={phone}
            onAddressChange={setAddress}
            onFullNameChange={setFullName}
            onPhoneChange={setPhone}
          />
          <AddressLabelOptions
            isDefault={isDefault}
            label={label}
            onDefaultChange={setIsDefault}
            onLabelChange={setLabel}
          />
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomBarPadding,
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
            backgroundColor: '#ffffff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 5,
          }}
        >
          <Pressable
            onPress={onSave}
            style={{ backgroundColor: '#0a61d7', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('profile.common.save')}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
