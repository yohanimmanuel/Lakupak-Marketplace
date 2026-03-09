import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelpCircle, AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react-native';

const primaryBlue = '#0a61d7';

export default function ReturnRefundInfo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          header: () => (
            <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Return &amp; Refund Info</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <RotateCcw size={18} color={primaryBlue} />
            <Text style={styles.headerText}>Return &amp; refund basics</Text>
          </View>
          <Text style={styles.bodyText}>
            You can request a return for eligible items and get a refund after the request is
            approved and, when required, the items are received back in good condition.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <AlertCircle size={18} color="#f59e0b" />
            <Text style={styles.headerText}>Policy comes from product data</Text>
          </View>
          <Text style={styles.bodyText}>
            Each product has its own return policy stored in the product data. It defines whether
            it is returnable, how many days after delivery you can request a return, and any
            specific conditions.
          </Text>
          <Text style={styles.bodyText}>
            Laku checks every return/refund request against this policy. Different items in the same
            order can therefore have different eligibility and refund amounts.
          </Text>
          <Text style={styles.strongText}>
            Refund approval and amount always depend on the return days and rules saved on each
            product, not only on the order status.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <HelpCircle size={18} color={primaryBlue} />
            <Text style={styles.headerText}>Quick flow</Text>
          </View>
          <View style={styles.list}>
            <Text style={styles.listItem}>1. Check the product&apos;s return policy and time limit.</Text>
            <Text style={styles.listItem}>2. Start a return/refund request from order details.</Text>
            <Text style={styles.listItem}>3. Follow any instructions to send back the item if needed.</Text>
            <Text style={styles.listItem}>4. Wait for review and refund to your payment method or wallet.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
    marginLeft: 35,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 4,
  },
  strongText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
  },
  list: {
    marginTop: 4,
  },
  listItem: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 4,
  },
});

