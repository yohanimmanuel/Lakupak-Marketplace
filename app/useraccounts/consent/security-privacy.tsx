import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function SecurityPrivacyConsent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');
  const { t } = useTranslation();
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
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('legal.securityPrivacy.headerTitle')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        {/* Sticky Tabs */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, backgroundColor: '#ffffff' }}>
          <View style={{ flexDirection: 'row'}}>
            <Pressable
              onPress={() => setActiveTab('privacy')}
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: activeTab === 'privacy' ? '#0a61d7' : '#6b7280', fontWeight: activeTab === 'privacy' ? '700' : '500' }}>
                {t('legal.securityPrivacy.tabs.privacy')}
              </Text>
              <View style={{ height: 2, backgroundColor: activeTab === 'privacy' ? '#0a61d7' : 'transparent', width: '100%', marginTop: 8 }} />
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('terms')}
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: activeTab === 'terms' ? '#0a61d7' : '#6b7280', fontWeight: activeTab === 'terms' ? '700' : '500' }}>
                {t('legal.securityPrivacy.tabs.terms')}
              </Text>
              <View style={{ height: 2, backgroundColor: activeTab === 'terms' ? '#0a61d7' : 'transparent', width: '100%', marginTop: 8 }} />
            </Pressable>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {activeTab === 'privacy' ? (
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>{t('legal.securityPrivacy.privacy.title')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 16 }}>
                {t('legal.securityPrivacy.privacy.intro')}
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.collectTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.collectBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.useTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.useBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.shareTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.shareBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.retentionTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.retentionBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.rightsTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.rightsBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.securityTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.securityBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.childrenTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.childrenBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.privacy.sections.changesTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.privacy.sections.changesBody')}</Text>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>{t('legal.securityPrivacy.terms.title')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 16 }}>
                {t('legal.securityPrivacy.terms.intro')}
              </Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.accountsTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.accountsBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.ordersTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.ordersBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.walletTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.walletBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.useTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.useBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.ipTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.ipBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.liabilityTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.liabilityBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.terminationTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.terminationBody')}</Text>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 }}>{t('legal.securityPrivacy.terms.sections.lawTitle')}</Text>
              <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>{t('legal.securityPrivacy.terms.sections.lawBody')}</Text>
            </View>
          )}
        </ScrollView>

        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: '#0a61d7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>{t('legal.securityPrivacy.actions.understand')}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}


