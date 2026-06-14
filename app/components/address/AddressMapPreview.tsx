import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import MapComponent from '../ordersshipment/MapComponent';
import { geocodeAddress, MapCoordinates } from '../../../utils/mapboxUtils';

interface AddressMapPreviewProps {
  address: string;
  height?: number;
  showAddressBar?: boolean;
}

export default function AddressMapPreview({
  address,
  height = 180,
  showAddressBar = true,
}: AddressMapPreviewProps) {
  const { t } = useTranslation();
  const [coordinates, setCoordinates] = useState<MapCoordinates | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const trimmed = address.trim();

  useEffect(() => {
    if (!trimmed) {
      setCoordinates(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const result = await geocodeAddress(trimmed);
        setCoordinates(result.coordinates);
      } finally {
        setIsGeocoding(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [trimmed]);

  const markers = useMemo(() => {
    if (!coordinates) return [];
    return [
      {
        id: 'address-preview',
        coordinates,
        color: '#ef4444',
      },
    ];
  }, [coordinates]);

  return (
    <View style={styles.card}>
      <View style={[styles.mapContainer, { height }]}>
        {trimmed && coordinates ? (
          <MapComponent
            markers={markers}
            center={coordinates}
            height={height}
            zoom={15}
            showControls={false}
          />
        ) : (
          <View style={[styles.placeholder, { height }]}>
            {isGeocoding ? (
              <>
                <ActivityIndicator color="#0a61d7" />
                <Text style={styles.placeholderText}>{t('profile.editAddress.mapLoading')}</Text>
              </>
            ) : (
              <>
                <MapPin color="#9ca3af" size={32} />
                <Text style={styles.placeholderText}>
                  {trimmed
                    ? t('profile.editAddress.mapNotFound')
                    : t('profile.editAddress.mapEnterAddress')}
                </Text>
              </>
            )}
          </View>
        )}
      </View>
      {showAddressBar && trimmed ? (
        <View style={styles.addressBar}>
          <Text style={styles.addressText} numberOfLines={2}>
            {trimmed}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  mapContainer: {
    width: '100%',
    backgroundColor: '#f3f4f6',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f3f4f6',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  addressBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
});
