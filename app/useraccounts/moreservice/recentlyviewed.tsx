import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function RecentlyViewedModal() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Stack.Screen options={{
        presentation: 'modal',
        title: 'Recently Viewed',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#111827' },
        headerTintColor: '#0a61d7',
      }} />
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Recently Viewed</Text>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
          View your recently browsed products and continue shopping.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 }}>
            <Text style={{ color: '#0a61d7', fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
