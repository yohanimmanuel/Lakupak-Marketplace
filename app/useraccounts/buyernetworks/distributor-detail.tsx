import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Users, MapPin, Phone, Mail, Star, Package, MessageSquare, Store, Calendar } from 'lucide-react-native';
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
      // Fetch all orders for the current user
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

      // Filter orders for this specific distributor by userId or product userId (count all statuses)
      const distributorOrders = allOrders.filter(order => {
        const orderDistributorId = order.userId || 
          (order.orderItems && order.orderItems.length > 0 
            ? order.orderItems[0]?.product?.userId 
            : null);
        return orderDistributorId === distributorId;
      });

      if (distributorOrders.length === 0) {
        setDistributor(null);
        setOrders([]);
        return;
      }

      // Attempt to fetch seller/company info from marketplace by scanning products and matching userId (preferred source)
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

      // Get distributor info from order.user or create basic entry
      let distributorUser = distributorOrders[0].user;
      
      if (!distributorUser) {
        // Create a basic user object from available data
        distributorUser = {
          id: distributorId,
          name: undefined,
          username: undefined
        };
      }

      // Calculate total spent
      const totalSpent = distributorOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

      // Build distributor object
      const distributorData: Distributor = {
        id: distributorId,
        name:
          sellerCompany?.name ||
          distributorUser.company?.name ||
          distributorUser.name ||
          distributorUser.username ||
          `Distributor #${distributorId}`,
        logo: sellerCompany?.logo || distributorUser.company?.logo || distributorUser.image,
        banner: sellerCompany?.bannerImage || distributorUser.company?.bannerImage,
        address: sellerCompany?.businessAddress || distributorUser.company?.businessAddress || distributorUser.chosenAddress,
        phone: sellerCompany?.businessPhone || distributorUser.company?.businessPhone || distributorUser.phone,
        email: sellerCompany?.businessEmail || distributorUser.company?.businessEmail || distributorUser.email,
        rating: 4.5, // Default rating
        totalOrders: distributorOrders.length,
        totalSpent: totalSpent,
        lastOrderDate: distributorOrders[0].orderDate,
        description: sellerCompany?.businessDescription || distributorUser.company?.businessDescription,
        industryType: sellerCompany?.industryType || distributorUser.company?.industryType,
        verified: (sellerCompany?.name || distributorUser.company?.name) ? true : false
      };

      setDistributor(distributorData);

      // Transform orders for display
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
    // TODO: Navigate to distributor's store page
    Alert.alert('View Store', 'Navigate to store page');
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#6b7280' }}>Loading...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!distributor) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
              <ArrowLeft color='#111827' size={24} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 16 }}>Distributor Details</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Users color={iconGray} size={48} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 }}>Distributor Not Found</Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
              This distributor may not exist or you haven't made any orders from them yet.
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <ScrollView style={{ flex: 1 }}>
          {/* Header with Back Button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
              <ArrowLeft color='#111827' size={24} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 16, flex: 1 }} numberOfLines={1}>
              {distributor.name}
            </Text>
          </View>

          {/* Banner */}
          {distributor.banner ? (
            <Image source={{ uri: distributor.banner }} style={{ width: '100%', height: 200 }} />
          ) : (
            <View style={{ width: '100%', height: 200, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
              <Store color={iconGray} size={48} />
            </View>
          )}

          {/* Distributor Info Card */}
          <View style={{ padding: 20, backgroundColor: '#ffffff' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                {distributor.logo ? (
                  <Image source={{ uri: distributor.logo }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                ) : (
                  <Users color={primaryBlue} size={32} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginRight: 8 }}>
                    {distributor.name}
                  </Text>
                  {distributor.verified && (
                    <View style={{ backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '600' }}>✓</Text>
                    </View>
                  )}
                </View>
                {distributor.rating && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Star color="#fbbf24" size={16} fill="#fbbf24" />
                    <Text style={{ fontSize: 14, color: '#6b7280', marginLeft: 4 }}>{distributor.rating}</Text>
                    <Text style={{ fontSize: 14, color: '#9ca3af', marginLeft: 4 }}>({distributor.totalOrders} orders)</Text>
                  </View>
                )}
              </View>
            </View>

            {distributor.description && (
              <Text style={{ fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16 }}>
                {distributor.description}
              </Text>
            )}

            {/* Contact Info */}
            <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 }}>
              {distributor.address && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                  <MapPin color={iconGray} size={18} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 14, color: '#6b7280', marginLeft: 12, flex: 1 }}>{distributor.address}</Text>
                </View>
              )}
              {distributor.phone && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Phone color={iconGray} size={18} />
                  <Text style={{ fontSize: 14, color: '#6b7280', marginLeft: 12 }}>{distributor.phone}</Text>
                </View>
              )}
              {distributor.email && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Mail color={iconGray} size={18} />
                  <Text style={{ fontSize: 14, color: '#6b7280', marginLeft: 12 }}>{distributor.email}</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={handleContact}
                style={{ flex: 1, backgroundColor: primaryBlue, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Contact</Text>
              </Pressable>
              <Pressable
                onPress={handleViewStore}
                style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' }}
              >
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>View Store</Text>
              </Pressable>
            </View>
          </View>

          {/* Order History */}
          <View style={{ padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Order History</Text>
            
            {orders.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Package color={iconGray} size={48} />
                <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 12 }}>No orders yet</Text>
              </View>
            ) : (
              orders.map((order) => (
                <View
                  key={order.orderId}
                  style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#e5e7eb'
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                        {order.orderId}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Calendar color={iconGray} size={14} />
                        <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
                          {new Date(order.date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                        {formatCurrency(order.total)}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>{order.status}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>{order.items} {order.items === 1 ? 'item' : 'items'}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

