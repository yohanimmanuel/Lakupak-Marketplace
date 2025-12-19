import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function SecurityPrivacyConsent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');
  return (
    <>
      <Stack.Screen options={{
        presentation: 'modal',
        title: 'Security & Privacy',
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#111827', fontWeight: '700' },
        headerTintColor: '#0a61d7',
        headerShadowVisible: true,
      }} />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        {/* Sticky Tabs */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, backgroundColor: '#ffffff' }}>
          <View style={{ flexDirection: 'row'}}>
            <Pressable
              onPress={() => setActiveTab('privacy')}
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: activeTab === 'privacy' ? '#0a61d7' : '#6b7280', fontWeight: activeTab === 'privacy' ? '700' : '500' }}>Privacy Policy</Text>
              <View style={{ height: 2, backgroundColor: activeTab === 'privacy' ? '#0a61d7' : 'transparent', width: '100%', marginTop: 8 }} />
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('terms')}
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: activeTab === 'terms' ? '#0a61d7' : '#6b7280', fontWeight: activeTab === 'terms' ? '700' : '500' }}>Terms & Conditions</Text>
              <View style={{ height: 2, backgroundColor: activeTab === 'terms' ? '#0a61d7' : 'transparent', width: '100%', marginTop: 8 }} />
            </Pressable>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {activeTab === 'privacy' ? (
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Privacy Policy</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 16 }}>
                This Privacy Policy explains how Laku collects, uses, discloses, and protects your personal information when you use our marketplace applications and services.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 6 }}>1. Information We Collect</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                • Account Data: name, phone number, country/region, email, profile details.
                {'\n'}• Authentication Data: verification codes (WhatsApp/SMS), device identifiers for fraud prevention.
                {'\n'}• Transaction Data: orders, payments, refunds, vouchers, wallet balance (LakuPay), discounts and bonuses.
                {'\n'}• Usage Data: pages viewed, buttons clicked, device and app version, approximate location (country/region).
                {'\n'}• Communications: messages with support and notifications preferences.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>2. How We Use Information</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                • Provide and improve core features including account creation, order processing, and wallet management.
                {'\n'}• Authenticate your identity, send verification codes, and protect against fraud and abuse.
                {'\n'}• Personalize your experience (e.g., recently viewed, buy again) aligned with Laku standards.
                {'\n'}• Communicate with you about orders, promotions, and service updates.
                {'\n'}• Comply with legal obligations and enforce our Terms.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>3. Sharing and Disclosure</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                • Service Providers: payment processing, analytics, cloud hosting, and communications strictly under contract.
                {'\n'}• Business Partners: where you opt in to specific services, we may share minimal data to fulfil your requests.
                {'\n'}• Legal Requirements: to comply with applicable laws, regulations, or lawful requests.
                {'\n'}• Transfers: in a merger, acquisition, or asset sale, we will notify you where legally required.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>4. Data Retention</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                We retain personal information only for as long as necessary to provide services, meet legal obligations, resolve disputes, and enforce agreements. Retention periods vary by data type and regulatory requirements.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>5. Your Rights</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                Subject to local laws, you may request access, correction, deletion, restriction, or portability of your data. You can also object to certain processing or withdraw consent.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>6. Security</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                We use industry-standard safeguards including encryption in transit, secure credential storage, risk-based authentication, and access controls. While no system is perfectly secure, we continuously improve our protections.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>7. Children</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                Laku is not directed to children under the age of 13 (or the minimum age in your jurisdiction). We do not knowingly collect personal information from children.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>8. Changes to This Policy</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                We may update this policy to reflect changes in our practices or legal requirements. We will post updates in-app and revise the effective date.
              </Text>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Terms & Conditions</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 16 }}>
                These Terms govern your access to and use of Laku marketplace applications and services. By using our services, you agree to these Terms.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 6 }}>1. Accounts</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                • You must provide accurate, current information. You are responsible for maintaining account security.
                {'\n'}• Social sign-in (e.g., Google) must map to your valid email. We may require additional verification.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>2. Orders and Payments</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                • Prices, promotions, and stock availability may change.
                {'\n'}• Payments may be processed by third-party providers. Refunds follow product and channel rules.
                {'\n'}• Disputes and chargebacks will be reviewed according to policy and evidence provided.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>3. Wallet and Vouchers</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                • LakuPay balances, bonuses, and discounts are subject to eligibility and expiry rules.
                {'\n'}• Misuse, fraud, or policy violations may result in suspension or forfeiture as permitted by law.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>4. Acceptable Use</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                You agree not to: violate laws; infringe IP; reverse engineer; spam; harm users; or interfere with the service. We may suspend accounts involved in prohibited activities.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>5. Intellectual Property</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                Laku trademarks, logos, and content are protected by law. You may not use our branding without prior written permission.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>6. Liability</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                To the extent permitted by law, Laku is not liable for indirect, incidental, or consequential damages. Our aggregate liability is limited to amounts you paid within the last 6 months.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>7. Termination</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                We may suspend or terminate your access for policy violations, unlawful activity, or risk to users. You may stop using the services at any time.
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>8. Governing Law</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                These Terms are governed by applicable local laws where Laku operates or as required by mandatory consumer protection laws.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>I Understand</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}


