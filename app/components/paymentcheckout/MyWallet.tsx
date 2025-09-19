import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Gift, Tag, DollarSign, ChevronRight } from 'lucide-react-native';

interface MyWalletProps {
  isAuthenticated: boolean;
  lakupayBalance: number;
  bonusesAmount: number;
  discountsAmount: number;
  onPressManage: () => void;
}

export default function MyWallet({
  isAuthenticated,
  lakupayBalance,
  bonusesAmount,
  discountsAmount,
  onPressManage,
}: MyWalletProps) {
  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';

  return (
    <View style={{ 
      backgroundColor: '#ffffff', 
      padding: 10, 
      marginHorizontal: 16, 
      marginTop: 10,
      marginBottom: 10, 
      borderRadius: 10, 
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      opacity: isAuthenticated ? 1 : 0.6 
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {isAuthenticated ? (
          <>
            <Link href="/useraccounts/wallet/lakupay" asChild>
              <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <DollarSign color={primaryBlue} size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>LakuPay</Text>
                <Text style={{ marginTop: 4, color: '#111827', fontSize: 14, fontWeight: '600' }}>${lakupayBalance.toFixed(2)}</Text>
              </Pressable>
            </Link>
            <Link href="/useraccounts/wallet/bonuses" asChild>
              <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <Gift color="#8B5CF6" size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Bonuses</Text>
                <Text style={{ marginTop: 4, color: '#111827', fontSize: 14, fontWeight: '600' }}>${bonusesAmount.toFixed(2)}</Text>
              </Pressable>
            </Link>
            <View style={{ alignItems: 'center', flex: 1, padding: 8, position: 'relative' }}>
              <Tag color="#06B6D4" size={24} />
              <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Discounts</Text>
              <Text style={{ marginTop: 4, color: '#111827', fontSize: 14, fontWeight: '600' }}>${discountsAmount.toFixed(2)}</Text>
              <Link href="/useraccounts/wallet/mywallet" asChild>
                <Pressable style={{ position: 'absolute', right: 0, top: '50%', marginTop: -8, padding: 4 }}>
                  <ChevronRight color={iconGray} size={16} />
                </Pressable>
              </Link>
            </View>
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
              <DollarSign color={primaryBlue} size={24} />
              <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>LakuPay</Text>
              <Text style={{ marginTop: 4, color: '#111827', fontSize: 14, fontWeight: '600' }}>$0.00</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
              <Gift color="#8B5CF6" size={24} />
              <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Bonuses</Text>
              <Text style={{ marginTop: 4, color: '#111827', fontSize: 14, fontWeight: '600' }}>$0.00</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1, padding: 8, position: 'relative' }}>
              <Tag color="#06B6D4" size={24} />
              <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Discounts</Text>
              <Text style={{ marginTop: 4, color: '#111827', fontSize: 14, fontWeight: '600' }}>$0.00</Text>
              <Link href="/useraccounts/wallet/mywallet" asChild>
                <Pressable style={{ position: 'absolute', right: 0, top: '50%', marginTop: -8, padding: 4 }}>
                  <ChevronRight color={iconGray} size={16} />
                </Pressable>
              </Link>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
