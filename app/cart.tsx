import { useLayoutEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function CartScreen() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Cart',
      headerStyle: { backgroundColor: '#ffffff' },
      headerTitleStyle: { color: '#111827' },
      headerTintColor: '#0a61d7',
      headerBackTitleVisible: false,
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>cart</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
});
