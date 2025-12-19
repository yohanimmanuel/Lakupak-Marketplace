import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function WelcomeModal() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Stack.Screen options={{
        title: 'Welcome to Laku!',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#111827' },
        headerTintColor: '#0a61d7',
      }} />
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Start Distributing!</Text>
        <Text style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
          Join Laku as a distributor to access wholesale tools, manage catalogs, and reach more buyers.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 }}>
            <Text style={{ color: '#0a61d7', fontWeight: '600' }}>Maybe later</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/account')} style={{ backgroundColor: '#0a61d7', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 }}>
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>Get Started</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}


