import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

interface TopDistributor {
  name: string;
  logo: string;
}

interface TopDistributorsProps {
  distributors: TopDistributor[];
  onDistributorPress: (distributorName: string) => void;
}

export default function TopDistributors({
  distributors,
  onDistributorPress,
}: TopDistributorsProps) {
  const { t } = useTranslation();
  if (distributors.length === 0) {
    return null;
  }

  const grayBg = '#f3f4f6';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('search.sections.topDistributors')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.distributorsContainer}
        keyboardShouldPersistTaps="handled"
      >
        {distributors.map((distributor, index) => (
          <TouchableOpacity
            key={index}
            style={styles.distributorItem}
            onPress={() => onDistributorPress(distributor.name)}
          >
            <View style={[styles.distributorLogoContainer, { backgroundColor: grayBg }]}>
              {distributor.logo ? (
                <Image
                  source={{ uri: distributor.logo }}
                  style={styles.distributorLogo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderLogo} />
              )}
            </View>
            <Text style={styles.distributorName} numberOfLines={1}>
              {distributor.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  distributorsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  distributorItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  distributorLogoContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  distributorLogo: {
    width: 64,
    height: 64,
  },
  placeholderLogo: {
    width: 56,
    height: 56,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  distributorName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    color: '#111827',
    maxWidth: 80,
  },
});

