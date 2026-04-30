import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function CommunityRulesModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const [activeTab, setActiveTab] = useState<'overview' | 'dos' | 'donts' | 'summary'>('overview');
  const { t } = useTranslation();

  const TabButton = ({ id, title }: { id: typeof activeTab; title: string }) => (
    <Pressable
      onPress={() => setActiveTab(id)}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: activeTab === id ? '#0a61d7' : 'transparent',
      }}
    >
      <Text style={{
        color: activeTab === id ? '#0a61d7' : '#6B7280',
        fontWeight: activeTab === id ? '600' : '400',
        fontSize: 14,
      }}>
        {title}
      </Text>
    </Pressable>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827', marginBottom: 16 }}>
              {t('legal.communityRules.overview.p1')}
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827', marginBottom: 16 }}>
              {t('legal.communityRules.overview.p2')}
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827', marginBottom: 16 }}>
              {t('legal.communityRules.overview.p3')}
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#111827' }}>
              {t('legal.communityRules.overview.p4')}
            </Text>
          </ScrollView>
        );
      
      case 'dos':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 }}>
              {t('legal.communityRules.dos.title')}
            </Text>
            
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.dos.sections.respect.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                {t('legal.communityRules.dos.sections.respect.body')}
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.dos.sections.accurate.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                {t('legal.communityRules.dos.sections.accurate.body')}
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.dos.sections.quality.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                {t('legal.communityRules.dos.sections.quality.body')}
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.dos.sections.report.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563' }}>
                {t('legal.communityRules.dos.sections.report.body')}
              </Text>
            </View>
          </ScrollView>
        );
      
      case 'donts':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 }}>
              {t('legal.communityRules.donts.title')}
            </Text>
            
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.donts.sections.prohibited.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                {t('legal.communityRules.donts.sections.prohibited.body')}
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.donts.sections.misleading.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                {t('legal.communityRules.donts.sections.misleading.body')}
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.donts.sections.privacy.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563', marginBottom: 12 }}>
                {t('legal.communityRules.donts.sections.privacy.body')}
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                {t('legal.communityRules.donts.sections.abuse.title')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563' }}>
                {t('legal.communityRules.donts.sections.abuse.body')}
              </Text>
            </View>
          </ScrollView>
        );
      
      case 'summary':
        return (
          <ScrollView style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 }}>
              {t('legal.communityRules.summary.title')}
            </Text>
            
            <View style={{ backgroundColor: '#F0F9FF', padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#0C4A6E', marginBottom: 8 }}>
                {t('legal.communityRules.summary.coreTitle')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#075985' }}>
                {t('legal.communityRules.summary.coreBody')}
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
                {t('legal.communityRules.summary.takeawaysTitle')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#4B5563' }}>
                {t('legal.communityRules.summary.takeaways')}
              </Text>
            </View>

            <View style={{ backgroundColor: '#FEF3C7', padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#92400E', marginBottom: 8 }}>
                {t('legal.communityRules.summary.enforcementTitle')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#B45309' }}>
                {t('legal.communityRules.summary.enforcementBody')}
              </Text>
            </View>

            <View style={{ backgroundColor: '#ECFDF5', padding: 16, borderRadius: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#065F46', marginBottom: 8 }}>
                {t('legal.communityRules.summary.questionsTitle')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#047857' }}>
                {t('legal.communityRules.summary.questionsBody')}
              </Text>
            </View>
          </ScrollView>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('legal.communityRules.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      {/* Sticky Tabs */}
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb'
      }}>
        <TabButton id="overview" title={t('legal.communityRules.tabs.overview')} />
        <TabButton id="dos" title={t('legal.communityRules.tabs.dos')} />
        <TabButton id="donts" title={t('legal.communityRules.tabs.donts')} />
        <TabButton id="summary" title={t('legal.communityRules.tabs.summary')} />
      </View>

      {/* Content */}
      {renderContent()}
    </View>
  );
}
