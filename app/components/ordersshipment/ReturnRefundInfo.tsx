import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelpCircle, AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const primaryBlue = '#0a61d7';

export default function ReturnRefundInfo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          header: () => (
            <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel={t('common.a11yBack')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('support.returnRefundInfo.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <RotateCcw size={18} color={primaryBlue} />
            <Text style={styles.headerText}>{t('support.returnRefundInfo.cards.basicsTitle')}</Text>
          </View>
          <Text style={styles.bodyText}>
            {t('support.returnRefundInfo.cards.basicsBody')}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <AlertCircle size={18} color="#f59e0b" />
            <Text style={styles.headerText}>{t('support.returnRefundInfo.cards.policyTitle')}</Text>
          </View>
          <Text style={styles.bodyText}>
            {t('support.returnRefundInfo.cards.policyBody1')}
          </Text>
          <Text style={styles.bodyText}>
            {t('support.returnRefundInfo.cards.policyBody2')}
          </Text>
          <Text style={styles.strongText}>
            {t('support.returnRefundInfo.cards.policyStrong')}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <HelpCircle size={18} color={primaryBlue} />
            <Text style={styles.headerText}>{t('support.returnRefundInfo.cards.quickFlowTitle')}</Text>
          </View>
          <View style={styles.list}>
            <Text style={styles.listItem}>1. {t('support.returnRefundInfo.cards.steps.1')}</Text>
            <Text style={styles.listItem}>2. {t('support.returnRefundInfo.cards.steps.2')}</Text>
            <Text style={styles.listItem}>3. {t('support.returnRefundInfo.cards.steps.3')}</Text>
            <Text style={styles.listItem}>4. {t('support.returnRefundInfo.cards.steps.4')}</Text>
            <Text style={styles.listItem}>5. {t('support.returnRefundInfo.cards.steps.5')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
    marginLeft: 35,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 4,
  },
  strongText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
  },
  list: {
    marginTop: 4,
  },
  listItem: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 4,
  },
});

