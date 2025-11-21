import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link, useFocusEffect } from 'expo-router';
import { ArrowLeft, Users, MapPin, Phone, Mail, Star, Package, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import type { MarketplaceProduct } from '../../../services/marketplace';
import { useDataStore } from '../../../stores/dataStore';

interface Distributor {
  id: number;
  name: string;
  logo?: string;
  banner?: string;
  address?: string;
  phone?: string;
  email?: string;
  rating?: number;
  totalOrders: number;
  lastOrderDate?: string;
}

interface OrderItem {
  productId?: string | null;
  product?: {
    userId?: number;
    name?: string;
  } | null;
}

interface Order {
  orderId: string;
  userId: number | null;
  storeName: string;
  orderDate: string;
  orderStatus: string;
  totalAmount: number;
  orderItems?: OrderItem[];
  isDeleted?: boolean;
  deletedAt?: string | null;
}

interface UserInfo {
  id: number;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  chosenAddress?: string;
  image?: string;
  storeName?: string;
  company?: {
    name?: string;
    logo?: string;
    bannerImage?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
  };
}

// Normalize relative image paths to absolute URLs based on API base
const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // ensure there is exactly one slash between base and path
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function MyNetworksScreen() {
  const router = useRouter();
  const { token, user: authUser } = useAuthStore();
  const orders = useDataStore(state => state.orders);
  const isOrdersLoading = useDataStore(state => state.isOrdersLoading);
  const loadOrdersData = useDataStore(state => state.loadOrdersData);
  const products = useDataStore(state => state.products);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';

  useEffect(() => {
    if (!authUser?.id || !token) {
      setDistributors([]);
      setIsLoading(false);
      return;
    }

    const loadDistributors = async () => {
      try {
        setIsLoading(true);
        const successfulOrders = orders.filter(order => 
          order.userId !== null &&
          order.isDeleted !== true &&
          !order.deletedAt &&
          order.orderStatus !== 'Deleted' &&
          order.orderStatus !== 'Cancelled'
        );

        const uniqueDistributors = new Map<number, { 
          storeName: string; 
          orders: Order[];
          lastOrderDate?: string;
        }>();
        
        successfulOrders.forEach(order => {
          const distributorId = order.userId!;
          if (!uniqueDistributors.has(distributorId)) {
            uniqueDistributors.set(distributorId, {
              storeName: order.storeName || `Distributor #${distributorId}`,
              orders: [],
              lastOrderDate: undefined
            });
          }
          const entry = uniqueDistributors.get(distributorId)!;
          entry.orders.push(order);
          
          const orderDate = order.orderDate ? new Date(order.orderDate) : (order.createdAt ? new Date(order.createdAt) : new Date());
          if (!entry.lastOrderDate || orderDate > new Date(entry.lastOrderDate)) {
            entry.lastOrderDate = order.orderDate || order.createdAt || orderDate.toISOString();
          }
        });

        const sellerInfoMap = new Map<number, { seller?: MarketplaceProduct['seller'] }>();
        
        // Use products from websocket-enabled dataStore instead of fetching
        const storeProducts = useDataStore.getState().products;
        storeProducts.forEach((product) => {
          if (product.userId && !sellerInfoMap.has(product.userId)) {
            sellerInfoMap.set(product.userId, {
              seller: product.seller
            });
          }
        });

        const distributorProfiles = Array.from(uniqueDistributors.keys()).map((distributorId) => {
          const distributorData = uniqueDistributors.get(distributorId)!;
          const sellerData = sellerInfoMap.get(distributorId);
          const companyInfo = sellerData?.seller?.company;
          
          const logoUrl = normalizeUrl(companyInfo?.logo) || normalizeUrl(sellerData?.seller?.avatar);
          const bannerUrl = normalizeUrl(companyInfo?.bannerImage) || normalizeUrl(sellerData?.seller?.company?.bannerImage);
          
          return {
            id: distributorId,
            name: companyInfo?.name || distributorData.storeName || `Distributor #${distributorId}`,
            logo: logoUrl,
            banner: bannerUrl,
            address: companyInfo?.businessAddress,
            phone: companyInfo?.businessPhone,
            email: companyInfo?.businessEmail,
            rating: 4.5,
            totalOrders: distributorData.orders.length,
            lastOrderDate: distributorData.lastOrderDate
          } as Distributor;
        });

        const activeOnly = distributorProfiles.filter(p => p.totalOrders > 0);

        const distributorsList = activeOnly.sort((a, b) => {
          if (!a.lastOrderDate) return 1;
          if (!b.lastOrderDate) return -1;
          return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
        });

        setDistributors(distributorsList);
      } catch (error) {
        setDistributors([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDistributors();
  }, [authUser?.id, token, orders, products]);

  useEffect(() => {
    if (authUser?.id && token) {
      // Load orders initially (WebSocket will handle updates)
      loadOrdersData(false);
    }
  }, [authUser?.id, token, loadOrdersData]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Manual refresh - force reload
    await loadOrdersData(true);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryBlue} />}
      >
        {isLoading || isOrdersLoading ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : distributors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users color={iconGray} size={48} />
            <Text style={styles.emptyTitle}>No Networks Yet</Text>
            <Text style={styles.emptyText}>
              Start purchasing from distributors to build your network
            </Text>
          </View>
        ) : (
          distributors.map((distributor) => (
            <Link
              key={distributor.id}
              href={`/useraccounts/buyernetworks/distributor-detail?id=${distributor.id}`}
              asChild
            >
              <Pressable style={styles.card}>
                {distributor.banner ? (
                  <Image source={{ uri: distributor.banner }} style={styles.cardBanner} />
                ) : (
                  <View style={styles.bannerPlaceholder} />
                )}
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    {distributor.logo ? (
                      <Image source={{ uri: distributor.logo }} style={styles.avatarImg} />
                    ) : (
                      <Users color={primaryBlue} size={28} />
                    )}
                  </View>
                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {distributor.name}
                      </Text>
                      {distributor.rating && (
                        <View style={styles.ratingRow}>
                          <Star color="#fbbf24" size={14} fill="#fbbf24" />
                          <Text style={styles.ratingText}>{distributor.rating}</Text>
                        </View>
                      )}
                    </View>
                    {distributor.address && (
                      <View style={styles.addressRow}>
                        <MapPin color={iconGray} size={14} />
                        <Text style={styles.addressText} numberOfLines={1}>
                          {distributor.address}
                        </Text>
                      </View>
                    )}
                    <View style={styles.ordersRow}>
                      <Package color={iconGray} size={14} />
                      <Text style={styles.ordersText}>
                        {distributor.totalOrders} {distributor.totalOrders === 1 ? 'order' : 'orders'}
                      </Text>
                      {distributor.lastOrderDate && (
                        <Text style={styles.lastOrderText}>
                          • Last: {new Date(distributor.lastOrderDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>
                  <ChevronRight color={iconGray} size={20} style={styles.chevron} />
                </View>
              </Pressable>
            </Link>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { flex: 1 },
  listContent: { padding: 16 },
  loading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { fontSize: 14, color: '#6b7280' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardBanner: { width: '100%', height: 80 },
  bannerPlaceholder: { width: '100%', height: 80, backgroundColor: '#f3f4f6' },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: 4,
    marginTop: -28,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  ratingText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  addressText: { fontSize: 12, color: '#6b7280', marginLeft: 4, flex: 1 },
  ordersRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ordersText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  lastOrderText: { fontSize: 12, color: '#9ca3af', marginLeft: 8 },
  chevron: { marginLeft: 8 },
});
