/**
 * Runtime Mapbox token for map tiles + geocoding (public pk.…).
 * Native SDK download uses MAPBOX_DOWNLOAD_TOKEN at build time only.
 */
export function getMapboxAccessToken(): string {
  return process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || '';
}

export function hasMapboxAccessToken(): boolean {
  return getMapboxAccessToken().length > 0;
}
