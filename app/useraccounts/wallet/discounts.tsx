import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function DiscountsModal() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Stack.Screen options={{
        presentation: 'modal',
        title: 'Discounts',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#111827' },
        headerTintColor: '#0a61d7',
      }} />
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Your Discounts</Text>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
          Here you can view all your available discounts and vouchers.
        </Text>
        <View style={{ backgroundColor: '#f9fafb', padding: 16, borderRadius: 12, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>Total Discounts</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#0a61d7' }}>$12.50</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 }}>
            <Text style={{ color: '#0a61d7', fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
