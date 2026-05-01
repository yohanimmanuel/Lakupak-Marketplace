import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, type ViewStyle } from 'react-native';
import { MapCoordinates, getOrderStatusMarkerColor } from '../../../utils/mapboxUtils';
import { useTranslation } from 'react-i18next';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

type MapboxStyleURL = {
  Street: string;
  [key: string]: string;
};

interface MapboxDefaultExport {
  StyleURL: MapboxStyleURL;
  setAccessToken?: (token: string) => void;
}

type GenericMapboxProps = Record<string, unknown>;

interface CameraHandle {
  setCamera: (config: {
    centerCoordinate: [number, number];
    zoomLevel: number;
    animationDuration?: number;
  }) => void;
  fitBounds: (
    coordinates: Array<[number, number]>,
    options?: {
      padding?: { top: number; bottom: number; left: number; right: number };
      animationDuration?: number;
    }
  ) => void;
}

type MapboxMapViewProps = GenericMapboxProps & {
  style?: object;
  styleURL?: string;
  onDidFinishLoadingMap?: () => void;
  zoomEnabled?: boolean;
  scrollEnabled?: boolean;
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
  children?: React.ReactNode;
};

type MapboxCameraProps = GenericMapboxProps & {
  defaultSettings?: {
    centerCoordinate: [number, number];
    zoomLevel: number;
  };
  children?: React.ReactNode;
};

type MapboxPointAnnotationProps = GenericMapboxProps & {
  id: string;
  coordinate: [number, number];
  onSelected?: () => void;
  children?: React.ReactNode;
};

type MapViewComponent = React.ComponentType<MapboxMapViewProps>;
type CameraComponent = React.ComponentType<
  MapboxCameraProps & React.RefAttributes<CameraHandle>
>;
type PointAnnotationComponent = React.ComponentType<MapboxPointAnnotationProps>;

type MapboxRuntimeModule = MapboxDefaultExport & {
  default?: MapboxDefaultExport;
  MapView: MapViewComponent;
  Camera: CameraComponent;
  PointAnnotation: PointAnnotationComponent;
};

// Try to import native Mapbox module
let Mapbox: MapboxDefaultExport | null = null;
let MapView: MapViewComponent | null = null;
let Camera: CameraComponent | null = null;
let PointAnnotation: PointAnnotationComponent | null = null;
let isMapboxAvailable = false;

try {
  const mapboxModule = require('@rnmapbox/maps') as MapboxRuntimeModule;
  Mapbox = mapboxModule.default || mapboxModule;
  MapView = mapboxModule.MapView;
  Camera = mapboxModule.Camera;
  PointAnnotation = mapboxModule.PointAnnotation;
  
  if (MAPBOX_ACCESS_TOKEN && Mapbox?.setAccessToken) {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
  }

  isMapboxAvailable = Boolean(
    MAPBOX_ACCESS_TOKEN && Mapbox && MapView && Camera && PointAnnotation
  );
} catch (error) {
  // Native module not available - requires development build
  isMapboxAvailable = false;
}


interface MapMarker {
  id: string;
  coordinates: MapCoordinates;
  label?: string;
  color?: string;
}

interface MapComponentProps {
  markers?: MapMarker[];
  center?: MapCoordinates;
  zoom?: number;
  height?: number;
  style?: ViewStyle | ViewStyle[];
  showControls?: boolean;
  onMarkerClick?: (markerId: string) => void;
}

export default function MapComponent({
  markers = [],
  center,
  zoom = 12,
  height = 300,
  style,
  showControls = true,
  onMarkerClick,
}: MapComponentProps) {
  const { t } = useTranslation();
  const [mapLoaded, setMapLoaded] = useState(false);
  const cameraRef = useRef<CameraHandle | null>(null);

  // Determine map center and initial zoom
  const mapCenter = markers.length > 0 
    ? markers[0].coordinates 
    : center;

  const initialZoom = markers.length > 1 ? zoom - 1 : zoom; // Zoom out slightly for multiple markers

  useEffect(() => {
    if (!mapLoaded || !cameraRef.current || !mapCenter) return;

    if (markers.length === 0) {
      // No markers, center on provided center
      cameraRef.current.setCamera({
        centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
        zoomLevel: zoom,
        animationDuration: 500,
      });
    } else if (markers.length === 1) {
      // Single marker, center on it
      const marker = markers[0];
      cameraRef.current.setCamera({
        centerCoordinate: [marker.coordinates.longitude, marker.coordinates.latitude],
        zoomLevel: zoom,
        animationDuration: 500,
      });
    } else if (markers.length > 1) {
      // Multiple markers, fit bounds
      const coordinates = markers.map(m => [m.coordinates.longitude, m.coordinates.latitude] as [number, number]);
      cameraRef.current.fitBounds(coordinates, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        animationDuration: 500,
      });
    }
  }, [markers, mapLoaded, mapCenter, zoom]);

  // Check for required configuration
  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('map.errors.unavailable')}</Text>
          <Text style={styles.errorSubtext}>
            {t('map.errors.missingToken')}
          </Text>
        </View>
      </View>
    );
  }

  if (!mapCenter) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('map.errors.unavailable')}</Text>
          <Text style={styles.errorSubtext}>{t('map.errors.noCoordinates')}</Text>
        </View>
      </View>
    );
  }

  // If native Mapbox is not available, show rebuild message
  if (!isMapboxAvailable) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('map.errors.requiresDevBuildTitle')}</Text>
          <Text style={styles.errorSubtext}>
            {t('map.errors.requiresDevBuildBody')}
          </Text>
        </View>
      </View>
    );
  }

  const MapViewComponent = MapView;
  const CameraComponent = Camera;
  const PointAnnotationComponent = PointAnnotation;

  if (!MapViewComponent || !CameraComponent || !PointAnnotationComponent || !Mapbox) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('map.errors.unavailable')}</Text>
          <Text style={styles.errorSubtext}>{t('map.errors.componentsUnavailable')}</Text>
        </View>
      </View>
    );
  }

  // Native Mapbox is available - render interactive map
  return (
    <View style={[styles.container, { height }, style]}>
      <MapViewComponent
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <CameraComponent
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
            zoomLevel: initialZoom,
          }}
        />

        {markers.map((marker) => (
          <PointAnnotationComponent
            key={marker.id}
            id={marker.id}
            coordinate={[marker.coordinates.longitude, marker.coordinates.latitude]}
            onSelected={() => {
              if (onMarkerClick) {
                onMarkerClick(marker.id);
              }
            }}
          >
            <View style={styles.markerContainer}>
              <View
                style={[
                  styles.markerCircle,
                  { backgroundColor: marker.color || getOrderStatusMarkerColor('') },
                ]}
              />
              {marker.label && (
                <View style={styles.markerLabelContainer}>
                  <Text style={styles.markerLabel}>{marker.label}</Text>
                </View>
              )}
            </View>
          </PointAnnotationComponent>
        ))}
      </MapViewComponent>

      {!mapLoaded && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a61d7" />
          <Text style={styles.loadingText}>{t('map.loading')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  fallbackText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  fallbackSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  fallbackLink: {
    fontSize: 14,
    color: '#0a61d7',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  markerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderRadius: 30,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'white',
  },
  markerLabelContainer: {
    marginLeft: 0,
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
});

