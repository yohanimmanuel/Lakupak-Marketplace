import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { updateMe } from '../../../services/user';

export default function EditStoreName() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token) as string | null;
  const setUser = useAuthStore(s => s.setUser);
  const [value, setValue] = useState<string>(user?.storeName || '');

  const onSave = async () => {
    try {
      if (!token) return Alert.alert('Unauthorized');
      const updated = await updateMe(token, { storeName: value });
      setUser(updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', (e instanceof Error ? e.message : 'Failed to update'));
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
                <Pressable 
                  onPress={() => router.back()} 
                  hitSlop={10}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>Edit Store Name</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 16 }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Store Name"
          placeholderTextColor="#9CA3AF"
          accessibilityLabel="Store name input"
          accessibilityHint="Enter your store name"
          style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, color: '#111827' }}
        />
        <Pressable 
          onPress={onSave} 
          accessibilityLabel="Save store name"
          accessibilityRole="button"
          style={{ marginTop: 16, backgroundColor: '#0a61d7', paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>
    </>
  );
}
