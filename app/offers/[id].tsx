import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { marketplaceService, type MarketplaceHomeOfferPayload } from '../../services/marketplace';
import { useAuthStore } from '../../stores/authStore';
import { SALE_BANNER_UNIFORM_HEIGHT } from '../components/paymentcheckout/SaleBanner';

const primaryBlue = '#0a61d7';

function overlayTintFromHex(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) {
    return `rgba(10, 97, 215, ${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function HomeOfferDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const [item, setItem] = useState<MarketplaceHomeOfferPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const id = Number(idParam);
  const validId = Number.isInteger(id) && id > 0;

  useEffect(() => {
    if (!validId || !token) {
      setLoading(false);
      setErr(!token ? 'Sign in to view this offer.' : 'Invalid offer');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const o = await marketplaceService.getHomeOfferById(token, id);
        if (cancelled) return;
        if (!o) {
          setErr('This offer is no longer available.');
          setItem(null);
        } else {
          setItem(o);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, validId, token]);

  const headerTopPad = Math.max(insets.top, 44) + 8;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          header: () => (
            <View style={[styles.headerContainer, { paddingTop: headerTopPad }]}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Special Offers</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryBlue} />
        </View>
      ) : err ? (
        <View style={styles.centered}>
          <Text style={styles.errText}>{err}</Text>
        </View>
      ) : item ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.contentCard}>
            {item.customBannerImageUrl ? (
              <>
                <View style={styles.customBannerTop}>
                  <Image
                    source={{ uri: item.customBannerImageUrl }}
                    style={styles.customBannerTopImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.infoBlock}>
                  <Text style={styles.infoTitle}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.infoSub}>{item.subtitle}</Text> : null}
                  <View style={styles.metaRow}>
                    {item.discountText ? (
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{item.discountText}</Text>
                      </View>
                    ) : null}
                    {item.endDateText ? <Text style={styles.infoUrgency}>{item.endDateText}</Text> : null}
                  </View>
                </View>
              </>
            ) : item.bannerImageUrl ? (
              <ImageBackground source={{ uri: item.bannerImageUrl }} style={styles.heroImage}>
                <View
                  style={[styles.heroTint, { backgroundColor: overlayTintFromHex(item.backgroundColor, 0.88) }]}
                />
                <View style={styles.heroInner}>
                  <Text style={[styles.heroTitle, { color: item.textColor }]}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text style={[styles.heroSub, { color: item.textColor }]}>{item.subtitle}</Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    {item.discountText ? (
                      <Text
                        style={[
                          styles.badge,
                          {
                            color: item.backgroundColor,
                            backgroundColor: item.textColor,
                            marginRight: 10,
                            marginBottom: 4,
                          },
                        ]}
                      >
                        {item.discountText}
                      </Text>
                    ) : null}
                    {item.endDateText ? (
                      <Text style={[styles.endHint, { color: item.textColor }]}>{item.endDateText}</Text>
                    ) : null}
                  </View>
                </View>
              </ImageBackground>
            ) : (
              <View style={[styles.hero, { backgroundColor: item.backgroundColor }]}>
                <Text style={[styles.heroTitle, { color: item.textColor }]}>{item.title}</Text>
                {item.subtitle ? (
                  <Text style={[styles.heroSub, { color: item.textColor }]}>{item.subtitle}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  {item.discountText ? (
                    <Text
                      style={[
                        styles.badge,
                        {
                          color: item.backgroundColor,
                          backgroundColor: item.textColor,
                          marginRight: 10,
                          marginBottom: 4,
                        },
                      ]}
                    >
                      {item.discountText}
                    </Text>
                  ) : null}
                  {item.endDateText ? (
                    <Text style={[styles.endHint, { color: item.textColor }]}>{item.endDateText}</Text>
                  ) : null}
                </View>
              </View>
            )}
            <View style={styles.body}>
              <Text style={styles.bodyText}>{item.detailsBody?.trim() || 'No additional details for this offer.'}</Text>
            </View>
          </View>
        </ScrollView>
      ) : null}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 56,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  customBannerTop: {
    width: '100%',
    height: SALE_BANNER_UNIFORM_HEIGHT,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  customBannerTopImage: {
    ...StyleSheet.absoluteFillObject,
  },
  infoBlock: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  infoSub: {
    marginTop: 8,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 4,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  infoUrgency: {
    fontSize: 13,
    color: '#6b7280',
  },
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  heroImage: {
    width: '100%',
    minHeight: 160,
    overflow: 'hidden',
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
  },
  heroInner: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    position: 'relative',
    zIndex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  heroSub: {
    marginTop: 8,
    fontSize: 15,
    opacity: 0.95,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  badge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  endHint: {
    fontSize: 13,
    opacity: 0.9,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
});
