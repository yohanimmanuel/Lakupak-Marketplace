import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Users, MapPin, Phone, Mail, Star, Package, MessageSquare, Store, Calendar } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { formatCurrency } from '../../../utils/currencyUtils';
import { API_BASE_URL } from '../../../services/config';

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
  totalSpent?: number;
  lastOrderDate?: string;
  description?: string;
  industryType?: string;
  verified?: boolean;
}

interface Order {
  orderId: string;
  date: string;
  total: number;
  status: string;
  items: number;
}

interface OrderResponse {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  totalAmount: number;
  storeName?: string;
  userId?: number | null;
  orderItems: Array<{ 
    packageQuantity?: number;
    product?: {
      userId?: number;
      name?: string;
    } | null;
  }>;
  user?: {
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
      businessDescription?: string;
      industryType?: string;
    };
  };
}

export default function DistributorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user: authUser } = useAuthStore();
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';

  useEffect(() => {
    if (id && authUser?.id && token) {
      loadDistributorData(parseInt(id));
    } else {
      setIsLoading(false);
    }
  }, [id, authUser?.id, token]);

  const loadDistributorData = async (distributorId: number) => {
    if (!authUser?.id || !token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders?userId=${authUser.id}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        setDistributor(null);
        setOrders([]);
        return;
      }

      const data = await response.json();
      const allOrders: OrderResponse[] = data.orders || [];

      const distributorOrders = allOrders.filter(order => {
        const orderDistributorId = order.userId || (order.orderItems && order.orderItems.length > 0 ? order.orderItems[0]?.product?.userId : null);
        return orderDistributorId === distributorId;
      });

      if (distributorOrders.length === 0) {
        setDistributor(null);
        setOrders([]);
        return;
      }

      let sellerCompany:
        | {
            name?: string;
            logo?: string;
            bannerImage?: string;
            businessAddress?: string;
            businessPhone?: string;
            businessEmail?: string;
            businessDescription?: string;
            industryType?: string;
          }
        | undefined;
      try {
        const marketRes = await fetch(`${API_BASE_URL}/api/marketplace?limit=200`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (marketRes.ok) {
          const marketJson = await marketRes.json();
          const products = marketJson?.products || [];
          const match = products.find((p: any) => p?.userId === distributorId);
          sellerCompany = match?.seller?.company;
        }
      } catch (_err) {
        // ignore and rely on order user data
      }

      const distributorUser = distributorOrders[0].user;
      const nameFallback = distributorUser?.company?.name || distributorUser?.name || distributorUser?.username;

      const totalSpent = distributorOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

      const distributorData: Distributor = {
        id: distributorId,
        name: sellerCompany?.name || nameFallback || `Distributor #${distributorId}`,
        logo: sellerCompany?.logo || distributorUser?.company?.logo || distributorUser?.image,
        banner: sellerCompany?.bannerImage || distributorUser?.company?.bannerImage,
        address: sellerCompany?.businessAddress || distributorUser?.company?.businessAddress || distributorUser?.chosenAddress,
        phone: sellerCompany?.businessPhone || distributorUser?.company?.businessPhone || distributorUser?.phone,
        email: sellerCompany?.businessEmail || distributorUser?.company?.businessEmail || distributorUser?.email,
        rating: 4.5,
        totalOrders: distributorOrders.length,
        totalSpent: totalSpent,
        lastOrderDate: distributorOrders[0].orderDate,
        description: sellerCompany?.businessDescription || distributorUser?.company?.businessDescription,
        industryType: sellerCompany?.industryType || distributorUser?.company?.industryType,
        verified: !!(sellerCompany?.name || distributorUser?.company?.name)
      };

      setDistributor(distributorData);

      const transformedOrders: Order[] = distributorOrders.map(order => ({
        orderId: order.orderId,
        date: order.orderDate,
        total: order.totalAmount || 0,
        status: order.orderStatus,
        items: order.orderItems?.reduce((sum, item) => sum + (item.packageQuantity || 1), 0) || 0
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setOrders(transformedOrders);
    } catch (error) {
      setDistributor(null);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContact = () => {
    Alert.alert('Contact Distributor', `Phone: ${distributor?.phone}\nEmail: ${distributor?.email}`);
  };

  const handleViewStore = () => {
    Alert.alert('View Store', 'Navigate to store page');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!distributor) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centeredPadded}>
          <Users color={iconGray} size={48} />
          <Text style={styles.notFoundTitle}>Distributor Not Found</Text>
          <Text style={styles.notFoundText}>This distributor may not exist or you haven't made any orders from them yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scroll}>
        {distributor.banner ? (
          <Image source={{ uri: distributor.banner }} style={styles.banner} />
        ) : (
          <View style={styles.bannerPlaceholder}>
            <Store color={iconGray} size={48} />
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.topRow}>
            <View style={styles.avatar}>
              {distributor.logo ? (
                <Image source={{ uri: distributor.logo }} style={styles.avatarImg} />
              ) : (
                <Users color={primaryBlue} size={32} />
              )}
            </View>
            <View style={styles.titleCol}>
              <View style={styles.titleRow}>
                <Text style={styles.titleText}>{distributor.name}</Text>
                {distributor.verified && (
                  <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
                )}
              </View>
              {distributor.rating && (
                <View style={styles.ratingRow}>
                  <Star color="#fbbf24" size={16} fill="#fbbf24" />
                  <Text style={styles.ratingVal}>{distributor.rating}</Text>
                  <Text style={styles.ratingCount}>({distributor.totalOrders} orders)</Text>
                </View>
              )}
            </View>
          </View>

          {distributor.description ? <Text style={styles.description}>{distributor.description}</Text> : null}

          <View style={styles.contactSection}>
            {distributor.address ? (
              <View style={styles.contactRow}>
                <MapPin color={iconGray} size={18} style={styles.contactIcon} />
                <Text style={styles.contactText}>{distributor.address}</Text>
              </View>
            ) : null}
            {distributor.phone ? (
              <View style={styles.contactRow}>
                <Phone color={iconGray} size={18} />
                <Text style={styles.contactText}>{distributor.phone}</Text>
              </View>
            ) : null}
            {distributor.email ? (
              <View style={styles.contactRow}>
                <Mail color={iconGray} size={18} />
                <Text style={styles.contactText}>{distributor.email}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Order History</Text>
          {orders.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Package color={iconGray} size={48} />
              <Text style={styles.historyEmptyText}>No orders yet</Text>
            </View>
          ) : (
            orders.map((order) => (
              <View key={order.orderId} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderLeft}>
                    <Text style={styles.orderId}>{order.orderId}</Text>
                    <View style={styles.orderDateRow}>
                      <Calendar color={iconGray} size={14} />
                      <Text style={styles.orderDateText}>{new Date(order.date).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                    <Text style={styles.orderStatus}>{order.status}</Text>
                  </View>
                </View>
                <Text style={styles.orderItems}>{order.items} {order.items === 1 ? 'item' : 'items'}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centeredPadded: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  muted: { color: '#6b7280' },
  notFoundTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  notFoundText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  banner: { width: '100%', height: 200 },
  bannerPlaceholder: { width: '100%', height: 200, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  infoCard: { padding: 20, backgroundColor: '#ffffff' },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  titleCol: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  titleText: { fontSize: 20, fontWeight: '700', color: '#111827', marginRight: 8 },
  verifiedBadge: { backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { color: '#ffffff', fontWeight: '600', fontSize: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingVal: { fontSize: 14, color: '#6b7280', marginLeft: 4 },
  ratingCount: { fontSize: 14, color: '#9ca3af', marginLeft: 4 },
  description: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16 },
  contactSection: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  contactIcon: { marginTop: 2 },
  contactText: { fontSize: 14, color: '#6b7280', marginLeft: 12, flex: 1 },
  historySection: { padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  historyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  historyEmpty: { alignItems: 'center', paddingVertical: 40 },
  historyEmptyText: { fontSize: 14, color: '#6b7280', marginTop: 12 },
  orderCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderLeft: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '600', color: '#111827' },
  orderDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  orderDateText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  orderRight: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 16, fontWeight: '700', color: '#111827' },
  orderStatus: { fontSize: 12, color: '#10b981', marginTop: 4 },
  orderItems: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});

