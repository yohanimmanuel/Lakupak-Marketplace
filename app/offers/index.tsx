import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Text as ThemedText } from '../components/Themed';
import SaleBanner, { SALE_BANNER_UNIFORM_HEIGHT } from '../components/paymentcheckout/SaleBanner';
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { useTranslation } from 'react-i18next';

const primaryColor = '#0a61d7';

export default function SpecialOffersListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const { homeOffers, loadHomeOffers } = useDataStore();
  const [refreshing, setRefreshing] = useState(false);
  const [listReady, setListReady] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!token) {
      setListReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadHomeOffers(token);
      } finally {
        if (!cancelled) setListReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadHomeOffers]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await loadHomeOffers(token);
    } finally {
      setRefreshing(false);
    }
  }, [token, loadHomeOffers]);

  const headerTopPad = Math.max(insets.top, 44) + 8;

  const headerBar = (
    <View style={[styles.headerContainer, { paddingTop: headerTopPad }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t('offers.a11y.back')}
          accessibilityRole="button"
        >
          <ArrowLeft color={primaryColor} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('offers.title')}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      {headerBar}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {!listReady && token ? (
        <View style={[styles.centered, styles.bodyFill]}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : !token ? (
        <View style={[styles.centered, styles.bodyFill]}>
          <ThemedText style={styles.muted}>{t('offers.states.signInToView')}</ThemedText>
        </View>
      ) : homeOffers.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
          }
        >
          <View style={styles.centered}>
            <ThemedText style={styles.muted}>{t('offers.states.emptyTitle')}</ThemedText>
            <ThemedText style={styles.hint}>{t('offers.states.emptyHint')}</ThemedText>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
          }
        >
          <ThemedText style={styles.intro}>{t('offers.intro')}</ThemedText>
          {homeOffers.map((offer) => (
            <Pressable
              key={offer.id}
              onPress={() => router.push(`/offers/${offer.id}`)}
              style={({ pressed }) => [styles.cardWrap, pressed && styles.cardPressed]}
            >
              <SaleBanner
                title={offer.title}
                subtitle={offer.subtitle}
                discountText={offer.discountText || t('offers.states.offerFallbackBadge')}
                endDate={offer.endDateText}
                onPress={() => router.push(`/offers/${offer.id}`)}
                backgroundColor={offer.backgroundColor || primaryColor}
                textColor={offer.textColor || '#FFFFFF'}
                bannerImageUrl={offer.bannerImageUrl}
                customBannerImageUrl={offer.customBannerImageUrl}
                rightIconName={offer.rightIconKey}
                discountIconName={offer.discountIconKey}
                fixedHeight={SALE_BANNER_UNIFORM_HEIGHT}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  bodyFill: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
    paddingTop: 8,
  },
  intro: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 18,
  },
  cardWrap: {
    marginBottom: 4,
  },
  cardPressed: {
    opacity: 0.92,
  },
  centered: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  muted: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});
