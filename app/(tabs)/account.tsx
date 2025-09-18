import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { User as UserIcon, MapPin, WalletMinimal, Truck, PackageCheck, Star, ChevronRight, RotateCcw, Gift, Tag, DollarSign, Wallet, Heart, Clock, RotateCw, Ticket } from 'lucide-react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export default function AccountScreen() {
  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);

  useEffect(() => {
    hydrate();
  }, [hydrate]);
  const isAuthenticated = !!token && !!user;

  const renderLoginPrompt = () => (
    <View style={{ backgroundColor: '#ffffff', padding: 26, marginBottom: 10, alignItems: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 16 }}>
        <UserIcon color={primaryBlue} size={28} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 20 }}>
        Create an account to win first-order benefits!
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Link href="/useraccounts/loginsignup/loginmodal" asChild>
          <Pressable style={{ backgroundColor: primaryBlue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>Login</Text>
          </Pressable>
        </Link>
        <Link href="/useraccounts/loginsignup/signupmodal" asChild>
          <Pressable style={{ backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: primaryBlue, flex: 1 }}>
            <Text style={{ color: primaryBlue, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>Sign Up</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  const renderUserSection = () => {
    if (isAuthenticated) {
      return (
        <View style={{ backgroundColor: '#ffffff', padding: 26, marginBottom: 10 }}>
          <Link href="/useraccounts/userprofile/editprofile" asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb', overflow: 'hidden' }}>
                {user?.image ? (
                  <Image source={{ uri: user.image }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#ffffff", alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: primaryBlue, fontSize: 20, fontWeight: '600' }}>
                      {(user as any)?.username?.charAt(0)?.toUpperCase() || (user as any)?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{(user as any)?.username || user?.name || 'User'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <MapPin color="#6B7280" size={16} />
                  <Text style={{ color: '#6B7280', marginLeft: 6 }} numberOfLines={1}>{(user as any)?.chosenAddress || '—'}</Text>
                </View>
              </View>
            </Pressable>
          </Link>
          <View style={{ flexDirection: 'row' }}>
            <Link href="/useraccounts/userprofile/following" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'baseline', marginRight: 18 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>120</Text>
                <Text style={{ marginLeft: 6, color: '#6B7280' }}>Following</Text>
              </Pressable>
            </Link>
            <Link href="/useraccounts/userprofile/followers" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>340</Text>
                <Text style={{ marginLeft: 6, color: '#6B7280' }}>Followers</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      );
    } else {
      return renderLoginPrompt();
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Section 1: User Section */}
      {renderUserSection()}

      {/* Section 2: Purchase History (full width) */}
      <View style={{ backgroundColor: '#ffffff', padding: 16, marginBottom: 10, opacity: isAuthenticated ? 1 : 0.6 }}>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>My Purchases</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 3, marginBottom: 6 }}>
          {isAuthenticated ? (
            <>
              <Link href="/useraccounts/purchases/mypurchases?tab=to-pay" asChild>
                <Pressable style={{ alignItems: 'center', padding: 8 }}>
                  <WalletMinimal color={iconGray} size={22} />
                  <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Pay</Text>
                </Pressable>
              </Link>
              <Link href="/useraccounts/purchases/mypurchases?tab=to-ship" asChild>
                <Pressable style={{ alignItems: 'center', padding: 8 }}>
                  <Truck color={iconGray} size={22} />
                  <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Ship</Text>
                </Pressable>
              </Link>
              <Link href="/useraccounts/purchases/mypurchases?tab=to-receive" asChild>
                <Pressable style={{ alignItems: 'center', padding: 8 }}>
                  <PackageCheck color={iconGray} size={22} />
                  <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Receive</Text>
                </Pressable>
              </Link>
              <Link href="/useraccounts/purchases/mypurchases?tab=to-rate" asChild>
                <Pressable style={{ alignItems: 'center', padding: 8 }}>
                  <Star color={iconGray} size={22} />
                  <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Rate</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <View style={{ alignItems: 'center', padding: 8 }}>
                <WalletMinimal color={iconGray} size={22} />
                <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Pay</Text>
              </View>
              <View style={{ alignItems: 'center', padding: 8 }}>
                <Truck color={iconGray} size={22} />
                <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Ship</Text>
              </View>
              <View style={{ alignItems: 'center', padding: 8 }}>
                <PackageCheck color={iconGray} size={22} />
                <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Receive</Text>
              </View>
              <View style={{ alignItems: 'center', padding: 8 }}>
                <Star color={iconGray} size={22} />
                <Text style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>To Rate</Text>
              </View>
            </>
          )}
        </View>
        {isAuthenticated ? (
          <Link href="/useraccounts/purchases/mypurchases" asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <Text style={{ color: iconGray, fontWeight: '500', marginTop: 14 }}>View Purchases History</Text>
              <ChevronRight color={iconGray} size={18} style={{ marginTop: 14 }} />
            </Pressable>
          </Link>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ color: iconGray, fontWeight: '500', marginTop: 14 }}>View Purchases History</Text>
            <ChevronRight color={iconGray} size={18} style={{ marginTop: 14 }} />
          </View>
        )}
      </View>

      {/* Section 3: My Wallet */}
      <View style={{ backgroundColor: '#ffffff', padding: 16, marginBottom: 10, opacity: isAuthenticated ? 1 : 0.6 }}>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 26 }}>My Wallet</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
          {isAuthenticated ? (
            <>
              <Link href="/useraccounts/wallet/bonuses" asChild>
                <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                  <Gift color={iconGray} size={24} />
                  <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Bonuses</Text>
                  <Text style={{ marginTop: 4, color: primaryBlue, fontSize: 14, fontWeight: '600' }}>$45.00</Text>
                </Pressable>
              </Link>
              <Link href="/useraccounts/wallet/discounts" asChild>
                <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                  <Tag color={iconGray} size={24} />
                  <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Discounts</Text>
                  <Text style={{ marginTop: 4, color: primaryBlue, fontSize: 14, fontWeight: '600' }}>$12.50</Text>
                </Pressable>
              </Link>
              <Link href="/useraccounts/wallet/lakupay" asChild>
                <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                  <DollarSign color={iconGray} size={24} />
                  <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>LakuPay</Text>
                  <Text style={{ marginTop: 4, color: primaryBlue, fontSize: 14, fontWeight: '600' }}>$230.75</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <Gift color={iconGray} size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Bonuses</Text>
                <Text style={{ marginTop: 4, color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>--</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <Tag color={iconGray} size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>Discounts</Text>
                <Text style={{ marginTop: 4, color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>--</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <DollarSign color={iconGray} size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>LakuPay</Text>
                <Text style={{ marginTop: 4, color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>--</Text>
              </View>
            </>
          )}
        </View>
        {isAuthenticated ? (
          <Link href="/useraccounts/wallet/mywallet" asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <Text style={{ color: iconGray, fontWeight: '500', marginTop: 14 }}>Manage your wallet</Text>
              <ChevronRight color={iconGray} size={18} style={{ marginTop: 14 }} />
            </Pressable>
          </Link>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ color: iconGray, fontWeight: '500', marginTop: 14 }}>Manage your wallet</Text>
            <ChevronRight color={iconGray} size={18} style={{ marginTop: 14 }} />
          </View>
        )}
      </View>

      {/* Section 4: More Services */}
      <View style={{ backgroundColor: '#ffffff', padding: 16, marginBottom: 10, opacity: isAuthenticated ? 1 : 0.6 }}>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>More Services</Text>
        
        {isAuthenticated ? (
          <>
            <Link href="/useraccounts/moreservice/favourites" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Heart color="#ef4444" size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Favourites</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>
            
            <Link href="/useraccounts/moreservice/recentlyviewed" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Clock color="#f97316" size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Recently Viewed</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>
            
            <Link href="/useraccounts/moreservice/buyagain" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <RotateCw color="#22c55e" size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Buy Again</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>
            
            <Link href="/useraccounts/moreservice/getvouchers" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ticket color={primaryBlue} size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Get Vouchers</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Heart color="#ef4444" size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Favourites</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Clock color="#f97316" size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Recently Viewed</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <RotateCw color="#22c55e" size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Buy Again</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ticket color={primaryBlue} size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Get Vouchers</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
