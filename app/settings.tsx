import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { ChevronRight, ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { Stack, Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const logout = useAuthStore(s => s.logout);

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={{ backgroundColor: '#f9fafb', paddingVertical: 10, paddingHorizontal: 16 }}>
      <Text style={{ color: '#6B7280', fontWeight: '600' }}>{title}</Text>
    </View>
  );

  const Row = ({ title, onPress, href }: { title: string; onPress?: () => void; href?: Parameters<typeof Link>[0]['href'] }) => {
    const content = (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#ffffff' }}>
        <Text style={{ color: '#111827', fontSize: 15 }}>{title}</Text>
        <ChevronRight color="#6B7280" size={18} />
      </View>
    )
    if (href) {
      return (
        <Link href={href} asChild>
          <Pressable>{content}</Pressable>
        </Link>
      )
    }
    return <Pressable onPress={onPress}>{content}</Pressable>
  };

  const onLogout = async () => {
    // Navigate immediately for instant UI response
    router.replace('/(tabs)/account');
    // Clear auth state in background
    logout();
  };

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>Settings</Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <ScrollView style={{ flex: 1 }}>
        <SectionHeader title="My Account" />
        <Row title="Account & Security" href={{ pathname: '/useraccounts/userprofile/editprofile' }} />
        <Row title="My Addresses" href={{ pathname: '/useraccounts/userprofile/addresses' }} />
        <Row title="Linked Payment Methods" />

        <SectionHeader title="Support" />
        <Row title="Help Center" href={{ pathname: '/useraccounts/consent/helpcenter' }} />
        <Row title="Community Rules" href={{ pathname: '/useraccounts/consent/community-rules' }} />
        <Row title="Policies" href={{ pathname: '/useraccounts/consent/security-privacy' }} />
      </ScrollView>

      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#ffffff' }}>
        <Pressable onPress={onLogout} style={{ backgroundColor: '#0a61d7', paddingVertical: 14, borderRadius: 10 }}>
          <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '700' }}>Log Out</Text>
        </Pressable>
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
});
