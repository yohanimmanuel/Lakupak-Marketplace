import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, HelpCircle, MessageCircle, Truck, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const primaryBlue = '#0a61d7';

export default function OrderHelpCenter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
          header: () => (
            <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('support.orderHelpCenter.title')}</Text>
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
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <HelpCircle size={20} color={primaryBlue} />
            <Text style={styles.infoTitle}>{t('support.orderHelpCenter.overviewTitle')}</Text>
          </View>
          <Text style={styles.bodyText}>
            {t('support.orderHelpCenter.overviewBody')}
          </Text>
          {orderId ? (
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeLabel}>{t('support.orderHelpCenter.orderId')}</Text>
              <Text style={styles.orderBadgeValue}>{String(orderId)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <Truck size={18} color={primaryBlue} />
            <Text style={styles.sectionTitle}>{t('support.orderHelpCenter.sections.deliveryStatusTitle')}</Text>
          </View>
          <Text style={styles.bodyText}>
            {t('support.orderHelpCenter.sections.deliveryStatusBody')}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <FileText size={18} color={primaryBlue} />
            <Text style={styles.sectionTitle}>{t('support.orderHelpCenter.sections.statusBasicsTitle')}</Text>
          </View>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• <Text style={styles.inlineStrong}>{t('support.orderHelpCenter.statusBullets.pendingConfirmedTitle')}</Text> – {t('support.orderHelpCenter.statusBullets.pendingConfirmedDesc')}</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.inlineStrong}>{t('support.orderHelpCenter.statusBullets.packedShippedTitle')}</Text> – {t('support.orderHelpCenter.statusBullets.packedShippedDesc')}</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.inlineStrong}>{t('support.orderHelpCenter.statusBullets.deliveredTitle')}</Text> – {t('support.orderHelpCenter.statusBullets.deliveredDesc')}</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.inlineStrong}>{t('support.orderHelpCenter.statusBullets.receivedTitle')}</Text> – {t('support.orderHelpCenter.statusBullets.receivedDesc')}</Text>
          </View>
          <Text style={styles.bodyText}>
            {t('support.orderHelpCenter.sections.statusBasicsNote')}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <MessageCircle size={18} color={primaryBlue} />
            <Text style={styles.sectionTitle}>{t('support.orderHelpCenter.sections.contactSellerTitle')}</Text>
          </View>
          <Text style={styles.bodyText}>
            {t('support.orderHelpCenter.sections.contactSellerBody')}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <HelpCircle size={18} color={primaryBlue} />
            <Text style={styles.sectionTitle}>{t('support.orderHelpCenter.sections.contactSupportTitle')}</Text>
          </View>
          <Text style={styles.bodyText}>
            {t('support.orderHelpCenter.sections.contactSupportBody')}
          </Text>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  bodyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  bulletList: {
    marginTop: 6,
    marginLeft: 2,
  },
  bulletItem: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 4,
  },
  orderBadge: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  orderBadgeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  orderBadgeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  inlineStrong: {
    fontWeight: '600',
    color: '#111827',
  },
});

