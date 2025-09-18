import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { updateMe } from '../../../services/user';

export default function EditBio() {
  const router = useRouter();
  const user = useAuthStore(s => s.user) as any;
  const token = useAuthStore(s => s.token) as string | null;
  const setUser = useAuthStore(s => s.setUser);
  const [value, setValue] = useState<string>(user?.bio || '');

  const onSave = async () => {
    try {
      if (!token) return Alert.alert('Unauthorized');
      const updated = await updateMe(token, { bio: value });
      setUser(updated as any);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 16 }}>
      <TextInput value={value} onChangeText={setValue} placeholder="Bio" multiline numberOfLines={4} style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, textAlignVertical: 'top', minHeight: 120 }} />
      <Pressable onPress={onSave} style={{ marginTop: 16, backgroundColor: '#0a61d7', paddingVertical: 12, borderRadius: 8 }}>
        <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>Save</Text>
      </Pressable>
    </View>
  );
}


