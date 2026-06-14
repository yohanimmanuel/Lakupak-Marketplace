import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { Crosshair, Navigation } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LakuTheme } from '@/constants/Colors';
import { MapCoordinates } from '../../../utils/mapboxUtils';
import { getMapboxAccessToken, hasMapboxAccessToken } from '../../../utils/mapboxConfig';
import AddressLocationMarker from '../map/AddressLocationMarker';

const MAP_STYLE_URL = 'mapbox://styles/mapbox/streets-v12';
const INDONESIA_CENTER: [number, number] = [118.0, -2.5];

type Coordinate = [number, number];

type CameraHandle = {
  setCamera: (config: {
    centerCoordinate?: Coordinate;
    zoomLevel?: number;
    animationDuration?: number;
    animationMode?: string;
  }) => void;
  fitBounds: (
    coordinates: Coordinate[],
    options?: {
      padding?: { top: number; bottom: number; left: number; right: number };
      animationDuration?: number;
    },
  ) => void;
};

type MapViewProps = {
  style?: object;
  styleURL?: string;
  logoEnabled?: boolean;
  attributionEnabled?: boolean;
  scaleBarEnabled?: boolean;
  compassEnabled?: boolean;
  onDidFinishLoadingMap?: () => void;
  onTouchStart?: () => void;
  zoomEnabled?: boolean;
  scrollEnabled?: boolean;
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
  children?: React.ReactNode;
};

type CameraProps = {
  ref?: React.Ref<CameraHandle>;
  defaultSettings?: {
    centerCoordinate: Coordinate;
    zoomLevel: number;
  };
};

type MarkerViewProps = {
  id: string;
  coordinate: Coordinate;
  anchor?: { x: number; y: number };
  children?: React.ReactNode;
};

type MapboxExports = {
  setAccessToken?: (token: string) => void;
  MapView?: React.ComponentType<MapViewProps>;
  Camera?: React.ComponentType<CameraProps>;
  MarkerView?: React.ComponentType<MarkerViewProps>;
};

function getMapboxExports(mod: unknown): MapboxExports | null {
  if (typeof mod !== 'object' || mod === null) return null;
  const record = mod as Record<string, unknown>;
  const base = (typeof record.default === 'object' && record.default !== null
    ? record.default
    : record) as Record<string, unknown>;

  const pickComponent = (key: string) => {
    const value = base[key];
    return typeof value === 'function' || (typeof value === 'object' && value !== null)
      ? (value as React.ComponentType<unknown>)
      : undefined;
  };

  return {
    setAccessToken: typeof base.setAccessToken === 'function'
      ? (base.setAccessToken as (token: string) => void)
      : undefined,
    MapView: pickComponent('MapView') as MapboxExports['MapView'],
    Camera: pickComponent('Camera') as MapboxExports['Camera'],
    MarkerView: pickComponent('MarkerView') as MapboxExports['MarkerView'],
  };
}

let Mapbox: MapboxExports | null = null;
let MapView: MapboxExports['MapView'] | null = null;
let Camera: MapboxExports['Camera'] | null = null;
let MarkerView: MapboxExports['MarkerView'] | null = null;
let isMapboxAvailable = false;

try {
  const mapboxModule = require('@rnmapbox/maps') as unknown;
  const exports = getMapboxExports(mapboxModule);
  if (exports) {
    Mapbox = exports;
    MapView = exports.MapView ?? null;
    Camera = exports.Camera ?? null;
    MarkerView = exports.MarkerView ?? null;
    if (hasMapboxAccessToken()) {
      Mapbox.setAccessToken?.(getMapboxAccessToken());
    }

    isMapboxAvailable = Boolean(hasMapboxAccessToken() && MapView && Camera && MarkerView);
  }
} catch {
  isMapboxAvailable = false;
}

export interface MapMarker {
  id: string;
  coordinates: MapCoordinates;
  label?: string;
}

interface MapComponentProps {
  markers?: MapMarker[];
  center?: MapCoordinates;
  zoom?: number;
  height?: number;
  style?: ViewStyle | ViewStyle[];
  showRecenter?: boolean;
  onMarkerClick?: (markerId: string) => void;
  overlay?: React.ReactNode;
}

