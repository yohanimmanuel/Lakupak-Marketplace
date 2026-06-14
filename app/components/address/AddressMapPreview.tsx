import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { LakuTheme } from '@/constants/Colors';
import MapComponent from '../ordersshipment/MapComponent';
import { geocodeAddress, MapCoordinates } from '../../../utils/mapboxUtils';

interface AddressMapPreviewProps {
  address: string;
  height?: number;
  showAddressBar?: boolean;
}

export default function AddressMapPreview({
  address,
  height = 280,
  showAddressBar = true,
}: AddressMapPreviewProps) {
  const { t } = useTranslation();
  const [coordinates, setCoordinates] = useState<MapCoordinates | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [proximity, setProximity] = useState<[number, number] | undefined>();
  const trimmed = address.trim();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!cancelled) {
          setProximity([position.coords.longitude, position.coords.latitude]);
        }
      } catch {
        // Proximity bias is optional — geocoding still works globally without it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trimmed) {
      setCoordinates(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const result = await geocodeAddress(trimmed, proximity);
        setCoordinates(result.coordinates);
      } catch {
        setCoordinates(null);
      } finally {
        setIsGeocoding(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [trimmed, proximity]);

  const markers = useMemo(() => {
    if (!coordinates) return [];
    return [{ id: 'address-preview', coordinates }];
  }, [coordinates]);

  const overlay = (() => {
    if (isGeocoding) {
      return (
        <View style={styles.messageOverlay}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.messageText}>{t('profile.editAddress.mapLoading')}</Text>
        </View>
      );
    }

    if (!trimmed) {
      return (
        <View style={styles.messageOverlay}>
          <MapPin color="#ffffff" size={28} />
          <Text style={styles.messageTitle}>{t('profile.editAddress.mapEnterAddress')}</Text>
          <Text style={styles.messageText}>{t('profile.editAddress.mapHint')}</Text>
        </View>
      );
    }

    if (!coordinates) {
      return (
        <View style={styles.messageOverlay}>
          <MapPin color="#ffffff" size={28} />
          <Text style={styles.messageTitle}>{t('profile.editAddress.mapNotFound')}</Text>
        </View>
      );
    }

    return null;
  })();

  return (
    <View style={styles.card}>
      <View style={[styles.mapShell, { height }]}>
        <MapComponent
          markers={markers}
          center={coordinates ?? undefined}
          height={height}
          zoom={coordinates ? 15 : 4.5}
          showRecenter={Boolean(coordinates)}
          overlay={overlay}
        />
      </View>
      {showAddressBar && trimmed ? (
        <View style={styles.addressBar}>
          <View style={styles.addressDot} />
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
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: LakuTheme.backgroundCard,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LakuTheme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  mapShell: {
    width: '100%',
    backgroundColor: LakuTheme.mapScreen,
  },
  messageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(11, 18, 32, 0.42)',
    zIndex: 10,
  },
  messageTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  messageText: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    lineHeight: 18,
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: LakuTheme.border,
    backgroundColor: '#ffffff',
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: LakuTheme.primary,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: LakuTheme.text,
    lineHeight: 20,
    fontWeight: '500',
  },
});
