/**
 * Runtime Mapbox token for map tiles + geocoding (public pk.… only).
 * MAPBOX_DOWNLOAD_TOKEN (secret sk.…) is build-time SDK download only — never for geocoding.
 *
 * Driver: EXPO_PUBLIC_MAPBOX_TOKEN | Marketplace: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (same pk role).
 */
export function getMapboxAccessToken(): string {
  return (
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ||
    ''
  );
}

export function hasMapboxAccessToken(): boolean {
  return getMapboxAccessToken().length > 0;
}
