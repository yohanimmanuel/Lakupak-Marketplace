import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LakuTheme } from '@/constants/Colors';
import MapComponent from '../ordersshipment/MapComponent';
import { MapShimmerOverlay } from '../SkeletonLoader';
import { geocodeAddress, MapCoordinates, type GeocodePrecision } from '../../../services/geocode';
import { useAuthStore } from '../../../stores/authStore';

interface AddressMapPreviewProps {
  address: string;
  /** Use stored coordinates when the address text still matches (avoids geocode API). */
  savedCoordinates?: MapCoordinates | null;
  savedPrecision?: GeocodePrecision | null;
  height?: number;
  showAddressBar?: boolean;
  onScrollInteractionChange?: (active: boolean) => void;
}

export default function AddressMapPreview({
  address,
  savedCoordinates = null,
  savedPrecision = null,
  height = 280,
  showAddressBar = true,
  onScrollInteractionChange,
}: AddressMapPreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const [coordinates, setCoordinates] = useState<MapCoordinates | null>(null);
  const [isApproximate, setIsApproximate] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const trimmed = address.trim();
  const geocodeRequestRef = useRef(0);

  // Wait until typing pauses, then geocode the full string (Driver geocodes saved addresses,
  // not partial input). Ignore stale responses so out-of-order fetches cannot win.
  useEffect(() => {
    if (!trimmed) {
      geocodeRequestRef.current += 1;
      setCoordinates(null);
      setIsApproximate(false);
      setIsGeocoding(false);
      return;
    }

    if (
      savedCoordinates &&
      typeof savedCoordinates.latitude === 'number' &&
      typeof savedCoordinates.longitude === 'number'
    ) {
      geocodeRequestRef.current += 1;
      setCoordinates(savedCoordinates);
      setIsApproximate(savedPrecision === 'approximate' || savedPrecision === 'area');
      setIsGeocoding(false);
      return;
    }

    setIsGeocoding(true);
    const timer = setTimeout(() => {
      const requestId = ++geocodeRequestRef.current;

      void geocodeAddress(trimmed, token)
        .then((result) => {
          if (requestId !== geocodeRequestRef.current) return;
          setCoordinates(result.coordinates);
          setIsApproximate(result.precision === 'approximate' || result.precision === 'area');
          setIsGeocoding(false);
        })
        .catch(() => {
          if (requestId !== geocodeRequestRef.current) return;
          setCoordinates(null);
          setIsApproximate(false);
          setIsGeocoding(false);
        });
    }, 700);

    return () => {
      clearTimeout(timer);
      geocodeRequestRef.current += 1;
    };
  }, [trimmed, token, savedCoordinates, savedPrecision]);

  const markers = useMemo(() => {
    if (!coordinates) return [];
    return [{ id: 'address-preview', coordinates }];
  }, [coordinates]);

  const overlay = (() => {
    if (isGeocoding) {
      return (
        <View style={styles.geocodeOverlay}>
          <MapShimmerOverlay />
          <Text style={styles.geocodeLoadingText}>{t('profile.editAddress.mapLoading')}</Text>
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
          <View style={styles.addressTextWrap}>
            <Text style={styles.addressText} numberOfLines={2}>
              {trimmed}
            </Text>
            {isApproximate && coordinates ? (
              <Text style={styles.approximateHint}>
                {t('profile.editAddress.mapApproximate')}
              </Text>
            ) : null}
          </View>
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
  geocodeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 10,
  },
  geocodeLoadingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    zIndex: 11,
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
  addressTextWrap: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: LakuTheme.text,
    lineHeight: 20,
    fontWeight: '500',
  },
  approximateHint: {
    marginTop: 4,
    fontSize: 12,
    color: LakuTheme.textSecondary,
    lineHeight: 16,
  },
});
