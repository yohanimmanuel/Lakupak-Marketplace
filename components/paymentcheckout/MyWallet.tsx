import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { DollarSign, Gift, Tag, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
// Removed theme color imports - using explicit colors

const { width: screenWidth } = Dimensions.get('window');

interface MyWalletProps {
  isAuthenticated?: boolean;
  lakupayBalance?: number;
  bonusesAmount?: number;
  discountsAmount?: number;
  onPressManage?: () => void;
}

export default function MyWallet({
  isAuthenticated = false,
  lakupayBalance = 230.75,
  bonusesAmount = 45.00,
  discountsAmount = 12.50,
  onPressManage,
}: MyWalletProps) {
  const router = useRouter();
  // Using explicit colors instead of theme colors

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };


  return (
    <TouchableOpacity 
      style={[styles.container, !isAuthenticated && styles.disabledContainer]}
      onPress={() => {
        if (isAuthenticated) {
          router.push('/useraccounts/wallet/mywallet');
          onPressManage?.();
        }
      }}
      activeOpacity={isAuthenticated ? 0.7 : 1}
      disabled={!isAuthenticated}
    >
      <View style={styles.walletContent}>
        {/* LakuPay */}
        <TouchableOpacity 
          style={[styles.walletItem, !isAuthenticated && styles.disabledItem]}
          onPress={() => {
            if (isAuthenticated) {
              router.push('/useraccounts/wallet/lakupay');
            }
          }}
          activeOpacity={isAuthenticated ? 0.7 : 1}
          disabled={!isAuthenticated}
        >
          <DollarSign color={isAuthenticated ? "#0a61d7" : "#9CA3AF"} size={20} />
          <Text style={[styles.walletLabel, !isAuthenticated && styles.disabledText]}>LakuPay</Text>
          <Text style={[
            styles.walletAmount,
            { color: isAuthenticated ? '#111827' : '#9CA3AF' }
          ]}>
            {isAuthenticated ? formatCurrency(lakupayBalance) : '--'}
          </Text>
        </TouchableOpacity>

        {/* Bonuses */}
        <TouchableOpacity 
          style={[styles.walletItem, !isAuthenticated && styles.disabledItem]}
          onPress={() => {
            if (isAuthenticated) {
              router.push('/useraccounts/wallet/bonuses');
            }
          }}
          activeOpacity={isAuthenticated ? 0.7 : 1}
          disabled={!isAuthenticated}
        >
          <Gift color={isAuthenticated ? "#0a61d7" : "#9CA3AF"} size={20} />
          <Text style={[styles.walletLabel, !isAuthenticated && styles.disabledText]}>Bonuses</Text>
          <Text style={[
            styles.walletAmount,
            { color: isAuthenticated ? '#111827' : '#9CA3AF' }
          ]}>
            {isAuthenticated ? formatCurrency(bonusesAmount) : '--'}
          </Text>
        </TouchableOpacity>

        {/* Discounts */}
        <TouchableOpacity 
          style={[styles.walletItem, !isAuthenticated && styles.disabledItem]}
          onPress={() => {
            if (isAuthenticated) {
              router.push('/useraccounts/wallet/discounts');
            }
          }}
          activeOpacity={isAuthenticated ? 0.7 : 1}
          disabled={!isAuthenticated}
        >
          <Tag color={isAuthenticated ? "#0a61d7" : "#9CA3AF"} size={20} />
          <Text style={[styles.walletLabel, !isAuthenticated && styles.disabledText]}>Discounts</Text>
          <Text style={[
            styles.walletAmount,
            { color: isAuthenticated ? '#111827' : '#9CA3AF' }
          ]}>
            {isAuthenticated ? formatCurrency(discountsAmount) : '--'}
          </Text>
        </TouchableOpacity>

        {/* Arrow */}
        <ChevronRight color={isAuthenticated ? "#0a61d7" : "#9CA3AF"} size={18} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff', // Explicit white background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  walletLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827', // Black text
    textAlign: 'center',
  },
  walletAmount: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledContainer: {
    // Removed opacity - using color change instead
  },
  disabledItem: {
    // Removed opacity - using color change instead
  },
  disabledText: {
    color: '#9CA3AF',
  },
});
