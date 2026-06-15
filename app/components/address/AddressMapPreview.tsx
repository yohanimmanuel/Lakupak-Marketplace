import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LakuTheme } from '@/constants/Colors';
import MapComponent from '../ordersshipment/MapComponent';
import { geocodeAddress, MapCoordinates } from '../../../utils/mapboxUtils';

interface AddressMapPreviewProps {
  address: string;
  height?: number;
  showAddressBar?: boolean;
  onScrollInteractionChange?: (active: boolean) => void;
}

export default function AddressMapPreview({
  address,
  height = 280,
  showAddressBar = true,
  onScrollInteractionChange,
}: AddressMapPreviewProps) {
  const { t } = useTranslation();
  const [coordinates, setCoordinates] = useState<MapCoordinates | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const trimmed = address.trim();

  // Geocode the typed address only — no phone GPS. Same as Driver geocoding a stop
  // address without proximity (Driver only passes GPS because the driver is near deliveries).
  useEffect(() => {
    if (!trimmed) {
      setCoordinates(null);
      setIsGeocoding(false);
      return;
    }

    let cancelled = false;
    setIsGeocoding(true);

    (async () => {
      try {
        const result = await geocodeAddress(trimmed);
        if (!cancelled) {
          setCoordinates(result.coordinates);
        }
      } catch {
        if (!cancelled) {
          setCoordinates(null);
        }
      } finally {
        if (!cancelled) {
          setIsGeocoding(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trimmed]);

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
          onScrollInteractionChange={onScrollInteractionChange}
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
