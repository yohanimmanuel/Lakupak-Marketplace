import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../stores/authStore';

export default function Index() {
  const router = useRouter();
  const { token, user, isLoading } = useAuthStore();
  
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isAuthenticated = !!token && !!user;
    
    if (isAuthenticated) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/useraccounts/welcome');
    }
  }, [isLoading, token, user, router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" color="#0a61d7" />
    </View>
  );
}

