import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { MapCoordinates, getOrderStatusMarkerColor } from '../../../utils/mapboxUtils';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

// Try to import native Mapbox module
let Mapbox: any = null;
let MapView: any = null;
let Camera: any = null;
let PointAnnotation: any = null;
let isMapboxAvailable = false;

try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default || mapboxModule;
  MapView = mapboxModule.MapView;
  Camera = mapboxModule.Camera;
  PointAnnotation = mapboxModule.PointAnnotation;
  
  if (MAPBOX_ACCESS_TOKEN && Mapbox && Mapbox.setAccessToken) {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    isMapboxAvailable = true;
  }
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
  style?: any;
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const cameraRef = useRef<any>(null);

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
          <Text style={styles.errorText}>Map unavailable</Text>
          <Text style={styles.errorSubtext}>
            Mapbox access token not configured. Please add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file.
          </Text>
        </View>
      </View>
    );
  }

  if (!mapCenter) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Map unavailable</Text>
          <Text style={styles.errorSubtext}>No coordinates available</Text>
        </View>
      </View>
    );
  }

  // If native Mapbox is not available, show rebuild message
  if (!isMapboxAvailable) {
    return (
      <View style={[styles.container, { height }, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Map requires development build</Text>
          <Text style={styles.errorSubtext}>
            @rnmapbox/maps requires native code.{'\n\n'}
            Run:{'\n'}
            npx expo run:android{'\n'}
            or{'\n'}
            npx expo run:ios
          </Text>
        </View>
      </View>
    );
  }

  // Native Mapbox is available - render interactive map
  return (
    <View style={[styles.container, { height }, style]}>
      <MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
            zoomLevel: initialZoom,
          }}
        />

        {markers.map((marker) => (
          <PointAnnotation
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
          </PointAnnotation>
        ))}
      </MapView>

      {!mapLoaded && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a61d7" />
          <Text style={styles.loadingText}>Loading map...</Text>
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