export default function MapComponent({
  markers = [],
  center,
  zoom = 15,
  height = 280,
  style,
  showRecenter = true,
  onMarkerClick,
  overlay,
}: MapComponentProps) {
  const { t } = useTranslation();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isCentered, setIsCentered] = useState(true);
  const cameraRef = useRef<CameraHandle | null>(null);

  const focusCoordinate = useMemo(() => {
    if (markers.length > 0) {
      return [markers[0].coordinates.longitude, markers[0].coordinates.latitude] as Coordinate;
    }
    if (center) {
      return [center.longitude, center.latitude] as Coordinate;
    }
    return INDONESIA_CENTER;
  }, [markers, center]);

  const initialZoom = markers.length > 1 ? zoom - 1 : markers.length === 0 && !center ? 4.5 : zoom;

  const recenterMap = useCallback(() => {
    setIsCentered(true);
    if (!cameraRef.current) return;

    if (markers.length > 1) {
      const coordinates = markers.map(
        (marker) => [marker.coordinates.longitude, marker.coordinates.latitude] as Coordinate,
      );
      cameraRef.current.fitBounds(coordinates, {
        padding: { top: 56, bottom: 56, left: 40, right: 40 },
        animationDuration: 600,
      });
      return;
    }

    cameraRef.current.setCamera({
      centerCoordinate: focusCoordinate,
      zoomLevel: zoom,
      animationDuration: 600,
      animationMode: 'flyTo',
    });
  }, [focusCoordinate, markers, zoom]);

  useEffect(() => {
    if (!mapLoaded || !cameraRef.current || !isCentered) return;
    recenterMap();
  }, [isCentered, mapLoaded, markers, recenterMap]);

  if (!hasMapboxAccessToken()) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>{t('map.errors.unavailable')}</Text>
          <Text style={styles.fallbackBody}>{t('map.errors.missingToken')}</Text>
        </View>
      </View>
    );
  }

  if (!isMapboxAvailable || !MapView || !Camera || !MarkerView) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>{t('map.errors.requiresDevBuildTitle')}</Text>
          <Text style={styles.fallbackBody}>{t('map.errors.requiresDevBuildBody')}</Text>
        </View>
      </View>
    );
  }

  const MapViewComponent = MapView;
  const CameraComponent = Camera;
  const MarkerViewComponent = MarkerView;

  return (
    <View style={[styles.container, { height }, style]}>
      <MapViewComponent
        style={styles.map}
        styleURL={MAP_STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
        onTouchStart={() => setIsCentered(false)}
        zoomEnabled
        scrollEnabled
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <CameraComponent
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: focusCoordinate,
            zoomLevel: initialZoom,
          }}
        />

        {markers.map((marker) => (
          <MarkerViewComponent
            key={marker.id}
            id={marker.id}
            coordinate={[marker.coordinates.longitude, marker.coordinates.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Pressable
              onPress={() => onMarkerClick?.(marker.id)}
              disabled={!onMarkerClick}
            >
              <AddressLocationMarker />
            </Pressable>
          </MarkerViewComponent>
        ))}
      </MapViewComponent>

      {!mapLoaded ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={LakuTheme.primary} />
          <Text style={styles.loadingText}>{t('map.loading')}</Text>
        </View>
      ) : null}

      {overlay}

      {showRecenter && markers.length > 0 ? (
        <View style={styles.recenterFab}>
          <Pressable
            onPress={recenterMap}
            hitSlop={12}
            style={({ pressed }) => [
              styles.fabInner,
              pressed && styles.fabPressed,
              isCentered && styles.fabActive,
            ]}
          >
            {isCentered ? (
              <Navigation size={18} color="#ffffff" fill="#ffffff" />
            ) : (
              <Crosshair size={20} color={LakuTheme.primary} />
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: LakuTheme.mapScreen,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: LakuTheme.textSecondary,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: LakuTheme.mapFallback,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackBody: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.82)',
    textAlign: 'center',
    lineHeight: 20,
  },
  recenterFab: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
  },
  fabInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.75,
  },
  fabActive: {
    backgroundColor: LakuTheme.primary,
  },
});
