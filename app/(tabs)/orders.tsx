import { StyleSheet, View as RNView } from 'react-native';
import { Text, View } from '../components/Themed';

export default function OrdersScreen() {
  return (
    <RNView style={styles.gradientBg}>
      <View style={styles.container}>
        <Text style={styles.title}>Orders</Text>
      </View>
    </RNView>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
});
