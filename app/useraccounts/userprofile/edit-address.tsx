import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, Text, Alert, ScrollView, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import {
  updateMe,
  getMarketplaceAddresses,
  createMarketplaceAddress as createAddress,
  updateMarketplaceAddress as updateAddress,
} from '../../../services/user';

type AddressLabel = 'work' | 'store' | 'home';

const normalizeLabel = (value?: string | null): AddressLabel => {
  if (value === 'work' || value === 'store' || value === 'home') {
    return value
  }
  return 'home'
}

export default function EditAddress() {
  const router = useRouter();
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
      if (!token) return Alert.alert('Unauthorized');
      if (id) {
        await updateAddress(token, id, { fullName, phone, address, isDefault, label })
      } else {
        await createAddress(token, { fullName, phone, address, isDefault, label })
      }
      const updated = await updateMe(token, { name: fullName, phone, chosenAddress: isDefault ? address : undefined });
      setUser(updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', (e instanceof Error ? e.message : 'Failed to update'));
    }
  };


  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: '#6B7280', marginBottom: 8 }}>Address</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full Name"
        placeholderTextColor="#9CA3AF"
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, color: '#111827' }}
      />
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone"
        keyboardType="phone-pad"
        placeholderTextColor="#9CA3AF"
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, color: '#111827' }}
      />
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="Address (street, unit, postal)"
        multiline
        numberOfLines={3}
        placeholderTextColor="#9CA3AF"
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, minHeight: 90, color: '#111827' }}
      />
      <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#111827' }}>Set as Default Address</Text>
          <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: '#0a61d733', false: '#e5e7eb' }} thumbColor={isDefault ? '#0a61d7' : '#f3f4f6'} />
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: '#111827', marginBottom: 8 }}>Label As:</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['work','store','home'] as const).map(l => (
              <Pressable key={l} onPress={() => setLabel(l)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: label===l ? '#0a61d7' : '#e5e7eb', backgroundColor: label===l ? '#0a61d71a' : '#ffffff' }}>
                <Text style={{ textAlign: 'center', color: label===l ? '#0a61d7' : '#111827', fontWeight: '600' }}>{l[0].toUpperCase()+l.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={{ height: 16 }} />
      <Pressable onPress={onSave} style={{ backgroundColor: '#0a61d7', paddingVertical: 12, borderRadius: 8 }}>
        <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>Save</Text>
      </Pressable>
    </ScrollView>
  );
}


