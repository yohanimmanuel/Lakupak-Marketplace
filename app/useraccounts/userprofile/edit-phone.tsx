import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { updateMe } from '../../../services/user';

export default function EditPhone() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token) as string | null;
  const setUser = useAuthStore(s => s.setUser);
  const [value, setValue] = useState<string>(user?.phone || '');

  const onSave = async () => {
    try {
      if (!token) return Alert.alert('Unauthorized');
      const updated = await updateMe(token, { phone: value });
      setUser(updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', (e instanceof Error ? e.message : 'Failed to update'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 16 }}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Phone"
        keyboardType="phone-pad"
        placeholderTextColor="#9CA3AF"
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, color: '#111827' }}
      />
      <Pressable onPress={onSave} style={{ marginTop: 16, backgroundColor: '#0a61d7', paddingVertical: 12, borderRadius: 8 }}>
        <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>Save</Text>
      </Pressable>
    </View>
  );
}


