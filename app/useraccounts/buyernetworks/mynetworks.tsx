import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, Link } from 'expo-router';
import { ArrowLeft, Users, MapPin, Phone, Mail, Star, Package, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';

interface Distributor {
  id: number;
  name: string;
  logo?: string;
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

export default function MyNetworksScreen() {
  const router = useRouter();
  const { token, user: authUser } = useAuthStore();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';

  useEffect(() => {
    if (authUser?.id && token) {
      loadDistributors();
    } else {
      setIsLoading(false);
    }
  }, [authUser?.id, token]);

  const loadDistributors = async () => {
    if (!authUser?.id || !token) {
      setDistributors([]);
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
        setDistributors([]);
        return;
      }

      const data = await response.json();
      const orders: Order[] = data.orders || [];

      // Filter successful orders (Delivered, Confirmed, Shipped, Packed)
      // The distributor ID is in order.userId and distributor name is in order.storeName (same as My Purchases)
      const successfulOrders = orders.filter(order => 
        ['Delivered', 'Confirmed', 'Shipped', 'Packed'].includes(order.orderStatus) && order.userId !== null
      );

      // Get unique distributor IDs and their store names
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
        
        // Update last order date
        const orderDate = new Date(order.orderDate);
        if (!entry.lastOrderDate || orderDate > new Date(entry.lastOrderDate)) {
          entry.lastOrderDate = order.orderDate;
        }
      });

      // Fetch distributor profiles from database by getting products and matching by userId
      // Fetch products to get seller/company information for distributors
      let sellerInfoMap = new Map<number, { seller?: any }>();
      
      try {
        // Fetch products to get seller info (we'll filter client-side by userId)
        const productResponse = await fetch(`${API_BASE_URL}/api/marketplace?limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (productResponse.ok) {
          const productData = await productResponse.json();
          const products = productData.products || [];
          
          // Build a map of userId to seller/company info
          products.forEach((product: any) => {
            if (product.userId && !sellerInfoMap.has(product.userId)) {
              sellerInfoMap.set(product.userId, {
                seller: product.seller
              });
            }
          });
        }
      } catch (error) {
        // Continue with order data only
      }

      // Build distributor profiles using seller info from products if available
      const distributorProfiles = Array.from(uniqueDistributors.keys()).map((distributorId) => {
        const distributorData = uniqueDistributors.get(distributorId)!;
        const sellerData = sellerInfoMap.get(distributorId);
        const companyInfo = sellerData?.seller?.company;
        
        return {
          id: distributorId,
          name: companyInfo?.name || distributorData.storeName || `Distributor #${distributorId}`,
          logo: companyInfo?.logo || sellerData?.seller?.avatar,
          address: companyInfo?.businessAddress,
          phone: companyInfo?.businessPhone,
          email: companyInfo?.businessEmail,
          rating: 4.5, // Default rating
          totalOrders: distributorData.orders.length,
          lastOrderDate: distributorData.lastOrderDate
        };
      });

      // Sort by last order date (most recent first)
      const distributorsList = distributorProfiles.sort((a, b) => {
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDistributors();
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <ArrowLeft color='#111827' size={24} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 16 }}>My Networks</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryBlue} />}
        >
          {isLoading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>Loading...</Text>
            </View>
          ) : distributors.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
              <Users color={iconGray} size={48} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 }}>No Networks Yet</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
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
                <Pressable
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  {/* Logo/Avatar */}
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    {distributor.logo ? (
                      <Image source={{ uri: distributor.logo }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                    ) : (
                      <Users color={primaryBlue} size={28} />
                    )}
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 }} numberOfLines={1}>
                        {distributor.name}
                      </Text>
                      {distributor.rating && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                          <Star color="#fbbf24" size={14} fill="#fbbf24" />
                          <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{distributor.rating}</Text>
                        </View>
                      )}
                    </View>
                    {distributor.address && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <MapPin color={iconGray} size={14} />
                        <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4, flex: 1 }} numberOfLines={1}>
                          {distributor.address}
                        </Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Package color={iconGray} size={14} />
                      <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
                        {distributor.totalOrders} {distributor.totalOrders === 1 ? 'order' : 'orders'}
                      </Text>
                      {distributor.lastOrderDate && (
                        <Text style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>
                          • Last: {new Date(distributor.lastOrderDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>

                  <ChevronRight color={iconGray} size={20} style={{ marginLeft: 8 }} />
                </Pressable>
              </Link>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

