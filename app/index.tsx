import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  
  useEffect(() => {
    // Navigate immediately on mount
    router.replace('/(tabs)/home');
  }, []);

  // White background matches splash screen for smooth transition
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

