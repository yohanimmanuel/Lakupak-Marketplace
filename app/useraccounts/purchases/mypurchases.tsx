import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react-native';

export default function MyPurchasesModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const primaryBlue = '#0a61d7';
  const inactiveGrey = '#6B7280';
  const initialTab = (typeof params.tab === 'string' ? params.tab : 'to-pay') as 'to-pay' | 'to-ship' | 'to-receive' | 'completed' | 'returns' | 'cancelled' | 'to-rate';
  const [activeTab, setActiveTab] = useState<'to-pay' | 'to-ship' | 'to-receive' | 'completed' | 'returns' | 'cancelled' | 'to-rate'>(initialTab);
  const [query, setQuery] = useState('');

  const TabItem = ({ label, value }: { label: string; value: typeof activeTab }) => {
    const isActive = activeTab === value;
    return (
      <Pressable onPress={() => setActiveTab(value)} style={{ paddingVertical: 12, paddingHorizontal: 16, position: 'relative' }}>
        <Text style={{ color: isActive ? primaryBlue : inactiveGrey, fontWeight: isActive ? '600' as const : '500', fontSize: 14 }}>{label}</Text>
        {isActive && <View style={{ position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: primaryBlue }} />}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Stack.Screen options={{
        presentation: 'modal',
        header: () => (
          <View style={{ backgroundColor: '#ffffff', paddingTop: 50, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}>
            {/* Standard header row - back, title, message */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <ArrowLeft color={primaryBlue} size={24} />
              </Pressable>
              <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>My Purchases</Text>
              <Pressable onPress={() => router.push('/messages')} hitSlop={10}>
                <MessageSquare color={primaryBlue} size={22} />
              </Pressable>
            </View>
            
            {/* Search Bar - part of header */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <Search color={inactiveGrey} size={20} />
                <TextInput 
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search orders" 
                  style={{ flex: 1, marginLeft: 8, color: '#111827', paddingVertical: 0 }} 
                  placeholderTextColor={inactiveGrey} 
                />
              </View>
            </View>
            
            {/* Tab Navigation - part of header */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TabItem label="To Pay" value={'to-pay'} />
                <TabItem label="To Ship" value={'to-ship'} />
                <TabItem label="To Receive" value={'to-receive'} />
                <TabItem label="To Rate" value={'to-rate'} />
                <TabItem label="Completed" value={'completed'} />
                <TabItem label="Return/Refund" value={'returns'} />
                <TabItem label="Cancelled" value={'cancelled'} />
              </View>
            </ScrollView>
          </View>
        ),
      }} />

      {/* Content placeholder for each tab */}
      <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
    </View>
  );
}


