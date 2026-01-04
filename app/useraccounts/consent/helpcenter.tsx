import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

export default function HelpCenter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
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
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>Help Center</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Frequently Asked Questions</Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>How do I verify my phone?</Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              Choose WhatsApp or SMS in Sign Up, select your country code, enter your number, then tap "Send code". Enter the verification code to complete.
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>I can’t log in with Google</Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              On web, you can pick a different account each time. If you still see an old session, sign out first and try again.
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>Where is my order?</Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              Go to Account → My Purchases to view status: To Pay, To Ship, To Receive, Completed, Return/Refund, or Cancelled.
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>Wallet and refunds</Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              Refunds are returned to the original payment method or LakuPay depending on the channel and eligibility.
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 6 }}>Contact support</Text>
            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
              For unresolved issues, contact us via support@laku.com. Provide your order ID and a brief description.
            </Text>
          </View>
        </ScrollView>
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}


